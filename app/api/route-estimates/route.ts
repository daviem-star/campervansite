import { NextRequest, NextResponse } from "next/server";

import { isOpenRouteServiceDebugEnabled } from "@/lib/runtimeFlags";
import { Coordinates, RouteLineString, TravelLegEstimate, TravelLegRequest } from "@/types/trip";

type RouteEstimateRequest = {
  legs?: TravelLegRequest[];
};

type EstimateValue = {
  distanceKm: number;
  durationMinutes: number;
  provider: string;
  confidence: "live" | "fallback";
  geometry?: RouteLineString;
};

type CacheEntry = {
  expiresAt: number;
  value: EstimateValue;
};

type RouteDebugFallbackReason =
  | "missing_api_key"
  | "ors_non_ok"
  | "ors_unroutable_point"
  | "ors_invalid_payload"
  | "ors_request_failed"
  | "none";

type RouteEstimateLegDebug = {
  id: string;
  cacheStatus: "hit" | "miss" | "bypassed";
  orsAttempted: boolean;
  orsStatus: number | null;
  fallbackReason: RouteDebugFallbackReason;
  providerReturned: string;
  apiKeyPresent: boolean;
  responseBodyExcerpt?: string;
};

type RouteEstimateResponseDebug = {
  enabled: true;
  cacheStatus: "bypassed";
  legs: RouteEstimateLegDebug[];
};

type FetchLiveEstimateResult = {
  estimate: EstimateValue;
  debug: RouteEstimateLegDebug;
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

const trimBodyExcerpt = (value: string): string => {
  return value.trim().slice(0, 400);
};

const parseRouteGeometry = (value: unknown): RouteLineString | undefined => {
  if (!Array.isArray(value)) {
    return undefined;
  }

  const coordinates = value.flatMap((entry) => {
    if (!Array.isArray(entry) || entry.length < 2) {
      return [];
    }

    const [lng, lat] = entry;
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      return [];
    }

    return [
      {
        lat,
        lng,
      },
    ];
  });

  if (coordinates.length < 2) {
    return undefined;
  }

  return {
    type: "LineString",
    coordinates,
  };
};

const parseJsonSafely = <T>(value: string): T | null => {
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
};

const buildFallbackEstimate = (
  from: Coordinates,
  to: Coordinates,
): EstimateValue => {
  const distanceKm = haversineDistanceKm(from, to);
  const durationMinutes = Math.max(8, Math.round((distanceKm / 55) * 60));

  return {
    distanceKm,
    durationMinutes,
    provider: "fallback_haversine",
    confidence: "fallback",
  };
};

const buildDebugLogPayload = (
  legId: string,
  debug: RouteEstimateLegDebug,
  estimate: EstimateValue,
) => ({
  legId,
  apiKeyPresent: debug.apiKeyPresent,
  cacheStatus: debug.cacheStatus,
  orsAttempted: debug.orsAttempted,
  orsStatus: debug.orsStatus,
  fallbackReason: debug.fallbackReason,
  providerReturned: estimate.provider,
  responseBodyExcerpt: debug.responseBodyExcerpt,
  at: new Date().toISOString(),
});

