import { differenceInCalendarDays, parseISO } from "date-fns";

import {
  addMinutesIso,
  buildDateRange,
  dateOnlyFromIso,
  formatDate,
  formatDateOnly,
  formatDateTime,
  formatDurationMinutes,
  minutesBetweenIso,
  todayDateInTimezone,
} from "@/lib/date";
import { getPlaceRoutingCoordinates } from "@/lib/placeRouting";
import {
  Coordinates,
  FerrySection,
  FerryStop,
  GapWarning,
  ItineraryDay,
  ItinerarySection,
  ItineraryTimelineRow,
  MapMarker,
  MapRoadRenderState,
  RouteLineString,
  MapSegment,
  PlaceRef,
  PointOfInterestStop,
  SelectedEntityDetails,
  SelectedEntity,
  StandalonePoiSection,
  StayGroupSection,
  StayStop,
  TodayAction,
  TravelLegEstimate,
  TravelLegRequest,
  Trip,
  TripStop,
  ValidationWarning,
} from "@/types/trip";

type TravelLegContext = {
  id: string;
  fromId: string;
  fromLabel: string;
  from: PlaceRef;
  fromEventEndAt?: string;
  toId: string;
  toLabel: string;
  to: PlaceRef;
  date: string;
  relatedStopId?: string;
  targetArrivalBy?: string;
  targetArrivalLabel?: string;
};

const DRIVE_DAY_WARNING_MINUTES = 240;
const DRIVE_DAY_HIGH_MINUTES = 360;
const LONG_LEG_WARNING_MINUTES = 180;
const LATE_ARRIVAL_HOUR = 20;
const LATE_ARRIVAL_MINUTE = 30;

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

