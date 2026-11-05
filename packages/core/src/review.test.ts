import { describe, expect, it } from "vitest";
import {
  blankDraft,
  blankIngredient,
  contentFromDraft,
  draftFromRecipe,
  parseQuantity,
  reviewLanguage,
  type RecipeDraft,
} from "./review.ts";
import type { StructuredRecipe } from "./recipe.ts";

function first<T>(items: readonly T[]): T {
  const item = items[0];
  if (item === undefined) throw new Error("expected at least one item");
  return item;
}

const recipe = (overrides: Partial<StructuredRecipe> = {}): StructuredRecipe => ({
  title: "Besan na poda",
  servings: null,
  ingredients: [
    {
      original_text: "mutthi bhar besan",
      name: "besan",
      suggested_quantity: 30,
      suggested_unit: "g",
      confidence: 0.3,
      note: null,
    },
    {
      original_text: "thodu mithu",
      name: "mithu",
      suggested_quantity: null,
      suggested_unit: null,
      confidence: null,
      note: null,
    },
  ],
  steps: [{ text: "besan ne tel ma sekvo" }, { text: "thandu karo" }],
  tips: ["dhimi aanch par"],
  story: "Ba made it every Diwali.",
  language: "gu",
  uncertain_fields: [],
  ...overrides,
});

function confirmed(draft: RecipeDraft) {
  const result = contentFromDraft(draft);
  if (!result.ok) throw new Error(`not confirmed: ${JSON.stringify(result.errors)}`);
  return result.content;
}

describe("draftFromRecipe", () => {
  it("fills the form from the draft, keeping the speaker's words", () => {
    const draft = draftFromRecipe(recipe());
    expect(draft.title).toBe("Besan na poda");
    expect(draft.servings).toBe("");
    expect(draft.language).toBe("gu");
    expect(draft.ingredients[0]).toMatchObject({
      originalText: "mutthi bhar besan",
      name: "besan",
      quantity: "30",
      unit: "g",
      confidence: 0.3,
    });
    expect(draft.ingredients[1]).toMatchObject({ quantity: "", unit: "", note: "" });
    expect(draft.steps.map((step) => step.text)).toEqual(["besan ne tel ma sekvo", "thandu karo"]);
    expect(draft.tips[0]?.text).toBe("dhimi aanch par");
    expect(draft.story).toBe("Ba made it every Diwali.");
  });

  it("marks what the draft was unsure about, and nothing else", () => {
    const draft = draftFromRecipe(
      recipe({
        uncertain_fields: ["/ingredients/0/suggested_quantity", "/title", "/steps/1/text"],
      }),
      ["/ingredients/1/name"],
    );
    expect(draft.titleFlagged).toBe(true);
    expect(draft.servingsFlagged).toBe(false);
    expect(draft.ingredients[0]?.flags).toEqual(["quantity"]);
    expect(draft.ingredients[1]?.flags).toEqual(["name"]);
    expect(draft.steps.map((step) => step.flagged)).toEqual([false, true]);
    expect(draft.storyFlagged).toBe(false);
  });

  it("a pointer at a whole row flags all of it", () => {
    const draft = draftFromRecipe(recipe({ uncertain_fields: ["/ingredients/1", "/steps/0"] }));
    expect(draft.ingredients[1]?.flags).toEqual([
      "original_text",
      "name",
      "quantity",
      "unit",
      "note",
    ]);
    expect(draft.ingredients[0]?.flags).toEqual([]);
    expect(draft.steps[0]?.flagged).toBe(true);
  });

  it("keeps a flag with its row when rows are removed", () => {
    const draft = draftFromRecipe(recipe({ uncertain_fields: ["/ingredients/1/name"] }));
    const [first, second] = draft.ingredients;
    expect(second?.flags).toEqual(["name"]);
    draft.ingredients = draft.ingredients.slice(1);
    expect(draft.ingredients[0]?.flags).toEqual(["name"]);
    expect(first?.flags).toEqual([]);
  });
});

