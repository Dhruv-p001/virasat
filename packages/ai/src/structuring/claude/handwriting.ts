import {
  DEFAULT_MAX_ATTEMPTS,
  HandwritingOutputSchema,
  emptyInput,
  runTask,
  toolSchema,
} from "../engine.ts";
import type { ModelClient } from "../model-client.ts";
import {
  HANDWRITING_PROMPT_VERSION,
  HANDWRITING_SYSTEM,
  HANDWRITING_TOOL,
  buildHandwritingMessage,
} from "../prompts/handwriting.v1.ts";
import type { HandwritingInput, HandwritingReader, StructuringResult } from "../types.ts";

/** Reads a field off the raw tool input without trusting its shape. */
function field(raw: unknown, key: string): unknown {
  return typeof raw === "object" && raw !== null
    ? (raw as Record<string, unknown>)[key]
    : undefined;
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
      return emptyInput(HANDWRITING_PROMPT_VERSION, this.model, "");
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
      tool: { ...HANDWRITING_TOOL, inputSchema: toolSchema(HandwritingOutputSchema) },
      maxTokens: 8192,
      promptVersion: HANDWRITING_PROMPT_VERSION,
      maxAttempts: this.#maxAttempts,
      sourceText: (raw) => {
        const transcript = field(raw, "transcript");
        return typeof transcript === "string" && transcript.trim() !== "" ? transcript : null;
      },
      recipeOf: (raw) => field(raw, "recipe"),
      fallbackTranscript: "",
    });
  }
}
