"use server";

import { redirect } from "next/navigation";
import { type ActionState, databaseError } from "@/lib/action-state.ts";
import { requireUserId } from "@/lib/auth.ts";
import { createAdminClient } from "@/lib/supabase/admin.ts";

export async function acceptInvite(token: string): Promise<ActionState> {
  const userId = await requireUserId(`/invite/${token}`);
  // accept_invite checks validity, expiry and that phone/email invites match this account.
  const { data: familyId, error } = await createAdminClient().rpc("accept_invite", {
    p_profile_id: userId,
    p_token: token,
  });
  if (error) {
    if (error.code === "P0002") return { status: "error", message: "join.invalidBody" };
    if (error.code === "42501") return { status: "error", message: "join.wrongAccount" };
    return databaseError(error);
  }
  redirect(`/vault/${familyId}`);
}
