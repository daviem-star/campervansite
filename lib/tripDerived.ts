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
  FerrySection,
  FerryStop,
  GapWarning,
  ItinerarySection,
  MapMarker,
  MapSegment,
  PlaceRef,
  PointOfInterestStop,
  SelectedEntity,
  StandalonePoiSection,
  StayGroupSection,
  StayStop,
  TodayAction,
  Trip,
  TripStop,
} from "@/types/trip";

const toMillis = (isoValue: string): number => new Date(isoValue).getTime();

const haversineDistanceKm = (from: PlaceRef, to: PlaceRef): number => {
  const toRadians = (value: number) => (value * Math.PI) / 180;
  const earthRadiusKm = 6371;
  const dLat = toRadians(to.coordinates.lat - from.coordinates.lat);
  const dLng = toRadians(to.coordinates.lng - from.coordinates.lng);
  const lat1 = toRadians(from.coordinates.lat);
  const lat2 = toRadians(to.coordinates.lat);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return earthRadiusKm * c;
};

const canonicalStopSort = (a: TripStop, b: TripStop): number => {
  const dateA = getPrimaryDateForStop(a);
  const dateB = getPrimaryDateForStop(b);

  if (dateA !== dateB) {
    return dateA.localeCompare(dateB);
  }

  if (a.type === "ferry" && b.type === "ferry") {
    return toMillis(a.departureAt) - toMillis(b.departureAt);
  }

  if (a.type === "stay" && b.type === "stay") {
    return toMillis(a.checkInAt) - toMillis(b.checkInAt);
  }

  if (a.type === "point_of_interest" && b.type === "point_of_interest") {
    return a.title.localeCompare(b.title);
  }

  const rank = (stop: TripStop): number => {
    if (stop.type === "ferry") {
      return 0;
    }
    if (stop.type === "point_of_interest") {
      return 1;
    }
    return 2;
  };

  return rank(a) - rank(b);
};

export const sortStopsByOrder = (stops: TripStop[]): TripStop[] => {
  return [...stops].sort((a, b) => a.order - b.order);
};

export const sortStopsCanonical = (stops: TripStop[]): TripStop[] => {
  return [...stops].sort(canonicalStopSort);
};

const sortStaysByCheckIn = (stays: StayStop[]): StayStop[] => {
  return [...stays].sort((a, b) => toMillis(a.checkInAt) - toMillis(b.checkInAt));
};

const sortFerriesByDeparture = (ferries: FerryStop[]): FerryStop[] => {
  return [...ferries].sort((a, b) => toMillis(a.departureAt) - toMillis(b.departureAt));
};

const findStayForPoi = (poi: PointOfInterestStop, stays: StayStop[]): StayStop | null => {
  const poiDate = poi.visitDate;

  const matching = stays.filter((stay) => {
    const stayCheckInDate = dateOnlyFromIso(stay.checkInAt);
    const stayCheckOutDate = dateOnlyFromIso(stay.checkOutAt);
    return stayCheckInDate <= poiDate && poiDate < stayCheckOutDate;
  });

  if (matching.length === 0) {
    return null;
  }

  return sortStaysByCheckIn(matching)[0];
};

const stayCoverageDatesInclusive = (stay: StayStop): string[] => {
  return buildDateRange(dateOnlyFromIso(stay.checkInAt), dateOnlyFromIso(stay.checkOutAt));
};

const sectionTypeRankForDay = (section: ItinerarySection): number => {
  if (section.kind === "ferry") {
    return 0;
  }
  if (section.kind === "standalone_poi") {
    return 1;
  }
  return 2;
};

const getCurrentBaseForStandalonePoi = (poi: PointOfInterestStop, trip: Trip, stays: StayStop[]): PlaceRef => {
  const priorStays = sortStaysByCheckIn(stays).filter(
    (stay) => dateOnlyFromIso(stay.checkInAt) < poi.visitDate,
  );

  if (priorStays.length > 0) {
    return priorStays[priorStays.length - 1].place;
  }

  const priorFerryArrivals = sortFerriesByDeparture(
    trip.stops.filter((stop): stop is FerryStop => stop.type === "ferry"),
  ).filter((ferry) => dateOnlyFromIso(ferry.arrivalAt) <= poi.visitDate);

  if (priorFerryArrivals.length > 0) {
    return priorFerryArrivals[priorFerryArrivals.length - 1].arrivalPort;
  }

  return trip.home;
};

