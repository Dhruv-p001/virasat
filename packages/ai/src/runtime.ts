import {
  MockHandwritingReader,
  MockRecipeStructurer,
  MockTranscriptionProvider,
} from "./mock/index.ts";
import { ClaudeModelClient } from "./structuring/claude/client.ts";
import { ClaudeHandwritingReader } from "./structuring/claude/handwriting.ts";
import { ClaudeRecipeStructurer } from "./structuring/claude/structurer.ts";
import type { HandwritingReader, RecipeStructurer } from "./structuring/types.ts";
import { configuredProviders } from "./transcription/providers/index.ts";
import type { TranscriptionProvider } from "./transcription/types.ts";

/** "mock": deterministic fixtures, no keys. "live": the real providers. */
export type AiMode = "mock" | "live";

export interface AiRuntime {
  mode: AiMode;
  transcription: TranscriptionProvider;
  structurer: RecipeStructurer;
  handwriting: HandwritingReader;
}

type Env = Record<string, string | undefined>;

export class AiConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AiConfigError";
  }
}

/** Speech-to-text provider when STT_PROVIDER is not set (ADR 0003). */
export const DEFAULT_STT_PROVIDER = "openai";

function sttChoice(env: Env): string {
  return env["STT_PROVIDER"]?.trim() || DEFAULT_STT_PROVIDER;
}

/** What a live run still needs, by environment variable. Empty when nothing is missing. */
export function liveMissing(env: Env): string[] {
  const missing: string[] = [];
  if (!env["ANTHROPIC_API_KEY"]) missing.push("ANTHROPIC_API_KEY");
  const choice = sttChoice(env);
  if (!configuredProviders(env).some((provider) => provider.id === choice)) {
    missing.push(`the key for STT_PROVIDER=${choice}`);
  }
  return missing;
}

/**
 * Which mode the pipeline runs in. AI_MODE=mock or AI_MODE=live is explicit and wins. When unset,
 * live is used if its keys are present, and otherwise mock outside production. A production
 * deployment with missing keys is a configuration error, not a quiet fall back to fixtures.
 */
export function aiModeFromEnv(env: Env): AiMode {
  const explicit = env["AI_MODE"]?.trim();
  if (explicit === "mock" || explicit === "live") return explicit;
  if (explicit) throw new AiConfigError(`AI_MODE must be "mock" or "live", not "${explicit}"`);
  if (env["NODE_ENV"] === "production") return "live";
  return liveMissing(env).length === 0 ? "live" : "mock";
}

/**
 * The providers the capture pipeline uses. Gemini is never one of them: its free tier is for
 * synthetic evaluation only (ADR 0011).
 */
export function resolveAi(env: Env): AiRuntime {
  const mode = aiModeFromEnv(env);
  if (mode === "mock") {
    return {
      mode,
      transcription: new MockTranscriptionProvider(),
      structurer: new MockRecipeStructurer(),
      handwriting: new MockHandwritingReader(),
    };
  }
  const missing = liveMissing(env);
  if (missing.length > 0) throw new AiConfigError(`AI_MODE=live needs ${missing.join(" and ")}`);
  const transcription = configuredProviders(env).find((provider) => provider.id === sttChoice(env));
  const apiKey = env["ANTHROPIC_API_KEY"];
  if (!transcription || !apiKey) throw new AiConfigError("AI_MODE=live is not configured");
  const client = new ClaudeModelClient(apiKey);
  return {
    mode,
    transcription,
    structurer: new ClaudeRecipeStructurer(client),
    handwriting: new ClaudeHandwritingReader(client),
  };
}
