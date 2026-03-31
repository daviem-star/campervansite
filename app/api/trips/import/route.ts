import { NextRequest, NextResponse } from "next/server";

import { getAuthenticatedUser } from "@/lib/apiAuth";
import { importE2ETrips } from "@/lib/e2eTripStore";
import { isServerE2EAuthBypassEnabled } from "@/lib/e2eAuth";
import { normalizeAppData } from "@/lib/tripData";
import {
  rowToTripSummary,
  toTripDocumentRow,
  TRIP_DOCUMENTS_TABLE,
  TripDocumentRow,
} from "@/lib/tripDocuments";
import { createServerSupabaseServiceClient, isSupabaseServerConfigured } from "@/lib/supabase";

type ImportBody = {
  data?: unknown;
};

export const dynamic = "force-dynamic";
export const revalidate = 0;

const getUniqueImportedTripId = (baseId: string, takenIds: Set<string>): string => {
  if (!takenIds.has(baseId)) {
    takenIds.add(baseId);
    return baseId;
  }

  let suffix = 1;
  let candidate = `${baseId}-imported-${suffix}`;
  while (takenIds.has(candidate)) {
    suffix += 1;
    candidate = `${baseId}-imported-${suffix}`;
  }

  takenIds.add(candidate);
  return candidate;
};

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

  const body = (await request.json().catch(() => null)) as ImportBody | null;

  if (isServerE2EAuthBypassEnabled()) {
    const trips = importE2ETrips(user, body?.data);

    if (trips.length === 0) {
      return NextResponse.json({ error: "Valid local trip data is required for import." }, { status: 400 });
    }

    return NextResponse.json({ trips });
  }

  const client = createServerSupabaseServiceClient();
  if (!client) {
    return NextResponse.json({ error: "Supabase server client unavailable." }, { status: 503 });
  }

  const normalized = normalizeAppData(body?.data, user.id);

  if (!normalized) {
    return NextResponse.json({ error: "Valid local trip data is required for import." }, { status: 400 });
  }

  const { data: existingRows, error: existingError } = await client
    .from(TRIP_DOCUMENTS_TABLE)
    .select("trip_id")
    .eq("owner_user_id", user.id);

  if (existingError) {
    return NextResponse.json({ error: existingError.message }, { status: 500 });
  }

  const takenIds = new Set<string>((existingRows ?? []).map((row) => String(row.trip_id)));

  const rows = normalized.trips.map((trip) => {
    const importedTripId = getUniqueImportedTripId(trip.id, takenIds);
    return toTripDocumentRow(
      {
        ...trip,
        id: importedTripId,
        name: importedTripId === trip.id ? trip.name : `${trip.name} (Import)`,
      },
      user.id,
      1,
    );
  });

  const { data, error } = await client
    .from(TRIP_DOCUMENTS_TABLE)
    .insert(rows)
    .select("trip_id, trip_name, version, updated_at, last_synced_at");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const trips = ((data ?? []) as Pick<
    TripDocumentRow,
    "trip_id" | "trip_name" | "version" | "updated_at" | "last_synced_at"
  >[]).map(rowToTripSummary);

  return NextResponse.json({ trips });
}
