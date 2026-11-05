import { z } from "zod";
import content from "./sample-vault.content.json" with { type: "json" };
import { StructuredRecipeSchema } from "./recipe.ts";

// The sample vault (plan Phase 2.5, item 2): a filled example family anyone can explore before
// signing up. Static content shipped with the app, never a database family, so it can't read
// from or leak into real vaults. The Design chat renders it; this file is the contract.
// UI framing strings live in i18n under `sample.*`. Recipe content stays in the family's own
// words, as a real vault would.

const slug = z.string().regex(/^[a-z0-9-]+$/);
/** Files served from apps/web/public/sample/. */
const assetPath = z.string().regex(/^\/sample\/[a-z0-9/._-]+$/);

export const SamplePersonSchema = z.object({
  slug,
  displayName: z.string().min(1),
  relationLabel: z.string().min(1),
  birthYear: z.number().int().min(1900).nullable(),
  photo: assetPath.nullable(),
  about: z.string().min(1),
});

export const SampleRecipeSchema = z.object({
  slug,
  originPerson: slug,
  source: z.enum(["voice", "handwriting", "typed"]),
  /** Original recording or diary page, shown beside the recipe. */
  audio: assetPath.nullable(),
  audioSeconds: z.number().int().positive().nullable(),
  scan: assetPath.nullable(),
  dishPhoto: assetPath.nullable(),
  recipe: StructuredRecipeSchema,
});

export const SampleLineageSchema = z.object({
  recipe: slug,
  /** Who it passed through, oldest first, e.g. ["ba", "mom", "you"]. */
  chain: z.array(slug).min(2),
  messages: z.array(z.string().min(1)),
});

export const SampleMomentSchema = z.object({
  recipe: slug,
  author: slug,
  cookedOn: z.iso.date(),
  note: z.string().min(1).nullable(),
  rating: z.number().int().min(1).max(5).nullable(),
  photo: assetPath.nullable(),
});

export const SampleVaultSchema = z
  .object({
    familyName: z.string().min(1),
    /** The visitor's own place in the family: shown as "you" in lineage and moments. */
    viewer: SamplePersonSchema,
    people: z.array(SamplePersonSchema).min(1),
    recipes: z.array(SampleRecipeSchema).min(1),
    lineage: z.array(SampleLineageSchema),
    moments: z.array(SampleMomentSchema),
    /** Media still to be produced. Each needs real, consented material before launch. */
    pendingAssets: z.array(z.object({ path: assetPath, description: z.string().min(1) })),
  })
  .superRefine((vault, ctx) => {
    const people = new Set([vault.viewer.slug, ...vault.people.map((p) => p.slug)]);
    const recipes = new Set(vault.recipes.map((r) => r.slug));
    const check = (ok: boolean, message: string, path: (string | number)[]) => {
      if (!ok) ctx.addIssue({ code: "custom", message, path });
    };
    vault.recipes.forEach((r, i) => {
      check(people.has(r.originPerson), `Unknown person ${r.originPerson}`, [
        "recipes",
        i,
        "originPerson",
      ]);
      check(r.source !== "voice" || r.audio !== null, "Voice recipes need audio", [
        "recipes",
        i,
        "audio",
      ]);
      check(r.source !== "handwriting" || r.scan !== null, "Handwritten recipes need a scan", [
        "recipes",
        i,
        "scan",
      ]);
    });
    vault.lineage.forEach((l, i) => {
      check(recipes.has(l.recipe), `Unknown recipe ${l.recipe}`, ["lineage", i, "recipe"]);
      l.chain.forEach((p, j) => {
        check(people.has(p), `Unknown person ${p}`, ["lineage", i, "chain", j]);
      });
      check(l.messages.length === l.chain.length - 1, "One message per handover", [
        "lineage",
        i,
        "messages",
      ]);
    });
    vault.moments.forEach((m, i) => {
      check(recipes.has(m.recipe), `Unknown recipe ${m.recipe}`, ["moments", i, "recipe"]);
      check(people.has(m.author), `Unknown person ${m.author}`, ["moments", i, "author"]);
    });
  });

export type SampleVault = z.infer<typeof SampleVaultSchema>;

/** The validated sample vault content. Throws at import time if the content breaks the contract. */
export const sampleVault: SampleVault = SampleVaultSchema.parse(content);
