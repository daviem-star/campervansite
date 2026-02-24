"use client";

import { create } from "zustand";

import { nowIso } from "@/lib/date";
import { ensureStopOrder } from "@/lib/tripDerived";
import { LocalStorageTripRepository } from "@/lib/repository";
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
  resetToSeed: () => Promise<void>;
  resetToSeedAlignedToToday: () => Promise<void>;
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

  resetToSeed: async () => {
    const seed = await repository.resetToSeed();
    set({ data: seed, error: null });
  },

  resetToSeedAlignedToToday: async () => {
    const shifted = await repository.resetToSeedAlignedToToday();
    set({ data: shifted, error: null });
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
