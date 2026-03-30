import { Trip } from "@/types/trip";

const DB_NAME = "campervan_trip_planner_cache";
const DB_VERSION = 1;
const STORE_NAME = "trip_cache";
const ACTIVE_TRIP_KEY = "active_trip";
const FALLBACK_STORAGE_KEY = "campervan_trip_planner_cached_active_trip";

type CacheRecord = {
  key: string;
  payload: Trip;
  updatedAt: string;
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
      reject(request.error ?? new Error("Unable to open offline cache."));
    };

    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        database.createObjectStore(STORE_NAME, { keyPath: "key" });
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
      reject(request.error ?? new Error("Offline cache operation failed."));
    };

    transaction.oncomplete = () => {
      database.close();
      resolve((request.result as T) ?? null);
    };

    transaction.onerror = () => {
      database.close();
      reject(transaction.error ?? new Error("Offline cache transaction failed."));
    };
  });
};

const writeFallback = (trip: Trip) => {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(FALLBACK_STORAGE_KEY, JSON.stringify(trip));
};

const readFallback = (): Trip | null => {
  if (typeof window === "undefined") {
    return null;
  }

  const raw = window.localStorage.getItem(FALLBACK_STORAGE_KEY);
  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw) as Trip;
  } catch {
    return null;
  }
};

export const writeCachedActiveTrip = async (trip: Trip): Promise<void> => {
  writeFallback(trip);

  try {
    await withStore("readwrite", (store) =>
      store.put({
        key: ACTIVE_TRIP_KEY,
        payload: trip,
        updatedAt: new Date().toISOString(),
      } satisfies CacheRecord),
    );
  } catch {
    // Local storage fallback is already updated.
  }
};

export const readCachedActiveTrip = async (): Promise<Trip | null> => {
  try {
    const record = await withStore<CacheRecord | undefined>("readonly", (store) =>
      store.get(ACTIVE_TRIP_KEY),
    );

    if (record?.payload) {
      return record.payload;
    }
  } catch {
    // Continue to localStorage fallback.
  }

  return readFallback();
};

export const clearCachedActiveTrip = async (): Promise<void> => {
  if (typeof window !== "undefined") {
    window.localStorage.removeItem(FALLBACK_STORAGE_KEY);
  }

  try {
    await withStore("readwrite", (store) => store.delete(ACTIVE_TRIP_KEY));
  } catch {
    // Ignore cache cleanup failures.
  }
};
