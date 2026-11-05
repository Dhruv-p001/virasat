import { expect, test } from "@playwright/test";
import { createVaultAs, uniqueEmail } from "./helpers.ts";

// ADR 0018: pictures, a warm backdrop and gentle motion. These tests check that the decoration
// is decoration (hidden from screen readers, never in the way) and that it stops when asked.

test("the landing page explains the product in three illustrated steps", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 2, name: "How it works" })).toBeVisible();

  const steps = page.getByTestId("how-step");
  await expect(steps).toHaveCount(3);
  await expect(steps.nth(0)).toContainText("Record her voice");
  await expect(steps.nth(1)).toContainText("Photograph her handwriting");
  await expect(steps.nth(2)).toContainText("Keep it in her words");

  // Each step has a picture, and the picture is hidden from screen readers.
  for (let index = 0; index < 3; index++) {
    await expect(steps.nth(index).locator('svg[aria-hidden="true"]')).toBeVisible();
  }
  // The pictures never push the page wider than the screen.
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
});

test("the warm backdrop sits behind the page and takes no clicks", async ({ page }) => {
  await page.goto("/");
  const backdrop = await page.evaluate(() => {
    const style = getComputedStyle(document.body, "::before");
    return {
      position: style.position,
      zIndex: style.zIndex,
      pointerEvents: style.pointerEvents,
      image: style.backgroundImage,
    };
  });
  expect(backdrop.position).toBe("fixed");
  expect(Number(backdrop.zIndex)).toBeLessThan(0);
  expect(backdrop.pointerEvents).toBe("none");
  // Two soft glows and the grain.
  expect(backdrop.image.match(/radial-gradient/g)).toHaveLength(2);
  expect(backdrop.image).toContain("url(");

  // The page is still usable through it.
  await page.getByRole("link", { name: "Get started" }).first().click();
  await expect(page).toHaveURL(/\/sign-in/);
  await expect(page.locator('main svg[aria-hidden="true"]').first()).toBeVisible();
});

test("movement stops when the visitor asks for less motion", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  const durations = await page.evaluate(() =>
    [...document.querySelectorAll<HTMLElement>(".reveal, .page-in, .steam")].map(
      (element) => parseFloat(getComputedStyle(element).animationDuration) || 0,
    ),
  );
  expect(durations.length).toBeGreaterThan(0);
  for (const seconds of durations) expect(seconds).toBeLessThan(0.001);

  // And with motion allowed, the same elements do animate.
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.reload();
  const allowed = await page.evaluate(() =>
    [...document.querySelectorAll<HTMLElement>(".reveal")].map(
      (element) => parseFloat(getComputedStyle(element).animationDuration) || 0,
    ),
  );
  expect(allowed.length).toBeGreaterThan(0);
  for (const seconds of allowed) expect(seconds).toBeGreaterThan(0.1);
});

test("an empty vault shows a picture and the next step, not a bare box", async ({ page }) => {
  const vaultUrl = await createVaultAs(page, uniqueEmail("empty"), "Mehta family");
  await page.goto(vaultUrl);
  const empty = page.locator("div", {
    has: page.getByRole("heading", { level: 3, name: "Add your first family recipe" }),
  });
  await expect(empty.locator('svg[aria-hidden="true"]').first()).toBeVisible();
  await expect(empty.getByRole("link", { name: "Add a recipe" }).first()).toBeVisible();
});
