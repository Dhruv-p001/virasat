import { StructuredRecipeSchema } from "@virasat/core";
import { z } from "zod";
import type { ModelClient, UserContentPart } from "./model-client.ts";
import type {
  ManualEntryReason,
  NeedsManualEntry,
  StructuringResult,
  StructuringUsage,
} from "./types.ts";
import { describeIssues, validateRecipe } from "./validate.ts";

export const DEFAULT_MAX_ATTEMPTS = 3;

/** What the model returns for a text transcript: the recipe itself. */
export const StructureOutputSchema = StructuredRecipeSchema;

/** What the model returns for a handwritten page: the text it read, then the recipe built from it. */
export const HandwritingOutputSchema = z.object({
  transcript: z.string().trim().min(1),
  recipe: StructuredRecipeSchema,
});

export interface Task<T> {
  client: ModelClient;
  system: string;
  user: UserContentPart[];
  outputSchema: z.ZodType<T>;
  maxTokens: number;
  promptVersion: string;
  maxAttempts: number;
  /** Picks the recipe and the text it was built from out of a parsed answer. */
  select: (output: T) => { recipe: unknown; transcript: string };
  /** The text read so far, from an answer that did not fully parse. Null when there is none. */
  salvageTranscript: (raw: unknown) => string | null;
  /** Text to hand back if every attempt fails. */
  fallbackTranscript: string;
}

/**
 * Runs one structuring task: call, check the stop reason, validate, and on invalid output retry
 * with the problems listed, up to `maxAttempts`. A cut-off or refused answer is not retried: the
 * same request would fail the same way. Never throws and never returns unvalidated data.
 */
export async function runTask<T>(task: Task<T>): Promise<StructuringResult> {
  const usage: StructuringUsage = {
    model: task.client.model,
    calls: 0,
    inputTokens: 0,
    outputTokens: 0,
  };
  let transcript = task.fallbackTranscript;
  let issues: string[] = [];

  const giveUp = (reason: ManualEntryReason, why: string[]) =>
    manualEntry(task.promptVersion, reason, transcript, why, usage);

  for (let attempt = 1; attempt <= task.maxAttempts; attempt++) {
    const user =
      issues.length === 0
        ? task.user
        : [...task.user, { type: "text" as const, text: retryNote(issues) }];

    let response;
    try {
      response = await task.client.call({
        system: task.system,
        user,
        outputSchema: task.outputSchema,
        maxTokens: task.maxTokens,
      });
    } catch (error) {
      // Transient API errors were already retried by the client. Keep the error class, not its message.
      const name = error instanceof Error ? error.name : "UnknownError";
      return giveUp("provider_error", [`provider: ${name}`]);
    }
    usage.calls += 1;
    usage.inputTokens += response.inputTokens;
    usage.outputTokens += response.outputTokens;

    if (response.stopReason === "max_tokens")
      return giveUp("truncated", ["stop_reason: max_tokens"]);
    if (response.stopReason === "refusal") {
      return giveUp("refused", [`refusal: ${response.refusalCategory ?? "uncategorised"}`]);
    }

    const salvaged = task.salvageTranscript(response.output);
    if (salvaged !== null) transcript = salvaged;

    const parsed = task.outputSchema.safeParse(response.output);
    if (!parsed.success) {
      issues = describeIssues(parsed.error);
      continue;
    }
    const draft = task.select(parsed.data);
    transcript = draft.transcript;

    const outcome = validateRecipe(draft.recipe, draft.transcript);
    if (outcome.ok) {
      return {
        status: "ok",
        recipe: outcome.recipe,
        transcript,
        autoFlagged: outcome.autoFlagged,
        usage,
        promptVersion: task.promptVersion,
      };
    }
    issues = outcome.issues;
  }

  return giveUp("invalid_output", issues);
}

/** A result for input that never reached the model: nothing to read, or images that failed pre-checks. */
export function rejectedInput(
  promptVersion: string,
  model: string,
  reason: "empty_input" | "invalid_input",
  transcript: string,
  issues: string[],
): NeedsManualEntry {
  return manualEntry(promptVersion, reason, transcript, issues, {
    model,
    calls: 0,
    inputTokens: 0,
    outputTokens: 0,
  });
}

function manualEntry(
  promptVersion: string,
  reason: ManualEntryReason,
  transcript: string,
  issues: string[],
  usage: StructuringUsage,
): NeedsManualEntry {
  return { status: "needs_manual_entry", reason, transcript, issues, usage, promptVersion };
}

function retryNote(issues: string[]): string {
  return [
    "Your previous answer was rejected. Fix these problems and answer again, following every rule:",
    ...issues.map((issue) => `- ${issue}`),
  ].join("\n");
}
