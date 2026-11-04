import type { Language, StructuredRecipe } from "@virasat/core";

/** Who is speaking or whose handwriting it is. Shown to the model as context, never as an instruction. */
export interface Speaker {
  name: string;
  /** Free text like "Ba" or "Nani". */
  relation: string | null;
}

export interface StructureInput {
  transcript: string;
  /** Language of the transcript when known. Null lets the model decide. */
  language: Language | null;
  speaker: Speaker;
}

export type ImageMimeType = "image/jpeg" | "image/png" | "image/webp" | "image/gif";

export interface HandwritingImage {
  data: Uint8Array;
  mimeType: ImageMimeType;
}

export interface HandwritingInput {
  /** Pages in reading order. Callers pass a derived (downscaled) copy, never overwrite the original scan. */
  images: HandwritingImage[];
  language: Language | null;
  speaker: Speaker;
}

/** Tokens and model for one result, summed over every call including retries. No recipe content. */
export interface StructuringUsage {
  model: string;
  calls: number;
  inputTokens: number;
  outputTokens: number;
}

export interface RecipeDraft {
  status: "ok";
  recipe: StructuredRecipe;
  /** What the recipe was built from: the transcript passed in, or the text read off the page. */
  transcript: string;
  /** Pointers added after parsing because the output could not be traced to the transcript. */
  autoFlagged: string[];
  usage: StructuringUsage;
  promptVersion: string;
}

/**
 * Why the AI gave up. Only `invalid_output` is retried. The others cannot improve on a second try:
 * - `empty_input`: nothing to read.
 * - `invalid_input`: the images failed pre-checks, so the API was never called.
 * - `truncated`: the answer hit the token limit, reasoning included.
 * - `refused`: a safety classifier declined. The category is in `issues`.
 * - `provider_error`: the API failed after the SDK's own retries.
 */
export type ManualEntryReason =
  "empty_input" | "invalid_input" | "invalid_output" | "truncated" | "refused" | "provider_error";

/** The AI could not produce a trustworthy recipe. The review screen offers manual entry, prefilled with `transcript`. */
export interface NeedsManualEntry {
  status: "needs_manual_entry";
  reason: ManualEntryReason;
  /** Never dropped. For handwriting, whatever text was read before the failure (may be empty). */
  transcript: string;
  /** Schema paths and rule names that failed. Contains no recipe content. */
  issues: string[];
  usage: StructuringUsage;
  promptVersion: string;
}

export type StructuringResult = RecipeDraft | NeedsManualEntry;

/** Turns a transcript into a structured recipe. Swapping the provider must not touch app code. */
export interface RecipeStructurer {
  readonly id: string;
  readonly model: string;
  structure(input: StructureInput): Promise<StructuringResult>;
}

/** Reads a photographed handwritten recipe page into the same output contract. */
export interface HandwritingReader {
  readonly id: string;
  readonly model: string;
  read(input: HandwritingInput): Promise<StructuringResult>;
}
