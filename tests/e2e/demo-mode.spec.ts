import { expect, test, type Page } from "@playwright/test";

import { appThemePreferenceStorageKey } from "../../lib/theme";
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

test("theme toggle follows system preference and persists manual choice", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "dark" });
  await primeForcedDemoMode(page);
  await page.goto("/");

  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");

  const desktopToggle = visibleByTestId(page, "theme-mode-toggle");
  await expect(desktopToggle).toBeVisible();
  await desktopToggle.click();

  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await expect(
    page.evaluate((key) => window.localStorage.getItem(key), appThemePreferenceStorageKey),
  ).resolves.toBe("light");

  await page.reload();

  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
});

test("theme toggle is available in the mobile shell", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await primeForcedDemoMode(page);
  await page.goto("/");

  const mobileToggle = visibleByTestId(page, "theme-mode-toggle");
  await expect(mobileToggle).toBeVisible();
  await mobileToggle.click();

  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
});
