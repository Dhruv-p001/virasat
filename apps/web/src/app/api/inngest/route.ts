import { functions, inngest } from "@virasat/jobs";
import { serve } from "inngest/next";

// The capture pipeline. Inngest calls this route to run each step; in development the Inngest dev
// server does (see the README). A speech-to-text call can take a while, so allow a long run.
export const maxDuration = 300;

export const { GET, POST, PUT } = serve({ client: inngest, functions });
