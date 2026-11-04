import { expect, test } from "@playwright/test";
import { addPerson, adminClient, createVaultAs, newElderPage, uniqueEmail } from "./helpers.ts";

// Flow B, M2: an elder's recording is turned into a draft by the capture pipeline (Inngest, with
// the mock providers: no API keys), and the organiser watches it happen. The draft is never a
// recipe until a person confirms it (M3).

test("a recording becomes a draft waiting for review, and the original is untouched", async ({
  page,
  browser,
}, testInfo) => {
  const vaultUrl = await createVaultAs(page, uniqueEmail("pipeline"), "Joshi family");
  const personUrl = await addPerson(page, vaultUrl, { relation: "Ba", name: "Savitaben Joshi" });
  const personId = personUrl.split("/").pop() ?? "";
  await page.getByRole("button", { name: "Create a recording link" }).click();
  const link = await page.getByLabel("Link for Ba").inputValue();

  // Nothing yet: the vault page shows no captures section, the full page explains what appears.
  await page.goto(`${vaultUrl}/captures`);
  await expect(page.getByRole("heading", { name: "Nothing waiting" })).toBeVisible();

  const { context, page: elder } = await newElderPage(browser, testInfo.project);
  await elder.goto(link);
  await elder.getByRole("button", { name: "I agree. Start recording" }).click();
  await elder.getByRole("button", { name: "Start recording" }).click();
  await expect(elder.getByRole("timer")).toBeVisible();
  await elder.waitForTimeout(2000);
  await elder.getByRole("button", { name: "Stop and send" }).click();
  await expect(elder.getByRole("heading", { name: "Sent. Thank you!" })).toBeVisible();
  await context.close();

  // The organiser sees it arrive and, with no refresh by hand, reach "ready".
  await page.goto(`${vaultUrl}/captures`);
  await expect(page.getByText("Test mode:")).toBeVisible();
  const capture = page.getByTestId("capture");
  await expect(capture).toContainText("Ba's recording");
  await expect(capture).toHaveAttribute("data-status", "ready_for_review", { timeout: 45_000 });
  await expect(capture).toContainText("Ready for you to review");

  // The same list shows on the vault page.
  await page.goto(vaultUrl);
  await expect(page.getByRole("heading", { name: "Waiting for you" })).toBeVisible();
  await expect(page.getByTestId("capture")).toContainText("Ready for you to review");

  const admin = adminClient();
  const { data: jobs, error } = await admin
    .from("capture_jobs")
    .select("id, status, transcript, detected_language, ai_output, error, provider_meta, recipe_id")
    .eq("person_id", personId);
  if (error) throw error;
  const job = jobs[0];
  expect(jobs).toHaveLength(1);
  expect(job?.status).toBe("ready_for_review");
  expect(job?.transcript).toBeTruthy();
  expect(job?.detected_language).toBe("gu-IN");
  expect(job?.error).toBeNull();
  // A draft only: no recipe exists until a person confirms it.
  expect(job?.recipe_id).toBeNull();
  const output = job?.ai_output as { recipe?: { ingredients?: { original_text: string }[] } };
  expect(output.recipe?.ingredients?.[0]?.original_text).toBe("mutthi bhar besan");
  expect(job?.provider_meta).toMatchObject({ mode: "mock", stt: { provider: "mock" } });
  // Provider details hold no recipe content.
  expect(JSON.stringify(job?.provider_meta)).not.toContain("besan");

  const { data: recipes } = await admin
    .from("recipes")
    .select("id")
    .eq("origin_person_id", personId);
  expect(recipes).toEqual([]);

  // The original recording is still there, registered and in storage, never replaced.
  const { data: media } = await admin
    .from("media")
    .select("kind, storage_bucket, storage_path, removed_at, derived_from_media_id")
    .eq("capture_job_id", job?.id ?? "");
  expect(media).toHaveLength(1);
  expect(media?.[0]).toMatchObject({
    kind: "original_audio",
    removed_at: null,
    derived_from_media_id: null,
  });
  const original = media?.[0];
  const { data: file, error: downloadError } = await admin.storage
    .from(original?.storage_bucket ?? "")
    .download(original?.storage_path ?? "");
  expect(downloadError).toBeNull();
  expect(file?.size).toBeGreaterThan(0);
});

test("another family sees nothing of a family's captures", async ({ page, browser }, testInfo) => {
  const vaultUrl = await createVaultAs(page, uniqueEmail("owner"), "Desai family");
  await addPerson(page, vaultUrl, { relation: "Nani", name: "Hansaben Desai" });
  await page.getByRole("button", { name: "Create a recording link" }).click();
  const link = await page.getByLabel("Link for Nani").inputValue();

  const { context: elderContext, page: elder } = await newElderPage(browser, testInfo.project);
  await elder.goto(link);
  await elder.getByRole("button", { name: "I agree. Start recording" }).click();
  await elder.getByRole("button", { name: "Start recording" }).click();
  await expect(elder.getByRole("timer")).toBeVisible();
  await elder.waitForTimeout(1500);
  await elder.getByRole("button", { name: "Stop and send" }).click();
  await expect(elder.getByRole("heading", { name: "Sent. Thank you!" })).toBeVisible();
  await elderContext.close();

  const { context, page: stranger } = await newElderPage(browser, testInfo.project);
  await createVaultAs(stranger, uniqueEmail("stranger"), "Other family");
  const response = await stranger.goto(`${vaultUrl}/captures`);
  expect(response?.status()).toBe(404);
  await expect(stranger.getByText("Nani")).toHaveCount(0);
  await context.close();
});
