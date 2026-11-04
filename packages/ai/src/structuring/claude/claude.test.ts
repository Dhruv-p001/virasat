import { afterEach, describe, expect, it, vi } from "vitest";
import { SAMPLE_TRANSCRIPT, ScriptedModelClient, sampleRecipe } from "../testing.ts";
import type { StructureInput } from "../types.ts";
import { ClaudeModelClient } from "./client.ts";
import { ClaudeHandwritingReader } from "./handwriting.ts";
import { ClaudeRecipeStructurer } from "./structurer.ts";

const input: StructureInput = {
  transcript: SAMPLE_TRANSCRIPT,
  language: "gu",
  speaker: { name: "Ba", relation: "Grandmother" },
};

const invalid = { title: "" };

describe("ClaudeRecipeStructurer", () => {
  it("returns a validated recipe with usage and prompt version", async () => {
    const client = new ScriptedModelClient([sampleRecipe()]);
    const result = await new ClaudeRecipeStructurer(client).structure(input);

    expect(result).toMatchObject({
      status: "ok",
      recipe: sampleRecipe(),
      transcript: SAMPLE_TRANSCRIPT,
      autoFlagged: [],
      promptVersion: "structure.v1",
      usage: { model: "fake-model", calls: 1, inputTokens: 100, outputTokens: 50 },
    });
    const request = client.requests[0];
    expect(request?.system).toContain("NEVER INVENT");
    expect(request?.user[0]).toMatchObject({ type: "text" });
    expect(JSON.stringify(request?.tool.inputSchema)).toContain("original_text");
    expect(request?.tool.inputSchema).not.toHaveProperty("$schema");
    expect(JSON.stringify(request?.tool.inputSchema)).not.toContain("starts_with");
  });

  it("retries invalid output, telling the model what was wrong, and sums usage", async () => {
    const client = new ScriptedModelClient([invalid, sampleRecipe()]);
    const result = await new ClaudeRecipeStructurer(client).structure(input);

    expect(result.status).toBe("ok");
    expect(result.usage).toMatchObject({ calls: 2, inputTokens: 200, outputTokens: 100 });
    const retry = client.requests[1]?.user.at(-1);
    expect(retry).toMatchObject({ type: "text" });
    expect(retry && "text" in retry && retry.text).toContain("title");
  });

  it("retries a non-metric unit", async () => {
    const bad = sampleRecipe();
    const first = bad.ingredients[0];
    if (first) first.suggested_unit = "cup";
    const client = new ScriptedModelClient([bad, sampleRecipe()]);
    const result = await new ClaudeRecipeStructurer(client).structure(input);
    expect(result.status).toBe("ok");
    expect(client.requests).toHaveLength(2);
  });

  it("returns needs_manual_entry after bounded retries and keeps the transcript", async () => {
    const client = new ScriptedModelClient([invalid, invalid, invalid, sampleRecipe()]);
    const result = await new ClaudeRecipeStructurer(client, { maxAttempts: 3 }).structure(input);

    expect(result).toMatchObject({
      status: "needs_manual_entry",
      reason: "invalid_output",
      transcript: SAMPLE_TRANSCRIPT,
      usage: { calls: 3 },
    });
    expect(result.status === "needs_manual_entry" && result.issues.join()).toContain("title");
    expect(client.requests).toHaveLength(3);
  });

  it("treats a missing tool call as invalid output", async () => {
    const client = new ScriptedModelClient([undefined, undefined]);
    const result = await new ClaudeRecipeStructurer(client, { maxAttempts: 2 }).structure(input);
    expect(result).toMatchObject({ status: "needs_manual_entry", reason: "invalid_output" });
  });

  it("never throws on provider errors and keeps the transcript", async () => {
    const client = new ScriptedModelClient([new TypeError("socket hang up with secret detail")]);
    const result = await new ClaudeRecipeStructurer(client).structure(input);

    expect(result).toMatchObject({
      status: "needs_manual_entry",
      reason: "provider_error",
      transcript: SAMPLE_TRANSCRIPT,
      issues: ["provider: TypeError"],
      usage: { calls: 0 },
    });
  });

  it("does not call the model for an empty transcript", async () => {
    const client = new ScriptedModelClient([]);
    const result = await new ClaudeRecipeStructurer(client).structure({
      ...input,
      transcript: "  \n",
    });
    expect(result).toMatchObject({ status: "needs_manual_entry", reason: "empty_input" });
    expect(client.requests).toHaveLength(0);
  });

  it("flags ingredients that cannot be traced to the transcript", async () => {
    const invented = sampleRecipe();
    const second = invented.ingredients[1];
    if (second) second.original_text = "ek chutki namak";
    const result = await new ClaudeRecipeStructurer(new ScriptedModelClient([invented])).structure(
      input,
    );
    expect(result).toMatchObject({ status: "ok", autoFlagged: ["/ingredients/1/original_text"] });
  });
});

