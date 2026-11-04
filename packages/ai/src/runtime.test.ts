import { describe, expect, it } from "vitest";
import { AiConfigError, aiModeFromEnv, liveMissing, resolveAi } from "./runtime.ts";

const live = { ANTHROPIC_API_KEY: "a", OPENAI_API_KEY: "o" };

describe("aiModeFromEnv", () => {
  it("uses mock when there are no keys outside production", () => {
    expect(aiModeFromEnv({})).toBe("mock");
    expect(aiModeFromEnv({ ANTHROPIC_API_KEY: "a" })).toBe("mock");
  });

  it("uses live when its keys are present", () => {
    expect(aiModeFromEnv(live)).toBe("live");
  });

  it("lets AI_MODE decide, even with keys present", () => {
    expect(aiModeFromEnv({ ...live, AI_MODE: "mock" })).toBe("mock");
  });

  it("never falls back to mock in production", () => {
    expect(aiModeFromEnv({ NODE_ENV: "production" })).toBe("live");
    expect(() => resolveAi({ NODE_ENV: "production" })).toThrow(AiConfigError);
  });

  it("rejects an unknown AI_MODE", () => {
    expect(() => aiModeFromEnv({ AI_MODE: "fake" })).toThrow(AiConfigError);
  });
});

describe("liveMissing", () => {
  it("names the keys that are missing", () => {
    expect(liveMissing({})).toEqual(["ANTHROPIC_API_KEY", "the key for STT_PROVIDER=openai"]);
    expect(liveMissing({ ...live, STT_PROVIDER: "sarvam" })).toEqual([
      "the key for STT_PROVIDER=sarvam",
    ]);
    expect(liveMissing(live)).toEqual([]);
  });
});

describe("resolveAi", () => {
  it("returns fixtures in mock mode, with no network", async () => {
    const ai = resolveAi({ AI_MODE: "mock" });
    expect(ai.mode).toBe("mock");
    const heard = await ai.transcription.transcribe({
      audio: new Uint8Array(1),
      mimeType: "audio/webm",
      filename: "a.webm",
      language: "auto",
    });
    expect(heard.text).not.toBe("");
    const draft = await ai.structurer.structure({
      transcript: heard.text,
      language: null,
      speaker: { name: "Ba", relation: null },
    });
    expect(draft.status).toBe("ok");
    expect(
      await ai.handwriting.read({
        images: [],
        language: null,
        speaker: { name: "Ba", relation: null },
      }),
    ).toMatchObject({ status: "ok" });
  });

  it("builds the chosen speech-to-text provider in live mode", () => {
    const ai = resolveAi({ ...live, SARVAM_API_KEY: "s", STT_PROVIDER: "sarvam" });
    expect(ai.mode).toBe("live");
    expect(ai.transcription.id).toBe("sarvam");
    expect(ai.structurer.id).toBe("claude");
  });

  it("refuses live mode without keys", () => {
    expect(() => resolveAi({ AI_MODE: "live" })).toThrow(/ANTHROPIC_API_KEY/);
  });
});
