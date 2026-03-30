import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  readCachedRouteEstimateSet,
  ROUTE_ESTIMATE_CACHE_FALLBACK_STORAGE_KEY,
  ROUTE_ESTIMATE_CACHE_TTL_MS,
  writeCachedRouteEstimateSet,
} from "@/lib/routeEstimateCache";
import { TravelLegEstimate } from "@/types/trip";

type LocalStorageStub = {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
  removeItem: (key: string) => void;
  clear: () => void;
};

const createLocalStorageStub = (): LocalStorageStub => {
  const storage = new Map<string, string>();

  return {
    getItem: (key) => storage.get(key) ?? null,
    setItem: (key, value) => {
      storage.set(key, value);
    },
    removeItem: (key) => {
      storage.delete(key);
    },
    clear: () => {
      storage.clear();
    },
  };
};

const buildEstimate = (): TravelLegEstimate => ({
  id: "road-home-stay-1",
  fromId: "home",
  fromLabel: "Home",
  toId: "stay-1",
  toLabel: "Camp one",
  kind: "road",
  distanceKm: 42,
  durationMinutes: 50,
  bufferedDurationMinutes: 68,
  provider: "fallback_haversine",
  fetchedAt: new Date().toISOString(),
  confidence: "fallback",
  date: "2026-04-03",
  relatedStopId: "stay-1",
});

describe("routeEstimateCache", () => {
  const localStorage = createLocalStorageStub();

  beforeEach(() => {
    Object.defineProperty(globalThis, "window", {
      value: {
        localStorage,
      },
      configurable: true,
      writable: true,
    });
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
    Reflect.deleteProperty(globalThis, "window");
  });

  it("writes and reads a fresh cached estimate set via the persistent fallback cache", async () => {
    const cachedAt = "2026-04-01T10:00:00.000Z";
    await writeCachedRouteEstimateSet("sig-1", [buildEstimate()], cachedAt);

    const cachePayload = localStorage.getItem(ROUTE_ESTIMATE_CACHE_FALLBACK_STORAGE_KEY);
    expect(cachePayload).toContain("sig-1");

    await expect(
      readCachedRouteEstimateSet("sig-1", new Date(cachedAt).getTime() + 5 * 60_000),
    ).resolves.toMatchObject({
      state: "fresh",
      entry: {
        signature: "sig-1",
        cachedAt,
      },
    });
  });

  it("returns stale cached data after the ttl expires", async () => {
    const cachedAt = "2026-04-01T10:00:00.000Z";
    await writeCachedRouteEstimateSet("sig-2", [buildEstimate()], cachedAt);

    await expect(
      readCachedRouteEstimateSet(
        "sig-2",
        new Date(cachedAt).getTime() + ROUTE_ESTIMATE_CACHE_TTL_MS + 60_000,
      ),
    ).resolves.toMatchObject({
      state: "stale",
      entry: {
        signature: "sig-2",
      },
    });
  });
});
