import { expect, test, type Page } from "@playwright/test";

import {
  createTestUser,
  getLegacySeedData,
  primeStaleRouteEstimateCache,
  primeSignedInSession,
  primeSignedOutState,
  seedCloudTrips,
  triggerSameUserSignedInAuthEvent,
} from "./helpers";

const mockHomeSearch = async (
  page: Page,
  options: {
    queryLabel: string;
    resultLabel: string;
    coordinates: { lat: number; lng: number };
    routingCoordinates: { lat: number; lng: number };
  },
) => {
  await page.route("**/api/geocode**", async (route) => {
    await route.fulfill({
      json: [
        {
          label: options.resultLabel,
          lat: options.coordinates.lat,
          lng: options.coordinates.lng,
          osmId: "999",
          osmType: "way",
        },
      ],
    });
  });

  await page.route("**/api/route-access", async (route) => {
    const payload = route.request().postDataJSON() as {
      place: {
        label: string;
        coordinates: { lat: number; lng: number };
      };
    };

    await route.fulfill({
      json: {
        place: {
          ...payload.place,
          routingCoordinates: options.routingCoordinates,
        },
      },
    });
  });
};

const openAccountDrawer = async (page: Page) => {
  await page.getByRole("button", { name: /Open account and sync/i }).click();
  await expect(page.getByText(/Account and sync/i).first()).toBeVisible();
};

const closeAccountDrawer = async (page: Page) => {
  await page.getByRole("button", { name: /^Close$/ }).click();
};

const expectAccountNotice = async (page: Page, pattern: RegExp) => {
  await openAccountDrawer(page);
  await expect(page.getByTestId("account-notice")).toContainText(pattern);
  await closeAccountDrawer(page);
};

const visibleByTestId = (page: Page, testId: string) =>
  page.locator(`[data-testid="${testId}"]:visible`).first();

const modeToggle = (page: Page) => visibleByTestId(page, "planner-mode-toggle");

const itineraryTab = (page: Page) => visibleByTestId(page, "desktop-panel-itinerary");

const overviewTab = (page: Page) => visibleByTestId(page, "desktop-panel-overview");

const dashboardTab = (page: Page) => visibleByTestId(page, "desktop-panel-dashboard");

const mapRouteStatusChip = (page: Page) => visibleByTestId(page, "map-route-status-chip");

const overviewRouteInsightsPanel = (page: Page) =>
  visibleByTestId(page, "overview-route-insights-panel");

const cancelEditButton = (page: Page) => visibleByTestId(page, "planner-mode-cancel");

const saveDraftButton = (page: Page) => visibleByTestId(page, "planner-mode-save");

const addStayButton = (page: Page) => visibleByTestId(page, "planner-add-stay");

const tripsScrollRegion = (page: Page) => visibleByTestId(page, "trips-scroll-region");

const overviewScrollRegion = (page: Page) => visibleByTestId(page, "overview-scroll-region");

const itineraryScrollRegion = (page: Page) =>
  visibleByTestId(page, "desktop-itinerary-scroll-region");

const refreshRoutes = async (page: Page) => {
  await page.getByRole("button", { name: /^Refresh$/ }).first().click();
};

const expandOverviewRouteDetails = async (page: Page) => {
  const button = overviewRouteInsightsPanel(page)
    .getByRole("button", { name: /Show route details/i })
    .first();

  if (await button.isVisible().catch(() => false)) {
    await button.click();
  }
};

const mockMagicLinkRequest = async (page: Page) => {
  await page.route("**/auth/v1/otp**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({}),
    });
  });
};

const waitForDashboardPreview = async (
  page: Page,
  tripId = "trip_outer_hebrides_2026",
) => {
  const tripCard = visibleByTestId(page, `trip-summary-${tripId}`);
  await expect(page.getByRole("heading", { name: /Manage your trips/i })).toBeVisible();
  await expect(tripCard).toBeVisible();
  await tripCard.click();
  await expect(visibleByTestId(page, "dashboard-open-trip-button")).toBeVisible();
};

const openPreviewedTrip = async (
  page: Page,
  tripId = "trip_outer_hebrides_2026",
) => {
  await waitForDashboardPreview(page, tripId);
  await visibleByTestId(page, "dashboard-open-trip-button").click();
  await expect(visibleByTestId(page, "trip-workspace-header")).toBeVisible();
};

const goToDashboard = async (page: Page) => {
  await dashboardTab(page).click();
  await expect(page.getByRole("heading", { name: /Manage your trips/i })).toBeVisible();
};

const previewTripByName = async (page: Page, tripName: string) => {
  const tripCard = page
    .locator("[data-testid^='trip-summary-']:visible")
    .filter({ hasText: tripName })
    .first();
  await expect(tripCard).toBeVisible();
  await tripCard.click();
  await expect(visibleByTestId(page, "dashboard-open-trip-button")).toBeVisible();
};

const expectViewMode = async (page: Page) => {
  await expect(modeToggle(page)).toBeVisible();
  await expect(modeToggle(page)).toContainText(/Edit itinerary/i);
};

