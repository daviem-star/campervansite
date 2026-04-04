import { describe, expect, it } from "vitest";

import { getPlannerMapRouteSummary } from "@/lib/plannerMap";
import { MapSegment } from "@/types/trip";

const coordinates = { lat: 57.5, lng: -6.2 };

const buildRoadSegment = (
  id: string,
  routeStatus: MapSegment["routeStatus"],
): MapSegment => ({
  id,
  type: "road",
  from: coordinates,
  to: coordinates,
  routeStatus,
});

describe("getPlannerMapRouteSummary", () => {
  it("counts road segment render states without including ferry legs", () => {
    const summary = getPlannerMapRouteSummary(
      [
        buildRoadSegment("road-live", "live"),
        buildRoadSegment("road-fallback", "fallback"),
        buildRoadSegment("road-pending", "pending"),
        {
          id: "ferry-1",
          type: "ferry",
          from: coordinates,
          to: coordinates,
        },
      ],
      true,
    );

    expect(summary).toEqual({
      totalRoadLegs: 3,
      pendingRoadLegs: 1,
      liveRoadLegs: 1,
      fallbackRoadLegs: 1,
      isRefreshing: true,
    });
  });

  it("returns empty counts when there are no road segments", () => {
    const summary = getPlannerMapRouteSummary(
      [
        {
          id: "ferry-1",
          type: "ferry",
          from: coordinates,
          to: coordinates,
        },
      ],
      false,
    );

    expect(summary).toEqual({
      totalRoadLegs: 0,
      pendingRoadLegs: 0,
      liveRoadLegs: 0,
      fallbackRoadLegs: 0,
      isRefreshing: false,
    });
  });
});
