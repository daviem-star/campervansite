export type StopType = "stay" | "ferry" | "point_of_interest";
export type StopVisualKind = StopType;

export type Coordinates = {
  lat: number;
  lng: number;
};

export type PlaceRef = {
  label: string;
  coordinates: Coordinates;
  osmId?: string;
  osmType?: string;
};

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
  createdAt: string;
  updatedAt: string;
};

export type AppDataV1 = {
  schemaVersion: 1;
  activeTripId: string;
  trips: Trip[];
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

export type MapSegment = {
  id: string;
  type: MapSegmentType;
  from: Coordinates;
  to: Coordinates;
  stopId?: string;
  entityKind?: StopType;
};

export type SelectedEntity = {
  kind: StopType;
  stopId: string;
} | null;

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
