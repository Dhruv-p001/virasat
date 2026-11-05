import "server-only";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { type Ingredient, type SampleVault, sampleVault } from "@virasat/core";
import type { TFunction } from "i18next";
import { notFound } from "next/navigation";

// Helpers for the sample vault pages. The content is static and validated at import (a contract
// owned by workstream C); nothing here touches the database.

type SamplePerson = SampleVault["people"][number];
type SampleRecipe = SampleVault["recipes"][number];

const everyone: SamplePerson[] = [sampleVault.viewer, ...sampleVault.people];

export function getSamplePerson(slug: string): SamplePerson {
  const person = everyone.find((candidate) => candidate.slug === slug);
  if (!person) notFound();
  return person;
}

export function getSampleRecipe(slug: string): SampleRecipe {
  const recipe = sampleVault.recipes.find((candidate) => candidate.slug === slug);
  if (!recipe) notFound();
  return recipe;
}

/** What the family calls them. The visitor's own place reads "You" in their language. */
export function sampleLabel(person: SamplePerson, t: TFunction): string {
  return person.slug === sampleVault.viewer.slug ? t("sample.you") : person.relationLabel;
}

export function sampleLabelFor(slug: string, t: TFunction): string {
  return sampleLabel(getSamplePerson(slug), t);
}

/** "≈ 240 g whole-wheat flour", or null when the AI offered no quantity. Shown beside the words. */
export function suggestionLine(ingredient: Ingredient, locale: string): string | null {
  if (ingredient.suggested_quantity === null) return null;
  const amount = new Intl.NumberFormat(locale).format(ingredient.suggested_quantity);
  const unit = ingredient.suggested_unit ? ` ${ingredient.suggested_unit}` : "";
  return `≈ ${amount}${unit}${ingredient.name ? ` ${ingredient.name}` : ""}`;
}

/** The recording only plays when the file has been added to public/sample (see pendingAssets). */
export function sampleAssetExists(path: string | null): boolean {
  if (!path) return false;
  return existsSync(join(/* turbopackIgnore: true */ process.cwd(), "public", path));
}

export { sampleVault };
