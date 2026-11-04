import { type Browser, expect, type Page, test } from "@playwright/test";
import { addPerson, adminClient, createVaultAs, newElderPage, uniqueEmail } from "./helpers.ts";

// Flow B, M1: the organiser makes a recording link, the elder records through it with no
// account, and the recording reaches the server. Chromium plays a WAV file as the microphone.

async function setUpBa(page: Page, label: string) {
  const vaultUrl = await createVaultAs(page, uniqueEmail(label), "Mehta family");
  const personUrl = await addPerson(page, vaultUrl, { relation: "Ba", name: "Kantaben Mehta" });
  await page.getByRole("button", { name: "Create a recording link" }).click();
  const link = await page.getByLabel("Link for Ba").inputValue();
  return { personId: personUrl.split("/").pop() ?? "", link };
}

async function agreeAndRecord(elder: Page, seconds = 2) {
  await elder.getByRole("button", { name: "I agree. Start recording" }).click();
  await elder.getByRole("button", { name: "Start recording" }).click();
  await expect(elder.getByRole("timer")).toBeVisible();
  await elder.waitForTimeout(seconds * 1000);
  await elder.getByRole("button", { name: "Stop and send" }).click();
}

async function jobsFor(personId: string) {
  const { data, error } = await adminClient()
    .from("capture_jobs")
    .select("id, status, contributor_link_id")
    .eq("person_id", personId);
  if (error) throw error;
  return data;
}

async function openAsElder(
  browser: Browser,
  link: string,
  project: Parameters<typeof newElderPage>[1],
) {
  const { context, page } = await newElderPage(browser, project);
  const response = await page.goto(link);
  return { context, page, response };
}

test("an organiser makes a link and an elder records with no account", async ({
  page,
  browser,
}, testInfo) => {
  const { personId, link } = await setUpBa(page, "record");
  expect(link).toMatch(/\/record\/[\w-]{43}$/);
  await expect(page.getByRole("link", { name: "Send on WhatsApp" })).toHaveAttribute(
    "href",
    /^https:\/\/wa\.me\/\?text=.*record/,
  );

  const { context, page: elder, response } = await openAsElder(browser, link, testInfo.project);
  expect(response?.headers()["referrer-policy"]).toBe("no-referrer");
  expect(response?.headers()["x-robots-tag"]).toContain("noindex");

  // Ba's name, then the consent wording as written, then one big button.
  await expect(elder.getByText("Ba", { exact: true })).toBeVisible();
  await expect(elder.getByRole("heading", { name: "Before you record" })).toBeVisible();
  await expect(
    elder.getByText(
      "This recording is for your family. Only people in your family's vault can listen to it.",
    ),
  ).toBeVisible();
  await expect(
    elder.getByText("A computer listens to it and writes your recipe down."),
  ).toBeVisible();
  await expect(
    elder.getByText(
      "Your voice is kept safely in India. You can ask for it to be deleted at any time.",
    ),
  ).toBeVisible();

  await agreeAndRecord(elder);
  await expect(elder.getByRole("heading", { name: "Sent. Thank you!" })).toBeVisible();

  const jobs = await jobsFor(personId);
  expect(jobs).toHaveLength(1);
  // Confirmed, then picked up by the pipeline: it may already be on its way.
  expect(["uploaded", "transcribing", "structuring", "ready_for_review"]).toContain(
    jobs[0]?.status,
  );
  const { data: consents } = await adminClient()
    .from("consents")
    .select("kind, given_via")
    .eq("person_id", personId)
    .eq("given_via", "contributor_link");
  expect(consents?.map((c) => c.kind).sort()).toEqual([
    "third_party_processing",
    "voice_recording",
  ]);
  await context.close();
});

