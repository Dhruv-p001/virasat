"use server";

import { baseMimeType, CONSENT_WORDING_VERSION, MAX_AUDIO_BYTES } from "@virasat/core";
import { sendCaptureUploaded } from "@virasat/jobs";
import { z } from "zod";
import { findLinkCapture, isTokenShaped } from "@/lib/capture/links.ts";
import { createAdminClient } from "@/lib/supabase/admin.ts";

// The elder's upload steps. There is no session: the recording link's token is the credential,
// and every step re-checks it against the capture. The recording itself never passes through
// here; the browser sends it straight to storage with a signed upload URL (ADR 0012).

const UuidSchema = z.uuid();

export type StartResult =
  | { ok: true; jobId: string; uploadUrl: string | null }
  | { ok: false; reason: "invalid_link" | "rejected" };

export type RefreshResult =
  { ok: true; uploadUrl: string | null; done: boolean } | { ok: false; reason: "invalid_link" };

export type ConfirmResult = { ok: true } | { ok: false; reason: "invalid_link" | "incomplete" };

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
 * Consent given, recording finished: registers the capture (this is what spends one of the link's
 * uploads) and issues the upload URL. If signing fails after that, the job id is still returned
 * so the retry asks for a new URL instead of starting, and spending, another capture.
 */
export async function startUpload(
  token: string,
  mimeType: string,
  byteSize: number,
): Promise<StartResult> {
  if (!isTokenShaped(token)) return { ok: false, reason: "invalid_link" };
  const mime = baseMimeType(mimeType);
  if (!mime.startsWith("audio/") || !Number.isInteger(byteSize)) {
    return { ok: false, reason: "rejected" };
  }
  if (byteSize <= 0 || byteSize > MAX_AUDIO_BYTES) return { ok: false, reason: "rejected" };

  const { data, error } = await createAdminClient().rpc("begin_capture", {
    p_source: "voice",
    p_mime_type: mime,
    p_byte_size: byteSize,
    p_consent_wording_version: CONSENT_WORDING_VERSION,
    p_contributor_token: token,
  });
  if (error) {
    if (error.code === "P0002") return { ok: false, reason: "invalid_link" };
    if (error.code === "22023") return { ok: false, reason: "rejected" };
    throw new Error("begin_capture failed");
  }
  const started = data[0];
  if (!started) throw new Error("begin_capture returned nothing");
  const uploadUrl = await signedUploadUrl(started.storage_bucket, started.storage_path, false);
  return { ok: true, jobId: started.job_id, uploadUrl };
}

/** A fresh URL for the same registered path, for a capture that is still waiting for its file. */
export async function refreshUpload(token: string, jobId: string): Promise<RefreshResult> {
  if (!UuidSchema.safeParse(jobId).success) return { ok: false, reason: "invalid_link" };
  const capture = await findLinkCapture(token, jobId);
  if (!capture) return { ok: false, reason: "invalid_link" };
  if (capture.job.status !== "awaiting_upload") return { ok: true, uploadUrl: null, done: true };
  // Upsert: the only file that can be at this path is this capture's own unconfirmed one, and a
  // retry may need to replace a partial copy of it. Once confirmed, no new URL is issued.
  const uploadUrl = await signedUploadUrl(
    capture.media.storage_bucket,
    capture.media.storage_path,
    true,
  );
  return { ok: true, uploadUrl, done: false };
}

/**
 * Starts the capture pipeline. The recording is already safe and confirmed, so a failure here must
 * not fail the elder's upload: the sweep resends the event for any capture left in "uploaded".
 * Only the error class is logged, never anything about the capture.
 */
async function startPipeline(jobId: string): Promise<void> {
  try {
    await sendCaptureUploaded(jobId);
  } catch (error) {
    console.error(
      "capture pipeline event not sent",
      error instanceof Error ? error.name : "unknown",
    );
  }
}

export async function confirmUpload(token: string, jobId: string): Promise<ConfirmResult> {
  if (!isTokenShaped(token) || !UuidSchema.safeParse(jobId).success) {
    return { ok: false, reason: "invalid_link" };
  }
  const { error } = await createAdminClient().rpc("confirm_upload", {
    p_job_id: jobId,
    p_contributor_token: token,
  });
  if (!error) {
    await startPipeline(jobId);
    return { ok: true };
  }
  if (error.code === "42501") return { ok: false, reason: "invalid_link" };
  if (error.code === "22023") return { ok: false, reason: "incomplete" };
  throw new Error("confirm_upload failed");
}
