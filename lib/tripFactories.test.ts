import { describe, expect, it } from "vitest";

import { createExampleTrip } from "@/lib/tripFactories";

describe("tripFactories", () => {
  it("starts copied example trips without stale saved route data", () => {
    const trip = createExampleTrip("user-1", "Island Hopping 2026");

    expect(trip.routeSnapshot).toBeNull();
  });
});
