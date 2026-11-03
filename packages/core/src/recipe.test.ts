import { describe, expect, it } from "vitest";
import { IngredientSchema, StructuredRecipeSchema } from "./recipe.ts";

const ingredient = {
  original_text: "mutthi bhar besan",
  name: "besan",
  suggested_quantity: 30,
  suggested_unit: "g",
  confidence: 0.6,
  note: null,
};

describe("IngredientSchema", () => {
  it("accepts an andaaz measure with a suggested quantity beside it", () => {
    expect(IngredientSchema.parse(ingredient)).toEqual(ingredient);
  });

  it("rejects an ingredient without the speaker's original words", () => {
    expect(IngredientSchema.safeParse({ ...ingredient, original_text: "  " }).success).toBe(false);
    const { original_text: _omitted, ...rest } = ingredient;
    expect(IngredientSchema.safeParse(rest).success).toBe(false);
  });

  it("allows every suggestion to be null when the AI cannot estimate", () => {
    const bare = {
      original_text: "tel jarur pramane",
      name: null,
      suggested_quantity: null,
      suggested_unit: null,
      confidence: null,
      note: null,
    };
    expect(IngredientSchema.safeParse(bare).success).toBe(true);
  });
});

describe("StructuredRecipeSchema", () => {
  const recipe = {
    title: "Methi na thepla",
    servings: null,
    ingredients: [ingredient],
    steps: [{ text: "Mix the besan with methi." }],
    tips: [],
    story: "Ba made these for every train journey.",
    language: "gu",
    uncertain_fields: ["/ingredients/0/suggested_quantity"],
  };

  it("accepts a valid structurer output", () => {
    expect(StructuredRecipeSchema.safeParse(recipe).success).toBe(true);
  });

  it("rejects unsupported languages and malformed uncertain paths", () => {
    expect(StructuredRecipeSchema.safeParse({ ...recipe, language: "ta" }).success).toBe(false);
    expect(
      StructuredRecipeSchema.safeParse({ ...recipe, uncertain_fields: ["ingredients.0"] }).success,
    ).toBe(false);
  });
});
