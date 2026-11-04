import { StructuredRecipeSchema } from "@virasat/core";
import { z } from "zod";
import type { ModelClient, UserContentPart } from "./model-client.ts";
import type {
  ManualEntryReason,
  NeedsManualEntry,
  StructuringResult,
  StructuringUsage,
} from "./types.ts";
import { validateRecipe } from "./validate.ts";

export const DEFAULT_MAX_ATTEMPTS = 3;

/**
 * JSON Schema for a tool input. Zod emits `$schema` and a non-standard `format: "starts_with"`
 * (the pointer check); the tool API needs neither, and validateRecipe enforces the pointers anyway.
 */
export function toolSchema(schema: z.ZodType): Record<string, unknown> {
  const { $schema: _ignored, ...rest } = z.toJSONSchema(schema, { io: "input" });
  return JSON.parse(
    JSON.stringify(rest, (key, value: unknown) =>
      key === "format" && value === "starts_with" ? undefined : value,
    ),
  ) as Record<string, unknown>;
}

/** What the model returns for a text transcript: the recipe itself. */
export const StructureOutputSchema = StructuredRecipeSchema;

/** What the model returns for a handwritten page: the text it read, then the recipe built from it. */
export const HandwritingOutputSchema = z.object({
  transcript: z.string(),
  recipe: StructuredRecipeSchema,
});

export interface Task {
  client: ModelClient;
  system: string;
  user: UserContentPart[];
  tool: { name: string; description: string; inputSchema: Record<string, unknown> };
  maxTokens: number;
  promptVersion: string;
  maxAttempts: number;
  /** The text ingredients must trace back to, given the model's raw tool input. Null when unreadable. */
  sourceText: (raw: unknown) => string | null;
  /** Picks the recipe out of the raw tool input. */
  recipeOf: (raw: unknown) => unknown;
  /** Text to hand back if every attempt fails. */
  fallbackTranscript: string;
}

/**
 * Runs one structuring task: call, validate, and on invalid output retry with the problems listed,
 * up to `maxAttempts`. Never throws and never returns unvalidated data.
 */
export async function runTask(task: Task): Promise<StructuringResult> {
  const usage: StructuringUsage = {
    model: task.client.model,
    calls: 0,
    inputTokens: 0,
    outputTokens: 0,
  };
  let transcript = task.fallbackTranscript;
  let issues: string[] = [];

  for (let attempt = 1; attempt <= task.maxAttempts; attempt++) {
    const user =
      issues.length === 0
        ? task.user
        : [...task.user, { type: "text" as const, text: retryNote(issues) }];

    let raw: unknown;
    try {
      const response = await task.client.call({
        system: task.system,
        user,
        tool: task.tool,
        maxTokens: task.maxTokens,
      });
      usage.calls += 1;
      usage.inputTokens += response.inputTokens;
      usage.outputTokens += response.outputTokens;
      raw = response.toolInput;
    } catch (error) {
      // Transient API errors were already retried by the client. Keep the error class, not its message.
      const name = error instanceof Error ? error.name : "UnknownError";
      return manualEntry(task, "provider_error", transcript, [`provider: ${name}`], usage);
    }

    const source = task.sourceText(raw);
    if (source !== null) transcript = source;

    const outcome = validateRecipe(task.recipeOf(raw), source ?? task.fallbackTranscript);
    if (outcome.ok && source !== null) {
      return {
        status: "ok",
        recipe: outcome.recipe,
        transcript,
        autoFlagged: outcome.autoFlagged,
        usage,
        promptVersion: task.promptVersion,
      };
    }
    issues = outcome.ok ? ["transcript: missing"] : outcome.issues;
  }

  return manualEntry(task, "invalid_output", transcript, issues, usage);
}

export function emptyInput(
  promptVersion: string,
  model: string,
  transcript: string,
): NeedsManualEntry {
  return {
    status: "needs_manual_entry",
    reason: "empty_input",
    transcript,
    issues: [],
    usage: { model, calls: 0, inputTokens: 0, outputTokens: 0 },
    promptVersion,
  };
}

function manualEntry(
  task: Task,
  reason: ManualEntryReason,
  transcript: string,
  issues: string[],
  usage: StructuringUsage,
): NeedsManualEntry {
  return {
    status: "needs_manual_entry",
    reason,
    transcript,
    issues,
    usage,
    promptVersion: task.promptVersion,
  };
}

function retryNote(issues: string[]): string {
  return [
    "Your previous answer was rejected. Fix these problems and answer again, following every rule:",
    ...issues.map((issue) => `- ${issue}`),
  ].join("\n");
}
