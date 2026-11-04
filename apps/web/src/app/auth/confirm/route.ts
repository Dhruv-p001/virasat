import { safeNextPath } from "@virasat/core";
import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server.ts";

// Email sign-in link. Verifies the token hash on the server, so the link works on any device
// (unlike PKCE links, which only work in the browser that asked for them).
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const tokenHash = searchParams.get("token_hash");
  const next = safeNextPath(searchParams.get("next"));

  // Our sign-in template only ever sends type=email; anything else is refused.
  if (tokenHash && searchParams.get("type") === "email") {
    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: "email" });
    if (!error) return NextResponse.redirect(new URL(next, request.url));
  }
  return NextResponse.redirect(
    new URL(`/sign-in?error=link&next=${encodeURIComponent(next)}`, request.url),
  );
}
