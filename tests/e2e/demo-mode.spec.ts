import { expect, test } from "@playwright/test";

import { primeForcedDemoMode } from "./helpers";

test("loads forced demo mode for local preview work", async ({ page }) => {
  await primeForcedDemoMode(page);
  await page.goto("/");

  await expect(page.getByRole("heading", { name: /Outer Hebrides Family Trip/i })).toBeVisible();
  await page.getByTestId("desktop-panel-overview").click();
  await expect(page.getByRole("button", { name: /Reset seed data/i })).toBeVisible();
  await expect(page.getByRole("button", { name: /Send magic link/i })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /Edit trip/i })).toBeVisible();
});
