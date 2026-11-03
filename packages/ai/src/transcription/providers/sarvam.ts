import { z } from "zod";
import { baseMimeType, poll, request, requestJson } from "../http.ts";
import {
  TranscriptionError,
  type TranscriptionInput,
  type TranscriptionProvider,
  type TranscriptionResult,
} from "../types.ts";

// Sarvam's synchronous endpoint caps audio at 30 s, so elder recordings go through the batch job API:
// create job -> get upload URL -> upload -> start -> poll -> get download URL -> fetch result.
// https://docs.sarvam.ai/api-reference-docs/api-guides-tutorials/speech-to-text/batch-api

const BASE = "https://api.sarvam.ai/speech-to-text/job/v1";

const CreateSchema = z.object({ job_id: z.string() });
const UploadSchema = z.object({
  upload_urls: z.record(z.string(), z.object({ file_url: z.url() })),
});
const StatusSchema = z.object({
  job_state: z.string(),
  error_message: z.string().nullish(),
  job_details: z
    .array(z.object({ outputs: z.array(z.object({ file_name: z.string() })).nullish() }))
    .nullish(),
});
const DownloadSchema = z.object({
  download_urls: z.record(z.string(), z.object({ file_url: z.url() })),
});
const ResultSchema = z.object({
  transcript: z.string(),
  language_code: z.string().nullish(),
});

const LANGUAGE_CODES = { en: "en-IN", hi: "hi-IN", gu: "gu-IN" } as const;

export class SarvamTranscriptionProvider implements TranscriptionProvider {
  readonly id = "sarvam";
  readonly model: string;
  readonly #apiKey: string;

  constructor(apiKey: string, model = "saaras:v4") {
    this.#apiKey = apiKey;
    this.model = model;
  }

  async transcribe(input: TranscriptionInput): Promise<TranscriptionResult> {
    const started = performance.now();
    const headers = { "api-subscription-key": this.#apiKey, "Content-Type": "application/json" };
    const post = (url: string, body?: unknown) =>
      requestJson(this.id, url, {
        method: "POST",
        headers,
        body: body === undefined ? null : JSON.stringify(body),
      });

    const { job_id } = CreateSchema.parse(
      await post(BASE, {
        job_parameters: {
          model: this.model,
          language_code: input.language === "auto" ? "unknown" : LANGUAGE_CODES[input.language],
          with_timestamps: false,
        },
      }),
    );

    const uploads = UploadSchema.parse(
      await post(`${BASE}/upload-files`, { job_id, files: [input.filename] }),
    );
    const uploadUrl = uploads.upload_urls[input.filename]?.file_url;
    if (!uploadUrl) throw new TranscriptionError(this.id, "No upload URL returned");
    // The URL is an Azure Blob SAS URL. Sarvam does not document the upload call; this is Azure's Put Blob.
    await request(this.id, uploadUrl, {
      method: "PUT",
      headers: { "x-ms-blob-type": "BlockBlob", "Content-Type": baseMimeType(input.mimeType) },
      body: input.audio,
    });

    await post(`${BASE}/${job_id}/start`);

    const outputName = await poll(
      this.id,
      async () => {
        const status = StatusSchema.parse(
          await requestJson(this.id, `${BASE}/${job_id}/status`, { headers }),
        );
        if (status.job_state === "Failed") {
          throw new TranscriptionError(
            this.id,
            `Job failed: ${status.error_message ?? "no message"}`,
          );
        }
        if (status.job_state !== "Completed") return undefined;
        const name = status.job_details?.[0]?.outputs?.[0]?.file_name;
        if (!name) throw new TranscriptionError(this.id, "Job completed without an output file");
        return name;
      },
      { intervalMs: 3_000, timeoutMs: 10 * 60_000 },
    );

    const downloads = DownloadSchema.parse(
      await post(`${BASE}/download-files`, { job_id, files: [outputName] }),
    );
    const downloadUrl = downloads.download_urls[outputName]?.file_url;
    if (!downloadUrl) throw new TranscriptionError(this.id, "No download URL returned");
    const result = ResultSchema.parse(await requestJson(this.id, downloadUrl, {}));

    return {
      text: result.transcript,
      detectedLanguage: result.language_code ?? null,
      provider: this.id,
      model: this.model,
      latencyMs: Math.round(performance.now() - started),
    };
  }
}
