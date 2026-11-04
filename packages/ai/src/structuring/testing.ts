import type { StructuredRecipe } from "@virasat/core";
import type { ModelClient, ModelRequest, ModelResponse } from "./model-client.ts";

/** A valid recipe for tests and mocks. Override fields as needed. */
export function sampleRecipe(overrides: Partial<StructuredRecipe> = {}): StructuredRecipe {
  return {
    title: "Besan na poda",
    servings: null,
    ingredients: [
      {
        original_text: "mutthi bhar besan",
        name: "besan",
        suggested_quantity: 30,
        suggested_unit: "g",
        confidence: 0.3,
        note: null,
      },
      {
        original_text: "thodu mithu",
        name: "mithu",
        suggested_quantity: null,
        suggested_unit: null,
        confidence: null,
        note: null,
      },
    ],
    steps: [{ text: "besan ne tel ma sekvo" }],
    tips: [],
    story: null,
    language: "gu",
    uncertain_fields: ["/ingredients/0/suggested_quantity"],
    ...overrides,
  };
}

export const SAMPLE_TRANSCRIPT =
  "ek mutthi bhar besan lo, thodu mithu nakho, besan ne tel ma sekvo";

/**
 * Fake model: answers each call with the next scripted tool input (an Error is thrown instead).
 * Records every request so tests can inspect prompts. Never touches the network.
 */
export class ScriptedModelClient implements ModelClient {
  readonly model = "fake-model";
  readonly requests: ModelRequest[] = [];
  readonly #script: unknown[];

  constructor(script: unknown[]) {
    this.#script = [...script];
  }

  call(request: ModelRequest): Promise<ModelResponse> {
    this.requests.push(request);
    const next = this.#script.shift();
    if (next instanceof Error) return Promise.reject(next);
    return Promise.resolve({ toolInput: next, inputTokens: 100, outputTokens: 50 });
  }
}
