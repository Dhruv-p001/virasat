import {
  DEFAULT_MAX_ATTEMPTS,
  StructureOutputSchema,
  emptyInput,
  runTask,
  toolSchema,
} from "../engine.ts";
import type { ModelClient } from "../model-client.ts";
import {
  STRUCTURE_PROMPT_VERSION,
  STRUCTURE_SYSTEM,
  STRUCTURE_TOOL,
  buildStructureMessage,
} from "../prompts/structure.v1.ts";
import type { RecipeStructurer, StructureInput, StructuringResult } from "../types.ts";

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
      return emptyInput(STRUCTURE_PROMPT_VERSION, this.model, input.transcript);
    }
    return runTask({
      client: this.#client,
      system: STRUCTURE_SYSTEM,
      user: [{ type: "text", text: buildStructureMessage(input) }],
      tool: { ...STRUCTURE_TOOL, inputSchema: toolSchema(StructureOutputSchema) },
      maxTokens: 4096,
      promptVersion: STRUCTURE_PROMPT_VERSION,
      maxAttempts: this.#maxAttempts,
      sourceText: () => input.transcript,
      recipeOf: (raw) => raw,
      fallbackTranscript: input.transcript,
    });
  }
}
