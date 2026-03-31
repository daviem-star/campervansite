import { getSeedData, getSeedDataShiftedToTodayAlignedTo } from "@/lib/seedData";
import { readCachedActiveTrip, writeCachedActiveTrip } from "@/lib/offlineCache";
import { parseStoredAppData, serializeAppData } from "@/lib/tripData";
import {
  AppData,
  CreateTripInput,
  DeleteTripResponse,
  RenameTripInput,
  SessionUser,
  Trip,
  TripSummary,
} from "@/types/trip";

const LEGACY_STORAGE_KEY = "campervan_trip_planner_v1";
const ACTIVE_TRIP_PREFERENCE_PREFIX = "campervan_trip_planner_active_trip";
const FIRST_TRIP_SETUP_PREFIX = "campervan_trip_planner_first_trip_setup";

export interface TripRepository {
  listTrips(): Promise<TripSummary[]>;
  loadTrip(tripId: string): Promise<Trip>;
  saveTrip(trip: Trip): Promise<Trip>;
  createTrip(input: CreateTripInput): Promise<Trip>;
  renameTrip(tripId: string, input: RenameTripInput): Promise<TripSummary>;
  deleteTrip(tripId: string): Promise<DeleteTripResponse>;
  importLocalTrips(data: AppData): Promise<TripSummary[]>;
  getCachedActiveTrip(): Promise<Trip | null>;
}

export class TripConflictError extends Error {
  latestTrip?: Trip;

  constructor(message: string, latestTrip?: Trip) {
    super(message);
    this.name = "TripConflictError";
    this.latestTrip = latestTrip;
  }
}

const resolveActiveTripPreferenceKey = (userId: string): string =>
  `${ACTIVE_TRIP_PREFERENCE_PREFIX}:${userId}`;

const resolveFirstTripSetupKey = (userId: string): string =>
  `${FIRST_TRIP_SETUP_PREFIX}:${userId}`;

export const getPreferredActiveTripId = (userId: string): string | null => {
  if (typeof window === "undefined") {
    return null;
  }

  return window.localStorage.getItem(resolveActiveTripPreferenceKey(userId));
};

export const setPreferredActiveTripId = (userId: string, tripId: string): void => {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(resolveActiveTripPreferenceKey(userId), tripId);
};

export const hasResolvedFirstTripSetup = (userId: string): boolean => {
  if (typeof window === "undefined") {
    return false;
  }

  return window.localStorage.getItem(resolveFirstTripSetupKey(userId)) === "1";
};

export const markFirstTripSetupResolved = (userId: string): void => {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(resolveFirstTripSetupKey(userId), "1");
};

export class LegacyLocalStorageTripRepository {
  async load(): Promise<AppData> {
    if (typeof window === "undefined") {
      return getSeedData();
    }

    const migrated = parseStoredAppData(window.localStorage.getItem(LEGACY_STORAGE_KEY));
    if (!migrated) {
      const seed = getSeedData();
      await this.save(seed);
      return seed;
    }

    await this.save(migrated);
    return migrated;
  }

  async save(data: AppData): Promise<void> {
    if (typeof window === "undefined") {
      return;
    }

    window.localStorage.setItem(LEGACY_STORAGE_KEY, serializeAppData(data));
  }

  async resetToSeed(): Promise<AppData> {
    const seed = getSeedData();
    await this.save(seed);
    return seed;
  }

  async resetToSeedAlignedToToday(): Promise<AppData> {
    const shifted = getSeedDataShiftedToTodayAlignedTo("2026-08-08");
    await this.save(shifted);
    return shifted;
  }

  loadImportedCandidate(): AppData | null {
    if (typeof window === "undefined") {
      return null;
    }

    return parseStoredAppData(window.localStorage.getItem(LEGACY_STORAGE_KEY));
  }

  hasLegacyImportCandidate(): boolean {
    return Boolean(this.loadImportedCandidate());
  }
}

export const createDemoAppDataFromTrip = (trip: Trip): AppData => ({
  schemaVersion: 2,
  activeTripId: trip.id,
  trips: [trip],
});

export class CloudTripRepository implements TripRepository {
  constructor(private readonly getAccessToken: () => Promise<string | null>) {}

  private async request<T>(path: string, init?: RequestInit): Promise<T> {
    const token = await this.getAccessToken();
    if (!token) {
      throw new Error("You need to sign in before using cloud sync.");
    }

    const response = await fetch(path, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        ...(init?.headers ?? {}),
      },
    });

    const payload = (await response.json().catch(() => null)) as
      | {
          error?: string;
          latestTrip?: Trip;
        }
      | null;

    if (response.status === 409) {
      throw new TripConflictError(
        payload?.error ?? "Trip changed on another device.",
        payload?.latestTrip,
      );
    }

    if (!response.ok) {
      throw new Error(payload?.error ?? "Cloud trip request failed.");
    }

    return payload as T;
  }

  async listTrips(): Promise<TripSummary[]> {
    const payload = await this.request<{ trips: TripSummary[] }>("/api/trips");
    return payload.trips;
  }

  async loadTrip(tripId: string): Promise<Trip> {
    const payload = await this.request<{ trip: Trip }>(`/api/trips/${tripId}`);
    await writeCachedActiveTrip(payload.trip);
    return payload.trip;
  }

  async saveTrip(trip: Trip): Promise<Trip> {
    const payload = await this.request<{ trip: Trip }>(`/api/trips/${trip.id}`, {
      method: "PUT",
      body: JSON.stringify({
        trip,
        expectedVersion: trip.version,
      }),
    });
    await writeCachedActiveTrip(payload.trip);
    return payload.trip;
  }

  async createTrip(input: CreateTripInput): Promise<Trip> {
    const payload = await this.request<{ trip: Trip }>("/api/trips", {
      method: "POST",
      body: JSON.stringify(input),
    });
    await writeCachedActiveTrip(payload.trip);
    return payload.trip;
  }

  async renameTrip(tripId: string, input: RenameTripInput): Promise<TripSummary> {
    const payload = await this.request<{ trip: TripSummary }>(`/api/trips/${tripId}`, {
      method: "PATCH",
      body: JSON.stringify(input),
    });
    return payload.trip;
  }

  async deleteTrip(tripId: string): Promise<DeleteTripResponse> {
    return await this.request<DeleteTripResponse>(`/api/trips/${tripId}`, {
      method: "DELETE",
    });
  }

  async importLocalTrips(data: AppData): Promise<TripSummary[]> {
    const payload = await this.request<{ trips: TripSummary[] }>("/api/trips/import", {
      method: "POST",
      body: JSON.stringify({
        data,
      }),
    });
    return payload.trips;
  }

  async getCachedActiveTrip(): Promise<Trip | null> {
    return await readCachedActiveTrip();
  }
}

export const readLegacyLocalTrips = (): AppData | null => {
  if (typeof window === "undefined") {
    return null;
  }

  return parseStoredAppData(window.localStorage.getItem(LEGACY_STORAGE_KEY));
};

export const hasLegacyLocalTripData = (): boolean => {
  return Boolean(readLegacyLocalTrips());
};

export const pickInitialCloudTripId = (trips: TripSummary[], user: SessionUser): string | null => {
  const preferred = getPreferredActiveTripId(user.id);
  if (preferred && trips.some((trip) => trip.id === preferred)) {
    return preferred;
  }

  return trips[0]?.id ?? null;
};
