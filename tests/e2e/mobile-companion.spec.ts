import { expect, test, type Page } from "@playwright/test";

import {
  createTestUser,
  getLegacySeedData,
  primeSignedInSession,
  seedCloudTrips,
} from "./helpers";

const visibleByTestId = (page: Page, testId: string) =>
  page.locator(`[data-testid="${testId}"]:visible`).first();

const prepareMobilePlanner = async (page: Page, prefix: string) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const user = createTestUser(prefix);
  await primeSignedInSession(page, user);
  await seedCloudTrips(page, user, getLegacySeedData());
  await page.goto("/");
};

const previewSeedTrip = async (page: Page) => {
  await visibleByTestId(page, "mobile-nav-trips").click();
  await visibleByTestId(page, "mobile-trip-summary-trip_outer_hebrides_2026").click();
  await expect(page.getByRole("button", { name: /^Open$/ })).toBeVisible();
};

const openSeedTrip = async (page: Page) => {
  await previewSeedTrip(page);
  await page.getByRole("button", { name: /^Open$/ }).click();
  await visibleByTestId(page, "mobile-nav-trip").click();
  await expect(visibleByTestId(page, "mobile-trip-panel")).toBeVisible();
};

test("mobile starts in Trips without a Today trip and can switch bottom nav sections", async ({
  page,
}) => {
  await prepareMobilePlanner(page, "mobile-nav");

  await expect(visibleByTestId(page, "mobile-trips-panel")).toBeVisible();
  await expect(visibleByTestId(page, "mobile-nav-trips")).toHaveAttribute(
    "aria-current",
    "page",
  );

  await visibleByTestId(page, "mobile-nav-trip").click();
  await expect(visibleByTestId(page, "mobile-trip-panel")).toBeVisible();

  await visibleByTestId(page, "mobile-nav-today").click();
  await expect(visibleByTestId(page, "mobile-today-panel")).toContainText(
    /Choose a Today trip/i,
  );
});

test("mobile lands on Today after a Today trip is selected", async ({ page }) => {
  await prepareMobilePlanner(page, "mobile-today");
  await previewSeedTrip(page);
  await page.getByRole("button", { name: /Set Today/i }).click();

  await page.reload();

  await expect(visibleByTestId(page, "mobile-today-panel")).toBeVisible();
  await expect(visibleByTestId(page, "mobile-nav-today")).toHaveAttribute(
    "aria-current",
    "page",
  );
  await expect(visibleByTestId(page, "mobile-today-panel")).toContainText(
    /Outer Hebrides Family Trip/i,
  );
});

test("mobile quick edit updates a stop and returns to the companion trip view", async ({
  page,
}) => {
  await prepareMobilePlanner(page, "mobile-edit");
  await openSeedTrip(page);

  await visibleByTestId(page, "mobile-trip-panel")
    .getByRole("button", { name: /Quick edit/i })
    .click();
  await visibleByTestId(page, "mobile-trip-panel").getByRole("button", { name: /^Edit$/ }).first().click();

  await page.locator('input[placeholder="Stop title"]').fill("Barra Sands overnight");
  await page.getByRole("button", { name: /Update stop/i }).click();
  await page.getByRole("button", { name: /^Save$/ }).click();

  await expect(visibleByTestId(page, "mobile-trip-panel")).toContainText(
    /Barra Sands overnight/i,
  );
  await expect(visibleByTestId(page, "mobile-trip-panel")).toContainText(/Quick edit/i);
});
