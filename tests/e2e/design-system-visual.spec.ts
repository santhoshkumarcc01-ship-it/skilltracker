import { expect, test } from "@playwright/test";

test("landing page renders LazyMotion components without runtime errors", async ({ page }) => {
  const runtimeErrors: string[] = [];
  page.on("pageerror", (error) => runtimeErrors.push(error.message));
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /Little steps\. Big streaks\./ })).toBeVisible();
  await expect(page.getByRole("button", { name: "Create account" })).toBeVisible();
  expect(runtimeErrors).toEqual([]);
});

test("shared controls support text entry, keyboard tabs, toggles, dialogs, sheets, and sound actions", async ({ page }) => {
  const runtimeErrors: string[] = [];
  page.on("pageerror", (error) => runtimeErrors.push(error.message));
  await page.goto("/design-system");
  await page.waitForFunction(() => Boolean(document.documentElement.dataset.motionTier));

  for (const name of ["Primary action", "Secondary", "Danger", "Ghost", "Small", "Large"]) {
    await page.getByRole("button", { name, exact: true }).click();
  }
  await expect(page.getByRole("button", { name: "Disabled" })).toBeDisabled();
  await page.getByRole("button", { name: "dark", exact: true }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.getByRole("button", { name: "high-contrast", exact: true }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "high-contrast");
  await page.getByRole("button", { name: "light", exact: true }).click();
  await page.getByRole("button", { name: "LOW", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Motion preview · LOW" })).toBeVisible();
  await page.getByRole("button", { name: "MID", exact: true }).click();
  await page.getByRole("button", { name: "HIGH", exact: true }).click();
  await page.getByRole("button", { name: "Auto tier", exact: true }).click();

  const name = page.getByRole("textbox", { name: "Your name" });
  await name.fill("Daily Hopper");
  await expect(name).toHaveValue("Daily Hopper");

  const password = page.getByLabel("Create a password");
  await password.fill("SecurePass123!");
  await expect(password).toHaveValue("SecurePass123!");
  await expect(page.getByRole("meter", { name: "Password strength" })).toHaveAttribute("aria-valuenow", "4");
  await page.getByRole("button", { name: "Show password" }).click();
  await expect(password).toHaveAttribute("type", "text");
  await page.getByRole("button", { name: "Hide password" }).click();
  await expect(password).toHaveAttribute("type", "password");

  const reminder = page.getByRole("switch", { name: "Daily reminders" });
  await reminder.click();
  await expect(reminder).toHaveAttribute("aria-checked", "false");
  const weeklyTab = page.getByRole("tab", { name: "Weekly" });
  await weeklyTab.click();
  await expect(weeklyTab).toHaveAttribute("aria-selected", "true");
  await weeklyTab.press("ArrowRight");
  await expect(page.getByRole("tab", { name: "Monthly" })).toHaveAttribute("aria-selected", "true");

  await page.getByRole("button", { name: "Open modal" }).click();
  const modal = page.getByRole("dialog", { name: "A little celebration" });
  await expect(modal).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(modal).toBeHidden();

  await page.getByRole("button", { name: "Open sheet" }).click();
  const sheet = page.getByRole("dialog", { name: "Quick panel" });
  await expect(sheet).toBeVisible();
  await page.getByRole("button", { name: "Close sheet" }).click();
  await expect(sheet).toBeHidden();

  await page.getByRole("switch", { name: "Sound on" }).click();
  await expect(page.getByRole("switch", { name: "Sound muted" })).toHaveAttribute("aria-checked", "true");
  await page.getByRole("switch", { name: "Ambient loop" }).click();
  await expect(page.getByRole("switch", { name: "Ambient loop" })).toHaveAttribute("aria-checked", "false");
  const volume = page.getByRole("slider", { name: "Sound volume" });
  const startingVolume = await volume.inputValue();
  await volume.press("ArrowRight");
  await expect(volume).not.toHaveValue(startingVolume);
  for (const sound of ["click", "success", "streak", "Level up", "chest", "poke", "error", "purchase"]) {
    await page.getByRole("button", { name: sound, exact: true }).click();
  }

  expect(runtimeErrors).toEqual([]);
});

test("landing calls to action open the matching auth forms", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL(/\/signup$/);
  await expect(page.getByRole("heading", { name: "Start your hop" })).toBeVisible();
  await page.getByRole("link", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole("heading", { name: "Welcome back" })).toBeVisible();
});

test("unauthenticated visits to every app page return to sign-in", async ({ page }) => {
  const appPaths = ["/dashboard", "/story", "/materials", "/friends", "/league", "/report", "/motivation", "/shop", "/settings", "/onboarding"];
  for (const path of appPaths) {
    await page.goto(path);
    await expect(page).toHaveURL(/\/login(?:\?.*)?$/);
    await expect(page.getByRole("heading", { name: "Welcome back" })).toBeVisible();
  }
});

test("login fields validate inline and do not post invalid credentials", async ({ page }) => {
  const loginPosts: string[] = [];
  const runtimeErrors: string[] = [];
  page.on("pageerror", (error) => runtimeErrors.push(error.message));
  page.on("request", (request) => {
    if (request.method() === "POST" && request.url().includes("/api/v1/auth/login")) loginPosts.push(request.url());
  });
  await page.goto("/login");
  await page.waitForFunction(() => Boolean(document.documentElement.dataset.motionTier));
  const email = page.getByLabel("Email");
  const password = page.getByRole("textbox", { name: "Password", exact: true });
  await email.fill("not-an-email");
  await page.getByRole("button", { name: "Show password" }).click();
  await password.fill("short");
  await page.getByRole("button", { name: "Hide password" }).click();
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(email).toHaveAttribute("aria-invalid", "true");
  await expect(password).toHaveAttribute("aria-invalid", "false");
  expect(loginPosts).toEqual([]);
  await page.goto("/login?signup=pending");
  await expect(page.getByRole("status")).toContainText("If an account can be created");
  expect(runtimeErrors).toEqual([]);
});

test("signup fields expose inline validation without sending invalid credentials", async ({ page }) => {
  const signupPosts: string[] = [];
  page.on("request", (request) => {
    if (request.method() === "POST" && request.url().includes("/api/v1/auth/signup")) signupPosts.push(request.url());
  });
  await page.goto("/signup");
  await page.waitForFunction(() => Boolean(document.documentElement.dataset.motionTier));
  await page.getByLabel("Display name").fill("Hopper");
  const email = page.getByLabel("Email");
  await email.fill("not-an-email");
  const password = page.getByRole("textbox", { name: "Password", exact: true });
  await password.fill("short");
  const confirmation = page.getByLabel("Confirm password");
  await confirmation.fill("different");
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(email).toHaveAttribute("aria-invalid", "true");
  await expect(password).toHaveAttribute("aria-invalid", "true");
  await expect(confirmation).toHaveAttribute("aria-invalid", "true");
  expect(signupPosts).toEqual([]);
});

test("public design system renders across themes and screen sizes", async ({ page }, testInfo) => {
  for (const viewport of [{ width: 360, height: 800 }, { width: 768, height: 1024 }, { width: 1440, height: 900 }]) {
    await page.setViewportSize(viewport);
    for (const theme of ["light", "dark", "high-contrast"] as const) {
      await page.goto("/design-system");
      await page.getByRole("button", { name: theme, exact: true }).click();
      await expect(page.getByRole("heading", { name: "Design system" })).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
      await testInfo.attach(`design-system-${viewport.width}-${theme}`, {
        body: await page.screenshot({ fullPage: true }),
        contentType: "image/png",
      });
    }
  }
});

test("OS reduced-motion preference removes ambient motion", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/design-system");
  const duration = await page.locator(".aurora-backdrop").evaluate((element) => getComputedStyle(element, "::before").animationDuration);
  expect(["0s", "1e-05s", "0.00001s"]).toContain(duration);
});
