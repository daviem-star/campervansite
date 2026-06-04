import { describe, expect, it } from "vitest";

import { deriveBookings, deriveSavedPlaces } from "@/lib/tripLibraryViews";
import { getSeedData } from "@/lib/seedData";

describe("trip library views", () => {
  it("deduplicates saved places and keeps each trip occurrence", () => {
    const trip = getSeedData().trips[0];
    const copy = structuredClone(trip);
    copy.id = "copy";
    copy.name = "Copy";

    const places = deriveSavedPlaces([trip, copy]);
    const firstStay = trip.stops.find((stop) => stop.type === "stay");
    const savedStay = places.find((place) => place.label === firstStay?.place.label);

    expect(savedStay?.occurrences).toHaveLength(2);
    expect(savedStay?.kinds).toContain("stay");
  });

  it("derives sorted bookings and flags missing details", () => {
    const trip = structuredClone(getSeedData().trips[0]);
    const plannedStay = trip.stops.find((stop) => stop.type === "stay");
    const ferry = trip.stops.find((stop) => stop.type === "ferry");

    if (plannedStay?.type === "stay") {
      plannedStay.bookingStatus = "planned";
    }
    if (ferry?.type === "ferry") {
      ferry.bookingRef = undefined;
    }

    const bookings = deriveBookings([trip], "2026-01-01");

    expect(bookings.every((booking, index) =>
      index === 0 || bookings[index - 1].startAt <= booking.startAt,
    )).toBe(true);
    expect(bookings.find((booking) => booking.stopId === plannedStay?.id)?.needsAttention).toBe(true);
    expect(bookings.find((booking) => booking.stopId === ferry?.id)?.status).toBe("reference-missing");
  });
});
