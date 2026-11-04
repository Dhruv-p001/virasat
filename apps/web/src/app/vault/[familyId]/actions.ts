"use server";

import { createHash } from "node:crypto";
import {
  FamilyRoleSchema,
  fieldErrors,
  generateToken,
  InviteInputSchema,
  PersonInputSchema,
  recordingLinkUrl,
  VaultNameSchema,
} from "@virasat/core";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { type ActionState, databaseError, submittedValues } from "@/lib/action-state.ts";
import { requireUserId } from "@/lib/auth.ts";
import { assertUuid } from "@/lib/data.ts";
import { publicEnv } from "@/lib/env.ts";
import { createAdminClient } from "@/lib/supabase/admin.ts";
import { createClient } from "@/lib/supabase/server.ts";

// Every action runs as the signed-in user (RLS enforces who may do what), except invites,
// which the brief routes through the service role after the session is checked.

const text = (formData: FormData, key: string) => {
  const value = formData.get(key);
  return typeof value === "string" ? value : undefined;
};

export async function renameVault(
  familyId: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  assertUuid(familyId);
  await requireUserId(`/vault/${familyId}`);
  const parsed = VaultNameSchema.safeParse({ name: text(formData, "name") });
  if (!parsed.success)
    return {
      status: "error",
      fieldErrors: fieldErrors(parsed.error),
      values: submittedValues(formData),
    };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("families")
    .update({ name: parsed.data.name })
    .eq("id", familyId)
    .select("id");
  if (error) return databaseError(error, formData);
  if (data.length === 0) return databaseError({ code: "42501", message: "" }, formData);
  revalidatePath(`/vault/${familyId}`, "layout");
  return { status: "success", message: "settings.saved" };
}

// ---------------------------------------------------------------------------------------- people

function parsePerson(formData: FormData) {
  return PersonInputSchema.safeParse({
    displayName: text(formData, "displayName"),
    relationLabel: text(formData, "relationLabel"),
    birthYear: text(formData, "birthYear"),
    notes: text(formData, "notes"),
  });
}

export async function addPerson(
  familyId: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  assertUuid(familyId);
  await requireUserId(`/vault/${familyId}/people/new`);
  const parsed = parsePerson(formData);
  if (!parsed.success)
    return {
      status: "error",
      fieldErrors: fieldErrors(parsed.error),
      values: submittedValues(formData),
    };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("people")
    .insert({
      family_id: familyId,
      display_name: parsed.data.displayName,
      relation_label: parsed.data.relationLabel,
      birth_year: parsed.data.birthYear,
      notes: parsed.data.notes,
    })
    .select("id")
    .single();
  if (error) return databaseError(error, formData);
  revalidatePath(`/vault/${familyId}`);
  redirect(`/vault/${familyId}/people/${data.id}`);
}

export async function updatePerson(
  familyId: string,
  personId: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  assertUuid(familyId);
  assertUuid(personId);
  await requireUserId(`/vault/${familyId}/people/${personId}`);
  const parsed = parsePerson(formData);
  if (!parsed.success)
    return {
      status: "error",
      fieldErrors: fieldErrors(parsed.error),
      values: submittedValues(formData),
    };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("people")
    .update({
      display_name: parsed.data.displayName,
      relation_label: parsed.data.relationLabel,
      birth_year: parsed.data.birthYear,
      notes: parsed.data.notes,
    })
    .eq("id", personId)
    .eq("family_id", familyId)
    .select("id");
  if (error) return databaseError(error, formData);
  if (data.length === 0) return databaseError({ code: "42501", message: "" }, formData);
  revalidatePath(`/vault/${familyId}`, "layout");
  return { status: "success", message: "settings.saved" };
}

/** Records a photo the browser has already uploaded to storage (RLS-checked), then removes the old one. */
export async function setPersonPhoto(
  familyId: string,
  personId: string,
  path: string,
): Promise<ActionState> {
  assertUuid(familyId);
  assertUuid(personId);
  await requireUserId(`/vault/${familyId}/people/${personId}`);
  if (!path.startsWith(`${familyId}/people/${personId}/`) || path.includes("..")) {
    return { status: "error", message: "errors.notAllowed" };
  }

  const supabase = await createClient();
  const { data: before } = await supabase
    .from("people")
    .select("photo_path")
    .eq("id", personId)
    .eq("family_id", familyId)
    .maybeSingle();
  const { data, error } = await supabase
    .from("people")
    .update({ photo_path: path })
    .eq("id", personId)
    .eq("family_id", familyId)
    .select("id");
  if (error) return databaseError(error);
  if (data.length === 0) return { status: "error", message: "errors.notAllowed" };
  if (before?.photo_path && before.photo_path !== path) {
    await supabase.storage.from("vault-images").remove([before.photo_path]);
  }
  revalidatePath(`/vault/${familyId}`, "layout");
  return { status: "success" };
}

export async function removePerson(familyId: string, personId: string): Promise<ActionState> {
  assertUuid(familyId);
  assertUuid(personId);
  await requireUserId(`/vault/${familyId}/people/${personId}`);
  const supabase = await createClient();
  const { error } = await supabase.rpc("remove_person", { p_person_id: personId });
  if (error) return databaseError(error);
  revalidatePath(`/vault/${familyId}`, "layout");
  redirect(`/vault/${familyId}`);
}

