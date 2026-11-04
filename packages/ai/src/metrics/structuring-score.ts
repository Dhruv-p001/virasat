import type { StructuredRecipe } from "@virasat/core";
import { normalizeTranscript } from "./error-rate.ts";

export interface StructuringScoreInput {
  /** The text the recipe was built from. */
  transcript: string;
  /** Hand-checked answer. Its uncertain_fields say which parts a good structurer should flag. */
  expected: StructuredRecipe;
  /** Words that appear nowhere in the transcript. Any of them showing up in the output is an invention. */
  forbidden: string[];
  actual: StructuredRecipe;
}

export interface StructuringScore {
  /** Share of expected ingredients found in the output, matched on original_text. Null if none expected. */
  ingredientRecall: number | null;
  /**
   * Output ingredients that match no expected ingredient and are not in the transcript, plus
   * forbidden words found anywhere in the ingredients, steps or tips. Zero is the goal.
   */
  inventedItems: number;
  /** Share of output ingredients whose original_text appears verbatim in the transcript. Null if none output. */
  originalTextPreserved: number | null;
  /** Share of expected uncertain pointers the output also flagged. Null if none expected. */
  uncertainRecall: number | null;
  /** Share of flagged pointers that were expected. Null if the output flagged nothing. */
  uncertainPrecision: number | null;
}

function overlaps(a: string, b: string): boolean {
  const left = normalizeTranscript(a);
  const right = normalizeTranscript(b);
  return left !== "" && right !== "" && (left.includes(right) || right.includes(left));
}

function ratio(part: number, whole: number): number | null {
  return whole === 0 ? null : part / whole;
}

/** True when one pointer is the other or an ancestor of it ("/ingredients/2" covers ".../name"). */
function pointersMatch(a: string, b: string): boolean {
  return a === b || a.startsWith(`${b}/`) || b.startsWith(`${a}/`);
}

/** Rewrites an expected "/ingredients/i/..." pointer to the matching output index. Null when that ingredient is missing. */
function toActualSpace(
  pointer: string,
  expected: StructuredRecipe,
  actual: StructuredRecipe,
): string | null {
  const match = /^\/ingredients\/(\d+)(\/.*)?$/.exec(pointer);
  if (!match) return pointer;
  const wanted = expected.ingredients[Number(match[1])];
  if (!wanted) return null;
  const index = actual.ingredients.findIndex((i) =>
    overlaps(i.original_text, wanted.original_text),
  );
  return index === -1 ? null : `/ingredients/${index}${match[2] ?? ""}`;
}

export function scoreStructuring(input: StructuringScoreInput): StructuringScore {
  const { transcript, expected, actual, forbidden } = input;
  const source = normalizeTranscript(transcript);

  const found = expected.ingredients.filter((want) =>
    actual.ingredients.some((got) => overlaps(got.original_text, want.original_text)),
  );

  const unsupported = actual.ingredients.filter(
    (got) =>
      !expected.ingredients.some((want) => overlaps(got.original_text, want.original_text)) &&
      !source.includes(normalizeTranscript(got.original_text)),
  );
  const output = normalizeTranscript(
    [
      ...actual.ingredients.flatMap((i) => [i.original_text, i.name ?? ""]),
      ...actual.steps.map((s) => s.text),
      ...actual.tips,
    ].join(" "),
  );
  const forbiddenHits = forbidden.filter((word) => output.includes(normalizeTranscript(word)));

  const verbatim = actual.ingredients.filter((got) =>
    source.includes(normalizeTranscript(got.original_text)),
  );

  const wanted = expected.uncertain_fields.map((p) => toActualSpace(p, expected, actual));
  const recalled = wanted.filter(
    (p) => p !== null && actual.uncertain_fields.some((q) => pointersMatch(p, q)),
  );
  const flaggedAsExpected = actual.uncertain_fields.filter((q) =>
    wanted.some((p) => p !== null && pointersMatch(p, q)),
  );

  return {
    ingredientRecall: ratio(found.length, expected.ingredients.length),
    inventedItems: unsupported.length + forbiddenHits.length,
    originalTextPreserved: ratio(verbatim.length, actual.ingredients.length),
    uncertainRecall: ratio(recalled.length, expected.uncertain_fields.length),
    uncertainPrecision: ratio(flaggedAsExpected.length, actual.uncertain_fields.length),
  };
}