describe("contentFromDraft", () => {
  it("builds what is confirmed, with nothing left uncertain", () => {
    const content = confirmed(draftFromRecipe(recipe({ uncertain_fields: ["/title"] })));
    expect(content).toMatchObject({
      title: "Besan na poda",
      servings: null,
      language: "gu",
      uncertain_fields: [],
      story: "Ba made it every Diwali.",
      tips: ["dhimi aanch par"],
    });
    expect(content.ingredients[0]).toEqual({
      original_text: "mutthi bhar besan",
      name: "besan",
      suggested_quantity: 30,
      suggested_unit: "g",
      confidence: 0.3,
      note: null,
    });
    expect(content.ingredients[1]?.suggested_quantity).toBeNull();
  });

  it("keeps edits, trims, and turns blanks into nulls", () => {
    const draft = draftFromRecipe(recipe());
    draft.title = "  Besan poda  ";
    draft.servings = "4";
    draft.story = "   ";
    first(draft.ingredients).quantity = "1,5";
    const content = confirmed(draft);
    expect(content.title).toBe("Besan poda");
    expect(content.servings).toBe(4);
    expect(content.story).toBeNull();
    expect(content.ingredients[0]?.suggested_quantity).toBe(1.5);
  });

  it("drops the confidence when there is no suggested quantity left", () => {
    const draft = draftFromRecipe(recipe());
    first(draft.ingredients).quantity = "";
    expect(confirmed(draft).ingredients[0]?.confidence).toBeNull();
  });

  it("ignores empty rows instead of complaining", () => {
    const draft = draftFromRecipe(recipe());
    draft.ingredients.push(blankIngredient());
    draft.steps.push({ key: "x", text: "  ", flagged: false });
    draft.tips.push({ key: "y", text: "", flagged: false });
    const content = confirmed(draft);
    expect(content.ingredients).toHaveLength(2);
    expect(content.steps).toHaveLength(2);
    expect(content.tips).toHaveLength(1);
  });

  it("requires a title, one ingredient with its original words, and one step", () => {
    const empty = contentFromDraft(blankDraft("gu"));
    expect(empty).toMatchObject({ ok: false });
    if (!empty.ok) {
      expect(empty.errors).toMatchObject({
        title: "titleRequired",
        ingredients: "ingredientsRequired",
        steps: "stepsRequired",
      });
    }

    const draft = draftFromRecipe(recipe());
    first(draft.ingredients).originalText = "  ";
    const result = contentFromDraft(draft);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors[`ingredient.${first(draft.ingredients).key}.originalText`]).toBe(
        "originalRequired",
      );
    }
  });

  it("refuses a quantity or servings that is not a number", () => {
    const draft = draftFromRecipe(recipe());
    draft.servings = "two";
    first(draft.ingredients).quantity = "a fistful";
    const result = contentFromDraft(draft);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors["servings"]).toBe("servingsInvalid");
      expect(result.errors[`ingredient.${first(draft.ingredients).key}.quantity`]).toBe(
        "quantityInvalid",
      );
    }
  });

  it("works for a recipe typed in by hand", () => {
    const draft = blankDraft("hi");
    draft.title = "Dal";
    first(draft.ingredients).originalText = "ek katori dal";
    first(draft.steps).text = "dal ubalo";
    const content = confirmed(draft);
    expect(content).toMatchObject({ title: "Dal", language: "hi", tips: [], story: null });
    expect(content.ingredients[0]).toMatchObject({ original_text: "ek katori dal", name: null });
  });
});

describe("parseQuantity", () => {
  it("reads decimals with a point or a comma", () => {
    expect(parseQuantity("2")).toBe(2);
    expect(parseQuantity("0.5")).toBe(0.5);
    expect(parseQuantity(" 1,5 ")).toBe(1.5);
  });

  it("refuses everything that is not a positive number", () => {
    for (const bad of ["", "0", "-1", "1/2", "abc", "1e3", "1.", ".5"]) {
      expect(parseQuantity(bad)).toBeNull();
    }
  });
});

describe("reviewLanguage", () => {
  it("prefers the detected language, then the fallback, then English", () => {
    expect(reviewLanguage("gu-IN", "hi")).toBe("gu");
    expect(reviewLanguage(null, "hi")).toBe("hi");
    expect(reviewLanguage("ta-IN", null)).toBe("en");
  });
});
