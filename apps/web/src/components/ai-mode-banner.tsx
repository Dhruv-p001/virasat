import { aiModeFromEnv } from "@virasat/ai";
import { Notice } from "@/components/ui.tsx";
import { getT } from "@/lib/i18n/server.ts";

/**
 * Shown wherever AI output appears while the pipeline runs on fixtures instead of real providers
 * (no API keys: local development and CI). Production never runs in mock mode, so there it renders
 * nothing; this is so a sample recipe is never mistaken for a real one.
 */
export async function AiModeBanner() {
  if (aiModeFromEnv(process.env) !== "mock") return null;
  const { t } = await getT();
  return <Notice kind="success">{t("captures.mockBanner")}</Notice>;
}
