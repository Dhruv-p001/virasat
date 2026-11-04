import { expect, test } from "@playwright/test";
import { latestSignInEmail, signInWithEmail, uniqueEmail } from "./helpers.ts";

test("a new organiser signs in with an email code and names their vault", async ({ page }) => {
  await signInWithEmail(page, uniqueEmail("organiser"));
  await expect(page).toHaveURL(/\/onboarding/);

  // An empty field is caught by the browser; spaces only get past it and the server says why.
  await page.getByLabel("Vault name").fill("   ");
  await page.getByRole("button", { name: "Create vault" }).click();
  await expect(page.getByText("This is required.")).toBeVisible();

  await page.getByLabel("Vault name").fill("Desai family");
  await page.getByRole("button", { name: "Create vault" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Desai family" })).toBeVisible();
  await expect(page.getByText("You are Owner")).toBeVisible();
  await expect(page.getByText("Add the people whose recipes you want to keep")).toBeVisible();
});

test("the email link signs you in on another device", async ({ page, browser }) => {
  const address = uniqueEmail("link");
  await page.goto("/sign-in?next=%2Fsettings");
  const sentAt = new Date();
  await page.getByLabel("Email address").fill(address);
  await page.getByRole("button", { name: "Send code" }).click();
  const { link } = await latestSignInEmail(address, sentAt);

  // A brand-new browser context, like opening the email on a phone.
  const otherDevice = await browser.newContext();
  const phone = await otherDevice.newPage();
  await phone.goto(link);
  await expect(phone).toHaveURL(/\/settings$/);
  await expect(phone.getByRole("heading", { name: "Settings" })).toBeVisible();

  // The link works once.
  await phone.context().clearCookies();
  await phone.goto(link);
  await expect(phone).toHaveURL(/\/sign-in\?error=link/);
  await expect(phone.getByText("That sign-in link has expired or was already used.")).toBeVisible();
  await otherDevice.close();
});

test("a wrong code is refused with a clear message", async ({ page }) => {
  await page.goto("/sign-in");
  await page.getByLabel("Email address").fill(uniqueEmail("wrong-code"));
  await page.getByRole("button", { name: "Send code" }).click();
  await page.getByLabel("6-digit code").fill("000000");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByText("That code didn't work.")).toBeVisible();
});

test("signed-out visitors are sent to sign-in and brought back", async ({ page }) => {
  await page.goto("/settings");
  await expect(page).toHaveURL(/\/sign-in\?next=%2Fsettings/);
  await signInWithEmail(page, uniqueEmail("return"), "/settings");
  await expect(page).toHaveURL(/\/settings$/);
});

test("sign-in links cannot redirect off-site", async ({ page }) => {
  await signInWithEmail(page, uniqueEmail("redirect"), "https://evil.example/");
  await expect(page).toHaveURL(/^http:\/\/localhost:3000\//);
});

test("signing out ends the session", async ({ page }) => {
  await signInWithEmail(page, uniqueEmail("sign-out"), "/settings");
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page.getByRole("link", { name: "Get started" })).toBeVisible();
  await page.goto("/settings");
  await expect(page).toHaveURL(/\/sign-in/);
});
