import "server-only";
import { CaptureAiOutputSchema, readableMedia } from "@virasat/core";
import { notFound } from "next/navigation";
import { cache } from "react";
import { z } from "zod";
import { requireUserId } from "./auth.ts";
import { createClient } from "./supabase/server.ts";

// Reads for the vault screens. All go through RLS as the signed-in user: a vault you are not
// a member of is simply not found.

const PHOTO_URL_SECONDS = 60 * 60;

export function assertUuid(value: string): string {
  if (!z.uuid().safeParse(value).success) notFound();
  return value;
}

export const listMyVaults = cache(async () => {
  const userId = await requireUserId("/");
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("family_members")
    .select("role, families!inner(id, name)")
    .eq("profile_id", userId)
    .order("joined_at");
  if (error) throw error;
  return data.map((row) => ({ id: row.families.id, name: row.families.name, role: row.role }));
});

export const getVault = cache(async (familyId: string) => {
  assertUuid(familyId);
  const userId = await requireUserId(`/vault/${familyId}`);
  const supabase = await createClient();
  const [{ data: family, error }, { data: membership }] = await Promise.all([
    supabase.from("families").select("id, name").eq("id", familyId).maybeSingle(),
    supabase
      .from("family_members")
      .select("role")
      .eq("family_id", familyId)
      .eq("profile_id", userId)
      .maybeSingle(),
  ]);
  if (error) throw error;
  if (!family || !membership) notFound();
  return { ...family, role: membership.role, userId };
});

async function signedPhotoUrls(paths: (string | null)[]): Promise<Map<string, string>> {
  const wanted = [...new Set(paths.filter((p): p is string => Boolean(p)))];
  if (wanted.length === 0) return new Map();
  const supabase = await createClient();
  const { data } = await supabase.storage
    .from("vault-images")
    .createSignedUrls(wanted, PHOTO_URL_SECONDS);
  return new Map(
    (data ?? []).flatMap((entry) =>
      entry.path && entry.signedUrl ? [[entry.path, entry.signedUrl]] : [],
    ),
  );
}

export const listPeople = cache(async (familyId: string) => {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("people")
    .select("id, display_name, relation_label, birth_year, profile_id, photo_path")
    .eq("family_id", familyId)
    .order("created_at");
  if (error) throw error;
  const urls = await signedPhotoUrls(data.map((p) => p.photo_path));
  return data.map((person) => ({
    ...person,
    photoUrl: person.photo_path ? (urls.get(person.photo_path) ?? null) : null,
  }));
});

export async function getPerson(familyId: string, personId: string) {
  assertUuid(personId);
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("people")
    .select(
      "id, family_id, display_name, relation_label, birth_year, notes, profile_id, photo_path",
    )
    .eq("family_id", familyId)
    .eq("id", personId)
    .maybeSingle();
  if (error) throw error;
  if (!data) notFound();
  const urls = await signedPhotoUrls([data.photo_path]);
  return { ...data, photoUrl: data.photo_path ? (urls.get(data.photo_path) ?? null) : null };
}

export async function listMembers(familyId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("family_members")
    .select("profile_id, role, joined_at, profiles!inner(display_name)")
    .eq("family_id", familyId)
    .order("joined_at");
  if (error) throw error;
  return data.map((row) => ({
    profileId: row.profile_id,
    role: row.role,
    displayName: row.profiles.display_name,
  }));
}

/** Pending invites. Only owners and admins get rows back (RLS); token hashes are never selected. */
export async function listPendingInvites(familyId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("invites")
    .select("id, role, channel, phone, email, person_id, expires_at")
    .eq("family_id", familyId)
    .is("accepted_at", null)
    .is("revoked_at", null)
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data;
}

/**
 * Recording links still usable for one person. RLS lets only members who can add recipes see
 * them; token hashes are never selected, so the link itself can't be recovered from here.
 */
export async function listRecordingLinks(personId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("contributor_links")
    .select("id, max_uploads, upload_count, expires_at")
    .eq("person_id", personId)
    .is("revoked_at", null)
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data.filter((link) => link.upload_count < link.max_uploads);
}

/** Captures a writer still has to deal with, newest first. Confirmed ones are recipes by then. */
export const listOpenCaptures = cache(async (familyId: string, limit = 50) => {
  assertUuid(familyId);
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("capture_jobs")
    .select("id, status, source_type, created_at, people(display_name, relation_label)")
    .eq("family_id", familyId)
    .in("status", ["uploaded", "transcribing", "structuring", "ready_for_review", "failed"])
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data.map((job) => ({
    id: job.id,
    status: job.status,
    sourceType: job.source_type,
    createdAt: job.created_at,
    personName: job.people ? (job.people.relation_label ?? job.people.display_name) : null,
  }));
});

const ORIGINAL_URL_SECONDS = 60 * 60;
/** Page formats every browser can show. A HEIC page without its readable copy cannot be shown. */
const DISPLAYABLE_PAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

/**
 * One capture for the review screen: where it has got to, what the computer made of it, and the
 * original to listen to or look at beside it. Through RLS, so only writers of the vault get it:
 * viewers and other families find nothing. The files are signed for an hour.
 */
export async function getCapture(familyId: string, jobId: string) {
  assertUuid(familyId);
  assertUuid(jobId);
  const supabase = await createClient();
  const { data: job, error } = await supabase
    .from("capture_jobs")
    .select(
      "id, status, source_type, transcript, detected_language, ai_output, error, recipe_id, people(display_name, relation_label)",
    )
    .eq("id", jobId)
    .eq("family_id", familyId)
    .maybeSingle();
  if (error) throw error;
  // A capture still waiting for its files is not something to review yet.
  if (!job || job.status === "awaiting_upload") notFound();

  const { data: media, error: mediaError } = await supabase
    .from("media")
    .select("id, derived_from_media_id, storage_bucket, storage_path, mime_type, width, height")
    .eq("capture_job_id", job.id)
    .is("removed_at", null)
    .order("created_at");
  if (mediaError) throw mediaError;

  // The recording, or each page as the reader saw it: its readable copy when it has one.
  const shown = readableMedia(media);
  const signed = await Promise.all(
    shown.map(async (row) => {
      if (job.source_type === "handwriting" && !DISPLAYABLE_PAGE_TYPES.has(row.mime_type)) {
        return { ...row, url: null };
      }
      const { data } = await supabase.storage
        .from(row.storage_bucket)
        .createSignedUrl(row.storage_path, ORIGINAL_URL_SECONDS);
      return { ...row, url: data?.signedUrl ?? null };
    }),
  );

  let recipeTitle: string | null = null;
  if (job.recipe_id) {
    const { data: recipe } = await supabase
      .from("recipes")
      .select("title")
      .eq("id", job.recipe_id)
      .maybeSingle();
    recipeTitle = recipe?.title ?? null;
  }

  const draft = CaptureAiOutputSchema.safeParse(job.ai_output);
  return {
    id: job.id,
    status: job.status,
    sourceType: job.source_type,
    transcript: job.transcript,
    detectedLanguage: job.detected_language,
    /** The computer's draft. Null when there is none (the capture failed) or it can't be read. */
    draft: draft.success ? draft.data : null,
    failure: job.error,
    recipeId: job.recipe_id,
    recipeTitle,
    personName: job.people ? (job.people.relation_label ?? job.people.display_name) : null,
    audioUrl: job.source_type === "voice" ? (signed[0]?.url ?? null) : null,
    pages:
      job.source_type === "handwriting"
        ? signed.map((row) => ({ url: row.url, width: row.width, height: row.height }))
        : [],
  };
}
