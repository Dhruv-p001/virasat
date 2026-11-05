import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";
import {
  addPerson,
  adminClient,
  createVaultAs,
  lastSegment,
  newElderPage,
  uniqueEmail,
  userIdByEmail,
} from "./helpers.ts";

// Phase 2 B2: the recipe page, as the family sees it. The recipes here are set up through the
// service role (the capture and review screens have their own tests), so each test is about what
// the page shows and who may see it.

const WAV = readFileSync(new URL("./fixtures/recipe-fixture.wav", import.meta.url));

const ingredient = (originalText: string) => ({
  original_text: originalText,
  name: null,
  suggested_quantity: null,
  suggested_unit: null,
  confidence: null,
  note: null,
});

/** A recipe made the way the app makes one from a recording, with its original audio attached. */
async function recipeFromRecording(userId: string, personId: string) {
  const admin = adminClient();
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
  if (upload.error) throw upload.error;
  const confirmed = await admin.rpc("confirm_upload", { p_job_id: job.job_id, p_actor: userId });
  if (confirmed.error) throw confirmed.error;
  for (const to of ["transcribing", "structuring", "ready_for_review"] as const) {
    const moved = await admin.rpc("advance_capture", {
      p_job_id: job.job_id,
      p_to: to,
      ...(to === "ready_for_review" ? { p_ai_output: {} } : {}),
    });
    if (moved.error) throw moved.error;
  }
  const { data: recipeId, error: confirmError } = await admin.rpc("confirm_capture", {
    p_actor: userId,
    p_job_id: job.job_id,
    p_content: {
      title: "Dal dhokli",
      servings: 4,
      ingredients: [ingredient("ek katori tuver dal")],
      steps: [{ text: "dal ubalo" }],
      tips: ["dhimi aanch par"],
      story: "Ba made it on cold evenings.",
      language: "gu",
      uncertain_fields: [],
    },
  });
  if (confirmError) throw confirmError;
  return { recipeId, mediaId: job.media_id };
}

test("a typed recipe opens from the vault, with a moment from the family and no audio", async ({
  page,
}) => {
  const admin = adminClient();
  const email = uniqueEmail("typed");
  const vaultUrl = await createVaultAs(page, email, "Mehta family");
  const familyId = lastSegment(vaultUrl);
  const personUrl = await addPerson(page, vaultUrl, { relation: "Ba", name: "Savitaben Mehta" });
  const userId = await userIdByEmail(email);

  const { data: recipeId, error } = await admin.rpc("create_typed_recipe", {
    p_actor: userId,
    p_family_id: familyId,
    p_origin_person_id: lastSegment(personUrl),
    p_content: {
      title: "Methi thepla",
      servings: null,
      ingredients: [ingredient("a fistful of besan"), ingredient("two cups of wheat flour")],
      steps: [{ text: "knead it soft" }, { text: "roll thin and roast" }],
      tips: [],
      story: "Packed for every train journey.",
      language: "en",
    },
  });
  expect(error).toBeNull();
  const cooked = await admin.from("attempts").insert({
    family_id: familyId,
    recipe_id: recipeId ?? "",
    author_profile_id: userId,
    note: "Less oil, kids loved it",
    rating: 5,
  });
  expect(cooked.error).toBeNull();

  // The vault's recipe card is the way in.
  await page.goto(vaultUrl);
  await page.getByTestId("recipe-card").filter({ hasText: "Methi thepla" }).click();
  await expect(page).toHaveURL(new RegExp(`/vault/${familyId}/recipes/${recipeId}$`));
  await expect(page.getByRole("heading", { level: 1, name: "Methi thepla" })).toBeVisible();
  await expect(page.getByText("Recipe of Ba")).toBeVisible();
  await expect(page.getByText("Typed from memory")).toBeVisible();

  // Their words, as typed, with no invented quantity beside them.
  const ingredients = page.getByTestId("ingredients").getByRole("listitem");
  await expect(ingredients).toHaveCount(2);
  await expect(ingredients.first()).toContainText("“a fistful of besan”");
  await expect(ingredients.first()).not.toContainText("≈");
  await expect(page.getByText("roll thin and roast")).toBeVisible();
  await expect(page.getByText("Packed for every train journey.")).toBeVisible();

  // Nothing was recorded or photographed, so there is nothing to play or show.
  await expect(page.getByTestId("recipe-audio")).toHaveCount(0);
  await expect(page.getByTestId("recipe-pages")).toHaveCount(0);

  // The family's moment is here, and a writer can add their own.
  await expect(page.getByTestId("moment")).toContainText("Less oil, kids loved it");
  await expect(page.getByRole("button", { name: "I cooked it" })).toBeVisible();
});

