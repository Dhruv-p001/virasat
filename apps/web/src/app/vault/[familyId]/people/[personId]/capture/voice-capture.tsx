"use client";

import { formatTimer } from "@virasat/core";
import Link from "next/link";
import { useState } from "react";
import { Button, ButtonLink, Card, Notice } from "@/components/ui.tsx";
import { type RecorderProblem, useVoiceRecorder } from "@/lib/capture/use-voice-recorder.ts";
import { useCaptureUpload } from "@/lib/capture/use-capture-upload.ts";
import { useT } from "@/lib/i18n/client.tsx";

/**
 * Recording a recipe in the app, sitting next to the person. The organiser confirms the person
 * knows and agrees first (docs/consent.md), and the recording stays on this device until the
 * server has it.
 */
export function VoiceCapture({
  familyId,
  personId,
  name,
}: {
  familyId: string;
  personId: string;
  name: string;
}) {
  const t = useT();
  const [agreed, setAgreed] = useState(false);
  const [recording, setRecording] = useState(false);
  const [problem, setProblem] = useState<RecorderProblem | null>(null);
  const upload = useCaptureUpload(personId);

  const voice = useVoiceRecorder({
    onStarted: () => {
      setProblem(null);
      setRecording(true);
    },
    onProblem: setProblem,
    onFinished: (blob) => {
      setRecording(false);
      if (!blob) return;
      void upload.submit({
        id: crypto.randomUUID(),
        familyId,
        personId,
        source: "voice",
        files: [{ role: "recording", page: 0, mime: blob.type, blob, size: blob.size }],
      });
    },
  });

  const waitingHref = `/vault/${familyId}/captures`;

  if (upload.status === "sending" || upload.status === "waiting") {
    const waiting = upload.status === "waiting";
    return (
      <Card className="flex flex-col gap-3" role="status">
        {upload.resumed && <p className="text-muted">{t("capture.resumed")}</p>}
        <h2 className="text-xl">{t(waiting ? "capture.waitingTitle" : "capture.sendingTitle")}</h2>
        <p>{t(waiting ? "capture.waitingBody" : "capture.sendingBody")}</p>
        {voice.limitHit && <p>{t("consent.limitReached")}</p>}
      </Card>
    );
  }

  if (upload.status === "sent") {
    return (
      <Card className="flex flex-col gap-4" role="status">
        <h2 className="text-xl">{t("capture.sentTitle")}</h2>
        <p>{t("capture.sentBody", { name })}</p>
        {voice.limitHit && <p>{t("consent.limitReached")}</p>}
        <div className="flex flex-wrap gap-3">
          <ButtonLink href={waitingHref}>{t("capture.seeWaiting")}</ButtonLink>
          <Button kind="secondary" onClick={upload.reset}>
            {t("capture.recordAnother")}
          </Button>
        </div>
      </Card>
    );
  }

  if (upload.status === "problem") {
    return (
      <Card className="flex flex-col gap-4">
        <Notice kind="error">
          {t(
            upload.problem === "not_allowed"
              ? "capture.problemNotAllowed"
              : "capture.problemRejected",
          )}
        </Notice>
        <div className="flex flex-wrap gap-3">
          <Button onClick={() => void upload.retry()}>{t("capture.tryAgain")}</Button>
          <Button kind="danger" onClick={() => void upload.discard()}>
            {t("capture.discard")}
          </Button>
        </div>
      </Card>
    );
  }

  if (recording) {
    return (
      <Card className="flex flex-col items-start gap-4">
        <p className="text-2xl font-semibold" role="timer" aria-live="off">
          <span aria-hidden className="me-3 inline-block size-3 rounded-full bg-danger" />
          {formatTimer(voice.seconds)}
        </p>
        <Button onClick={voice.stop}>{t("capture.stop")}</Button>
      </Card>
    );
  }

  return (
    <Card className="flex flex-col items-start gap-4">
      {upload.resumed && <p className="text-muted">{t("capture.resumed")}</p>}
      <label className="flex items-start gap-3">
        <input
          type="checkbox"
          checked={agreed}
          onChange={(event) => {
            setAgreed(event.target.checked);
          }}
          className="mt-1 size-6 shrink-0"
        />
        <span>{t("consent.organiserCheckbox", { name })}</span>
      </label>
      <p className="text-sm text-muted">{t("consent.organiserNote", { name })}</p>
      {problem && (
        <Notice kind="error">
          {t(problem === "micDenied" ? "record.micDenied" : "record.unsupported")}
        </Notice>
      )}
      <Button disabled={!agreed} onClick={() => void voice.start()}>
        {t("capture.start")}
      </Button>
      <Link href={waitingHref} className="text-muted underline underline-offset-4">
        {t("capture.seeWaiting")}
      </Link>
    </Card>
  );
}
