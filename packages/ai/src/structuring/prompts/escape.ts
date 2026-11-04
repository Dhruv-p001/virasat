/**
 * Prompt text from outside (a transcript, a name typed into the app) goes between tags. Escaping
 * `&`, `<` and `>` means it cannot close the tag and start writing instructions. The system prompt
 * tells the model the text is escaped.
 */
export function escapeForPrompt(text: string): string {
  return text.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

const MAX_FIELD_LENGTH = 100;

/** A one-line field such as a name: whitespace collapsed (no fake new lines), capped, escaped. */
export function escapeField(text: string): string {
  return escapeForPrompt(text.replace(/\s+/g, " ").trim().slice(0, MAX_FIELD_LENGTH));
}
