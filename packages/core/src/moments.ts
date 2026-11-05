import { z } from "zod";
import type { Language } from "./enums.ts";
import type { StructuredRecipe } from "./recipe.ts";

// Contracts for Phase 2.5 (docs/plans/phase-2.5-design-first-run.md): family moments and the
// two-minute typed recipe. The database enforces the same rules (migration
// moments_and_typed_recipes, pgTAP 08). Error messages are i18n keys.

const isoDate = /^\d{4}-\d{2}-\d{2}$/;

/** "I cooked it": note, rating and date. The photo is uploaded separately, after the moment exists. */
export const MomentInputSchema = z.object({
  note: z
    .string()
    .trim()
    .max(1000, "errors.tooLong")
    .optional()
    .transform((value) => (value ? value : null)),
  rating: z
    .union([z.literal(""), z.coerce.number().int().min(1).max(5)], "errors.rating")
    .optional()
    .transform((value) => (value === "" || value === undefined ? null : value)),
  cookedOn: z
    .string()
    .regex(isoDate, "errors.date")
    .refine((value) => value >= "1900-01-01" && value <= tomorrowIso(), "errors.date"),
});
export type MomentInput = z.infer<typeof MomentInputSchema>;

function tomorrowIso(now = new Date()): string {
  const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  return tomorrow.toISOString().slice(0, 10);
}

/**
 * The quick first recipe: what someone types from memory. One ingredient per line, kept exactly
 * as typed (the cook's own words), and one step per line. Nothing is guessed or flagged.
 */
export const TypedRecipeInputSchema = z.object({
  title: z.string().trim().min(1, "errors.required").max(200, "errors.tooLong"),
  ingredients: z
    .string()
    .transform(lines)
    .pipe(z.array(z.string().max(300, "errors.tooLong")).min(1, "errors.required")),
  steps: z
    .string()
    .transform(lines)
    .pipe(z.array(z.string().max(2000, "errors.tooLong"))),
  story: z
    .string()
    .trim()
    .max(10000, "errors.tooLong")
    .optional()
    .transform((value) => (value ? value : null)),
});
export type TypedRecipeInput = z.infer<typeof TypedRecipeInputSchema>;

function lines(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((line) => line.replace(/^\s*(?:[-*•]|\d+[.)])\s*/, "").trim())
    .filter(Boolean);
}

/** Typed input -> the recipe content create_typed_recipe() stores. */
export function typedRecipeContent(input: TypedRecipeInput, language: Language): StructuredRecipe {
  return {
    title: input.title,
    servings: null,
    ingredients: input.ingredients.map((original_text) => ({
      original_text,
      name: null,
      suggested_quantity: null,
      suggested_unit: null,
      confidence: null,
      note: null,
    })),
    steps: input.steps.map((text) => ({ text })),
    tips: [],
    story: input.story,
    language,
    uncertain_fields: [],
  };
}
