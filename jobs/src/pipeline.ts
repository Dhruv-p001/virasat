import {
  type AiRuntime,
  type ImageMimeType,
  type StructuringResult,
  type StructuringUsage,
} from "@virasat/ai";
import {
  CAPTURE_FAILURE_PIPELINE,
  CAPTURE_FAILURE_PREFIX_MANUAL,
  type CaptureAiOutput,
  LanguageSchema,
  type Language,
} from "@virasat/core";

// The capture pipeline's logic, free of Inngest and of Supabase so it is tested without either.
// Recipe content (the audio, the transcript, the draft) moves between storage, the AI providers
// and the database. It is never returned from a step, because Inngest keeps step results, and it
// is never logged (brief section 9).

export type CaptureStatus =
  | "awaiting_upload"
  | "uploaded"
  | "transcribing"
  | "structuring"
  | "ready_for_review"
  | "failed"
  | "confirmed";

export interface CaptureMedia {
  bucket: string;
  path: string;
  mimeType: string;
}

export interface CaptureRecord {
  id: string;
  status: CaptureStatus;
  sourceType: "voice" | "handwriting";
  transcript: string | null;
  detectedLanguage: string | null;
  speaker: { name: string; relation: string | null };
  /**
   * The files to read, oldest first: each original, or its readable copy when it has one. A voice
   * capture has just its recording. A handwriting capture has its pages in order.
   */
  media: CaptureMedia[];
}

export interface AdvancePatch {
  transcript?: string;
  detectedLanguage?: string;
  aiOutput?: CaptureAiOutput;
  error?: string;
  providerMeta?: Record<string, unknown>;
}

export interface PipelineStore {
  load(jobId: string): Promise<CaptureRecord | null>;
  download(media: CaptureMedia): Promise<Uint8Array<ArrayBuffer>>;
  /** Moves the job along the state machine in `advance_capture()`. Throws when the move is refused. */
  advance(jobId: string, to: CaptureStatus, patch?: AdvancePatch): Promise<void>;
}

export interface PipelineDeps {
  store: PipelineStore;
  ai: AiRuntime;
}

/** Language for the model, from a provider's code such as "gu-IN". Null when unknown. */
export function languageFromCode(code: string | null): Language | null {
  const parsed = LanguageSchema.safeParse(code?.slice(0, 2).toLowerCase());
  return parsed.success ? parsed.data : null;
}

function extensionOf(mimeType: string): string {
  const subtype = mimeType.split("/")[1] ?? "bin";
  return subtype.replace(/^x-/, "");
}

function usageMeta(usage: StructuringUsage) {
  return {
    model: usage.model,
    calls: usage.calls,
    input_tokens: usage.inputTokens,
    output_tokens: usage.outputTokens,
  };
}

/** Jobs a pipeline run may still work on. Anything else has been dealt with already. */
const WORKABLE: readonly CaptureStatus[] = ["uploaded", "transcribing", "structuring"];

/**
 * Step 1. A recording becomes a transcript (voice), or the capture simply moves on to structuring
 * (handwriting is read from the image in step 2). Safe to run again: it picks up wherever a
 * crashed run stopped. Throws when the speech-to-text provider fails, so Inngest retries it.
 */
export async function transcribeCapture(
  deps: PipelineDeps,
  jobId: string,
): Promise<"done" | "skip"> {
  const job = await deps.store.load(jobId);
  if (!job || !WORKABLE.includes(job.status)) return "skip";
  if (job.status === "structuring") return "done";

  if (job.sourceType === "handwriting") {
    await deps.store.advance(job.id, "structuring");
    return "done";
  }

  if (job.status === "uploaded") await deps.store.advance(job.id, "transcribing");
  const original = job.media[0];
  if (!original) throw new Error("The capture has no recording");
  const audio = await deps.store.download(original);
  const heard = await deps.ai.transcription.transcribe({
    audio,
    mimeType: original.mimeType,
    filename: `recording.${extensionOf(original.mimeType)}`,
    language: "auto",
  });
  await deps.store.advance(job.id, "structuring", {
    transcript: heard.text,
    ...(heard.detectedLanguage ? { detectedLanguage: heard.detectedLanguage } : {}),
    providerMeta: {
      mode: deps.ai.mode,
      stt: { provider: heard.provider, model: heard.model, latency_ms: heard.latencyMs },
    },
  });
  return "done";
}

async function structure(deps: PipelineDeps, job: CaptureRecord): Promise<StructuringResult> {
  const language = languageFromCode(job.detectedLanguage);
  if (job.sourceType === "voice") {
    return deps.ai.structurer.structure({
      transcript: job.transcript ?? "",
      language,
      speaker: job.speaker,
    });
  }
  const images = await Promise.all(
    job.media.map(async (media) => ({
      data: await deps.store.download(media),
      mimeType: media.mimeType as ImageMimeType,
    })),
  );
  return deps.ai.handwriting.read({ images, language, speaker: job.speaker });
}

/**
 * Step 2. The transcript (or the page image) becomes a draft recipe for a person to review. The
 * AI giving up is not an error: the capture is marked failed with the transcript kept, and the
 * review screen offers manual entry. Throws only when something unexpected breaks.
 */
export async function structureCapture(
  deps: PipelineDeps,
  jobId: string,
): Promise<"ready" | "manual" | "skip"> {
  const job = await deps.store.load(jobId);
  if (job?.status !== "structuring") return "skip";

  const result = await structure(deps, job);
  const providerMeta = {
    structurer: {
      id: deps.ai.structurer.id,
      model: result.usage.model,
      prompt_version: result.promptVersion,
      usage: usageMeta(result.usage),
    },
  };

  if (result.status === "needs_manual_entry") {
    await deps.store.advance(job.id, "failed", {
      error: `${CAPTURE_FAILURE_PREFIX_MANUAL}${result.reason}`,
      ...(result.transcript === "" ? {} : { transcript: result.transcript }),
      providerMeta,
    });
    return "manual";
  }

  await deps.store.advance(job.id, "ready_for_review", {
    ...(job.sourceType === "handwriting" ? { transcript: result.transcript } : {}),
    aiOutput: {
      recipe: result.recipe,
      auto_flagged: result.autoFlagged,
      prompt_version: result.promptVersion,
    },
    providerMeta,
  });
  return "ready";
}

/**
 * Called when a step has used up its retries. The capture is failed with a short code and the
 * organiser can still enter the recipe by hand. A job that has moved on (a person already
 * confirmed it) is left alone.
 */
export async function failCapture(
  store: PipelineStore,
  jobId: string,
  code: string = CAPTURE_FAILURE_PIPELINE,
): Promise<void> {
  const job = await store.load(jobId);
  if (!job || !WORKABLE.includes(job.status)) return;
  await store.advance(job.id, "failed", { error: code });
}
