import Anthropic from "@anthropic-ai/sdk";
import type { ModelClient, ModelRequest, ModelResponse, UserContentPart } from "../model-client.ts";

export const CLAUDE_STRUCTURING_MODEL = "claude-sonnet-5-5";

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

/** Claude through the official SDK. The SDK retries 429s, 5xx and timeouts itself. */
export class ClaudeModelClient implements ModelClient {
  readonly model: string;
  readonly #client: Anthropic;

  constructor(
    apiKey: string,
    { model = CLAUDE_STRUCTURING_MODEL, maxRetries = 2, timeoutMs = 120_000 } = {},
  ) {
    this.model = model;
    this.#client = new Anthropic({ apiKey, maxRetries, timeout: timeoutMs });
  }

  async call(request: ModelRequest): Promise<ModelResponse> {
    const message = await this.#client.messages.create({
      model: this.model,
      max_tokens: request.maxTokens,
      system: request.system,
      messages: [{ role: "user", content: request.user.map(toContentBlock) }],
      tools: [
        {
          name: request.tool.name,
          description: request.tool.description,
          input_schema: { type: "object", ...request.tool.inputSchema },
        },
      ],
      tool_choice: { type: "tool", name: request.tool.name },
    });
    const toolUse = message.content.find((block) => block.type === "tool_use");
    return {
      toolInput: toolUse?.input,
      inputTokens: message.usage.input_tokens,
      outputTokens: message.usage.output_tokens,
    };
  }
}
