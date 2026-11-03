import { afterEach, describe, expect, it, vi } from "vitest";
import type { TranscriptionInput } from "../types.ts";
import { configuredProviders } from "./index.ts";
import { GoogleChirpTranscriptionProvider } from "./google.ts";
import { OpenAITranscriptionProvider } from "./openai.ts";
import { SarvamTranscriptionProvider } from "./sarvam.ts";

const input: TranscriptionInput = {
  audio: new Uint8Array([1, 2, 3]),
  mimeType: "audio/webm;codecs=opus",
  filename: "ba-thepla.webm",
  language: "gu",
};

interface Call {
  method: string;
  url: string;
  init: RequestInit;
}

/** Fake fetch: routes by "METHOD url-substring" and records every call. */
function fakeFetch(routes: [string, (call: Call) => unknown][]) {
  const calls: Call[] = [];
  const fetchMock = vi.fn((url: string, init: RequestInit = {}) => {
    const call = { method: init.method ?? "GET", url, init };
    calls.push(call);
    const route = routes.find(([key]) => {
      const [method, fragment] = key.split(" ") as [string, string];
      return method === call.method && url.includes(fragment);
    });
    if (!route)
      return Promise.resolve(new Response(`no route for ${call.method} ${url}`, { status: 404 }));
    const body = route[1](call);
    return Promise.resolve(body instanceof Response ? body : Response.json(body));
  });
  vi.stubGlobal("fetch", fetchMock);
  return calls;
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("OpenAITranscriptionProvider", () => {
  it("sends one multipart request with Gujarati and English language hints", async () => {
    const calls = fakeFetch([
      [
        "POST /v1/audio/transcriptions",
        () => ({ text: "પહેલા તેલ ગરમ કરો", languages: [{ code: "gu" }] }),
      ],
    ]);
    const result = await new OpenAITranscriptionProvider("sk-test").transcribe(input);

    expect(result).toMatchObject({
      text: "પહેલા તેલ ગરમ કરો",
      detectedLanguage: "gu",
      model: "gpt-transcribe",
    });
    const form = calls[0]?.init.body as FormData;
    expect(form.getAll("languages[]")).toEqual(["gu", "en"]);
    expect((form.get("file") as File).type).toBe("audio/webm");
    expect(new Headers(calls[0]?.init.headers).get("authorization")).toBe("Bearer sk-test");
  });

  it("omits language hints for auto-detect", async () => {
    const calls = fakeFetch([["POST /v1/audio/transcriptions", () => ({ text: "x" })]]);
    await new OpenAITranscriptionProvider("sk-test").transcribe({ ...input, language: "auto" });
    expect((calls[0]?.init.body as FormData).has("languages[]")).toBe(false);
  });

  it("surfaces API errors with status", async () => {
    fakeFetch([["POST /v1/audio/transcriptions", () => new Response("quota", { status: 429 })]]);
    await expect(
      new OpenAITranscriptionProvider("sk-test").transcribe(input),
    ).rejects.toMatchObject({
      provider: "openai",
      status: 429,
    });
  });
});

describe("SarvamTranscriptionProvider", () => {
  it("runs the batch job flow end to end", async () => {
    let polls = 0;
    const calls = fakeFetch([
      [
        "POST /job/v1/upload-files",
        () => ({ upload_urls: { "ba-thepla.webm": { file_url: "https://blob.example/up?sas" } } }),
      ],
      [
        "POST /job/v1/download-files",
        () => ({ download_urls: { "0.json": { file_url: "https://blob.example/out?sas" } } }),
      ],
      ["POST /job/v1/job-1/start", () => ({})],
      ["POST /job/v1", () => new Response(JSON.stringify({ job_id: "job-1" }), { status: 202 })],
      ["PUT blob.example/up", () => new Response(null, { status: 201 })],
      [
        "GET /job/v1/job-1/status",
        () =>
          ++polls < 2
            ? { job_state: "Running" }
            : { job_state: "Completed", job_details: [{ outputs: [{ file_name: "0.json" }] }] },
      ],
      ["GET blob.example/out", () => ({ transcript: "મુઠ્ઠી ભર બેસન", language_code: "gu-IN" })],
    ]);
    vi.useFakeTimers({ toFake: ["setTimeout"] });
    const pending = new SarvamTranscriptionProvider("key").transcribe(input);
    await vi.runAllTimersAsync();
    const result = await pending;

    expect(result).toMatchObject({
      text: "મુઠ્ઠી ભર બેસન",
      detectedLanguage: "gu-IN",
      model: "saaras:v4",
    });
    const create = JSON.parse(calls[0]?.init.body as string) as {
      job_parameters: { language_code: string };
    };
    expect(create.job_parameters.language_code).toBe("gu-IN");
    const upload = calls.find((c) => c.method === "PUT");
    expect(new Headers(upload?.init.headers).get("x-ms-blob-type")).toBe("BlockBlob");
    expect(calls.map((c) => c.method)).toEqual([
      "POST",
      "POST",
      "PUT",
      "POST",
      "GET",
      "GET",
      "POST",
      "GET",
    ]);
  });

  it("fails clearly when the job fails", async () => {
    fakeFetch([
      [
        "POST /job/v1/upload-files",
        () => ({ upload_urls: { "ba-thepla.webm": { file_url: "https://blob.example/up" } } }),
      ],
      ["POST /job/v1/job-1/start", () => ({})],
      ["POST /job/v1", () => ({ job_id: "job-1" })],
      ["PUT blob.example", () => new Response(null, { status: 201 })],
      ["GET /status", () => ({ job_state: "Failed", error_message: "unsupported audio" })],
    ]);
    await expect(new SarvamTranscriptionProvider("key").transcribe(input)).rejects.toThrow(
      "unsupported audio",
    );
  });
});

describe("GoogleChirpTranscriptionProvider", () => {
  const options = { accessToken: "token", projectId: "virasat-dev", bucket: "virasat-stt" };

  it("uploads, batch-recognises, joins segments and always deletes the object", async () => {
    const calls = fakeFetch([
      ["POST /upload/storage/v1/b/virasat-stt/o", () => ({})],
      [
        "POST /recognizers/_:batchRecognize",
        () => ({ name: "projects/p/locations/us/operations/op-1" }),
      ],
      [
        "GET /operations/op-1",
        () => {
          const objectName = decodeURIComponent(calls[0]?.url.split("name=")[1] ?? "");
          return {
            name: "projects/p/locations/us/operations/op-1",
            done: true,
            response: {
              results: {
                [`gs://virasat-stt/${objectName}`]: {
                  inlineResult: {
                    transcript: {
                      results: [
                        { alternatives: [{ transcript: "પહેલા તેલ " }], languageCode: "gu-in" },
                        { alternatives: [{ transcript: "ગરમ કરો" }] },
                      ],
                    },
                  },
                },
              },
            },
          };
        },
      ],
      ["DELETE /storage/v1/b/virasat-stt/o/", () => new Response(null, { status: 204 })],
    ]);

    const result = await new GoogleChirpTranscriptionProvider(options).transcribe(input);
    expect(result).toMatchObject({
      text: "પહેલા તેલ ગરમ કરો",
      detectedLanguage: "gu-in",
      model: "chirp_3",
    });
    const recognize = JSON.parse(calls[1]?.init.body as string) as {
      config: { languageCodes: string[] };
    };
    expect(recognize.config.languageCodes).toEqual(["gu-IN"]);
    expect(calls.at(-1)?.method).toBe("DELETE");
  });

  it("deletes the uploaded object even when recognition fails", async () => {
    const calls = fakeFetch([
      ["POST /upload/storage", () => ({})],
      ["POST /recognizers/_:batchRecognize", () => new Response("denied", { status: 403 })],
      ["DELETE /storage/v1/b/", () => new Response(null, { status: 204 })],
    ]);
    await expect(
      new GoogleChirpTranscriptionProvider(options).transcribe(input),
    ).rejects.toMatchObject({ status: 403 });
    expect(calls.at(-1)?.method).toBe("DELETE");
  });
});

describe("configuredProviders", () => {
  it("includes only providers with complete credentials", () => {
    expect(configuredProviders({}).map((p) => p.id)).toEqual([]);
    expect(
      configuredProviders({
        OPENAI_API_KEY: "k",
        GOOGLE_ACCESS_TOKEN: "t",
        GOOGLE_PROJECT_ID: "p",
      }).map((p) => p.id),
    ).toEqual(["openai"]);
  });
});
