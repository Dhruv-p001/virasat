import "server-only";
import { createHash } from "node:crypto";
import { RECORDING_TOKEN_PATTERN } from "@virasat/core";
import { createAdminClient } from "../supabase/admin.ts";

/** Recording link tokens are stored only as a hash (ADR 0010). */
export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function isTokenShaped(token: string): boolean {
  return RECORDING_TOKEN_PATTERN.test(token);
}

/**
 * The capture behind `jobId`, if it came in through the link behind `token` and is not revoked.
 * Used by the elder's upload steps, which have no session: the token is the only credential.
 */
export async function findLinkCapture(token: string, jobId: string) {
  if (!isTokenShaped(token)) return null;
  const admin = createAdminClient();
  const { data: link } = await admin
    .from("contributor_links")
    .select("id, revoked_at")
    .eq("token_hash", hashToken(token))
    .maybeSingle();
  if (!link || link.revoked_at) return null;
  const { data: job } = await admin
    .from("capture_jobs")
    .select("id, status")
    .eq("id", jobId)
    .eq("contributor_link_id", link.id)
    .maybeSingle();
  if (!job) return null;
  const { data: media } = await admin
    .from("media")
    .select("storage_bucket, storage_path")
    .eq("capture_job_id", job.id)
    .is("derived_from_media_id", null)
    .maybeSingle();
  if (!media) return null;
  return { job, media };
}
