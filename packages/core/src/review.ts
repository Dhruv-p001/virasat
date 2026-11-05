import { z } from "zod";
import { type Language, LanguageSchema } from "./enums.ts";
import { IngredientSchema, type StructuredRecipe, StructuredRecipeSchema } from "./recipe.ts";

// The review screen's model (ADR 0014). The AI's draft becomes an editable form; what the organiser
// confirms goes to confirm_capture(). Free of React, so the mapping is tested without a browser.
//
// Fields are plain strings while a person types. Each row carries its own "flags", worked out once
// from the draft's JSON pointers, so a highlight stays with its row when rows are added or removed.

export type IngredientField = "original_text" | "name" | "quantity" | "unit" | "note";

export type DraftIngredient = {
  key: string;
  /** The speaker's own words. Required, and always shown. */
  originalText: string;
  name: string;
  quantity: string;
  unit: string;
  note: string;
  /** The AI's confidence in the suggested quantity. Cleared when a person changes the quantity or unit. */
  confidence: number | null;
  /** Fields the draft marked as uncertain. */
  flags: IngredientField[];
};

export type DraftLine = { key: string; text: string; flagged: boolean };

export type RecipeDraft = {
  title: string;
  titleFlagged: boolean;
  servings: string;
  servingsFlagged: boolean;
  language: Language;
  ingredients: DraftIngredient[];
  steps: DraftLine[];
  tips: DraftLine[];
  story: string;
  storyFlagged: boolean;
};

let counter = 0;
/**
 * Row keys for React. Not stored anywhere. Rows made on the server and rows made in the browser
 * must not share a key, so each side starts from its own random prefix.
 */
const prefix = Math.random().toString(36).slice(2, 8);
export function newRowKey(): string {
  counter += 1;
  return `row-${prefix}-${counter}`;
}

const POINTER_FIELD: Record<string, IngredientField> = {
  original_text: "original_text",
  name: "name",
  suggested_quantity: "quantity",
  suggested_unit: "unit",
  note: "note",
};

/** True when a pointer names `path` itself or something inside it ("/steps/1" covers "/steps/1/text"). */
function covers(pointers: ReadonlySet<string>, path: string): boolean {
  if (pointers.has(path)) return true;
  for (const pointer of pointers) if (path.startsWith(`${pointer}/`)) return true;
  return false;
}

/** True when a pointer names `path`, something above it, or something inside it. For a whole row. */
function touches(pointers: ReadonlySet<string>, path: string): boolean {
  if (covers(pointers, path)) return true;
  for (const pointer of pointers) if (pointer.startsWith(`${path}/`)) return true;
  return false;
}

function ingredientFlags(pointers: ReadonlySet<string>, index: number): IngredientField[] {
  const base = `/ingredients/${index}`;
  if (covers(pointers, base)) return ["original_text", "name", "quantity", "unit", "note"];
  const flags: IngredientField[] = [];
  for (const [field, flag] of Object.entries(POINTER_FIELD)) {
    if (covers(pointers, `${base}/${field}`)) flags.push(flag);
  }
  // The confidence number has no field of its own: it points at the quantity it is about.
  if (covers(pointers, `${base}/confidence`) && !flags.includes("quantity")) flags.push("quantity");
  return flags;
}

/** The editable form for a draft recipe, with the draft's uncertain parts marked. */
export function draftFromRecipe(
  recipe: StructuredRecipe,
  extraFlagged: readonly string[] = [],
): RecipeDraft {
  const pointers = new Set([...recipe.uncertain_fields, ...extraFlagged]);
  return {
    title: recipe.title,
    titleFlagged: covers(pointers, "/title"),
    servings: recipe.servings === null ? "" : String(recipe.servings),
    servingsFlagged: covers(pointers, "/servings"),
    language: recipe.language,
    ingredients: recipe.ingredients.map((ingredient, index) => ({
      key: newRowKey(),
      originalText: ingredient.original_text,
      name: ingredient.name ?? "",
      quantity: ingredient.suggested_quantity === null ? "" : String(ingredient.suggested_quantity),
      unit: ingredient.suggested_unit ?? "",
      note: ingredient.note ?? "",
      confidence: ingredient.confidence,
      flags: ingredientFlags(pointers, index),
    })),
    steps: recipe.steps.map((step, index) => ({
      key: newRowKey(),
      text: step.text,
      flagged: touches(pointers, `/steps/${index}`),
    })),
    tips: recipe.tips.map((tip, index) => ({
      key: newRowKey(),
      text: tip,
      flagged: touches(pointers, `/tips/${index}`),
    })),
    story: recipe.story ?? "",
    storyFlagged: covers(pointers, "/story"),
  };
}

