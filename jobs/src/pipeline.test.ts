import { resolveAi, type RecipeStructurer, type TranscriptionProvider } from "@virasat/ai";
import { describe, expect, it } from "vitest";
import {
  failCapture,
  languageFromCode,
  structureCapture,
  transcribeCapture,
  type AdvancePatch,
  type CaptureRecord,
  type CaptureStatus,
  type PipelineStore,
} from "./pipeline.ts";

const JOB = "11111111-1111-4111-8111-111111111111";

/** An in-memory store that enforces the same moves as advance_capture() and records them. */
function memoryStore(initial: Partial<CaptureRecord> = {}) {
  const job: CaptureRecord = {
    id: JOB,
    status: "uploaded",
    sourceType: "voice",
    transcript: null,
    detectedLanguage: null,
    speaker: { name: "Savita", relation: "Ba" },
    media: [{ bucket: "vault-audio", path: "f/capture/j/m.webm", mimeType: "audio/webm" }],
    ...initial,
  };
  const moves: { to: CaptureStatus; patch: AdvancePatch }[] = [];
  const downloads: string[] = [];
  const store: PipelineStore = {
    load: () => Promise.resolve({ ...job }),
    download: (media) => {
      downloads.push(media.path);
      return Promise.resolve(new Uint8Array(4));
    },
    advance: (_id, to, patch = {}) => {
      moves.push({ to, patch });
      job.status = to;
      if (patch.transcript !== undefined) job.transcript = patch.transcript;
      if (patch.detectedLanguage !== undefined) job.detectedLanguage = patch.detectedLanguage;
      return Promise.resolve();
    },
  };
  return { store, job, moves, downloads };
}

const mock = resolveAi({ AI_MODE: "mock" });

describe("a voice capture", () => {
  it("goes from uploaded to ready for review", async () => {
    const { store, job, moves, downloads } = memoryStore();
    expect(await transcribeCapture({ store, ai: mock }, JOB)).toBe("done");
    expect(await structureCapture({ store, ai: mock }, JOB)).toBe("ready");

    expect(moves.map((move) => move.to)).toEqual([
      "transcribing",
      "structuring",
      "ready_for_review",
    ]);
    expect(downloads).toEqual(["f/capture/j/m.webm"]);
    expect(job.transcript).not.toBeNull();
    const last = moves.at(-1)?.patch;
    expect(last?.aiOutput?.recipe.ingredients[0]?.original_text).toBe("mutthi bhar besan");
    expect(last?.providerMeta).toMatchObject({ structurer: { id: "mock" } });
  });

  it("does not touch a job that is already done", async () => {
    for (const status of ["ready_for_review", "failed", "confirmed"] as const) {
      const { store, moves } = memoryStore({ status });
      expect(await transcribeCapture({ store, ai: mock }, JOB)).toBe("skip");
      expect(await structureCapture({ store, ai: mock }, JOB)).toBe("skip");
      expect(moves).toEqual([]);
    }
  });

  it("picks up where a crashed run stopped", async () => {
    const { store, moves, downloads } = memoryStore({ status: "transcribing" });
    await transcribeCapture({ store, ai: mock }, JOB);
    // No second move to "transcribing", and the audio is fetched again.
    expect(moves.map((move) => move.to)).toEqual(["structuring"]);
    expect(downloads).toHaveLength(1);

    const resumed = memoryStore({ status: "structuring", transcript: "ek mutthi besan" });
    expect(await transcribeCapture({ store: resumed.store, ai: mock }, JOB)).toBe("done");
    expect(resumed.moves).toEqual([]);
  });

  it("lets a speech-to-text failure escape so the step is retried", async () => {
    const { store, job } = memoryStore();
    const broken: TranscriptionProvider = {
      id: "broken",
      model: "m",
      transcribe: () => Promise.reject(new Error("503")),
    };
    await expect(
      transcribeCapture({ store, ai: { ...mock, transcription: broken } }, JOB),
    ).rejects.toThrow("503");
    // Still transcribing, not failed: the retry can carry on.
    expect(job.status).toBe("transcribing");
  });
});

describe("when the AI gives up", () => {
  it("fails the capture, keeping the transcript for manual entry", async () => {
    const { store, moves } = memoryStore({ status: "structuring", transcript: "half a recipe" });
    const giveUp: RecipeStructurer = {
      id: "claude",
      model: "m",
      structure: () =>
        Promise.resolve({
          status: "needs_manual_entry",
          reason: "invalid_output",
          transcript: "half a recipe",
          issues: ["ingredients.0: required"],
          usage: { model: "m", calls: 3, inputTokens: 300, outputTokens: 90 },
          promptVersion: "structure.v2",
        }),
    };
    expect(await structureCapture({ store, ai: { ...mock, structurer: giveUp } }, JOB)).toBe(
      "manual",
    );
    expect(moves).toHaveLength(1);
    expect(moves[0]?.to).toBe("failed");
    expect(moves[0]?.patch.error).toBe("manual_entry:invalid_output");
    expect(moves[0]?.patch.transcript).toBe("half a recipe");
    expect(moves[0]?.patch.aiOutput).toBeUndefined();
  });

  it("never puts recipe content in the failure reason", async () => {
    const { store, moves } = memoryStore({ status: "structuring", transcript: "secret besan" });
    const giveUp: RecipeStructurer = {
      id: "claude",
      model: "m",
      structure: () =>
        Promise.resolve({
          status: "needs_manual_entry",
          reason: "refused",
          transcript: "secret besan",
          issues: [],
          usage: { model: "m", calls: 1, inputTokens: 1, outputTokens: 1 },
          promptVersion: "p",
        }),
    };
    await structureCapture({ store, ai: { ...mock, structurer: giveUp } }, JOB);
    expect(JSON.stringify(moves[0]?.patch.error)).not.toContain("besan");
    expect(JSON.stringify(moves[0]?.patch.providerMeta)).not.toContain("besan");
  });
});

describe("a handwriting capture", () => {
  it("skips transcription and keeps the text read off the page", async () => {
    const { store, moves, downloads } = memoryStore({
      sourceType: "handwriting",
      media: [{ bucket: "vault-scans", path: "f/capture/j/p.jpg", mimeType: "image/jpeg" }],
    });
    await transcribeCapture({ store, ai: mock }, JOB);
    await structureCapture({ store, ai: mock }, JOB);
    expect(moves.map((move) => move.to)).toEqual(["structuring", "ready_for_review"]);
    expect(downloads).toEqual(["f/capture/j/p.jpg"]);
    expect(moves[1]?.patch.transcript).not.toBeUndefined();
  });
});

describe("failCapture", () => {
  it("fails a job in progress with a short code", async () => {
    const { store, moves } = memoryStore({ status: "structuring" });
    await failCapture(store, JOB, "timed_out");
    expect(moves).toEqual([{ to: "failed", patch: { error: "timed_out" } }]);
  });

  it("leaves a job a person has already dealt with", async () => {
    for (const status of ["ready_for_review", "confirmed", "failed"] as const) {
      const { store, moves } = memoryStore({ status });
      await failCapture(store, JOB);
      expect(moves).toEqual([]);
    }
  });
});

describe("languageFromCode", () => {
  it("reads the language from a provider code", () => {
    expect(languageFromCode("gu-IN")).toBe("gu");
    expect(languageFromCode("HI")).toBe("hi");
    expect(languageFromCode("ta-IN")).toBeNull();
    expect(languageFromCode(null)).toBeNull();
  });
});
