import type { PostgrestError } from "@supabase/supabase-js";

/**
 * Result of a form's server action, read by useActionState. Messages are i18n keys.
 * React resets a form after its action runs, so failed submissions return what was typed
 * (`values`) and the fields use it as their default.
 */
export type ActionState<T = undefined> =
  | { status: "idle" }
  | {
      status: "error";
      message?: string;
      fieldErrors?: Record<string, string>;
      values?: Record<string, string>;
    }
  | { status: "success"; message?: string; data?: T };

export const idle: ActionState<never> = { status: "idle" };

/** The submitted text fields, to hand back on error. */
export function submittedValues(formData: FormData): Record<string, string> {
  const values: Record<string, string> = {};
  for (const [key, value] of formData) {
    if (typeof value === "string" && !key.startsWith("$")) values[key] = value;
  }
  return values;
}

/** Maps a database refusal to a message the user can act on. */
export function databaseError(
  error: Pick<PostgrestError, "code" | "message">,
  formData?: FormData,
): { status: "error"; message: string; values?: Record<string, string> } {
  const values = formData ? { values: submittedValues(formData) } : {};
  if (error.code === "23514" && error.message.includes("owner")) {
    return { status: "error", message: "members.lastOwner", ...values };
  }
  if (error.code === "42501") return { status: "error", message: "errors.notAllowed", ...values };
  return { status: "error", message: "errors.generic", ...values };
}
