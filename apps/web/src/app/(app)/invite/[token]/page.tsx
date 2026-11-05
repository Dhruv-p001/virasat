import { createHash } from "node:crypto";
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { ButtonLink, PageShell } from "@/components/ui.tsx";
import { getUserId } from "@/lib/auth.ts";
import { getT } from "@/lib/i18n/server.ts";
import { createAdminClient } from "@/lib/supabase/admin.ts";
import { createClient } from "@/lib/supabase/server.ts";
import { JoinButton } from "./join-button.tsx";

// The token is a secret in the URL: keep it out of Referer headers.
export const metadata: Metadata = { referrer: "no-referrer", robots: { index: false } };

type Props = { params: Promise<{ token: string }> };

/** Looks the invite up by hash with the service role: the visitor is not a member yet. */
async function findInvite(token: string) {
  const tokenHash = createHash("sha256").update(token).digest("hex");
  const { data } = await createAdminClient()
    .from("invites")
    .select(
      "role, expires_at, accepted_at, revoked_at, family_id, families!inner(name, deleted_at), inviter:profiles!invites_invited_by_fkey(display_name)",
    )
    .eq("token_hash", tokenHash)
    .maybeSingle();
  if (!data) return null;
  const usable =
    !data.accepted_at &&
    !data.revoked_at &&
    !data.families.deleted_at &&
    new Date(data.expires_at) > new Date();
  return { ...data, usable };
}

export default async function JoinPage({ params }: Props) {
  const { token } = await params;
  if (!/^[A-Za-z0-9_-]{22,128}$/.test(token)) notFound();
  const [{ t }, invite, userId] = await Promise.all([getT(), findInvite(token), getUserId()]);

  if (invite && userId) {
    // Already a member (including someone reopening their own used invite): go straight in.
    // Checked as the user, so RLS decides; nothing about the vault is revealed otherwise.
    const supabase = await createClient();
    const { data: membership } = await supabase
      .from("family_members")
      .select("family_id")
      .eq("family_id", invite.family_id)
      .eq("profile_id", userId)
      .maybeSingle();
    if (membership) redirect(`/vault/${invite.family_id}`);
  }

  if (!invite?.usable) {
    return (
      <PageShell title={t("join.invalidTitle")}>
        <p className="text-lg text-muted">{t("join.invalidBody")}</p>
      </PageShell>
    );
  }

  const vault = invite.families.name;
  const inviter = invite.inviter?.display_name ?? vault;
  return (
    <PageShell title={t("join.title", { inviter, vault })}>
      <p className="text-lg text-muted">{t("join.body", { role: t(`roles.${invite.role}`) })}</p>
      {userId ? (
        <JoinButton token={token} label={t("join.join", { vault })} />
      ) : (
        <ButtonLink
          href={`/sign-in?next=${encodeURIComponent(`/invite/${token}`)}`}
          className="self-start"
        >
          {t("join.signInToJoin")}
        </ButtonLink>
      )}
    </PageShell>
  );
}