const enterEditMode = async (page: Page) => {
  await expect(modeToggle(page)).toBeVisible();

  if ((await modeToggle(page).textContent())?.match(/Editing draft/i)) {
    await expect(cancelEditButton(page)).toBeVisible();
    return;
  }

  await modeToggle(page).click();
  await expect(modeToggle(page)).toContainText(/Editing draft/i);
  await expect(cancelEditButton(page)).toBeVisible();
};

test("shows magic-link request UI when auth envs are present and user is signed out", async ({
  page,
}) => {
  await primeSignedOutState(page);
  await mockMagicLinkRequest(page);
  await page.goto("/");

  await expect(page.getByRole("button", { name: /Send magic link/i })).toBeVisible();
  await expect(page.getByRole("button", { name: /Sign in as test user/i })).toBeVisible();
  await expect(page.getByRole("heading", { name: /Sign in first, then plan/i })).toBeVisible();
  await expect(page.getByRole("heading", { name: /Outer Hebrides Family Trip/i })).toHaveCount(0);
  await page.getByPlaceholder("you@example.com").fill("traveller@example.com");
  await page.getByRole("button", { name: /Send magic link/i }).click();

  await expect(
    page.getByText(/Magic link sent to traveller@example.com/i),
  ).toBeVisible();
});

test("local test-user helper signs in and lands on the cloud dashboard", async ({ page }) => {
  await page.request.post("/api/e2e/trips/seed", {
    data: {
      user: {
        id: "local-test-user",
        email: "local-dev@example.com",
      },
      data: null,
    },
  });
  await primeSignedOutState(page);

  await page.goto("/");
  await page.getByRole("button", { name: /Sign in as test user/i }).click();

  await expect(page.getByRole("heading", { name: /Manage your trips/i })).toBeVisible();
  await expect(tripsScrollRegion(page).getByText(/No cloud trips are available yet/i)).toBeVisible();
  await expect(page.getByRole("button", { name: /Send magic link/i })).toHaveCount(0);
  await openAccountDrawer(page);
  const accountPanel = page.getByTestId("account-status-panel").first();
  await expect(
    accountPanel.getByRole("heading", { name: /local-dev@example.com/i }),
  ).toBeVisible();
  await expect(accountPanel.getByText(/Cloud mode is active for this account/i)).toBeVisible();
});

test("creates a first example trip when a signed-in account has no cloud trip yet", async ({
  page,
}) => {
  const user = createTestUser("starter-trip");
  await primeSignedInSession(page, user);
  await seedCloudTrips(page, user, null);

  await page.goto("/");

  await expect(page.getByRole("heading", { name: /Manage your trips/i })).toBeVisible();
  await expect(tripsScrollRegion(page).getByText(/No cloud trips are available yet/i)).toBeVisible();
  await page.getByRole("button", { name: /^New trip$/ }).click();
  await page.getByTestId("trip-source-example").click();
  await page.getByLabel("Trip name").fill("Starter example");
  await page.getByRole("button", { name: /Create trip/i }).click();

  await expect(visibleByTestId(page, "trip-workspace-header")).toContainText(/Starter example/i);
  await expectAccountNotice(page, /Example trip created/i);
  await itineraryTab(page).click();
  await expectViewMode(page);
});

test("keeps overview trip-only and moves account controls into the account popup", async ({
  page,
}) => {
  const user = createTestUser("account-popup");
  await primeSignedInSession(page, user);
  await seedCloudTrips(page, user, getLegacySeedData());

  await page.goto("/");
  await openPreviewedTrip(page);

  const overviewRegion = overviewScrollRegion(page);
  await expect(overviewRegion.getByText(/Account and sync/i)).toHaveCount(0);
  await expect(overviewRegion.getByRole("button", { name: /Sign out/i })).toHaveCount(0);

  await expect(page.getByRole("button", { name: /Open account and sync/i })).toBeVisible();
  await openAccountDrawer(page);

  await expect(page.getByText(/Account and sync/i)).toBeVisible();
  await expect(page.getByRole("button", { name: /Sign out/i })).toBeVisible();
  await expect(page.getByText(/Sync details/i)).toBeVisible();
});

test("keeps the desktop account trigger inside the rail and opens the panel above it", async ({ page }) => {
  const user = createTestUser("account-trigger");
  await primeSignedInSession(page, user);
  await seedCloudTrips(page, user, getLegacySeedData());

  await page.setViewportSize({ width: 1366, height: 900 });
  await page.goto("/");

  const rail = page.getByTestId("planner-rail-column");
  const trigger = rail.getByTestId("account-status-trigger");

  await expect(trigger).toBeVisible();

  const railBox = await rail.boundingBox();
  const triggerBox = await trigger.boundingBox();

  expect(railBox).not.toBeNull();
  expect(triggerBox).not.toBeNull();

  if (!railBox || !triggerBox) {
    return;
  }

  expect(triggerBox.x).toBeGreaterThanOrEqual(railBox.x - 1);
  expect(triggerBox.x + triggerBox.width).toBeLessThanOrEqual(railBox.x + railBox.width + 1);

  await trigger.click();

  const panel = page.getByTestId("account-status-panel");
  await expect(panel).toBeVisible();

  const panelBox = await panel.boundingBox();
  expect(panelBox).not.toBeNull();

  if (!panelBox) {
    return;
  }

  expect(panelBox.y + panelBox.height).toBeLessThanOrEqual(triggerBox.y + 1);
});

