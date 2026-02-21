import { differenceInCalendarDays, parseISO } from "date-fns";

import {
  addMinutesIso,
  buildDateRange,
  dateOnlyFromIso,
  formatDate,
  formatDateOnly,
  formatDateTime,
  todayDateInTimezone,
} from "@/lib/date";
import {
  FerryStop,
  GapWarning,
  MapMarker,
  MapSegment,
  PlaceRef,
  PointOfInterestStop,
  StayStop,
  TodayAction,
  Trip,
  TripStop,
} from "@/types/trip";

export const sortStopsByOrder = (stops: TripStop[]): TripStop[] => {
  return [...stops].sort((a, b) => a.order - b.order);
};

export const getTripDateRange = (trip: Trip): { start: string; end: string } | null => {
  const stayStops = sortStopsByOrder(trip.stops).filter(
    (stop): stop is StayStop => stop.type === "stay",
  );

  if (stayStops.length === 0) {
    return null;
  }

  const start = dateOnlyFromIso(stayStops[0].checkInAt);
  const end = dateOnlyFromIso(stayStops[stayStops.length - 1].checkOutAt);

  return { start, end };
};

export const getTripDays = (trip: Trip): string[] => {
  const range = getTripDateRange(trip);
  if (!range) {
    return [];
  }

  return buildDateRange(range.start, range.end);
};

export const getPrimaryDateForStop = (stop: TripStop): string => {
  if (stop.type === "stay") {
    return dateOnlyFromIso(stop.checkInAt);
  }

  if (stop.type === "ferry") {
    return dateOnlyFromIso(stop.departureAt);
  }

  return stop.visitDate;
};

export const getStopSubtitle = (stop: TripStop): string => {
  if (stop.type === "stay") {
    return `${stop.place.label} · In ${formatDateTime(stop.checkInAt)} · Out ${formatDateTime(
      stop.checkOutAt,
    )}`;
  }

  if (stop.type === "ferry") {
    return `${stop.departurePort.label} -> ${stop.arrivalPort.label} · ${formatDateTime(
      stop.departureAt,
    )}`;
  }

  return `${stop.place.label} · ${formatDateOnly(stop.visitDate)}`;
};

export const getStayNights = (stop: StayStop): number => {
  const checkInDate = parseISO(dateOnlyFromIso(stop.checkInAt));
  const checkOutDate = parseISO(dateOnlyFromIso(stop.checkOutAt));
  return Math.max(0, differenceInCalendarDays(checkOutDate, checkInDate));
};

export const getCostSummary = (trip: Trip): {
  totalNights: number;
  totalCost: number;
} => {
  const stays = trip.stops.filter((stop): stop is StayStop => stop.type === "stay");

  return stays.reduce(
    (acc, stop) => {
      const nights = getStayNights(stop);
      acc.totalNights += nights;
      if (typeof stop.costPerNight === "number") {
        acc.totalCost += stop.costPerNight * nights;
      }
      return acc;
    },
    { totalNights: 0, totalCost: 0 },
  );
};

const eachNightCoveredByStay = (stay: StayStop): string[] => {
  const checkInDate = dateOnlyFromIso(stay.checkInAt);
  const checkOutDate = dateOnlyFromIso(stay.checkOutAt);
  const tripDays = buildDateRange(checkInDate, checkOutDate);
  return tripDays.slice(0, -1);
};

export const getGapWarnings = (trip: Trip): GapWarning[] => {
  const sortedStays = sortStopsByOrder(trip.stops).filter(
    (stop): stop is StayStop => stop.type === "stay",
  );

  if (sortedStays.length < 2) {
    return [];
  }

  const overallStart = dateOnlyFromIso(sortedStays[0].checkInAt);
  const overallEnd = dateOnlyFromIso(sortedStays[sortedStays.length - 1].checkOutAt);

  const coverage = new Set<string>();
  sortedStays.forEach((stay) => {
    eachNightCoveredByStay(stay).forEach((day) => coverage.add(day));
  });

  const expected = buildDateRange(overallStart, overallEnd).slice(0, -1);

  return expected
    .filter((day) => !coverage.has(day))
    .map((day) => ({
      date: day,
      label: `No base campsite for ${formatDate(`${day}T00:00:00Z`)}`,
    }));
};

