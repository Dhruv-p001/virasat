import "server-only";
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
