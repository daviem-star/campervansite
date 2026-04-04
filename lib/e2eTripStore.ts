import { getSeedData } from "@/lib/seedData";
import { normalizeAppData, normalizeTrip } from "@/lib/tripData";
import {
  rowToTrip,
  rowToTripSummary,
  toTripDocumentRow,
  TripDocumentRow,
} from "@/lib/tripDocuments";
import { AppData, SessionUser, Trip, TripPreferences, TripSummary } from "@/types/trip";

type SaveTripResult =
  | {
      ok: true;
      trip: Trip;
    }
  | {
      ok: false;
      latestTrip: Trip;
    };

type E2ETripStore = Map<string, Map<string, TripDocumentRow>>;
type E2ETripPreferenceStore = Map<string, TripPreferences>;

const getStore = (): E2ETripStore => {
  const globalState = globalThis as typeof globalThis & {
    __campvervanE2ETripStore?: E2ETripStore;
  };

  if (!globalState.__campvervanE2ETripStore) {
    globalState.__campvervanE2ETripStore = new Map<string, Map<string, TripDocumentRow>>();
  }

  return globalState.__campvervanE2ETripStore;
};

const getPreferenceStore = (): E2ETripPreferenceStore => {
  const globalState = globalThis as typeof globalThis & {
    __campvervanE2ETripPreferenceStore?: E2ETripPreferenceStore;
  };

  if (!globalState.__campvervanE2ETripPreferenceStore) {
    globalState.__campvervanE2ETripPreferenceStore = new Map<string, TripPreferences>();
  }

  return globalState.__campvervanE2ETripPreferenceStore;
};

const readStoredTripPreferences = (user: SessionUser): TripPreferences => {
  const store = getPreferenceStore();
  return store.get(user.id) ?? { todayTripId: null };
};

const sanitizeStoredTripPreferences = (user: SessionUser) => {
  const rows = ensureUserRows(user);
  const store = getPreferenceStore();
  const existing = readStoredTripPreferences(user);

  if (existing.todayTripId && !rows.has(existing.todayTripId)) {
    store.set(user.id, { todayTripId: null });
    return;
  }

  store.set(user.id, existing);
};

const ensureUserRows = (user: SessionUser): Map<string, TripDocumentRow> => {
  const store = getStore();
  const existing = store.get(user.id);
  if (existing) {
    return existing;
  }

  const rows = new Map<string, TripDocumentRow>();
  const seedTrip = getSeedData().trips[0];
  const row = toTripDocumentRow(
    {
      ...seedTrip,
      name: `${seedTrip.name} (${user.email ?? "Test"})`,
      ownerUserId: user.id,
    },
    user.id,
    1,
  );
  rows.set(row.trip_id, row);
  store.set(user.id, rows);
  return rows;
};

export const listE2ETrips = (user: SessionUser): TripSummary[] => {
  sanitizeStoredTripPreferences(user);
  const rows = ensureUserRows(user);
  return Array.from(rows.values())
    .sort((left, right) => right.updated_at.localeCompare(left.updated_at))
    .map(rowToTripSummary);
};

export const loadE2ETrip = (user: SessionUser, tripId: string): Trip | null => {
  sanitizeStoredTripPreferences(user);
  const rows = ensureUserRows(user);
  const row = rows.get(tripId);
  return row ? rowToTrip(row) : null;
};

export const getE2ETripPreferences = (user: SessionUser): TripPreferences => {
  sanitizeStoredTripPreferences(user);
  return readStoredTripPreferences(user);
};

export const saveE2ETripPreferences = (
  user: SessionUser,
  preferences: TripPreferences,
): TripPreferences => {
  const nextPreferences: TripPreferences = {
    todayTripId: preferences.todayTripId ?? null,
  };
  getPreferenceStore().set(user.id, nextPreferences);
  return nextPreferences;
};

export const saveE2ETrip = (
  user: SessionUser,
  trip: Trip,
  expectedVersion: number,
): SaveTripResult => {
  const rows = ensureUserRows(user);
  const existing = rows.get(trip.id);

  if (existing && existing.version !== expectedVersion) {
    return {
      ok: false,
      latestTrip: rowToTrip(existing),
    };
  }

  const nextVersion = existing ? existing.version + 1 : 1;
  const row = toTripDocumentRow(normalizeTrip(trip, user.id), user.id, nextVersion, existing?.created_at);
  rows.set(row.trip_id, row);

  return {
    ok: true,
    trip: rowToTrip(row),
  };
};