export const getTodayActions = (trip: Trip): TodayAction[] => {
  const now = new Date();
  const nowMillis = now.getTime();
  const today = todayDateInTimezone();

  const actions: TodayAction[] = [];

  sortStopsByOrder(trip.stops).forEach((stop) => {
    if (stop.type === "ferry" && dateOnlyFromIso(stop.departureAt) === today) {
      actions.push({
        id: `ferry-${stop.id}`,
        type: "ferry_check_in",
        dueAt: stop.checkInBy,
        label: `Ferry check-in for ${stop.title}`,
        detail: `${stop.departurePort.label} by ${formatDateTime(stop.checkInBy)}`,
        overdue: new Date(stop.checkInBy).getTime() < nowMillis,
      });
    }

    if (stop.type === "stay" && dateOnlyFromIso(stop.checkOutAt) === today) {
      actions.push({
        id: `checkout-${stop.id}`,
        type: "stay_checkout",
        dueAt: stop.checkOutAt,
        label: `Checkout at ${stop.title}`,
        detail: `${stop.place.label} by ${formatDateTime(stop.checkOutAt)}`,
        overdue: new Date(stop.checkOutAt).getTime() < nowMillis,
      });
    }
  });

  return actions.sort((a, b) => new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime());
};

const markerForPlace = (
  id: string,
  role: MapMarker["role"],
  place: PlaceRef,
  labelOverride?: string,
): MapMarker => ({
  id,
  role,
  label: labelOverride ?? place.label,
  coordinates: place.coordinates,
});

export const getMapData = (trip: Trip): {
  markers: MapMarker[];
  segments: MapSegment[];
} => {
  const markers: MapMarker[] = [
    markerForPlace("home", "home", trip.home, `Home: ${trip.home.label}`),
  ];
  const segments: MapSegment[] = [];

  let previous = trip.home;

  sortStopsByOrder(trip.stops).forEach((stop) => {
    if (stop.type === "stay") {
      markers.push(markerForPlace(stop.id, "stay", stop.place, stop.title));
      segments.push({
        id: `road-${stop.id}`,
        type: "road",
        from: previous.coordinates,
        to: stop.place.coordinates,
      });
      previous = stop.place;
      return;
    }

    if (stop.type === "point_of_interest") {
      markers.push(markerForPlace(stop.id, "poi", stop.place, stop.title));
      segments.push({
        id: `road-${stop.id}`,
        type: "road",
        from: previous.coordinates,
        to: stop.place.coordinates,
      });
      previous = stop.place;
      return;
    }

    markers.push(
      markerForPlace(`${stop.id}-dep`, "ferry_port", stop.departurePort, `${stop.title} departure`),
      markerForPlace(`${stop.id}-arr`, "ferry_port", stop.arrivalPort, `${stop.title} arrival`),
    );

    segments.push({
      id: `road-pre-${stop.id}`,
      type: "road",
      from: previous.coordinates,
      to: stop.departurePort.coordinates,
    });

    segments.push({
      id: `ferry-${stop.id}`,
      type: "ferry",
      from: stop.departurePort.coordinates,
      to: stop.arrivalPort.coordinates,
    });

    previous = stop.arrivalPort;
  });

  return { markers, segments };
};

export const applyDefaultCheckInBy = (departureIso: string): string => {
  return addMinutesIso(departureIso, -45);
};

export const ensureStopOrder = (stops: TripStop[]): TripStop[] => {
  return sortStopsByOrder(stops).map((stop, index) => ({
    ...stop,
    order: index,
  }));
};

export const formatTripDateRange = (trip: Trip): string => {
  const range = getTripDateRange(trip);
  if (!range) {
    return "No stay dates yet";
  }

  return `${formatDate(`${range.start}T00:00:00Z`)} - ${formatDate(`${range.end}T00:00:00Z`)}`;
};

export const isStopOnDate = (stop: TripStop, date: string): boolean => {
  return getPrimaryDateForStop(stop) === date;
};

export const stopTypeLabel = (stop: TripStop): string => {
  if (stop.type === "stay") {
    return "Stay";
  }
  if (stop.type === "ferry") {
    return "Ferry";
  }
  return "POI";
};

export const ferryWindowLabel = (ferry: FerryStop): string => {
  return `${formatDateTime(ferry.departureAt)} -> ${formatDateTime(ferry.arrivalAt)}`;
};

export const stayWindowLabel = (stay: StayStop): string => {
  return `${formatDateTime(stay.checkInAt)} -> ${formatDateTime(stay.checkOutAt)}`;
};

export const poiDateLabel = (poi: PointOfInterestStop): string => {
  return formatDateOnly(poi.visitDate);
};
