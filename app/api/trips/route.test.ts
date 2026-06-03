import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { GET, POST } from "@/app/api/trips/route";
import { createE2EAccessToken, isServerE2EAuthBypassEnabled } from "@/lib/e2eAuth";
import { listE2ETrips, replaceE2ETrips } from "@/lib/e2eTripStore";
import { getSeedData } from "@/lib/seedData";
import { SessionUser } from "@/types/trip";

const user: SessionUser = {
  id: "route-test-user",
  email: "route-test@example.com",
};

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const expectRawTripId = (id: string) => {
  expect(id).toMatch(uuidPattern);
  expect(id).not.toMatch(/^trip_(blank|example)_/);
  expect(id).not.toMatch(/^trip_/);
};

const buildRequest = (method: "GET" | "POST", body?: unknown, authenticated = true) =>
  new Request("http://localhost:3000/api/trips", {
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

describe("/api/trips", () => {
  const originalBypass = process.env.E2E_AUTH_BYPASS;

  beforeEach(() => {
    process.env.E2E_AUTH_BYPASS = "1";
    replaceE2ETrips(user, null);
  });

  afterEach(() => {
    replaceE2ETrips(user, null);
    process.env.E2E_AUTH_BYPASS = originalBypass;
  });

  it("creates a blank trip in e2e bypass mode", async () => {
    expect(isServerE2EAuthBypassEnabled()).toBe(true);

    const response = await POST(
      buildRequest("POST", {
        source: "blank",
        name: "Norfolk coast loop",
        home: {
          label: "Norwich, England",
          coordinates: { lat: 52.6309, lng: 1.2974 },
        },
      }) as never,
    );
    const payload = (await response.json()) as {
      trip: {
        id: string;
        name: string;
        home: { label: string };
        ownerUserId: string | null;
        stops: unknown[];
        version: number;
      };
    };

    expect(response.status).toBe(200);
    expect(payload.trip).toMatchObject({
      name: "Norfolk coast loop",
      home: { label: "Norwich, England" },
      ownerUserId: user.id,
      stops: [],
      version: 1,
    });
    expect(listE2ETrips(user).map((trip) => trip.id)).toContain(payload.trip.id);
    expectRawTripId(payload.trip.id);
  });

  it("creates an example trip clone in e2e bypass mode", async () => {
    const seedTrip = getSeedData().trips[0];

    const response = await POST(
      buildRequest("POST", {
        source: "example",
        name: "Spring islands copy",
      }) as never,
    );
    const payload = (await response.json()) as {
      trip: {
        id: string;
        name: string;
        ownerUserId: string | null;
        stops: Array<{ id: string }>;
      };
    };

    expect(response.status).toBe(200);
    expect(payload.trip.name).toBe("Spring islands copy");
    expect(payload.trip.ownerUserId).toBe(user.id);
    expect(payload.trip.stops).toHaveLength(seedTrip.stops.length);
    expect(payload.trip.id).not.toBe(seedTrip.id);
    expectRawTripId(payload.trip.id);
  });

  it("lists created trips for the authenticated user", async () => {
    await POST(
      buildRequest("POST", {
        source: "blank",
        name: "List me",
        home: {
          label: "Inverness, Scotland",
          coordinates: { lat: 57.4778, lng: -4.2247 },
        },
      }) as never,
    );

    const response = await GET(buildRequest("GET") as never);
    const payload = (await response.json()) as {
      trips: Array<{
        id: string;
        name: string;
      }>;
    };

    expect(response.status).toBe(200);
    expect(payload.trips.some((trip) => trip.name === "List me")).toBe(true);
  });

  it("rejects unauthenticated trip creation", async () => {
    const response = await POST(
      buildRequest(
        "POST",
        {
          source: "example",
          name: "Blocked",
        },
        false,
      ) as never,
    );
    const payload = (await response.json()) as { error: string };

    expect(response.status).toBe(401);
    expect(payload.error).toMatch(/unauthenticated/i);
  });
});
