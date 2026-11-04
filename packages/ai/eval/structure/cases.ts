import { readdirSync, readFileSync } from "node:fs";
import { LanguageSchema, StructuredRecipeSchema } from "@virasat/core";
import { z } from "zod";
import { normalizeTranscript } from "../../src/metrics/error-rate.ts";

/**
 * One transcript with its hand-checked answer. Synthetic cases live in cases/ (committed). Real
 * family transcripts go in data/ (gitignored) in the same format, with the family's consent.
 */
export const StructureCaseSchema = z
  .object({
    id: z.string().min(1),
    description: z.string().min(1),
    speaker: z.object({ name: z.string().min(1), relation: z.string().min(1).nullable() }),
    language: LanguageSchema.nullable(),
    transcript: z.string().min(1),
    /** The answer a good structurer gives. Its uncertain_fields are the parts it should flag. */
    expected: StructuredRecipeSchema,
    /** Words absent from the transcript. If one shows up in the output, the model invented it. */
    forbidden: z.array(z.string().min(1)),
  })
  .superRefine((value, ctx) => {
    // A broken answer key would make every score meaningless, so check it when loading.
    const source = normalizeTranscript(value.transcript);
    value.expected.ingredients.forEach((ingredient, index) => {
      if (!source.includes(normalizeTranscript(ingredient.original_text))) {
        ctx.addIssue({
          code: "custom",
          path: ["expected", "ingredients", index, "original_text"],
          message: "expected original_text is not verbatim in the transcript",
        });
      }
    });
    for (const word of value.forbidden) {
      if (source.includes(normalizeTranscript(word))) {
        ctx.addIssue({
          code: "custom",
          path: ["forbidden"],
          message: "a forbidden word appears in the transcript",
        });
      }
    }
  });
export type StructureCase = z.infer<typeof StructureCaseSchema>;

const folders = [new URL("./cases/", import.meta.url), new URL("./data/", import.meta.url)];

/** Loads every *.json case from cases/ and, when present, data/. */
export function loadCases(): StructureCase[] {
  return folders.flatMap((folder) => {
    let files: string[];
    try {
      files = readdirSync(folder).filter((file) => file.endsWith(".json"));
    } catch {
      return []; // data/ does not exist on a fresh clone
    }
    return files
      .sort()
      .map((file) =>
        StructureCaseSchema.parse(JSON.parse(readFileSync(new URL(file, folder), "utf8"))),
      );
  });
}
