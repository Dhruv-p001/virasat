import { readFileSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";
import {
  addPerson,
  adminClient,
  createVaultAs,
  lastSegment,
  newElderPage,
  uniqueEmail,
  userIdByEmail,
} from "./helpers.ts";

// Phase 2, M3: the organiser captures in the app (voice, or photographed pages) and reviews what
// the pipeline made of it. The pipeline runs on the mock providers, so a recipe is a fixed sample.
// Only a person's confirmation makes it a recipe.

const PAGE_PNG = readFileSync(new URL("./fixtures/recipe-page.png", import.meta.url));
const WAV = readFileSync(new URL("./fixtures/recipe-fixture.wav", import.meta.url));

async function recordInApp(page: Page, name: string) {
  await page.getByRole("link", { name: `Record ${name}` }).click();
  await expect(page.getByRole("heading", { level: 1, name: `Record ${name}` })).toBeVisible();
  const start = page.getByRole("button", { name: "Start recording" });
  // The organiser says the person agrees before anything is recorded.
  await expect(start).toBeDisabled();
  await page.getByLabel(new RegExp(`${name} knows this recording`)).check();
  await start.click();
  await expect(page.getByRole("timer")).toBeVisible();
  await page.waitForTimeout(2000);
  await page.getByRole("button", { name: "Stop and save" }).click();
  await expect(page.getByRole("heading", { name: "Saved. We're writing it up." })).toBeVisible();
}

async function openFromWaitingList(page: Page, vaultUrl: string, linkName: string) {
  await page.goto(`${vaultUrl}/captures`);
  const capture = page.getByTestId("capture");
  await expect(capture).toHaveAttribute("data-status", "ready_for_review", { timeout: 45_000 });
  await page.getByRole("link", { name: linkName }).click();
}

test("the organiser records in the app, reviews the draft and confirms it", async ({ page }) => {
  const admin = adminClient();
  const vaultUrl = await createVaultAs(page, uniqueEmail("voice"), "Joshi family");
  const personUrl = await addPerson(page, vaultUrl, { relation: "Ba", name: "Savitaben Joshi" });
  const personId = lastSegment(personUrl);

  await recordInApp(page, "Ba");

  // The consent the organiser gave is on record, for both things a recording needs.
  const { data: consents } = await admin
    .from("consents")
    .select("kind, given_via, wording_version")
    .eq("person_id", personId);
  expect(consents?.map((consent) => consent.kind).sort()).toEqual([
    "third_party_processing",
    "voice_recording",
  ]);
  expect(consents?.every((consent) => consent.given_via === "organiser")).toBe(true);

  await openFromWaitingList(page, vaultUrl, "Ba's recording");
  await expect(
    page.getByRole("heading", { level: 1, name: "Review Ba's recording" }),
  ).toBeVisible();
  await expect(page.getByText("Test mode:")).toBeVisible();

  // The original beside the draft: the recording to play, and what was said.
  await expect(page.getByTestId("original-audio")).toBeVisible();
  await expect(page.getByTestId("transcript")).toContainText("mutthi bhar besan");

  // Their words are kept as they said them, and what the computer was unsure about is marked.
  const firstWords = page.getByLabel("Ingredient 1: their words");
  await expect(firstWords).toHaveValue("mutthi bhar besan");
  await expect(page.locator("[data-flagged]").first()).toBeVisible();
  await expect(page.getByTestId("to-check")).toBeVisible();

  // Nothing is a recipe yet, and an incomplete form is refused without asking the server.
  const title = page.getByLabel("Name of the dish");
  await title.fill("");
  await page.getByRole("button", { name: "Save the recipe" }).click();
  await expect(page.getByText("Give the dish a name.")).toBeVisible();
  await firstWords.fill("");
  await page.getByRole("button", { name: "Save the recipe" }).click();
  await expect(page.getByText("Write their words for this ingredient.")).toBeVisible();
  const { data: before } = await admin
    .from("recipes")
    .select("id")
    .eq("origin_person_id", personId);
  expect(before).toEqual([]);

  // Fix it up, change the suggested amount, and confirm.
  await title.fill("Besan poda");
  await firstWords.fill("mutthi bhar besan");
  await page.getByLabel("Suggested amount").first().fill("1,5");
  await page.getByRole("button", { name: "Save the recipe" }).click();
  // Saving lands on the recipe itself: her voice to play, and her words beside each ingredient.
  await expect(page.getByRole("heading", { level: 1, name: "Besan poda" })).toBeVisible();
  await expect(page).toHaveURL(/\/recipes\/[0-9a-f-]{36}$/);
  await expect(page.getByText("Recipe of Ba")).toBeVisible();
  const audio = page.getByTestId("recipe-audio").locator("audio");
  await expect(audio).toBeVisible();
  await expect.poll(() => audio.evaluate((el: HTMLAudioElement) => el.duration)).toBeGreaterThan(0);
  const firstIngredient = page.getByTestId("ingredients").getByRole("listitem").first();
  await expect(firstIngredient).toContainText("“mutthi bhar besan”");
  await expect(firstIngredient).toContainText("≈ 1.5");

  const { data: recipes } = await admin
    .from("recipes")
    .select("id, title, origin_person_id, current_version_id, root_version_id")
    .eq("origin_person_id", personId);
  expect(recipes).toHaveLength(1);
  const recipe = recipes?.[0];
  expect(recipe?.title).toBe("Besan poda");
  expect(recipe?.current_version_id).toBe(recipe?.root_version_id);

  const { data: version } = await admin
    .from("recipe_versions")
    .select(
      "kind, status, source_type, language, ingredients, steps, uncertain_fields, capture_job_id",
    )
    .eq("id", recipe?.current_version_id ?? "")
    .single();
  expect(version).toMatchObject({
    kind: "original",
    status: "confirmed",
    source_type: "voice",
    language: "gu",
    uncertain_fields: [],
  });
  const ingredients = version?.ingredients as {
    original_text: string;
    suggested_quantity: number | null;
  }[];
  expect(ingredients[0]?.original_text).toBe("mutthi bhar besan");
  expect(ingredients[0]?.suggested_quantity).toBe(1.5);

  // The recording now belongs to the recipe, and is still there to play.
  const { data: media } = await admin
    .from("media")
    .select("kind, recipe_version_id, storage_bucket, storage_path, removed_at")
    .eq("capture_job_id", version?.capture_job_id ?? "");
  expect(media).toHaveLength(1);
  expect(media?.[0]).toMatchObject({
    kind: "original_audio",
    recipe_version_id: recipe?.current_version_id,
    removed_at: null,
  });
  const { data: file } = await admin.storage
    .from(media?.[0]?.storage_bucket ?? "")
    .download(media?.[0]?.storage_path ?? "");
  expect(file?.size).toBeGreaterThan(0);

  // The waiting list no longer holds it.
  await page.goto(`${vaultUrl}/captures`);
  await expect(page.getByRole("heading", { name: "Nothing waiting" })).toBeVisible();
});

test("a recording that could not be sent is kept on the device and finished after a reload", async ({
  page,
}) => {
  const admin = adminClient();
  const vaultUrl = await createVaultAs(page, uniqueEmail("resume"), "Mehta family");
  const personUrl = await addPerson(page, vaultUrl, { relation: "Nani", name: "Hansaben Mehta" });
  const personId = lastSegment(personUrl);

  // No connection to storage: the recording is made, and held.
  let blocked = true;
  await page.route("**/storage/v1/object/upload/sign/**", (route) =>
    blocked ? route.abort() : route.continue(),
  );
  await page.getByRole("link", { name: "Record Nani" }).click();
  await page.getByLabel(/Nani knows this recording/).check();
  await page.getByRole("button", { name: "Start recording" }).click();
  await expect(page.getByRole("timer")).toBeVisible();
  await page.waitForTimeout(1500);
  await page.getByRole("button", { name: "Stop and save" }).click();
  await expect(page.getByRole("heading", { name: "No connection right now" })).toBeVisible();
  await expect(page.getByText("The recording is safe on this device.")).toBeVisible();

  // Leave the page (the retry stops with it), get the connection back, and come back.
  await page.goto(personUrl);
  blocked = false;
  await page.goto(`${personUrl}/capture`);
  await expect(page.getByRole("heading", { name: "Saved. We're writing it up." })).toBeVisible({
    timeout: 20_000,
  });

  // One capture, not two: the retry reused the one that was registered.
  await expect
    .poll(
      async () => {
        const { data } = await admin
          .from("capture_jobs")
          .select("status")
          .eq("person_id", personId);
        return data?.length === 1 ? data[0]?.status : "none";
      },
      { timeout: 45_000 },
    )
    .toBe("ready_for_review");
});

test("handwritten pages: originals kept as taken, a readable copy made, reviewed and confirmed", async ({
  page,
}) => {
  const admin = adminClient();
  const vaultUrl = await createVaultAs(page, uniqueEmail("pages"), "Shah family");
  const personUrl = await addPerson(page, vaultUrl, { relation: "Masi", name: "Kokilaben Shah" });
  const personId = lastSegment(personUrl);

  await page.getByRole("link", { name: "Photograph handwritten pages" }).click();
  await expect(
    page.getByRole("heading", { level: 1, name: "Photograph Masi's pages" }),
  ).toBeVisible();
  const send = page.getByRole("button", { name: "Send these pages" });
  await expect(send).toBeDisabled();

  await page.getByTestId("page-files").setInputFiles({
    name: "recipe-page.png",
    mimeType: "image/png",
    buffer: PAGE_PNG,
  });
  await expect(page.getByTestId("pages").getByRole("img", { name: "Page 1" })).toBeVisible();
  // Not until the organiser agrees to a computer reading it.
  await expect(send).toBeDisabled();
  await page.getByLabel(/A computer reads this page/).check();
  await send.click();
  await expect(
    page.getByRole("heading", { name: "Saved. We're reading the pages." }),
  ).toBeVisible();

  const { data: job } = await admin
    .from("capture_jobs")
    .select("id")
    .eq("person_id", personId)
    .single();
  const jobId = job?.id ?? "";

  const { data: media } = await admin
    .from("media")
    .select(
      "id, kind, mime_type, byte_size, width, height, derived_from_media_id, storage_bucket, storage_path",
    )
    .eq("capture_job_id", jobId)
    .order("created_at");
  expect(media).toHaveLength(2);
  const original = media?.find((row) => row.kind === "handwriting_scan");
  const copy = media?.find((row) => row.kind === "derived_scan");
  expect(original?.derived_from_media_id).toBeNull();
  expect(copy?.derived_from_media_id).toBe(original?.id);
  expect(copy?.mime_type).toBe("image/jpeg");
  expect(copy?.byte_size).toBeLessThanOrEqual(5 * 1024 * 1024);
  expect(copy?.width).toBeLessThanOrEqual(2000);
  expect(copy?.height).toBeLessThanOrEqual(2000);

  // The original is exactly the file that was chosen, byte for byte.
  const { data: stored } = await admin.storage
    .from(original?.storage_bucket ?? "")
    .download(original?.storage_path ?? "");
  expect(Buffer.from((await stored?.arrayBuffer()) ?? new ArrayBuffer(0)).equals(PAGE_PNG)).toBe(
    true,
  );

  await openFromWaitingList(page, vaultUrl, "Masi's handwritten page");
  await expect(page.getByRole("heading", { level: 1, name: "Review Masi's page" })).toBeVisible();
  await expect(page.getByRole("img", { name: "Page 1" })).toBeVisible();
  await expect(page.getByText("What was read from the page")).toBeVisible();
  await page.getByRole("button", { name: "Save the recipe" }).click();
  await expect(page.getByTestId("recipe-pages").getByRole("img", { name: "Page 1" })).toBeVisible();
  // The page image really loads (the readable copy, signed for this viewer).
  await expect
    .poll(() =>
      page
        .getByTestId("recipe-pages")
        .getByRole("img")
        .first()
        .evaluate((el: HTMLImageElement) => el.naturalWidth),
    )
    .toBeGreaterThan(0);

  const { data: recipe } = await admin
    .from("recipes")
    .select("current_version_id")
    .eq("origin_person_id", personId)
    .single();
  const { data: version } = await admin
    .from("recipe_versions")
    .select("source_type, status")
    .eq("id", recipe?.current_version_id ?? "")
    .single();
  expect(version).toMatchObject({ source_type: "handwriting", status: "confirmed" });
});

test("the page picker tells the organiser what it cannot use, and holds four pages", async ({
  page,
}) => {
  const vaultUrl = await createVaultAs(page, uniqueEmail("picker"), "Patel family");
  const personUrl = await addPerson(page, vaultUrl, { relation: "Dadi", name: "Shantaben Patel" });
  await page.goto(`${personUrl}/capture?mode=pages`);
  const input = page.getByTestId("page-files");

  // A HEIC this browser cannot open, and a file that is not a photo at all.
  await input.setInputFiles([
    { name: "IMG_0001.heic", mimeType: "image/heic", buffer: Buffer.from("not really a photo") },
    { name: "notes.txt", mimeType: "text/plain", buffer: Buffer.from("hello") },
  ]);
  await expect(page.getByText("We couldn't open IMG_0001.heic in this browser.")).toBeVisible();
  await expect(page.getByText("notes.txt isn't a photo we can use.")).toBeVisible();
  await expect(page.getByTestId("pages")).toHaveCount(0);

  // Five at once: four fit.
  await input.setInputFiles(
    Array.from({ length: 5 }, (_, index) => ({
      name: `page-${index + 1}.png`,
      mimeType: "image/png",
      buffer: PAGE_PNG,
    })),
  );
  await expect(page.getByTestId("pages").getByRole("img")).toHaveCount(4);
  await expect(page.getByText("One recipe can hold 4 pages.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Choose photos" })).toBeDisabled();

  await page.getByRole("button", { name: "Remove page 2" }).click();
  await expect(page.getByTestId("pages").getByRole("img")).toHaveCount(3);
});

