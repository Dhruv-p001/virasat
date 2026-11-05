"use server";

import { ReviewContentSchema } from "@virasat/core";
import type { Json } from "@virasat/db";
import { revalidatePath } from "next/cache";
import type { ActionState } from "@/lib/action-state.ts";
import { getUserId } from "@/lib/auth.ts";
import { assertUuid } from "@/lib/data.ts";
import { createAdminClient } from "@/lib/supabase/admin.ts";

/**
 * A person has checked the recipe and confirms it. Only now does a recipe exist (brief flow B).
 * The content is validated again here, whatever the browser sent, and confirm_capture() re-checks
 * that this user may confirm this capture (ADR 0010).
 */
export async function confirmReview(
  familyId: string,
  jobId: string,
  content: unknown,
): Promise<ActionState<{ recipeId: string }>> {
  assertUuid(familyId);
  assertUuid(jobId);
  const userId = await getUserId();
  if (!userId) return { status: "error", message: "errors.notAllowed" };

  const parsed = ReviewContentSchema.safeParse(content);
  if (!parsed.success) return { status: "error", message: "review.errors.form" };

  const { data: recipeId, error } = await createAdminClient().rpc("confirm_capture", {
    p_actor: userId,
    p_job_id: jobId,
    p_content: parsed.data as unknown as Json,
  });
  if (error) {
    if (error.code === "42501") return { status: "error", message: "errors.notAllowed" };
    // Already confirmed (another tab), or not ready.
    if (error.code === "22023") return { status: "error", message: "review.errors.notReady" };
    return { status: "error", message: "errors.generic" };
  }
  revalidatePath(`/vault/${familyId}`, "layout");
  return { status: "success", data: { recipeId } };
}
