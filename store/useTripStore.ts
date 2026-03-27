"use client";

import { create } from "zustand";

import { nowIso } from "@/lib/date";
import { ensureStopOrder } from "@/lib/tripDerived";
import { isValidAppDataV1, LocalStorageTripRepository } from "@/lib/repository";
import { AppDataV1, NewTripStop, Trip, TripStop } from "@/types/trip";

const repository = new LocalStorageTripRepository();

const generateId = (): string => {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return `id_${Math.random().toString(36).slice(2, 11)}`;
};

type TripStoreState = {
  data: AppDataV1 | null;
  isLoading: boolean;
  error: string | null;
  loadData: () => Promise<void>;
  setActiveTrip: (tripId: string) => Promise<void>;
  createTrip: (name: string) => Promise<Trip | null>;
  deleteTrip: (tripId: string) => Promise<void>;
  resetToSeed: () => Promise<void>;
  resetToSeedAlignedToToday: () => Promise<void>;
  exportData: () => string | null;
  importData: (jsonText: string) => Promise<{ ok: true } | { ok: false; error: string }>;
  updateTrip: (nextTrip: Trip) => Promise<void>;
  addStop: (newStop: NewTripStop) => Promise<void>;
  updateStop: (stopId: string, updater: (stop: TripStop) => TripStop) => Promise<void>;
  deleteStop: (stopId: string) => Promise<void>;
  reorderStops: (activeId: string, overId: string) => Promise<void>;
};

const getActiveTrip = (data: AppDataV1): Trip | null => {
  return data.trips.find((trip) => trip.id === data.activeTripId) ?? null;
};

const saveData = async (
  set: (partial: Partial<TripStoreState>) => void,
  data: AppDataV1,
): Promise<void> => {
  await repository.save(data);
  set({ data, error: null });
};

const createBlankTrip = (name: string): Trip => {
  const timestamp = nowIso();
  const trimmedName = name.trim();
  return {
    id: generateId(),
    name: trimmedName.length > 0 ? trimmedName : "Untitled trip",
    timezone: "Europe/London",
    home: {
      label: "Set home location",
      coordinates: { lat: 56.0423, lng: -4.3649 },
    },
    stops: [],
    createdAt: timestamp,
    updatedAt: timestamp,
  };
};

const updateActiveTripInData = (
  data: AppDataV1,
  updater: (trip: Trip) => Trip,
): AppDataV1 => {
  return {
    ...data,
    trips: data.trips.map((trip) => {
      if (trip.id !== data.activeTripId) {
        return trip;
      }

      return updater(trip);
    }),
  };
};