test("manages trips from the dashboard trip library", async ({ page }) => {
  const user = createTestUser("trip-library");
  await primeSignedInSession(page, user);
  await seedCloudTrips(page, user, getLegacySeedData());
  await mockHomeSearch(page, {
    queryLabel: "Inverness",
    resultLabel: "Inverness, Scotland",
    coordinates: { lat: 57.4778, lng: -4.2247 },
    routingCoordinates: { lat: 57.479, lng: -4.221 },
  });

  await page.goto("/");
  await waitForDashboardPreview(page);

  await page.getByRole("button", { name: /^New trip$/ }).click();
  await page.getByLabel("Trip name").fill("North Coast run");
  await page.getByPlaceholder("Search home base").fill("Inverness");
  await page.getByRole("button", { name: /^Search$/ }).click();
  await page.getByRole("button", { name: /Inverness, Scotland/i }).click();
  await page.getByRole("button", { name: /Create trip/i }).click();

  await expect(modeToggle(page)).toContainText(/Editing draft/i);
  await expect(cancelEditButton(page)).toBeVisible();
  await expect(addStayButton(page)).toBeVisible();
  await expectAccountNotice(page, /Blank trip created/i);

  await goToDashboard(page);
  await page.getByRole("button", { name: /^New trip$/ }).click();
  await page.getByTestId("trip-source-example").click();
  await page.getByLabel("Trip name").fill("Example copy");
  await page.getByRole("button", { name: /Create trip/i }).click();

  await expect(visibleByTestId(page, "trip-workspace-header")).toContainText(/Example copy/i);
  await itineraryTab(page).click();
  await expectViewMode(page);

  await goToDashboard(page);
  await previewTripByName(page, "North Coast run");
  await page.getByRole("button", { name: /^Rename$/ }).click();
  await page.getByLabel("Trip name").fill("North Coast renamed");
  await page.getByRole("button", { name: /Rename trip/i }).click();

  const renamedTripCard = page
    .locator("[data-testid^='trip-summary-']:visible")
    .filter({ hasText: "North Coast renamed" })
    .first();
  await expect(renamedTripCard).toBeVisible();

  await previewTripByName(page, "North Coast renamed");
  await visibleByTestId(page, "dashboard-open-trip-button").click();
  await expect(visibleByTestId(page, "trip-workspace-header")).toContainText(/North Coast renamed/i);
  await itineraryTab(page).click();
  await expectViewMode(page);

  await goToDashboard(page);

  page.once("dialog", (dialog) => dialog.accept());
  await previewTripByName(page, "Example copy");
  await page.getByRole("button", { name: /^Delete$/ }).click();
  await expect(
    page
      .locator("[data-testid^='trip-summary-']")
      .filter({ has: page.getByText("Example copy", { exact: true }) }),
  ).toHaveCount(0);
  await expectAccountNotice(page, /Trip deleted successfully/i);

  page.once("dialog", (dialog) => dialog.accept());
  await previewTripByName(page, "North Coast renamed");
  await page.getByRole("button", { name: /^Delete$/ }).click();

  await expect(page.getByRole("heading", { name: /Manage your trips/i })).toBeVisible();
  await expectAccountNotice(page, /Trip deleted\. No trip is loaded now\./i);
});

test("loads a signed-in cloud trip and saves an edit", async ({ page }) => {
  const user = createTestUser("save-flow");
  await primeSignedInSession(page, user);
  await seedCloudTrips(page, user, getLegacySeedData());

  await page.goto("/");
  await openPreviewedTrip(page);
  await expectAccountNotice(page, /Cloud trip loaded successfully/i);
  await itineraryTab(page).click();
  await expectViewMode(page);

  await enterEditMode(page);
  await page.getByRole("button", { name: /^Edit$/ }).first().dispatchEvent("click");
  await expect(page.getByRole("heading", { name: /Edit stop/i })).toBeVisible();
  await page.getByPlaceholder("Stop title").fill("Barra Sands Campsite Updated");
  await page.getByRole("button", { name: /Update stop/i }).click();
  await saveDraftButton(page).click();

  await expect(itineraryScrollRegion(page).getByText(/Barra Sands Campsite Updated/i).first()).toBeVisible();
  await expectAccountNotice(page, /Cloud trip saved successfully/i);
});

test("keeps unsaved stop edits open during a passive same-user auth refresh", async ({
  page,
}) => {
  const user = createTestUser("passive-refresh");
  await primeSignedInSession(page, user);
  await seedCloudTrips(page, user, getLegacySeedData());

  await page.goto("/");
  await openPreviewedTrip(page);
  await itineraryTab(page).click();
  await enterEditMode(page);

  await page.getByRole("button", { name: /^Edit$/ }).first().dispatchEvent("click");
  await expect(page.getByRole("heading", { name: /Edit stop/i })).toBeVisible();

  const notesField = page.locator("textarea").first();

  await page.getByPlaceholder("Stop title").fill("Unsaved Barra Draft");
  await notesField.fill("Keep these unsaved notes around.");

  await triggerSameUserSignedInAuthEvent(page);

  await expect(modeToggle(page)).toContainText(/Editing draft/i);
  await expect(page.getByRole("heading", { name: /Edit stop/i })).toBeVisible();
  await expect(page.getByPlaceholder("Stop title")).toHaveValue("Unsaved Barra Draft");
  await expect(notesField).toHaveValue("Keep these unsaved notes around.");
});

