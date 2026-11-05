import { expect, test } from "@playwright/test";
import { addPerson, createVaultAs, uniqueEmail } from "./helpers.ts";

// The app shell and design system: navigation that fits the device, the Add sheet, designed
// empty states, and reduced motion.

test("phones get a bottom navigation, desktops a top bar, and the Add sheet starts the next step", async ({
  page,
  isMobile,
}) => {
  const vaultUrl = await createVaultAs(page, uniqueEmail("shell"), "Shell family");
  await addPerson(page, vaultUrl, { relation: "Ba", name: "Kamla Patel" });
  await page.goto(vaultUrl);

  const nav = page.getByRole("navigation", { name: "Main" });
  const bottom = nav.filter({ has: page.getByRole("link", { name: "Vault" }) });
  await expect(nav.getByRole("link", { name: "Vault" })).toHaveAttribute("aria-current", "page");

  if (isMobile) {
    await expect(bottom.first()).toBeVisible();
    // The nav sits at the bottom edge, within thumb reach.
    const box = await bottom.first().boundingBox();
    const viewport = page.viewportSize();
    expect(box && viewport && box.y + box.height).toBeGreaterThan((viewport?.height ?? 0) - 4);
    await page.getByRole("button", { name: "Add" }).click();
  } else {
    await page.getByRole("button", { name: "Add" }).first().click();
  }

  const sheet = page.getByRole("dialog", { name: "Add to your vault" });
  await expect(sheet).toBeVisible();
  await sheet.getByRole("link", { name: /Add a person/ }).click();
  await expect(page).toHaveURL(/\/people\/new/);
  await expect(page.getByRole("dialog")).toHaveCount(0);
});

test("Moments shows a designed empty state and the nav marks it current", async ({ page }) => {
  const vaultUrl = await createVaultAs(page, uniqueEmail("moments"), "Moments family");
  await page.goto(`${vaultUrl}/moments`);
  await expect(page.getByRole("heading", { level: 1, name: "Moments" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Nothing cooked yet" })).toBeVisible();
  const moments = page.getByRole("navigation", { name: "Main" }).getByRole("link", {
    name: "Moments",
  });
  await expect(moments.first()).toHaveAttribute("aria-current", "page");
  await expect(
    page.getByRole("navigation", { name: "Main" }).getByRole("link", { name: "Vault" }).first(),
  ).not.toHaveAttribute("aria-current", "page");
});

test("the skip link jumps to the page content", async ({ page }) => {
  const vaultUrl = await createVaultAs(page, uniqueEmail("skip"), "Skip family");
  // A fresh page load, so focus starts at the top (the sign-up steps left it on a link).
  await page.goto(vaultUrl);
  await page.keyboard.press("Tab");
  const skip = page.getByRole("link", { name: "Skip to content" });
  await expect(skip).toBeFocused();
  await expect(skip).toBeVisible();
});

test("reduced motion switches animation off", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  const duration = await page.evaluate(() => {
    const main = document.querySelector("main");
    return main ? getComputedStyle(main.parentElement ?? main).animationDuration : null;
  });
  expect(Number.parseFloat(duration ?? "1")).toBeLessThan(0.001);
});

test("the signed-out landing page works in Gujarati", async ({ page, context }) => {
  await context.addCookies([{ name: "virasat_lang", value: "gu", url: "http://localhost:3000" }]);
  await page.goto("/");
  await expect(page.locator("html")).toHaveAttribute("lang", "gu");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
});
