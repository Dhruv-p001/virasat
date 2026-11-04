import { afterEach, describe, expect, it, vi } from "vitest";
import { StructureOutputSchema } from "../engine.ts";
import { sampleRecipe } from "../testing.ts";
import { GEMINI_DEFAULT_MODEL, GeminiModelClient, geminiModeFromEnv } from "./client.ts";

interface Call {
  url: string;
  body: Record<string, unknown>;
  headers: Headers;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

function stubGenerateContent(reply: Record<string, unknown>) {
  const calls: Call[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn((url: string | URL | Request, init?: RequestInit) => {
      calls.push({
        url: typeof url === "string" ? url : url instanceof URL ? url.href : url.url,
        body: JSON.parse(typeof init?.body === "string" ? init.body : "{}") as Record<
          string,
          unknown
        >,
        headers: new Headers(init?.headers),
      });
      return Promise.resolve(Response.json(reply));
    }),
  );
  return calls;
}

const answer = (overrides: Record<string, unknown> = {}) => ({
  candidates: [
    {
      content: { role: "model", parts: [{ text: JSON.stringify(sampleRecipe()) }] },
      finishReason: "STOP",
    },
  ],
  usageMetadata: { promptTokenCount: 321, candidatesTokenCount: 45, thoughtsTokenCount: 100 },
  ...overrides,
});

const request = {
  system: "sys",
  user: [
    { type: "image" as const, mimeType: "image/png", base64: "AAAA" },
    { type: "text" as const, text: "hello" },
  ],
  outputSchema: StructureOutputSchema,
  maxTokens: 100,
};

describe("GeminiModelClient", () => {
  it("asks the Developer API for schema-constrained JSON and reads the answer and usage", async () => {
    const calls = stubGenerateContent(answer());
    const client = new GeminiModelClient("test-key", { attempts: 1 });
    const response = await client.call(request);

    expect(client.model).toBe(GEMINI_DEFAULT_MODEL);
    expect(client.mode).toBe("developer");
    expect(response).toEqual({
      output: sampleRecipe(),
      stopReason: "end_turn",
      refusalCategory: null,
      inputTokens: 321,
      // Thinking tokens are billed as output.
      outputTokens: 145,
    });

    const call = calls[0];
    expect(call?.url).toContain("generativelanguage.googleapis.com");
    expect(call?.url).toContain(`models/${GEMINI_DEFAULT_MODEL}:generateContent`);
    expect(call?.headers.get("x-goog-api-key")).toBe("test-key");
    expect(call?.body).toMatchObject({
      systemInstruction: { parts: [{ text: "sys" }] },
      contents: [
        {
          role: "user",
          parts: [{ inlineData: { mimeType: "image/png", data: "AAAA" } }, { text: "hello" }],
        },
      ],
      generationConfig: {
        responseMimeType: "application/json",
        maxOutputTokens: 100,
        thinkingConfig: { thinkingLevel: "LOW" },
      },
    });
    const schema = JSON.stringify(
      (call?.body["generationConfig"] as { responseJsonSchema: unknown }).responseJsonSchema,
    );
    expect(schema).toContain("original_text");
    expect(schema).not.toContain("starts_with");
    expect(schema).not.toContain("$schema");
  });

  it("uses Vertex AI express mode when asked", async () => {
    const calls = stubGenerateContent(answer());
    const client = new GeminiModelClient("test-key", { mode: "vertex-express", attempts: 1 });
    await client.call(request);
    expect(client.mode).toBe("vertex-express");
    expect(calls[0]?.url).toContain("aiplatform.googleapis.com");
    expect(calls[0]?.url).not.toContain("generativelanguage.googleapis.com");
  });

  it("maps a cut-off answer to max_tokens", async () => {
    stubGenerateContent(
      answer({ candidates: [{ content: { parts: [{ text: "{" }] }, finishReason: "MAX_TOKENS" }] }),
    );
    const response = await new GeminiModelClient("k", { attempts: 1 }).call(request);
    expect(response).toMatchObject({ stopReason: "max_tokens", output: undefined });
  });

  it.each([["SAFETY"], ["PROHIBITED_CONTENT"], ["SPII"]])(
    "maps finish reason %s to a refusal with that category",
    async (finishReason) => {
      stubGenerateContent(answer({ candidates: [{ finishReason }] }));
      const response = await new GeminiModelClient("k", { attempts: 1 }).call(request);
      expect(response).toMatchObject({
        stopReason: "refusal",
        refusalCategory: finishReason.toLowerCase(),
        output: undefined,
      });
    },
  );

  it("maps a blocked prompt to a refusal", async () => {
    stubGenerateContent({
      promptFeedback: { blockReason: "PROHIBITED_CONTENT" },
      usageMetadata: { promptTokenCount: 5 },
    });
    const response = await new GeminiModelClient("k", { attempts: 1 }).call(request);
    expect(response).toMatchObject({
      stopReason: "refusal",
      refusalCategory: "prompt_prohibited_content",
      inputTokens: 5,
      outputTokens: 0,
    });
  });

  it("returns no output when the text is not JSON", async () => {
    stubGenerateContent(
      answer({
        candidates: [{ content: { parts: [{ text: "Sorry, no." }] }, finishReason: "STOP" }],
      }),
    );
    const response = await new GeminiModelClient("k", { attempts: 1 }).call(request);
    expect(response.output).toBeUndefined();
  });

  it("passes the thinking level through", async () => {
    const calls = stubGenerateContent(answer());
    await new GeminiModelClient("k", { attempts: 1, thinking: "high" }).call(request);
    expect(calls[0]?.body).toMatchObject({
      generationConfig: { thinkingConfig: { thinkingLevel: "HIGH" } },
    });
  });
});

describe("geminiModeFromEnv", () => {
  it("defaults to the Developer API", () => {
    expect(geminiModeFromEnv({})).toBe("developer");
    expect(geminiModeFromEnv({ GEMINI_API_MODE: "  " })).toBe("developer");
  });

  it("accepts both modes", () => {
    expect(geminiModeFromEnv({ GEMINI_API_MODE: "vertex-express" })).toBe("vertex-express");
    expect(geminiModeFromEnv({ GEMINI_API_MODE: "developer" })).toBe("developer");
  });

  it("rejects anything else instead of guessing", () => {
    expect(() => geminiModeFromEnv({ GEMINI_API_MODE: "vertex" })).toThrow(/GEMINI_API_MODE/);
  });
});
