import {
  DEFAULT_MAX_ATTEMPTS,
  HandwritingOutputSchema,
  rejectedInput,
  runTask,
} from "../engine.ts";
import { validateImages } from "../images.ts";
import type { ModelClient } from "../model-client.ts";
import {
  HANDWRITING_PROMPT_VERSION,
  HANDWRITING_SYSTEM,
  buildHandwritingMessage,
} from "../prompts/handwriting.v2.ts";
import type { HandwritingInput, HandwritingReader, StructuringResult } from "../types.ts";

/** Transcript and recipe plus adaptive thinking, all against max_tokens. Kept under the SDK's non-streaming limit. */
const MAX_TOKENS = 20_000;

/** The transcript from an answer that failed validation, so the text read is never thrown away. */
function transcriptOf(raw: unknown): string | null {
  if (typeof raw !== "object" || raw === null) return null;
  const transcript = (raw as Record<string, unknown>)["transcript"];
  return typeof transcript === "string" && transcript.trim() !== "" ? transcript : null;
}

export class ClaudeHandwritingReader implements HandwritingReader {
  readonly id = "claude";
  readonly #client: ModelClient;
  readonly #maxAttempts: number;

  constructor(client: ModelClient, { maxAttempts = DEFAULT_MAX_ATTEMPTS } = {}) {
    this.#client = client;
    this.#maxAttempts = maxAttempts;
  }

  get model(): string {
    return this.#client.model;
  }

  async read(input: HandwritingInput): Promise<StructuringResult> {
    if (input.images.length === 0) {
      return rejectedInput(HANDWRITING_PROMPT_VERSION, this.model, "empty_input", "", []);
    }
    const problems = validateImages(input.images);
    if (problems.length > 0) {
      return rejectedInput(HANDWRITING_PROMPT_VERSION, this.model, "invalid_input", "", problems);
    }
    return runTask({
      client: this.#client,
      system: HANDWRITING_SYSTEM,
      user: [
        ...input.images.map((image) => ({
          type: "image" as const,
          mimeType: image.mimeType,
          base64: Buffer.from(image.data).toString("base64"),
        })),
        { type: "text", text: buildHandwritingMessage(input) },
      ],
      outputSchema: HandwritingOutputSchema,
      maxTokens: MAX_TOKENS,
      promptVersion: HANDWRITING_PROMPT_VERSION,
      maxAttempts: this.#maxAttempts,
      select: ({ recipe, transcript }) => ({ recipe, transcript }),
      salvageTranscript: transcriptOf,
      fallbackTranscript: "",
    });
  }
}
