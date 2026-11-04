import type { StructureInput } from "../types.ts";
import { RECIPE_RULES } from "./rules.ts";

export const STRUCTURE_PROMPT_VERSION = "structure.v1";

export const STRUCTURE_TOOL = {
  name: "record_recipe",
  description: "Record the recipe exactly as the speaker described it.",
} as const;

export const STRUCTURE_SYSTEM = `You turn a spoken family recipe into structured data. The transcript comes from speech recognition of an elder cooking from memory, often in Gujarati or Hindi, often mixed with English words. It may contain recognition errors, repetition and tangents.

Call the record_recipe tool with the recipe. Do not answer in any other way.

${RECIPE_RULES}`;

export function buildStructureMessage({ transcript, language, speaker }: StructureInput): string {
  return [
    "<speaker>",
    `Name: ${speaker.name}`,
    ...(speaker.relation ? [`Relation to the family: ${speaker.relation}`] : []),
    "</speaker>",
    `<language_hint>${language ?? "unknown"}</language_hint>`,
    "<transcript>",
    transcript,
    "</transcript>",
  ].join("\n");
}