const fetchLiveEstimate = async (
  legId: string,
  from: Coordinates,
  to: Coordinates,
  debugEnabled: boolean,
): Promise<FetchLiveEstimateResult> => {
  const apiKey = process.env.OPENROUTESERVICE_API_KEY;
  const baseDebug: RouteEstimateLegDebug = {
    id: legId,
    cacheStatus: debugEnabled ? "bypassed" : "miss",
    orsAttempted: false,
    orsStatus: null,
    fallbackReason: "none",
    providerReturned: "openrouteservice_driving_car",
    apiKeyPresent: Boolean(apiKey),
  };

  if (!apiKey) {
    const estimate = buildFallbackEstimate(from, to);
    const debug = {
      ...baseDebug,
      fallbackReason: "missing_api_key" as const,
      providerReturned: estimate.provider,
    };

    if (debugEnabled) {
      console.warn("[route-estimates:ors-debug]", buildDebugLogPayload(legId, debug, estimate));
    }

    return { estimate, debug };
  }

  try {
    const response = await fetch("https://api.openrouteservice.org/v2/directions/driving-car/geojson", {
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
      const responseText = await response.text().catch(() => "");
      const responseBodyExcerpt = trimBodyExcerpt(responseText);
      const parsedError = parseJsonSafely<{
        error?: {
          code?: number;
          message?: string;
        };
      }>(responseText);
      const estimate = buildFallbackEstimate(from, to);
      const debug = {
        ...baseDebug,
        orsAttempted: true,
        orsStatus: response.status,
        fallbackReason:
          parsedError?.error?.code === 2010
            ? ("ors_unroutable_point" as const)
            : ("ors_non_ok" as const),
        providerReturned: estimate.provider,
        ...(responseBodyExcerpt ? { responseBodyExcerpt } : {}),
      };

      if (debugEnabled) {
        console.warn("[route-estimates:ors-debug]", buildDebugLogPayload(legId, debug, estimate));
      }

      return { estimate, debug };
    }

    const data = (await response.json().catch(() => null)) as
      | {
          features?: Array<{
            geometry?: {
              coordinates?: unknown;
            };
            properties?: {
              summary?: {
                distance?: number;
                duration?: number;
              };
            };
          }>;
        }
      | null;

    const summary = data?.features?.[0]?.properties?.summary;
    const distanceKm = Number(summary?.distance ?? NaN) / 1000;
    const durationMinutes = Number(summary?.duration ?? NaN) / 60;
    const geometry = parseRouteGeometry(data?.features?.[0]?.geometry?.coordinates);

    if (!Number.isFinite(distanceKm) || !Number.isFinite(durationMinutes)) {
      const responseBodyExcerpt = trimBodyExcerpt(JSON.stringify(data ?? {}));
      const estimate = buildFallbackEstimate(from, to);
      const debug = {
        ...baseDebug,
        orsAttempted: true,
        orsStatus: response.status,
        fallbackReason: "ors_invalid_payload" as const,
        providerReturned: estimate.provider,
        ...(responseBodyExcerpt ? { responseBodyExcerpt } : {}),
      };

      if (debugEnabled) {
        console.warn("[route-estimates:ors-debug]", buildDebugLogPayload(legId, debug, estimate));
      }

      return { estimate, debug };
    }

    const estimate: EstimateValue = {
      distanceKm,
      durationMinutes: Math.max(1, Math.round(durationMinutes)),
      provider: "openrouteservice_driving_car",
      confidence: "live",
      ...(geometry ? { geometry } : {}),
    };
    const debug = {
      ...baseDebug,
      orsAttempted: true,
      orsStatus: response.status,
      providerReturned: estimate.provider,
    };

    if (debugEnabled) {
      console.info("[route-estimates:ors-debug]", buildDebugLogPayload(legId, debug, estimate));
    }

    return { estimate, debug };
  } catch (error) {
    const estimate = buildFallbackEstimate(from, to);
    const debug = {
      ...baseDebug,
      orsAttempted: true,
      fallbackReason: "ors_request_failed" as const,
      providerReturned: estimate.provider,
      ...(error instanceof Error && error.message
        ? { responseBodyExcerpt: trimBodyExcerpt(error.message) }
        : {}),
    };

    if (debugEnabled) {
      console.warn("[route-estimates:ors-debug]", buildDebugLogPayload(legId, debug, estimate));
    }

    return { estimate, debug };
  }
};

const getEstimate = async (
  legId: string,
  from: Coordinates,
  to: Coordinates,
  debugEnabled: boolean,
): Promise<FetchLiveEstimateResult> => {
  const cacheKey = getCacheKey(from, to);

  if (!debugEnabled) {
    const cached = cache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return {
        estimate: cached.value,
        debug: {
          id: legId,
          cacheStatus: "hit",
          orsAttempted: false,
          orsStatus: null,
          fallbackReason: cached.value.confidence === "fallback" ? "none" : "none",
          providerReturned: cached.value.provider,
          apiKeyPresent: Boolean(process.env.OPENROUTESERVICE_API_KEY),
        },
      };
    }
  }

  const result = await fetchLiveEstimate(legId, from, to, debugEnabled);

  if (!debugEnabled) {
    cache.set(cacheKey, {
      expiresAt: Date.now() + CACHE_TTL_MS,
      value: result.estimate,
    });
  }

  return result;
};

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as RouteEstimateRequest | null;

  if (!body?.legs || !Array.isArray(body.legs) || body.legs.length === 0) {
    return NextResponse.json({ error: "At least one route leg is required." }, { status: 400 });
  }

  const debugEnabled =
    isOpenRouteServiceDebugEnabled() && request.headers.get("x-route-debug") === "1";

  const estimateResults = await Promise.all(
    body.legs.map(async (leg) => {
      const result = await getEstimate(leg.id, leg.from, leg.to, debugEnabled);

      return {
        leg,
        ...result,
      };
    }),
  );

  const estimates = estimateResults.map(({ leg, estimate }) => ({
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
    ...(estimate.geometry ? { geometry: estimate.geometry } : {}),
  } satisfies TravelLegEstimate));

  console.info("[route-estimates]", {
    legCount: estimateResults.length,
    cacheHits: estimateResults.filter(({ debug }) => debug.cacheStatus === "hit").length,
    cacheMisses: estimateResults.filter(({ debug }) => debug.cacheStatus === "miss").length,
    cacheBypassed: estimateResults.filter(({ debug }) => debug.cacheStatus === "bypassed").length,
    liveCount: estimateResults.filter(({ estimate }) => estimate.confidence === "live").length,
    fallbackCount: estimateResults.filter(({ estimate }) => estimate.confidence === "fallback").length,
    orsAttemptedCount: estimateResults.filter(({ debug }) => debug.orsAttempted).length,
    apiKeyPresent: Boolean(process.env.OPENROUTESERVICE_API_KEY),
    debugEnabled,
    at: new Date().toISOString(),
  });

  return NextResponse.json({
    estimates,
    ...(debugEnabled
      ? ({
          debug: {
            enabled: true,
            cacheStatus: "bypassed",
            legs: estimateResults.map(({ debug }) => debug),
          } satisfies RouteEstimateResponseDebug,
        } as const)
      : {}),
  });
}
