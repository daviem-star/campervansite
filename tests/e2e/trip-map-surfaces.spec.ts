import { expect, test, type Page } from "@playwright/test";

import { createTestUser, getLegacySeedData, primeSignedInSession, seedCloudTrips } from "./helpers";

const visibleByTestId = (page: Page, testId: string) =>
  page.locator(`[data-testid="${testId}"]:visible`);

const prepareSignedInPlanner = async (page: Page) => {
  const user = createTestUser("trip-map");
  await primeSignedInSession(page, user);
  await seedCloudTrips(page, user, getLegacySeedData());
  await page.goto("/");
  await visibleByTestId(page, "trip-summary-trip_outer_hebrides_2026").click();
  await expect(visibleByTestId(page, "dashboard-open-trip-button")).toBeVisible();
};

const selectMapEntity = async (
  page: Page,
  registryKey: string,
  entity: {
    kind: "stay" | "ferry" | "point_of_interest";
    stopId: string;
  },
) => {
  await expect.poll(
    async () =>
      page.evaluate((key) => (window.__plannerMapRegistry?.[key]?.length ?? 0) > 0, registryKey),
    {
      timeout: 10_000,
    },
  ).not.toBeNull();

  const interaction = await page.evaluate(
    ({ key, selection }) => {
      const entries = window.__plannerMapRegistry?.[key] ?? [];

      for (const entry of entries) {
        const point = entry.getClientPointForEntity(selection);
        if (point) {
          return {
            mode: "click" as const,
            point,
          };
        }
      }

      const fallbackEntry = entries[0];
      if (!fallbackEntry) {
        return null;
      }

      fallbackEntry.selectEntity(selection);

      return {
        mode: "select" as const,
      };
    },
    {
      key: registryKey,
      selection: entity,
    },
  );

  if (!interaction) {
    throw new Error(`Unable to locate map point for ${registryKey}:${entity.stopId}`);
  }

  if (interaction.mode === "click") {
    await page.mouse.click(interaction.point.x, interaction.point.y);
  }
};

test("shows a dashboard preview map and opens trips into overview with the map visible", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1366, height: 900 });
  await prepareSignedInPlanner(page);

  const dashboardMapPanel = visibleByTestId(page, "dashboard-trip-map-panel");
  await expect(dashboardMapPanel).toBeVisible();
  await expect(dashboardMapPanel.getByLabel("Trip map")).toBeVisible();
  await expect(visibleByTestId(page, "dashboard-map-selection-summary")).toContainText(
    /Select a stop or ferry leg on the map/i,
  );

  await visibleByTestId(page, "dashboard-open-trip-button").click();

  const overviewMapPanel = visibleByTestId(page, "overview-trip-map-panel");
  await expect(overviewMapPanel).toBeVisible();
  await expect(overviewMapPanel.getByLabel("Trip map")).toBeVisible();
  await expect(visibleByTestId(page, "desktop-panel-overview")).toBeVisible();
});

test("updates dashboard and overview selection summaries from map interactions", async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 900 });
  await prepareSignedInPlanner(page);

  await selectMapEntity(page, "dashboard-trip-map-panel", {
    kind: "stay",
    stopId: "stop_stay_1",
  });
  await expect(visibleByTestId(page, "dashboard-map-selection-summary")).toContainText(
    /Barra Sands Campsite/i,
  );

  await visibleByTestId(page, "dashboard-open-trip-button").click();
  await expect(visibleByTestId(page, "overview-trip-map-panel")).toBeVisible();

  await selectMapEntity(page, "overview-trip-map-panel", {
    kind: "point_of_interest",
    stopId: "stop_poi_1",
  });
  await expect(visibleByTestId(page, "overview-map-selection-summary")).toContainText(
    /Vatersay Beach Walk/i,
  );
});

test("opens the mobile full-screen map from dashboard, overview, and itinerary", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await prepareSignedInPlanner(page);

  const dashboardMapButton = visibleByTestId(page, "dashboard-mobile-map-button");
  await dashboardMapButton.scrollIntoViewIfNeeded();
  await dashboardMapButton.click();
  await expect(page.getByTestId("mobile-trip-map-overlay")).toBeVisible();
  await page.getByRole("button", { name: /Close map/i }).click();
  await expect(dashboardMapButton).toBeVisible();

  const openTripButton = visibleByTestId(page, "dashboard-open-trip-button");
  await openTripButton.scrollIntoViewIfNeeded();
  await openTripButton.click();

  const overviewMapButton = visibleByTestId(page, "overview-mobile-map-button");
  await overviewMapButton.scrollIntoViewIfNeeded();
  await overviewMapButton.click();
  await expect(page.getByTestId("mobile-trip-map-overlay")).toBeVisible();
  await page.getByRole("button", { name: /Close map/i }).click();
  await expect(overviewMapButton).toBeVisible();

  const itineraryTab = visibleByTestId(page, "desktop-panel-itinerary");
  await itineraryTab.scrollIntoViewIfNeeded();
  await itineraryTab.click();

  const itineraryMapButton = visibleByTestId(page, "itinerary-mobile-map-button");
  await itineraryMapButton.scrollIntoViewIfNeeded();
  await itineraryMapButton.click();
  await expect(page.getByTestId("mobile-trip-map-overlay")).toBeVisible();
  await page.getByRole("button", { name: /Close map/i }).click();
  await expect(itineraryMapButton).toBeVisible();
});
