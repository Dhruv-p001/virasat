"use server";

import {
  canWriteContent,
  fieldErrors,
  TypedRecipeInputSchema,
  typedRecipeContent,
} from "@virasat/core";
import { revalidatePath } from "next/cache";
import { type ActionState, databaseError, submittedValues } from "@/lib/action-state.ts";
import { requireUserId } from "@/lib/auth.ts";
import { assertUuid, getVault } from "@/lib/data.ts";
import { getLocale } from "@/lib/i18n/server.ts";
import { createAdminClient } from "@/lib/supabase/admin.ts";

export type TypedRecipeSaved = { recipeId: string; title: string };

/**
 * Saves a recipe someone typed from memory (ADR 0010: every write goes through a SQL function that
 * re-checks the actor). The text is kept exactly as typed: nothing is guessed or flagged.
 */
export async function createTypedRecipe(
  familyId: string,
  _prev: ActionState<TypedRecipeSaved>,
  formData: FormData,
): Promise<ActionState<TypedRecipeSaved>> {
  const userId = await requireUserId(`/vault/${familyId}/recipes/new`);
  const vault = await getVault(familyId);
  if (!canWriteContent(vault.role)) return { status: "error", message: "errors.notAllowed" };

  const parsed = TypedRecipeInputSchema.safeParse({
    title: formData.get("title"),
    ingredients: formData.get("ingredients") ?? "",
    steps: formData.get("steps") ?? "",
    story: formData.get("story") ?? undefined,
  });
  if (!parsed.success) {
    return {
      status: "error",
      fieldErrors: fieldErrors(parsed.error),
      values: submittedValues(formData),
    };
  }

  const person = formData.get("originPerson");
  const originPersonId = typeof person === "string" && person ? assertUuid(person) : null;

  const { data: recipeId, error } = await createAdminClient().rpc("create_typed_recipe", {
    p_actor: userId,
    p_family_id: familyId,
    p_content: typedRecipeContent(parsed.data, await getLocale()),
    ...(originPersonId ? { p_origin_person_id: originPersonId } : {}),
  });
  if (error) return databaseError(error, formData);

  revalidatePath(`/vault/${familyId}`);
  return { status: "success", data: { recipeId, title: parsed.data.title } };
}
