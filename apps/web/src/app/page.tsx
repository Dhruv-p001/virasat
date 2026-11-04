import Link from "next/link";
import { redirect } from "next/navigation";
import { ButtonLink, PageShell } from "@/components/ui.tsx";
import { getUserId } from "@/lib/auth.ts";
import { listMyVaults } from "@/lib/data.ts";
import { getT } from "@/lib/i18n/server.ts";

export default async function HomePage() {
  const { t } = await getT();

  if (await getUserId()) {
    const vaults = await listMyVaults();
    if (vaults.length === 0) redirect("/onboarding");
    if (vaults.length === 1 && vaults[0]) redirect(`/vault/${vaults[0].id}`);
    return (
      <PageShell title={t("nav.yourVaults")}>
        <ul className="flex flex-col gap-3">
          {vaults.map((vault) => (
            <li key={vault.id}>
              <Link
                href={`/vault/${vault.id}`}
                className="flex items-center justify-between gap-4 rounded-lg bg-surface p-4"
              >
                <span className="font-serif text-xl">{vault.name}</span>
                <span className="text-muted">{t(`roles.${vault.role}`)}</span>
              </Link>
            </li>
          ))}
        </ul>
      </PageShell>
    );
  }

  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col justify-center gap-6 px-4 py-12">
      <h1 className="text-3xl font-semibold sm:text-[2.75rem] sm:leading-tight">
        {t("landing.headline")}
      </h1>
      <p className="text-lg leading-relaxed text-muted">{t("landing.body")}</p>
      <div className="flex flex-wrap gap-3">
        <ButtonLink href="/sign-in">{t("landing.getStarted")}</ButtonLink>
        <ButtonLink href="/sign-in" kind="quiet">
          {t("landing.signIn")}
        </ButtonLink>
      </div>
    </main>
  );
}
