import { getSeedData } from "@/lib/seedData";
import { AppDataV1 } from "@/types/trip";

const STORAGE_KEY = "campervan_trip_planner_v1";

export interface TripRepository {
  load(): Promise<AppDataV1>;
  save(data: AppDataV1): Promise<void>;
  resetToSeed(): Promise<AppDataV1>;
}

const isValidAppDataV1 = (value: unknown): value is AppDataV1 => {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Partial<AppDataV1>;
  return (
    candidate.schemaVersion === 1 &&
    typeof candidate.activeTripId === "string" &&
    Array.isArray(candidate.trips)
  );
};

export class LocalStorageTripRepository implements TripRepository {
  async load(): Promise<AppDataV1> {
    if (typeof window === "undefined") {
      return getSeedData();
    }

    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      const seed = getSeedData();
      await this.save(seed);
      return seed;
    }

    try {
      const parsed: unknown = JSON.parse(raw);
      if (!isValidAppDataV1(parsed)) {
        const seed = getSeedData();
        await this.save(seed);
        return seed;
      }

      return parsed;
    } catch {
      const seed = getSeedData();
      await this.save(seed);
      return seed;
    }
  }

  async save(data: AppDataV1): Promise<void> {
    if (typeof window === "undefined") {
      return;
    }

    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }

  async resetToSeed(): Promise<AppDataV1> {
    const seed = getSeedData();
    await this.save(seed);
    return seed;
  }
}
