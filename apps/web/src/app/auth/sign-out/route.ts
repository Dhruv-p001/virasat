import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server.ts";

// POST only, so a link or prefetch can never sign someone out.
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  await supabase.auth.signOut();
  return NextResponse.redirect(new URL("/", request.url), { status: 303 });
}
