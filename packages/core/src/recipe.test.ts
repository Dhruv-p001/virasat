import { describe, expect, it } from "vitest";
import { IngredientSchema, StructuredRecipeSchema, suggestionLine } from "./recipe.ts";

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

describe("suggestionLine", () => {
  it("shows the suggested amount, unit and name beside the words", () => {
    expect(suggestionLine(ingredient, "en")).toBe("≈ 30 g besan");
    expect(
      suggestionLine({ ...ingredient, suggested_quantity: 1.5, suggested_unit: null }, "en"),
    ).toBe("≈ 1.5 besan");
  });

  it("formats the number for the viewer's language", () => {
    expect(suggestionLine({ ...ingredient, suggested_quantity: 1500 }, "en")).toBe(
      "≈ 1,500 g besan",
    );
    expect(suggestionLine({ ...ingredient, suggested_quantity: 1500 }, "hi")).toContain("1,500");
  });

  it("says nothing when no quantity was suggested", () => {
    expect(suggestionLine({ ...ingredient, suggested_quantity: null }, "en")).toBeNull();
  });

  it("leaves the name off when there is none", () => {
    expect(suggestionLine({ ...ingredient, name: null }, "en")).toBe("≈ 30 g");
  });
});
