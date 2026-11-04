import { FinishReason, GoogleGenAI, ThinkingLevel, type Part } from "@google/genai";
import { z } from "zod";
import type {
  ModelClient,
  ModelRequest,
  ModelResponse,
  ModelStopReason,
  UserContentPart,
} from "../model-client.ts";

/** A stable (non-preview) Flash model that new keys can use. gemini-2.5-flash is closed to new users. */
export const GEMINI_DEFAULT_MODEL = "gemini-3.5-flash";

/**
 * Which Google service the API key talks to (ADR 0011):
 * - `developer`: the Gemini Developer API (generativelanguage.googleapis.com). Works with the
 *   current `AQ.` keys and "AIza" keys.
 * - `vertex-express`: Vertex AI express mode (`vertexai: true` with the same key). Needs the
 *   Vertex AI API enabled for the key's project.
 */
export const GEMINI_MODES = ["developer", "vertex-express"] as const;
export type GeminiMode = (typeof GEMINI_MODES)[number];

/** Reads GEMINI_API_MODE ("developer" by default). An unknown value is an error, not a silent default. */
export function geminiModeFromEnv(env: Record<string, string | undefined>): GeminiMode {
  const value = env["GEMINI_API_MODE"]?.trim() || "developer";
  const mode = GEMINI_MODES.find((m) => m === value);
  if (!mode)
    throw new Error(`GEMINI_API_MODE must be one of ${GEMINI_MODES.join(", ")}, got ${value}`);
  return mode;
}

type Thinking = "minimal" | "low" | "medium" | "high";

const THINKING_LEVELS: Record<Thinking, ThinkingLevel> = {
  minimal: ThinkingLevel.MINIMAL,
  low: ThinkingLevel.LOW,
  medium: ThinkingLevel.MEDIUM,
  high: ThinkingLevel.HIGH,
};

/** Finish reasons where Google withheld the answer for policy or privacy reasons. */
const BLOCKED: ReadonlySet<string> = new Set([
  FinishReason.SAFETY,
  FinishReason.BLOCKLIST,
  FinishReason.PROHIBITED_CONTENT,
  FinishReason.SPII,
  FinishReason.RECITATION,
  FinishReason.IMAGE_SAFETY,
  FinishReason.IMAGE_PROHIBITED_CONTENT,
]);

function toPart(part: UserContentPart): Part {
  if (part.type === "text") return { text: part.text };
  return { inlineData: { mimeType: part.mimeType, data: part.base64 } };
}

/**
 * Gemini accepts a subset of JSON Schema. Zod adds `$schema` and a non-standard `starts_with`
 * format for the pointer check, which would be rejected, and validateRecipe enforces pointers anyway.
 */
function toResponseSchema(schema: z.ZodType): unknown {
  const { $schema: _ignored, ...rest } = z.toJSONSchema(schema, { io: "input" });
  return JSON.parse(
    JSON.stringify(rest, (key, value: unknown) =>
      key === "format" && value === "starts_with" ? undefined : value,
    ),
  ) as unknown;
}

function parseAnswer(text: string | undefined): unknown {
  if (text === undefined) return undefined;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return undefined;
  }
}

/**
 * Gemini through `@google/genai`, answering in JSON mode with a response schema. Used to exercise
 * the pipeline for real on synthetic data while no Anthropic key is available. Production
 * structuring stays on Claude (brief section 3). The free tier may use inputs for product
 * improvement and human review, so only synthetic data goes through it (ADR 0011).
 */
export class GeminiModelClient implements ModelClient {
  readonly model: string;
  readonly mode: GeminiMode;
  readonly #ai: GoogleGenAI;
  readonly #thinking: Thinking;

  constructor(
    apiKey: string,
    {
      model = GEMINI_DEFAULT_MODEL,
      mode = "developer",
      thinking = "low",
      attempts = 4,
    }: { model?: string; mode?: GeminiMode; thinking?: Thinking; attempts?: number } = {},
  ) {
    this.model = model;
    this.mode = mode;
    this.#thinking = thinking;
    this.#ai = new GoogleGenAI({
      apiKey,
      ...(mode === "vertex-express" ? { vertexai: true } : {}),
      // The SDK retries 408, 429 and 5xx. "High demand" 503s are common on the free tier.
      httpOptions: { retryOptions: { attempts } },
    });
  }

  async call(request: ModelRequest): Promise<ModelResponse> {
    const response = await this.#ai.models.generateContent({
      model: this.model,
      contents: [{ role: "user", parts: request.user.map(toPart) }],
      config: {
        systemInstruction: request.system,
        responseMimeType: "application/json",
        responseJsonSchema: toResponseSchema(request.outputSchema),
        maxOutputTokens: request.maxTokens,
        thinkingConfig: { thinkingLevel: THINKING_LEVELS[this.#thinking] },
      },
    });

    const finish = response.candidates?.[0]?.finishReason;
    const blockReason = response.promptFeedback?.blockReason;
    let stopReason: ModelStopReason = "other";
    let refusalCategory: string | null = null;
    if (blockReason) {
      stopReason = "refusal";
      refusalCategory = `prompt_${blockReason.toLowerCase()}`;
    } else if (finish === FinishReason.STOP) {
      stopReason = "end_turn";
    } else if (finish === FinishReason.MAX_TOKENS) {
      stopReason = "max_tokens";
    } else if (finish !== undefined && BLOCKED.has(finish)) {
      stopReason = "refusal";
      refusalCategory = finish.toLowerCase();
    }

    const usage = response.usageMetadata;
    return {
      output: parseAnswer(response.text),
      stopReason,
      refusalCategory,
      inputTokens: usage?.promptTokenCount ?? 0,
      // Thinking tokens are billed as output, so count them as the Claude client does.
      outputTokens: (usage?.candidatesTokenCount ?? 0) + (usage?.thoughtsTokenCount ?? 0),
    };
  }
}
