import { nowIso } from "@/lib/date";
import { normalizeTrip } from "@/lib/tripData";
import { Trip, TripSummary } from "@/types/trip";

export const TRIP_DOCUMENTS_TABLE = "trip_documents";

export type TripDocumentRow = {
  owner_user_id: string;
  trip_id: string;
  trip_name: string;
  version: number;
  trip_data: Trip;
  created_at: string;
  updated_at: string;
  last_synced_at: string | null;
};

export const buildStoredTrip = (
  trip: Trip,
  ownerUserId: string,
  version: number,
  syncedAt: string = nowIso(),
): Trip => {
  return normalizeTrip(
    {
      ...trip,
      id: trip.id,
      ownerUserId,
      version,
      updatedAt: syncedAt,
      lastSyncedAt: syncedAt,
    },
    ownerUserId,
  );
};

export const toTripDocumentRow = (
  trip: Trip,
  ownerUserId: string,
  version: number,
  existingCreatedAt?: string,
): TripDocumentRow => {
  const syncedAt = nowIso();
  const storedTrip = buildStoredTrip(trip, ownerUserId, version, syncedAt);

  return {
    owner_user_id: ownerUserId,
    trip_id: storedTrip.id,
    trip_name: storedTrip.name,
    version,
    trip_data: storedTrip,
    created_at: existingCreatedAt ?? storedTrip.createdAt,
    updated_at: syncedAt,
    last_synced_at: syncedAt,
  };
};

export const rowToTrip = (row: TripDocumentRow): Trip => {
  return normalizeTrip(
    {
      ...row.trip_data,
      id: row.trip_id,
      name: row.trip_name,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      lastSyncedAt: row.last_synced_at,
      version: row.version,
      ownerUserId: row.owner_user_id,
    },
    row.owner_user_id,
  );
};

export const rowToTripSummary = (row: Pick<TripDocumentRow, "trip_id" | "trip_name" | "version" | "updated_at" | "last_synced_at">): TripSummary => ({
  id: row.trip_id,
  name: row.trip_name,
  version: row.version,
  updatedAt: row.updated_at,
  lastSyncedAt: row.last_synced_at,
});

export const tripToTripSummary = (
  trip: Pick<Trip, "id" | "name" | "version" | "updatedAt" | "lastSyncedAt">,
): TripSummary => ({
  id: trip.id,
  name: trip.name,
  version: trip.version,
  updatedAt: trip.updatedAt,
  lastSyncedAt: trip.lastSyncedAt,
});
