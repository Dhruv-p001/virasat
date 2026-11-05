"use server";

import {
  baseMimeType,
  CONSENT_WORDING_VERSION,
  MAX_SCAN_PAGES,
  planCaptureFiles,
  type CaptureFileSpec,
  type CaptureSource,
  type CaptureUploadSlot,
} from "@virasat/core";
import { z } from "zod";
import { getUserId } from "@/lib/auth.ts";
import { startPipeline } from "@/lib/capture/pipeline.ts";
import { createAdminClient } from "@/lib/supabase/admin.ts";

// The organiser's upload steps (ADR 0014). The caller is the signed-in organiser: each step checks
// the session and the database re-checks the actor (ADR 0010). Files never pass through here; the
// browser sends them straight to storage with signed upload URLs (ADR 0012).

const UuidSchema = z.uuid();

const FileSpecSchema = z.object({
  role: z.enum(["recording", "page", "copy"]),
  page: z.number().int().min(0).max(MAX_SCAN_PAGES),
  mime: z.string().min(1).max(100),
  size: z.number().int().positive(),
  width: z.number().int().positive().optional(),
  height: z.number().int().positive().optional(),
});
const SourceSchema = z.enum(["voice", "handwriting"]);

export type StartCaptureResult =
  | { ok: true; jobId: string; uploads: CaptureUploadSlot[] }
  | { ok: false; reason: "not_allowed" | "rejected" };

export type RefreshCaptureResult =
  { ok: true; done: boolean; uploads: CaptureUploadSlot[] } | { ok: false; reason: "not_allowed" };

export type ConfirmCaptureResult =
  { ok: true } | { ok: false; reason: "not_allowed" | "incomplete" };

async function signedUploadUrl(
  bucket: string,
  path: string,
  upsert: boolean,
): Promise<string | null> {
  const { data, error } = await createAdminClient()
    .storage.from(bucket)
    .createSignedUploadUrl(path, { upsert });
  return error ? null : data.signedUrl;
}

/**
 * Registers a capture and every one of its files, and issues an upload URL for each. A recording
 * is one file. A handwriting capture is its pages (the first spends the capture) and the readable
 * copy of each. The consent the organiser ticked is recorded by begin_capture().
 */
export async function startCapture(
  personId: string,
  source: CaptureSource,
  files: CaptureFileSpec[],
): Promise<StartCaptureResult> {
  const userId = await getUserId();
  if (!userId) return { ok: false, reason: "not_allowed" };

  const parsed = z
    .object({ personId: UuidSchema, source: SourceSchema, files: z.array(FileSpecSchema) })
    .safeParse({ personId, source, files });
  if (!parsed.success) return { ok: false, reason: "rejected" };
  const specs: CaptureFileSpec[] = parsed.data.files.map((file) => ({
    ...file,
    mime: baseMimeType(file.mime),
  }));
  if (planCaptureFiles(parsed.data.source, specs).length > 0) {
    return { ok: false, reason: "rejected" };
  }
  const [first, ...rest] = specs;
  if (!first) return { ok: false, reason: "rejected" };

  const admin = createAdminClient();
  const { data, error } = await admin.rpc("begin_capture", {
    p_source: parsed.data.source,
    p_mime_type: first.mime,
    p_byte_size: first.size,
    p_consent_wording_version: CONSENT_WORDING_VERSION,
    p_actor: userId,
    p_person_id: parsed.data.personId,
  });
  if (error) {
    if (error.code === "42501") return { ok: false, reason: "not_allowed" };
    if (error.code === "22023") return { ok: false, reason: "rejected" };
    throw new Error("begin_capture failed");
  }
  const started = data[0];
  if (!started) throw new Error("begin_capture returned nothing");

  const registered = [
    { mediaId: started.media_id, bucket: started.storage_bucket, path: started.storage_path },
  ];
  // Which media row each page became, so a copy can point at its page.
  const pageMedia = new Map<number, string>([[0, started.media_id]]);
  for (const file of rest) {
    const original = file.role === "copy" ? pageMedia.get(file.page) : undefined;
    if (file.role === "copy" && !original) return { ok: false, reason: "rejected" };
    const { data: added, error: addError } = await admin.rpc("add_capture_media", {
      p_actor: userId,
      p_job_id: started.job_id,
      p_mime_type: file.mime,
      p_byte_size: file.size,
      ...(original ? { p_derived_from_media_id: original } : {}),
      ...(file.width === undefined ? {} : { p_width: file.width }),
      ...(file.height === undefined ? {} : { p_height: file.height }),
    });
    if (addError) {
      if (addError.code === "42501") return { ok: false, reason: "not_allowed" };
      if (addError.code === "22023") return { ok: false, reason: "rejected" };
      throw new Error("add_capture_media failed");
    }
    const media = added[0];
    if (!media) throw new Error("add_capture_media returned nothing");
    if (file.role === "page") pageMedia.set(file.page, media.media_id);
    registered.push({
      mediaId: media.media_id,
      bucket: media.storage_bucket,
      path: media.storage_path,
    });
  }

  const uploads = await Promise.all(
    registered.map(async (media) => ({
      mediaId: media.mediaId,
      uploadUrl: await signedUploadUrl(media.bucket, media.path, false),
    })),
  );
  return { ok: true, jobId: started.job_id, uploads };
}

/** Fresh URLs for a capture that is still waiting for its files. Only the organiser who started it. */
export async function refreshCapture(jobId: string): Promise<RefreshCaptureResult> {
  const userId = await getUserId();
  if (!userId || !UuidSchema.safeParse(jobId).success) return { ok: false, reason: "not_allowed" };

  const admin = createAdminClient();
  const { data: job, error } = await admin
    .from("capture_jobs")
    .select("id, status, created_by")
    .eq("id", jobId)
    .maybeSingle();
  if (error) throw error;
  if (!job || job.created_by !== userId) return { ok: false, reason: "not_allowed" };
  if (job.status !== "awaiting_upload") return { ok: true, done: true, uploads: [] };

  const { data: media, error: mediaError } = await admin
    .from("media")
    .select("id, storage_bucket, storage_path")
    .eq("capture_job_id", job.id)
    .is("removed_at", null);
  if (mediaError) throw mediaError;
  // Upsert: the only file that can be at a path is this capture's own unconfirmed one, and a
  // retry may need to replace a partial copy of it. Once confirmed, no new URL is issued.
  const uploads = await Promise.all(
    media.map(async (row) => ({
      mediaId: row.id,
      uploadUrl: await signedUploadUrl(row.storage_bucket, row.storage_path, true),
    })),
  );
  return { ok: true, done: false, uploads };
}

/** The files are in storage: the server checks them, and the pipeline starts. */
export async function confirmCapture(jobId: string): Promise<ConfirmCaptureResult> {
  const userId = await getUserId();
  if (!userId || !UuidSchema.safeParse(jobId).success) return { ok: false, reason: "not_allowed" };

  const { error } = await createAdminClient().rpc("confirm_upload", {
    p_job_id: jobId,
    p_actor: userId,
  });
  if (!error) {
    await startPipeline(jobId);
    return { ok: true };
  }
  if (error.code === "42501") return { ok: false, reason: "not_allowed" };
  if (error.code === "22023") return { ok: false, reason: "incomplete" };
  throw new Error("confirm_upload failed");
}