test("switches between view mode and edit mode without changing trip data", async ({ page }) => {
  const user = createTestUser("mode-toggle");
  await primeSignedInSession(page, user);
  await seedCloudTrips(page, user, getLegacySeedData());

  await page.goto("/");
  await openPreviewedTrip(page);
  await itineraryTab(page).click();
  await expectViewMode(page);
  await expect(saveDraftButton(page)).toBeDisabled();

  await enterEditMode(page);
  await expect(page.getByRole("button", { name: /^Edit$/ }).first()).toBeVisible();

  await cancelEditButton(page).click();
  await expectViewMode(page);
  await expect(saveDraftButton(page)).toBeDisabled();
  await expect(itineraryScrollRegion(page).getByText(/Barra Sands Campsite/i).first()).toBeVisible();
});

test("shows live and fallback route confidence details in the overview panel", async ({
  page,
}) => {
  const user = createTestUser("route-confidence");
  await primeSignedInSession(page, user);
  await seedCloudTrips(page, user, getLegacySeedData());

  await page.route("**/api/route-estimates", async (route) => {
    const payload = route.request().postDataJSON() as {
      legs: Array<{
        id: string;
        fromId: string;
        fromLabel: string;
        toId: string;
        toLabel: string;
        date: string;
        relatedStopId?: string;
      }>;
    };

    await route.fulfill({
      json: {
        estimates: payload.legs.map((leg, index) => ({
          id: leg.id,
          fromId: leg.fromId,
          fromLabel: leg.fromLabel,
          toId: leg.toId,
          toLabel: leg.toLabel,
          kind: "road",
          distanceKm: 20 + index * 7,
          durationMinutes: 25 + index * 5,
          bufferedDurationMinutes: 35 + index * 6,
          provider:
            index % 2 === 0 ? "openrouteservice_driving_car" : "fallback_haversine",
          fetchedAt: "2026-04-02T09:00:00.000Z",
          confidence: index % 2 === 0 ? "live" : "fallback",
          date: leg.date,
          relatedStopId: leg.relatedStopId,
        })),
      },
    });
  });

  await page.goto("/");
  await openPreviewedTrip(page);

  await refreshRoutes(page);
  await expandOverviewRouteDetails(page);

  await expect(overviewRouteInsightsPanel(page).getByTestId("route-confidence-live").first()).toBeVisible();
  await expect(
    overviewRouteInsightsPanel(page).getByTestId("route-confidence-fallback").first(),
  ).toBeVisible();
  await expect(
    overviewRouteInsightsPanel(page).getByText(/Last fetched 02\/04\/2026 10:00/i).first(),
  ).toBeVisible();
});

test("shows a routing-in-progress chip before the first route response resolves", async ({
  page,
}) => {
  const user = createTestUser("route-pending");
  await primeSignedInSession(page, user);
  await seedCloudTrips(page, user, getLegacySeedData());

  let releaseRouteResponse: (() => void) | null = null;
  let markRouteSeen: (() => void) | null = null;
  const routeRequestSeen = new Promise<void>((resolve) => {
    markRouteSeen = resolve;
  });

  await page.route("**/api/route-estimates", async (route) => {
    const payload = route.request().postDataJSON() as {
      legs: Array<{
        id: string;
        fromId: string;
        fromLabel: string;
        toId: string;
        toLabel: string;
        date: string;
        relatedStopId?: string;
        from: { lat: number; lng: number };
        to: { lat: number; lng: number };
      }>;
    };

    markRouteSeen?.();
    await new Promise<void>((release) => {
      releaseRouteResponse = release;
    });

    await route.fulfill({
      json: {
        estimates: payload.legs.map((leg) => ({
          id: leg.id,
          fromId: leg.fromId,
          fromLabel: leg.fromLabel,
          toId: leg.toId,
          toLabel: leg.toLabel,
          kind: "road",
          distanceKm: 45,
          durationMinutes: 60,
          bufferedDurationMinutes: 79,
          provider: "openrouteservice_driving_car",
          fetchedAt: "2026-04-02T09:00:00.000Z",
          confidence: "live",
          date: leg.date,
          relatedStopId: leg.relatedStopId,
          geometry: {
            type: "LineString",
            coordinates: [
              { lat: leg.from.lat, lng: leg.from.lng },
              {
                lat: (leg.from.lat + leg.to.lat) / 2,
                lng: (leg.from.lng + leg.to.lng) / 2,
              },
              { lat: leg.to.lat, lng: leg.to.lng },
            ],
          },
        })),
      },
    });
  });

  await page.goto("/");
  await waitForDashboardPreview(page);
  await refreshRoutes(page);
  await routeRequestSeen;

  await expect(mapRouteStatusChip(page)).toContainText(/Routing in progress/i);

  releaseRouteResponse?.();

  await expect(page.locator('[data-testid="map-route-status-chip"]:visible')).toHaveCount(0);
});

