"use server";

import { fieldErrors, ProfileInputSchema } from "@virasat/core";
import { revalidatePath } from "next/cache";
import { type ActionState, databaseError, submittedValues } from "@/lib/action-state.ts";
import { requireUserId } from "@/lib/auth.ts";
import { createClient } from "@/lib/supabase/server.ts";

export async function updateProfile(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const userId = await requireUserId("/settings");
  const parsed = ProfileInputSchema.safeParse({
    displayName: formData.get("displayName"),
    preferredLanguage: formData.get("preferredLanguage"),
    unitSystem: formData.get("unitSystem"),
    countryCode: formData.get("countryCode") ?? "",
  });
  if (!parsed.success) {
    return {
      status: "error",
      fieldErrors: fieldErrors(parsed.error),
      values: submittedValues(formData),
    };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .update({
      display_name: parsed.data.displayName,
      preferred_language: parsed.data.preferredLanguage,
      unit_system: parsed.data.unitSystem,
      country_code: parsed.data.countryCode,
    })
    .eq("id", userId);
  if (error) return databaseError(error, formData);
  // Language may have changed: re-render everything in it.
  revalidatePath("/", "layout");
  return { status: "success", message: "settings.saved" };
}
