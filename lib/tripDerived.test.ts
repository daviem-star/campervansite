import { describe, expect, it } from "vitest";

import { toIsoFromLocalInput } from "@/lib/date";
import {
  buildTravelLegSignature,
  buildTravelEstimateRequests,
  getItineraryDays,
  getMapData,
  getSelectedEntityDetails,
  getValidationWarnings,
  moveStopByOffset,
  reorderStopsById,
} from "@/lib/tripDerived";
import { TravelLegEstimate, Trip } from "@/types/trip";

const buildTrip = (): Trip => ({
  id: "trip-1",
  name: "Validation trip",
  timezone: "Europe/London",
  ownerUserId: "user-1",
  version: 2,
  lastSyncedAt: toIsoFromLocalInput("2026-04-01T08:00"),
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
    {
      id: "stay-2",
      order: 2,
      type: "stay",
      title: "Camp two",
      place: {
        label: "Camp two",
        coordinates: { lat: 56.95, lng: -4.7 },
      },
      checkInAt: toIsoFromLocalInput("2026-04-04T20:00"),
      checkOutAt: toIsoFromLocalInput("2026-04-05T10:00"),
      bookingStatus: "planned",
      hookup: false,
      hardstanding: true,
    },
  ],
});

describe("tripDerived", () => {
  it("builds route-estimate requests from the ordered itinerary", () => {
    const requests = buildTravelEstimateRequests(buildTrip());

    expect(requests).toHaveLength(3);
    expect(requests[0]).toMatchObject({
      fromId: "home",
      toId: "stay-1",
    });
    expect(requests[1]).toMatchObject({
      fromId: "stay-1",
      toId: "ferry-1",
    });
  });

  it("uses routing coordinates for route requests while keeping map geometry on display coordinates", () => {
    const trip = buildTrip();
    trip.stops = trip.stops.map((stop) =>
      stop.id === "stay-1"
        ? {
            ...stop,
            place: {
              ...stop.place,
              routingCoordinates: { lat: 56.24, lng: -4.06 },
            },
          }
        : stop,
    );

    const requests = buildTravelEstimateRequests(trip);
    const mapData = getMapData(trip);

    expect(requests[0]?.to).toEqual({ lat: 56.24, lng: -4.06 });
    expect(mapData.markers.find((marker) => marker.id === "stay-1")?.coordinates).toEqual({
      lat: 56.2,
      lng: -4.1,
    });
    expect(mapData.segments.find((segment) => segment.id === "road-stay-1")?.to).toEqual({
      lat: 56.2,
      lng: -4.1,
    });
    expect(mapData.segments.find((segment) => segment.id === "road-stay-1")?.routeStatus).toBe(
      "pending",
    );
  });

  it("prefers live road geometry on map segments while anchoring it to display coordinates", () => {
    const trip = buildTrip();
    trip.stops = trip.stops.map((stop) =>
      stop.id === "stay-1"
        ? {
            ...stop,
            place: {
              ...stop.place,
              routingCoordinates: { lat: 56.24, lng: -4.06 },
            },
          }
        : stop,
    );

    const mapData = getMapData(trip, [
      {
        id: "road-home-stay-1",
        fromId: "home",
        fromLabel: "Home",
        toId: "stay-1",
        toLabel: "Camp one",
        kind: "road",
        distanceKm: 42,
        durationMinutes: 50,
        bufferedDurationMinutes: 68,
        provider: "openrouteservice_driving_car",
        fetchedAt: new Date().toISOString(),
        confidence: "live",
        date: "2026-04-03",
        relatedStopId: "stay-1",
        geometry: {
          type: "LineString",
          coordinates: [
            { lat: 56, lng: -4 },
            { lat: 56.12, lng: -4.03 },
            { lat: 56.24, lng: -4.06 },
          ],
        },
      },
    ]);

    expect(mapData.segments.find((segment) => segment.id === "road-stay-1")?.geometry).toEqual({
      type: "LineString",
      coordinates: [
        { lat: 56, lng: -4 },
        { lat: 56.12, lng: -4.03 },
        { lat: 56.2, lng: -4.1 },
      ],
    });
    expect(mapData.segments.find((segment) => segment.id === "road-stay-1")).toMatchObject({
      routeStatus: "live",
      routeConfidence: "live",
    });
  });

  it("marks road segments as fallback when live geometry is unavailable", () => {
    const trip = buildTrip();
    const mapData = getMapData(trip, [
      {
        id: "road-home-stay-1",
        fromId: "home",
        fromLabel: "Home",
        toId: "stay-1",
        toLabel: "Camp one",
        kind: "road",
        distanceKm: 42,
        durationMinutes: 50,
        bufferedDurationMinutes: 68,
        provider: "fallback_haversine",
        fetchedAt: new Date().toISOString(),
        confidence: "fallback",
        date: "2026-04-03",
        relatedStopId: "stay-1",
      },
    ]);

    expect(mapData.segments.find((segment) => segment.id === "road-stay-1")).toMatchObject({
      routeStatus: "fallback",
      routeConfidence: "fallback",
      geometry: undefined,
    });
  });

  it("matches road estimates by travel context id when relatedStopId is missing", () => {
    const trip = buildTrip();
    const mapData = getMapData(trip, [
      {
        id: "road-home-stay-1",
        fromId: "home",
        fromLabel: "Home",
        toId: "stay-1",
        toLabel: "Camp one",
        kind: "road",
        distanceKm: 42,
        durationMinutes: 50,
        bufferedDurationMinutes: 68,
        provider: "openrouteservice_driving_car",
        fetchedAt: new Date().toISOString(),
        confidence: "live",
        date: "2026-04-03",
        geometry: {
          type: "LineString",
          coordinates: [
            { lat: 56, lng: -4 },
            { lat: 56.12, lng: -4.03 },
            { lat: 56.2, lng: -4.1 },
          ],
        },
      },
    ]);

    expect(mapData.segments.find((segment) => segment.id === "road-stay-1")).toMatchObject({
      routeStatus: "live",
      routeConfidence: "live",
      geometry: {
        type: "LineString",
        coordinates: [
          { lat: 56, lng: -4 },
          { lat: 56.12, lng: -4.03 },
          { lat: 56.2, lng: -4.1 },
        ],
      },
    });
  });

  it("builds a stable travel-leg signature from ordered route requests", () => {
    const trip = buildTrip();
    const requests = buildTravelEstimateRequests(trip);
    const updatedTrip: Trip = {
      ...trip,
      stops: trip.stops.map((stop) =>
        stop.id === "stay-1"
          ? {
              ...stop,
              notes: "Updated notes only",
            }
          : stop,
      ),
    };

    expect(buildTravelLegSignature(requests)).toBe(
      buildTravelLegSignature(buildTravelEstimateRequests(updatedTrip)),
    );
  });

  it("changes the travel-leg signature when routing coordinates change", () => {
    const trip = buildTrip();
    const requests = buildTravelEstimateRequests(trip);
    const updatedTrip: Trip = {
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

    expect(buildTravelLegSignature(requests)).not.toBe(
      buildTravelLegSignature(buildTravelEstimateRequests(updatedTrip)),
    );
  });

  it("produces ferry check-in and drive-day validation warnings", () => {
    const trip = buildTrip();
    const estimates: TravelLegEstimate[] = [
      {
        id: "road-home-stay-1",
        fromId: "home",
        fromLabel: "Home",
        toId: "stay-1",
        toLabel: "Camp one",
        kind: "road",
        distanceKm: 120,
        durationMinutes: 190,
        bufferedDurationMinutes: 230,
        provider: "fallback_haversine",
        fetchedAt: new Date().toISOString(),
        confidence: "fallback",
        date: "2026-04-03",
        relatedStopId: "stay-1",
      },
      {
        id: "road-stay-1-ferry-1",
        fromId: "stay-1",
        fromLabel: "Camp one",
        toId: "ferry-1",
        toLabel: "Morning ferry departure",
        kind: "road",
        distanceKm: 75,
        durationMinutes: 70,
        bufferedDurationMinutes: 95,
        provider: "fallback_haversine",
        fetchedAt: new Date().toISOString(),
        confidence: "fallback",
        date: "2026-04-04",
        relatedStopId: "ferry-1",
      },
      {
        id: "road-ferry-1-stay-2",
        fromId: "ferry-1",
        fromLabel: "Morning ferry",
        toId: "stay-2",
        toLabel: "Camp two",
        kind: "road",
        distanceKm: 150,
        durationMinutes: 180,
        bufferedDurationMinutes: 250,
        provider: "fallback_haversine",
        fetchedAt: new Date().toISOString(),
        confidence: "fallback",
        date: "2026-04-04",
        relatedStopId: "stay-2",
      },
    ];

    const warnings = getValidationWarnings(trip, estimates);

    expect(warnings.some((warning) => warning.kind === "ferry_check_in")).toBe(true);
    expect(warnings.some((warning) => warning.kind === "drive_day")).toBe(true);
    expect(warnings.some((warning) => warning.kind === "travel_feasibility")).toBe(true);
    expect(warnings.some((warning) => warning.kind === "route_confidence")).toBe(true);
  });

  it("adds a low-severity route confidence warning for fallback-only days", () => {
    const trip = buildTrip();
    const estimates: TravelLegEstimate[] = [
      {
        id: "road-home-stay-1",
        fromId: "home",
        fromLabel: "Home",
        toId: "stay-1",
        toLabel: "Camp one",
        kind: "road",
        distanceKm: 40,
        durationMinutes: 35,
        bufferedDurationMinutes: 50,
        provider: "fallback_haversine",
        fetchedAt: new Date().toISOString(),
        confidence: "fallback",
        date: "2026-04-03",
        relatedStopId: "stay-1",
      },
    ];

    const warnings = getValidationWarnings(trip, estimates);
    const routeConfidenceWarning = warnings.find(
      (warning) => warning.kind === "route_confidence",
    );

    expect(routeConfidenceWarning).toMatchObject({
      severity: "low",
      date: "2026-04-03",
    });
  });

  it("builds day-first itinerary rows with travel estimates and active base coverage", () => {
    const trip = buildTrip();
    const estimates: TravelLegEstimate[] = [
      {
        id: "road-home-stay-1",
        fromId: "home",
        fromLabel: "Home: Home",
        toId: "stay-1",
        toLabel: "Camp one",
        kind: "road",
        distanceKm: 42,
        durationMinutes: 50,
        bufferedDurationMinutes: 68,
        provider: "openrouteservice_driving_car",
        fetchedAt: new Date().toISOString(),
        confidence: "live",
        date: "2026-04-03",
        relatedStopId: "stay-1",
      },
      {
        id: "road-stay-1-ferry-1",
        fromId: "stay-1",
        fromLabel: "Camp one",
        toId: "ferry-1",
        toLabel: "Morning ferry departure",
        kind: "road",
        distanceKm: 75,
        durationMinutes: 70,
        bufferedDurationMinutes: 95,
        provider: "fallback_haversine",
        fetchedAt: new Date().toISOString(),
        confidence: "fallback",
        date: "2026-04-04",
        relatedStopId: "ferry-1",
      },
    ];

    const days = getItineraryDays(trip, estimates);

    expect(days[0]).toMatchObject({
      date: "2026-04-03",
      stopCount: 1,
      roadLegCount: 1,
      liveRoadLegCount: 1,
      bufferedDriveMinutes: 68,
      activeStay: {
        id: "stay-1",
      },
    });
    expect(days[0]?.rows.map((row) => row.kind)).toEqual(["travel", "stop"]);
    expect(days[1]).toMatchObject({
      date: "2026-04-04",
      stopCount: 2,
      roadLegCount: 2,
      fallbackRoadLegCount: 1,
      pendingRoadLegCount: 1,
      activeStay: {
        id: "stay-2",
      },
    });
  });

  it("builds itinerary days for a trip with only a ferry stop", () => {
    const trip = buildTrip();
    trip.stops = [
      {
        id: "ferry-only",
        order: 0,
        type: "ferry",
        title: "Uig to Lochmaddy",
        departurePort: {
          label: "Uig",
          coordinates: { lat: 57.586, lng: -6.36 },
        },
        arrivalPort: {
          label: "Lochmaddy",
          coordinates: { lat: 57.598, lng: -7.16 },
        },
        departureAt: toIsoFromLocalInput("2026-04-11T13:30"),
        arrivalAt: toIsoFromLocalInput("2026-04-11T15:00"),
        checkInBy: toIsoFromLocalInput("2026-04-11T12:45"),
        checkInBufferMinutes: 45,
      },
    ];

    const days = getItineraryDays(trip);

    expect(days).toHaveLength(1);
    expect(days[0]).toMatchObject({
      date: "2026-04-11",
      stopCount: 1,
      roadLegCount: 1,
      pendingRoadLegCount: 1,
      activeStay: null,
    });
    expect(days[0]?.rows.map((row) => row.kind)).toEqual(["travel", "stop"]);
  });

  it("returns selected stop details with the related travel estimate", () => {
    const trip = buildTrip();
    const estimates: TravelLegEstimate[] = [
      {
        id: "road-stay-1-ferry-1",
        fromId: "stay-1",
        fromLabel: "Camp one",
        toId: "ferry-1",
        toLabel: "Morning ferry departure",
        kind: "road",
        distanceKm: 75,
        durationMinutes: 70,
        bufferedDurationMinutes: 95,
        provider: "fallback_haversine",
        fetchedAt: new Date().toISOString(),
        confidence: "fallback",
        date: "2026-04-04",
        relatedStopId: "ferry-1",
      },
    ];

    const details = getSelectedEntityDetails(trip, { kind: "ferry", stopId: "ferry-1" }, estimates);

    expect(details).toMatchObject({
      primaryDate: "2026-04-04",
      stop: {
        id: "ferry-1",
      },
      travelEstimate: {
        id: "road-stay-1-ferry-1",
        confidence: "fallback",
      },
    });
  });

  it("reorders stops by id and normalizes the resulting order", () => {
    const trip = buildTrip();

    const reordered = reorderStopsById(trip.stops, "stay-2", "stay-1");

    expect(reordered.map((stop) => `${stop.id}:${stop.order}`)).toEqual([
      "stay-2:0",
      "stay-1:1",
      "ferry-1:2",
    ]);
  });

  it("moves stops up and down by offset for mobile reorder controls", () => {
    const trip = buildTrip();

    const movedUp = moveStopByOffset(trip.stops, "stay-2", -1);
    const movedDown = moveStopByOffset(movedUp, "stay-1", 1);

    expect(movedUp.map((stop) => stop.id)).toEqual(["stay-1", "stay-2", "ferry-1"]);
    expect(movedDown.map((stop) => stop.id)).toEqual(["stay-2", "stay-1", "ferry-1"]);
  });
});
