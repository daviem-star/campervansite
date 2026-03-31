import { expect, test } from "@playwright/test";

import {
  createTestUser,
  getLegacySeedData,
  primeStaleRouteEstimateCache,
  primeSignedInSession,
  primeSignedOutState,
  seedCloudTrips,
} from "./helpers";

const mockHomeSearch = async (
  page: import("@playwright/test").Page,
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

test("shows magic-link request UI when auth envs are present and user is signed out", async ({
  page,
}) => {
  await primeSignedOutState(page);
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

test("local test-user helper signs in and creates a starter trip", async ({ page }) => {
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

  await expect(page.getByText(/Example trip ready|Cloud trip loaded/i).last()).toBeVisible();
  await expect(page.getByRole("button", { name: /Send magic link/i })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /Edit trip/i })).toBeVisible();
});

test("creates a starter example trip when a signed-in account has no cloud trip yet", async ({
  page,
}) => {
  const user = createTestUser("starter-trip");
  await primeSignedInSession(page, user);
  await seedCloudTrips(page, user, null);

  await page.goto("/");

  await expect(page.getByText(/Example trip ready/i).last()).toBeVisible();
  await expect(page.getByRole("button", { name: /Edit trip/i })).toBeVisible();
});

test("keeps overview trip-only and moves account controls into the account popup", async ({
  page,
}) => {
  const user = createTestUser("account-popup");
  await primeSignedInSession(page, user);

  await page.goto("/");
  await page.getByTestId("desktop-panel-overview").click();

  const overviewRegion = page.getByTestId("overview-scroll-region");
  await expect(overviewRegion.getByText(/Account and sync/i)).toHaveCount(0);
  await expect(overviewRegion.getByRole("button", { name: /Sign out/i })).toHaveCount(0);

  await expect(page.getByRole("button", { name: /Open account and sync/i })).toBeVisible();
  await page.getByRole("button", { name: /Open account and sync/i }).click();

  await expect(page.getByText(/Account and sync/i)).toBeVisible();
  await expect(page.getByRole("button", { name: /Sign out/i })).toBeVisible();
});

test("manages trips from the dedicated trips panel", async ({ page }) => {
  const user = createTestUser("trip-library");
  await primeSignedInSession(page, user);
  await mockHomeSearch(page, {
    queryLabel: "Inverness",
    resultLabel: "Inverness, Scotland",
    coordinates: { lat: 57.4778, lng: -4.2247 },
    routingCoordinates: { lat: 57.479, lng: -4.221 },
  });

  await page.goto("/");
  await page.getByTestId("desktop-panel-trips").click();
  await expect(page.getByRole("heading", { name: /Manage your trip library/i })).toBeVisible();

  await page.getByRole("button", { name: /^New trip$/ }).click();
  await page.getByLabel("Trip name").fill("North Coast run");
  await page.getByPlaceholder("Search home base").fill("Inverness");
  await page.getByRole("button", { name: /^Search$/ }).click();
  await page.getByRole("button", { name: /Inverness, Scotland/i }).click();
  await page.getByRole("button", { name: /Create trip/i }).click();

  await expect(page.getByRole("heading", { name: /North Coast run/i })).toBeVisible();
  await expect(page.getByText(/Blank trip created/i).last()).toBeVisible();

  await page.getByTestId("desktop-panel-trips").click();
  await page.getByRole("button", { name: /^New trip$/ }).click();
  await page.getByTestId("trip-source-example").click();
  await page.getByLabel("Trip name").fill("Example copy");
  await page.getByRole("button", { name: /Create trip/i }).click();

  await expect(page.getByRole("heading", { name: /Example copy/i })).toBeVisible();

  await page.getByTestId("desktop-panel-trips").click();

  const blankTripCard = page
    .locator("[data-testid^='trip-summary-']")
    .filter({ has: page.getByText("North Coast run", { exact: true }) })
    .first();
  await blankTripCard.getByRole("button", { name: /^Rename$/ }).click();
  await page.getByLabel("Trip name").fill("North Coast renamed");
  await page.getByRole("button", { name: /Rename trip/i }).click();

  const renamedTripCard = page
    .locator("[data-testid^='trip-summary-']")
    .filter({ has: page.getByText("North Coast renamed", { exact: true }) })
    .first();
  await expect(renamedTripCard.getByText("North Coast renamed", { exact: true })).toBeVisible();

  await renamedTripCard.getByRole("button", { name: /^Open$/ }).click();
  await expect(page.getByRole("heading", { name: /North Coast renamed/i })).toBeVisible();

  await page.getByTestId("desktop-panel-trips").click();
  await expect(page.getByRole("heading", { name: /Manage your trip library/i })).toBeVisible();

  page.once("dialog", (dialog) => dialog.accept());
  const exampleTripCard = page
    .locator("[data-testid^='trip-summary-']")
    .filter({ has: page.getByText("Example copy", { exact: true }) })
    .first();
  await exampleTripCard.getByRole("button", { name: /^Delete$/ }).click();
  await expect(exampleTripCard).toHaveCount(0);

  page.once("dialog", (dialog) => dialog.accept());
  const renamedTripCardForDelete = page
    .locator("[data-testid^='trip-summary-']")
    .filter({ has: page.getByText("North Coast renamed", { exact: true }) })
    .first();
  await renamedTripCardForDelete.getByRole("button", { name: /^Delete$/ }).click();

  await expect(page.getByText(/Trip deleted\. Loaded Outer Hebrides Family Trip/i).last()).toBeVisible();
  await expect(page.getByRole("heading", { name: /Outer Hebrides Family Trip/i })).toBeVisible();
});

test("loads a signed-in cloud trip and saves an edit", async ({ page }) => {
  const user = createTestUser("save-flow");
  await primeSignedInSession(page, user);

  await page.goto("/");

  await expect(page.getByText(/Cloud trip loaded/i).last()).toBeVisible();

  await page.getByRole("button", { name: /Edit trip/i }).click();
  await expect(page.getByText(/Edit mode is unlocked/i)).toBeVisible();
  await page.getByRole("button", { name: /^Edit$/ }).first().dispatchEvent("click");
  await expect(page.getByRole("heading", { name: /Edit stop/i })).toBeVisible();
  await page.getByPlaceholder("Stop title").fill("Barra Sands Campsite Updated");
  await page.getByRole("button", { name: /Update stop/i }).click();

  await expect(page.getByText(/Barra Sands Campsite Updated/i)).toBeVisible();
  await expect(page.getByText(/Cloud trip saved successfully/i).last()).toBeVisible();
});

test("shows live and fallback route confidence details in the overview panel", async ({
  page,
}) => {
  const user = createTestUser("route-confidence");
  await primeSignedInSession(page, user);

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
  await page.getByTestId("desktop-panel-overview").click();

  await expect(page.getByTestId("route-confidence-live").first()).toBeVisible();
  await expect(page.getByTestId("route-confidence-fallback").first()).toBeVisible();
  await expect(page.getByText(/Last fetched 02\/04\/2026 10:00/i).last()).toBeVisible();
});

test("stores separate routing coordinates for edited places and uses them for route estimates", async ({
  page,
}) => {
  const user = createTestUser("routing-coordinates");
  await primeSignedInSession(page, user);

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
  await expect(page.getByText(/Cloud trip loaded/i).last()).toBeVisible();

  await page.getByRole("button", { name: /Edit trip/i }).click();
  await page.getByRole("button", { name: /^Edit$/ }).nth(1).click();
  await expect(page.getByRole("heading", { name: /Edit stop/i })).toBeVisible();

  const locationInput = page.getByPlaceholder("Search campsite");
  await locationInput.fill("Lochside");
  await expect(page.getByText(/Press Search to look up this place\./i)).toBeVisible();
  await page.getByRole("button", { name: /^Search$/ }).click();
  await page.getByRole("button", { name: /Lochside Camp, Harris/i }).click();
  await page.getByRole("button", { name: /Update stop/i }).click();

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

  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto("/");
  await page.getByTestId("desktop-panel-overview").click();

  const scrollRegion = page.getByTestId("overview-scroll-region");
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

  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto("/");

  await expect(page.getByText(/Cloud trip loaded/i).last()).toBeVisible();
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

  await expect(page.getByText(/Imported 1 local trip into cloud sync/i).last()).toBeVisible();
  await expect(page.getByRole("button", { name: /Edit trip/i })).toBeVisible();
});

test("reopens the last synced trip offline in read-only mode", async ({ browser }) => {
  const user = createTestUser("offline-flow");
  const context = await browser.newContext();
  const page = await context.newPage();

  await primeSignedInSession(page, user);
  await page.goto("/");
  await expect(page.getByText(/Cloud trip loaded/i).last()).toBeVisible();

  await context.route(/\/api\/trips(\/.*)?$/, (route) => route.abort());

  const offlinePage = await context.newPage();
  await offlinePage.goto("/");

  await expect(
    offlinePage
      .getByText(/Unable to reach cloud sync\. Showing the last synced trip instead/i)
      .last(),
  ).toBeVisible();
  await expect(
    offlinePage.getByText(/This trip is read-only until the connection returns/i).last(),
  ).toBeVisible();
  await expect(offlinePage.getByRole("button", { name: /Edit trip/i })).toBeDisabled();
  await expect(offlinePage.getByRole("button", { name: /^Edit$/ })).toHaveCount(0);

  await context.close();
});

test("keeps stale route data visible when a background refresh fails", async ({ page }) => {
  const user = createTestUser("stale-routes");
  await primeSignedInSession(page, user);
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
  await page.getByTestId("desktop-panel-overview").click();

  await expect(
    page.getByText(/Route service unavailable\. Showing the last successful route timings instead\./i),
  ).toBeVisible();
  await expect(
    page.getByText(/Home: Killearn, Scotland to Oban to Castlebay departure/i).last(),
  ).toBeVisible();
});

test("desktop rail switches between itinerary, overview, and today without hiding the map", async ({
  page,
}) => {
  const user = createTestUser("desktop-rail");
  await primeSignedInSession(page, user);

  await page.setViewportSize({ width: 1366, height: 768 });
  await page.goto("/");

  await expect(page.getByLabel(/Trip map/i)).toBeVisible();

  await page.getByTestId("desktop-panel-trips").click();
  await expect(page.getByRole("heading", { name: /Manage your trip library/i })).toBeVisible();

  await page.getByTestId("desktop-panel-overview").click();
  await expect(page.locator("h1").filter({ hasText: /Outer Hebrides Family Trip/i })).toBeVisible();

  await page.getByTestId("desktop-panel-today").click();
  await expect(page.getByRole("heading", { name: /Today's actions/i })).toBeVisible();

  await page.getByTestId("desktop-panel-itinerary").click();
  await expect(page.getByRole("heading", { name: /Itinerary/i })).toBeVisible();
  await expect(page.getByLabel(/Trip map/i)).toBeVisible();
});

test("prevents deleting the last remaining cloud trip", async ({ page }) => {
  const user = createTestUser("last-trip");
  await primeSignedInSession(page, user);

  await page.goto("/");
  await page.getByTestId("desktop-panel-trips").click();

  const onlyTripCard = page.locator("[data-testid^='trip-summary-']").first();
  await expect(onlyTripCard.getByRole("button", { name: /^Delete$/ })).toBeDisabled();
  await expect(onlyTripCard.getByText(/Create another trip before deleting this one/i)).toBeVisible();
});

test("recovers cleanly from a stale write conflict", async ({ browser }) => {
  const user = createTestUser("conflict-flow");

  const contextA = await browser.newContext();
  const pageA = await contextA.newPage();
  await primeSignedInSession(pageA, user);
  await pageA.goto("/");
  await expect(pageA.getByText(/Cloud trip loaded/i).last()).toBeVisible();

  const contextB = await browser.newContext();
  const pageB = await contextB.newPage();
  await primeSignedInSession(pageB, user);
  await pageB.goto("/");
  await expect(pageB.getByText(/Cloud trip loaded/i).last()).toBeVisible();

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
      .last(),
  ).toBeVisible();
  await expect(pageB.getByText(/Conflict Winner Campsite/i)).toBeVisible();

  await contextA.close();
  await contextB.close();
});

test("does not refetch route estimates after a non-routing stop edit", async ({ page }) => {
  const user = createTestUser("route-refetch");
  await primeSignedInSession(page, user);

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
  await expect(page.getByText(/Cloud trip loaded/i).last()).toBeVisible();
  await page.getByTestId("desktop-panel-overview").click();
  await expect(page.getByText(/Last fetched 02\/04\/2026 10:00/i).last()).toBeVisible();

  const initialRouteRequestCount = routeRequestCount;

  await page.getByTestId("desktop-panel-itinerary").click();
  await page.getByRole("button", { name: /Edit trip/i }).click();
  await page.getByRole("button", { name: /^Edit$/ }).first().dispatchEvent("click");
  await expect(page.getByRole("heading", { name: /Edit stop/i })).toBeVisible();
  await page.getByPlaceholder("Stop title").fill("Barra Sands Campsite Renamed");
  await page.getByRole("button", { name: /Update stop/i }).click();

  await expect(page.getByText(/Barra Sands Campsite Renamed/i)).toBeVisible();
  await expect(page.getByText(/Cloud trip saved successfully/i).last()).toBeVisible();
  await expect.poll(() => routeRequestCount, { timeout: 1000 }).toBe(initialRouteRequestCount);
});
