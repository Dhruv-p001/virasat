import "server-only";
import { createServerClient } from "@supabase/ssr";
import type { Database } from "@virasat/db";
import { cookies } from "next/headers";
import { publicEnv } from "../env.ts";

/**
 * Supabase client acting as the signed-in user, so every query goes through RLS.
 * Create one per request.
 */
export async function createClient() {
  const cookieStore = await cookies();
  return createServerClient<Database>(publicEnv.supabaseUrl, publicEnv.supabaseAnonKey, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (cookiesToSet) => {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Called from a Server Component, where cookies are read-only. The proxy refreshes
          // the session on the next request, so this is safe to ignore.
        }
      },
    },
  });
}
