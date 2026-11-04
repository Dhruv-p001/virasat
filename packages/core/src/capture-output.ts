import { z } from "zod";
import { StructuredRecipeSchema } from "./recipe.ts";

/**
 * What the pipeline stores in `capture_jobs.ai_output` when a draft is ready for review. The review
 * screen reads the recipe from here. Nothing in it is published: a person confirms it first.
 */
export const CaptureAiOutputSchema = z.object({
  recipe: StructuredRecipeSchema,
  /** Pointers the pipeline added to `recipe.uncertain_fields` because they could not be traced to the source. */
  auto_flagged: z.array(z.string()),
  prompt_version: z.string(),
});
export type CaptureAiOutput = z.infer<typeof CaptureAiOutputSchema>;

/** The pipeline's reasons for failing a capture. Short codes: a reason never contains content. */
export const CAPTURE_FAILURE_PREFIX_MANUAL = "manual_entry:";
export const CAPTURE_FAILURE_TIMED_OUT = "timed_out";
export const CAPTURE_FAILURE_PIPELINE = "pipeline_error";
