import "server-only";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@virasat/db";
import { publicEnv } from "../env.ts";

/**
 * Service-role client: bypasses RLS. Only for the privileged actions the brief routes through
 * the server (invites now; AI jobs, handovers and share links later), and only after the
 * caller's session has been verified. Never import from client code; `server-only` enforces it.
 */
export function createAdminClient() {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) throw new Error("SUPABASE_SERVICE_ROLE_KEY is not set");
  return createClient<Database>(publicEnv.supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
