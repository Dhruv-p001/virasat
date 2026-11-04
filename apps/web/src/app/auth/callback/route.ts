import { safeNextPath } from "@virasat/core";
import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server.ts";

// OAuth return (Google, Apple): exchange the PKCE code for a session.
export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const next = safeNextPath(request.nextUrl.searchParams.get("next"));

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL(next, request.url));
  }
  return NextResponse.redirect(
    new URL(`/sign-in?error=link&next=${encodeURIComponent(next)}`, request.url),
  );
}
