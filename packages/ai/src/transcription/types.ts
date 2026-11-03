import type { Language } from "@virasat/core";

export interface TranscriptionInput {
  audio: Uint8Array<ArrayBuffer>;
  /** MIME type as recorded, e.g. "audio/webm;codecs=opus" (Android Chrome) or "audio/mp4" (iOS Safari). */
  mimeType: string;
  filename: string;
  /** "auto" asks the provider to detect the language. */
  language: Language | "auto";
}

export interface TranscriptionResult {
  text: string;
  /** Provider-reported language code, as returned (e.g. "gu-IN"). Null when the provider does not say. */
  detectedLanguage: string | null;
  provider: string;
  model: string;
  /** Wall-clock time for the provider call. */
  latencyMs: number;
}

/** Every speech-to-text provider sits behind this. Swapping one must not touch app code. */
export interface TranscriptionProvider {
  readonly id: string;
  readonly model: string;
  transcribe(input: TranscriptionInput): Promise<TranscriptionResult>;
}

export class TranscriptionError extends Error {
  readonly provider: string;
  readonly status: number | null;

  constructor(provider: string, message: string, status: number | null = null) {
    super(`[${provider}] ${message}`);
    this.name = "TranscriptionError";
    this.provider = provider;
    this.status = status;
  }
}
