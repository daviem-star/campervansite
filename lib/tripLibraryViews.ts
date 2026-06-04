import { dateOnlyFromIso, todayDateInTimezone } from "@/lib/date";
import { getStayNights } from "@/lib/tripDerived";
import {
  FerryStop,
  PlaceRef,
  PointOfInterestStop,
  StayBookingStatus,
  StayStop,
  StopType,
  Trip,
} from "@/types/trip";

export type SavedPlaceOccurrence = {
  id: string;
  tripId: string;
  tripName: string;
  stopId: string;
  stopTitle: string;
  kind: StopType;
  role: "place" | "departure" | "arrival";
};

export type SavedPlaceView = {
  id: string;
  label: string;
  place: PlaceRef;
  kinds: StopType[];
  occurrences: SavedPlaceOccurrence[];
  phone?: string;
  websiteUrl?: string;
  amenitiesSummary?: string;
};

export type BookingView = {
  id: string;
  tripId: string;
  tripName: string;
  stopId: string;
  stopTitle: string;
  kind: "stay" | "ferry";
  startAt: string;
  endAt: string;
  locationLabel: string;
  status: StayBookingStatus | "reference-added" | "reference-missing";
  bookingRef?: string;
  operator?: string;
  totalCost?: number;
  checkInBy?: string;
  needsAttention: boolean;
  isPast: boolean;
};

const normalizePlaceLabel = (label: string): string => label.trim().toLocaleLowerCase();

const placeKey = (place: PlaceRef): string => {
  if (place.osmType && place.osmId) {
    return `osm:${place.osmType}:${place.osmId}`;
  }

  return `coordinates:${normalizePlaceLabel(place.label)}:${place.coordinates.lat.toFixed(5)}:${place.coordinates.lng.toFixed(5)}`;
};

const addPlace = (
  places: Map<string, SavedPlaceView>,
  trip: Trip,
  stop: StayStop | PointOfInterestStop | FerryStop,
  place: PlaceRef,
  role: SavedPlaceOccurrence["role"],
) => {
  const id = placeKey(place);
  const occurrence: SavedPlaceOccurrence = {
    id: `${trip.id}:${stop.id}:${role}`,
    tripId: trip.id,
    tripName: trip.name,
    stopId: stop.id,
    stopTitle: stop.title,
    kind: stop.type,
    role,
  };
  const existing = places.get(id);

  if (existing) {
    existing.occurrences.push(occurrence);
    if (!existing.kinds.includes(stop.type)) {
      existing.kinds.push(stop.type);
    }
    if (stop.type === "stay") {
      existing.phone ||= stop.phone;
      existing.websiteUrl ||= stop.websiteUrl;
      existing.amenitiesSummary ||= stop.amenitiesSummary;
    }
    return;
  }

  places.set(id, {
    id,
    label: place.label,
    place,
    kinds: [stop.type],
    occurrences: [occurrence],
    ...(stop.type === "stay"
      ? {
          phone: stop.phone,
          websiteUrl: stop.websiteUrl,
          amenitiesSummary: stop.amenitiesSummary,
        }
      : {}),
  });
};

export const deriveSavedPlaces = (trips: Trip[]): SavedPlaceView[] => {
  const places = new Map<string, SavedPlaceView>();

  trips.forEach((trip) => {
    trip.stops.forEach((stop) => {
      if (stop.type === "ferry") {
        addPlace(places, trip, stop, stop.departurePort, "departure");
        addPlace(places, trip, stop, stop.arrivalPort, "arrival");
        return;
      }

      addPlace(places, trip, stop, stop.place, "place");
    });
  });

  return Array.from(places.values())
    .map((place) => ({
      ...place,
      occurrences: [...place.occurrences].sort((a, b) =>
        a.tripName.localeCompare(b.tripName),
      ),
    }))
    .sort(
      (a, b) =>
        b.occurrences.length - a.occurrences.length || a.label.localeCompare(b.label),
    );
};

export const deriveBookings = (
  trips: Trip[],
  today: string = todayDateInTimezone(),
): BookingView[] =>
  trips
    .flatMap<BookingView>((trip) =>
      trip.stops.flatMap<BookingView>((stop) => {
        if (stop.type === "stay") {
          const totalCost =
            typeof stop.costPerNight === "number"
              ? stop.costPerNight * getStayNights(stop)
              : undefined;
          const status = stop.bookingStatus ?? "planned";

          return [{
            id: `${trip.id}:${stop.id}`,
            tripId: trip.id,
            tripName: trip.name,
            stopId: stop.id,
            stopTitle: stop.title,
            kind: "stay",
            startAt: stop.checkInAt,
            endAt: stop.checkOutAt,
            locationLabel: stop.place.label,
            status,
            totalCost,
            needsAttention: status === "planned",
            isPast: dateOnlyFromIso(stop.checkOutAt) < today,
          }];
        }

        if (stop.type === "ferry") {
          return [{
            id: `${trip.id}:${stop.id}`,
            tripId: trip.id,
            tripName: trip.name,
            stopId: stop.id,
            stopTitle: stop.title,
            kind: "ferry",
            startAt: stop.departureAt,
            endAt: stop.arrivalAt,
            locationLabel: `${stop.departurePort.label} to ${stop.arrivalPort.label}`,
            status: stop.bookingRef ? "reference-added" : "reference-missing",
            bookingRef: stop.bookingRef,
            operator: stop.operator,
            checkInBy: stop.checkInBy,
            needsAttention: !stop.bookingRef,
            isPast: dateOnlyFromIso(stop.arrivalAt) < today,
          }];
        }

        return [];
      }),
    )
    .sort((a, b) => a.startAt.localeCompare(b.startAt));