test("a dropped connection never loses the recording or spends a second upload", async ({
  page,
  browser,
}, testInfo) => {
  const { personId, link } = await setUpBa(page, "offline");
  const { context, page: elder } = await openAsElder(browser, link, testInfo.project);

  let refused = 0;
  await elder.route("**/storage/v1/object/upload/sign/**", async (route) => {
    if (refused < 2) {
      refused += 1;
      await route.abort("connectionfailed");
    } else {
      await route.continue();
    }
  });

  await agreeAndRecord(elder);
  await expect(elder.getByRole("heading", { name: "No connection right now" })).toBeVisible();
  await expect(elder.getByText("Your recording is safe on this phone.")).toBeVisible();
  await expect(elder.getByRole("heading", { name: "Sent. Thank you!" })).toBeVisible({
    timeout: 30_000,
  });
  expect(refused).toBe(2);
  expect(await jobsFor(personId)).toHaveLength(1);
  await context.close();
});

test("a recording left on the phone is sent when the elder comes back", async ({
  page,
  browser,
}, testInfo) => {
  const { personId, link } = await setUpBa(page, "resume");
  const { context, page: elder } = await openAsElder(browser, link, testInfo.project);

  // The whole connection to storage is down; the recording waits in IndexedDB.
  await elder.route("**/storage/v1/object/upload/sign/**", (route) =>
    route.abort("connectionfailed"),
  );
  await agreeAndRecord(elder);
  await expect(elder.getByRole("heading", { name: "No connection right now" })).toBeVisible();

  // She closes the tab and opens the link again later, with the connection back.
  const again = await context.newPage();
  await again.goto(link);
  await expect(again.getByText("A recording from earlier is still being sent.")).toBeVisible();
  await expect(again.getByRole("heading", { name: "Sent. Thank you!" })).toBeVisible({
    timeout: 30_000,
  });
  await elder.close();
  expect(await jobsFor(personId)).toHaveLength(1);
  await context.close();
});

test("revoked, used-up and made-up links show a friendly page", async ({
  page,
  browser,
}, testInfo) => {
  const { personId, link } = await setUpBa(page, "invalid");

  // Used up: all of its recordings spent.
  const { data: links } = await adminClient()
    .from("contributor_links")
    .select("id, max_uploads")
    .eq("person_id", personId);
  const only = links?.[0];
  expect(only).toBeDefined();
  await adminClient()
    .from("contributor_links")
    .update({ upload_count: only?.max_uploads ?? 10 })
    .eq("id", only?.id ?? "");
  const used = await openAsElder(browser, link, testInfo.project);
  await expect(
    used.page.getByRole("heading", { name: "This link doesn't work any more" }),
  ).toBeVisible();
  await expect(used.page.getByRole("button", { name: "I agree. Start recording" })).toHaveCount(0);
  await used.context.close();

  // Made up.
  const fake = await openAsElder(
    browser,
    "/record/this-is-not-a-real-link-at-all-0123456789",
    testInfo.project,
  );
  await expect(
    fake.page.getByRole("heading", { name: "This link doesn't work any more" }),
  ).toBeVisible();
  await fake.context.close();

  // Revoked by the organiser: new link, then "Stop this link".
  await adminClient()
    .from("contributor_links")
    .update({ upload_count: 0 })
    .eq("id", only?.id ?? "");
  const working = await openAsElder(browser, link, testInfo.project);
  await expect(working.page.getByRole("heading", { name: "Before you record" })).toBeVisible();
  await working.context.close();

  await page.goto(page.url());
  page.once("dialog", (dialog) => void dialog.accept());
  await page.getByRole("button", { name: "Stop this link" }).click();
  await expect(page.getByRole("button", { name: "Stop this link" })).toHaveCount(0);
  // The button also disappears while the action is pending, so wait for the revoke itself.
  await expect
    .poll(async () => {
      const { data } = await adminClient()
        .from("contributor_links")
        .select("revoked_at")
        .eq("id", only?.id ?? "")
        .single();
      return data?.revoked_at ?? null;
    })
    .not.toBeNull();
  const revoked = await openAsElder(browser, link, testInfo.project);
  await expect(
    revoked.page.getByRole("heading", { name: "This link doesn't work any more" }),
  ).toBeVisible();
  await revoked.context.close();
});
