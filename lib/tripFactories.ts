import { APP_TIMEZONE, nowIso } from "@/lib/date";
import { getSeedData } from "@/lib/seedData";
import { CreateTripInput, PlaceRef, Trip } from "@/types/trip";

const buildTripId = (prefix: string): string => {
  return `trip_${prefix}_${crypto.randomUUID()}`;
};

const normalizeTripName = (name: string, fallback: string): string => {
  const trimmed = name.trim();
  return trimmed.length > 0 ? trimmed : fallback;
};

export const getExampleTripTemplate = (): Trip => {
  return structuredClone(getSeedData().trips[0]);
};

export const getExampleTripDefaultName = (): string => {
  return getExampleTripTemplate().name;
};

export const createBlankTrip = (
  ownerUserId: string,
  options: Pick<CreateTripInput, "name" | "home"> & { home: PlaceRef },
): Trip => {
  const createdAt = nowIso();

  return {
    id: buildTripId("blank"),
    name: normalizeTripName(options.name, "New trip"),
    timezone: APP_TIMEZONE,
    home: options.home,
    stops: [],
    ownerUserId,
    version: 1,
    createdAt,
    updatedAt: createdAt,
    lastSyncedAt: null,
  };
};

export const createExampleTrip = (
  ownerUserId: string,
  name: string = getExampleTripDefaultName(),
): Trip => {
  const template = getExampleTripTemplate();
  const createdAt = nowIso();

  return {
    ...template,
    id: buildTripId("example"),
    name: normalizeTripName(name, template.name),
    ownerUserId,
    routeSnapshot: null,
    version: 1,
    createdAt,
    updatedAt: createdAt,
    lastSyncedAt: null,
  };
};
