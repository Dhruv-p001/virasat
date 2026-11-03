import { z } from "zod";
import { baseMimeType, requestJson } from "../http.ts";
import type { TranscriptionInput, TranscriptionProvider, TranscriptionResult } from "../types.ts";

// https://developers.openai.com/api/reference/resources/audio/subresources/transcriptions/methods/create
// One synchronous call handles a 1-6 minute phone recording (25 MB limit).

const ResponseSchema = z.object({
  text: z.string(),
  languages: z.array(z.object({ code: z.string() })).optional(),
});

export class OpenAITranscriptionProvider implements TranscriptionProvider {
  readonly id = "openai";
  readonly model: string;
  readonly #apiKey: string;

  constructor(apiKey: string, model = "gpt-transcribe") {
    this.#apiKey = apiKey;
    this.model = model;
  }

  async transcribe(input: TranscriptionInput): Promise<TranscriptionResult> {
    const form = new FormData();
    form.append(
      "file",
      new Blob([input.audio], { type: baseMimeType(input.mimeType) }),
      input.filename,
    );
    form.append("model", this.model);
    // Elders code-switch with English ("cooker", "gas"), so English is always a hint.
    if (input.language !== "auto") {
      for (const code of new Set([input.language, "en"])) form.append("languages[]", code);
    }

    const started = performance.now();
    const body = ResponseSchema.parse(
      await requestJson(this.id, "https://api.openai.com/v1/audio/transcriptions", {
        method: "POST",
        headers: { Authorization: `Bearer ${this.#apiKey}` },
        body: form,
      }),
    );
    return {
      text: body.text,
      detectedLanguage: body.languages?.map((l) => l.code).join(",") || null,
      provider: this.id,
      model: this.model,
      latencyMs: Math.round(performance.now() - started),
    };
  }
}
