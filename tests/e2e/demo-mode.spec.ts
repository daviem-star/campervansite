import { expect, test } from "@playwright/test";

import { primeForcedDemoMode } from "./helpers";

test("loads demo mode when Supabase envs are absent", async ({ page }) => {
  await primeForcedDemoMode(page);
  await page.goto("/");

  await expect(page.getByText(/Cloud sync is not configured in this environment yet/i)).toBeVisible();
  await expect(page.getByRole("heading", { name: /Outer Hebrides Family Trip/i })).toBeVisible();
  await expect(page.getByRole("button", { name: /Reset seed data/i })).toBeVisible();
  await expect(page.getByRole("button", { name: /Send magic link/i })).toHaveCount(0);
});
