import Link from "next/link";
import { AutoRefresh } from "@/components/auto-refresh.tsx";
import { Card, EmptyState } from "@/components/ui.tsx";
import type { listOpenCaptures } from "@/lib/data.ts";
import { getT } from "@/lib/i18n/server.ts";

type Capture = Awaited<ReturnType<typeof listOpenCaptures>>[number];

const IN_PROGRESS = new Set(["uploaded", "transcribing", "structuring"]);

/** Recordings and pages waiting on the pipeline or on a person, with honest progress. */
export async function CaptureList({
  familyId,
  captures,
}: {
  familyId: string;
  captures: Capture[];
}) {
  const { t } = await getT();

  if (captures.length === 0) {
    return <EmptyState title={t("captures.emptyTitle")} body={t("captures.emptyBody")} />;
  }

  function title(capture: Capture): string {
    if (!capture.personName) return t("captures.someone");
    const key = capture.sourceType === "handwriting" ? "captures.pageFrom" : "captures.voiceFrom";
    return t(key, { name: capture.personName });
  }

  function progress(capture: Capture): string {
    const name = capture.personName ?? "";
    switch (capture.status) {
      case "uploaded":
        return t("captures.uploaded");
      case "transcribing":
        return t("captures.transcribing", { name });
      case "structuring":
        return t(
          capture.sourceType === "handwriting"
            ? "captures.structuringPage"
            : "captures.structuring",
        );
      case "ready_for_review":
        return t("captures.ready");
      default:
        return t("captures.failed");
    }
  }

  return (
    <>
      <AutoRefresh active={captures.some((capture) => IN_PROGRESS.has(capture.status))} />
      <ul className="flex flex-col gap-3">
        {captures.map((capture) => (
          <li key={capture.id}>
            <Card
              className="flex flex-col gap-1"
              data-testid="capture"
              data-status={capture.status}
            >
              <Link
                href={`/vault/${familyId}/captures/${capture.id}`}
                className="min-h-tap-target py-2 text-lg font-semibold underline-offset-4 hover:underline"
              >
                {title(capture)}
              </Link>
              <span role="status" className="text-muted">
                {progress(capture)}
              </span>
            </Card>
          </li>
        ))}
      </ul>
    </>
  );
}
