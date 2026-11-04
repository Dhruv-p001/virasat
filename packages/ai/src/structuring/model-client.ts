import type { z } from "zod";

/**
 * The narrow slice of an LLM API that structuring needs: one user turn in, one JSON answer out.
 * Unit tests fake this, so nothing under test touches the network.
 */

export type UserContentPart =
  { type: "text"; text: string } | { type: "image"; mimeType: string; base64: string };

export interface ModelRequest {
  system: string;
  user: UserContentPart[];
  /** The answer must match this schema. The client turns it into the provider's structured-output format. */
  outputSchema: z.ZodType;
  /** Covers reasoning as well as the answer, so leave headroom. */
  maxTokens: number;
}

/** Why the model stopped. "max_tokens" means the answer was cut off, "refusal" that a safety classifier declined. */
export type ModelStopReason = "end_turn" | "max_tokens" | "refusal" | "other";

export interface ModelResponse {
  /** The parsed JSON answer, unvalidated. Undefined when there was no JSON or it did not parse. */
  output: unknown;
  stopReason: ModelStopReason;
  /** Machine-readable category of a refusal (a slug such as "cyber"). Null when not a refusal or not given. */
  refusalCategory: string | null;
  inputTokens: number;
  outputTokens: number;
}

export interface ModelClient {
  readonly model: string;
  call(request: ModelRequest): Promise<ModelResponse>;
}
