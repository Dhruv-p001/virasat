import { describe, expect, it } from "vitest";
import { ClaudeRecipeStructurer } from "../../src/structuring/claude/structurer.ts";
import { ScriptedModelClient } from "../../src/structuring/testing.ts";
import { StructureCaseSchema, loadCases } from "./cases.ts";
import { runStructureEval, summarise, toMarkdown } from "./runner.ts";

describe("structuring eval cases", () => {
  const cases = loadCases();

  it("has the committed synthetic set, and every case parses", () => {
    expect(cases.length).toBeGreaterThanOrEqual(6);
    expect(new Set(cases.map((c) => c.id)).size).toBe(cases.length);
    const languages = new Set(cases.map((c) => c.expected.language));
    expect(languages).toEqual(new Set(["gu", "hi", "en"]));
  });

  it("scores perfectly when the mock returns each case's own answer", async () => {
    const rows = await runStructureEval(
      cases,
      (c) => new ClaudeRecipeStructurer(new ScriptedModelClient([c.expected])),
    );
    const summary = summarise(rows);
    expect(summary).toMatchObject({
      cases: cases.length,
      needsManualEntry: 0,
      inventedItems: 0,
      ingredientRecall: 1,
      originalTextPreserved: 1,
      uncertainRecall: 1,
      uncertainPrecision: 1,
    });
    expect(toMarkdown(rows, summary, "mock")).toContain("gu-thepla");
  });

  it("includes a case where the model must not invent and one where it must flag", () => {
    expect(cases.some((c) => c.expected.ingredients.length === 0 && c.forbidden.length > 0)).toBe(
      true,
    );
    expect(cases.some((c) => c.expected.uncertain_fields.length > 0)).toBe(true);
  });
});

describe("StructureCaseSchema", () => {
  it("rejects an answer key whose original_text is not in the transcript", () => {
    const [first] = loadCases();
    if (!first) throw new Error("no cases");
    const broken = {
      ...first,
      transcript: "completely different words",
    };
    expect(StructureCaseSchema.safeParse(broken).success).toBe(false);
  });

  it("rejects a forbidden word that is in the transcript", () => {
    const [first] = loadCases();
    if (!first) throw new Error("no cases");
    const word = first.expected.ingredients[0]?.original_text ?? "x";
    expect(StructureCaseSchema.safeParse({ ...first, forbidden: [word] }).success).toBe(false);
  });
});
