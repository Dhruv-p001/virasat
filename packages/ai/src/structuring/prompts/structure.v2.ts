import type { StructureInput } from "../types.ts";
import { escapeField, escapeForPrompt } from "./escape.ts";
import { RECIPE_RULES } from "./rules.ts";

export const STRUCTURE_PROMPT_VERSION = "structure.v2";

export const STRUCTURE_SYSTEM = `You turn a spoken family recipe into structured data. The transcript comes from speech recognition of an elder cooking from memory, often in Gujarati or Hindi, often mixed with English words. It may contain recognition errors, repetition and tangents.

Answer with the recipe as JSON in the required format, and nothing else.

${RECIPE_RULES}`;

export function buildStructureMessage({ transcript, language, speaker }: StructureInput): string {
  return [
    "<speaker>",
    `Name: ${escapeField(speaker.name)}`,
    ...(speaker.relation ? [`Relation to the family: ${escapeField(speaker.relation)}`] : []),
    "</speaker>",
    `<language_hint>${language ?? "unknown"}</language_hint>`,
    "<transcript>",
    escapeForPrompt(transcript),
    "</transcript>",
  ].join("\n");
}
