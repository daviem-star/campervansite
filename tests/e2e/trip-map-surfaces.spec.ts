import { expect, test, type Page } from "@playwright/test";

import { createTestUser, getLegacySeedData, primeSignedInSession, seedCloudTrips } from "./helpers";

const visibleByTestId = (page: Page, testId: string) =>
  page.locator(`[data-testid="${testId}"]:visible`);

const expectHeightAtLeast = async (
  page: Page,
  testId: string,
  minimumHeight: number,
) => {
  await expect
    .poll(
      async () => {
        const box = await visibleByTestId(page, testId).boundingBox();
        return box?.height ?? 0;
      },
      { timeout: 10_000 },
    )
    .toBeGreaterThan(minimumHeight);
};

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

  await expect(visibleByTestId(page, "trip-workspace-header")).toBeVisible();
  await expect(visibleByTestId(page, "trip-workspace-header-summary")).toContainText(
    /Home base/i,
  );

  const overviewRegion = visibleByTestId(page, "overview-scroll-region");
  const persistentMapPanel = visibleByTestId(page, "trip-persistent-map-panel");
  await expect(persistentMapPanel).toBeVisible();
  await expect(persistentMapPanel.getByLabel("Trip map")).toBeVisible();
  await expect(overviewRegion.getByText(/^Trip overview$/i)).toHaveCount(0);
  await expect(page.locator('[data-testid="overview-map-selection-summary"]')).toHaveCount(0);
  await expectHeightAtLeast(page, "trip-persistent-map-panel", 500);
  await expect(visibleByTestId(page, "overview-warnings-panel")).toBeVisible();
  await expect(visibleByTestId(page, "overview-route-insights-panel")).toBeVisible();
  await expect(visibleByTestId(page, "desktop-panel-overview")).toBeVisible();

  const mapBox = await persistentMapPanel.boundingBox();
  const warningsBox = await visibleByTestId(page, "overview-warnings-panel").boundingBox();
  const routeInsightsBox = await visibleByTestId(page, "overview-route-insights-panel").boundingBox();
  expect(mapBox).not.toBeNull();
  expect(warningsBox).not.toBeNull();
  expect(routeInsightsBox).not.toBeNull();
  expect(mapBox!.y).toBeLessThan(warningsBox!.y);
  expect(warningsBox!.y).toBeLessThan(routeInsightsBox!.y);

  await visibleByTestId(page, "desktop-panel-itinerary").click();
  await expect(visibleByTestId(page, "desktop-panel-itinerary-region")).toBeVisible();
  await expect(visibleByTestId(page, "planner-mode-toggle")).toBeVisible();
  await expect(visibleByTestId(page, "trip-persistent-map-panel")).toBeVisible();

  await visibleByTestId(page, "trip-persistent-map-panel").getByRole("button", {
    name: /Open map/i,
  }).click();
  await expect(visibleByTestId(page, "planner-map-cockpit")).toBeVisible();
  await expect(visibleByTestId(page, "planner-map-cockpit").getByLabel("Trip map")).toBeVisible();
  await expectHeightAtLeast(page, "planner-map-cockpit-map-surface", 700);

  const cockpitMapBox = await visibleByTestId(page, "planner-map-cockpit-map-surface").boundingBox();
  const cockpitSideBox = await visibleByTestId(page, "planner-map-cockpit-side-panel").boundingBox();
  expect(cockpitMapBox).not.toBeNull();
  expect(cockpitSideBox).not.toBeNull();
  expect(cockpitMapBox!.width).toBeGreaterThan(cockpitSideBox!.width);
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
  await expect(visibleByTestId(page, "trip-persistent-map-panel")).toBeVisible();
  await visibleByTestId(page, "trip-persistent-map-panel").getByRole("button", {
    name: /Open map/i,
  }).click();
  await expect(visibleByTestId(page, "planner-map-cockpit")).toBeVisible();

  await selectMapEntity(page, "planner-map-cockpit", {
    kind: "point_of_interest",
    stopId: "stop_poi_1",
  });
  await expect(visibleByTestId(page, "planner-map-cockpit-selection-summary")).toContainText(
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
