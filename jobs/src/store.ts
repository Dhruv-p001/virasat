import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@virasat/db";
import type {
  AdvancePatch,
  CaptureMedia,
  CaptureRecord,
  CaptureStatus,
  PipelineStore,
} from "./pipeline.ts";

type Admin = SupabaseClient<Database>;

/** Service-role client for the jobs. They run on the server only, never in a browser. */
export function createJobsClient(env: Record<string, string | undefined> = process.env): Admin {
  const url = env["SUPABASE_URL"] ?? env["NEXT_PUBLIC_SUPABASE_URL"];
  const key = env["SUPABASE_SERVICE_ROLE_KEY"];
  if (!url || !key) {
    throw new Error(
      "The capture pipeline needs NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY",
    );
  }
  return createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export function supabaseStore(admin: Admin): PipelineStore {
  return {
    async load(jobId) {
      const { data: job, error } = await admin
        .from("capture_jobs")
        .select("id, status, source_type, transcript, detected_language, person_id")
        .eq("id", jobId)
        .maybeSingle();
      if (error) throw error;
      if (!job) return null;

      const { data: media, error: mediaError } = await admin
        .from("media")
        .select("storage_bucket, storage_path, mime_type")
        .eq("capture_job_id", job.id)
        .is("derived_from_media_id", null)
        .is("removed_at", null)
        .order("created_at");
      if (mediaError) throw mediaError;

      let speaker: CaptureRecord["speaker"] = { name: "the speaker", relation: null };
      if (job.person_id) {
        const { data: person, error: personError } = await admin
          .from("people")
          .select("display_name, relation_label")
          .eq("id", job.person_id)
          .maybeSingle();
        if (personError) throw personError;
        if (person) speaker = { name: person.display_name, relation: person.relation_label };
      }

      return {
        id: job.id,
        status: job.status,
        sourceType: job.source_type === "handwriting" ? "handwriting" : "voice",
        transcript: job.transcript,
        detectedLanguage: job.detected_language,
        speaker,
        media: media.map((row) => ({
          bucket: row.storage_bucket,
          path: row.storage_path,
          mimeType: row.mime_type,
        })),
      };
    },

    async download(media: CaptureMedia) {
      const { data, error } = await admin.storage.from(media.bucket).download(media.path);
      if (error) throw error;
      return new Uint8Array(await data.arrayBuffer());
    },

    async advance(jobId: string, to: CaptureStatus, patch: AdvancePatch = {}) {
      const { error } = await admin.rpc("advance_capture", {
        p_job_id: jobId,
        p_to: to,
        ...(patch.transcript === undefined ? {} : { p_transcript: patch.transcript }),
        ...(patch.detectedLanguage === undefined
          ? {}
          : { p_detected_language: patch.detectedLanguage }),
        ...(patch.aiOutput === undefined ? {} : { p_ai_output: patch.aiOutput as unknown as Json }),
        ...(patch.error === undefined ? {} : { p_error: patch.error }),
        ...(patch.providerMeta === undefined
          ? {}
          : { p_provider_meta: patch.providerMeta as Json }),
      });
      if (error) throw error;
    },
  };
}

/** Captures that have sat in one of these statuses since before `olderThan`. Ids only. */
export async function findStaleCaptures(
  admin: Admin,
  status: "uploaded" | "transcribing" | "structuring",
  olderThan: Date,
): Promise<string[]> {
  const { data, error } = await admin
    .from("capture_jobs")
    .select("id")
    .eq("status", status)
    .lt("updated_at", olderThan.toISOString())
    .limit(100);
  if (error) throw error;
  return data.map((row) => row.id);
}
