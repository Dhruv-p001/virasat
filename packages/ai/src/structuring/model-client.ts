/**
 * The narrow slice of an LLM API that structuring needs: one user turn in, one forced tool call
 * out. Unit tests fake this, so nothing under test touches the network.
 */

export type UserContentPart =
  { type: "text"; text: string } | { type: "image"; mimeType: string; base64: string };

export interface ModelRequest {
  system: string;
  user: UserContentPart[];
  /** The model must answer by calling this tool, so the answer arrives as JSON. */
  tool: { name: string; description: string; inputSchema: Record<string, unknown> };
  maxTokens: number;
}

export interface ModelResponse {
  /** The tool call's arguments, unvalidated. Undefined when the model did not call the tool. */
  toolInput: unknown;
  inputTokens: number;
  outputTokens: number;
}

export interface ModelClient {
  readonly model: string;
  call(request: ModelRequest): Promise<ModelResponse>;
}