test("shows fallback route status on the map when road legs use fallback estimates", async ({
  page,
}) => {
  const user = createTestUser("route-fallback-map");
  await primeSignedInSession(page, user);
  await seedCloudTrips(page, user, getLegacySeedData());

  await page.route("**/api/route-estimates", async (route) => {
    const payload = route.request().postDataJSON() as {
      legs: Array<{
        id: string;
        fromId: string;
        fromLabel: string;
        toId: string;
        toLabel: string;
        date: string;
        relatedStopId?: string;
      }>;
    };

    await route.fulfill({
      json: {
        estimates: payload.legs.map((leg, index) => ({
          id: leg.id,
          fromId: leg.fromId,
          fromLabel: leg.fromLabel,
          toId: leg.toId,
          toLabel: leg.toLabel,
          kind: "road",
          distanceKm: 30 + index * 5,
          durationMinutes: 40 + index * 5,
          bufferedDurationMinutes: 55 + index * 5,
          provider: "fallback_haversine",
          fetchedAt: "2026-04-02T09:00:00.000Z",
          confidence: "fallback",
          date: leg.date,
          relatedStopId: leg.relatedStopId,
        })),
      },
    });
  });

  await page.goto("/");
  await waitForDashboardPreview(page);
  await refreshRoutes(page);

  await expect(mapRouteStatusChip(page)).toContainText(/fallback road leg/i);
  await openPreviewedTrip(page);
  await expandOverviewRouteDetails(page);
  await expect(
    overviewRouteInsightsPanel(page).getByTestId("route-confidence-fallback").first(),
  ).toBeVisible();
});

test("keeps dashboard preview map synced after refreshing an opened trip route", async ({
  page,
}) => {
  const user = createTestUser("dashboard-route-sync");
  await primeSignedInSession(page, user);
  await primeStaleRouteEstimateCache(page);
  await seedCloudTrips(page, user, getLegacySeedData());

  await page.route("**/api/route-estimates", async (route) => {
    const payload = route.request().postDataJSON() as {
      legs: Array<{
        id: string;
        fromId: string;
        fromLabel: string;
        toId: string;
        toLabel: string;
        date: string;
        relatedStopId?: string;
        from: { lat: number; lng: number };
        to: { lat: number; lng: number };
      }>;
    };

    await route.fulfill({
      json: {
        estimates: payload.legs.map((leg, index) => ({
          id: leg.id,
          fromId: leg.fromId,
          fromLabel: leg.fromLabel,
          toId: leg.toId,
          toLabel: leg.toLabel,
          kind: "road",
          distanceKm: 40 + index * 5,
          durationMinutes: 45 + index * 4,
          bufferedDurationMinutes: 60 + index * 5,
          provider: "openrouteservice_driving_car",
          fetchedAt: "2026-04-02T09:00:00.000Z",
          confidence: "live",
          date: leg.date,
          relatedStopId: leg.relatedStopId,
          geometry: {
            type: "LineString",
            coordinates: [
              { lat: leg.from.lat, lng: leg.from.lng },
              {
                lat: (leg.from.lat + leg.to.lat) / 2,
                lng: (leg.from.lng + leg.to.lng) / 2,
              },
              { lat: leg.to.lat, lng: leg.to.lng },
            ],
          },
        })),
      },
    });
  });

  await page.goto("/");
  await waitForDashboardPreview(page);

  const dashboardMapPanel = visibleByTestId(page, "dashboard-trip-map-panel");
  await expect(dashboardMapPanel.getByTestId("map-route-status-chip")).toContainText(
    /fallback road leg/i,
  );

  await visibleByTestId(page, "dashboard-open-trip-button").click();
  await expect(visibleByTestId(page, "trip-workspace-header")).toBeVisible();
  await refreshRoutes(page);
  await expect(page.locator('[data-testid="map-route-status-chip"]:visible')).toHaveCount(0);

  await goToDashboard(page);
  await expect(dashboardMapPanel).toBeVisible();
  await expect(dashboardMapPanel.getByTestId("map-route-status-chip")).toHaveCount(0);
});

