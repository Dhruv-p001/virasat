"use client";

import { formatTimer, runUpload, type UploadOutcome } from "@virasat/core";
import { useCallback, useEffect, useRef, useState } from "react";
import { Avatar } from "@/components/ui.tsx";
import { useVoiceRecorder } from "@/lib/capture/use-voice-recorder.ts";
import { useT } from "@/lib/i18n/client.tsx";
import {
  listPending,
  type Pending,
  removePending,
  savePending,
  sleepUntilOnline,
  uploadApi,
} from "./upload-queue.ts";

// The elder's whole experience: one screen at a time, one button, big text. Plain React and the
// browser's own MediaRecorder: nothing else is shipped to the phone.

type Screen =
  | "checking"
  | "invalid"
  | "consent"
  | "idle"
  | "recording"
  | "sending"
  | "sent"
  | "micDenied"
  | "unsupported"
  | "stuck";

type Person = { name: string; photoUrl: string | null };

const bigText = "text-[1.667rem] leading-snug"; // 20pt
const bigButton =
  "inline-flex min-h-[4.5rem] w-full max-w-sm items-center justify-center rounded-full bg-accent px-8 text-[1.667rem] font-semibold text-accent-ink";

export function Recorder({
  token,
  person,
}: {
  token: string;
  /** Null when the link is no longer valid. */
  person: Person | null;
}) {
  const t = useT();
  const [screen, setScreen] = useState<Screen>("checking");
  const [waiting, setWaiting] = useState(false);
  const [resumed, setResumed] = useState(false);
  const uploading = useRef(false);

  const send = useCallback(async (entry: Pending) => {
    if (uploading.current) return;
    uploading.current = true;
    setScreen("sending");
    let outcome: UploadOutcome;
    try {
      outcome = await runUpload(entry, {
        api: uploadApi,
        save: savePending,
        remove: removePending,
        sleep: sleepUntilOnline,
        onWaiting: () => {
          setWaiting(true);
        },
        onSending: () => {
          setWaiting(false);
        },
      });
    } finally {
      uploading.current = false;
    }
    setWaiting(false);
    if (outcome === "sent") setScreen("sent");
    else if (outcome === "invalid_link") setScreen("invalid");
    else setScreen("stuck");
  }, []);

  // On load: finish anything a dropped connection or closed tab left behind.
  useEffect(() => {
    const run = { cancelled: false };
    void (async () => {
      const pending = await listPending(token);
      if (run.cancelled) return;
      const first = pending[0];
      if (first) {
        setResumed(true);
        void (async () => {
          for (const entry of pending) await send(entry);
        })();
      } else {
        setScreen(person ? "consent" : "invalid");
      }
    })();
    return () => {
      run.cancelled = true;
    };
  }, [token, person, send]);

  const goIdle = useCallback(() => {
    setScreen("idle");
  }, []);

  const { start, stop, seconds, limitHit } = useVoiceRecorder({
    onStarted: () => {
      setScreen("recording");
    },
    onProblem: (problem) => {
      setScreen(problem);
    },
    onFinished: (blob) => {
      if (!blob) {
        setScreen("idle");
        return;
      }
      const entry: Pending = {
        id: crypto.randomUUID(),
        token,
        mime: blob.type,
        blob,
        size: blob.size,
      };
      // Safe on the phone before anything is sent.
      void savePending(entry).then(() => send(entry));
    },
  });

  const retryStuck = useCallback(() => {
    void (async () => {
      const pending = await listPending(token);
      if (pending.length === 0) {
        setScreen("idle");
        return;
      }
      for (const entry of pending) {
        entry.stored = false;
        entry.uploadUrl = null;
        await send(entry);
      }
    })();
  }, [send, token]);

  const header = person && (
    <div className="flex flex-col items-center gap-3 text-center">
      <Avatar name={person.name} photoUrl={person.photoUrl} size="lg" />
      <p className={`${bigText} font-serif font-semibold`}>{person.name}</p>
    </div>
  );

  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col items-center justify-center gap-8 px-5 py-8 text-center">
      {screen === "consent" && person && (
        <>
          {header}
          <h1 className="text-[2rem] font-semibold">{t("consent.title")}</h1>
          <div className={`flex flex-col gap-4 text-start ${bigText}`}>
            <p>{t("consent.elderFamily")}</p>
            <p>{t("consent.elderComputer")}</p>
            <p>{t("consent.elderKeep")}</p>
          </div>
          <button type="button" className={bigButton} onClick={goIdle}>
            {t("consent.agree")}
          </button>
        </>
      )}

      {screen === "idle" && (
        <>
          {header}
          <button
            type="button"
            aria-label={t("record.startAria")}
            onClick={() => void start()}
            className="flex size-56 items-center justify-center rounded-full bg-accent text-accent-ink shadow-lg"
          >
            <MicIcon />
          </button>
          <p className={bigText}>{t("record.tapToStart")}</p>
        </>
      )}

      {screen === "recording" && (
        <>
          {header}
          <p className={`${bigText} font-semibold`} role="timer" aria-live="off">
            <span aria-hidden className="me-3 inline-block size-4 rounded-full bg-danger" />
            {formatTimer(seconds)}
          </p>
          <button
            type="button"
            aria-label={t("record.stopAria")}
            onClick={stop}
            className="flex size-56 items-center justify-center rounded-full bg-danger text-white shadow-lg"
          >
            <span aria-hidden className="size-20 rounded-lg bg-white" />
          </button>
          <p className={bigText}>{t("record.tapToStop")}</p>
        </>
      )}

      {screen === "sending" && (
        <div role="status" className="flex flex-col gap-4">
          {resumed && <p className={bigText}>{t("record.resumed")}</p>}
          <h1 className="text-[2rem] font-semibold">
            {t(waiting ? "record.waitingTitle" : "record.sendingTitle")}
          </h1>
          <p className={bigText}>{t(waiting ? "record.waitingBody" : "record.sendingBody")}</p>
          {limitHit && <p className={bigText}>{t("consent.limitReached")}</p>}
        </div>
      )}

      {screen === "sent" && (
        <>
          <div role="status" className="flex flex-col gap-4">
            <h1 className="text-[2rem] font-semibold">{t("record.sentTitle")}</h1>
            <p className={bigText}>{t("record.sentBody")}</p>
            {limitHit && <p className={bigText}>{t("consent.limitReached")}</p>}
          </div>
          <button type="button" className={bigButton} onClick={goIdle}>
            {t("record.another")}
          </button>
        </>
      )}

      {screen === "invalid" && (
        <div role="status" className="flex flex-col gap-4">
          <h1 className="text-[2rem] font-semibold">{t("record.invalidTitle")}</h1>
          <p className={bigText}>{t("record.invalidBody")}</p>
        </div>
      )}

      {(screen === "micDenied" || screen === "unsupported" || screen === "stuck") && (
        <>
          <p role="alert" className={bigText}>
            {t(
              screen === "micDenied"
                ? "record.micDenied"
                : screen === "unsupported"
                  ? "record.unsupported"
                  : "errors.generic",
            )}
          </p>
          {screen !== "unsupported" && (
            <button
              type="button"
              className={bigButton}
              onClick={screen === "stuck" ? retryStuck : goIdle}
            >
              {t("record.retry")}
            </button>
          )}
        </>
      )}
    </main>
  );
}

function MicIcon() {
  return (
    <svg
      aria-hidden
      viewBox="0 0 24 24"
      className="size-24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="9" y="3" width="6" height="12" rx="3" fill="currentColor" />
      <path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
    </svg>
  );
}
