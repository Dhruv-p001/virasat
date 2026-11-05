"use client";

import { runCaptureUpload } from "@virasat/core";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  captureApi,
  listPending,
  type Pending,
  removePending,
  savePending,
  sleepUntilOnline,
} from "./organiser-queue.ts";

export type UploadStatus = "idle" | "sending" | "waiting" | "sent" | "problem";
export type UploadProblem = "not_allowed" | "rejected";

/**
 * Sends the organiser's captures for one person, and finishes any a closed tab or a dropped
 * connection left behind. Everything stays on the device until the server confirms it.
 */
export function useCaptureUpload(personId: string) {
  const [status, setStatus] = useState<UploadStatus>("idle");
  const [problem, setProblem] = useState<UploadProblem | null>(null);
  const [resumed, setResumed] = useState(false);
  const busy = useRef(false);

  const send = useCallback(async (entry: Pending) => {
    if (busy.current) return;
    busy.current = true;
    setStatus("sending");
    setProblem(null);
    let outcome: Awaited<ReturnType<typeof runCaptureUpload>>;
    try {
      outcome = await runCaptureUpload(entry, {
        api: captureApi,
        save: savePending,
        remove: removePending,
        sleep: sleepUntilOnline,
        onWaiting: () => {
          setStatus("waiting");
        },
        onSending: () => {
          setStatus("sending");
        },
      });
    } finally {
      busy.current = false;
    }
    if (outcome === "sent") {
      setStatus("sent");
    } else {
      setProblem(outcome);
      setStatus("problem");
    }
  }, []);

  /** Saves a capture on the device, then sends it. */
  const submit = useCallback(
    async (entry: Pending) => {
      await savePending(entry);
      await send(entry);
    },
    [send],
  );

  // On load: finish anything left behind.
  useEffect(() => {
    const run = { cancelled: false };
    void (async () => {
      const pending = await listPending(personId);
      if (run.cancelled || pending.length === 0) return;
      setResumed(true);
      for (const entry of pending) await send(entry);
    })();
    return () => {
      run.cancelled = true;
    };
  }, [personId, send]);

  const retry = useCallback(async () => {
    for (const entry of await listPending(personId)) await send(entry);
  }, [personId, send]);

  /** Lets go of what could not be sent. */
  const discard = useCallback(async () => {
    for (const entry of await listPending(personId)) await removePending(entry.id);
    setProblem(null);
    setStatus("idle");
  }, [personId]);

  const reset = useCallback(() => {
    setStatus("idle");
    setProblem(null);
    setResumed(false);
  }, []);

  return { status, problem, resumed, submit, retry, discard, reset };
}
