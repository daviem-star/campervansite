import { NextRequest, NextResponse } from "next/server";

import { getAuthenticatedUser } from "@/lib/apiAuth";
import {
  deleteE2ETrip,
  loadE2ETrip,
  renameE2ETrip,
  saveE2ETrip,
} from "@/lib/e2eTripStore";
import { isServerE2EAuthBypassEnabled } from "@/lib/e2eAuth";
import { normalizeTrip } from "@/lib/tripData";
import {
  rowToTrip,
  rowToTripSummary,
  toTripDocumentRow,
  TRIP_DOCUMENTS_TABLE,
  TripDocumentRow,
} from "@/lib/tripDocuments";
import { createServerSupabaseServiceClient, isSupabaseServerConfigured } from "@/lib/supabase";
import { RenameTripInput, Trip } from "@/types/trip";

type RouteContext = {
  params: Promise<{
    tripId: string;
  }>;
};

type SaveTripBody = {
  trip?: Trip;
  expectedVersion?: number;
};

type RenameTripBody = RenameTripInput;

export const dynamic = "force-dynamic";
export const revalidate = 0;

const loadExistingTrip = async (
  ownerUserId: string,
  tripId: string,
): Promise<TripDocumentRow | null> => {
  const client = createServerSupabaseServiceClient();
  if (!client) {
    return null;
  }

  const { data, error } = await client
    .from(TRIP_DOCUMENTS_TABLE)
    .select("*")
    .eq("owner_user_id", ownerUserId)
    .eq("trip_id", tripId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return (data as TripDocumentRow | null) ?? null;
};

export async function GET(request: NextRequest, context: RouteContext) {
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

  const { tripId } = await context.params;

  try {
    if (isServerE2EAuthBypassEnabled()) {
      const trip = loadE2ETrip(user, tripId);
      if (!trip) {
        return NextResponse.json({ error: "Trip not found." }, { status: 404 });
      }

      return NextResponse.json({ trip });
    }

    const row = await loadExistingTrip(user.id, tripId);
    if (!row) {
      return NextResponse.json({ error: "Trip not found." }, { status: 404 });
    }

    return NextResponse.json({ trip: rowToTrip(row) });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to load trip." },
      { status: 500 },
    );
  }
}

export async function PUT(request: NextRequest, context: RouteContext) {
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

  const { tripId } = await context.params;
  const body = (await request.json().catch(() => null)) as SaveTripBody | null;

  if (!body?.trip || typeof body.expectedVersion !== "number") {
    return NextResponse.json({ error: "Trip payload is required." }, { status: 400 });
  }

  if (body.trip.id !== tripId) {
    return NextResponse.json({ error: "Trip ID mismatch." }, { status: 400 });
  }

  try {
    if (isServerE2EAuthBypassEnabled()) {
      const result = saveE2ETrip(user, body.trip, body.expectedVersion);

      if (!result.ok) {
        return NextResponse.json(
          {
            error: "Trip changed on another device.",
            latestTrip: result.latestTrip,
          },
          { status: 409 },
        );
      }

      return NextResponse.json({ trip: result.trip });
    }

    const client = createServerSupabaseServiceClient();
    if (!client) {
      return NextResponse.json({ error: "Supabase server client unavailable." }, { status: 503 });
    }

    const normalizedTrip = normalizeTrip(body.trip, user.id);
    const existing = await loadExistingTrip(user.id, tripId);

    if (existing && body.expectedVersion !== existing.version) {
      return NextResponse.json(
        {
          error: "Trip changed on another device.",
          latestTrip: rowToTrip(existing),
        },
        { status: 409 },
      );
    }

    const nextVersion = existing ? existing.version + 1 : 1;
    const row = toTripDocumentRow(normalizedTrip, user.id, nextVersion, existing?.created_at);

    const { data, error } = await client
      .from(TRIP_DOCUMENTS_TABLE)
      .upsert(row)
      .select("*")
      .single();

    if (error || !data) {
      return NextResponse.json({ error: error?.message ?? "Unable to save trip." }, { status: 500 });
    }

    return NextResponse.json({ trip: rowToTrip(data as TripDocumentRow) });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to save trip." },
      { status: 500 },
    );
  }
}

export async function PATCH(request: NextRequest, context: RouteContext) {
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

  const { tripId } = await context.params;
  const body = (await request.json().catch(() => null)) as RenameTripBody | null;
  const nextName = body?.name?.trim() ?? "";

  if (!nextName) {
    return NextResponse.json({ error: "Trip name is required." }, { status: 400 });
  }

  try {
    if (isServerE2EAuthBypassEnabled()) {
      const trip = renameE2ETrip(user, tripId, nextName);
      if (!trip) {
        return NextResponse.json({ error: "Trip not found." }, { status: 404 });
      }

      return NextResponse.json({ trip });
    }

    const existing = await loadExistingTrip(user.id, tripId);
    if (!existing) {
      return NextResponse.json({ error: "Trip not found." }, { status: 404 });
    }

    const client = createServerSupabaseServiceClient();
    if (!client) {
      return NextResponse.json({ error: "Supabase server client unavailable." }, { status: 503 });
    }

    const nextVersion = existing.version + 1;
    const row = toTripDocumentRow(
      {
        ...rowToTrip(existing),
        name: nextName,
        version: nextVersion,
      },
      user.id,
      nextVersion,
      existing.created_at,
    );

    const { data, error } = await client
      .from(TRIP_DOCUMENTS_TABLE)
      .upsert(row)
      .select("trip_id, trip_name, version, updated_at, last_synced_at")
      .single();

    if (error || !data) {
      return NextResponse.json({ error: error?.message ?? "Unable to rename trip." }, { status: 500 });
    }

    return NextResponse.json({
      trip: rowToTripSummary(
        data as Pick<
          TripDocumentRow,
          "trip_id" | "trip_name" | "version" | "updated_at" | "last_synced_at"
        >,
      ),
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to rename trip." },
      { status: 500 },
    );
  }
}

export async function DELETE(request: NextRequest, context: RouteContext) {
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

  const { tripId } = await context.params;

  try {
    if (isServerE2EAuthBypassEnabled()) {
      const result = deleteE2ETrip(user, tripId);
      if (!result.ok) {
        return NextResponse.json({ error: result.error ?? "Unable to delete trip." }, { status: 400 });
      }

      return NextResponse.json({ deletedTripId: tripId });
    }

    const existing = await loadExistingTrip(user.id, tripId);
    if (!existing) {
      return NextResponse.json({ error: "Trip not found." }, { status: 404 });
    }

    const client = createServerSupabaseServiceClient();
    if (!client) {
      return NextResponse.json({ error: "Supabase server client unavailable." }, { status: 503 });
    }

    const { count, error: countError } = await client
      .from(TRIP_DOCUMENTS_TABLE)
      .select("trip_id", { count: "exact", head: true })
      .eq("owner_user_id", user.id);

    if (countError) {
      return NextResponse.json({ error: countError.message }, { status: 500 });
    }

    if ((count ?? 0) <= 1) {
      return NextResponse.json(
        { error: "Create another trip before deleting this one." },
        { status: 400 },
      );
    }

    const { error } = await client
      .from(TRIP_DOCUMENTS_TABLE)
      .delete()
      .eq("owner_user_id", user.id)
      .eq("trip_id", tripId);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ deletedTripId: tripId });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to delete trip." },
      { status: 500 },
    );
  }
}