test("a recording that was removed is said so, and the written recipe stays", async ({ page }) => {
  const admin = adminClient();
  const email = uniqueEmail("removed");
  const vaultUrl = await createVaultAs(page, email, "Joshi family");
  const familyId = lastSegment(vaultUrl);
  const personUrl = await addPerson(page, vaultUrl, { relation: "Nani", name: "Hansaben Joshi" });
  const userId = await userIdByEmail(email);
  const { recipeId, mediaId } = await recipeFromRecording(userId, lastSegment(personUrl));
  const recipeUrl = `/vault/${familyId}/recipes/${recipeId}`;

  // With the recording there, it plays.
  await page.goto(recipeUrl);
  const audio = page.getByTestId("recipe-audio").locator("audio");
  await expect(audio).toBeVisible();
  await expect.poll(() => audio.evaluate((el: HTMLAudioElement) => el.duration)).toBeGreaterThan(0);
  await expect(page.getByText("Hear Nani tell it", { exact: false })).toHaveCount(0);

  // Consent withdrawn: the recording is gone, the text is not.
  const removed = await admin
    .from("media")
    .update({ removed_at: new Date().toISOString(), removed_reason: "consent withdrawn" })
    .eq("id", mediaId);
  expect(removed.error).toBeNull();
  await page.reload();
  await expect(page.getByTestId("recipe-audio").locator("audio")).toHaveCount(0);
  await expect(page.getByText("The original recording has been removed.")).toBeVisible();
  await expect(page.getByTestId("ingredients")).toContainText("“ek katori tuver dal”");
  await expect(page.getByText("Ba made it on cold evenings.")).toBeVisible();
});

test("a viewer can read a recipe but not add to it, and another family cannot see it", async ({
  page,
  browser,
}, testInfo) => {
  const admin = adminClient();
  const ownerEmail = uniqueEmail("owner");
  const vaultUrl = await createVaultAs(page, ownerEmail, "Desai family");
  const familyId = lastSegment(vaultUrl);
  const personUrl = await addPerson(page, vaultUrl, { relation: "Kaki", name: "Jayaben Desai" });
  const ownerId = await userIdByEmail(ownerEmail);
  const { recipeId } = await recipeFromRecording(ownerId, lastSegment(personUrl));
  const recipeUrl = `${vaultUrl}/recipes/${recipeId}`;

  const { context, page: other } = await newElderPage(browser, testInfo.project);
  const otherEmail = uniqueEmail("viewer");
  await createVaultAs(other, otherEmail, "Their own vault");

  // Not a member: nothing is there. Neither is a recipe that does not exist.
  expect((await other.goto(recipeUrl))?.status()).toBe(404);
  expect((await other.goto(`${vaultUrl}/recipes/${crypto.randomUUID()}`))?.status()).toBe(404);

  // A viewer reads it, recording and all, but has no way to add a moment.
  const added = await admin.from("family_members").insert({
    family_id: familyId,
    profile_id: await userIdByEmail(otherEmail),
    role: "viewer",
  });
  expect(added.error).toBeNull();
  expect((await other.goto(recipeUrl))?.status()).toBe(200);
  await expect(other.getByRole("heading", { level: 1, name: "Dal dhokli" })).toBeVisible();
  await expect(other.getByTestId("recipe-audio").locator("audio")).toBeVisible();
  await expect(other.getByRole("button", { name: "I cooked it" })).toHaveCount(0);
  await context.close();
});