const getSectionTimeMillis = (section: ItinerarySection): number => {
  if (section.kind === "ferry") {
    return toMillis(section.ferry.departureAt);
  }

  if (section.kind === "stay_group") {
    return toMillis(section.stay.checkInAt);
  }

  return Number.POSITIVE_INFINITY;
};

export const getTripDateRange = (trip: Trip): { start: string; end: string } | null => {
  const stayStops = sortStaysByCheckIn(
    sortStopsCanonical(trip.stops).filter((stop): stop is StayStop => stop.type === "stay"),
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
  const sortedStays = sortStaysByCheckIn(
    trip.stops.filter((stop): stop is StayStop => stop.type === "stay"),
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

  sortStopsCanonical(trip.stops).forEach((stop) => {
    if (stop.type === "ferry" && dateOnlyFromIso(stop.departureAt) === today) {
      actions.push({
        id: `ferry-${stop.id}`,
        type: "ferry_check_in",
        dueAt: stop.checkInBy,
        departureAt: stop.departureAt,
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

export const getItinerarySections = (trip: Trip): ItinerarySection[] => {
  const stays = sortStaysByCheckIn(trip.stops.filter((stop): stop is StayStop => stop.type === "stay"));
  const ferries = sortFerriesByDeparture(
    trip.stops.filter((stop): stop is FerryStop => stop.type === "ferry"),
  );
  const pois = trip.stops.filter((stop): stop is PointOfInterestStop => stop.type === "point_of_interest");

  const groupedPoiIds = new Set<string>();
  const poiByStayId = new Map<string, PointOfInterestStop[]>();

  pois.forEach((poi) => {
    const matchingStay = findStayForPoi(poi, stays);
    if (!matchingStay) {
      return;
    }

    groupedPoiIds.add(poi.id);
    const list = poiByStayId.get(matchingStay.id) ?? [];
    list.push(poi);
    poiByStayId.set(matchingStay.id, list);
  });

  const staySections: StayGroupSection[] = stays.map((stay) => {
    const groupedPois = [...(poiByStayId.get(stay.id) ?? [])].sort((a, b) => {
      if (a.visitDate !== b.visitDate) {
        return a.visitDate.localeCompare(b.visitDate);
      }

      const distanceA = haversineDistanceKm(stay.place, a.place);
      const distanceB = haversineDistanceKm(stay.place, b.place);
      if (distanceA !== distanceB) {
        return distanceA - distanceB;
      }

      return a.title.localeCompare(b.title);
    });

    return {
      kind: "stay_group",
      id: `stay-group-${stay.id}`,
      stay,
      pois: groupedPois,
      primaryDate: dateOnlyFromIso(stay.checkInAt),
      dates: stayCoverageDatesInclusive(stay),
    };
  });

  const standalonePoiCandidates = pois
    .filter((poi) => !groupedPoiIds.has(poi.id))
    .map((poi) => {
      const baseAnchor = getCurrentBaseForStandalonePoi(poi, trip, stays);
      return {
        section: {
          kind: "standalone_poi",
          id: `standalone-poi-${poi.id}`,
          poi,
          primaryDate: poi.visitDate,
          dates: [poi.visitDate],
        } as StandalonePoiSection,
        _distanceKm: haversineDistanceKm(baseAnchor, poi.place),
      };
    })
    .sort((a, b) => {
      if (a.section.primaryDate !== b.section.primaryDate) {
        return a.section.primaryDate.localeCompare(b.section.primaryDate);
      }
      if (a._distanceKm !== b._distanceKm) {
        return a._distanceKm - b._distanceKm;
      }
      return a.section.poi.title.localeCompare(b.section.poi.title);
    });

  const standalonePoiSections: StandalonePoiSection[] = standalonePoiCandidates.map(
    (candidate) => candidate.section,
  );

  const ferrySections: FerrySection[] = ferries.map((ferry) => ({
    kind: "ferry",
    id: `ferry-${ferry.id}`,
    ferry,
    primaryDate: dateOnlyFromIso(ferry.departureAt),
    dates: [dateOnlyFromIso(ferry.departureAt)],
  }));

  const sections = [...staySections, ...ferrySections, ...standalonePoiSections];
  const standalonePoiOrder = new Map(
    standalonePoiSections.map((section, index) => [section.id, index]),
  );

  return sections.sort((a, b) => {
    if (a.primaryDate !== b.primaryDate) {
      return a.primaryDate.localeCompare(b.primaryDate);
    }

    const rankDelta = sectionTypeRankForDay(a) - sectionTypeRankForDay(b);
    if (rankDelta !== 0) {
      return rankDelta;
    }

    if (a.kind === "standalone_poi" && b.kind === "standalone_poi") {
      return (standalonePoiOrder.get(a.id) ?? 0) - (standalonePoiOrder.get(b.id) ?? 0);
    }

    return getSectionTimeMillis(a) - getSectionTimeMillis(b);
  });
};

export const sectionMatchesDate = (section: ItinerarySection, date: string): boolean => {
  return section.dates.includes(date);
};

export const getTodayTargetSections = (trip: Trip): ItinerarySection[] => {
  const today = todayDateInTimezone();
  return getItinerarySections(trip).filter((section) => sectionMatchesDate(section, today));
};

export const findStopById = (trip: Trip, stopId: string): TripStop | null => {
  return trip.stops.find((stop) => stop.id === stopId) ?? null;
};

export const getSelectedEntityPrimaryDate = (trip: Trip, selectedEntity: SelectedEntity): string | null => {
  if (!selectedEntity) {
    return null;
  }

  const stop = findStopById(trip, selectedEntity.stopId);
  if (!stop) {
    return null;
  }

  return getPrimaryDateForStop(stop);
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

  const sections = getItinerarySections(trip);

  const orderedStops: TripStop[] = [];
  sections.forEach((section) => {
    if (section.kind === "ferry") {
      orderedStops.push(section.ferry);
      return;
    }

    if (section.kind === "standalone_poi") {
      orderedStops.push(section.poi);
      return;
    }

    orderedStops.push(section.stay, ...section.pois);
  });

  let previous = trip.home;

  orderedStops.forEach((stop) => {
    if (stop.type === "stay") {
      markers.push({
        ...markerForPlace(stop.id, "stay", stop.place, stop.title),
        stopId: stop.id,
        entityKind: "stay",
      });
      segments.push({
        id: `road-${stop.id}`,
        type: "road",
        from: previous.coordinates,
        to: stop.place.coordinates,
        stopId: stop.id,
        entityKind: "stay",
      });
      previous = stop.place;
      return;
    }

    if (stop.type === "point_of_interest") {
      markers.push({
        ...markerForPlace(stop.id, "poi", stop.place, stop.title),
        stopId: stop.id,
        entityKind: "point_of_interest",
      });
      segments.push({
        id: `road-${stop.id}`,
        type: "road",
        from: previous.coordinates,
        to: stop.place.coordinates,
        stopId: stop.id,
        entityKind: "point_of_interest",
      });
      previous = stop.place;
      return;
    }

    markers.push(
      {
        ...markerForPlace(`${stop.id}-dep`, "ferry_port", stop.departurePort, `${stop.title} departure`),
        stopId: stop.id,
        entityKind: "ferry",
        ferryPart: "departure",
      },
      {
        ...markerForPlace(`${stop.id}-arr`, "ferry_port", stop.arrivalPort, `${stop.title} arrival`),
        stopId: stop.id,
        entityKind: "ferry",
        ferryPart: "arrival",
      },
    );

    segments.push({
      id: `road-pre-${stop.id}`,
      type: "road",
      from: previous.coordinates,
      to: stop.departurePort.coordinates,
      stopId: stop.id,
      entityKind: "ferry",
    });

    segments.push({
      id: `ferry-${stop.id}`,
      type: "ferry",
      from: stop.departurePort.coordinates,
      to: stop.arrivalPort.coordinates,
      stopId: stop.id,
      entityKind: "ferry",
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
  if (stop.type === "stay") {
    return stayCoverageDatesInclusive(stop).includes(date);
  }

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
