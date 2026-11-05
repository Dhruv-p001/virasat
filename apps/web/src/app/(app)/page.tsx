import Link from "next/link";
import { redirect } from "next/navigation";
import { Card, interactiveCard } from "@virasat/ui/card";
import { FamilyArt, MicArt, PageArt } from "@virasat/ui/illustrations";
import { Reveal } from "@virasat/ui/reveal";
import { ChevronRight } from "lucide-react";
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
                className={`${interactiveCard} flex min-h-elder-tap-target items-center justify-between gap-4`}
              >
                <span className="font-serif text-xl">{vault.name}</span>
                <span className="flex items-center gap-2 text-muted">
                  {t(`roles.${vault.role}`)}
                  <ChevronRight aria-hidden className="size-5 rtl:rotate-180" />
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </PageShell>
    );
  }

  return (
    <main
      id="main"
      className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-16 px-4 py-10 md:py-16"
    >
      <div className="grid items-center gap-12 md:grid-cols-2">
        <div className="flex flex-col gap-6">
          <h1 className="text-3xl font-semibold sm:text-[2.75rem] sm:leading-tight">
            {t("landing.headline")}
          </h1>
          <p className="max-w-prose text-lg leading-relaxed text-muted">{t("landing.body")}</p>
          <div className="flex flex-wrap gap-3">
            <ButtonLink href="/sign-in">{t("landing.getStarted")}</ButtonLink>
            <ButtonLink href="/sample" kind="secondary">
              {t("sample.exploreLink")}
            </ButtonLink>
            <ButtonLink href="/sign-in" kind="quiet">
              {t("landing.signIn")}
            </ButtonLink>
          </div>
        </div>
        <AlbumSpread />
      </div>

      <section aria-labelledby="how-it-works" className="flex flex-col gap-6">
        <div className="flex flex-col gap-3">
          <h2 id="how-it-works" className="text-2xl sm:text-3xl">
            {t("landing.how.title")}
          </h2>
          <div aria-hidden className="rule-motif w-28" />
        </div>
        <ul className="grid gap-4 md:grid-cols-3">
          {(
            [
              [MicArt, "record"],
              [PageArt, "photograph"],
              [FamilyArt, "keep"],
            ] as const
          ).map(([Art, step], index) => (
            <li key={step}>
              <Reveal index={index} className="h-full">
                <Card className="flex h-full flex-col gap-3 shadow-album" data-testid="how-step">
                  <div className="mx-auto w-40">
                    <Art />
                  </div>
                  <h3 className="text-xl">{t(`landing.how.${step}.title`)}</h3>
                  <p className="text-muted">{t(`landing.how.${step}.body`)}</p>
                </Card>
              </Reveal>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}

const WAVE_BARS = [30, 55, 40, 80, 50, 95, 65, 45, 75, 35, 60, 25];

/** Decorative: a voice, a handwritten page and a portrait laid out like prints in an album. */
function AlbumSpread() {
  return (
    <div aria-hidden className="relative mx-auto h-72 w-full max-w-sm sm:h-80">
      <div className="mat absolute start-0 top-4 w-3/5 -rotate-3 shadow-lift">
        <div className="flex h-36 items-center justify-center gap-1.5 rounded-sm bg-sunken px-4">
          {WAVE_BARS.map((height, index) => (
            <span
              key={index}
              className="w-1.5 rounded-full bg-accent"
              style={{ height: `${height}%` }}
            />
          ))}
        </div>
      </div>
      <div className="mat absolute end-0 top-0 w-1/2 rotate-3 shadow-lift">
        <div
          className="h-44 rounded-sm bg-paper"
          style={{
            backgroundImage:
              "repeating-linear-gradient(transparent 0 19px, var(--color-border) 19px 20px)",
          }}
        />
      </div>
      <div className="mat absolute start-1/4 bottom-0 w-2/5 rotate-1 shadow-lift">
        <div className="flex h-32 items-center justify-center rounded-sm bg-sunken">
          <span className="flex size-16 items-center justify-center rounded-full bg-surface font-serif text-2xl font-semibold text-accent ring-2 ring-border">
            V
          </span>
        </div>
      </div>
    </div>
  );
}
