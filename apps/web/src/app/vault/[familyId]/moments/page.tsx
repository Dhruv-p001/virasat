import { Camera } from "lucide-react";
import type { Metadata } from "next";
import { EmptyState, PageShell, ButtonLink } from "@/components/ui.tsx";
import { getVault } from "@/lib/data.ts";
import { getT } from "@/lib/i18n/server.ts";

type Props = { params: Promise<{ familyId: string }> };

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return { title: t("moments.title") };
}

// The designed empty state. Moments themselves arrive with the data contract (workstream C).
export default async function MomentsPage({ params }: Props) {
  const { familyId } = await params;
  const [vault, { t }] = await Promise.all([getVault(familyId), getT()]);
  return (
    <PageShell title={t("moments.title")} eyebrow={vault.name}>
      <EmptyState
        icon={<Camera />}
        title={t("moments.emptyTitle")}
        body={t("moments.emptyBody")}
        action={<ButtonLink href={`/vault/${familyId}`}>{t("moments.emptyAction")}</ButtonLink>}
      />
    </PageShell>
  );
}
