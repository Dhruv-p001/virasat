import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";
import { createVaultAs, signInWithEmail, uniqueEmail } from "./helpers.ts";

// Phase 2.5 first run: the example family, the two-minute first recipe, and family moments.

const DISH_PHOTO = new URL("../public/sample/dishes/sukhdi.jpg", import.meta.url);

test("anyone can explore the example family without an account", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("link", { name: "See an example family" }).click();

  await expect(page).toHaveURL(/\/sample$/);
  await expect(page.getByTestId("sample-banner")).toContainText("example family");
  await expect(page.getByRole("heading", { level: 1, name: "The Mehta family" })).toBeVisible();

  await page.getByRole("link", { name: /Methi na thepla/ }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Methi na thepla" })).toBeVisible();
  // Her words come first, with the suggested quantity beside them.
  await expect(page.getByText("“mutthi bhar besan”")).toBeVisible();
  await expect(page.getByText(/≈ 30 g gram flour/)).toBeVisible();
  // The lineage strip: Ba to Mom to you.
  const lineage = page.getByRole("region", { name: "Passed down" });
  await expect(lineage.getByRole("listitem").filter({ hasText: "Ba" }).first()).toBeVisible();
  await expect(lineage.getByText("Take this to England with you", { exact: false })).toBeVisible();
  await expect(page.getByTestId("sample-audio")).toBeVisible();
  // A moment from the family, with its photo.
  await expect(page.getByTestId("moment").first()).toBeVisible();

  await page.getByRole("link", { name: "Start your own vault" }).last().click();
  await expect(page).toHaveURL(/\/sign-in/);
});

test("the example family speaks Gujarati and Hindi", async ({ page, context }) => {
  for (const [locale, heading] of [
    ["gu", "ઉદાહરણ પરિવાર"],
    ["hi", "उदाहरण परिवार"],
  ] as const) {
    await context.addCookies([
      { name: "virasat_lang", value: locale, url: "http://localhost:3000" },
    ]);
    await page.goto("/sample");
    await expect(page.locator("html")).toHaveAttribute("lang", locale);
    await expect(page.getByText(heading).first()).toBeVisible();
  }
});

test("a new organiser has a first recipe within two minutes, and another family cannot see it", async ({
  page,
  browser,
}) => {
  const email = uniqueEmail("first-recipe");
  await signInWithEmail(page, email);
  await page.getByLabel("Vault name").fill("Desai family");
  await page.getByRole("button", { name: "Create vault" }).click();

  await expect(
    page.getByRole("heading", { level: 1, name: "Add one recipe you know by heart" }),
  ).toBeVisible();
  await page.getByLabel("What's it called?").fill("Dal dhokli");
  await page.getByLabel("Ingredients").fill("a fistful of toor dal\ntwo cups of wheat flour");
  await page.getByLabel("Steps").fill("Boil the dal.\nRoll and cut the dhokli.");
  await page.getByRole("button", { name: "Save this recipe" }).click();

  await expect(page.getByRole("heading", { name: "Recipe saved" })).toBeVisible();
  await page.getByRole("link", { name: "Go to your vault" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Desai family" })).toBeVisible();
  await expect(page.getByText("Dal dhokli")).toBeVisible();
  const vaultUrl = page.url();

  // Another family's organiser sees nothing of it.
  const otherContext = await browser.newContext();
  const other = await otherContext.newPage();
  await createVaultAs(other, uniqueEmail("other-family"), "Other family");
  expect((await other.goto(vaultUrl))?.status()).toBe(404);
  await otherContext.close();
});

test("the first recipe is kept exactly as typed, and bad input says what to fix", async ({
  page,
}) => {
  await createVaultAs(page, uniqueEmail("typed"), "Typed family");
  await page.getByRole("button", { name: "Add" }).first().click();
  await page.getByRole("link", { name: /Type a recipe/ }).click();
  await expect(page).toHaveURL(/\/recipes\/new/);
  await page.getByLabel("What's it called?").fill("Chaas");
  await page.getByLabel("Ingredients").fill("   ");
  await page.getByRole("button", { name: "Save this recipe" }).click();
  await expect(page.getByRole("alert").first()).toBeVisible();
  // What was typed is still there.
  await expect(page.getByLabel("What's it called?")).toHaveValue("Chaas");
});

test("a family member shares an 'I cooked it' moment with a photo, only their family sees it", async ({
  page,
  browser,
}) => {
  const vaultUrl = await createVaultAs(page, uniqueEmail("moment"), "Moment family");
  await page.goto(`${vaultUrl}/recipes/new`);
  await page.getByLabel("What's it called?").fill("Sukhdi");
  await page.getByLabel("Ingredients").fill("a fistful of ghee\natta, as much as it takes");
  await page.getByRole("button", { name: "Save this recipe" }).click();
  await expect(page.getByRole("heading", { name: "Recipe saved" })).toBeVisible();

  await page.goto(`${vaultUrl}/moments`);
  await expect(page.getByRole("heading", { name: "Nothing cooked yet" })).toBeVisible();
  await page.getByRole("button", { name: "I cooked it" }).first().click();

  const sheet = page.getByRole("dialog", { name: "I cooked it" });
  await sheet.getByLabel("Which recipe?").selectOption({ label: "Sukhdi" });
  // Tap the fourth star, as a person would.
  await sheet.locator('label:has(input[aria-label="4 out of 5"])').click();
  await expect(sheet.getByLabel("4 out of 5")).toBeChecked();
  await sheet.getByLabel("A note").fill("Less ghee this time. Still gone in a day.");
  await sheet.locator('input[type="file"]').setInputFiles({
    name: "sukhdi.jpg",
    mimeType: "image/jpeg",
    buffer: readFileSync(DISH_PHOTO),
  });
  await sheet.getByRole("button", { name: "Share with family" }).click();

  const moment = page.getByTestId("moment");
  await expect(moment).toBeVisible();
  await expect(moment).toContainText("Less ghee this time");
  await expect(moment.getByRole("img", { name: "4 out of 5 stars" })).toBeVisible();
  // The photo uploaded and is served from private storage.
  await expect(moment.locator("img[src*='vault-images']")).toBeVisible();

  // It shows in the activity strip on vault home.
  await page.goto(vaultUrl);
  await expect(page.getByRole("heading", { name: "Lately in the family" })).toBeVisible();

  // Another family sees none of it.
  const otherContext = await browser.newContext();
  const other = await otherContext.newPage();
  await createVaultAs(other, uniqueEmail("moment-other"), "Neighbours");
  await other.goto(`${vaultUrl}/moments`);
  await expect(other.getByTestId("moment")).toHaveCount(0);
  await otherContext.close();

  // The author can remove it.
  page.once("dialog", (dialog) => void dialog.accept());
  await page.goto(`${vaultUrl}/moments`);
  await page.getByRole("button", { name: "Remove" }).click();
  await expect(page.getByTestId("moment")).toHaveCount(0);
});