test("stores separate routing coordinates for edited places and uses them for route estimates", async ({
  page,
}) => {
  const user = createTestUser("routing-coordinates");
  await primeSignedInSession(page, user);
  await seedCloudTrips(page, user, getLegacySeedData());

  let savedPlace:
    | {
        coordinates: { lat: number; lng: number };
        routingCoordinates?: { lat: number; lng: number };
      }
    | undefined;
  const routeEstimatePayloads: Array<{
    legs: Array<{
      id: string;
      toId: string;
      from: { lat: number; lng: number };
      to: { lat: number; lng: number };
    }>;
  }> = [];

  await page.route("**/api/geocode**", async (route) => {
    await route.fulfill({
      json: [
        {
          label: "Lochside Camp, Harris",
          lat: 57.8725,
          lng: -6.9346,
          osmId: "123",
          osmType: "way",
        },
      ],
    });
  });

  await page.route("**/api/route-access", async (route) => {
    const payload = route.request().postDataJSON() as {
      place: {
        label: string;
        coordinates: { lat: number; lng: number };
      };
    };

    await route.fulfill({
      json: {
        place: {
          ...payload.place,
          routingCoordinates: { lat: 57.8751, lng: -6.9261 },
        },
      },
    });
  });

  await page.route("**/api/route-estimates", async (route) => {
    const payload = route.request().postDataJSON() as {
      legs: Array<{
        id: string;
        fromId: string;
        fromLabel: string;
        toId: string;
        toLabel: string;
        date: string;
        relatedStopId?: string;
        from: { lat: number; lng: number };
        to: { lat: number; lng: number };
      }>;
    };

    routeEstimatePayloads.push(payload);

    await route.fulfill({
      json: {
        estimates: payload.legs.map((leg) => ({
          id: leg.id,
          fromId: leg.fromId,
          fromLabel: leg.fromLabel,
          toId: leg.toId,
          toLabel: leg.toLabel,
          kind: "road",
          distanceKm: 20,
          durationMinutes: 25,
          bufferedDurationMinutes: 35,
          provider: "openrouteservice_driving_car",
          fetchedAt: "2026-04-02T09:00:00.000Z",
          confidence: "live",
          date: leg.date,
          relatedStopId: leg.relatedStopId,
        })),
      },
    });
  });

  await page.route("**/api/trips/**", async (route) => {
    if (route.request().method() !== "PUT") {
      await route.continue();
      return;
    }

    const payload = route.request().postDataJSON() as {
      trip: {
        stops: Array<{
          id: string;
          type: string;
          place?: {
            coordinates: { lat: number; lng: number };
            routingCoordinates?: { lat: number; lng: number };
          };
        }>;
      };
    };

    savedPlace = payload.trip.stops.find((stop) => stop.id === "stop_stay_1")?.place;
    await route.continue();
  });

  await page.goto("/");
  await openPreviewedTrip(page);
  await itineraryTab(page).click();
  await expectViewMode(page);

  await enterEditMode(page);
  await page.getByRole("button", { name: /^Edit$/ }).nth(1).click();
  await expect(page.getByRole("heading", { name: /Edit stop/i })).toBeVisible();

  const locationInput = page.getByPlaceholder("Search campsite");
  await locationInput.fill("Lochside");
  await expect(page.getByText(/Press Search to look up this place\./i)).toBeVisible();
  await page.getByRole("button", { name: /^Search$/ }).click();
  await page.getByRole("button", { name: /Lochside Camp, Harris/i }).click();
  await page.getByRole("button", { name: /Update stop/i }).click();
  await saveDraftButton(page).click();
  await overviewTab(page).click();
  await refreshRoutes(page);

  await expect.poll(() => savedPlace).toMatchObject({
    coordinates: { lat: 57.8725, lng: -6.9346 },
    routingCoordinates: { lat: 57.8751, lng: -6.9261 },
  });

  await expect
    .poll(() =>
      routeEstimatePayloads.some((payload) =>
        payload.legs.some(
          (leg) =>
            leg.toId === "stop_stay_1" &&
            leg.to.lat === 57.8751 &&
            leg.to.lng === -6.9261 &&
            !(leg.to.lat === 57.8725 && leg.to.lng === -6.9346),
        ),
      ),
    )
    .toBe(true);
});

test("desktop overview panel stays scrollable when route realism grows tall", async ({
  page,
}) => {
  const user = createTestUser("overview-scroll");
  await primeSignedInSession(page, user);
  await seedCloudTrips(page, user, getLegacySeedData());

  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto("/");
  await openPreviewedTrip(page);
  await refreshRoutes(page);
  await expandOverviewRouteDetails(page);

  const scrollRegion = overviewScrollRegion(page);
  await expect(scrollRegion).toBeVisible();

  const scrollMetrics = await scrollRegion.evaluate((element) => ({
    clientHeight: element.clientHeight,
    scrollHeight: element.scrollHeight,
  }));

  expect(scrollMetrics.scrollHeight).toBeGreaterThan(scrollMetrics.clientHeight);

  const scrollTop = await scrollRegion.evaluate((element) => {
    element.scrollTop = element.scrollHeight;
    return element.scrollTop;
  });

  expect(scrollTop).toBeGreaterThan(0);
});

test("desktop itinerary remains scrollable and lower trip items stay interactive", async ({
  page,
}) => {
  const user = createTestUser("desktop-scroll");
  await primeSignedInSession(page, user);
  await seedCloudTrips(page, user, getLegacySeedData());

  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto("/");
  await openPreviewedTrip(page);
  await itineraryTab(page).click();
  await expectViewMode(page);
  await enterEditMode(page);

  const scrollRegion = itineraryScrollRegion(page);
  await expect(scrollRegion).toBeVisible();

  const scrollMetrics = await scrollRegion.evaluate((element) => ({
    clientHeight: element.clientHeight,
    scrollHeight: element.scrollHeight,
  }));

  expect(scrollMetrics.scrollHeight).toBeGreaterThan(scrollMetrics.clientHeight);

  await scrollRegion.evaluate((element) => {
    element.scrollTop = element.scrollHeight;
  });

  const lowerStaySection = itineraryScrollRegion(page)
    .locator("section")
    .filter({ has: page.getByText("Kinloch Campsite", { exact: true }) })
    .first();

  await expect(lowerStaySection).toBeVisible();
  await lowerStaySection.getByRole("button", { name: /^Edit$/ }).first().click();
  await expect(page.getByRole("heading", { name: /Edit stop/i })).toBeVisible();
});

