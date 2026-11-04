import type { HandwritingInput } from "../types.ts";
import { RECIPE_RULES } from "./rules.ts";

export const HANDWRITING_PROMPT_VERSION = "handwriting.v1";

export const HANDWRITING_TOOL = {
  name: "record_recipe",
  description:
    "Record the handwritten recipe: first the text as written, then the structured recipe.",
} as const;

export const HANDWRITING_SYSTEM = `You read photographed pages of a handwritten family recipe, often a diary or notebook page in Gujarati, Hindi or English, possibly with stains, shadows, margin notes and crossed-out words.

Call the record_recipe tool. Do not answer in any other way. It takes two fields:
- "transcript": everything written on the pages, transcribed faithfully in the original language and script, in reading order, pages in the order given. Write [illegible] for words you cannot read. Never guess a word to fill a gap. Leave out crossed-out text unless the correction is unclear.
- "recipe": the structured recipe built only from that transcript.

Every "original_text" must be copied from your transcript, so it must match the page.

${RECIPE_RULES}

Handwriting extras: flag the pointer of anything that includes or sits next to an [illegible] word, and flag anything where two readings are possible. Notes in the margin that are advice go in "tips". Notes that are memories go in "story".`;

export function buildHandwritingMessage({ language, speaker }: HandwritingInput): string {
  return [
    "<writer>",
    `Name: ${speaker.name}`,
    ...(speaker.relation ? [`Relation to the family: ${speaker.relation}`] : []),
    "</writer>",
    `<language_hint>${language ?? "unknown"}</language_hint>`,
    "The recipe pages are attached as images.",
  ].join("\n");
}
