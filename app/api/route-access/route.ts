import { NextRequest, NextResponse } from "next/server";

import { isValidCoordinates, normalizePlaceRef } from "@/lib/placeRouting";
import { resolvePlaceRouteAccess } from "@/lib/routeAccess";
import { PlaceRef } from "@/types/trip";

type RouteAccessRequest = {
  place?: PlaceRef;
};

const isValidPlaceRef = (value: unknown): value is PlaceRef => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }

  const place = value as Partial<PlaceRef>;

  return typeof place.label === "string" && place.label.trim().length > 0 && isValidCoordinates(place.coordinates);
};

export async function POST(request: NextRequest) {
  const payload = (await request.json().catch(() => null)) as RouteAccessRequest | null;
  if (!payload || !isValidPlaceRef(payload.place)) {
    return NextResponse.json({ error: "A valid place is required." }, { status: 400 });
  }

  const place = normalizePlaceRef(payload.place);
  const resolvedPlace = await resolvePlaceRouteAccess(place);

  console.info("[route-access]", {
    apiKeyPresent: Boolean(process.env.OPENROUTESERVICE_API_KEY),
    resolvedRoutingCoordinates: Boolean(resolvedPlace.routingCoordinates),
    at: new Date().toISOString(),
  });

  return NextResponse.json({
    place: resolvedPlace,
  });
}
