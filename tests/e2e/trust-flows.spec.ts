import { expect, test } from "@playwright/test";

import {
  createTestUser,
  getLegacySeedData,
  primeSignedInSession,
  primeSignedOutState,
  seedCloudTrips,
} from "./helpers";

test("shows magic-link request UI when auth envs are present and user is signed out", async ({
  page,
}) => {
  await primeSignedOutState(page);
  await page.goto("/");

  await expect(page.getByRole("button", { name: /Send magic link/i })).toBeVisible();
  await expect(page.getByRole("heading", { name: /Sign in first, then plan/i })).toBeVisible();
  await expect(page.getByRole("heading", { name: /Outer Hebrides Family Trip/i })).toHaveCount(0);
  await page.getByPlaceholder("you@example.com").fill("traveller@example.com");
  await page.getByRole("button", { name: /Send magic link/i }).click();

  await expect(
    page.getByText(/Magic link sent to traveller@example.com/i),
  ).toBeVisible();
});

test("creates a starter example trip when a signed-in account has no cloud trip yet", async ({
  page,
}) => {
  const user = createTestUser("starter-trip");
  await primeSignedInSession(page, user);
  await seedCloudTrips(page, user, null);

  await page.goto("/");

  await expect(page.getByText(/Example trip ready/i).first()).toBeVisible();
  await expect(page.getByRole("heading", { name: /Outer Hebrides Family Trip/i })).toBeVisible();
  await expect(page.getByRole("button", { name: /Edit trip/i })).toBeVisible();
});

test("loads a signed-in cloud trip and saves an edit", async ({ page }) => {
  const user = createTestUser("save-flow");
  await primeSignedInSession(page, user);

  await page.goto("/");

  await expect(page.getByText(/Cloud trip loaded/i).first()).toBeVisible();

  await page.getByRole("button", { name: /Edit trip/i }).click();
  await expect(page.getByText(/Edit mode is unlocked/i)).toBeVisible();
  await page.getByRole("button", { name: /^Edit$/ }).first().dispatchEvent("click");
  await expect(page.getByRole("heading", { name: /Edit stop/i })).toBeVisible();
  await page.getByPlaceholder("Stop title").fill("Barra Sands Campsite Updated");
  await page.getByRole("button", { name: /Update stop/i }).click();

  await expect(page.getByText(/Barra Sands Campsite Updated/i)).toBeVisible();
  await expect(page.getByText(/Cloud trip saved successfully/i)).toBeVisible();
});

test("desktop itinerary remains scrollable and lower trip items stay interactive", async ({
  page,
}) => {
  const user = createTestUser("desktop-scroll");
  await primeSignedInSession(page, user);

  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto("/");

  await expect(page.getByText(/Cloud trip loaded/i).first()).toBeVisible();
  await page.getByRole("button", { name: /Edit trip/i }).click();

  const scrollRegion = page.getByTestId("desktop-itinerary-scroll-region");
  await expect(scrollRegion).toBeVisible();

  const scrollMetrics = await scrollRegion.evaluate((element) => ({
    clientHeight: element.clientHeight,
    scrollHeight: element.scrollHeight,
  }));

  expect(scrollMetrics.scrollHeight).toBeGreaterThan(scrollMetrics.clientHeight);

  await scrollRegion.evaluate((element) => {
    element.scrollTop = element.scrollHeight;
  });

  const lowerStaySection = page
    .locator("section")
    .filter({ has: page.getByText("Kinloch Campsite", { exact: true }) })
    .first();

  await expect(lowerStaySection).toBeVisible();
  await lowerStaySection.getByRole("button", { name: /^Edit$/ }).first().click();
  await expect(page.getByRole("heading", { name: /Edit stop/i })).toBeVisible();
});

test("offers a one-time import-or-example choice when a signed-in account has local legacy data", async ({
  page,
}) => {
  const user = createTestUser("import-flow");
  await primeSignedInSession(page, user, {
    legacyData: getLegacySeedData(),
  });
  await seedCloudTrips(page, user, null);

  await page.goto("/");

  await expect(page.getByRole("heading", { name: /Choose how this account should start/i })).toBeVisible();
  await page.getByRole("button", { name: /Import local trip/i }).click();

  await expect(page.getByText(/Imported 1 local trip into cloud sync/i).first()).toBeVisible();
  await expect(page.getByRole("button", { name: /Edit trip/i })).toBeVisible();
});