test("desktop itinerary panel aligns with the map frame", async ({ page }) => {
  const user = createTestUser("desktop-layout");
  await primeSignedInSession(page, user);
  await seedCloudTrips(page, user, getLegacySeedData());

  await page.setViewportSize({ width: 1366, height: 900 });
  await page.goto("/");
  await openPreviewedTrip(page);
  await itineraryTab(page).click();
  await expectViewMode(page);

  const desktopRegionBox = await visibleByTestId(page, "desktop-panel-region").boundingBox();
  const mapBox = await visibleByTestId(page, "itinerary-desktop-map-panel").boundingBox();

  expect(desktopRegionBox).not.toBeNull();
  expect(mapBox).not.toBeNull();

  if (!desktopRegionBox || !mapBox) {
    return;
  }

  expect(mapBox.x).toBeGreaterThan(desktopRegionBox.x);
  expect(mapBox.y).toBeGreaterThan(desktopRegionBox.y);
  expect(mapBox.x + mapBox.width).toBeLessThanOrEqual(desktopRegionBox.x + desktopRegionBox.width);
  expect(mapBox.height).toBeGreaterThanOrEqual(320);
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

  await expect(page.getByRole("heading", { name: /Manage your trips/i })).toBeVisible();
  await expect(visibleByTestId(page, "dashboard-open-trip-button")).toBeVisible();
  await expectAccountNotice(page, /Imported 1 local trip into cloud sync/i);
  await visibleByTestId(page, "dashboard-open-trip-button").click();
  await expect(visibleByTestId(page, "trip-workspace-header")).toBeVisible();
});

test("reopens the last synced trip offline in read-only mode", async ({ browser }) => {
  const user = createTestUser("offline-flow");
  const context = await browser.newContext();
  const page = await context.newPage();

  await primeSignedInSession(page, user);
  await seedCloudTrips(page, user, getLegacySeedData());
  await page.goto("/");
  await openPreviewedTrip(page);

  await context.route(/\/api\/trips(\/.*)?$/, (route) => route.abort());

  const offlinePage = await context.newPage();
  await offlinePage.goto("/");

  await expect(
    offlinePage
      .locator("h2:visible, h3:visible")
      .filter({ hasText: /Outer Hebrides Family Trip/i })
      .first(),
  ).toBeVisible();
  await expect(
    offlinePage
      .getByText(/No saved route timings yet\. Refresh to calculate and save them with this trip\./i)
      .last(),
  ).toBeVisible();

  await context.close();
});

test("keeps stale route data visible when a background refresh fails", async ({ page }) => {
  const user = createTestUser("stale-routes");
  await primeSignedInSession(page, user);
  await seedCloudTrips(page, user, getLegacySeedData());
  await primeStaleRouteEstimateCache(page);

  await page.route("**/api/route-estimates", async (route) => {
    await route.fulfill({
      status: 503,
      json: {
        error: "Route service unavailable.",
      },
    });
  });

  await page.goto("/");
  await openPreviewedTrip(page);
  await refreshRoutes(page);
  await expandOverviewRouteDetails(page);

  await expect(
    overviewRouteInsightsPanel(page).getByText(
      /Route service unavailable\. Showing the last saved route timings instead\./i,
    ),
  ).toBeVisible();
  await expect(
    overviewRouteInsightsPanel(page)
      .getByText(/Home: Killearn, Scotland to Oban to Castlebay departure/i)
      .first(),
  ).toBeVisible();
});

