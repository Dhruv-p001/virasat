import { readFileSync } from "node:fs";
import type { Database } from "@virasat/db";
import { createClient } from "@supabase/supabase-js";
import { type Browser, expect, type Page, type TestInfo } from "@playwright/test";

// Local Supabase test inbox (Mailpit) and the fixed test phone numbers from supabase/config.toml.
const MAILPIT = `${process.env["MAILPIT_URL"] ?? "http://127.0.0.1:55324"}/api/v1`;
export const TEST_PHONES = ["+15555550100", "+15555550101"] as const;
const TEST_PHONE_CODE = "123456";

/** A fresh address per test, so runs never collide. */
export function uniqueEmail(label: string): string {
  return `e2e-${label}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.test`;
}

type MailpitMessage = { ID: string; Created: string };

/** Latest sign-in email for `address`: its 6-digit code and link. Polls until it arrives. */
export async function latestSignInEmail(
  address: string,
  after: Date,
): Promise<{ code: string; link: string }> {
  for (let attempt = 0; attempt < 40; attempt++) {
    const search = await fetch(
      `${MAILPIT}/search?query=${encodeURIComponent(`to:"${address}"`)}&limit=1`,
    );
    const { messages } = (await search.json()) as { messages: MailpitMessage[] };
    const message = messages[0];
    if (message && new Date(message.Created) >= new Date(after.getTime() - 1000)) {
      const full = (await (await fetch(`${MAILPIT}/message/${message.ID}`)).json()) as {
        HTML: string;
      };
      const code = /(?:>|\s)(\d{6})(?:\s|<)/.exec(full.HTML)?.[1];
      const link = /href="([^"]+)"/.exec(full.HTML)?.[1]?.replaceAll("&amp;", "&");
      if (code && link) return { code, link };
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`No sign-in email for ${address}`);
}

export async function signInWithEmail(page: Page, address: string, next = "/") {
  await page.goto(`/sign-in?next=${encodeURIComponent(next)}`);
  const sentAt = new Date();
  await page.getByLabel("Email address").fill(address);
  await page.getByRole("button", { name: "Send code" }).click();
  await expect(page.getByRole("heading", { name: "Check your email" })).toBeVisible();
  const { code } = await latestSignInEmail(address, sentAt);
  await page.getByLabel("6-digit code").fill(code);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).not.toHaveURL(/\/sign-in/);
}

export async function signInWithPhone(page: Page, phone: string) {
  await page.getByRole("tab", { name: "Phone" }).click();
  await page.getByLabel("Mobile number").fill(phone);
  await page.getByRole("button", { name: "Send code" }).click();
  await page.getByLabel("6-digit code").fill(TEST_PHONE_CODE);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).not.toHaveURL(/\/sign-in/);
}

/** New account through onboarding: signs in, names a vault, returns the vault URL. */
export async function createVaultAs(
  page: Page,
  address: string,
  vaultName: string,
): Promise<string> {
  await signInWithEmail(page, address);
  await expect(page).toHaveURL(/\/onboarding/);
  await page.getByLabel("Vault name").fill(vaultName);
  await page.getByRole("button", { name: "Create vault" }).click();
  await expect(page.getByRole("heading", { level: 1, name: vaultName })).toBeVisible();
  return page.url();
}

export async function addPerson(
  page: Page,
  vaultUrl: string,
  person: { relation: string; name: string },
) {
  await page.goto(`${vaultUrl}/people/new`);
  await page.getByLabel("What the family calls them").fill(person.relation);
  await page.getByLabel("Their name").fill(person.name);
  await page.getByRole("button", { name: "Add to vault" }).click();
  await expect(page.getByRole("heading", { level: 1, name: person.relation })).toBeVisible();
  return page.url();
}

// --- Service-role access for checking what the server stored (never used to do the user's steps).

function localEnv(name: string): string {
  const fromProcess = process.env[name];
  if (fromProcess) return fromProcess;
  const file = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
  const line = file.split("\n").find((l) => l.startsWith(`${name}=`));
  if (!line) throw new Error(`${name} is not set. Run pnpm env:local.`);
  return line.slice(name.length + 1).trim();
}

export function adminClient() {
  return createClient<Database>(
    localEnv("NEXT_PUBLIC_SUPABASE_URL"),
    localEnv("SUPABASE_SERVICE_ROLE_KEY"),
    {
      auth: { persistSession: false },
    },
  );
}

/** The account id behind a test address, for setting up what a test needs through the service role. */
export async function userIdByEmail(address: string): Promise<string> {
  const { data, error } = await adminClient().auth.admin.listUsers({ perPage: 1000 });
  if (error) throw error;
  const user = data.users.find((candidate) => candidate.email === address);
  if (!user) throw new Error(`No account for ${address}`);
  return user.id;
}

/** The last path segment of a URL: the id in /vault/<id> or /people/<id>. */
export function lastSegment(url: string): string {
  return new URL(url).pathname.split("/").filter(Boolean).pop() ?? "";
}

/** A signed-out visitor on a phone-or-desktop context like the current project's, with a microphone. */
export async function newElderPage(browser: Browser, project: TestInfo["project"]) {
  const { viewport, isMobile, hasTouch, userAgent, deviceScaleFactor, baseURL, locale } =
    project.use;
  const context = await browser.newContext({
    ...(viewport ? { viewport } : {}),
    ...(isMobile !== undefined ? { isMobile } : {}),
    ...(hasTouch !== undefined ? { hasTouch } : {}),
    ...(userAgent ? { userAgent } : {}),
    ...(deviceScaleFactor ? { deviceScaleFactor } : {}),
    ...(baseURL ? { baseURL } : {}),
    ...(locale ? { locale } : {}),
    permissions: ["microphone"],
  });
  return { context, page: await context.newPage() };
}
