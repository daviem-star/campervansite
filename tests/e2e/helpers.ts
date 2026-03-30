import { randomUUID } from "node:crypto";

import { Page } from "@playwright/test";

import { createE2EBypassSession, getE2EAuthStorageKey } from "../../lib/e2eAuth";
import { ROUTE_ESTIMATE_CACHE_FALLBACK_STORAGE_KEY } from "../../lib/routeEstimateCache";
import { buildTripTravelLegPayload } from "../../lib/routeEstimates";
import { FORCE_DEMO_MODE_STORAGE_KEY } from "../../lib/runtimeFlags";
import { getSeedData } from "../../lib/seedData";
import { AppData, SessionUser, TravelLegEstimate } from "../../types/trip";

const LEGACY_STORAGE_KEY = "campervan_trip_planner_v1";

export const createTestUser = (prefix: string): SessionUser => {
  const id = randomUUID();
  return {
    id: `e2e-${prefix}-${id}`,
    email: `${prefix}-${id}@example.com`,
  };
};

export const getLegacySeedData = (): AppData => getSeedData();

export const primeSignedInSession = async (
  page: Page,
  user: SessionUser,
  options?: {
    legacyData?: AppData | null;
  },
) => {
  const session = createE2EBypassSession(user);

  await page.addInitScript(
    ({ authStorageKey, sessionValue, legacyStorageKey, legacyValue, forceDemoStorageKey }) => {
      window.localStorage.removeItem(forceDemoStorageKey);
      window.localStorage.setItem(authStorageKey, JSON.stringify(sessionValue));

      if (legacyValue) {
        window.localStorage.setItem(legacyStorageKey, JSON.stringify(legacyValue));
      } else {
        window.localStorage.removeItem(legacyStorageKey);
      }
    },
    {
      authStorageKey: getE2EAuthStorageKey(),
      sessionValue: session,
      legacyStorageKey: LEGACY_STORAGE_KEY,
      legacyValue: options?.legacyData ?? null,
      forceDemoStorageKey: FORCE_DEMO_MODE_STORAGE_KEY,
    },
  );
};

export const primeSignedOutState = async (
  page: Page,
  options?: {
    legacyData?: AppData | null;
  },
) => {
  await page.addInitScript(
    ({ authStorageKey, legacyStorageKey, legacyValue, forceDemoStorageKey }) => {
      window.localStorage.removeItem(forceDemoStorageKey);
      window.localStorage.removeItem(authStorageKey);

      if (legacyValue) {
        window.localStorage.setItem(legacyStorageKey, JSON.stringify(legacyValue));
      } else {
        window.localStorage.removeItem(legacyStorageKey);
      }
    },
    {
      authStorageKey: getE2EAuthStorageKey(),
      legacyStorageKey: LEGACY_STORAGE_KEY,
      legacyValue: options?.legacyData ?? null,
      forceDemoStorageKey: FORCE_DEMO_MODE_STORAGE_KEY,
    },
  );
};

export const primeForcedDemoMode = async (
  page: Page,
  options?: {
    legacyData?: AppData | null;
  },
) => {
  await page.addInitScript(
    ({ authStorageKey, legacyStorageKey, legacyValue, forceDemoStorageKey }) => {
      window.localStorage.setItem(forceDemoStorageKey, "1");
      window.localStorage.removeItem(authStorageKey);

      if (legacyValue) {
        window.localStorage.setItem(legacyStorageKey, JSON.stringify(legacyValue));
      } else {
        window.localStorage.removeItem(legacyStorageKey);
      }
    },
    {
      authStorageKey: getE2EAuthStorageKey(),
      legacyStorageKey: LEGACY_STORAGE_KEY,
      legacyValue: options?.legacyData ?? null,
      forceDemoStorageKey: FORCE_DEMO_MODE_STORAGE_KEY,
    },
  );
};

export const seedCloudTrips = async (
  page: Page,
  user: SessionUser,
  data: AppData | null,
) => {
  await page.request.post("/api/e2e/trips/seed", {
    data: {
      user,
      data,
    },
  });
};

export const primeStaleRouteEstimateCache = async (page: Page) => {
  const seedTrip = getSeedData().trips[0];
  const { requests, signature } = buildTripTravelLegPayload(seedTrip);
  const cachedAt = new Date(Date.now() - 7 * 60 * 60 * 1000).toISOString();
  const estimates: TravelLegEstimate[] = requests.map((request, index) => ({
    id: request.id,
    fromId: request.fromId,
    fromLabel: request.fromLabel,
    toId: request.toId,
    toLabel: request.toLabel,
    kind: "road",
    distanceKm: 40 + index * 8,
    durationMinutes: 35 + index * 6,
    bufferedDurationMinutes: 50 + index * 7,
    provider: "fallback_haversine",
    fetchedAt: cachedAt,
    confidence: "fallback",
    date: request.date,
    relatedStopId: request.relatedStopId,
  }));

  await page.addInitScript(
    ({ storageKey, cacheSignature, entry }) => {
      const raw = window.localStorage.getItem(storageKey);
      const parsed =
        raw && raw.trim().length > 0
          ? (JSON.parse(raw) as Record<string, typeof entry>)
          : {};
      parsed[cacheSignature] = entry;
      window.localStorage.setItem(storageKey, JSON.stringify(parsed));
    },
    {
      storageKey: ROUTE_ESTIMATE_CACHE_FALLBACK_STORAGE_KEY,
      cacheSignature: signature,
      entry: {
        signature,
        estimates,
        cachedAt,
      },
    },
  );
};
