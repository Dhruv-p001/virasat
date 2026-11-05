import { Avatar } from "@virasat/ui/avatar";
import { Card, PhotoFrame } from "@virasat/ui/card";
import { ButtonLink } from "@virasat/ui/link-button";
import { Section } from "@virasat/ui/page";
import { Mic } from "lucide-react";
import type { Metadata } from "next";
import { LineageStrip } from "@/components/lineage-strip.tsx";
import { MomentCard } from "@/components/moment-card.tsx";
import { PageShell } from "@/components/ui.tsx";
import { getT } from "@/lib/i18n/server.ts";
import {
  getSamplePerson,
  getSampleRecipe,
  sampleAssetExists,
  sampleLabel,
  sampleLabelFor,
  sampleVault,
  suggestionLine,
} from "@/lib/sample.ts";

type Props = { params: Promise<{ slug: string }> };

export function generateStaticParams() {
  return sampleVault.recipes.map((recipe) => ({ slug: recipe.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  return { title: getSampleRecipe((await params).slug).recipe.title };
}

export default async function SampleRecipePage({ params }: Props) {
  const { slug } = await params;
  const entry = getSampleRecipe(slug);
  const { recipe } = entry;
  const { t, locale } = await getT();
  const origin = getSamplePerson(entry.originPerson);
  const originName = sampleLabel(origin, t);
  const date = new Intl.DateTimeFormat(locale, { dateStyle: "medium" });
  const lineage = sampleVault.lineage.find((candidate) => candidate.recipe === slug);
  const moments = sampleVault.moments.filter((moment) => moment.recipe === slug);
  const audioReady = sampleAssetExists(entry.audio);

  return (
    <PageShell
      title={recipe.title}
      eyebrow={t("sample.recipeOf", { name: originName })}
      back={{ href: "/sample", label: t("sample.back") }}
    >
      <div className="-mt-4 flex items-center gap-4">
        <Avatar name={originName} photoUrl={origin.photo} size="lg" />
        <div className="flex flex-col">
          <span className="font-serif text-xl font-semibold">{originName}</span>
          <span className="text-muted">{t(`sample.source.${entry.source}`)}</span>
        </div>
      </div>

      {entry.dishPhoto && (
        <PhotoFrame>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={entry.dishPhoto}
            alt={t("sample.dish")}
            className="aspect-4/3 w-full rounded-sm object-cover"
          />
        </PhotoFrame>
      )}

      {entry.audio && (
        <Card className="flex flex-col gap-3" data-testid="sample-audio">
          <span className="flex items-center gap-2 font-serif text-lg font-semibold">
            <Mic aria-hidden className="size-5 text-accent" />
            {t("sample.listen", { name: originName })}
          </span>
          {audioReady ? (
            // The recording is the heart of the recipe; browsers' own controls are accessible.
            <audio controls preload="none" src={entry.audio} className="w-full" />
          ) : (
            <p className="text-muted">{t("sample.audioSoon")}</p>
          )}
        </Card>
      )}

      <Section title={t("sample.ingredients")}>
        <ul className="flex flex-col divide-y divide-border rounded-lg bg-surface shadow-album ring-1 ring-border ring-inset">
          {recipe.ingredients.map((ingredient) => {
            const suggestion = suggestionLine(ingredient, locale);
            return (
              <li
                key={ingredient.original_text}
                className="flex flex-col gap-0.5 px-4 py-3 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4"
              >
                <span className="text-lg font-medium italic">“{ingredient.original_text}”</span>
                {suggestion && <span className="text-muted sm:text-end">{suggestion}</span>}
              </li>
            );
          })}
        </ul>
      </Section>

      {recipe.steps.length > 0 && (
        <Section title={t("sample.steps")}>
          <ol className="flex flex-col gap-4">
            {recipe.steps.map((step, index) => (
              <li key={index} className="flex gap-4">
                <span
                  aria-hidden
                  className="flex size-9 shrink-0 items-center justify-center rounded-full bg-sunken font-serif font-semibold text-accent"
                >
                  {new Intl.NumberFormat(locale).format(index + 1)}
                </span>
                <p className="pt-1 text-lg">{step.text}</p>
              </li>
            ))}
          </ol>
        </Section>
      )}

      {recipe.tips.length > 0 && (
        <Section title={t("sample.tips")}>
          <ul className="flex flex-col gap-2 ps-5 text-lg">
            {recipe.tips.map((tip) => (
              <li key={tip} className="list-disc">
                {tip}
              </li>
            ))}
          </ul>
        </Section>
      )}

      {recipe.story && (
        <Section title={t("sample.story")}>
          <p className="border-s-4 border-border ps-4 font-serif text-xl leading-relaxed italic">
            {recipe.story}
          </p>
        </Section>
      )}

      {entry.scan && (
        <Section title={t("sample.handwriting")}>
          <PhotoFrame className="max-w-sm">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={entry.scan}
              alt={t("sample.handwriting")}
              className="aspect-3/4 w-full rounded-sm object-cover"
            />
          </PhotoFrame>
        </Section>
      )}

      {lineage && (
        <Section title={t("sample.lineage")}>
          <LineageStrip
            title={t("sample.lineage")}
            chain={lineage.chain.map((personSlug) => ({
              name: sampleLabelFor(personSlug, t),
              photoUrl: getSamplePerson(personSlug).photo,
            }))}
            messages={lineage.messages}
          />
        </Section>
      )}

      {moments.length > 0 && (
        <Section title={t("sample.moments")}>
          <ul className="grid gap-4 sm:grid-cols-2">
            {moments.map((moment) => {
              const author = getSamplePerson(moment.author);
              const name = sampleLabel(author, t);
              return (
                <li key={moment.author}>
                  <MomentCard
                    authorName={name}
                    authorPhotoUrl={author.photo}
                    byline={t("moments.cookedBy", { name })}
                    dateText={date.format(new Date(moment.cookedOn))}
                    recipeTitle={recipe.title}
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
      )}

      <Card className="flex flex-col items-start gap-3">
        <h2 className="text-xl">{t("sample.ctaTitle")}</h2>
        <p className="text-muted">{t("sample.ctaBody")}</p>
        <ButtonLink href="/sign-in">{t("sample.startOwn")}</ButtonLink>
      </Card>
    </PageShell>
  );
}
