import { test, expect } from "@playwright/test";

test.describe("Landing page", () => {
  test("shows the MIMIC hero and primary actions", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 }).or(page.getByText("MIMIC")).first()).toBeVisible();
    await expect(page.getByRole("button", { name: /play now/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /create room/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /join room/i })).toBeVisible();
  });

  test("opens the How to Play modal", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: /how to play/i }).click();
    await expect(page.getByText(/how to play mimic/i)).toBeVisible();
    await expect(page.getByText(/get your secret/i)).toBeVisible();
  });

  test("gates protected routes behind login", async ({ page }) => {
    await page.goto("/create-room");
    // Unauthenticated users are redirected to /login with a callback.
    await expect(page).toHaveURL(/\/login/);
    await expect(page.getByRole("tab", { name: /sign up/i })).toBeVisible();
  });
});

test.describe("Auth forms", () => {
  test("switches between sign in and sign up tabs", async ({ page }) => {
    await page.goto("/login");
    await page.getByRole("tab", { name: /sign up/i }).click();
    await expect(page.getByLabel(/display name/i)).toBeVisible();
    await expect(page.getByText(/choose your avatar/i)).toBeVisible();
  });
});
