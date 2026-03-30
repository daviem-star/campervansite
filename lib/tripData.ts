import { APP_TIMEZONE, nowIso } from "@/lib/date";
import {
  AppData,
  FerryStop,
  LegacyAppData,
  LegacyTrip,
  Trip,
  TripStop,
} from "@/types/trip";

export const APP_DATA_SCHEMA_VERSION = 2;

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
};

const ensureStopOrder = (stops: TripStop[]): TripStop[] => {
  return [...stops]
    .sort((a, b) => a.order - b.order)
    .map((stop, index) => ({
      ...stop,
      order: index,
    }));
};

export const getDefaultFerryCheckInBufferMinutes = (ferry: Pick<FerryStop, "departureAt" | "checkInBy">): number => {
  const departureMillis = new Date(ferry.departureAt).getTime();
  const checkInMillis = new Date(ferry.checkInBy).getTime();

  if (!Number.isFinite(departureMillis) || !Number.isFinite(checkInMillis)) {
    return 45;
  }

  const minutes = Math.round((departureMillis - checkInMillis) / 60_000);
  if (minutes <= 0) {
    return 45;
  }

  return minutes;
};

export const normalizeTrip = (
  trip: LegacyTrip,
  ownerUserId: string | null = trip.ownerUserId ?? null,
): Trip => {
  const normalizedStops = ensureStopOrder(
    trip.stops.map((stop) => {
      if (stop.type === "stay") {
        return {
          ...stop,
          bookingStatus: stop.bookingStatus ?? "planned",
          hookup: stop.hookup ?? false,
          hardstanding: stop.hardstanding ?? false,
          amenitiesSummary: stop.amenitiesSummary ?? "",
          phone: stop.phone ?? "",
          websiteUrl: stop.websiteUrl ?? "",
        };
      }

      if (stop.type === "ferry") {
        return {
          ...stop,
          checkInBufferMinutes: stop.checkInBufferMinutes ?? getDefaultFerryCheckInBufferMinutes(stop),
          vehicleDetails: stop.vehicleDetails
            ? {
                vehicleType: stop.vehicleDetails.vehicleType ?? "campervan",
                registration: stop.vehicleDetails.registration ?? "",
                lengthMeters: stop.vehicleDetails.lengthMeters,
                notes: stop.vehicleDetails.notes ?? "",
              }
            : undefined,
        };
      }

      return stop;
    }),
  );

  return {
    ...trip,
    timezone: APP_TIMEZONE,
    ownerUserId,
    version: typeof trip.version === "number" && Number.isFinite(trip.version) ? trip.version : 1,
    createdAt: trip.createdAt ?? nowIso(),
    updatedAt: trip.updatedAt ?? nowIso(),
    lastSyncedAt: trip.lastSyncedAt ?? null,
    stops: normalizedStops,
  };
};

export const normalizeAppData = (
  value: unknown,
  ownerUserId: string | null = null,
): AppData | null => {
  if (!isRecord(value)) {
    return null;
  }

  const activeTripId = typeof value.activeTripId === "string" ? value.activeTripId : "";
  const rawTrips = Array.isArray(value.trips) ? value.trips : [];

  if (!activeTripId || rawTrips.length === 0) {
    return null;
  }

  const trips = rawTrips
    .filter((trip): trip is LegacyTrip => isRecord(trip) && typeof trip.id === "string")
    .map((trip) => normalizeTrip(trip, ownerUserId));

  if (trips.length === 0) {
    return null;
  }

  const resolvedActiveTripId = trips.some((trip) => trip.id === activeTripId)
    ? activeTripId
    : trips[0].id;

  return {
    schemaVersion: APP_DATA_SCHEMA_VERSION,
    activeTripId: resolvedActiveTripId,
    trips,
  };
};

export const migrateLegacyAppData = (
  value: unknown,
  ownerUserId: string | null = null,
): AppData | null => {
  return normalizeAppData(value, ownerUserId);
};

export const serializeAppData = (data: AppData): string => JSON.stringify(data);

export const parseStoredAppData = (
  raw: string | null,
  ownerUserId: string | null = null,
): AppData | null => {
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as AppData | LegacyAppData;
    return migrateLegacyAppData(parsed, ownerUserId);
  } catch {
    return null;
  }
};