describe("ClaudeHandwritingReader", () => {
  const page = { data: new Uint8Array([1, 2, 3]), mimeType: "image/jpeg" as const };
  const handwritingInput = { images: [page], language: null, speaker: input.speaker };
  const output = { transcript: SAMPLE_TRANSCRIPT, recipe: sampleRecipe() };

  it("sends the images, then returns the recipe and the text read off the page", async () => {
    const client = new ScriptedModelClient([output]);
    const result = await new ClaudeHandwritingReader(client).read(handwritingInput);

    expect(result).toMatchObject({
      status: "ok",
      recipe: sampleRecipe(),
      transcript: SAMPLE_TRANSCRIPT,
      promptVersion: "handwriting.v1",
    });
    expect(client.requests[0]?.user[0]).toEqual({
      type: "image",
      mimeType: "image/jpeg",
      base64: "AQID",
    });
    expect(client.requests[0]?.system).toContain("[illegible]");
  });

  it("checks ingredients against the transcript the model read, not the caller's", async () => {
    const off = sampleRecipe();
    const second = off.ingredients[1];
    if (second) second.original_text = "ek chutki namak";
    const result = await new ClaudeHandwritingReader(
      new ScriptedModelClient([{ transcript: SAMPLE_TRANSCRIPT, recipe: off }]),
    ).read(handwritingInput);
    expect(result).toMatchObject({ status: "ok", autoFlagged: ["/ingredients/1/original_text"] });
  });

  it("keeps the text it read when the recipe is invalid", async () => {
    const bad = { transcript: SAMPLE_TRANSCRIPT, recipe: invalid };
    const result = await new ClaudeHandwritingReader(new ScriptedModelClient([bad, bad]), {
      maxAttempts: 2,
    }).read(handwritingInput);
    expect(result).toMatchObject({
      status: "needs_manual_entry",
      reason: "invalid_output",
      transcript: SAMPLE_TRANSCRIPT,
    });
  });

  it("returns an empty transcript when nothing was readable", async () => {
    const result = await new ClaudeHandwritingReader(new ScriptedModelClient([{}, {}]), {
      maxAttempts: 2,
    }).read(handwritingInput);
    expect(result).toMatchObject({ status: "needs_manual_entry", transcript: "" });
  });

  it("rejects a recipe without a transcript", async () => {
    const result = await new ClaudeHandwritingReader(
      new ScriptedModelClient([{ recipe: sampleRecipe() }]),
      { maxAttempts: 1 },
    ).read(handwritingInput);
    expect(result.status).toBe("needs_manual_entry");
  });

  it("does not call the model without images", async () => {
    const client = new ScriptedModelClient([]);
    const result = await new ClaudeHandwritingReader(client).read({
      ...handwritingInput,
      images: [],
    });
    expect(result).toMatchObject({ status: "needs_manual_entry", reason: "empty_input" });
    expect(client.requests).toHaveLength(0);
  });
});

describe("ClaudeModelClient", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("sends a forced tool call to the Messages API and reads the tool input and usage", async () => {
    const bodies: unknown[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn((_url: string, init: RequestInit) => {
        bodies.push(JSON.parse(typeof init.body === "string" ? init.body : "null"));
        return Promise.resolve(
          Response.json({
            id: "msg_1",
            type: "message",
            role: "assistant",
            model: "claude-sonnet-5-5",
            content: [
              { type: "text", text: "ok" },
              { type: "tool_use", id: "tu_1", name: "record_recipe", input: sampleRecipe() },
            ],
            stop_reason: "tool_use",
            stop_sequence: null,
            usage: { input_tokens: 321, output_tokens: 45 },
          }),
        );
      }),
    );

    const client = new ClaudeModelClient("test-key", { maxRetries: 0 });
    const response = await client.call({
      system: "sys",
      user: [
        { type: "image", mimeType: "image/png", base64: "AAAA" },
        { type: "text", text: "hello" },
      ],
      tool: { name: "record_recipe", description: "d", inputSchema: { properties: {} } },
      maxTokens: 100,
    });

    expect(client.model).toBe("claude-sonnet-5-5");
    expect(response).toEqual({ toolInput: sampleRecipe(), inputTokens: 321, outputTokens: 45 });
    expect(bodies[0]).toMatchObject({
      model: "claude-sonnet-5-5",
      max_tokens: 100,
      system: "sys",
      tool_choice: { type: "tool", name: "record_recipe" },
      tools: [{ name: "record_recipe", input_schema: { type: "object", properties: {} } }],
      messages: [
        {
          role: "user",
          content: [
            { type: "image", source: { type: "base64", media_type: "image/png", data: "AAAA" } },
            { type: "text", text: "hello" },
          ],
        },
      ],
    });
  });
});
