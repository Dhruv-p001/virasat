import { expect, test } from "@playwright/test";
import {
  addPerson,
  createVaultAs,
  signInWithEmail,
  signInWithPhone,
  TEST_PHONES,
  uniqueEmail,
} from "./helpers.ts";

// 1x1 PNG, enough to exercise upload, storage RLS and signed URLs.
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

test("a person's photo uploads, shows, and can be replaced", async ({ page }) => {
  const vaultUrl = await createVaultAs(page, uniqueEmail("photo"), "Joshi family");
  await addPerson(page, vaultUrl, { relation: "Aaji", name: "Sushila Joshi" });

  await page
    .getByLabel("Choose a photo")
    .setInputFiles({ name: "aaji.png", mimeType: "image/png", buffer: PNG });
  const photo = page.locator("main img").first();
  await expect(photo).toBeVisible();
  await expect(photo).toHaveAttribute("src", /\/storage\/v1\/object\/sign\/vault-images\//);
  await expect(page.getByLabel("Change photo")).toBeAttached();

  await page
    .getByLabel("Change photo")
    .setInputFiles({ name: "aaji-2.png", mimeType: "image/png", buffer: PNG });
  await expect(page.locator("main img").first()).not.toHaveAttribute(
    "src",
    (await photo.getAttribute("src")) ?? "",
  );

  await page.goto(vaultUrl);
  await expect(page.locator("main img")).toHaveCount(1);
});

test("organiser adds Ba, invites Mom by link, and Mom joins from her phone", async ({
  page,
  browser,
}) => {
  const vaultUrl = await createVaultAs(page, uniqueEmail("organiser"), "Shah family");

  // Validation keeps what was typed.
  await page.goto(`${vaultUrl}/people/new`);
  await page.getByLabel("What the family calls them").fill("Ba");
  await page.getByLabel("Their name").fill("Kantaben Shah");
  await page.getByLabel(/Year of birth/).fill("1700");
  await page.getByRole("button", { name: "Add to vault" }).click();
  await expect(page.getByText("Enter a year, like 1945.")).toBeVisible();
  await expect(page.getByLabel("Their name")).toHaveValue("Kantaben Shah");
  await page.getByLabel(/Year of birth/).fill("1941");
  await page.getByRole("button", { name: "Add to vault" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Ba" })).toBeVisible();
  await expect(page.getByText("Born 1941")).toBeVisible();
  await expect(page.getByText("Not on Virasat")).toBeVisible();

  // Mom is in the vault before she has an account; the invite links her to that record.
  const momUrl = await addPerson(page, vaultUrl, { relation: "Mom", name: "Meena Shah" });
  await page.getByRole("link", { name: "Invite Mom to join" }).click();
  await expect(page.getByLabel("Are they already in this vault?")).toHaveValue(
    momUrl.split("/").pop() ?? "",
  );
  await page.getByRole("button", { name: "Create invite" }).click();
  await expect(page.getByRole("heading", { name: "Your invite is ready" })).toBeVisible();
  const inviteUrl = await page.getByTestId("invite-url").inputValue();
  expect(inviteUrl).toMatch(/^http:\/\/localhost:3000\/invite\/[A-Za-z0-9_-]{40,}$/);

  // Mom, on her own phone, signs in with her number and joins.
  const momsPhone = await browser.newContext();
  const mom = await momsPhone.newPage();
  await mom.goto(inviteUrl);
  await expect(mom.getByRole("heading", { name: /invited you to Shah family/ })).toBeVisible();
  await mom.getByRole("link", { name: "Sign in to join" }).click();
  await signInWithPhone(mom, TEST_PHONES[0]);
  await expect(mom).toHaveURL(/\/invite\//);
  await mom.getByRole("button", { name: "Join Shah family" }).click();
  await expect(mom.getByRole("heading", { level: 1, name: "Shah family" })).toBeVisible();
  await expect(mom.getByText("You are Member")).toBeVisible();
  await expect(mom.getByRole("link", { name: /Ba/ })).toBeVisible();

  // Reopening her used invite just takes Mom in...
  await mom.goto(inviteUrl);
  await expect(mom).toHaveURL(vaultUrl);
  await momsPhone.close();

  // ...but it is single-use for anyone else, and reveals nothing about the vault.
  const forwarded = await browser.newContext();
  const stranger = await forwarded.newPage();
  await stranger.goto(inviteUrl);
  await expect(stranger.getByRole("heading", { name: "This invite can't be used" })).toBeVisible();
  await expect(stranger.getByText("Shah family")).toHaveCount(0);
  await forwarded.close();

  // The organiser sees Mom joined and linked.
  await page.goto(vaultUrl);
  await expect(page.getByRole("link", { name: /Mom.*Has joined/ })).toBeVisible();
  await page.goto(`${vaultUrl}/members`);
  await expect(page.getByText("No pending invites.")).toBeVisible();
});

test("a family member cannot see another family's vault", async ({ page, browser }) => {
  const vaultUrl = await createVaultAs(page, uniqueEmail("vault-a"), "Mehta family");
  const personUrl = await addPerson(page, vaultUrl, { relation: "Nani", name: "Kokila Mehta" });

  const strangerContext = await browser.newContext();
  const stranger = await strangerContext.newPage();
  await signInWithEmail(stranger, uniqueEmail("vault-b"));
  for (const url of [vaultUrl, personUrl, `${vaultUrl}/members`, `${vaultUrl}/invite`]) {
    const response = await stranger.goto(url);
    expect(response?.status(), url).toBe(404);
  }
  await expect(stranger.getByText("Kokila Mehta")).toHaveCount(0);
  await strangerContext.close();
});

test("a viewer can look but not change anything", async ({ page, browser }) => {
  const vaultUrl = await createVaultAs(page, uniqueEmail("owner"), "Iyer family");
  const personUrl = await addPerson(page, vaultUrl, { relation: "Paati", name: "Lakshmi Iyer" });

  await page.goto(`${vaultUrl}/invite`);
  await page.getByLabel("Viewer").check();
  await page.getByRole("button", { name: "Create invite" }).click();
  const inviteUrl = await page.getByTestId("invite-url").inputValue();

  const viewerContext = await browser.newContext();
  const viewer = await viewerContext.newPage();
  await viewer.goto(inviteUrl);
  await viewer.getByRole("link", { name: "Sign in to join" }).click();
  await signInWithPhone(viewer, TEST_PHONES[1]);
  await viewer.getByRole("button", { name: "Join Iyer family" }).click();
  await expect(viewer.getByText("You are Viewer")).toBeVisible();

  await expect(viewer.getByRole("link", { name: "Invite family" })).toHaveCount(0);
  await expect(viewer.getByRole("link", { name: "Add someone" })).toHaveCount(0);
  await viewer.goto(personUrl);
  await expect(viewer.getByRole("heading", { level: 1, name: "Paati" })).toBeVisible();
  await expect(viewer.getByRole("button", { name: "Save" })).toHaveCount(0);
  await expect(viewer.getByRole("button", { name: "Remove from vault" })).toHaveCount(0);
  expect((await viewer.goto(`${vaultUrl}/people/new`))?.status()).toBe(404);
  expect((await viewer.goto(`${vaultUrl}/invite`))?.status()).toBe(404);
  await viewerContext.close();
});

test("the last owner cannot leave, and is told why", async ({ page }) => {
  const vaultUrl = await createVaultAs(page, uniqueEmail("last-owner"), "Kapoor family");
  await page.goto(`${vaultUrl}/members`);
  page.once("dialog", (dialog) => void dialog.accept());
  await page.getByRole("button", { name: "Leave this vault" }).click();
  await expect(page.getByText("A vault needs at least one owner.")).toBeVisible();
});

test("choosing Gujarati switches the whole interface and stays switched", async ({ page }) => {
  await createVaultAs(page, uniqueEmail("gujarati"), "Patel family");
  await page.goto("/settings");
  await page.getByLabel("Language").selectOption("gu");
  await page.getByLabel("Cups and spoons").check();
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "સેટિંગ્સ" })).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("lang", "gu");

  await page.reload();
  await expect(page.getByRole("heading", { level: 1, name: "સેટિંગ્સ" })).toBeVisible();
  await expect(page.getByLabel("કપ અને ચમચી")).toBeChecked();
});
