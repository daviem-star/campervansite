import { NextRequest, NextResponse } from "next/server";

import { TravelLegEstimate } from "@/types/trip";

type Coordinates = {
  lat: number;
  lng: number;
};

type RouteEstimateRequest = {
  legs?: Array<{
    id: string;
    fromId: string;
    fromLabel: string;
    toId: string;
    toLabel: string;
    date: string;
    relatedStopId?: string;
    from: Coordinates;
    to: Coordinates;
  }>;
};

type CacheEntry = {
  expiresAt: number;
  value: {
    distanceKm: number;
    durationMinutes: number;
    provider: string;
    confidence: "live" | "fallback";
  };
};

const CACHE_TTL_MS = 30 * 60 * 1000;
const CAMPERVAN_BUFFER_MULTIPLIER = 1.15;
const CAMPERVAN_BUFFER_MINUTES = 10;
const cache = new Map<string, CacheEntry>();

const toRadians = (value: number): number => (value * Math.PI) / 180;

const haversineDistanceKm = (from: Coordinates, to: Coordinates): number => {
  const earthRadiusKm = 6371;
  const dLat = toRadians(to.lat - from.lat);
  const dLng = toRadians(to.lng - from.lng);
  const lat1 = toRadians(from.lat);
  const lat2 = toRadians(to.lat);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return earthRadiusKm * c;
};

const getCacheKey = (from: Coordinates, to: Coordinates): string => {
  return `${from.lat.toFixed(5)}:${from.lng.toFixed(5)}:${to.lat.toFixed(5)}:${to.lng.toFixed(5)}`;
};

const buildBufferedDuration = (durationMinutes: number): number => {
  return Math.max(
    1,
    Math.round(durationMinutes * CAMPERVAN_BUFFER_MULTIPLIER + CAMPERVAN_BUFFER_MINUTES),
  );
};

const buildFallbackEstimate = (
  from: Coordinates,
  to: Coordinates,
): {
  distanceKm: number;
  durationMinutes: number;
  provider: string;
  confidence: "live" | "fallback";
} => {
  const distanceKm = haversineDistanceKm(from, to);
  const durationMinutes = Math.max(8, Math.round((distanceKm / 55) * 60));

  return {
    distanceKm,
    durationMinutes,
    provider: "fallback_haversine",
    confidence: "fallback",
  };
};

const fetchLiveEstimate = async (
  from: Coordinates,
  to: Coordinates,
): Promise<{
  distanceKm: number;
  durationMinutes: number;
  provider: string;
  confidence: "live" | "fallback";
}> => {
  const apiKey = process.env.OPENROUTESERVICE_API_KEY;
  if (!apiKey) {
    return buildFallbackEstimate(from, to);
  }

  const response = await fetch("https://api.openrouteservice.org/v2/directions/driving-car", {
    method: "POST",
    headers: {
      Authorization: apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      coordinates: [
        [from.lng, from.lat],
        [to.lng, to.lat],
      ],
    }),
    next: { revalidate: 1800 },
  });

  if (!response.ok) {
    return buildFallbackEstimate(from, to);
  }

  const data = (await response.json()) as {
    features?: Array<{
      properties?: {
        summary?: {
          distance?: number;
          duration?: number;
        };
      };
    }>;
  };

  const summary = data.features?.[0]?.properties?.summary;
  const distanceKm = Number(summary?.distance ?? NaN) / 1000;
  const durationMinutes = Number(summary?.duration ?? NaN) / 60;

  if (!Number.isFinite(distanceKm) || !Number.isFinite(durationMinutes)) {
    return buildFallbackEstimate(from, to);
  }

  return {
    distanceKm,
    durationMinutes: Math.max(1, Math.round(durationMinutes)),
    provider: "openrouteservice_driving_car",
    confidence: "live",
  };
};

const getEstimate = async (
  from: Coordinates,
  to: Coordinates,
): Promise<{
  distanceKm: number;
  durationMinutes: number;
  provider: string;
  confidence: "live" | "fallback";
}> => {
  const cacheKey = getCacheKey(from, to);
  const cached = cache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.value;
  }

  const estimate = await fetchLiveEstimate(from, to);
  cache.set(cacheKey, {
    expiresAt: Date.now() + CACHE_TTL_MS,
    value: estimate,
  });
  return estimate;
};

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as RouteEstimateRequest | null;

  if (!body?.legs || !Array.isArray(body.legs) || body.legs.length === 0) {
    return NextResponse.json({ error: "At least one route leg is required." }, { status: 400 });
  }

  const estimates = await Promise.all(
    body.legs.map(async (leg) => {
      const estimate = await getEstimate(leg.from, leg.to);

      return {
        id: leg.id,
        fromId: leg.fromId,
        fromLabel: leg.fromLabel,
        toId: leg.toId,
        toLabel: leg.toLabel,
        kind: "road",
        distanceKm: Number(estimate.distanceKm.toFixed(1)),
        durationMinutes: estimate.durationMinutes,
        bufferedDurationMinutes: buildBufferedDuration(estimate.durationMinutes),
        provider: estimate.provider,
        fetchedAt: new Date().toISOString(),
        confidence: estimate.confidence,
        date: leg.date,
        relatedStopId: leg.relatedStopId,
      } satisfies TravelLegEstimate;
    }),
  );

  return NextResponse.json({ estimates });
}
