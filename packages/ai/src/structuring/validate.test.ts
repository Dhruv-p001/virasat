import { describe, expect, it } from "vitest";
import { SAMPLE_TRANSCRIPT, sampleRecipe } from "./testing.ts";
import { resolvePointer, validateRecipe } from "./validate.ts";

function firstIngredient(recipe: ReturnType<typeof sampleRecipe>) {
  const ingredient = recipe.ingredients[0];
  if (!ingredient) throw new Error("fixture has no ingredient");
  return ingredient;
}

describe("validateRecipe", () => {
  it("accepts a valid recipe unchanged", () => {
    const outcome = validateRecipe(sampleRecipe(), SAMPLE_TRANSCRIPT);
    expect(outcome).toEqual({ ok: true, recipe: sampleRecipe(), autoFlagged: [] });
  });

  it("rejects output that breaks the Zod contract and names the path", () => {
    const outcome = validateRecipe({ ...sampleRecipe(), title: "" }, SAMPLE_TRANSCRIPT);
    expect(outcome.ok).toBe(false);
    if (!outcome.ok) expect(outcome.issues.join()).toContain("title");
  });

  it("rejects non-objects", () => {
    expect(validateRecipe(undefined, SAMPLE_TRANSCRIPT).ok).toBe(false);
    expect(validateRecipe("a recipe", SAMPLE_TRANSCRIPT).ok).toBe(false);
  });

  it("rejects a non-metric suggested unit without echoing its value", () => {
    const recipe = sampleRecipe();
    firstIngredient(recipe).suggested_unit = "cup";
    const outcome = validateRecipe(recipe, SAMPLE_TRANSCRIPT);
    expect(outcome.ok).toBe(false);
    if (!outcome.ok) {
      expect(outcome.issues[0]).toContain("ingredients.0.suggested_unit");
      expect(outcome.issues.join()).not.toContain("cup");
    }
  });

  it("canonicalises unit case", () => {
    const recipe = sampleRecipe();
    firstIngredient(recipe).suggested_unit = "G";
    const outcome = validateRecipe(recipe, SAMPLE_TRANSCRIPT);
    expect(outcome.ok && outcome.recipe.ingredients[0]?.suggested_unit).toBe("g");
  });

  it("drops uncertain pointers that point at nothing", () => {
    const outcome = validateRecipe(
      sampleRecipe({
        uncertain_fields: ["/ingredients/0/name", "/ingredients/9/name", "/nonsense"],
      }),
      SAMPLE_TRANSCRIPT,
    );
    expect(outcome.ok && outcome.recipe.uncertain_fields).toEqual(["/ingredients/0/name"]);
  });

  it("flags an original_text that is not in the source", () => {
    const recipe = sampleRecipe();
    const second = recipe.ingredients[1];
    if (!second) throw new Error("fixture");
    second.original_text = "a pinch of salt";
    const outcome = validateRecipe(recipe, SAMPLE_TRANSCRIPT);
    expect(outcome.ok && outcome.autoFlagged).toEqual(["/ingredients/1/original_text"]);
    expect(outcome.ok && outcome.recipe.uncertain_fields).toContain("/ingredients/1/original_text");
  });

  it("does not report a pointer the model already flagged as auto-flagged", () => {
    const recipe = sampleRecipe({ uncertain_fields: ["/ingredients/1/original_text"] });
    const second = recipe.ingredients[1];
    if (!second) throw new Error("fixture");
    second.original_text = "a pinch of salt";
    const outcome = validateRecipe(recipe, SAMPLE_TRANSCRIPT);
    expect(outcome.ok && outcome.autoFlagged).toEqual([]);
    expect(outcome.ok && outcome.recipe.uncertain_fields).toEqual(["/ingredients/1/original_text"]);
  });

  it("matches original_text ignoring case, punctuation and Indic digits", () => {
    const recipe = sampleRecipe({ uncertain_fields: [] });
    recipe.ingredients.length = 1;
    recipe.steps = [];
    firstIngredient(recipe).original_text = "2 મુઠ્ઠી બેસન";
    const outcome = validateRecipe(recipe, "૨ મુઠ્ઠી બેસન, થોડું મીઠું।");
    expect(outcome.ok && outcome.autoFlagged).toEqual([]);
  });
});

describe("resolvePointer", () => {
  const doc = { a: [{ "b/c": 1 }], d: null };

  it.each([
    ["/a", true],
    ["/a/0", true],
    ["/a/0/b~1c", true],
    ["/d", true],
    ["/a/1", false],
    ["/a/-1", false],
    ["/a/01", false],
    ["/a/0/x", false],
    ["/d/x", false],
    ["/e", false],
  ])("%s -> %s", (pointer, expected) => {
    expect(resolvePointer(doc, pointer)).toBe(expected);
  });
});

describe("invention checks", () => {
  it("matches original_text on whole words, not substrings", () => {
    const recipe = sampleRecipe({ uncertain_fields: [] });
    const second = recipe.ingredients[1];
    if (!second) throw new Error("fixture");
    second.original_text = "mith";
    const outcome = validateRecipe(recipe, SAMPLE_TRANSCRIPT);
    expect(outcome.ok && outcome.autoFlagged).toEqual(["/ingredients/1/original_text"]);
  });

  it("does not match across a missing word", () => {
    const recipe = sampleRecipe({ uncertain_fields: [] });
    firstIngredient(recipe).original_text = "mutthi besan";
    const outcome = validateRecipe(recipe, SAMPLE_TRANSCRIPT);
    expect(outcome.ok && outcome.autoFlagged).toEqual(["/ingredients/0/original_text"]);
  });

  it("flags a step whose words mostly do not appear in the source", () => {
    const recipe = sampleRecipe({ uncertain_fields: [] });
    recipe.steps = [
      { text: "besan ne tel ma sekvo" },
      { text: "garnish with coriander and serve hot" },
    ];
    const outcome = validateRecipe(recipe, SAMPLE_TRANSCRIPT);
    expect(outcome.ok && outcome.autoFlagged).toEqual(["/steps/1/text"]);
    expect(outcome.ok && outcome.recipe.uncertain_fields).toEqual(["/steps/1/text"]);
  });

  it("accepts a lightly tidied step that keeps most of the speaker's words", () => {
    const recipe = sampleRecipe({ uncertain_fields: [] });
    recipe.steps = [{ text: "Besan ne tel ma sekvo, pachi mithu nakho." }];
    const outcome = validateRecipe(recipe, SAMPLE_TRANSCRIPT);
    expect(outcome.ok && outcome.autoFlagged).toEqual([]);
  });

  it("flags a step translated into another script", () => {
    const recipe = sampleRecipe({ uncertain_fields: [] });
    recipe.steps = [{ text: "બેસન ને તેલમાં શેકવું" }];
    const outcome = validateRecipe(recipe, SAMPLE_TRANSCRIPT);
    expect(outcome.ok && outcome.autoFlagged).toEqual(["/steps/0/text"]);
  });

  it("flags an ingredient or step that is only punctuation", () => {
    const recipe = sampleRecipe({ uncertain_fields: [] });
    recipe.steps = [{ text: "..." }];
    const outcome = validateRecipe(recipe, SAMPLE_TRANSCRIPT);
    expect(outcome.ok && outcome.autoFlagged).toEqual(["/steps/0/text"]);
  });
});
