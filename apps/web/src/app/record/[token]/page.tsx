import type { Metadata } from "next";
import { isTokenShaped } from "@/lib/capture/links.ts";
import { createAdminClient } from "@/lib/supabase/admin.ts";
import { Recorder } from "./recorder.tsx";

// The token is a secret in the URL: keep it out of Referer headers and search engines. The same
// is sent as headers in next.config.ts; this covers the meta tags.
export const metadata: Metadata = {
  title: "Virasat",
  referrer: "no-referrer",
  robots: { index: false, follow: false },
};

type Props = { params: Promise<{ token: string }> };

const PHOTO_URL_SECONDS = 60 * 60;

/** The elder's name and photo, or null when the link is revoked, expired or used up. */
async function findElder(token: string) {
  if (!isTokenShaped(token)) return null;
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("contributor_link_info", { p_token: token });
  if (error) throw error;
  const info = data[0];
  if (!info) return null;
  let photoUrl: string | null = null;
  if (info.photo_path) {
    const { data: signed } = await admin.storage
      .from("vault-images")
      .createSignedUrl(info.photo_path, PHOTO_URL_SECONDS);
    photoUrl = signed?.signedUrl ?? null;
  }
  return {
    // Generated types for SQL functions drop nullability: a person may have no relation label.
    name: (info.relation_label as string | null) ?? info.person_display_name,
    photoUrl,
  };
}

export default async function RecordPage({ params }: Props) {
  const { token } = await params;
  const elder = await findElder(token);
  // An invalid link still renders the recorder: a recording that was mid-upload when the link
  // ran out of uploads must still be finished from the phone.
  return <Recorder token={token} person={elder} />;
}
