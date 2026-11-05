import { describe, expect, it } from "vitest";
import content from "./sample-vault.content.json" with { type: "json" };
import { sampleVault, SampleVaultSchema } from "./sample-vault.ts";

describe("sample vault", () => {
  it("content meets the contract", () => {
    expect(sampleVault.recipes.length).toBeGreaterThanOrEqual(3);
  });

  it("shows each kind of capture: voice, handwriting and typed", () => {
    expect(new Set(sampleVault.recipes.map((r) => r.source))).toEqual(
      new Set(["voice", "handwriting", "typed"]),
    );
  });

  it("keeps the cook's own words on every ingredient", () => {
    for (const recipe of sampleVault.recipes) {
      for (const ingredient of recipe.recipe.ingredients) {
        expect(ingredient.original_text.trim()).not.toBe("");
      }
    }
  });

  it("lists every referenced media file that still has to be produced", () => {
    const referenced = [
      ...sampleVault.people.map((p) => p.photo),
      ...sampleVault.recipes.flatMap((r) => [r.audio, r.scan, r.dishPhoto]),
      ...sampleVault.moments.map((m) => m.photo),
    ].filter((path): path is string => path !== null);
    const pending = new Set(sampleVault.pendingAssets.map((a) => a.path));
    expect(referenced.filter((path) => !pending.has(path))).toEqual([]);
  });

  it("rejects broken references", () => {
    const broken = structuredClone(content);
    broken.lineage = broken.lineage.map((entry) => ({
      ...entry,
      chain: [...entry.chain, "nobody"],
      messages: [...entry.messages, "Hello"],
    }));
    const result = SampleVaultSchema.safeParse(broken);
    expect(result.success).toBe(false);
  });
});
