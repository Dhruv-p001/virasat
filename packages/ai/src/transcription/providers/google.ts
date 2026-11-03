import { z } from "zod";
import { baseMimeType, poll, request, requestJson } from "../http.ts";
import {
  TranscriptionError,
  type TranscriptionInput,
  type TranscriptionProvider,
  type TranscriptionResult,
} from "../types.ts";

// Google's synchronous recognize caps audio at 60 s, and BatchRecognize only reads from Cloud Storage.
// So: upload to a private GCS bucket -> batchRecognize with an inline result -> poll -> delete the object.
// https://docs.cloud.google.com/speech-to-text/v2/docs/reference/rest/v2/projects.locations.recognizers/batchRecognize

export interface GoogleOptions {
  /** OAuth access token, e.g. from `gcloud auth print-access-token`. Expires after about an hour. */
  accessToken: string;
  projectId: string;
  /** Private bucket for temporary audio. Objects are deleted after each transcription. */
  bucket: string;
  /** Multi-region hosting chirp_3: "us" or "eu". */
  location?: string;
  model?: string;
}

const OperationSchema = z.object({
  name: z.string(),
  done: z.boolean().optional(),
  error: z.object({ message: z.string() }).optional(),
  response: z
    .object({
      results: z.record(
        z.string(),
        z.object({
          error: z.object({ message: z.string() }).optional(),
          inlineResult: z
            .object({
              transcript: z.object({
                results: z
                  .array(
                    z.object({
                      alternatives: z
                        .array(z.object({ transcript: z.string().optional() }))
                        .optional(),
                      languageCode: z.string().optional(),
                    }),
                  )
                  .optional(),
              }),
            })
            .optional(),
        }),
      ),
    })
    .optional(),
});

const LANGUAGE_CODES = { en: "en-IN", hi: "hi-IN", gu: "gu-IN" } as const;

export class GoogleChirpTranscriptionProvider implements TranscriptionProvider {
  readonly id = "google";
  readonly model: string;
  readonly #options: Required<GoogleOptions>;

  constructor(options: GoogleOptions) {
    this.#options = { location: "us", model: "chirp_3", ...options };
    this.model = this.#options.model;
  }

  async transcribe(input: TranscriptionInput): Promise<TranscriptionResult> {
    const { accessToken, projectId, bucket, location } = this.#options;
    const auth = { Authorization: `Bearer ${accessToken}` };
    const objectName = `stt-eval/${crypto.randomUUID()}-${input.filename}`;
    const started = performance.now();

    await request(
      this.id,
      `https://storage.googleapis.com/upload/storage/v1/b/${bucket}/o?uploadType=media&name=${encodeURIComponent(objectName)}`,
      {
        method: "POST",
        headers: { ...auth, "Content-Type": baseMimeType(input.mimeType) },
        body: input.audio,
      },
    );

    try {
      const host = `https://${location}-speech.googleapis.com/v2`;
      const uri = `gs://${bucket}/${objectName}`;
      let operation = OperationSchema.parse(
        await requestJson(
          this.id,
          `${host}/projects/${projectId}/locations/${location}/recognizers/_:batchRecognize`,
          {
            method: "POST",
            headers: { ...auth, "Content-Type": "application/json" },
            body: JSON.stringify({
              config: {
                model: this.model,
                languageCodes: [
                  input.language === "auto" ? "auto" : LANGUAGE_CODES[input.language],
                ],
                autoDecodingConfig: {},
                features: { enableAutomaticPunctuation: true },
              },
              files: [{ uri }],
              recognitionOutputConfig: { inlineResponseConfig: {} },
            }),
          },
        ),
      );

      operation = await poll(
        this.id,
        async () => {
          const current = OperationSchema.parse(
            await requestJson(this.id, `${host}/${operation.name}`, { headers: auth }),
          );
          return current.done ? current : undefined;
        },
        { intervalMs: 3_000, timeoutMs: 10 * 60_000 },
      );

      if (operation.error) throw new TranscriptionError(this.id, operation.error.message);
      const fileResult = operation.response?.results[uri];
      if (!fileResult)
        throw new TranscriptionError(this.id, "Operation finished without a result for the file");
      if (fileResult.error) throw new TranscriptionError(this.id, fileResult.error.message);

      const segments = fileResult.inlineResult?.transcript.results ?? [];
      return {
        text: segments
          .map((s) => s.alternatives?.[0]?.transcript?.trim() ?? "")
          .filter(Boolean)
          .join(" "),
        detectedLanguage: segments.find((s) => s.languageCode)?.languageCode ?? null,
        provider: this.id,
        model: this.model,
        latencyMs: Math.round(performance.now() - started),
      };
    } finally {
      // Elder audio must not linger in a third-party bucket.
      await request(
        this.id,
        `https://storage.googleapis.com/storage/v1/b/${bucket}/o/${encodeURIComponent(objectName)}`,
        {
          method: "DELETE",
          headers: auth,
        },
      ).catch((error: unknown) => {
        console.error(`Could not delete gs://${bucket}/${objectName}; delete it by hand.`, error);
      });
    }
  }
}
