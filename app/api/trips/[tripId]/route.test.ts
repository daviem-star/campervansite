import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { DELETE, PATCH, PUT } from "@/app/api/trips/[tripId]/route";
import { createE2EAccessToken } from "@/lib/e2eAuth";
import { loadE2ETrip, replaceE2ETrips } from "@/lib/e2eTripStore";
import { createBlankTrip, createExampleTrip } from "@/lib/tripFactories";
import { SessionUser } from "@/types/trip";

const user: SessionUser = {
  id: "trip-route-user",
  email: "trip-route@example.com",
};

const buildRequest = (
  method: "PATCH" | "DELETE" | "PUT",
  tripId: string,
  body?: unknown,
  authenticated = true,
) =>
  new Request(`http://localhost:3000/api/trips/${tripId}`, {
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

const buildContext = (tripId: string) => ({
  params: Promise.resolve({ tripId }),
});

describe("/api/trips/[tripId]", () => {
  const originalBypass = process.env.E2E_AUTH_BYPASS;

  beforeEach(() => {
    process.env.E2E_AUTH_BYPASS = "1";
  });

  afterEach(() => {
    replaceE2ETrips(user, null);
    process.env.E2E_AUTH_BYPASS = originalBypass;
  });

  it("renames a trip and increments its version in e2e bypass mode", async () => {
    const trip = createExampleTrip(user.id, "Original name");
    replaceE2ETrips(user, {
      schemaVersion: 2,
      activeTripId: trip.id,
      trips: [trip],
    });

    const response = await PATCH(
      buildRequest("PATCH", trip.id, { name: "Renamed trip" }) as never,
      buildContext(trip.id) as never,
    );
    const payload = (await response.json()) as {
      trip: {
        id: string;
        name: string;
        version: number;
      };
    };

    expect(response.status).toBe(200);
    expect(payload.trip).toMatchObject({
      id: trip.id,
      name: "Renamed trip",
      version: 2,
    });
    expect(loadE2ETrip(user, trip.id)?.name).toBe("Renamed trip");
  });

  it("saves a route snapshot as part of the trip document", async () => {
    const trip = createExampleTrip(user.id, "Snapshot trip");
    replaceE2ETrips(user, {
      schemaVersion: 2,
      activeTripId: trip.id,
      trips: [trip],
    });

    const routeSnapshot = {
      signature: "road-home-stop-1",
      fetchedAt: "2026-04-04T09:00:00.000Z",
      estimates: [
        {
          id: "road-home-stop-1",
          fromId: "home",
          fromLabel: "Home",
          toId: "stop-1",
          toLabel: "First stop",
          kind: "road" as const,
          distanceKm: 124.3,
          durationMinutes: 152,
          bufferedDurationMinutes: 185,
          provider: "openrouteservice_driving_car",
          fetchedAt: "2026-04-04T09:00:00.000Z",
          confidence: "live" as const,
          date: "2026-08-05",
          relatedStopId: "stop_stay_1",
        },
      ],
    };

    const response = await PUT(
      buildRequest("PUT", trip.id, {
        trip: {
          ...trip,
          routeSnapshot,
        },
        expectedVersion: trip.version,
      }) as never,
      buildContext(trip.id) as never,
    );
    const payload = (await response.json()) as {
      trip: {
        version: number;
        routeSnapshot?: typeof routeSnapshot | null;
      };
    };

    expect(response.status).toBe(200);
    expect(payload.trip.version).toBe(2);
    expect(payload.trip.routeSnapshot).toMatchObject(routeSnapshot);
    expect(loadE2ETrip(user, trip.id)?.routeSnapshot).toMatchObject(routeSnapshot);
  });

  it("deletes a trip when another trip remains", async () => {
    const tripA = createExampleTrip(user.id, "Trip A");
    const tripB = createBlankTrip(user.id, {
      name: "Trip B",
      home: {
        label: "Leeds, England",
        coordinates: { lat: 53.8008, lng: -1.5491 },
      },
    });

    replaceE2ETrips(user, {
      schemaVersion: 2,
      activeTripId: tripA.id,
      trips: [tripA, tripB],
    });

    const response = await DELETE(
      buildRequest("DELETE", tripB.id) as never,
      buildContext(tripB.id) as never,
    );
    const payload = (await response.json()) as { deletedTripId: string };

    expect(response.status).toBe(200);
    expect(payload.deletedTripId).toBe(tripB.id);
    expect(loadE2ETrip(user, tripB.id)).toBeNull();
    expect(loadE2ETrip(user, tripA.id)?.name).toBe("Trip A");
  });

  it("rejects deleting the last remaining trip", async () => {
    const trip = createExampleTrip(user.id, "Only trip");
    replaceE2ETrips(user, {
      schemaVersion: 2,
      activeTripId: trip.id,
      trips: [trip],
    });

    const response = await DELETE(
      buildRequest("DELETE", trip.id) as never,
      buildContext(trip.id) as never,
    );
    const payload = (await response.json()) as { error: string };

    expect(response.status).toBe(400);
    expect(payload.error).toMatch(/create another trip before deleting this one/i);
    expect(loadE2ETrip(user, trip.id)).not.toBeNull();
  });

  it("rejects unauthenticated rename requests", async () => {
    const trip = createExampleTrip(user.id, "Locked trip");
    replaceE2ETrips(user, {
      schemaVersion: 2,
      activeTripId: trip.id,
      trips: [trip],
    });

    const response = await PATCH(
      buildRequest("PATCH", trip.id, { name: "Blocked" }, false) as never,
      buildContext(trip.id) as never,
    );
    const payload = (await response.json()) as { error: string };

    expect(response.status).toBe(401);
    expect(payload.error).toMatch(/unauthenticated/i);
  });
});
