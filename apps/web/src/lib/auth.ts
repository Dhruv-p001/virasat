import "server-only";
import { redirect } from "next/navigation";
import { cache } from "react";
import { createClient } from "./supabase/server.ts";

/** The signed-in user's id, or null. Verified JWT claims, cached per request. */
export const getUserId = cache(async (): Promise<string | null> => {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  return data?.claims.sub ?? null;
});

/** The signed-in user's id; otherwise redirects to sign-in and back to `returnTo`. */
export async function requireUserId(returnTo: string): Promise<string> {
  const userId = await getUserId();
  if (!userId) redirect(`/sign-in?next=${encodeURIComponent(returnTo)}`);
  return userId;
}
