import { canWriteContent, suggestionLine } from "@virasat/core";
import { Avatar } from "@virasat/ui/avatar";
import { Card, PhotoFrame } from "@virasat/ui/card";
import { Section } from "@virasat/ui/page";
import { Reveal } from "@virasat/ui/reveal";
import { Mic } from "lucide-react";
import type { Metadata } from "next";
import { CookedSheet } from "@/components/cooked-sheet.tsx";
import { MomentCard } from "@/components/moment-card.tsx";
import { RecipeAudio } from "@/components/recipe-audio.tsx";
import { SavedCelebration } from "@/components/saved-celebration.tsx";
import { PageShell } from "@/components/ui.tsx";
import { getVault } from "@/lib/data.ts";
import { getT } from "@/lib/i18n/server.ts";
import { listRecipeMoments } from "@/lib/moments.ts";
import { getRecipe } from "@/lib/recipes.ts";

type Props = {
  params: Promise<{ familyId: string; recipeId: string }>;
  searchParams: Promise<{ saved?: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { familyId, recipeId } = await params;
  await getVault(familyId);
  return { title: (await getRecipe(familyId, recipeId)).title };
}

/**
 * A recipe as the family keeps it (brief flow D): her voice telling it, her words beside every
 * ingredient, the story, and the handwriting. The recording is the heart of it, so it comes first.
 */
export default async function RecipePage({ params, searchParams }: Props) {
  const { familyId, recipeId } = await params;
  const { saved } = await searchParams;
  const [vault, { t, locale }] = await Promise.all([getVault(familyId), getT()]);
  const recipe = await getRecipe(familyId, recipeId);
  const moments = await listRecipeMoments(recipeId);
  const canWrite = canWriteContent(vault.role);
  const number = new Intl.NumberFormat(locale);
  const date = new Intl.DateTimeFormat(locale, { dateStyle: "medium" });
  const name = recipe.person?.name ?? null;

  return (
    <PageShell
      title={recipe.title}
      eyebrow={name ? t("ui.recipeOf", { name }) : undefined}
      back={{ href: `/vault/${familyId}#recipes`, label: vault.name }}
      actions={
        canWrite ? (
          <CookedSheet
            familyId={familyId}
            recipes={[{ id: recipe.id, title: recipe.title }]}
            recipeId={recipe.id}
            variant="secondary"
          />
        ) : undefined
      }
    >
      {saved === "1" && canWrite && <SavedCelebration title={t("ui.firstRecipe.savedTitle")} />}

      <Reveal index={0} className="-mt-4">
        <div className="flex items-center gap-4">
          {recipe.person && (
            <Avatar name={recipe.person.name} photoUrl={recipe.person.photoUrl} size="lg" />
          )}
          <div className="flex flex-col">
            {recipe.person && (
              <span className="font-serif text-xl font-semibold">{recipe.person.name}</span>
            )}
            <span className="text-muted">
              {t(`recipe.source.${recipe.source}`)}
              {recipe.servings !== null && ` · ${t("recipe.serves", { count: recipe.servings })}`}
            </span>
          </div>
        </div>
      </Reveal>

      {recipe.audio && (
        <Reveal index={1}>
          <Card className="flex flex-col gap-3" data-testid="recipe-audio">
            <span className="flex items-center gap-2 font-serif text-lg font-semibold">
              <Mic aria-hidden className="size-5 text-accent" />
              {name ? t("recipe.listen", { name }) : t("recipe.listenOriginal")}
            </span>
            {recipe.audio.state === "ready" ? (
              // The recording is the heart of the recipe; the browser's own controls are accessible.
              <RecipeAudio
                src={recipe.audio.url}
                label={name ? t("recipe.listen", { name }) : t("recipe.listenOriginal")}
              />
            ) : (
              <p className="text-muted">
                {t(
                  recipe.audio.state === "removed" ? "recipe.audioRemoved" : "recipe.audioMissing",
                )}
              </p>
            )}
          </Card>
        </Reveal>
      )}

      <Reveal index={2}>
        <Section title={t("recipe.ingredients")}>
          <ul
            className="flex flex-col divide-y divide-border rounded-lg bg-surface shadow-album ring-1 ring-border ring-inset"
            data-testid="ingredients"
          >
            {recipe.ingredients.map((ingredient, index) => {
              const suggestion = suggestionLine(ingredient, locale);
              return (
                <li
                  key={`${index}-${ingredient.original_text}`}
                  className="flex flex-col gap-0.5 px-4 py-3 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4"
                >
                  <span className="text-lg font-medium italic">“{ingredient.original_text}”</span>
                  {suggestion && <span className="text-muted sm:text-end">{suggestion}</span>}
                </li>
              );
            })}
          </ul>
        </Section>
      </Reveal>

      {recipe.steps.length > 0 && (
        <Reveal index={3}>
          <Section title={t("recipe.steps")}>
            <ol className="flex flex-col gap-4">
              {recipe.steps.map((step, index) => (
                <li key={index} className="flex gap-4">
                  <span
                    aria-hidden
                    className="flex size-9 shrink-0 items-center justify-center rounded-full bg-sunken font-serif font-semibold text-accent"
                  >
                    {number.format(index + 1)}
                  </span>
                  <p className="pt-1 text-lg">{step.text}</p>
                </li>
              ))}
            </ol>
          </Section>
        </Reveal>
      )}

      {recipe.tips.length > 0 && (
        <Reveal index={4}>
          <Section title={t("recipe.tips")}>
            <ul className="flex flex-col gap-2 ps-5 text-lg">
              {recipe.tips.map((tip, index) => (
                <li key={index} className="list-disc">
                  {tip}
                </li>
              ))}
            </ul>
          </Section>
        </Reveal>
      )}

      {recipe.story && (
        <Reveal index={5}>
          <Section title={t("recipe.story")}>
            <p className="border-s-4 border-border ps-4 font-serif text-xl leading-relaxed whitespace-pre-line italic">
              {recipe.story}
            </p>
          </Section>
        </Reveal>
      )}

      {recipe.pages.length > 0 && (
        <Reveal index={6}>
          <Section title={t("recipe.handwriting")}>
            <ol className="grid gap-4 sm:grid-cols-2" data-testid="recipe-pages">
              {recipe.pages.map((page, index) => (
                <li key={index}>
                  {page.url ? (
                    <PhotoFrame>
                      {/* A signed, short-lived private URL: next/image would proxy and cache it. */}
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={page.url}
                        alt={t("recipe.pageAlt", { n: index + 1 })}
                        className="w-full rounded-sm"
                      />
                    </PhotoFrame>
                  ) : (
                    <p className="text-muted">{t("recipe.pageNotShown", { n: index + 1 })}</p>
                  )}
                </li>
              ))}
            </ol>
          </Section>
        </Reveal>
      )}

      {moments.length > 0 && (
        <Reveal index={7}>
          <Section title={t("recipe.moments")}>
            <ul className="grid gap-4 sm:grid-cols-2">
              {moments.map((moment) => (
                <li key={moment.id}>
                  <MomentCard
                    authorName={moment.authorName}
                    byline={t("moments.cookedBy", { name: moment.authorName })}
                    dateText={date.format(new Date(moment.cookedOn))}
                    recipeTitle={recipe.title}
                    rating={moment.rating}
                    ratingLabel={
                      moment.rating === null ? "" : t("sample.rating", { count: moment.rating })
                    }
                    note={moment.note}
                    photoUrl={moment.photoUrl}
                    photoAlt={recipe.title}
                  />
                </li>
              ))}
            </ul>
          </Section>
        </Reveal>
      )}
    </PageShell>
  );
}
