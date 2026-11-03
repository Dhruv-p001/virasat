import { z } from "zod";

/**
 * One real recording in the STT eval set. Audio and reference transcripts live in
 * eval/stt/data/ (gitignored): these are elders' voices and never go into the repo.
 */
export const EvalRecordingSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/),
  /** Path relative to eval/stt/data/. */
  audio: z.string().min(1),
  mimeType: z.string().startsWith("audio/"),
  /** Hand-checked transcript in the script the family would expect (Gujarati or Devanagari). */
  reference: z.string().min(1),
  /** Main language spoken. "mixed" for heavy code-switching. */
  language: z.enum(["gu", "hi", "mixed"]),
  speaker: z.object({
    ageBand: z.enum(["60-69", "70-79", "80+"]),
    region: z.string().min(1).optional(),
  }),
  recording: z.object({
    device: z.string().min(1),
    environment: z.enum(["quiet", "kitchen", "noisy"]),
  }),
  /** Nothing enters the eval set without recorded consent. */
  consent: z.object({
    givenBy: z.string().min(1),
    recordedOn: z.iso.date(),
    allowsThirdPartyProcessing: z.literal(true),
  }),
});
export type EvalRecording = z.infer<typeof EvalRecordingSchema>;

export const EvalManifestSchema = z
  .array(EvalRecordingSchema)
  .min(1)
  .refine((items) => new Set(items.map((i) => i.id)).size === items.length, "Duplicate ids");
