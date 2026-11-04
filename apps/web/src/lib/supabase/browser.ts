"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@virasat/db";
import { publicEnv } from "../env.ts";

/** Browser client acting as the signed-in user (RLS applies). One shared instance per tab. */
export function getBrowserClient() {
  return createBrowserClient<Database>(publicEnv.supabaseUrl, publicEnv.supabaseAnonKey, {
    isSingleton: true,
  });
}
