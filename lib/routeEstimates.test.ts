import { describe, expect, it } from "vitest";

import { toIsoFromLocalInput } from "@/lib/date";
import {
  buildTripTravelLegPayload,
  mergeTravelEstimateMetadata,
} from "@/lib/routeEstimates";
import { Trip } from "@/types/trip";

const buildTrip = (): Trip => ({
  id: "trip-route-1",
  name: "Route confidence trip",
  timezone: "Europe/London",
  ownerUserId: "user-1",
  version: 1,
  lastSyncedAt: null,
  createdAt: toIsoFromLocalInput("2026-04-01T08:00"),
  updatedAt: toIsoFromLocalInput("2026-04-01T08:00"),
  home: {
    label: "Home",
    coordinates: { lat: 56, lng: -4 },
  },
  stops: [
    {
      id: "stay-1",
      order: 0,
      type: "stay",
      title: "Camp one",
      notes: "Original notes",
      place: {
        label: "Camp one",
        coordinates: { lat: 56.2, lng: -4.1 },
      },
      checkInAt: toIsoFromLocalInput("2026-04-03T16:00"),
      checkOutAt: toIsoFromLocalInput("2026-04-04T10:00"),
      bookingStatus: "confirmed",
      hookup: true,
      hardstanding: false,
      amenitiesSummary: "Showers",
    },
    {
      id: "ferry-1",
      order: 1,
      type: "ferry",
      title: "Morning ferry",
      departurePort: {
        label: "Departure port",
        coordinates: { lat: 56.5, lng: -4.4 },
      },
      arrivalPort: {
        label: "Arrival port",
        coordinates: { lat: 56.8, lng: -4.6 },
      },
      departureAt: toIsoFromLocalInput("2026-04-04T11:30"),
      arrivalAt: toIsoFromLocalInput("2026-04-04T13:00"),
      checkInBy: toIsoFromLocalInput("2026-04-04T10:50"),
      checkInBufferMinutes: 40,
      vehicleDetails: {
        vehicleType: "campervan",
      },
    },
  ],
});

describe("routeEstimates", () => {
  it("keeps the travel-leg signature stable for non-routing edits", () => {
    const trip = buildTrip();
    const editedTrip: Trip = {
      ...trip,
      name: "Renamed trip",
      stops: trip.stops.map((stop) =>
        stop.id === "stay-1"
          ? {
              ...stop,
              title: "Camp one updated",
              notes: "New notes",
            }
          : stop,
      ),
    };

    expect(buildTripTravelLegPayload(editedTrip).signature).toBe(
      buildTripTravelLegPayload(trip).signature,
    );
  });

  it("changes the travel-leg signature when dates or locations change", () => {
    const trip = buildTrip();
    const baseSignature = buildTripTravelLegPayload(trip).signature;

    const dateEditedTrip: Trip = {
      ...trip,
      stops: trip.stops.map((stop) =>
        stop.id === "stay-1"
          ? {
              ...stop,
              checkInAt: toIsoFromLocalInput("2026-04-05T16:00"),
            }
          : stop,
      ),
    };

    const locationEditedTrip: Trip = {
      ...trip,
      stops: trip.stops.map((stop) =>
        stop.id === "stay-1"
          ? {
              ...stop,
              place: {
                ...stop.place,
                coordinates: { lat: 56.9, lng: -4.4 },
              },
            }
          : stop,
      ),
    };

    expect(buildTripTravelLegPayload(dateEditedTrip).signature).not.toBe(baseSignature);
    expect(buildTripTravelLegPayload(locationEditedTrip).signature).not.toBe(baseSignature);
  });

  it("changes the travel-leg signature when routing coordinates change", () => {
    const trip = buildTrip();
    const baseSignature = buildTripTravelLegPayload(trip).signature;

    const routingEditedTrip: Trip = {
      ...trip,
      stops: trip.stops.map((stop) =>
        stop.id === "stay-1"
          ? {
              ...stop,
              place: {
                ...stop.place,
                routingCoordinates: { lat: 56.24, lng: -4.06 },
              },
            }
          : stop,
      ),
    };

    expect(buildTripTravelLegPayload(routingEditedTrip).signature).not.toBe(baseSignature);
  });

  it("reuses current itinerary labels when hydrating cached estimates", () => {
    const trip = buildTrip();
    const { requests } = buildTripTravelLegPayload(trip);

    const estimates = [
      {
        id: requests[0].id,
        fromId: requests[0].fromId,
        fromLabel: "Old home label",
        toId: requests[0].toId,
        toLabel: "Old stop label",
        kind: "road" as const,
        distanceKm: 42,
        durationMinutes: 50,
        bufferedDurationMinutes: 68,
        provider: "fallback_haversine",
        fetchedAt: new Date().toISOString(),
        confidence: "fallback" as const,
        date: requests[0].date,
        relatedStopId: requests[0].relatedStopId,
      },
    ];

    const renamedRequests = requests.map((request, index) =>
      index === 0
        ? {
            ...request,
            fromLabel: "Home: Updated",
            toLabel: "Camp one updated",
          }
        : request,
    );

    expect(mergeTravelEstimateMetadata(estimates, renamedRequests)[0]).toMatchObject({
      fromLabel: "Home: Updated",
      toLabel: "Camp one updated",
      distanceKm: 42,
      bufferedDurationMinutes: 68,
    });
  });
});
