import "server-only";
import { sendCaptureUploaded } from "@virasat/jobs";

/**
 * Starts the capture pipeline for an upload the server has confirmed. The files are already safe,
 * so a failure here must not fail the upload: the sweep resends the event for any capture left in
 * "uploaded". Only the error class is logged, never anything about the capture.
 */
export async function startPipeline(jobId: string): Promise<void> {
  try {
    await sendCaptureUploaded(jobId);
  } catch (error) {
    console.error(
      "capture pipeline event not sent",
      error instanceof Error ? error.name : "unknown",
    );
  }
}
