import { TripPreferences } from "@/types/trip";

export const USER_TRIP_PREFERENCES_TABLE = "user_trip_preferences";

export type UserTripPreferencesRow = {
  owner_user_id: string;
  today_trip_id: string | null;
  updated_at: string;
};

export const rowToTripPreferences = (
  row: Pick<UserTripPreferencesRow, "today_trip_id"> | null | undefined,
): TripPreferences => ({
  todayTripId: row?.today_trip_id ?? null,
});
