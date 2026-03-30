import { isValidCoordinates, normalizePlaceRef, withPlaceRoutingCoordinates } from "@/lib/placeRouting";
import { Coordinates, PlaceRef } from "@/types/trip";

type RouteAccessCacheEntry = {
  expiresAt: number;
  value: Coordinates | null;
};

const ROUTE_ACCESS_CACHE_HIT_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const ROUTE_ACCESS_CACHE_MISS_TTL_MS = 24 * 60 * 60 * 1000;
const ROUTE_ACCESS_SNAP_RADIUS_METERS = 1200;
const routeAccessCache = new Map<string, RouteAccessCacheEntry>();

const getRouteAccessCacheKey = (coordinates: Coordinates): string => {
  return `${coordinates.lat.toFixed(6)}:${coordinates.lng.toFixed(6)}`;
};

const getCachedRouteAccessCoordinates = (
  coordinates: Coordinates,
  now: number = Date.now(),
): Coordinates | null | undefined => {
  const cached = routeAccessCache.get(getRouteAccessCacheKey(coordinates));
  if (!cached) {
    return undefined;
  }

  if (cached.expiresAt <= now) {
    routeAccessCache.delete(getRouteAccessCacheKey(coordinates));
    return undefined;
  }

  return cached.value;
};

const setCachedRouteAccessCoordinates = (
  coordinates: Coordinates,
  value: Coordinates | null,
  now: number = Date.now(),
) => {
  routeAccessCache.set(getRouteAccessCacheKey(coordinates), {
    value,
    expiresAt: now + (value ? ROUTE_ACCESS_CACHE_HIT_TTL_MS : ROUTE_ACCESS_CACHE_MISS_TTL_MS),
  });
};

const parseSnappedCoordinates = (value: unknown): Coordinates | null => {
  if (!Array.isArray(value) || value.length < 2) {
    return null;
  }

  const [lng, lat] = value;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return null;
  }

  return {
    lat,
    lng,
  };
};

export const clearRouteAccessCache = () => {
  routeAccessCache.clear();
};

export const resolveRouteAccessCoordinates = async (
  coordinates: Coordinates,
): Promise<Coordinates | null> => {
  const cached = getCachedRouteAccessCoordinates(coordinates);
  if (cached !== undefined) {
    return cached;
  }

  const apiKey = process.env.OPENROUTESERVICE_API_KEY;
  if (!apiKey) {
    setCachedRouteAccessCoordinates(coordinates, null);
    return null;
  }

  try {
    const response = await fetch("https://api.openrouteservice.org/v2/snap/driving-car/json", {
      method: "POST",
      headers: {
        Authorization: apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        locations: [[coordinates.lng, coordinates.lat]],
        radius: ROUTE_ACCESS_SNAP_RADIUS_METERS,
      }),
      next: { revalidate: 86_400 },
    });

    if (!response.ok) {
      setCachedRouteAccessCoordinates(coordinates, null);
      return null;
    }

    const payload = (await response.json().catch(() => null)) as
      | {
          locations?: Array<
            | {
                location?: [number, number];
              }
            | null
          >;
        }
      | null;

    const resolved = parseSnappedCoordinates(payload?.locations?.[0]?.location);
    setCachedRouteAccessCoordinates(coordinates, resolved);
    return resolved;
  } catch {
    setCachedRouteAccessCoordinates(coordinates, null);
    return null;
  }
};

export const resolvePlaceRouteAccess = async (place: PlaceRef): Promise<PlaceRef> => {
  const normalizedPlace = normalizePlaceRef(place);
  if (isValidCoordinates(normalizedPlace.routingCoordinates)) {
    return normalizedPlace;
  }

  const routingCoordinates = await resolveRouteAccessCoordinates(normalizedPlace.coordinates);

  return withPlaceRoutingCoordinates(normalizedPlace, routingCoordinates);
};
