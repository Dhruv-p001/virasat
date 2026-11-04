import { canManageMembers } from "@virasat/core";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageShell } from "@/components/ui.tsx";
import { getVault, listPeople } from "@/lib/data.ts";
import { getT } from "@/lib/i18n/server.ts";
import { InviteForm } from "./invite-form.tsx";

type Props = {
  params: Promise<{ familyId: string }>;
  searchParams: Promise<{ person?: string }>;
};

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return { title: t("invite.title") };
}

export default async function InvitePage({ params, searchParams }: Props) {
  const { familyId } = await params;
  const { person } = await searchParams;
  const [vault, { t, locale }] = await Promise.all([getVault(familyId), getT()]);
  if (!canManageMembers(vault.role)) notFound();

  const people = (await listPeople(familyId)).filter((p) => !p.profile_id);
  const preselected = people.some((p) => p.id === person) ? (person ?? "") : "";

  return (
    <PageShell title={t("invite.title")} back={{ href: `/vault/${familyId}`, label: vault.name }}>
      <InviteForm
        familyId={familyId}
        locale={locale}
        people={people.map((p) => ({
          id: p.id,
          label: p.relation_label ? `${p.relation_label} (${p.display_name})` : p.display_name,
        }))}
        preselectedPersonId={preselected}
      />
    </PageShell>
  );
}