export const useTripStore = create<TripStoreState>((set, get) => ({
  data: null,
  isLoading: false,
  error: null,

  loadData: async () => {
    set({ isLoading: true, error: null });

    try {
      const loaded = await repository.load();
      set({ data: loaded, isLoading: false, error: null });
    } catch (error) {
      set({
        isLoading: false,
        error: error instanceof Error ? error.message : "Failed to load trip data.",
      });
    }
  },

  setActiveTrip: async (tripId) => {
    const currentData = get().data;
    if (!currentData) {
      return;
    }

    const exists = currentData.trips.some((trip) => trip.id === tripId);
    if (!exists) {
      set({ error: "Trip not found." });
      return;
    }

    const nextData: AppDataV1 = {
      ...currentData,
      activeTripId: tripId,
    };

    await saveData(set, nextData);
  },

  createTrip: async (name) => {
    const currentData = get().data;
    if (!currentData) {
      return null;
    }

    const nextTrip = createBlankTrip(name);
    const nextData: AppDataV1 = {
      ...currentData,
      activeTripId: nextTrip.id,
      trips: [...currentData.trips, nextTrip],
    };

    await saveData(set, nextData);
    return nextTrip;
  },

  deleteTrip: async (tripId) => {
    const currentData = get().data;
    if (!currentData) {
      return;
    }

    if (currentData.trips.length <= 1) {
      set({ error: "At least one trip must remain." });
      return;
    }

    const remaining = currentData.trips.filter((trip) => trip.id !== tripId);
    if (remaining.length === currentData.trips.length) {
      return;
    }

    const nextActiveTripId =
      currentData.activeTripId === tripId ? remaining[0]?.id ?? currentData.activeTripId : currentData.activeTripId;
    const nextData: AppDataV1 = {
      ...currentData,
      activeTripId: nextActiveTripId,
      trips: remaining,
    };

    await saveData(set, nextData);
  },

  resetToSeed: async () => {
    const seed = await repository.resetToSeed();
    set({ data: seed, error: null });
  },

  resetToSeedAlignedToToday: async () => {
    const shifted = await repository.resetToSeedAlignedToToday();
    set({ data: shifted, error: null });
  },

  exportData: () => {
    const currentData = get().data;
    if (!currentData) {
      return null;
    }

    return JSON.stringify(currentData, null, 2);
  },

  importData: async (jsonText) => {
    try {
      const parsed: unknown = JSON.parse(jsonText);
      if (!isValidAppDataV1(parsed)) {
        return { ok: false, error: "Invalid trip data format." };
      }

      await saveData(set, parsed);
      return { ok: true };
    } catch {
      return { ok: false, error: "Could not parse JSON file." };
    }
  },

  updateTrip: async (nextTrip) => {
    const currentData = get().data;
    if (!currentData) {
      return;
    }

    const normalizedTrip: Trip = {
      ...nextTrip,
      stops: ensureStopOrder(nextTrip.stops),
      updatedAt: nowIso(),
    };

    const nextData = {
      ...currentData,
      trips: currentData.trips.map((trip) =>
        trip.id === currentData.activeTripId ? normalizedTrip : trip,
      ),
    };

    await saveData(set, nextData);
  },

  addStop: async (newStop) => {
    const currentData = get().data;
    if (!currentData) {
      return;
    }

    const activeTrip = getActiveTrip(currentData);
    if (!activeTrip) {
      return;
    }

    const stop: TripStop = {
      ...newStop,
      id: generateId(),
      order: activeTrip.stops.length,
    } as TripStop;

    const nextData = updateActiveTripInData(currentData, (trip) => ({
      ...trip,
      stops: ensureStopOrder([...trip.stops, stop]),
      updatedAt: nowIso(),
    }));

    await saveData(set, nextData);
  },

  updateStop: async (stopId, updater) => {
    const currentData = get().data;
    if (!currentData) {
      return;
    }

    const nextData = updateActiveTripInData(currentData, (trip) => ({
      ...trip,
      stops: ensureStopOrder(trip.stops.map((stop) => (stop.id === stopId ? updater(stop) : stop))),
      updatedAt: nowIso(),
    }));

    await saveData(set, nextData);
  },

  deleteStop: async (stopId) => {
    const currentData = get().data;
    if (!currentData) {
      return;
    }

    const nextData = updateActiveTripInData(currentData, (trip) => ({
      ...trip,
      stops: ensureStopOrder(trip.stops.filter((stop) => stop.id !== stopId)),
      updatedAt: nowIso(),
    }));

    await saveData(set, nextData);
  },

  reorderStops: async (activeId, overId) => {
    const currentData = get().data;
    if (!currentData || activeId === overId) {
      return;
    }

    const nextData = updateActiveTripInData(currentData, (trip) => {
      const sorted = ensureStopOrder(trip.stops);
      const activeIndex = sorted.findIndex((stop) => stop.id === activeId);
      const overIndex = sorted.findIndex((stop) => stop.id === overId);

      if (activeIndex < 0 || overIndex < 0) {
        return trip;
      }

      const [moved] = sorted.splice(activeIndex, 1);
      sorted.splice(overIndex, 0, moved);

      return {
        ...trip,
        stops: ensureStopOrder(sorted),
        updatedAt: nowIso(),
      };
    });

    await saveData(set, nextData);
  },
}));
