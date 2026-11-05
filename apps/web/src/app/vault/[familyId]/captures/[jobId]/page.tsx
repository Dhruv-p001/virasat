import {
  CAPTURE_FAILURE_PREFIX_MANUAL,
  CAPTURE_FAILURE_TIMED_OUT,
  canWriteContent,
  reviewLanguage,
} from "@virasat/core";
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { AiModeBanner } from "@/components/ai-mode-banner.tsx";
import { AutoRefresh } from "@/components/auto-refresh.tsx";
import { Card, Notice, PageShell } from "@/components/ui.tsx";
import { getCapture, getVault } from "@/lib/data.ts";
import { getT } from "@/lib/i18n/server.ts";
import { ReviewForm } from "./review-form.tsx";

type Props = { params: Promise<{ familyId: string; jobId: string }> };

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return { title: t("review.title") };
}

const IN_PROGRESS = new Set(["uploaded", "transcribing", "structuring"]);

/**
 * The review screen (brief flow B, step 4): the original beside what the computer made of it. A
 * person checks and edits every part, and only their confirmation makes it a recipe.
 */
export default async function ReviewPage({ params }: Props) {
  const { familyId, jobId } = await params;
  const [vault, { t, locale }] = await Promise.all([getVault(familyId), getT()]);
  // Viewers don't see unreviewed captures (RLS), and have nothing to do here.
  if (!canWriteContent(vault.role)) notFound();
  const capture = await getCapture(familyId, jobId);
  const handwriting = capture.sourceType === "handwriting";
  const name = capture.personName ?? t("captures.someone");
  const back = { href: `/vault/${familyId}/captures`, label: t("captures.title") };

  // Already a recipe: the recipe is what to look at now.
  if (capture.status === "confirmed") {
    if (!capture.recipeId) notFound();
    redirect(`/vault/${familyId}/recipes/${capture.recipeId}`);
  }

  if (IN_PROGRESS.has(capture.status)) {
    return (
      <PageShell title={t("review.title")} back={back}>
        <AutoRefresh active />
        <Card role="status" className="flex flex-col gap-2">
          <h2 className="text-xl">{t("review.workingTitle")}</h2>
          <p>{t(handwriting ? "captures.structuringPage" : "captures.transcribing", { name })}</p>
        </Card>
      </PageShell>
    );
  }

  const failure = capture.failure ?? "";
  const failureKey = failure.startsWith(CAPTURE_FAILURE_PREFIX_MANUAL)
    ? "review.failedManual"
    : failure === CAPTURE_FAILURE_TIMED_OUT
      ? "review.failedTimedOut"
      : "review.failedPipeline";
  const draft = capture.draft;
  const language = reviewLanguage(capture.detectedLanguage, locale);

  return (
    <PageShell
      wide
      title={t(handwriting ? "review.titlePage" : "review.titleVoice", { name })}
      back={back}
    >
      <AiModeBanner />
      {!draft && <Notice kind="error">{t(failureKey)}</Notice>}
      {draft && <p className="-mt-4 text-muted">{t("review.intro")}</p>}

      <div className="grid gap-8 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <aside className="flex flex-col gap-6 self-start lg:sticky lg:top-4">
          <section className="flex flex-col gap-3">
            <h2 className="text-xl">
              {t(handwriting ? "review.theOriginalPages" : "review.theOriginalVoice")}
            </h2>
            {handwriting ? (
              <ol className="flex flex-col gap-3">
                {capture.pages.map((page, index) => (
                  <li key={page.url ?? index}>
                    {page.url ? (
                      // A signed, short-lived private URL: next/image would proxy and cache it.
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={page.url}
                        alt={t("capture.pageLabel", { n: index + 1 })}
                        className="w-full rounded-md border border-border"
                      />
                    ) : (
                      <p className="text-muted">{t("review.pageNotShown", { n: index + 1 })}</p>
                    )}
                  </li>
                ))}
              </ol>
            ) : capture.audioUrl ? (
              <audio
                controls
                preload="metadata"
                src={capture.audioUrl}
                aria-label={t("review.audioLabel", { name })}
                className="w-full"
                data-testid="original-audio"
              />
            ) : (
              <p className="text-muted">{t("review.audioMissing")}</p>
            )}
          </section>

          {capture.transcript && (
            <details open className="rounded-lg bg-surface p-4">
              <summary className="min-h-tap-target cursor-pointer font-semibold">
                {t(handwriting ? "review.readFromPage" : "review.transcript")}
              </summary>
              <p
                lang={capture.detectedLanguage?.slice(0, 2)}
                className="mt-2 whitespace-pre-line"
                data-testid="transcript"
              >
                {capture.transcript}
              </p>
            </details>
          )}
        </aside>

        <ReviewForm
          familyId={familyId}
          jobId={jobId}
          recipe={draft?.recipe ?? null}
          flagged={draft?.auto_flagged ?? []}
          language={language}
          transcript={draft ? null : capture.transcript}
        />
      </div>
    </PageShell>
  );
}
