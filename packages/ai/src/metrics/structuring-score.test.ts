import type { StructuredRecipe } from "@virasat/core";
import { describe, expect, it } from "vitest";
import { SAMPLE_TRANSCRIPT, sampleRecipe } from "../structuring/testing.ts";
import { scoreStructuring } from "./structuring-score.ts";

function score(actual: StructuredRecipe, forbidden: string[] = ["namak"]) {
  return scoreStructuring({
    transcript: SAMPLE_TRANSCRIPT,
    expected: sampleRecipe(),
    forbidden,
    actual,
  });
}

describe("scoreStructuring", () => {
  it("scores a perfect answer perfectly", () => {
    expect(score(sampleRecipe())).toEqual({
      ingredientRecall: 1,
      inventedItems: 0,
      originalTextPreserved: 1,
      uncertainRecall: 1,
      uncertainPrecision: 1,
    });
  });

  it("counts missed ingredients against recall", () => {
    const actual = sampleRecipe();
    actual.ingredients.length = 1;
    expect(score(actual).ingredientRecall).toBe(0.5);
  });

  it("counts an ingredient that is neither expected nor in the transcript as invented", () => {
    const actual = sampleRecipe();
    actual.ingredients.push({
      original_text: "ek chutki hing",
      name: "hing",
      suggested_quantity: null,
      suggested_unit: null,
      confidence: null,
      note: null,
    });
    const result = score(actual);
    expect(result.inventedItems).toBe(1);
    expect(result.originalTextPreserved).toBeCloseTo(2 / 3);
  });

  it("counts forbidden words anywhere in the output, once each", () => {
    const actual = sampleRecipe();
    actual.steps.push({ text: "Namak nakho" });
    actual.tips.push("namak ochhu rakho");
    expect(score(actual).inventedItems).toBe(1);
  });

  it("does not call a reworded but expected ingredient invented, and shows it as not preserved", () => {
    const actual = sampleRecipe();
    const first = actual.ingredients[0];
    if (first) first.original_text = "mutthi bhar besan (a fistful of gram flour)";
    const result = score(actual);
    expect(result.inventedItems).toBe(0);
    expect(result.originalTextPreserved).toBe(0.5);
  });

  it("scores uncertain-field recall and precision, following ingredients by text not index", () => {
    const actual = sampleRecipe({
      ingredients: [...sampleRecipe().ingredients].reverse(),
      uncertain_fields: ["/ingredients/1/suggested_quantity", "/servings"],
    });
    const result = score(actual);
    expect(result.uncertainRecall).toBe(1);
    expect(result.uncertainPrecision).toBe(0.5);
  });

  it("treats a pointer to a whole ingredient as covering its fields", () => {
    const actual = sampleRecipe({ uncertain_fields: ["/ingredients/0"] });
    expect(score(actual).uncertainRecall).toBe(1);
  });

  it("misses an expected flag when the output dropped that ingredient", () => {
    const actual = sampleRecipe({ uncertain_fields: [] });
    actual.ingredients.shift();
    expect(score(actual).uncertainRecall).toBe(0);
  });

  it("returns null where a ratio has nothing to divide by", () => {
    const empty = sampleRecipe({ ingredients: [], steps: [], uncertain_fields: [] });
    expect(
      scoreStructuring({ transcript: "x", expected: empty, forbidden: [], actual: empty }),
    ).toEqual({
      ingredientRecall: null,
      inventedItems: 0,
      originalTextPreserved: null,
      uncertainRecall: null,
      uncertainPrecision: null,
    });
  });
});