test("a capture the computer gave up on opens empty for typing in, with what was heard", async ({
  page,
}) => {
  const admin = adminClient();
  const email = uniqueEmail("manual");
  const vaultUrl = await createVaultAs(page, email, "Desai family");
  const personUrl = await addPerson(page, vaultUrl, { relation: "Kaki", name: "Jayaben Desai" });
  const personId = lastSegment(personUrl);
  const userId = await userIdByEmail(email);

  // A capture whose pipeline ended in "enter it by hand", set up as the pipeline would leave it.
  const transcript = "ek katori dal lo, tel ma jeeru nakho";
  const { data: started, error } = await admin.rpc("begin_capture", {
    p_source: "voice",
    p_mime_type: "audio/wav",
    p_byte_size: WAV.length,
    p_consent_wording_version: "2026-11-v1",
    p_actor: userId,
    p_person_id: personId,
  });
  if (error) throw error;
  const job = started[0];
  if (!job) throw new Error("no capture");
  const upload = await admin.storage
    .from(job.storage_bucket)
    .upload(job.storage_path, WAV, { contentType: "audio/wav" });
  expect(upload.error).toBeNull();
  expect(
    (await admin.rpc("confirm_upload", { p_job_id: job.job_id, p_actor: userId })).error,
  ).toBeNull();
  for (const to of ["transcribing", "structuring"] as const) {
    const moved = await admin.rpc("advance_capture", {
      p_job_id: job.job_id,
      p_to: to,
      ...(to === "structuring" ? { p_transcript: transcript } : {}),
    });
    expect(moved.error).toBeNull();
  }
  const failed = await admin.rpc("advance_capture", {
    p_job_id: job.job_id,
    p_to: "failed",
    p_error: "manual_entry:invalid_output",
  });
  expect(failed.error).toBeNull();

  await page.goto(`${vaultUrl}/captures/${job.job_id}`);
  await expect(
    page.getByText("The computer couldn't turn this into a recipe.", { exact: false }),
  ).toBeVisible();
  await expect(page.getByTestId("original-audio")).toBeVisible();
  await expect(page.getByTestId("transcript")).toContainText("ek katori dal");
  // What was heard is in the first step, ready to be split up.
  await expect(page.getByRole("textbox", { name: /^Step 1/ })).toHaveValue(transcript);
  await expect(page.locator("[data-flagged]")).toHaveCount(0);

  await page.getByLabel("Name of the dish").fill("Dal tadka");
  await page.getByLabel("Ingredient 1: their words").fill("ek katori dal");
  await page.getByRole("button", { name: "Save the recipe" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Dal tadka" })).toBeVisible();

  const { data: recipe } = await admin
    .from("recipes")
    .select("current_version_id")
    .eq("origin_person_id", personId)
    .single();
  const { data: version } = await admin
    .from("recipe_versions")
    .select("source_type, steps, ingredients")
    .eq("id", recipe?.current_version_id ?? "")
    .single();
  expect(version?.source_type).toBe("voice");
  expect((version?.steps as { text: string }[])[0]?.text).toBe(transcript);
  expect(version?.ingredients).toEqual([
    {
      original_text: "ek katori dal",
      name: null,
      suggested_quantity: null,
      suggested_unit: null,
      confidence: null,
      note: null,
    },
  ]);
});

test("a viewer and another family cannot capture or review", async ({
  page,
  browser,
}, testInfo) => {
  const admin = adminClient();
  const ownerEmail = uniqueEmail("owner");
  const vaultUrl = await createVaultAs(page, ownerEmail, "Joshi family");
  const familyId = lastSegment(vaultUrl);
  const personUrl = await addPerson(page, vaultUrl, { relation: "Ba", name: "Savitaben Joshi" });
  const personId = lastSegment(personUrl);
  const ownerId = await userIdByEmail(ownerEmail);

  const { data: started, error } = await admin.rpc("begin_capture", {
    p_source: "voice",
    p_mime_type: "audio/wav",
    p_byte_size: WAV.length,
    p_consent_wording_version: "2026-11-v1",
    p_actor: ownerId,
    p_person_id: personId,
  });
  if (error) throw error;
  const job = started[0];
  if (!job) throw new Error("no capture");
  await admin.storage
    .from(job.storage_bucket)
    .upload(job.storage_path, WAV, { contentType: "audio/wav" });
  await admin.rpc("confirm_upload", { p_job_id: job.job_id, p_actor: ownerId });
  const reviewUrl = `${vaultUrl}/captures/${job.job_id}`;
  const captureUrl = `${personUrl}/capture`;

  const { context, page: stranger } = await newElderPage(browser, testInfo.project);
  const strangerEmail = uniqueEmail("viewer");
  await createVaultAs(stranger, strangerEmail, "Their own vault");

  // Not a member: nothing is there.
  for (const url of [reviewUrl, captureUrl]) {
    expect((await stranger.goto(url))?.status()).toBe(404);
  }

  // A viewer can open the vault, but unreviewed captures and capturing are for writers.
  const strangerId = await userIdByEmail(strangerEmail);
  const added = await admin
    .from("family_members")
    .insert({ family_id: familyId, profile_id: strangerId, role: "viewer" });
  expect(added.error).toBeNull();
  expect((await stranger.goto(vaultUrl))?.status()).toBe(200);
  for (const url of [reviewUrl, captureUrl]) {
    expect((await stranger.goto(url))?.status()).toBe(404);
  }
  await context.close();
});
