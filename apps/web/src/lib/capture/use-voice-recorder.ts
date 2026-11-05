"use client";

import { baseMimeType, MAX_RECORDING_SECONDS, pickRecordingMimeType } from "@virasat/core";
import { useCallback, useEffect, useRef, useState } from "react";

// The browser's own MediaRecorder, shared by the elder's page and the organiser's. Plain React:
// nothing else is shipped to the phone. The caller decides what to do with the recording.

export type RecorderProblem = "unsupported" | "micDenied";

type Handlers = {
  /** Recording has begun (the microphone is open). */
  onStarted?: () => void;
  onProblem: (problem: RecorderProblem) => void;
  /** Recording ended, by the person or at the length limit. Null when nothing was captured. */
  onFinished: (blob: Blob | null) => void;
};

export function useVoiceRecorder(handlers: Handlers) {
  const latest = useRef(handlers);
  useEffect(() => {
    latest.current = handlers;
  });

  const [seconds, setSeconds] = useState(0);
  const [limitHit, setLimitHit] = useState(false);

  const recorder = useRef<MediaRecorder | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const chunks = useRef<Blob[]>([]);
  const tick = useRef<ReturnType<typeof setInterval> | null>(null);

  const releaseMic = useCallback(() => {
    if (tick.current) clearInterval(tick.current);
    tick.current = null;
    for (const track of stream.current?.getTracks() ?? []) track.stop();
    stream.current = null;
  }, []);

  useEffect(() => releaseMic, [releaseMic]);

  const stop = useCallback(() => {
    if (recorder.current?.state === "recording") recorder.current.stop();
  }, []);

  const start = useCallback(async () => {
    const mimeType =
      typeof MediaRecorder === "undefined"
        ? null
        : pickRecordingMimeType((type) => MediaRecorder.isTypeSupported(type));
    // Undefined on pages that are not served over https.
    const devices = navigator.mediaDevices as MediaDevices | undefined;
    if (!devices || !mimeType) {
      latest.current.onProblem("unsupported");
      return;
    }
    try {
      stream.current = await devices.getUserMedia({ audio: true });
    } catch {
      latest.current.onProblem("micDenied");
      return;
    }

    chunks.current = [];
    setLimitHit(false);
    setSeconds(0);
    const media = new MediaRecorder(stream.current, { mimeType });
    recorder.current = media;
    media.ondataavailable = (event) => {
      if (event.data.size > 0) chunks.current.push(event.data);
    };
    media.onstop = () => {
      releaseMic();
      const blob = new Blob(chunks.current, { type: baseMimeType(media.mimeType || mimeType) });
      chunks.current = [];
      latest.current.onFinished(blob.size === 0 ? null : blob);
    };

    const startedAt = performance.now();
    tick.current = setInterval(() => {
      const elapsed = (performance.now() - startedAt) / 1000;
      setSeconds(elapsed);
      if (elapsed >= MAX_RECORDING_SECONDS) {
        setLimitHit(true);
        stop();
      }
    }, 250);
    media.start(1000);
    latest.current.onStarted?.();
  }, [releaseMic, stop]);

  return { start, stop, seconds, limitHit };
}
