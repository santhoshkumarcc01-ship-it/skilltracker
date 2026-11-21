import { expect, test } from "@playwright/test";

test("today is editable, future dates are locked, and completing the plan advances a streak", async ({ page }) => {
  const email = `dash-${Date.now()}@example.test`;
  const password = "HabitHop!Secure2026";
  await page.goto("/");
  await page.getByRole("button", { name: "Create account" }).click();
  await page.getByLabel("Display name").fill("Daily Hopper");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByLabel("Confirm password").fill(password);
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page.getByRole("heading", { name: "Let’s make this yours" })).toBeVisible();
  await page.getByRole("button", { name: /Sprout/ }).click();
  await page.getByRole("button", { name: "Let’s go!" }).click();
  await expect(page.getByRole("heading", { name: "Ready for a new hop?" })).toBeVisible();

  await page.setViewportSize({ width: 360, height: 800 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
  await page.setViewportSize({ width: 1440, height: 900 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);

  const nextDay = page.getByRole("gridcell", { name: /locked future date/ }).first();
  await expect(nextDay).toBeVisible();
  expect(await nextDay.evaluate((element) => element.tagName)).toBe("DIV");
  await page.getByRole("button", { name: "Add today’s first task" }).click();
  await page.getByLabel("Task title").fill("Read a little");
  await page.getByLabel("Planned duration in minutes").press("Home");
  await page.getByRole("button", { name: "Add task" }).click();
  await expect(page.getByRole("heading", { name: "Read a little" })).toBeVisible();
  await page.getByRole("button", { name: "▶ Start" }).click();
  await page.waitForTimeout(16_000);
  await page.getByRole("button", { name: "✓ Complete" }).click();
  await expect(page.getByText("Lovely work! You showed up for yourself.")).toBeVisible();
  await expect(page.locator('[aria-label$="experience points"]')).not.toHaveAttribute("aria-label", "0 experience points");
  await expect(page.getByText("First little win")).toBeVisible();
  await page.getByRole("button", { name: "Keep hopping" }).click();
  await expect(page.getByText(/Your daily chest is ready/)).toBeVisible();
  await page.getByRole("button", { name: "Open chest" }).click();
  await expect(page.getByRole("heading", { name: "Daily chest!" })).toBeVisible();
  await page.getByRole("button", { name: "Lovely!" }).click();
  await expect(page.locator('[aria-label="1 day streak"]')).toBeVisible();
});