test("reopens the last synced trip offline in read-only mode", async ({ browser }) => {
  const user = createTestUser("offline-flow");
  const context = await browser.newContext();
  const page = await context.newPage();

  await primeSignedInSession(page, user);
  await page.goto("/");
  await expect(page.getByText(/Cloud trip loaded/i).first()).toBeVisible();

  await context.route(/\/api\/trips(\/.*)?$/, (route) => route.abort());

  const offlinePage = await context.newPage();
  await offlinePage.goto("/");

  await expect(
    offlinePage
      .getByText(/Unable to reach cloud sync\. Showing the last synced trip instead/i)
      .first(),
  ).toBeVisible();
  await expect(
    offlinePage.getByText(/This trip is read-only until the connection returns/i).first(),
  ).toBeVisible();
  await expect(offlinePage.getByRole("button", { name: /Edit trip/i })).toBeDisabled();
  await expect(offlinePage.getByRole("button", { name: /^Edit$/ })).toHaveCount(0);

  await context.close();
});

test("desktop rail switches between itinerary, overview, and today without hiding the map", async ({
  page,
}) => {
  const user = createTestUser("desktop-rail");
  await primeSignedInSession(page, user);

  await page.setViewportSize({ width: 1366, height: 768 });
  await page.goto("/");

  await expect(page.getByLabel(/Trip map/i)).toBeVisible();

  await page.getByTestId("desktop-panel-overview").click();
  await expect(page.locator("h1").filter({ hasText: /Outer Hebrides Family Trip/i })).toBeVisible();

  await page.getByTestId("desktop-panel-today").click();
  await expect(page.getByRole("heading", { name: /Today's actions/i })).toBeVisible();

  await page.getByTestId("desktop-panel-itinerary").click();
  await expect(page.getByRole("heading", { name: /Itinerary/i })).toBeVisible();
  await expect(page.getByLabel(/Trip map/i)).toBeVisible();
});

test("recovers cleanly from a stale write conflict", async ({ browser }) => {
  const user = createTestUser("conflict-flow");

  const contextA = await browser.newContext();
  const pageA = await contextA.newPage();
  await primeSignedInSession(pageA, user);
  await pageA.goto("/");
  await expect(pageA.getByText(/Cloud trip loaded/i).first()).toBeVisible();

  const contextB = await browser.newContext();
  const pageB = await contextB.newPage();
  await primeSignedInSession(pageB, user);
  await pageB.goto("/");
  await expect(pageB.getByText(/Cloud trip loaded/i).first()).toBeVisible();

  await pageA.getByRole("button", { name: /Edit trip/i }).click();
  await pageA.getByRole("button", { name: /^Edit$/ }).first().dispatchEvent("click");
  await expect(pageA.getByRole("heading", { name: /Edit stop/i })).toBeVisible();
  await pageA.getByPlaceholder("Stop title").fill("Conflict Winner Campsite");
  await pageA.getByRole("button", { name: /Update stop/i }).click();
  await expect(pageA.getByText(/Conflict Winner Campsite/i)).toBeVisible();

  await pageB.getByRole("button", { name: /Edit trip/i }).click();
  await pageB.getByRole("button", { name: /^Edit$/ }).first().dispatchEvent("click");
  await expect(pageB.getByRole("heading", { name: /Edit stop/i })).toBeVisible();
  await pageB.getByPlaceholder("Stop title").fill("Conflict Loser Campsite");
  await pageB.getByRole("button", { name: /Update stop/i }).click();

  await expect(
    pageB
      .getByText(/Trip changed on another device\. The latest version has been loaded/i)
      .first(),
  ).toBeVisible();
  await expect(pageB.getByText(/Conflict Winner Campsite/i)).toBeVisible();

  await contextA.close();
  await contextB.close();
});
