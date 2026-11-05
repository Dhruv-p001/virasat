"use server";

import { fieldErrors, VaultNameSchema } from "@virasat/core";
import { redirect } from "next/navigation";
import { type ActionState, databaseError, submittedValues } from "@/lib/action-state.ts";
import { requireUserId } from "@/lib/auth.ts";
import { createClient } from "@/lib/supabase/server.ts";

export async function createVault(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireUserId("/onboarding");
  const parsed = VaultNameSchema.safeParse({ name: formData.get("name") });
  if (!parsed.success)
    return {
      status: "error",
      fieldErrors: fieldErrors(parsed.error),
      values: submittedValues(formData),
    };

  const supabase = await createClient();
  const { data: familyId, error } = await supabase.rpc("create_family", {
    p_name: parsed.data.name,
  });
  if (error) return databaseError(error, formData);
  redirect(`/vault/${familyId}`);
}
