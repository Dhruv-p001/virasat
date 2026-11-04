import { z } from "zod";

// NEXT_PUBLIC_* values must be read with literal property access so Next can inline them.

const AuthProviderSchema = z.enum(["google", "apple"]);
export type OAuthProvider = z.infer<typeof AuthProviderSchema>;

const PublicEnvSchema = z.object({
  supabaseUrl: z.url(),
  supabaseAnonKey: z.string().min(20),
  siteUrl: z.url(),
  /** OAuth buttons to show, e.g. "google,apple". Empty until those providers are configured. */
  oauthProviders: z.array(AuthProviderSchema),
});

export const publicEnv = PublicEnvSchema.parse({
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
  supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  siteUrl: process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",
  oauthProviders: (process.env.NEXT_PUBLIC_AUTH_PROVIDERS ?? "")
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean),
});
