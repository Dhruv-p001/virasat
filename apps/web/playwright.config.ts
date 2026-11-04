import { fileURLToPath } from "node:url";
import { defineConfig, devices } from "@playwright/test";

// End-to-end tests against the real local stack (`pnpm db:start`, then `pnpm env:local`).
// Locally they reuse a running dev server; CI builds and starts the app.

const isCI = Boolean(process.env.CI);

// Chromium plays this file as the microphone: elders' recordings are tested end to end with no
// real audio hardware. It loops, so any recording length gets sound.
const FAKE_MICROPHONE = fileURLToPath(
  new URL("./e2e/fixtures/recipe-fixture.wav", import.meta.url),
);

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: isCI,
  retries: isCI ? 1 : 0,
  reporter: isCI ? [["github"], ["html", { open: "never" }]] : "list",
  timeout: 60_000,
  expect: { timeout: 10_000 },
  use: {
    baseURL: "http://localhost:3000",
    trace: "retain-on-failure",
    locale: "en-GB",
    launchOptions: {
      args: [
        "--use-fake-ui-for-media-stream",
        "--use-fake-device-for-media-stream",
        `--use-file-for-fake-audio-capture=${FAKE_MICROPHONE}`,
      ],
    },
  },
  projects: [
    // Phones first: most organisers and every elder are on one.
    { name: "mobile", use: { ...devices["Pixel 7"] } },
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
  ],
  webServer: [
    {
      command: isCI ? "pnpm build && pnpm start" : "pnpm dev",
      url: "http://localhost:3000",
      reuseExistingServer: !isCI,
      timeout: 240_000,
    },
    {
      // The capture pipeline runs on Inngest. Its dev server calls back into the app above.
      command: "pnpm --workspace-root dev:inngest",
      url: "http://localhost:8288",
      reuseExistingServer: !isCI,
      timeout: 240_000,
    },
  ],
});