export const createE2ETrip = (user: SessionUser, trip: Trip): Trip => {
  const rows = ensureUserRows(user);
  const row = toTripDocumentRow(normalizeTrip(trip, user.id), user.id, 1);
  rows.set(row.trip_id, row);
  return rowToTrip(row);
};

export const renameE2ETrip = (
  user: SessionUser,
  tripId: string,
  name: string,
): TripSummary | null => {
  const rows = ensureUserRows(user);
  const existing = rows.get(tripId);

  if (!existing) {
    return null;
  }

  const nextVersion = existing.version + 1;
  const nextTrip = rowToTrip(existing);
  const row = toTripDocumentRow(
    {
      ...nextTrip,
      name,
      updatedAt: existing.updated_at,
      lastSyncedAt: existing.last_synced_at,
      version: nextVersion,
    },
    user.id,
    nextVersion,
    existing.created_at,
  );
  rows.set(row.trip_id, row);
  return rowToTripSummary(row);
};

export const deleteE2ETrip = (
  user: SessionUser,
  tripId: string,
): {
  ok: boolean;
  error?: string;
} => {
  const rows = ensureUserRows(user);

  if (!rows.has(tripId)) {
    return {
      ok: false,
      error: "Trip not found.",
    };
  }

  if (rows.size <= 1) {
    return {
      ok: false,
      error: "Create another trip before deleting this one.",
    };
  }

  rows.delete(tripId);
  sanitizeStoredTripPreferences(user);
  return { ok: true };
};

const getUniqueImportedTripId = (baseId: string, rows: Map<string, TripDocumentRow>): string => {
  if (!rows.has(baseId)) {
    return baseId;
  }

  let suffix = 1;
  let candidate = `${baseId}-imported-${suffix}`;
  while (rows.has(candidate)) {
    suffix += 1;
    candidate = `${baseId}-imported-${suffix}`;
  }

  return candidate;
};

export const importE2ETrips = (user: SessionUser, data: unknown): TripSummary[] => {
  const normalized = normalizeAppData(data, user.id);
  if (!normalized) {
    return [];
  }

  const rows = ensureUserRows(user);
  const importedRows: TripDocumentRow[] = [];
  normalized.trips.forEach((trip) => {
    const tripId = getUniqueImportedTripId(trip.id, rows);
    const row = toTripDocumentRow(
      {
        ...trip,
        id: tripId,
        name: tripId === trip.id ? trip.name : `${trip.name} (Import)`,
      },
      user.id,
      1,
    );
    rows.set(row.trip_id, row);
    importedRows.push(row);
  });

  return importedRows
    .sort((left, right) => right.updated_at.localeCompare(left.updated_at))
    .map(rowToTripSummary);
};

export const seedE2ETrips = (user: SessionUser, data: AppData): TripSummary[] => {
  const rows = ensureUserRows(user);
  rows.clear();

  const normalized = normalizeAppData(data, user.id);
  if (!normalized) {
    return [];
  }

  normalized.trips.forEach((trip) => {
    const row = toTripDocumentRow(trip, user.id, trip.version || 1);
    rows.set(row.trip_id, row);
  });

  sanitizeStoredTripPreferences(user);

  return Array.from(rows.values()).map(rowToTripSummary);
};

export const replaceE2ETrips = (user: SessionUser, data: AppData | null): TripSummary[] => {
  const store = getStore();
  const rows = new Map<string, TripDocumentRow>();

  if (data) {
    const normalized = normalizeAppData(data, user.id);
    if (normalized) {
      normalized.trips.forEach((trip) => {
        const row = toTripDocumentRow(trip, user.id, trip.version || 1);
        rows.set(row.trip_id, row);
      });
    }
  }

  store.set(user.id, rows);
  sanitizeStoredTripPreferences(user);
  return Array.from(rows.values()).map(rowToTripSummary);
};
