import { expect, test, type Page } from "@playwright/test";

import { primeForcedDemoMode } from "./helpers";

const visibleByTestId = (page: Page, testId: string) =>
  page.locator(`[data-testid="${testId}"]:visible`).first();

test("loads forced demo mode for local preview work", async ({ page }) => {
  await primeForcedDemoMode(page);
  await page.goto("/");

  await expect(page.getByRole("heading", { name: /Dashboard/i })).toBeVisible();
  await expect(
    page.getByRole("heading", { name: /Cloud trip library is hidden in demo mode/i }),
  ).toBeVisible();
  await expect(page.getByTestId("desktop-panel-trips")).toHaveCount(0);
  await expect(visibleByTestId(page, "dashboard-open-trip-button")).toBeVisible();
  await page.getByRole("button", { name: /Open account and sync/i }).click();
  await expect(page.getByRole("button", { name: /Reset seed data/i })).toBeVisible();
  await expect(page.getByRole("button", { name: /Send magic link/i })).toHaveCount(0);
  await expect(page.getByText(/Demo mode/i).first()).toBeVisible();
});
