import { expect, test } from "@playwright/test";

import { primeForcedDemoMode } from "./helpers";

test("loads forced demo mode for local preview work", async ({ page }) => {
  await primeForcedDemoMode(page);
  await page.goto("/");

  await expect(page.getByRole("button", { name: /Edit trip/i })).toBeVisible();
  await expect(page.getByTestId("desktop-panel-trips")).toHaveCount(0);
  await page.getByRole("button", { name: /Open account and sync/i }).click();
  await expect(page.getByRole("button", { name: /Reset seed data/i })).toBeVisible();
  await expect(page.getByRole("button", { name: /Send magic link/i })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /Edit trip/i })).toBeVisible();
});
