"use server";

import { canWriteContent, fieldErrors, MomentInputSchema } from "@virasat/core";
import { revalidatePath } from "next/cache";
import { type ActionState, databaseError, submittedValues } from "@/lib/action-state.ts";
import { requireUserId } from "@/lib/auth.ts";
import { assertUuid, getVault } from "@/lib/data.ts";
import { createAdminClient } from "@/lib/supabase/admin.ts";
import { createClient } from "@/lib/supabase/server.ts";

export type MomentAdded = { momentId: string };

const text = (formData: FormData, key: string) => {
  const value = formData.get(key);
  return typeof value === "string" ? value : undefined;
};

/**
 * Adds an "I cooked it" moment as the signed-in user. Row Level Security is the check: only
 * members who can write, on a recipe they can read, as themselves. The photo is uploaded by the
 * browser afterwards, once the moment exists.
 */
export async function addMoment(
  familyId: string,
  _prev: ActionState<MomentAdded>,
  formData: FormData,
): Promise<ActionState<MomentAdded>> {
  const userId = await requireUserId(`/vault/${familyId}/moments`);
  const vault = await getVault(familyId);
  if (!canWriteContent(vault.role)) return { status: "error", message: "errors.notAllowed" };

  const parsed = MomentInputSchema.safeParse({
    note: text(formData, "note"),
    rating: text(formData, "rating"),
    cookedOn: text(formData, "cookedOn"),
  });
  if (!parsed.success) {
    return {
      status: "error",
      fieldErrors: fieldErrors(parsed.error),
      values: submittedValues(formData),
    };
  }
  const recipeId = text(formData, "recipeId");
  if (!recipeId) return { status: "error", fieldErrors: { recipeId: "errors.required" } };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("attempts")
    .insert({
      family_id: familyId,
      recipe_id: assertUuid(recipeId),
      author_profile_id: userId,
      note: parsed.data.note,
      rating: parsed.data.rating,
      cooked_on: parsed.data.cookedOn,
    })
    .select("id")
    .single();
  if (error) return databaseError(error, formData);

  revalidatePath(`/vault/${familyId}`, "layout");
  return { status: "success", data: { momentId: data.id } };
}

/** Records a photo the browser has already uploaded to storage (RLS-checked). */
export async function setMomentPhoto(
  familyId: string,
  momentId: string,
  path: string,
): Promise<ActionState> {
  await requireUserId(`/vault/${familyId}/moments`);
  assertUuid(momentId);
  const supabase = await createClient();
  const { error } = await supabase
    .from("attempts")
    .update({ photo_path: path })
    .eq("id", momentId)
    .eq("family_id", familyId);
  if (error) return databaseError(error);
  revalidatePath(`/vault/${familyId}`, "layout");
  return { status: "success" };
}

/** The author, or an owner or admin, removes a moment (remove_moment checks), photo included. */
export async function removeMoment(familyId: string, momentId: string): Promise<ActionState> {
  await requireUserId(`/vault/${familyId}/moments`);
  assertUuid(momentId);
  const supabase = await createClient();
  const { data: before } = await supabase
    .from("attempts")
    .select("photo_path")
    .eq("id", momentId)
    .eq("family_id", familyId)
    .maybeSingle();
  const { error } = await supabase.rpc("remove_moment", { p_attempt_id: momentId });
  if (error) return databaseError(error);
  // Permission was just checked by remove_moment; an owner or admin may remove an author's photo.
  if (before?.photo_path) {
    await createAdminClient().storage.from("vault-images").remove([before.photo_path]);
  }
  revalidatePath(`/vault/${familyId}`, "layout");
  return { status: "success" };
}
