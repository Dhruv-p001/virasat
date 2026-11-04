import { SAMPLE_TRANSCRIPT, sampleRecipe } from "../structuring/testing.ts";
import type {
  HandwritingReader,
  RecipeStructurer,
  StructureInput,
  StructuringResult,
  StructuringUsage,
} from "../structuring/types.ts";
import type { TranscriptionProvider, TranscriptionResult } from "../transcription/types.ts";

// Deterministic stand-ins for the real providers, used when there are no API keys (local
// development, CI) so the whole capture flow runs and is testable (ADR 0013). They never touch
// the network and ignore the audio or image they are given: the answer is always the fixture.
// The app shows a banner whenever they are in use, so mock output is never mistaken for a real
// recipe.

export const MOCK_MODEL = "mock-fixture";
export const MOCK_PROMPT_VERSION = "mock";

/** Mock providers spend nothing. */
const NO_USAGE: StructuringUsage = { model: MOCK_MODEL, calls: 0, inputTokens: 0, outputTokens: 0 };

export class MockTranscriptionProvider implements TranscriptionProvider {
  readonly id = "mock";
  readonly model = MOCK_MODEL;

  transcribe(): Promise<TranscriptionResult> {
    return Promise.resolve({
      text: SAMPLE_TRANSCRIPT,
      detectedLanguage: "gu-IN",
      provider: this.id,
      model: this.model,
      latencyMs: 0,
    });
  }
}

function fixtureDraft(transcript: string): StructuringResult {
  return {
    status: "ok",
    recipe: sampleRecipe(),
    transcript,
    autoFlagged: [],
    usage: NO_USAGE,
    promptVersion: MOCK_PROMPT_VERSION,
  };
}

export class MockRecipeStructurer implements RecipeStructurer {
  readonly id = "mock";
  readonly model = MOCK_MODEL;

  structure(input: StructureInput): Promise<StructuringResult> {
    return Promise.resolve(fixtureDraft(input.transcript));
  }
}

export class MockHandwritingReader implements HandwritingReader {
  readonly id = "mock";
  readonly model = MOCK_MODEL;

  read(): Promise<StructuringResult> {
    return Promise.resolve(fixtureDraft(SAMPLE_TRANSCRIPT));
  }
}
