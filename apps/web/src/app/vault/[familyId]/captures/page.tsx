import { canWriteContent } from "@virasat/core";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AiModeBanner } from "@/components/ai-mode-banner.tsx";
import { CaptureList } from "@/components/capture-list.tsx";
import { PageShell } from "@/components/ui.tsx";
import { getVault, listOpenCaptures } from "@/lib/data.ts";
import { getT } from "@/lib/i18n/server.ts";

type Props = { params: Promise<{ familyId: string }> };

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return { title: t("captures.title") };
}

export default async function CapturesPage({ params }: Props) {
  const { familyId } = await params;
  const [vault, { t }] = await Promise.all([getVault(familyId), getT()]);
  // Unreviewed captures are for people who can write. Viewers do not see them.
  if (!canWriteContent(vault.role)) notFound();
  const captures = await listOpenCaptures(familyId);

  return (
    <PageShell title={t("captures.title")} back={{ href: `/vault/${familyId}`, label: vault.name }}>
      <AiModeBanner />
      <CaptureList captures={captures} />
    </PageShell>
  );
}
