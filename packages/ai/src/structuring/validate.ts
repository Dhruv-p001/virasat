import { StructuredRecipeSchema, type StructuredRecipe } from "@virasat/core";
import type { z } from "zod";
import { normalizeTranscript } from "../metrics/error-rate.ts";

/** Metric units a suggested quantity may use. "piece" is for countable items ("2 onions"). */
export const METRIC_UNITS = ["g", "kg", "ml", "l", "piece"] as const;

export type ValidationOutcome =
  { ok: true; recipe: StructuredRecipe; autoFlagged: string[] } | { ok: false; issues: string[] };

/** Zod issues as "path: message". Zod messages describe the shape, not the value, so no recipe content leaks. */
export function describeIssues(error: z.ZodError): string[] {
  return error.issues.map((issue) => `${issue.path.join(".") || "(root)"}: ${issue.message}`);
}

/**
 * Checks a recipe against the Zod contract plus the rules a schema cannot express:
 *  - suggested units are metric (retried when broken);
 *  - uncertain_fields point at real parts of the recipe (stale pointers are dropped);
 *  - each ingredient's original_text appears verbatim in the source text (flagged for review when not).
 */
export function validateRecipe(raw: unknown, sourceText: string): ValidationOutcome {
  const parsed = StructuredRecipeSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, issues: describeIssues(parsed.error) };

  const issues: string[] = [];
  const ingredients = parsed.data.ingredients.map((ingredient, index) => {
    if (ingredient.suggested_unit === null) return ingredient;
    const unit = METRIC_UNITS.find((u) => u === ingredient.suggested_unit?.toLowerCase());
    if (unit) return { ...ingredient, suggested_unit: unit };
    issues.push(`ingredients.${index}.suggested_unit: must be one of ${METRIC_UNITS.join(", ")}`);
    return ingredient;
  });
  if (issues.length > 0) return { ok: false, issues };

  const recipe: StructuredRecipe = { ...parsed.data, ingredients };
  const uncertain = new Set(recipe.uncertain_fields.filter((p) => resolvePointer(recipe, p)));

  const source = normalizeTranscript(sourceText);
  const autoFlagged: string[] = [];
  recipe.ingredients.forEach((ingredient, index) => {
    if (source.includes(normalizeTranscript(ingredient.original_text))) return;
    const pointer = `/ingredients/${index}/original_text`;
    if (!uncertain.has(pointer)) autoFlagged.push(pointer);
    uncertain.add(pointer);
  });

  return { ok: true, recipe: { ...recipe, uncertain_fields: [...uncertain] }, autoFlagged };
}

/** True when the RFC 6901 JSON pointer names an existing value in `document`. */
export function resolvePointer(document: unknown, pointer: string): boolean {
  let current = document;
  for (const segment of pointer.slice(1).split("/")) {
    const key = segment.replaceAll("~1", "/").replaceAll("~0", "~");
    if (Array.isArray(current)) {
      if (!/^(0|[1-9]\d*)$/.test(key) || Number(key) >= current.length) return false;
      current = current[Number(key)];
    } else if (typeof current === "object" && current !== null) {
      if (!Object.hasOwn(current, key)) return false;
      current = (current as Record<string, unknown>)[key];
    } else {
      return false;
    }
  }
  return true;
}
