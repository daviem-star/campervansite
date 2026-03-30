import { NextRequest, NextResponse } from "next/server";

import { isServerE2EAuthBypassEnabled } from "@/lib/e2eAuth";
import { replaceE2ETrips } from "@/lib/e2eTripStore";
import { normalizeAppData } from "@/lib/tripData";
import { AppData, SessionUser } from "@/types/trip";

type SeedBody = {
  user?: SessionUser;
  data?: AppData | null;
};

export async function POST(request: NextRequest) {
  if (!isServerE2EAuthBypassEnabled()) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  const body = (await request.json().catch(() => null)) as SeedBody | null;

  if (!body?.user?.id) {
    return NextResponse.json({ error: "User is required." }, { status: 400 });
  }

  const normalizedData =
    body.data === null || body.data === undefined
      ? null
      : normalizeAppData(body.data, body.user.id);

  const trips = replaceE2ETrips(body.user, normalizedData);
  return NextResponse.json({ trips });
}
