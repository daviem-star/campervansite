import { NextRequest, NextResponse } from "next/server";

import { getAuthenticatedRequest } from "@/lib/apiAuth";
import {
  getE2ETripPreferences,
  loadE2ETrip,
  saveE2ETripPreferences,
} from "@/lib/e2eTripStore";
import {
  USER_TRIP_PREFERENCES_TABLE,
  rowToTripPreferences,
  UserTripPreferencesRow,
} from "@/lib/tripPreferences";
import { TRIP_DOCUMENTS_TABLE } from "@/lib/tripDocuments";
import { createServerSupabaseServiceClient, isSupabaseServerConfigured } from "@/lib/supabase";
import { TripPreferences } from "@/types/trip";

type SaveTripPreferencesBody = Partial<TripPreferences> | null;

export const dynamic = "force-dynamic";
export const revalidate = 0;

const isValidTodayTripId = (value: unknown): value is string | null => {
  return value === null || typeof value === "string";
};

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
};

const isMissingTripPreferencesTableError = (error: unknown): boolean => {
  if (!isRecord(error)) {
    return false;
  }

  const code = typeof error.code === "string" ? error.code : "";
  const message = typeof error.message === "string" ? error.message : "";

  return (
    code === "PGRST205" ||
    message.includes("public.user_trip_preferences") ||
    message.includes("user_trip_preferences")
  );
};

const missingTripPreferencesResponse = () =>
  NextResponse.json(
    {
      error:
        "Today trip preferences are not available until the latest Supabase migration has been applied.",
    },
    { status: 503 },
  );

const verifyTripOwnership = async (
  ownerUserId: string,
  tripId: string,
): Promise<boolean> => {
  const client = createServerSupabaseServiceClient();
  if (!client) {
    throw new Error("Supabase server client unavailable.");
  }

  const { data, error } = await client
    .from(TRIP_DOCUMENTS_TABLE)
    .select("trip_id")
    .eq("owner_user_id", ownerUserId)
    .eq("trip_id", tripId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return Boolean(data);
};

export async function GET(request: NextRequest) {
  if (!isSupabaseServerConfigured()) {
    return NextResponse.json(
      { error: "Supabase server environment variables are not configured." },
      { status: 503 },
    );
  }

  const authenticatedRequest = await getAuthenticatedRequest(request);
  if (!authenticatedRequest) {
    return NextResponse.json({ error: "Unauthenticated." }, { status: 401 });
  }
  const { authMode, user } = authenticatedRequest;

  if (authMode === "e2e") {
    return NextResponse.json(getE2ETripPreferences(user));
  }

  const client = createServerSupabaseServiceClient();
  if (!client) {
    return NextResponse.json({ error: "Supabase server client unavailable." }, { status: 503 });
  }

  const { data, error } = await client
    .from(USER_TRIP_PREFERENCES_TABLE)
    .select("today_trip_id")
    .eq("owner_user_id", user.id)
    .maybeSingle();

  if (error) {
    if (isMissingTripPreferencesTableError(error)) {
      return missingTripPreferencesResponse();
    }

    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(
    rowToTripPreferences(
      (data as Pick<UserTripPreferencesRow, "today_trip_id"> | null | undefined) ?? null,
    ),
  );
}

export async function PUT(request: NextRequest) {
  if (!isSupabaseServerConfigured()) {
    return NextResponse.json(
      { error: "Supabase server environment variables are not configured." },
      { status: 503 },
    );
  }

  const authenticatedRequest = await getAuthenticatedRequest(request);
  if (!authenticatedRequest) {
    return NextResponse.json({ error: "Unauthenticated." }, { status: 401 });
  }
  const { authMode, user } = authenticatedRequest;

  const body = (await request.json().catch(() => null)) as SaveTripPreferencesBody;
  const todayTripId = isRecord(body) ? (body.todayTripId ?? null) : undefined;

  if (!isValidTodayTripId(todayTripId)) {
    return NextResponse.json(
      { error: "Today trip id must be a string or null." },
      { status: 400 },
    );
  }

  if (todayTripId) {
    if (authMode === "e2e") {
      if (!loadE2ETrip(user, todayTripId)) {
        return NextResponse.json({ error: "Today trip not found." }, { status: 400 });
      }
    } else {
      try {
        const isOwnedByUser = await verifyTripOwnership(user.id, todayTripId);
        if (!isOwnedByUser) {
          return NextResponse.json({ error: "Today trip not found." }, { status: 400 });
        }
      } catch (error) {
        return NextResponse.json(
          {
            error:
              error instanceof Error
                ? error.message
                : "Unable to verify the selected Today trip.",
          },
          { status: 500 },
        );
      }
    }
  }

  if (authMode === "e2e") {
    return NextResponse.json(saveE2ETripPreferences(user, { todayTripId }));
  }

  const client = createServerSupabaseServiceClient();
  if (!client) {
    return NextResponse.json({ error: "Supabase server client unavailable." }, { status: 503 });
  }

  const { data, error } = await client
    .from(USER_TRIP_PREFERENCES_TABLE)
    .upsert({
      owner_user_id: user.id,
      today_trip_id: todayTripId,
      updated_at: new Date().toISOString(),
    })
    .select("today_trip_id")
    .single();

  if (error || !data) {
    if (isMissingTripPreferencesTableError(error)) {
      return missingTripPreferencesResponse();
    }

    return NextResponse.json(
      { error: error?.message ?? "Unable to save Today trip preference." },
      { status: 500 },
    );
  }

  return NextResponse.json(
    rowToTripPreferences(data as Pick<UserTripPreferencesRow, "today_trip_id">),
  );
}
