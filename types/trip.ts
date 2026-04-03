export type StopType = "stay" | "ferry" | "point_of_interest";
export type StopVisualKind = StopType;

export type Coordinates = {
  lat: number;
  lng: number;
};

export type PlaceRef = {
  label: string;
  coordinates: Coordinates;
  routingCoordinates?: Coordinates;
  osmId?: string;
  osmType?: string;
};

export type FerryVehicleType = "campervan" | "motorhome" | "car" | "van" | "other";

export type FerryVehicleDetails = {
  vehicleType: FerryVehicleType;
  registration?: string;
  lengthMeters?: number;
  notes?: string;
};

export type StayBookingStatus = "planned" | "booked" | "confirmed";

export type BaseStop = {
  id: string;
  type: StopType;
  title: string;
  notes?: string;
  order: number;
};

export type StayStop = BaseStop & {
  type: "stay";
  place: PlaceRef;
  checkInAt: string;
  checkOutAt: string;
  costPerNight?: number;
  bookingStatus?: StayBookingStatus;
  hookup?: boolean;
  hardstanding?: boolean;
  amenitiesSummary?: string;
  phone?: string;
  websiteUrl?: string;
};

export type FerryStop = BaseStop & {
  type: "ferry";
  departurePort: PlaceRef;
  arrivalPort: PlaceRef;
  departureAt: string;
  arrivalAt: string;
  checkInBy: string;
  operator?: string;
  bookingRef?: string;
  vehicleDetails?: FerryVehicleDetails;
  checkInBufferMinutes?: number;
};

export type PointOfInterestStop = BaseStop & {
  type: "point_of_interest";
  place: PlaceRef;
  visitDate: string;
};

export type TripStop = StayStop | FerryStop | PointOfInterestStop;
export type NewTripStop =
  | Omit<StayStop, "id" | "order">
  | Omit<FerryStop, "id" | "order">
  | Omit<PointOfInterestStop, "id" | "order">;

export type Trip = {
  id: string;
  name: string;
  timezone: "Europe/London";
  home: PlaceRef;
  stops: TripStop[];
  ownerUserId: string | null;
  version: number;
  createdAt: string;
  updatedAt: string;
  lastSyncedAt: string | null;
};

export type TripSummary = {
  id: string;
  name: string;
  version: number;
  updatedAt: string;
  lastSyncedAt: string | null;
};

export type CreateTripSource = "blank" | "example";

export type CreateTripInput = {
  source: CreateTripSource;
  name: string;
  home?: PlaceRef;
};

export type RenameTripInput = {
  name: string;
};

export type DeleteTripResponse = {
  deletedTripId: string;
};

export type AppData = {
  schemaVersion: 2;
  activeTripId: string;
  trips: Trip[];
};

export type LegacyTrip = Omit<Trip, "ownerUserId" | "version" | "lastSyncedAt"> &
  Partial<Pick<Trip, "ownerUserId" | "version" | "lastSyncedAt">>;

export type LegacyAppData = {
  schemaVersion: 1;
  activeTripId: string;
  trips: LegacyTrip[];
};

export type GeocodeResult = {
  label: string;
  lat: number;
  lng: number;
  osmId?: string;
  osmType?: string;
};

export type TodayActionType = "ferry_check_in" | "stay_checkout";

export type TodayAction = {
  id: string;
  type: TodayActionType;
  dueAt: string;
  departureAt?: string;
  label: string;
  detail: string;
  overdue: boolean;
};

export type GapWarning = {
  date: string;
  label: string;
};

export type ValidationWarningKind =
  | "drive_day"
  | "ferry_check_in"
  | "arrival_window"
  | "travel_feasibility"
  | "coverage_gap"
  | "route_confidence";

export type ValidationWarningSeverity = "high" | "medium" | "low";

export type ValidationWarning = {
  id: string;
  kind: ValidationWarningKind;
  severity: ValidationWarningSeverity;
  label: string;
  detail: string;
  date?: string;
  relatedStopId?: string;
};

export type TravelEstimateConfidence = "live" | "fallback";

export type TravelLegKind = "road";

export type PlannerNoticeTone = "info" | "success" | "warning";

export type PlannerNoticeSurface = "inline" | "account" | "auth";

export type PlannerNotice = {
  text: string;
  tone: PlannerNoticeTone;
  surface: PlannerNoticeSurface;
};

export type RouteLineString = {
  type: "LineString";
  coordinates: Coordinates[];
};

export type TravelLegRequest = {
  id: string;
  fromId: string;
  fromLabel: string;
  toId: string;
  toLabel: string;
  date: string;
  relatedStopId?: string;
  from: Coordinates;
  to: Coordinates;
};

export type TravelLegEstimate = {
  id: string;
  fromId: string;
  fromLabel: string;
  toId: string;
  toLabel: string;
  kind: TravelLegKind;
  distanceKm: number;
  durationMinutes: number;
  bufferedDurationMinutes: number;
  provider: string;
  fetchedAt: string;
  confidence: TravelEstimateConfidence;
  date: string;
  relatedStopId?: string;
  geometry?: RouteLineString;
};

export type SyncStatus = "idle" | "saving" | "saved" | "offline" | "error";

export type MapMarkerRole = "home" | "stay" | "poi" | "ferry_port";

export type MapMarker = {
  id: string;
  role: MapMarkerRole;
  label: string;
  coordinates: Coordinates;
  stopId?: string;
  entityKind?: StopType;
  ferryPart?: "departure" | "arrival";
};

export type MapSegmentType = "road" | "ferry";

export type MapRoadRenderState = "pending" | "live" | "fallback";

export type MapSegment = {
  id: string;
  type: MapSegmentType;
  from: Coordinates;
  to: Coordinates;
  stopId?: string;
  entityKind?: StopType;
  geometry?: RouteLineString;
  routeStatus?: MapRoadRenderState;
  routeConfidence?: TravelEstimateConfidence;
};

export type SelectedEntity =
  | {
      kind: StopType;
      stopId: string;
    }
  | null;

type BaseItinerarySection = {
  id: string;
  primaryDate: string;
  dates: string[];
};

export type StayGroupSection = BaseItinerarySection & {
  kind: "stay_group";
  stay: StayStop;
  pois: PointOfInterestStop[];
};

export type FerrySection = BaseItinerarySection & {
  kind: "ferry";
  ferry: FerryStop;
};

export type StandalonePoiSection = BaseItinerarySection & {
  kind: "standalone_poi";
  poi: PointOfInterestStop;
};

export type ItinerarySection = StayGroupSection | FerrySection | StandalonePoiSection;

export type ItineraryTimelineStopRow = {
  kind: "stop";
  id: string;
  date: string;
  stop: TripStop;
};

export type ItineraryTimelineTravelRow = {
  kind: "travel";
  id: string;
  date: string;
  fromLabel: string;
  toLabel: string;
  relatedStopId?: string;
  estimate: TravelLegEstimate | null;
};

export type ItineraryTimelineRow = ItineraryTimelineStopRow | ItineraryTimelineTravelRow;

export type ItineraryDay = {
  date: string;
  activeStay: StayStop | null;
  rows: ItineraryTimelineRow[];
  stopCount: number;
  roadLegCount: number;
  liveRoadLegCount: number;
  fallbackRoadLegCount: number;
  pendingRoadLegCount: number;
  bufferedDriveMinutes: number;
};

export type SelectedEntityDetails = {
  stop: TripStop;
  primaryDate: string;
  travelEstimate: TravelLegEstimate | null;
};

export type SessionUser = {
  id: string;
  email: string | null;
};