// --------------------------------------------------------------------------------------- members

export async function changeRole(
  familyId: string,
  profileId: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  assertUuid(familyId);
  assertUuid(profileId);
  await requireUserId(`/vault/${familyId}/members`);
  const role = FamilyRoleSchema.safeParse(formData.get("role"));
  if (!role.success) return { status: "error", message: "errors.generic" };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("family_members")
    .update({ role: role.data })
    .eq("family_id", familyId)
    .eq("profile_id", profileId)
    .select("profile_id");
  if (error) return databaseError(error, formData);
  if (data.length === 0) return databaseError({ code: "42501", message: "" }, formData);
  revalidatePath(`/vault/${familyId}`, "layout");
  return { status: "success", message: "settings.saved" };
}

export async function removeMember(familyId: string, profileId: string): Promise<ActionState> {
  assertUuid(familyId);
  assertUuid(profileId);
  const userId = await requireUserId(`/vault/${familyId}/members`);
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("family_members")
    .delete()
    .eq("family_id", familyId)
    .eq("profile_id", profileId)
    .select("profile_id");
  if (error) return databaseError(error);
  if (data.length === 0) return { status: "error", message: "errors.notAllowed" };
  if (profileId === userId) redirect("/");
  revalidatePath(`/vault/${familyId}`, "layout");
  return { status: "success" };
}

// --------------------------------------------------------------------------------------- invites

const sha256 = (value: string) => createHash("sha256").update(value).digest("hex");

export type CreatedInvite = { url: string; expiresAt: string };

export async function createInvite(
  familyId: string,
  _prev: ActionState<CreatedInvite>,
  formData: FormData,
): Promise<ActionState<CreatedInvite>> {
  assertUuid(familyId);
  const userId = await requireUserId(`/vault/${familyId}/invite`);
  const personId = text(formData, "personId");
  const parsed = InviteInputSchema.safeParse({
    channel: text(formData, "channel"),
    role: text(formData, "role"),
    personId: personId ? personId : null,
    phone: text(formData, "phone"),
    email: text(formData, "email"),
  });
  if (!parsed.success)
    return {
      status: "error",
      fieldErrors: fieldErrors(parsed.error),
      values: submittedValues(formData),
    };
  const input = parsed.data;

  const token = generateToken();
  const admin = createAdminClient();
  // create_invite re-checks that this user is an owner or admin of the vault.
  const { error } = await admin.rpc("create_invite", {
    p_actor: userId,
    p_family_id: familyId,
    p_token: token,
    p_role: input.role,
    p_channel: input.channel,
    ...(input.channel === "phone" ? { p_phone: input.phone } : {}),
    ...(input.channel === "email" ? { p_email: input.email } : {}),
    ...(input.personId ? { p_person_id: input.personId } : {}),
  });
  if (error) return databaseError(error, formData);

  const { data: invite } = await admin
    .from("invites")
    .select("expires_at")
    .eq("token_hash", sha256(token))
    .single();
  revalidatePath(`/vault/${familyId}/members`);
  return {
    status: "success",
    data: { url: `${publicEnv.siteUrl}/invite/${token}`, expiresAt: invite?.expires_at ?? "" },
  };
}

export async function revokeInvite(familyId: string, inviteId: string): Promise<ActionState> {
  assertUuid(familyId);
  assertUuid(inviteId);
  const userId = await requireUserId(`/vault/${familyId}/members`);
  const { error } = await createAdminClient().rpc("revoke_invite", {
    p_actor: userId,
    p_invite_id: inviteId,
  });
  if (error) return databaseError(error);
  revalidatePath(`/vault/${familyId}/members`);
  return { status: "success" };
}

// ------------------------------------------------------------------------------ recording links

export type CreatedRecordingLink = { url: string };

/**
 * A recording link for an elder. The raw token exists only in the returned URL: the database
 * keeps its hash, so the link can't be shown again later (create a new one instead).
 */
export async function createRecordingLink(
  familyId: string,
  personId: string,
  _prev: ActionState<CreatedRecordingLink>,
): Promise<ActionState<CreatedRecordingLink>> {
  assertUuid(familyId);
  assertUuid(personId);
  const userId = await requireUserId(`/vault/${familyId}/people/${personId}`);
  const token = generateToken();
  const { error } = await createAdminClient().rpc("create_contributor_link", {
    p_actor: userId,
    p_person_id: personId,
    p_token: token,
  });
  if (error) return databaseError(error);
  revalidatePath(`/vault/${familyId}/people/${personId}`);
  return { status: "success", data: { url: recordingLinkUrl(publicEnv.siteUrl, token) } };
}

export async function revokeRecordingLink(
  familyId: string,
  personId: string,
  linkId: string,
): Promise<ActionState> {
  assertUuid(familyId);
  assertUuid(personId);
  assertUuid(linkId);
  const userId = await requireUserId(`/vault/${familyId}/people/${personId}`);
  const { error } = await createAdminClient().rpc("revoke_contributor_link", {
    p_actor: userId,
    p_link_id: linkId,
  });
  if (error) return databaseError(error);
  revalidatePath(`/vault/${familyId}/people/${personId}`);
  return { status: "success" };
}
