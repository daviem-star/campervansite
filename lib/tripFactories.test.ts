import { describe, expect, it } from "vitest";

import { createBlankTrip, createExampleTrip } from "@/lib/tripFactories";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const expectRawTripId = (id: string) => {
  expect(id).toMatch(uuidPattern);
  expect(id).not.toMatch(/^trip_(blank|example)_/);
  expect(id).not.toMatch(/^trip_/);
};

describe("tripFactories", () => {
  it("starts copied example trips without stale saved route data", () => {
    const trip = createExampleTrip("user-1", "Island Hopping 2026");

    expect(trip.routeSnapshot).toBeNull();
  });

  it("uses raw unique ids for newly created blank and example trips", () => {
    const blankTrip = createBlankTrip("user-1", {
      name: "Norfolk coast loop",
      home: {
        label: "Norwich, England",
        coordinates: { lat: 52.6309, lng: 1.2974 },
      },
    });
    const exampleTrip = createExampleTrip("user-1", "Island Hopping 2026");

    expectRawTripId(blankTrip.id);
    expectRawTripId(exampleTrip.id);
    expect(blankTrip.id).not.toBe(exampleTrip.id);
  });
});
