import { TravelLegEstimate } from "@/types/trip";
import { isOpenRouteServiceDebugEnabled } from "@/lib/runtimeFlags";

const DB_NAME = "campervan_trip_planner_route_cache";
const DB_VERSION = 1;
const STORE_NAME = "route_estimate_cache";

export const ROUTE_ESTIMATE_CACHE_FALLBACK_STORAGE_KEY =
  "campervan_trip_planner_route_estimate_cache";
export const ROUTE_ESTIMATE_CACHE_TTL_MS = 6 * 60 * 60 * 1000;

export type RouteEstimateCacheEntry = {
  signature: string;
  estimates: TravelLegEstimate[];
  cachedAt: string;
};

export type RouteEstimateCacheState = "fresh" | "stale" | "miss";

export type RouteEstimateCacheReadResult = {
  entry: RouteEstimateCacheEntry | null;
  state: RouteEstimateCacheState;
};

const canUseIndexedDb = (): boolean => {
  return typeof window !== "undefined" && typeof window.indexedDB !== "undefined";
};

const openDatabase = async (): Promise<IDBDatabase | null> => {
  if (!canUseIndexedDb()) {
    return null;
  }

  return await new Promise((resolve, reject) => {
    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => {
      reject(request.error ?? new Error("Unable to open route estimate cache."));
    };

    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        database.createObjectStore(STORE_NAME, { keyPath: "signature" });
      }
    };

    request.onsuccess = () => {
      resolve(request.result);
    };
  });
};

const withStore = async <T>(
  mode: IDBTransactionMode,
  handler: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T | null> => {
  const database = await openDatabase();
  if (!database) {
    return null;
  }

  return await new Promise((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, mode);
    const store = transaction.objectStore(STORE_NAME);
    const request = handler(store);

    request.onerror = () => {
      reject(request.error ?? new Error("Route estimate cache operation failed."));
    };

    transaction.oncomplete = () => {
      database.close();
      resolve((request.result as T) ?? null);
    };

    transaction.onerror = () => {
      database.close();
      reject(transaction.error ?? new Error("Route estimate cache transaction failed."));
    };
  });
};

const readFallbackEntries = (): Record<string, RouteEstimateCacheEntry> => {
  if (typeof window === "undefined") {
    return {};
  }

  const raw = window.localStorage.getItem(ROUTE_ESTIMATE_CACHE_FALLBACK_STORAGE_KEY);
  if (!raw) {
    return {};
  }

  try {
    const parsed = JSON.parse(raw) as Record<string, RouteEstimateCacheEntry>;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return {};
    }

    return parsed;
  } catch {
    return {};
  }
};

const writeFallbackEntries = (entries: Record<string, RouteEstimateCacheEntry>) => {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(
    ROUTE_ESTIMATE_CACHE_FALLBACK_STORAGE_KEY,
    JSON.stringify(entries),
  );
};

export const getRouteEstimateCacheState = (
  cachedAt: string,
  now: number = Date.now(),
): Exclude<RouteEstimateCacheState, "miss"> => {
  const cachedAtMillis = new Date(cachedAt).getTime();
  if (!Number.isFinite(cachedAtMillis)) {
    return "stale";
  }

  return now - cachedAtMillis <= ROUTE_ESTIMATE_CACHE_TTL_MS ? "fresh" : "stale";
};

export const readCachedRouteEstimateSet = async (
  signature: string,
  now: number = Date.now(),
): Promise<RouteEstimateCacheReadResult> => {
  if (isOpenRouteServiceDebugEnabled()) {
    return {
      entry: null,
      state: "miss",
    };
  }

  if (!signature) {
    return {
      entry: null,
      state: "miss",
    };
  }

  let entry: RouteEstimateCacheEntry | null = null;

  try {
    entry =
      (await withStore<RouteEstimateCacheEntry | undefined>("readonly", (store) =>
        store.get(signature),
      )) ?? null;
  } catch {
    entry = null;
  }

  if (!entry) {
    entry = readFallbackEntries()[signature] ?? null;
  }

  if (!entry) {
    return {
      entry: null,
      state: "miss",
    };
  }

  return {
    entry,
    state: getRouteEstimateCacheState(entry.cachedAt, now),
  };
};

export const writeCachedRouteEstimateSet = async (
  signature: string,
  estimates: TravelLegEstimate[],
  cachedAt: string = new Date().toISOString(),
): Promise<RouteEstimateCacheEntry> => {
  const entry: RouteEstimateCacheEntry = {
    signature,
    estimates,
    cachedAt,
  };

  if (isOpenRouteServiceDebugEnabled()) {
    return entry;
  }

  const fallbackEntries = readFallbackEntries();
  fallbackEntries[signature] = entry;
  writeFallbackEntries(fallbackEntries);

  try {
    await withStore("readwrite", (store) => store.put(entry));
  } catch {
    // Local storage fallback is already updated.
  }

  return entry;
};
