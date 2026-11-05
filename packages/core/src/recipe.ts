import { z } from "zod";
import { LanguageSchema } from "./enums.ts";

/**
 * One ingredient line. `original_text` is the speaker's exact words ("mutthi bhar besan")
 * and is always shown. Suggested quantities sit beside it and never replace it.
 */
export const IngredientSchema = z.object({
  original_text: z.string().trim().min(1),
  name: z.string().trim().min(1).nullable(),
  suggested_quantity: z.number().positive().nullable(),
  suggested_unit: z.string().trim().min(1).nullable(),
  confidence: z.number().min(0).max(1).nullable(),
  note: z.string().trim().min(1).nullable(),
});
export type Ingredient = z.infer<typeof IngredientSchema>;

export const StepSchema = z.object({
  text: z.string().trim().min(1),
});
export type Step = z.infer<typeof StepSchema>;

/**
 * Contract for a recipe produced by the AI structurer, before human review.
 * `uncertain_fields` holds JSON-pointer paths ("/ingredients/2/name") that the review
 * screen highlights.
 */
export const StructuredRecipeSchema = z.object({
  title: z.string().trim().min(1),
  servings: z.number().int().positive().nullable(),
  ingredients: z.array(IngredientSchema),
  steps: z.array(StepSchema),
  tips: z.array(z.string().trim().min(1)),
  story: z.string().trim().min(1).nullable(),
  language: LanguageSchema,
  uncertain_fields: z.array(z.string().startsWith("/")),
});
export type StructuredRecipe = z.infer<typeof StructuredRecipeSchema>;

/**
 * "≈ 240 g whole-wheat flour", or null when no quantity was suggested. Shown beside the speaker's
 * words, never instead of them.
 */
export function suggestionLine(ingredient: Ingredient, locale: string): string | null {
  if (ingredient.suggested_quantity === null) return null;
  const amount = new Intl.NumberFormat(locale).format(ingredient.suggested_quantity);
  const unit = ingredient.suggested_unit ? ` ${ingredient.suggested_unit}` : "";
  return `≈ ${amount}${unit}${ingredient.name ? ` ${ingredient.name}` : ""}`;
}