const getCurrentBaseForStandalonePoi = (
  poi: PointOfInterestStop,
  trip: Trip,
  stays: StayStop[],
): PlaceRef => {
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

export const getActiveStayForDate = (trip: Trip, date: string): StayStop | null => {
  const stays = sortStaysByCheckIn(
    trip.stops.filter((stop): stop is StayStop => stop.type === "stay"),
  ).filter((stay) => stayCoverageDatesInclusive(stay).includes(date));

  return stays.length > 0 ? stays[stays.length - 1] : null;
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

const cloneCoordinates = (coordinates: Coordinates): Coordinates => ({
  lat: coordinates.lat,
  lng: coordinates.lng,
});

const anchorRouteGeometry = (
  geometry: RouteLineString | undefined,
  from: Coordinates,
  to: Coordinates,
): RouteLineString | undefined => {
  if (!geometry || geometry.coordinates.length < 2) {
    return undefined;
  }

  const coordinates = geometry.coordinates.map(cloneCoordinates);
  coordinates[0] = cloneCoordinates(from);
  coordinates[coordinates.length - 1] = cloneCoordinates(to);

  return {
    type: "LineString",
    coordinates,
  };
};

const getOrderedStopsForTravel = (trip: Trip): TripStop[] => {
  return sortStopsByOrder(trip.stops);
};

const getStopTimingAnchor = (stop: TripStop): string | undefined => {
  if (stop.type === "stay") {
    return stop.checkOutAt;
  }

  if (stop.type === "ferry") {
    return stop.arrivalAt;
  }

  return undefined;
};

const buildTravelLegContexts = (trip: Trip): TravelLegContext[] => {
  const orderedStops = getOrderedStopsForTravel(trip);
  const contexts: TravelLegContext[] = [];
  let previousPlace = trip.home;
  let previousId = "home";
  let previousLabel = `Home: ${trip.home.label}`;
  let previousEventEndAt: string | undefined;

  orderedStops.forEach((stop) => {
    if (stop.type === "stay") {
      contexts.push({
        id: `road-${previousId}-${stop.id}`,
        fromId: previousId,
        fromLabel: previousLabel,
        from: previousPlace,
        fromEventEndAt: previousEventEndAt,
        toId: stop.id,
        toLabel: stop.title,
        to: stop.place,
        date: dateOnlyFromIso(stop.checkInAt),
        relatedStopId: stop.id,
        targetArrivalBy: stop.checkInAt,
        targetArrivalLabel: "planned campsite arrival",
      });
      previousPlace = stop.place;
      previousId = stop.id;
      previousLabel = stop.title;
      previousEventEndAt = getStopTimingAnchor(stop);
      return;
    }

    if (stop.type === "point_of_interest") {
      contexts.push({
        id: `road-${previousId}-${stop.id}`,
        fromId: previousId,
        fromLabel: previousLabel,
        from: previousPlace,
        fromEventEndAt: previousEventEndAt,
        toId: stop.id,
        toLabel: stop.title,
        to: stop.place,
        date: stop.visitDate,
        relatedStopId: stop.id,
      });
      previousPlace = stop.place;
      previousId = stop.id;
      previousLabel = stop.title;
      previousEventEndAt = getStopTimingAnchor(stop);
      return;
    }

    contexts.push({
      id: `road-${previousId}-${stop.id}`,
      fromId: previousId,
      fromLabel: previousLabel,
      from: previousPlace,
      fromEventEndAt: previousEventEndAt,
      toId: stop.id,
      toLabel: `${stop.title} departure`,
      to: stop.departurePort,
      date: dateOnlyFromIso(stop.departureAt),
      relatedStopId: stop.id,
      targetArrivalBy: stop.checkInBy,
      targetArrivalLabel: "ferry check-in",
    });
    previousPlace = stop.arrivalPort;
    previousId = stop.id;
    previousLabel = stop.title;
    previousEventEndAt = getStopTimingAnchor(stop);
  });

  return contexts;
};

export const getItineraryDays = (
  trip: Trip,
  estimates: TravelLegEstimate[] = [],
): ItineraryDay[] => {
  const days = getTripDays(trip);
  const contexts = buildTravelLegContexts(trip);
  const contextByStopId = new Map(
    contexts.flatMap((context) =>
      context.relatedStopId ? [[context.relatedStopId, context] as const] : [],
    ),
  );
  const estimateByContextId = new Map(estimates.map((estimate) => [estimate.id, estimate]));
  const orderedStops = getOrderedStopsForTravel(trip);

  return days.map((date) => {
    const rows: ItineraryTimelineRow[] = [];

    orderedStops.forEach((stop) => {
      const stopDate = getPrimaryDateForStop(stop);
      if (stopDate !== date) {
        return;
      }

      const context = contextByStopId.get(stop.id);
      if (context) {
        rows.push({
          kind: "travel",
          id: context.id,
          date,
          fromLabel: context.fromLabel,
          toLabel: context.toLabel,
          relatedStopId: stop.id,
          estimate: estimateByContextId.get(context.id) ?? null,
        });
      }

      rows.push({
        kind: "stop",
        id: stop.id,
        date,
        stop,
      });
    });

    const travelRows = rows.filter(
      (row): row is Extract<ItineraryTimelineRow, { kind: "travel" }> => row.kind === "travel",
    );

    return {
      date,
      activeStay: getActiveStayForDate(trip, date),
      rows,
      stopCount: rows.filter((row) => row.kind === "stop").length,
      roadLegCount: travelRows.length,
      liveRoadLegCount: travelRows.filter((row) => row.estimate?.confidence === "live").length,
      fallbackRoadLegCount: travelRows.filter((row) => row.estimate?.confidence === "fallback").length,
      pendingRoadLegCount: travelRows.filter((row) => !row.estimate).length,
      bufferedDriveMinutes: travelRows.reduce(
        (total, row) => total + (row.estimate?.bufferedDurationMinutes ?? 0),
        0,
      ),
    };
  });
};

export const buildTravelEstimateRequests = (
  trip: Trip,
): TravelLegRequest[] => {
  return buildTravelLegContexts(trip).map((context) => ({
    id: context.id,
    fromId: context.fromId,
    fromLabel: context.fromLabel,
    toId: context.toId,
    toLabel: context.toLabel,
    date: context.date,
    relatedStopId: context.relatedStopId,
    from: getPlaceRoutingCoordinates(context.from),
    to: getPlaceRoutingCoordinates(context.to),
  }));
};

export const buildTravelLegSignature = (requests: TravelLegRequest[]): string => {
  if (requests.length === 0) {
    return "";
  }

  return requests
    .map((request) =>
      [
        request.id,
        request.date,
        request.relatedStopId ?? "",
        request.fromId,
        request.toId,
        request.from.lat.toFixed(5),
        request.from.lng.toFixed(5),
        request.to.lat.toFixed(5),
        request.to.lng.toFixed(5),
      ].join(":"),
    )
    .join("|");
};

export const getTravelSummary = (estimates: TravelLegEstimate[]): {
  totalDistanceKm: number;
  totalBufferedMinutes: number;
} => {
  return estimates.reduce(
    (acc, estimate) => {
      acc.totalDistanceKm += estimate.distanceKm;
      acc.totalBufferedMinutes += estimate.bufferedDurationMinutes;
      return acc;
    },
    { totalDistanceKm: 0, totalBufferedMinutes: 0 },
  );
};

export const getSelectedEntityDetails = (
  trip: Trip,
  selectedEntity: SelectedEntity,
  estimates: TravelLegEstimate[] = [],
): SelectedEntityDetails | null => {
  if (!selectedEntity) {
    return null;
  }

  const stop = findStopById(trip, selectedEntity.stopId);
  if (!stop) {
    return null;
  }

  const contexts = buildTravelLegContexts(trip);
  const context = contexts.find((item) => item.relatedStopId === stop.id);
  const estimate = context ? estimates.find((item) => item.id === context.id) ?? null : null;

  return {
    stop,
    primaryDate: getPrimaryDateForStop(stop),
    travelEstimate: estimate,
  };
};

export const getValidationWarnings = (
  trip: Trip,
  estimates: TravelLegEstimate[],
): ValidationWarning[] => {
  const warnings: ValidationWarning[] = getGapWarnings(trip).map((warning) => ({
    id: `coverage-${warning.date}`,
    kind: "coverage_gap",
    severity: "medium",
    label: warning.label,
    detail: "Add or adjust an overnight base to keep the on-road plan grounded.",
    date: warning.date,
  }));

  const estimateById = new Map(estimates.map((estimate) => [estimate.id, estimate]));
  const contexts = buildTravelLegContexts(trip);
  const driveMinutesByDate = new Map<string, number>();
  const estimateDates = new Set<string>();
  const fallbackOnlyDates = new Set<string>();
  const datesWithLiveEstimates = new Set<string>();

  contexts.forEach((context) => {
    const estimate = estimateById.get(context.id);
    if (!estimate) {
      return;
    }

    estimateDates.add(estimate.date);
    driveMinutesByDate.set(
      estimate.date,
      (driveMinutesByDate.get(estimate.date) ?? 0) + estimate.bufferedDurationMinutes,
    );

    if (estimate.confidence === "fallback") {
      if (!datesWithLiveEstimates.has(estimate.date)) {
        fallbackOnlyDates.add(estimate.date);
      }
    } else {
      datesWithLiveEstimates.add(estimate.date);
      fallbackOnlyDates.delete(estimate.date);
    }

    if (estimate.bufferedDurationMinutes >= LONG_LEG_WARNING_MINUTES) {
      warnings.push({
        id: `travel-feasibility-${estimate.id}`,
        kind: "travel_feasibility",
        severity: estimate.bufferedDurationMinutes >= 240 ? "high" : "medium",
        label: `${estimate.toLabel} is a long campervan drive`,
        detail: `Buffered travel time is ${formatDurationMinutes(
          estimate.bufferedDurationMinutes,
        )}. Consider breaking the leg up or moving the stop.`,
        date: estimate.date,
        relatedStopId: estimate.relatedStopId,
      });
    }

    if (context.fromEventEndAt && context.targetArrivalBy) {
      const estimatedArrivalAt = addMinutesIso(
        context.fromEventEndAt,
        estimate.bufferedDurationMinutes,
      );

      if (estimatedArrivalAt > context.targetArrivalBy) {
        warnings.push({
          id: `timing-${estimate.id}`,
          kind:
            context.targetArrivalLabel === "ferry check-in" ? "ferry_check_in" : "arrival_window",
          severity: "high",
          label:
            context.targetArrivalLabel === "ferry check-in"
              ? `Risk of missing check-in for ${estimate.toLabel}`
              : `Late arrival risk for ${estimate.toLabel}`,
          detail: `Buffered arrival would be ${formatDateTime(
            estimatedArrivalAt,
          )}, later than ${context.targetArrivalLabel} at ${formatDateTime(context.targetArrivalBy)}.`,
          date: estimate.date,
          relatedStopId: estimate.relatedStopId,
        });
      } else if (
        context.targetArrivalLabel === "ferry check-in" &&
        minutesBetweenIso(estimatedArrivalAt, context.targetArrivalBy) <= 20
      ) {
        warnings.push({
          id: `timing-tight-${estimate.id}`,
          kind: "ferry_check_in",
          severity: "medium",
          label: `${estimate.toLabel} has a tight ferry check-in window`,
          detail: `Buffered arrival only leaves ${formatDurationMinutes(
            minutesBetweenIso(estimatedArrivalAt, context.targetArrivalBy),
          )} before check-in.`,
          date: estimate.date,
          relatedStopId: estimate.relatedStopId,
        });
      }
    }

    const relatedStop = context.relatedStopId ? findStopById(trip, context.relatedStopId) : null;
    if (
      relatedStop?.type === "stay" &&
      context.fromEventEndAt &&
      estimate.bufferedDurationMinutes >= 90
    ) {
      const estimatedArrivalAt = addMinutesIso(
        context.fromEventEndAt,
        estimate.bufferedDurationMinutes,
      );
      const arrivalHourMinutes =
        Number.parseInt(estimatedArrivalAt.slice(11, 13), 10) * 60 +
        Number.parseInt(estimatedArrivalAt.slice(14, 16), 10);

      if (arrivalHourMinutes >= LATE_ARRIVAL_HOUR * 60 + LATE_ARRIVAL_MINUTE) {
        warnings.push({
          id: `late-arrival-${estimate.id}`,
          kind: "arrival_window",
          severity: "medium",
          label: `Late campsite arrival risk for ${relatedStop.title}`,
          detail: `Buffered arrival lands around ${formatDateTime(
            estimatedArrivalAt,
          )}. Consider easing the day or choosing a closer overnight stop.`,
          date: estimate.date,
          relatedStopId: relatedStop.id,
        });
      }
    }
  });

  Array.from(driveMinutesByDate.entries()).forEach(([date, bufferedMinutes]) => {
    if (bufferedMinutes < DRIVE_DAY_WARNING_MINUTES) {
      return;
    }

    warnings.push({
      id: `drive-day-${date}`,
      kind: "drive_day",
      severity: bufferedMinutes >= DRIVE_DAY_HIGH_MINUTES ? "high" : "medium",
      label: `Heavy drive day on ${formatDateOnly(date)}`,
      detail: `Buffered road travel totals ${formatDurationMinutes(
        bufferedMinutes,
      )} for this day.`,
      date,
    });
  });

  estimateDates.forEach((date) => {
    if (!fallbackOnlyDates.has(date)) {
      return;
    }

    const hasRiskWarning = warnings.some(
      (warning) =>
        warning.date === date &&
        warning.kind !== "coverage_gap" &&
        warning.kind !== "route_confidence",
    );

    warnings.push({
      id: `route-confidence-${date}`,
      kind: "route_confidence",
      severity: hasRiskWarning ? "medium" : "low",
      label: hasRiskWarning
        ? `Risky travel day on ${formatDateOnly(date)} is using fallback timings`
        : `Route timings for ${formatDateOnly(date)} are using fallback estimates`,
      detail: hasRiskWarning
        ? "Live routing is unavailable for this day, so travel warnings are based on fallback estimates."
        : "These timings are using fallback road estimates instead of live OpenRouteService data.",
      date,
    });
  });

  return warnings.sort((a, b) => {
    const severityRank = { high: 0, medium: 1, low: 2 } as const;
    const leftDate = a.date ?? "";
    const rightDate = b.date ?? "";

    if (severityRank[a.severity] !== severityRank[b.severity]) {
      return severityRank[a.severity] - severityRank[b.severity];
    }

    if (leftDate !== rightDate) {
      return leftDate.localeCompare(rightDate);
    }

    return a.label.localeCompare(b.label);
  });
};

export const getMapData = (
  trip: Trip,
  estimates: TravelLegEstimate[] = [],
): {
  markers: MapMarker[];
  segments: MapSegment[];
} => {
  const markers: MapMarker[] = [markerForPlace("home", "home", trip.home, `Home: ${trip.home.label}`)];
  const segments: MapSegment[] = [];
  const roadEstimateByStopId = new Map(
    estimates.flatMap((estimate) => {
      if (estimate.kind !== "road" || !estimate.relatedStopId) {
        return [];
      }

      return [[estimate.relatedStopId, estimate] as const];
    }),
  );
  const roadEstimateById = new Map(
    estimates.flatMap((estimate) => (estimate.kind === "road" ? [[estimate.id, estimate] as const] : [])),
  );
  const roadContextIdByStopId = new Map(
    buildTravelLegContexts(trip).flatMap((context) => {
      if (!context.relatedStopId) {
        return [];
      }

      return [[context.relatedStopId, context.id] as const];
    }),
  );

  const getRoadEstimateForStop = (stopId: string): TravelLegEstimate | undefined => {
    const estimate = roadEstimateByStopId.get(stopId);
    if (estimate) {
      return estimate;
    }

    const contextId = roadContextIdByStopId.get(stopId);
    return contextId ? roadEstimateById.get(contextId) : undefined;
  };

  const getRoadSegmentRouteState = (
    stopId: string,
  ): {
    routeStatus: MapRoadRenderState;
    routeConfidence?: TravelLegEstimate["confidence"];
  } => {
    const estimate = getRoadEstimateForStop(stopId);

    if (!estimate) {
      return {
        routeStatus: "pending",
      };
    }

    if (estimate.confidence === "live" && estimate.geometry?.coordinates.length) {
      return {
        routeStatus: "live",
        routeConfidence: estimate.confidence,
      };
    }

    return {
      routeStatus: "fallback",
      routeConfidence: estimate.confidence,
    };
  };

  const orderedStops = getOrderedStopsForTravel(trip);
  let previous = trip.home;

  orderedStops.forEach((stop) => {
    if (stop.type === "stay") {
      const roadEstimate = getRoadEstimateForStop(stop.id);
      const roadState = getRoadSegmentRouteState(stop.id);
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
        geometry: anchorRouteGeometry(
          roadEstimate?.geometry,
          previous.coordinates,
          stop.place.coordinates,
        ),
        routeStatus: roadState.routeStatus,
        routeConfidence: roadState.routeConfidence,
      });
      previous = stop.place;
      return;
    }

    if (stop.type === "point_of_interest") {
      const roadEstimate = getRoadEstimateForStop(stop.id);
      const roadState = getRoadSegmentRouteState(stop.id);
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
        geometry: anchorRouteGeometry(
          roadEstimate?.geometry,
          previous.coordinates,
          stop.place.coordinates,
        ),
        routeStatus: roadState.routeStatus,
        routeConfidence: roadState.routeConfidence,
      });
      previous = stop.place;
      return;
    }

    const roadEstimate = getRoadEstimateForStop(stop.id);
    const roadState = getRoadSegmentRouteState(stop.id);

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
      geometry: anchorRouteGeometry(
        roadEstimate?.geometry,
        previous.coordinates,
        stop.departurePort.coordinates,
      ),
      routeStatus: roadState.routeStatus,
      routeConfidence: roadState.routeConfidence,
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

export const applyDefaultCheckInBy = (
  departureIso: string,
  checkInBufferMinutes: number = 45,
): string => {
  return addMinutesIso(departureIso, -checkInBufferMinutes);
};

export const ensureStopOrder = (stops: TripStop[]): TripStop[] => {
  return sortStopsByOrder(stops).map((stop, index) => ({
    ...stop,
    order: index,
  }));
};

export const reorderStopsById = (
  stops: TripStop[],
  activeId: string,
  overId: string,
): TripStop[] => {
  const orderedStops = sortStopsByOrder(stops);
  const activeIndex = orderedStops.findIndex((stop) => stop.id === activeId);
  const overIndex = orderedStops.findIndex((stop) => stop.id === overId);

  if (activeIndex === -1 || overIndex === -1 || activeIndex === overIndex) {
    return orderedStops.map((stop, index) => ({
      ...stop,
      order: index,
    }));
  }

  const nextStops = [...orderedStops];
  const [movedStop] = nextStops.splice(activeIndex, 1);
  nextStops.splice(overIndex, 0, movedStop);

  return nextStops.map((stop, index) => ({
    ...stop,
    order: index,
  }));
};

export const moveStopByOffset = (
  stops: TripStop[],
  stopId: string,
  offset: -1 | 1,
): TripStop[] => {
  const orderedStops = sortStopsByOrder(stops);
  const index = orderedStops.findIndex((stop) => stop.id === stopId);
  const targetIndex = index + offset;

  if (index === -1 || targetIndex < 0 || targetIndex >= orderedStops.length) {
    return orderedStops.map((stop, itemIndex) => ({
      ...stop,
      order: itemIndex,
    }));
  }

  return reorderStopsById(orderedStops, stopId, orderedStops[targetIndex].id);
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
