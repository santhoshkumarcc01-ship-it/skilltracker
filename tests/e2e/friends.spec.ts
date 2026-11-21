import { expect, test, type Page } from "@playwright/test";

async function signUp(page: Page, label: string) {
  const email = `duo-${label}-${Date.now()}@example.test`;
  await page.goto("/"); await page.getByRole("button", { name: "Create account" }).click();
  await page.getByLabel("Display name").fill(`Hopper ${label}`); await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill("HabitHop!Secure2026"); await page.getByLabel("Confirm password").fill("HabitHop!Secure2026");
  await page.getByRole("button", { name: "Create account" }).click(); await page.getByRole("button", { name: /Sprout/ }).click(); await page.locator("#daily-goal").focus(); await page.locator("#daily-goal").press("Home"); await page.getByRole("button", { name: "Let’s go!" }).click();
}

test("two friends accept an invite and advance their duo streak after both finish today", async ({ browser }) => {
  const contextA = await browser.newContext(); const contextB = await browser.newContext();
  const a = await contextA.newPage(); const b = await contextB.newPage();
  await Promise.all([signUp(a, "A"), signUp(b, "B")]);
  await a.goto("/friends"); await b.goto("/friends");
  const tokenB = await b.locator("code").first().innerText();
  await a.getByLabel("Friend code").fill(tokenB); await a.getByRole("button", { name: "Send invite" }).click();
  await expect(b.getByText(/invited you/)).toBeVisible({ timeout: 15_000 }); await b.getByRole("button", { name: "Accept" }).click();
  await expect(a.getByText("Hopper B")).toBeVisible({ timeout: 15_000 });

  await Promise.all([a.goto("/dashboard"), b.goto("/dashboard")]);
  for (const [page, task] of [[a, "Read together"], [b, "Read together"]] as const) {
    await page.getByRole("button", { name: "Add today’s first task" }).click();
    await page.getByLabel("Task title").fill(task);
    await page.getByLabel("Planned duration in minutes").press("Home");
    await page.getByRole("button", { name: "Add task" }).click();
    await page.getByRole("button", { name: "▶ Start" }).click();
  }
  await Promise.all([a.waitForTimeout(16_000), b.waitForTimeout(16_000)]);
  await Promise.all([a.getByRole("button", { name: "✓ Complete" }).click(), b.getByRole("button", { name: "✓ Complete" }).click()]);
  await Promise.all([a.goto("/friends"), b.goto("/friends")]);
  await expect(a.getByText(/Duo streak: 1 days?/)).toBeVisible({ timeout: 15_000 });
  await contextA.close(); await contextB.close();
});
