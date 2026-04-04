import { describe, expect, it } from "vitest";

import { toIsoFromLocalInput } from "@/lib/date";
import {
  APP_DATA_SCHEMA_VERSION,
  migrateLegacyAppData,
  parseStoredAppData,
  serializeAppData,
} from "@/lib/tripData";

describe("tripData migration", () => {
  it("upgrades legacy app data to the current schema and fills new stop defaults", () => {
    const migrated = migrateLegacyAppData({
      schemaVersion: 1,
      activeTripId: "trip-1",
      trips: [
        {
          id: "trip-1",
          name: "Legacy trip",
          timezone: "Europe/London",
          home: {
            label: "Home",
            coordinates: { lat: 56, lng: -4 },
            routingCoordinates: { lat: 56.01, lng: -3.99 },
          },
          createdAt: toIsoFromLocalInput("2026-03-01T09:00"),
          updatedAt: toIsoFromLocalInput("2026-03-01T09:00"),
          stops: [
            {
              id: "stay-1",
              order: 0,
              type: "stay",
              title: "First stay",
              place: {
                label: "Stay",
                coordinates: { lat: 56.2, lng: -4.1 },
                routingCoordinates: { lat: 56.21, lng: -4.09 },
              },
              checkInAt: toIsoFromLocalInput("2026-03-03T16:00"),
              checkOutAt: toIsoFromLocalInput("2026-03-04T11:00"),
            },
            {
              id: "ferry-1",
              order: 1,
              type: "ferry",
              title: "Main sailing",
              departurePort: {
                label: "Departure",
                coordinates: { lat: 56.3, lng: -4.2 },
                routingCoordinates: { lat: 56.3004, lng: -4.1996 },
              },
              arrivalPort: {
                label: "Arrival",
                coordinates: { lat: 56.5, lng: -4.4 },
                routingCoordinates: { lat: 56.5004, lng: -4.3996 },
              },
              departureAt: toIsoFromLocalInput("2026-03-04T13:00"),
              arrivalAt: toIsoFromLocalInput("2026-03-04T15:00"),
              checkInBy: toIsoFromLocalInput("2026-03-04T12:15"),
            },
          ],
        },
      ],
    });

    expect(migrated).not.toBeNull();
    expect(migrated?.schemaVersion).toBe(APP_DATA_SCHEMA_VERSION);
    expect(migrated?.trips[0].ownerUserId).toBeNull();
    expect(migrated?.trips[0].version).toBe(1);
    expect(migrated?.trips[0].lastSyncedAt).toBeNull();
    expect(migrated?.trips[0].routeSnapshot).toBeNull();
    expect(migrated?.trips[0].home.routingCoordinates).toEqual({ lat: 56.01, lng: -3.99 });
    expect(migrated?.trips[0].stops[0]).toMatchObject({
      place: {
        routingCoordinates: { lat: 56.21, lng: -4.09 },
      },
      bookingStatus: "planned",
      hookup: false,
      hardstanding: false,
      amenitiesSummary: "",
    });
    expect(migrated?.trips[0].stops[1]).toMatchObject({
      departurePort: {
        routingCoordinates: { lat: 56.3004, lng: -4.1996 },
      },
      arrivalPort: {
        routingCoordinates: { lat: 56.5004, lng: -4.3996 },
      },
      checkInBufferMinutes: 45,
    });
  });

  it("round-trips serialized app data through the storage parser", () => {
    const migrated = migrateLegacyAppData({
      schemaVersion: 1,
      activeTripId: "trip-1",
      trips: [
        {
          id: "trip-1",
          name: "Trip",
          timezone: "Europe/London",
          home: {
            label: "Home",
            coordinates: { lat: 56, lng: -4 },
          },
          createdAt: toIsoFromLocalInput("2026-03-01T09:00"),
          updatedAt: toIsoFromLocalInput("2026-03-01T09:00"),
          stops: [],
        },
      ],
    });

    expect(migrated).not.toBeNull();
    migrated!.trips[0].routeSnapshot = {
      signature: "road-home-stop-1",
      fetchedAt: "2026-03-01T11:30:00.000Z",
      estimates: [
        {
          id: "road-home-stop-1",
          fromId: "home",
          fromLabel: "Home",
          toId: "stop-1",
          toLabel: "Trip",
          kind: "road",
          distanceKm: 48.2,
          durationMinutes: 62,
          bufferedDurationMinutes: 81,
          provider: "fallback_haversine",
          fetchedAt: "2026-03-01T11:30:00.000Z",
          confidence: "fallback",
          date: "2026-03-02",
        },
      ],
    };
    const parsed = parseStoredAppData(serializeAppData(migrated!));

    expect(parsed).toEqual(migrated);
  });
});
