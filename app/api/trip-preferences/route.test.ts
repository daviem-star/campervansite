import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { GET, PUT } from "@/app/api/trip-preferences/route";
import { createE2EAccessToken } from "@/lib/e2eAuth";
import {
  getE2ETripPreferences,
  replaceE2ETrips,
  saveE2ETripPreferences,
} from "@/lib/e2eTripStore";
import { createBlankTrip, createExampleTrip } from "@/lib/tripFactories";
import { SessionUser } from "@/types/trip";

const user: SessionUser = {
  id: "trip-preferences-user",
  email: "trip-preferences@example.com",
};

const buildRequest = (method: "GET" | "PUT", body?: unknown, authenticated = true) =>
  new Request("http://localhost:3000/api/trip-preferences", {
    method,
    headers: {
      ...(body ? { "Content-Type": "application/json" } : {}),
      ...(authenticated
        ? {
            Authorization: `Bearer ${createE2EAccessToken(user)}`,
          }
        : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });

describe("/api/trip-preferences", () => {
  const originalBypass = process.env.E2E_AUTH_BYPASS;

  beforeEach(() => {
    process.env.E2E_AUTH_BYPASS = "1";
    replaceE2ETrips(user, null);
    saveE2ETripPreferences(user, { todayTripId: null });
  });

  afterEach(() => {
    replaceE2ETrips(user, null);
    saveE2ETripPreferences(user, { todayTripId: null });
    process.env.E2E_AUTH_BYPASS = originalBypass;
  });

  it("returns the stored Today trip id for the authenticated user", async () => {
    const trip = createExampleTrip(user.id, "Today choice");
    replaceE2ETrips(user, {
      schemaVersion: 2,
      activeTripId: trip.id,
      trips: [trip],
    });
    saveE2ETripPreferences(user, { todayTripId: trip.id });

    const response = await GET(buildRequest("GET") as never);
    const payload = (await response.json()) as { todayTripId: string | null };

    expect(response.status).toBe(200);
    expect(payload.todayTripId).toBe(trip.id);
  });

  it("persists a valid Today trip id", async () => {
    const tripA = createExampleTrip(user.id, "Trip A");
    const tripB = createBlankTrip(user.id, {
      name: "Trip B",
      home: {
        label: "St Andrews, Scotland",
        coordinates: { lat: 56.3398, lng: -2.7967 },
      },
    });

    replaceE2ETrips(user, {
      schemaVersion: 2,
      activeTripId: tripA.id,
      trips: [tripA, tripB],
    });

    const response = await PUT(
      buildRequest("PUT", {
        todayTripId: tripB.id,
      }) as never,
    );
    const payload = (await response.json()) as { todayTripId: string | null };

    expect(response.status).toBe(200);
    expect(payload.todayTripId).toBe(tripB.id);
    expect(getE2ETripPreferences(user).todayTripId).toBe(tripB.id);
  });

  it("clears the Today trip selection with null", async () => {
    const trip = createExampleTrip(user.id, "Trip to clear");
    replaceE2ETrips(user, {
      schemaVersion: 2,
      activeTripId: trip.id,
      trips: [trip],
    });
    saveE2ETripPreferences(user, { todayTripId: trip.id });

    const response = await PUT(
      buildRequest("PUT", {
        todayTripId: null,
      }) as never,
    );
    const payload = (await response.json()) as { todayTripId: string | null };

    expect(response.status).toBe(200);
    expect(payload.todayTripId).toBeNull();
    expect(getE2ETripPreferences(user).todayTripId).toBeNull();
  });

  it("rejects a Today trip id that does not belong to the user", async () => {
    const trip = createExampleTrip("someone-else", "Foreign trip");

    const response = await PUT(
      buildRequest("PUT", {
        todayTripId: trip.id,
      }) as never,
    );
    const payload = (await response.json()) as { error: string };

    expect(response.status).toBe(400);
    expect(payload.error).toMatch(/today trip not found/i);
  });

  it("rejects unauthenticated requests", async () => {
    const response = await GET(buildRequest("GET", undefined, false) as never);
    const payload = (await response.json()) as { error: string };

    expect(response.status).toBe(401);
    expect(payload.error).toMatch(/unauthenticated/i);
  });
});
