import { NextRequest, NextResponse } from "next/server";

import { getAuthenticatedUser } from "@/lib/apiAuth";
import { createE2ETrip, listE2ETrips } from "@/lib/e2eTripStore";
import { isServerE2EAuthBypassEnabled } from "@/lib/e2eAuth";
import { createBlankTrip, createExampleTrip } from "@/lib/tripFactories";
import {
  rowToTrip,
  rowToTripSummary,
  toTripDocumentRow,
  TRIP_DOCUMENTS_TABLE,
  TripDocumentRow,
} from "@/lib/tripDocuments";
import { createServerSupabaseServiceClient, isSupabaseServerConfigured } from "@/lib/supabase";
import { CreateTripInput, PlaceRef } from "@/types/trip";

type CreateTripBody = CreateTripInput;

export const dynamic = "force-dynamic";
export const revalidate = 0;

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
};

const isPlaceRef = (value: unknown): value is PlaceRef => {
  if (!isRecord(value) || typeof value.label !== "string" || !isRecord(value.coordinates)) {
    return false;
  }

  return (
    typeof value.coordinates.lat === "number" &&
    Number.isFinite(value.coordinates.lat) &&
    typeof value.coordinates.lng === "number" &&
    Number.isFinite(value.coordinates.lng)
  );
};

const buildTripFromRequest = (userId: string, body: CreateTripBody | null) => {
  const source = body?.source;
  const name = body?.name?.trim() ?? "";

  if (!source || (source !== "blank" && source !== "example")) {
    throw new Error("Trip source must be blank or example.");
  }

  if (!name) {
    throw new Error("Trip name is required.");
  }

  if (source === "blank") {
    if (!isPlaceRef(body?.home)) {
      throw new Error("A valid home pin is required for blank trips.");
    }

    return createBlankTrip(userId, {
      name,
      home: body.home,
    });
  }

  return createExampleTrip(userId, name);
};

export async function GET(request: NextRequest) {
  if (!isSupabaseServerConfigured()) {
    return NextResponse.json(
      { error: "Supabase server environment variables are not configured." },
      { status: 503 },
    );
  }

  const user = await getAuthenticatedUser(request);
  if (!user) {
    return NextResponse.json({ error: "Unauthenticated." }, { status: 401 });
  }

  if (isServerE2EAuthBypassEnabled()) {
    return NextResponse.json({ trips: listE2ETrips(user) });
  }

  const client = createServerSupabaseServiceClient();
  if (!client) {
    return NextResponse.json({ error: "Supabase server client unavailable." }, { status: 503 });
  }

  const { data, error } = await client
    .from(TRIP_DOCUMENTS_TABLE)
    .select("trip_id, trip_name, version, updated_at, last_synced_at")
    .eq("owner_user_id", user.id)
    .order("updated_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const trips = ((data ?? []) as Pick<
    TripDocumentRow,
    "trip_id" | "trip_name" | "version" | "updated_at" | "last_synced_at"
  >[]).map(rowToTripSummary);

  return NextResponse.json({ trips });
}

export async function POST(request: NextRequest) {
  if (!isSupabaseServerConfigured()) {
    return NextResponse.json(
      { error: "Supabase server environment variables are not configured." },
      { status: 503 },
    );
  }

  const user = await getAuthenticatedUser(request);
  if (!user) {
    return NextResponse.json({ error: "Unauthenticated." }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as CreateTripBody | null;

  let trip;
  try {
    trip = buildTripFromRequest(user.id, body);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to create trip." },
      { status: 400 },
    );
  }

  if (isServerE2EAuthBypassEnabled()) {
    return NextResponse.json({ trip: createE2ETrip(user, trip) });
  }

  const client = createServerSupabaseServiceClient();
  if (!client) {
    return NextResponse.json({ error: "Supabase server client unavailable." }, { status: 503 });
  }

  const row = toTripDocumentRow(trip, user.id, 1);
  const { data, error } = await client.from(TRIP_DOCUMENTS_TABLE).insert(row).select("*").single();

  if (error || !data) {
    return NextResponse.json({ error: error?.message ?? "Unable to create trip." }, { status: 500 });
  }

  return NextResponse.json({ trip: rowToTrip(data as TripDocumentRow) });
}
