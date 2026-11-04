import { canWriteContent } from "@virasat/core";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageShell } from "@/components/ui.tsx";
import { getVault } from "@/lib/data.ts";
import { getT } from "@/lib/i18n/server.ts";
import { AddPersonForm } from "./add-person-form.tsx";

type Props = { params: Promise<{ familyId: string }> };

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return { title: t("person.newTitle") };
}

export default async function NewPersonPage({ params }: Props) {
  const { familyId } = await params;
  const [vault, { t }] = await Promise.all([getVault(familyId), getT()]);
  if (!canWriteContent(vault.role)) notFound();

  return (
    <PageShell
      title={t("person.newTitle")}
      back={{ href: `/vault/${familyId}`, label: vault.name }}
    >
      <AddPersonForm familyId={familyId} />
    </PageShell>
  );
}
