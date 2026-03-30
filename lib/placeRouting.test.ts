import { describe, expect, it } from "vitest";

import {
  areCoordinatesEqual,
  getPlaceRoutingCoordinates,
  normalizePlaceRef,
  withPlaceRoutingCoordinates,
} from "@/lib/placeRouting";

describe("placeRouting", () => {
  it("normalizes a place while preserving distinct routing coordinates", () => {
    expect(
      normalizePlaceRef({
        label: "Camp",
        coordinates: { lat: 57.04, lng: -7.458 },
        routingCoordinates: { lat: 57.0358, lng: -7.4472 },
      }),
    ).toEqual({
      label: "Camp",
      coordinates: { lat: 57.04, lng: -7.458 },
      routingCoordinates: { lat: 57.0358, lng: -7.4472 },
    });
  });

  it("drops routing coordinates when they match the display point", () => {
    expect(
      normalizePlaceRef({
        label: "Camp",
        coordinates: { lat: 57.04, lng: -7.458 },
        routingCoordinates: { lat: 57.04, lng: -7.4580001 },
      }),
    ).toEqual({
      label: "Camp",
      coordinates: { lat: 57.04, lng: -7.458 },
    });
  });

  it("prefers routing coordinates for route requests", () => {
    expect(
      getPlaceRoutingCoordinates({
        coordinates: { lat: 57.04, lng: -7.458 },
        routingCoordinates: { lat: 57.0358, lng: -7.4472 },
      }),
    ).toEqual({ lat: 57.0358, lng: -7.4472 });
  });

  it("adds routing coordinates only when they differ from the display point", () => {
    expect(
      withPlaceRoutingCoordinates(
        {
          label: "Camp",
          coordinates: { lat: 57.04, lng: -7.458 },
        },
        { lat: 57.0358, lng: -7.4472 },
      ),
    ).toEqual({
      label: "Camp",
      coordinates: { lat: 57.04, lng: -7.458 },
      routingCoordinates: { lat: 57.0358, lng: -7.4472 },
    });
  });

  it("treats coordinates with the same rounded precision as equal", () => {
    expect(
      areCoordinatesEqual(
        { lat: 57.04, lng: -7.458 },
        { lat: 57.0400001, lng: -7.4580001 },
      ),
    ).toBe(true);
  });
});
