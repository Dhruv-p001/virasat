import { TranscriptionError } from "./types.ts";

/** fetch that turns any non-2xx into a TranscriptionError carrying the provider's message. */
export async function request(provider: string, url: string, init: RequestInit): Promise<Response> {
  const response = await fetch(url, init);
  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new TranscriptionError(
      provider,
      `${init.method ?? "GET"} ${new URL(url).pathname} failed: ${response.status} ${body.slice(0, 500)}`,
      response.status,
    );
  }
  return response;
}

export async function requestJson(
  provider: string,
  url: string,
  init: RequestInit,
): Promise<unknown> {
  return (await request(provider, url, init)).json();
}

/** Polls until `check` returns a value, or throws after `timeoutMs`. */
export async function poll<T>(
  provider: string,
  check: () => Promise<T | undefined>,
  { intervalMs, timeoutMs }: { intervalMs: number; timeoutMs: number },
): Promise<T> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const result = await check();
    if (result !== undefined) return result;
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
  throw new TranscriptionError(provider, `Timed out after ${timeoutMs} ms`);
}

/** Strips codec parameters: "audio/webm;codecs=opus" -> "audio/webm". */
export function baseMimeType(mimeType: string): string {
  return mimeType.split(";")[0]?.trim() ?? mimeType;
}
