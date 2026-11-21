import { expect, test } from "@playwright/test";

test("opens this week's report and switches to the previous week", async ({ page }) => {
  const email = `report-${Date.now()}@example.test`;
  const password = "HabitHop!Secure2026";
  await page.goto("/");
  await page.getByRole("button", { name: "Create account" }).click();
  await page.getByLabel("Display name").fill("Report Hopper");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByLabel("Confirm password").fill(password);
  await page.getByRole("button", { name: "Create account" }).click();
  await page.getByRole("button", { name: /Sprout/ }).click();
  await page.getByRole("button", { name: "Let’s go!" }).click();
  await page.getByRole("link", { name: "Report" }).click();
  await expect(page.getByRole("heading", { name: "A week of little wins" })).toBeVisible();
  await page.getByRole("button", { name: "Previous week" }).click();
  await expect(page.getByText(/–/)).toBeVisible();
  await expect(page.getByRole("button", { name: "Next week" })).toBeEnabled();
});
