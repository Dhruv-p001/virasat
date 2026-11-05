import { interactiveCard, PhotoFrame } from "@virasat/ui/card";
import { Avatar } from "@virasat/ui/avatar";
import { Section } from "@virasat/ui/page";
import type { Metadata } from "next";
import Link from "next/link";
import { MomentCard } from "@/components/moment-card.tsx";
import { PageShell } from "@/components/ui.tsx";
import { getT } from "@/lib/i18n/server.ts";
import { getSamplePerson, getSampleRecipe, sampleLabel, sampleVault } from "@/lib/sample.ts";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return { title: t("sample.navLabel") };
}

export default async function SamplePage() {
  const { t, locale } = await getT();
  const date = new Intl.DateTimeFormat(locale, { dateStyle: "medium" });

  return (
    <PageShell title={sampleVault.familyName} eyebrow={t("sample.navLabel")}>
      <p className="-mt-4 max-w-prose text-lg text-muted">{t("sample.intro")}</p>

      <Section title={t("sample.recipes")}>
        <ul className="grid gap-4 sm:grid-cols-2">
          {sampleVault.recipes.map((recipe) => {
            const origin = getSamplePerson(recipe.originPerson);
            return (
              <li key={recipe.slug}>
                <Link
                  href={`/sample/recipes/${recipe.slug}`}
                  className={`${interactiveCard} flex h-full flex-col gap-3`}
                >
                  {recipe.dishPhoto && (
                    <PhotoFrame>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={recipe.dishPhoto}
                        alt=""
                        className="aspect-4/3 w-full rounded-sm object-cover"
                      />
                    </PhotoFrame>
                  )}
                  <span className="font-serif text-xl font-semibold">{recipe.recipe.title}</span>
                  <span className="text-sm text-muted">
                    {t("sample.recipeOf", { name: sampleLabel(origin, t) })} ·{" "}
                    {t(`sample.source.${recipe.source}`)}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </Section>

      <Section title={t("sample.people")}>
        <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          {sampleVault.people.map((person) => (
            <li key={person.slug}>
              <Link
                href={`/sample/people/${person.slug}`}
                className={`${interactiveCard} flex h-full flex-col items-center gap-3 text-center`}
              >
                <Avatar name={person.relationLabel} photoUrl={person.photo} size="lg" />
                <span className="flex min-w-0 flex-col">
                  <span className="truncate font-serif text-lg font-semibold">
                    {person.relationLabel}
                  </span>
                  <span className="truncate text-sm text-muted">{person.displayName}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </Section>

      <Section title={t("sample.moments")}>
        <ul className="grid gap-4 sm:grid-cols-2">
          {sampleVault.moments.map((moment) => {
            const author = getSamplePerson(moment.author);
            const recipe = getSampleRecipe(moment.recipe);
            const name = sampleLabel(author, t);
            return (
              <li key={`${moment.recipe}-${moment.author}`}>
                <MomentCard
                  authorName={name}
                  authorPhotoUrl={author.photo}
                  byline={t("moments.cookedBy", { name })}
                  dateText={date.format(new Date(moment.cookedOn))}
                  recipeTitle={recipe.recipe.title}
                  rating={moment.rating}
                  ratingLabel={
                    moment.rating === null ? "" : t("sample.rating", { count: moment.rating })
                  }
                  note={moment.note}
                  photoUrl={moment.photo}
                  photoAlt={t("sample.dish")}
                />
              </li>
            );
          })}
        </ul>
      </Section>
    </PageShell>
  );
}
