import { describe, expect, it } from "vitest";
import { fieldErrors } from "./forms.ts";
import { MomentInputSchema, TypedRecipeInputSchema, typedRecipeContent } from "./moments.ts";
import { StructuredRecipeSchema } from "./recipe.ts";

describe("MomentInputSchema", () => {
  it("accepts a bare 'I cooked it'", () => {
    expect(MomentInputSchema.parse({ cookedOn: "2026-11-01" })).toEqual({
      note: null,
      rating: null,
      cookedOn: "2026-11-01",
    });
  });

  it("reads a rating from a form field", () => {
    expect(
      MomentInputSchema.parse({ cookedOn: "2026-11-01", rating: "4", note: " Good " }),
    ).toEqual({
      note: "Good",
      rating: 4,
      cookedOn: "2026-11-01",
    });
  });

  it.each([
    ["rating", { cookedOn: "2026-11-01", rating: "6" }],
    ["cookedOn", { cookedOn: "2999-01-01" }],
    ["cookedOn", { cookedOn: "1/11/2026" }],
  ])("rejects a bad %s", (field, input) => {
    const result = MomentInputSchema.safeParse(input);
    expect(result.success).toBe(false);
    if (!result.success) expect(Object.keys(fieldErrors(result.error))).toContain(field);
  });
});

describe("typed recipes", () => {
  const input = TypedRecipeInputSchema.parse({
    title: " Ba's khichdi ",
    ingredients: "1. ek vaati chokha\n- adhi vaati mag ni dal\n\n• mithu swad pramane",
    steps: "Wash the rice and dal\r\nCook with four cups of water",
    story: "",
  });

  it("keeps each ingredient line exactly as typed, minus list markers", () => {
    expect(input.ingredients).toEqual([
      "ek vaati chokha",
      "adhi vaati mag ni dal",
      "mithu swad pramane",
    ]);
    expect(input.title).toBe("Ba's khichdi");
    expect(input.story).toBeNull();
  });

  it("needs at least one ingredient", () => {
    const result = TypedRecipeInputSchema.safeParse({
      title: "Tea",
      ingredients: " \n ",
      steps: "",
    });
    expect(result.success).toBe(false);
  });

  it("produces content the recipe contract accepts, with nothing guessed or flagged", () => {
    const content = typedRecipeContent(input, "gu");
    expect(StructuredRecipeSchema.parse(content)).toEqual(content);
    expect(content.ingredients.every((i) => i.suggested_quantity === null && i.name === null)).toBe(
      true,
    );
    expect(content.uncertain_fields).toEqual([]);
    expect(content.steps).toHaveLength(2);
  });
});
