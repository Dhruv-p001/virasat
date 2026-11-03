import type { TranscriptionProvider } from "../types.ts";
import { GoogleChirpTranscriptionProvider } from "./google.ts";
import { OpenAITranscriptionProvider } from "./openai.ts";
import { SarvamTranscriptionProvider } from "./sarvam.ts";

export {
  GoogleChirpTranscriptionProvider,
  OpenAITranscriptionProvider,
  SarvamTranscriptionProvider,
};

/** Every provider whose credentials are present in `env`. */
export function configuredProviders(
  env: Record<string, string | undefined>,
): TranscriptionProvider[] {
  const providers: TranscriptionProvider[] = [];
  if (env.SARVAM_API_KEY) providers.push(new SarvamTranscriptionProvider(env.SARVAM_API_KEY));
  if (env.OPENAI_API_KEY) providers.push(new OpenAITranscriptionProvider(env.OPENAI_API_KEY));
  if (env.GOOGLE_ACCESS_TOKEN && env.GOOGLE_PROJECT_ID && env.GOOGLE_STT_BUCKET) {
    providers.push(
      new GoogleChirpTranscriptionProvider({
        accessToken: env.GOOGLE_ACCESS_TOKEN,
        projectId: env.GOOGLE_PROJECT_ID,
        bucket: env.GOOGLE_STT_BUCKET,
        ...(env.GOOGLE_STT_LOCATION ? { location: env.GOOGLE_STT_LOCATION } : {}),
      }),
    );
  }
  return providers;
}
