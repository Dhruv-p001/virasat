import { FamilyArt } from "@virasat/ui/illustrations";
import type { Metadata } from "next";
import { PageShell } from "@/components/ui.tsx";
import { requireUserId } from "@/lib/auth.ts";
import { getT } from "@/lib/i18n/server.ts";
import { CreateVaultForm } from "./create-vault-form.tsx";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return { title: t("onboarding.title") };
}

export default async function OnboardingPage() {
  await requireUserId("/onboarding");
  const { t } = await getT();
  return (
    <PageShell title={t("onboarding.title")}>
      <div aria-hidden className="-mt-2 w-40">
        <FamilyArt />
      </div>
      <p className="text-lg text-muted">{t("onboarding.body")}</p>
      <CreateVaultForm />
    </PageShell>
  );
}
