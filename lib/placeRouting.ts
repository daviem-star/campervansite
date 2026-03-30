import { Coordinates, PlaceRef } from "@/types/trip";

const COORDINATE_PRECISION = 6;

const isFiniteCoordinateValue = (value: unknown): value is number => {
  return typeof value === "number" && Number.isFinite(value);
};

export const isValidCoordinates = (value: unknown): value is Coordinates => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }

  const coordinates = value as Partial<Coordinates>;

  return (
    isFiniteCoordinateValue(coordinates.lat) &&
    isFiniteCoordinateValue(coordinates.lng)
  );
};

export const areCoordinatesEqual = (
  left: Coordinates | null | undefined,
  right: Coordinates | null | undefined,
): boolean => {
  if (!left || !right) {
    return false;
  }

  return (
    left.lat.toFixed(COORDINATE_PRECISION) === right.lat.toFixed(COORDINATE_PRECISION) &&
    left.lng.toFixed(COORDINATE_PRECISION) === right.lng.toFixed(COORDINATE_PRECISION)
  );
};

export const normalizePlaceRef = (place: PlaceRef): PlaceRef => {
  const normalized: PlaceRef = {
    label: place.label,
    coordinates: {
      lat: place.coordinates.lat,
      lng: place.coordinates.lng,
    },
    ...(place.osmId ? { osmId: place.osmId } : {}),
    ...(place.osmType ? { osmType: place.osmType } : {}),
  };

  if (
    isValidCoordinates(place.routingCoordinates) &&
    !areCoordinatesEqual(place.coordinates, place.routingCoordinates)
  ) {
    normalized.routingCoordinates = {
      lat: place.routingCoordinates.lat,
      lng: place.routingCoordinates.lng,
    };
  }

  return normalized;
};

export const getPlaceRoutingCoordinates = (
  place: Pick<PlaceRef, "coordinates" | "routingCoordinates">,
): Coordinates => {
  if (
    isValidCoordinates(place.routingCoordinates) &&
    !areCoordinatesEqual(place.coordinates, place.routingCoordinates)
  ) {
    return place.routingCoordinates;
  }

  return place.coordinates;
};

export const withPlaceRoutingCoordinates = (
  place: PlaceRef,
  routingCoordinates: Coordinates | null | undefined,
): PlaceRef => {
  if (!routingCoordinates) {
    return normalizePlaceRef(place);
  }

  return normalizePlaceRef({
    ...place,
    routingCoordinates,
  });
};
