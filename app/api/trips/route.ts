import { NextRequest, NextResponse } from "next/server";

import { listE2ETrips } from "@/lib/e2eTripStore";
import { getAuthenticatedUser } from "@/lib/apiAuth";
import { isServerE2EAuthBypassEnabled } from "@/lib/e2eAuth";
import { rowToTripSummary, TRIP_DOCUMENTS_TABLE, TripDocumentRow } from "@/lib/tripDocuments";
import { createServerSupabaseServiceClient, isSupabaseServerConfigured } from "@/lib/supabase";

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
