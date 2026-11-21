import { expect, test } from "@playwright/test";

test("protected design-system showcase redirects unauthenticated visitors", async ({ page }) => {
  await page.goto("/design-system");
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole("heading", { name: "Welcome back" })).toBeVisible();
});

test("a person can sign up, onboard, sign out, and sign back in", async ({ page }) => {
  const email = `hop-${Date.now()}@example.test`;
  const password = "HabitHop!Secure2026";

  await page.goto("/");
  await page.getByRole("button", { name: "Create account" }).click();
  await page.getByLabel("Display name").fill("Test Hopper");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByLabel("Confirm password").fill(password);
  await page.getByRole("button", { name: "Create account" }).click();

  await expect(page.getByRole("heading", { name: "Let’s make this yours" })).toBeVisible();
  await page.getByRole("button", { name: /Comet/ }).click();
  await page.getByLabel(/Daily goal/).press("ArrowRight");
  await page.getByRole("button", { name: "Let’s go!" }).click();
  await expect(page.getByRole("heading", { name: "Ready for a new hop?" })).toBeVisible();

  await page.getByRole("button", { name: /Sign out/ }).click();
  await expect(page.getByRole("heading", { name: /Little steps/ })).toBeVisible();
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Ready for a new hop?" })).toBeVisible();
});