/** An empty form for entering a recipe by hand, in the language the capture was in. */
export function blankDraft(language: Language): RecipeDraft {
  return {
    title: "",
    titleFlagged: false,
    servings: "",
    servingsFlagged: false,
    language,
    ingredients: [blankIngredient()],
    steps: [blankLine()],
    tips: [],
    story: "",
    storyFlagged: false,
  };
}

export function blankIngredient(): DraftIngredient {
  return {
    key: newRowKey(),
    originalText: "",
    name: "",
    quantity: "",
    unit: "",
    note: "",
    confidence: null,
    flags: [],
  };
}

export function blankLine(): DraftLine {
  return { key: newRowKey(), text: "", flagged: false };
}

/** What confirm_capture() takes: the recipe a person has checked. Nothing is left uncertain. */
export const ReviewContentSchema = StructuredRecipeSchema.extend({
  title: z.string().trim().min(1).max(200),
  servings: z.number().int().min(1).max(500).nullable(),
  story: z.string().trim().min(1).max(10000).nullable(),
  uncertain_fields: z.tuple([]),
  ingredients: z.array(IngredientSchema).min(1),
  steps: z.array(z.object({ text: z.string().trim().min(1) })).min(1),
});
export type ReviewContent = z.infer<typeof ReviewContentSchema>;

/** Form errors keyed by field name, each an i18n key under `review.errors`. */
export type DraftErrors = Record<string, string>;

const blank = (value: string) => value.trim() === "";
const orNull = (value: string) => (blank(value) ? null : value.trim());

/** Parses "1,5" and "1.5" alike. Null when it is not a positive number. */
export function parseQuantity(value: string): number | null {
  const normalised = value.trim().replace(",", ".");
  if (!/^\d+(\.\d+)?$/.test(normalised)) return null;
  const parsed = Number(normalised);
  return parsed > 0 ? parsed : null;
}

/**
 * Checks the form and builds what is confirmed. Empty rows are dropped, not errors. Every
 * ingredient keeps its original words; a quantity is only ever a suggestion beside them.
 */
export function contentFromDraft(
  draft: RecipeDraft,
): { ok: true; content: ReviewContent } | { ok: false; errors: DraftErrors } {
  const errors: DraftErrors = {};

  if (blank(draft.title)) errors["title"] = "titleRequired";

  let servings: number | null = null;
  if (!blank(draft.servings)) {
    const parsed = Number(draft.servings.trim());
    if (!Number.isInteger(parsed) || parsed < 1 || parsed > 500)
      errors["servings"] = "servingsInvalid";
    else servings = parsed;
  }

  const ingredients: z.input<typeof IngredientSchema>[] = [];
  draft.ingredients.forEach((row) => {
    const empty = [row.originalText, row.name, row.quantity, row.unit, row.note].every(blank);
    if (empty) return;
    if (blank(row.originalText)) errors[`ingredient.${row.key}.originalText`] = "originalRequired";
    let quantity: number | null = null;
    if (!blank(row.quantity)) {
      quantity = parseQuantity(row.quantity);
      if (quantity === null) errors[`ingredient.${row.key}.quantity`] = "quantityInvalid";
    }
    ingredients.push({
      original_text: row.originalText.trim(),
      name: orNull(row.name),
      suggested_quantity: quantity,
      suggested_unit: orNull(row.unit),
      confidence: quantity === null ? null : row.confidence,
      note: orNull(row.note),
    });
  });
  if (ingredients.length === 0) errors["ingredients"] = "ingredientsRequired";

  const steps = draft.steps
    .filter((step) => !blank(step.text))
    .map((step) => ({ text: step.text.trim() }));
  if (steps.length === 0) errors["steps"] = "stepsRequired";

  if (Object.keys(errors).length > 0) return { ok: false, errors };

  const parsed = ReviewContentSchema.safeParse({
    title: draft.title.trim(),
    servings,
    ingredients,
    steps,
    tips: draft.tips.filter((tip) => !blank(tip.text)).map((tip) => tip.text.trim()),
    story: orNull(draft.story),
    language: draft.language,
    uncertain_fields: [],
  });
  if (!parsed.success) {
    // The checks above cover everything a person can get wrong. This is the length limits.
    return { ok: false, errors: { form: "invalid" } };
  }
  return { ok: true, content: parsed.data };
}

/** Language for a manual entry: the capture's detected language, else the person's, else English. */
export function reviewLanguage(detected: string | null, fallback: string | null): Language {
  for (const code of [detected, fallback]) {
    const parsed = LanguageSchema.safeParse(code?.slice(0, 2).toLowerCase());
    if (parsed.success) return parsed.data;
  }
  return "en";
}
