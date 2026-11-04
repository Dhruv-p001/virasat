import { DEFAULT_MAX_ATTEMPTS, StructureOutputSchema, rejectedInput, runTask } from "../engine.ts";
import type { ModelClient } from "../model-client.ts";
import {
  STRUCTURE_PROMPT_VERSION,
  STRUCTURE_SYSTEM,
  buildStructureMessage,
} from "../prompts/structure.v2.ts";
import type { RecipeStructurer, StructureInput, StructuringResult } from "../types.ts";

/** Answer plus adaptive thinking, both counted against max_tokens. A recipe is a few hundred tokens. */
const MAX_TOKENS = 16_000;

export class ClaudeRecipeStructurer implements RecipeStructurer {
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

  async structure(input: StructureInput): Promise<StructuringResult> {
    if (input.transcript.trim() === "") {
      return rejectedInput(
        STRUCTURE_PROMPT_VERSION,
        this.model,
        "empty_input",
        input.transcript,
        [],
      );
    }
    return runTask({
      client: this.#client,
      system: STRUCTURE_SYSTEM,
      user: [{ type: "text", text: buildStructureMessage(input) }],
      outputSchema: StructureOutputSchema,
      maxTokens: MAX_TOKENS,
      promptVersion: STRUCTURE_PROMPT_VERSION,
      maxAttempts: this.#maxAttempts,
      select: (recipe) => ({ recipe, transcript: input.transcript }),
      salvageTranscript: () => input.transcript,
      fallbackTranscript: input.transcript,
    });
  }
}
