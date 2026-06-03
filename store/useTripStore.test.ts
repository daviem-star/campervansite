import { describe, expect, it, vi } from "vitest";

import {
  resolveAuthStateChangeAction,
  resolveRouteSnapshotTargetTrip,
  withPerUserLock,
} from "@/store/useTripStore";
import type { Trip } from "@/types/trip";

const buildTrip = (id: string, name: string, updatedAt: string): Trip => ({
  id,
  name,
  timezone: "Europe/London",
  ownerUserId: "user-1",
  version: 1,
  createdAt: updatedAt,
  updatedAt,
  lastSyncedAt: updatedAt,
  home: {
    label: "Home",
    coordinates: { lat: 57.4778, lng: -4.2247 },
  },
  stops: [],
});

describe("useTripStore auth bootstrap guards", () => {
  it("refreshes in place for a same-user sign-in event", () => {
    expect(
      resolveAuthStateChangeAction({
        event: "SIGNED_IN",
        currentUserId: "user-1",
        sessionUserId: "user-1",
      }),
    ).toBe("refresh_signed_in");
  });

  it("reinitializes when a sign-in event changes users or no user is loaded", () => {
    expect(
      resolveAuthStateChangeAction({
        event: "SIGNED_IN",
        currentUserId: null,
        sessionUserId: "user-1",
      }),
    ).toBe("initialize");
    expect(
      resolveAuthStateChangeAction({
        event: "SIGNED_IN",
        currentUserId: "user-1",
        sessionUserId: "user-2",
      }),
    ).toBe("initialize");
  });

  it("ignores non-sign-in auth churn and reinitializes on sign-out", () => {
    expect(
      resolveAuthStateChangeAction({
        event: "SIGNED_OUT",
        currentUserId: "user-1",
        sessionUserId: null,
      }),
    ).toBe("initialize");
    expect(
      resolveAuthStateChangeAction({
        event: "INITIAL_SESSION",
        currentUserId: "user-1",
        sessionUserId: "user-1",
      }),
    ).toBe("ignore");
    expect(
      resolveAuthStateChangeAction({
        event: "TOKEN_REFRESHED",
        currentUserId: "user-1",
        sessionUserId: "user-1",
      }),
    ).toBe("ignore");
  });

  it("reuses the same in-flight starter bootstrap for a user", async () => {
    const pending = new Map<string, Promise<string>>();
    const action = vi.fn(async () => {
      await Promise.resolve();
      return "starter-trip";
    });

    const [first, second] = await Promise.all([
      withPerUserLock(pending, "user-1", action),
      withPerUserLock(pending, "user-1", action),
    ]);

    expect(first).toBe("starter-trip");
    expect(second).toBe("starter-trip");
    expect(action).toHaveBeenCalledTimes(1);
    expect(pending.size).toBe(0);
  });

  it("prefers the active loaded trip over a stale cache entry when saving route snapshots", () => {
    const activeTrip = buildTrip("trip-1", "Loaded version", "2026-06-03T10:00:00.000Z");
    const cachedTrip = buildTrip("trip-1", "Cached version", "2026-06-02T10:00:00.000Z");

    expect(resolveRouteSnapshotTargetTrip("trip-1", activeTrip, { "trip-1": cachedTrip })).toBe(
      activeTrip,
    );
  });

  it("uses the cached trip for route snapshots when the target is not loaded", () => {
    const activeTrip = buildTrip("trip-1", "Loaded trip", "2026-06-03T10:00:00.000Z");
    const cachedTrip = buildTrip("trip-2", "Cached trip", "2026-06-03T11:00:00.000Z");

    expect(resolveRouteSnapshotTargetTrip("trip-2", activeTrip, { "trip-2": cachedTrip })).toBe(
      cachedTrip,
    );
  });
});