test("desktop rail switches between itinerary, overview, and today without hiding the map", async ({
  page,
}) => {
  const user = createTestUser("desktop-rail");
  await primeSignedInSession(page, user);
  await seedCloudTrips(page, user, getLegacySeedData());

  await page.setViewportSize({ width: 1366, height: 768 });
  await page.goto("/");
  await waitForDashboardPreview(page);

  await expect(visibleByTestId(page, "dashboard-trip-map-panel").getByLabel(/Trip map/i)).toBeVisible();
  await visibleByTestId(page, "dashboard-open-trip-button").click();
  await expect(visibleByTestId(page, "overview-trip-map-panel")).toBeVisible();
  await expect(visibleByTestId(page, "overview-trip-map-panel").getByLabel(/Trip map/i)).toBeVisible();
  await itineraryTab(page).click();
  await expect(visibleByTestId(page, "desktop-panel-itinerary-region")).toBeVisible();
  await expect(visibleByTestId(page, "planner-map-panel").getByLabel(/Trip map/i)).toBeVisible();
  await page.getByRole("button", { name: /Open Today actions/i }).click();
  await expect(page.getByText(/Today's actions/i)).toBeVisible();
  await expect(visibleByTestId(page, "planner-map-panel").getByLabel(/Trip map/i)).toBeVisible();
  await goToDashboard(page);
  await expect(visibleByTestId(page, "dashboard-trip-map-panel")).toBeVisible();
  await expect(visibleByTestId(page, "dashboard-trip-map-panel").getByLabel(/Trip map/i)).toBeVisible();
});

test("prevents deleting the last remaining cloud trip", async ({ page }) => {
  const user = createTestUser("last-trip");
  await primeSignedInSession(page, user);
  await seedCloudTrips(page, user, getLegacySeedData());

  await page.goto("/");
  await waitForDashboardPreview(page);

  await expect(page.getByRole("button", { name: /^Delete$/ })).toBeDisabled();
});

test("recovers cleanly from a stale write conflict", async ({ browser }) => {
  const user = createTestUser("conflict-flow");

  const contextA = await browser.newContext();
  const pageA = await contextA.newPage();
  await primeSignedInSession(pageA, user);
  await seedCloudTrips(pageA, user, getLegacySeedData());
  await pageA.goto("/");
  await openPreviewedTrip(pageA);
  await itineraryTab(pageA).click();
  await expectViewMode(pageA);

  const contextB = await browser.newContext();
  const pageB = await contextB.newPage();
  await primeSignedInSession(pageB, user);
  await pageB.goto("/");
  await openPreviewedTrip(pageB);
  await itineraryTab(pageB).click();
  await expectViewMode(pageB);

  await enterEditMode(pageA);
  await pageA.getByRole("button", { name: /^Edit$/ }).first().dispatchEvent("click");
  await expect(pageA.getByRole("heading", { name: /Edit stop/i })).toBeVisible();
  await pageA.getByPlaceholder("Stop title").fill("Conflict Winner Campsite");
  await pageA.getByRole("button", { name: /Update stop/i }).click();
  await saveDraftButton(pageA).click();
  await expect(itineraryScrollRegion(pageA).getByText(/Conflict Winner Campsite/i).first()).toBeVisible();

  await enterEditMode(pageB);
  await pageB.getByRole("button", { name: /^Edit$/ }).first().dispatchEvent("click");
  await expect(pageB.getByRole("heading", { name: /Edit stop/i })).toBeVisible();
  await pageB.getByPlaceholder("Stop title").fill("Conflict Loser Campsite");
  await pageB.getByRole("button", { name: /Update stop/i }).click();
  await saveDraftButton(pageB).click();

  await expect(
    pageB
      .getByText(/Trip changed on another device\. The latest version has been loaded/i)
      .last(),
  ).toBeVisible();
  await expect(
    pageB.getByText(/Review the refreshed version before making more edits/i).last(),
  ).toBeVisible();
  await expect(pageB.locator("body")).toContainText("Conflict Loser Campsite");
  await expect(saveDraftButton(pageB)).toBeEnabled();

  await contextA.close();
  await contextB.close();
});

test("does not refetch route estimates after a non-routing stop edit", async ({ page }) => {
  const user = createTestUser("route-refetch");
  await primeSignedInSession(page, user);
  await seedCloudTrips(page, user, getLegacySeedData());

  let routeRequestCount = 0;
  await page.route("**/api/route-estimates", async (route) => {
    routeRequestCount += 1;

    const payload = route.request().postDataJSON() as {
      legs: Array<{
        id: string;
        fromId: string;
        fromLabel: string;
        toId: string;
        toLabel: string;
        date: string;
        relatedStopId?: string;
      }>;
    };

    await route.fulfill({
      json: {
        estimates: payload.legs.map((leg, index) => ({
          id: leg.id,
          fromId: leg.fromId,
          fromLabel: leg.fromLabel,
          toId: leg.toId,
          toLabel: leg.toLabel,
          kind: "road",
          distanceKm: 30 + index * 6,
          durationMinutes: 28 + index * 4,
          bufferedDurationMinutes: 38 + index * 5,
          provider: "fallback_haversine",
          fetchedAt: "2026-04-02T09:00:00.000Z",
          confidence: "fallback",
          date: leg.date,
          relatedStopId: leg.relatedStopId,
        })),
      },
    });
  });

  await page.goto("/");
  await openPreviewedTrip(page);
  await refreshRoutes(page);
  await expandOverviewRouteDetails(page);
  await expect(
    overviewRouteInsightsPanel(page).getByText(/Last fetched 02\/04\/2026 10:00/i).first(),
  ).toBeVisible();

  const initialRouteRequestCount = routeRequestCount;

  await itineraryTab(page).click();
  await enterEditMode(page);
  await page.getByRole("button", { name: /^Edit$/ }).first().dispatchEvent("click");
  await expect(page.getByRole("heading", { name: /Edit stop/i })).toBeVisible();
  await page.getByPlaceholder("Stop title").fill("Barra Sands Campsite Renamed");
  await page.getByRole("button", { name: /Update stop/i }).click();
  await saveDraftButton(page).click();

  await expect(
    itineraryScrollRegion(page).getByText(/Barra Sands Campsite Renamed/i).first(),
  ).toBeVisible();
  await expectAccountNotice(page, /Cloud trip saved successfully/i);
  await expect.poll(() => routeRequestCount, { timeout: 1000 }).toBe(initialRouteRequestCount);
});
