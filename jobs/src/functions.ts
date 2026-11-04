import { resolveAi } from "@virasat/ai";
import { CAPTURE_FAILURE_TIMED_OUT } from "@virasat/core";
import { Inngest } from "inngest";
import { z } from "zod";
import {
  failCapture,
  structureCapture,
  transcribeCapture,
  type PipelineDeps,
  type PipelineStore,
} from "./pipeline.ts";
import { createJobsClient, findStaleCaptures, supabaseStore } from "./store.ts";

export const inngest = new Inngest({ id: "virasat" });

/** Sent when an upload is confirmed. Carries the job id and nothing else. */
export const CAPTURE_UPLOADED = "capture/uploaded";

const UploadedEvent = z.object({ jobId: z.uuid() });

export async function sendCaptureUploaded(jobId: string): Promise<void> {
  await inngest.send({ name: CAPTURE_UPLOADED, data: { jobId } });
}

function deps(): PipelineDeps {
  return { store: supabaseStore(createJobsClient()), ai: resolveAi(process.env) };
}

/** Uploaded captures older than this get their event sent again: the first one may have been lost. */
const RESEND_AFTER_MS = 2 * 60 * 1000;
/** A capture that has made no progress for this long is failed, so the organiser is never left waiting. */
const GIVE_UP_AFTER_MS = 15 * 60 * 1000;

export const processCapture = inngest.createFunction(
  {
    id: "process-capture",
    triggers: [{ event: CAPTURE_UPLOADED }],
    retries: 3,
    // One run per capture at a time, so a re-sent event cannot transcribe the same audio twice.
    concurrency: { limit: 1, key: "event.data.jobId" },
    onFailure: async ({ event }) => {
      const { jobId } = UploadedEvent.parse(event.data.event.data);
      await failCapture(supabaseStore(createJobsClient()), jobId);
    },
  },
  async ({ event, step }) => {
    const { jobId } = UploadedEvent.parse(event.data);
    // Steps return a short word, never content: Inngest stores step results.
    await step.run("transcribe", async () => transcribeCapture(deps(), jobId));
    return step.run("structure", async () => structureCapture(deps(), jobId));
  },
);

/** Every few minutes: nudge captures whose event went missing, and fail those that are stuck. */
export const sweepCaptures = inngest.createFunction(
  { id: "sweep-captures", triggers: [{ cron: "*/5 * * * *" }] },
  async ({ step }) =>
    step.run("sweep", async () => {
      const admin = createJobsClient();
      const store: PipelineStore = supabaseStore(admin);
      const now = Date.now();
      const giveUp = new Date(now - GIVE_UP_AFTER_MS);

      let resent = 0;
      for (const jobId of await findStaleCaptures(
        admin,
        "uploaded",
        new Date(now - RESEND_AFTER_MS),
      )) {
        await sendCaptureUploaded(jobId);
        resent += 1;
      }
      let failed = 0;
      for (const status of ["uploaded", "transcribing", "structuring"] as const) {
        for (const jobId of await findStaleCaptures(admin, status, giveUp)) {
          await failCapture(store, jobId, CAPTURE_FAILURE_TIMED_OUT);
          failed += 1;
        }
      }
      return { resent, failed };
    }),
);

export const functions = [processCapture, sweepCaptures];
