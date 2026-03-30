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
              },
              arrivalPort: {
                label: "Arrival",
                coordinates: { lat: 56.5, lng: -4.4 },
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
    expect(migrated?.trips[0].stops[0]).toMatchObject({
      bookingStatus: "planned",
      hookup: false,
      hardstanding: false,
      amenitiesSummary: "",
    });
    expect(migrated?.trips[0].stops[1]).toMatchObject({
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
    const parsed = parseStoredAppData(serializeAppData(migrated!));

    expect(parsed).toEqual(migrated);
  });
});
