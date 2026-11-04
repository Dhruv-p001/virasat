import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import type {
  ModelClient,
  ModelRequest,
  ModelResponse,
  ModelStopReason,
  UserContentPart,
} from "../model-client.ts";

export const CLAUDE_STRUCTURING_MODEL = "claude-sonnet-5-5";

/**
 * Extraction needs little deliberation: the rules are in the prompt and the answer is a transcript
 * restructured, not reasoned about. Sonnet 5.5 thinks adaptively and thinking counts against
 * max_tokens, so `medium` keeps both spend and truncation risk down. Re-check with
 * `pnpm eval:structure` before changing it.
 */
export const CLAUDE_STRUCTURING_EFFORT = "medium";

type Effort = "low" | "medium" | "high" | "xhigh" | "max";

const IMAGE_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"] as const;
type ImageType = (typeof IMAGE_TYPES)[number];

function imageType(mimeType: string): ImageType {
  const found = IMAGE_TYPES.find((type) => type === mimeType);
  if (!found) throw new Error(`Unsupported image type: ${mimeType}`);
  return found;
}

function toContentBlock(part: UserContentPart): Anthropic.ContentBlockParam {
  if (part.type === "text") return { type: "text", text: part.text };
  return {
    type: "image",
    source: { type: "base64", media_type: imageType(part.mimeType), data: part.base64 },
  };
}

function toStopReason(reason: Anthropic.Message["stop_reason"]): ModelStopReason {
  switch (reason) {
    case "end_turn":
      return "end_turn";
    case "max_tokens":
    case "model_context_window_exceeded":
      return "max_tokens";
    case "refusal":
      return "refusal";
    default:
      return "other";
  }
}

/** The JSON text of the answer, or undefined when the model returned none or it does not parse. */
function parseAnswer(message: Anthropic.Message): unknown {
  const text = message.content.flatMap((block) => (block.type === "text" ? [block.text] : []));
  try {
    return JSON.parse(text.join("")) as unknown;
  } catch {
    return undefined;
  }
}

/**
 * Claude through the official SDK, answering in structured-output mode (`output_config.format`).
 * Sonnet 5.5 rejects forced tool_choice, so a forced tool call is not an option. The SDK retries
 * 429s, 5xx and timeouts itself.
 */
export class ClaudeModelClient implements ModelClient {
  readonly model: string;
  readonly #client: Anthropic;
  readonly #effort: Effort;

  constructor(
    apiKey: string,
    {
      model = CLAUDE_STRUCTURING_MODEL,
      effort = CLAUDE_STRUCTURING_EFFORT,
      maxRetries = 2,
      timeoutMs = 120_000,
    }: { model?: string; effort?: Effort; maxRetries?: number; timeoutMs?: number } = {},
  ) {
    this.model = model;
    this.#effort = effort;
    this.#client = new Anthropic({ apiKey, maxRetries, timeout: timeoutMs });
  }

  async call(request: ModelRequest): Promise<ModelResponse> {
    const message = await this.#client.messages.create({
      model: this.model,
      max_tokens: request.maxTokens,
      system: request.system,
      messages: [{ role: "user", content: request.user.map(toContentBlock) }],
      output_config: { effort: this.#effort, format: zodOutputFormat(request.outputSchema) },
    });
    return {
      output: parseAnswer(message),
      stopReason: toStopReason(message.stop_reason),
      refusalCategory: message.stop_details?.category ?? null,
      inputTokens: message.usage.input_tokens,
      outputTokens: message.usage.output_tokens,
    };
  }
}
