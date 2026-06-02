"use client";

import { create } from "zustand";

import { trackEvent } from "@/lib/analytics";
import { nowIso } from "@/lib/date";
import { createLocalTestBypassSession } from "@/lib/e2eAuth";
import { clearCachedActiveTrip, writeCachedActiveTrip } from "@/lib/offlineCache";
import {
  CloudTripRepository,
  createDemoAppDataFromTrip,
  getCachedTodayTripId,
  hasLegacyLocalTripData,
  hasResolvedFirstTripSetup,
  LegacyLocalStorageTripRepository,
  markFirstTripSetupResolved,
  readLegacyLocalTrips,
  setCachedTodayTripId,
  setPreferredLoadedTripId,
  TripConflictError,
} from "@/lib/repository";
import { getExampleTripDefaultName } from "@/lib/tripFactories";
import { tripToTripSummary } from "@/lib/tripDocuments";
import {
  BrowserAuthUser,
  emitBrowserE2ESignIn,
  getBrowserSupabaseClient,
  isSupabaseConfigured,
} from "@/lib/supabase";
import { canUseLocalTestSignIn, shouldForceDemoMode } from "@/lib/runtimeFlags";
import { ensureStopOrder } from "@/lib/tripDerived";
import {
  AppData,
  CreateTripInput,
  NewTripStop,
  PlannerNotice,
  PlannerNoticeSurface,
  PlannerNoticeTone,
  PersistedRouteSnapshot,
  RenameTripInput,
  SessionUser,
  SyncStatus,
  Trip,
  TripStop,
  TripSummary,
} from "@/types/trip";

const localRepository = new LegacyLocalStorageTripRepository();

let authListenerBound = false;
let connectivityListenersWindow: Window | null = null;
const pendingStarterTripLoads = new Map<string, Promise<Trip | null>>();
const pendingCloudTripSaves = new Map<string, Promise<void>>();

const getSupabaseClient = () => {
  return getBrowserSupabaseClient();
};

const mapUser = (user: BrowserAuthUser): SessionUser => ({
  id: user.id,
  email: user.email ?? null,
});

const getAccessToken = async (): Promise<string | null> => {
  const client = getSupabaseClient();
  if (!client) {
    return null;
  }

  const { data } = await client.auth.getSession();
  return data.session?.access_token ?? null;
};

const getCloudRepository = (): CloudTripRepository => new CloudTripRepository(getAccessToken);

const getActiveTrip = (data: AppData): Trip | null => {
  return data.trips.find((trip) => trip.id === data.activeTripId) ?? null;
};

const replaceActiveTrip = (data: AppData | null, nextTrip: Trip): AppData => {
  if (!data) {
    return createDemoAppDataFromTrip(nextTrip);
  }

  return {
    schemaVersion: 2,
    activeTripId: nextTrip.id,
    trips: [nextTrip],
  };
};

const sortTripSummaries = (summaries: TripSummary[]): TripSummary[] => {
  return [...summaries].sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
};

const upsertTripSummary = (summaries: TripSummary[], summary: TripSummary): TripSummary[] => {
  return sortTripSummaries([...summaries.filter((item) => item.id !== summary.id), summary]);
};

const removeTripSummary = (summaries: TripSummary[], tripId: string): TripSummary[] => {
  return sortTripSummaries(summaries.filter((summary) => summary.id !== tripId));
};

const mergeTripCacheEntry = (
  cache: Record<string, Trip>,
  trip: Trip,
): Record<string, Trip> => ({
  ...cache,
  [trip.id]: trip,
});

const mergeTripSyncMetadata = (trip: Trip, syncedTrip: Trip): Trip => ({
  ...trip,
  version: syncedTrip.version,
  lastSyncedAt: syncedTrip.lastSyncedAt,
});

const removeTripCacheEntry = (
  cache: Record<string, Trip>,
  tripId: string,
): Record<string, Trip> => {
  const nextCache = { ...cache };
  delete nextCache[tripId];
  return nextCache;
};

const createNotice = (
  text: string,
  surface: PlannerNoticeSurface,
  tone: PlannerNoticeTone = "info",
): PlannerNotice => ({
  text,
  surface,
  tone,
});

const describeTodayTripPreferenceError = (error: unknown): string => {
  if (!(error instanceof Error)) {
    return "Unable to update the Today trip.";
  }

  if (
    error.message.includes("user_trip_preferences") ||
    error.message.includes("Today trip preferences are not available")
  ) {
    return "Today trip sync needs the latest database migration before it can be saved.";
  }

  return error.message;
};

export type AuthStateChangeAction = "ignore" | "initialize" | "refresh_signed_in";

export const resolveAuthStateChangeAction = (params: {
  event: string;
  currentUserId: string | null;
  sessionUserId: string | null;
}): AuthStateChangeAction => {
  if (params.event === "SIGNED_OUT") {
    return "initialize";
  }

  if (params.event !== "SIGNED_IN") {
    return "ignore";
  }

  if (
    !params.currentUserId ||
    !params.sessionUserId ||
    params.currentUserId !== params.sessionUserId
  ) {
    return "initialize";
  }

  return "refresh_signed_in";
};

export const withPerUserLock = async <T>(
  pending: Map<string, Promise<T>>,
  userId: string,
  action: () => Promise<T>,
): Promise<T> => {
  const existing = pending.get(userId);
  if (existing) {
    return await existing;
  }

  const promise = action();
  pending.set(userId, promise);

  try {
    return await promise;
  } finally {
    if (pending.get(userId) === promise) {
      pending.delete(userId);
    }
  }
};

const enqueueCloudTripSave = async (
  tripId: string,
  action: () => Promise<void>,
): Promise<void> => {
  const previous = pendingCloudTripSaves.get(tripId) ?? Promise.resolve();
  const next = previous.catch(() => undefined).then(action);
  pendingCloudTripSaves.set(tripId, next);

  try {
    await next;
  } finally {
    if (pendingCloudTripSaves.get(tripId) === next) {
      pendingCloudTripSaves.delete(tripId);
    }
  }
};

const setLoadedCloudTripState = (
  set: (partial: Partial<TripStoreState>) => void,
  trip: Trip,
  options: {
    authStatus: AuthStatus;
    user: SessionUser;
    tripSummaries: TripSummary[];
    tripCache: Record<string, Trip>;
    todayTripId?: string | null;
    notice?: PlannerNotice | null;
    syncStatus?: SyncStatus;
    error?: string | null;
    isOfflineReadOnly?: boolean;
    hasLegacyImport?: boolean;
  },
) => {
  set({
    data: createDemoAppDataFromTrip(trip),
    tripSummaries: sortTripSummaries(
      options.tripSummaries.length > 0
        ? options.tripSummaries
        : [tripToTripSummary(trip)],
    ),
    isLoading: false,
    error: options.error ?? null,
    notice: options.notice ?? null,
    authStatus: options.authStatus,
    user: options.user,
    mode: "cloud",
    syncStatus: options.syncStatus ?? "saved",
    isOfflineReadOnly: options.isOfflineReadOnly ?? false,
    hasLegacyImport: options.hasLegacyImport ?? hasLegacyLocalTripData(),
    firstTripSetup: "none",
    plannerInteractionMode: "view",
    todayTripId: options.todayTripId ?? null,
    tripCache: mergeTripCacheEntry(options.tripCache, trip),
  });
};

const setSignedInLibraryState = (
  set: (partial: Partial<TripStoreState>) => void,
  options: {
    authStatus: AuthStatus;
    user: SessionUser;
    tripSummaries: TripSummary[];
    tripCache?: Record<string, Trip>;
    todayTripId?: string | null;
    notice?: PlannerNotice | null;
    syncStatus?: SyncStatus;
    error?: string | null;
    isOfflineReadOnly?: boolean;
    hasLegacyImport?: boolean;
    firstTripSetup?: FirstTripSetup;
  },
) => {
  set({
    data: null,
    tripSummaries: sortTripSummaries(options.tripSummaries),
    isLoading: false,
    error: options.error ?? null,
    notice: options.notice ?? null,
    authStatus: options.authStatus,
    user: options.user,
    mode: "cloud",
    syncStatus: options.syncStatus ?? "saved",
    isOfflineReadOnly: options.isOfflineReadOnly ?? false,
    hasLegacyImport: options.hasLegacyImport ?? hasLegacyLocalTripData(),
    firstTripSetup: options.firstTripSetup ?? "none",
    plannerInteractionMode: "view",
    todayTripId: options.todayTripId ?? null,
    tripCache: options.tripCache ?? {},
  });
};

type AuthStatus = "disabled" | "checking" | "signed_out" | "signed_in";
type PlannerMode = "demo" | "cloud";
type FirstTripSetup = "none" | "choose_source";
type PlannerInteractionMode = "view" | "edit";

declare global {
  interface Window {
    __plannerTestHooks__?: {
      emitSameUserSignedInAuthEvent: () => Promise<void>;
      refreshSignedInSession: () => Promise<void>;
    };
  }
}

type TripStoreState = {
  data: AppData | null;
  tripSummaries: TripSummary[];
  tripCache: Record<string, Trip>;
  todayTripId: string | null;
  isLoading: boolean;
  error: string | null;
  notice: PlannerNotice | null;
  authStatus: AuthStatus;
  mode: PlannerMode;
  user: SessionUser | null;
  syncStatus: SyncStatus;
  isOfflineReadOnly: boolean;
  hasLegacyImport: boolean;
  firstTripSetup: FirstTripSetup;
  plannerInteractionMode: PlannerInteractionMode;
  initialize: () => Promise<void>;
  refreshSignedInSession: () => Promise<void>;
  loadData: () => Promise<void>;
  signInWithMagicLink: (email: string) => Promise<void>;
  signInAsTestUser: () => Promise<void>;
  signOut: () => Promise<void>;
  refreshTripSummaries: () => Promise<void>;
  importLegacyTrips: () => Promise<void>;
  createCloudTripFromCurrent: () => Promise<void>;
  createTrip: (input: CreateTripInput) => Promise<void>;
  startWithExampleTrip: () => Promise<void>;
  loadCloudTrip: (tripId: string) => Promise<void>;
  previewCloudTrip: (tripId: string) => Promise<Trip | null>;
  saveRouteSnapshot: (tripId: string, snapshot: PersistedRouteSnapshot) => Promise<Trip | null>;
  setTodayTripId: (tripId: string | null) => Promise<void>;
  clearLoadedTrip: () => void;
  renameTrip: (tripId: string, input: RenameTripInput) => Promise<void>;
  deleteTrip: (tripId: string) => Promise<void>;
  resetToSeed: () => Promise<void>;
  resetToSeedAlignedToToday: () => Promise<void>;
  setPlannerInteractionMode: (mode: PlannerInteractionMode) => void;
  updateTrip: (nextTrip: Trip) => Promise<void>;
  addStop: (newStop: NewTripStop) => Promise<void>;
  updateStop: (stopId: string, updater: (stop: TripStop) => TripStop) => Promise<void>;
  deleteStop: (stopId: string) => Promise<void>;
  reorderStops: (activeId: string, overId: string) => Promise<void>;
};

const shouldApplySignedInRefresh = (
  get: () => TripStoreState,
  userId: string,
): boolean => {
  const state = get();
  return state.authStatus === "signed_in" && state.user?.id === userId;
};

const mergeRefreshedTripCache = (
  state: TripStoreState,
  refreshedCache: Record<string, Trip>,
): Record<string, Trip> => {
  const nextCache = {
    ...state.tripCache,
    ...refreshedCache,
  };
  const activeTrip = state.data ? getActiveTrip(state.data) : null;
  if (activeTrip) {
    nextCache[activeTrip.id] = activeTrip;
  }

  return nextCache;
};

const refreshSignedInSessionState = async (
  set: (partial: Partial<TripStoreState>) => void,
  get: () => TripStoreState,
  user: SessionUser,
) => {
  if (!shouldApplySignedInRefresh(get, user.id)) {
    return;
  }

  const cloudRepository = getCloudRepository();

  try {
    const summaries = await cloudRepository.listTrips();
    if (!shouldApplySignedInRefresh(get, user.id)) {
      return;
    }

    let todayTripState: {
      todayTripId: string | null;
      tripCache: Record<string, Trip>;
    } = {
      todayTripId: null,
      tripCache: {},
    };

    try {
      todayTripState = await loadTodayTripSelection(user, summaries, cloudRepository);
    } catch {
      setCachedTodayTripId(user.id, null);
    }

    if (!shouldApplySignedInRefresh(get, user.id)) {
      return;
    }

    const state = get();
    set({
      authStatus: "signed_in",
      user,
      tripSummaries: sortTripSummaries(summaries),
      tripCache: mergeRefreshedTripCache(state, todayTripState.tripCache),
      todayTripId: todayTripState.todayTripId,
      isLoading: false,
      error: null,
      notice: state.notice?.surface === "inline" ? null : state.notice,
      mode: "cloud",
      syncStatus: summaries.length > 0 || state.data ? "saved" : "idle",
      isOfflineReadOnly: false,
      hasLegacyImport: hasLegacyLocalTripData(),
      firstTripSetup: state.firstTripSetup,
    });
  } catch (error) {
    if (!shouldApplySignedInRefresh(get, user.id)) {
      return;
    }

    const state = get();
    set({
      authStatus: "signed_in",
      user,
      isLoading: false,
      error:
        state.data || state.tripSummaries.length > 0
          ? "Unable to refresh cloud sync right now. Keeping your current trip loaded."
          : error instanceof Error
            ? error.message
            : "Unable to refresh cloud trip data.",
      notice: createNotice(
        state.data || state.tripSummaries.length > 0
          ? "Your current trip stays open while sync recovers."
          : "Reconnect or reload to continue setting up your trip.",
        "inline",
        "warning",
      ),
      syncStatus: state.syncStatus === "offline" ? "offline" : "error",
      isOfflineReadOnly: state.isOfflineReadOnly,
      hasLegacyImport: hasLegacyLocalTripData(),
      firstTripSetup: state.firstTripSetup,
    });
  }
};

const registerPlannerTestHooks = (
  set: (partial: Partial<TripStoreState>) => void,
  get: () => TripStoreState,
) => {
  if (typeof window === "undefined" || process.env.NODE_ENV === "production") {
    return;
  }

  window.__plannerTestHooks__ = {
    emitSameUserSignedInAuthEvent: async () => {
      const client = getSupabaseClient();
      if (!client) {
        throw new Error("Supabase client is not configured.");
      }

      const { data } = await client.auth.getSession();
      const session = data.session;
      if (!session?.user || typeof session.access_token !== "string") {
        throw new Error("No browser session is available.");
      }

      emitBrowserE2ESignIn(session.user, session.access_token);
    },
    refreshSignedInSession: async () => {
      const state = get();
      if (!state.user) {
        throw new Error("No signed-in user is available.");
      }

      await refreshSignedInSessionState(set, get, state.user);
    },
  };
};

const bindAuthListener = (
  set: (partial: Partial<TripStoreState>) => void,
  get: () => TripStoreState,
) => {
  if (authListenerBound) {
    return;
  }

  const client = getSupabaseClient();
  if (!client) {
    return;
  }

  authListenerBound = true;
  client.auth.onAuthStateChange((event, session) => {
    const action = resolveAuthStateChangeAction({
      event,
      currentUserId: get().user?.id ?? null,
      sessionUserId: session?.user?.id ?? null,
    });

    if (action === "ignore") {
      return;
    }

    set({ authStatus: session?.user ? "signed_in" : "signed_out" });

    if (action === "refresh_signed_in" && session?.user) {
      void refreshSignedInSessionState(set, get, mapUser(session.user));
      return;
    }

    void get().initialize();
  });
};

const bindConnectivityListeners = (
  set: (partial: Partial<TripStoreState>) => void,
  get: () => TripStoreState,
) => {
  if (typeof window === "undefined" || connectivityListenersWindow === window) {
    return;
  }

  connectivityListenersWindow = window;

  window.addEventListener("offline", () => {
    if (get().authStatus === "signed_in") {
      set({
        syncStatus: "offline",
        isOfflineReadOnly: true,
      });
    }
  });

  window.addEventListener("online", () => {
    const state = get();
    if (state.authStatus === "signed_in" && state.user) {
      void refreshSignedInSessionState(set, get, state.user);
    }
  });
};

const loadDemoMode = async (
  set: (partial: Partial<TripStoreState>) => void,
  authStatus: AuthStatus,
  user: SessionUser | null,
  notice: PlannerNotice | null = null,
) => {
  const demoData = await localRepository.load();
  set({
    data: demoData,
    tripSummaries: [],
    tripCache: demoData.trips.reduce<Record<string, Trip>>((cache, trip) => {
      cache[trip.id] = trip;
      return cache;
    }, {}),
    todayTripId: null,
    isLoading: false,
    error: null,
    notice,
    authStatus,
    user,
    mode: "demo",
    syncStatus: "idle",
    isOfflineReadOnly: false,
    hasLegacyImport: hasLegacyLocalTripData(),
    firstTripSetup: "none",
    plannerInteractionMode: "view",
  });
};

const loadAuthGateState = (
  set: (partial: Partial<TripStoreState>) => void,
  authStatus: AuthStatus,
  notice: PlannerNotice | null,
  error: string | null = null,
) => {
  set({
    data: null,
    tripSummaries: [],
    tripCache: {},
    todayTripId: null,
    isLoading: false,
    error,
    notice,
    authStatus,
    user: null,
    mode: "cloud",
    syncStatus: "idle",
    isOfflineReadOnly: false,
    hasLegacyImport: false,
    firstTripSetup: "none",
    plannerInteractionMode: "view",
  });
};

const createCloudTrip = async (
  set: (partial: Partial<TripStoreState>) => void,
  get: () => TripStoreState,
  user: SessionUser,
  input: CreateTripInput,
  options: {
    analyticsEvent: string;
    notice: PlannerNotice;
  },
): Promise<Trip | null> => {
  const state = get();
  if (state.isOfflineReadOnly) {
    set({
      syncStatus: "offline",
      error: "Reconnect to the internet before creating another trip.",
      notice: createNotice("The last synced trip is still available to review.", "inline", "warning"),
    });
    return null;
  }

  const cloudRepository = getCloudRepository();
  set({
    isLoading: true,
    syncStatus: "saving",
    error: null,
    notice: null,
    firstTripSetup: "none",
    plannerInteractionMode: "view",
  });

  try {
    const trip = await cloudRepository.createTrip(input);
    const nextSummaries = upsertTripSummary(get().tripSummaries, tripToTripSummary(trip));
    setPreferredLoadedTripId(user.id, trip.id);
    markFirstTripSetupResolved(user.id);
    setLoadedCloudTripState(set, trip, {
      authStatus: "signed_in",
      user,
      tripSummaries: nextSummaries,
      tripCache: get().tripCache,
      todayTripId: state.todayTripId,
      notice: options.notice,
      syncStatus: "saved",
    });
    await trackEvent(options.analyticsEvent, {
      source: "cloud",
      tripId: trip.id,
      tripSource: input.source,
    });
    return trip;
  } catch (error) {
    set({
      isLoading: false,
      syncStatus: "error",
      error: error instanceof Error ? error.message : "Unable to create a new trip right now.",
      notice: createNotice("Try again once the service is available.", "inline", "warning"),
    });
    return null;
  }
};

const loadOrCreateStarterTrip = async (
  set: (partial: Partial<TripStoreState>) => void,
  get: () => TripStoreState,
  user: SessionUser,
): Promise<Trip | null> => {
  return await withPerUserLock(pendingStarterTripLoads, user.id, async () => {
    return await createCloudTrip(
      set,
      get,
      user,
      {
        source: "example",
        name: getExampleTripDefaultName(),
      },
      {
        analyticsEvent: "cloud_trip_created",
        notice: createNotice(
          "Example trip ready. Switch from View mode to Edit mode when you want to change stops or dates.",
          "account",
          "success",
        ),
      },
    );
  });
};

const resolveOfflineTodayTripId = (
  user: SessionUser,
  cachedTrip: Trip | null,
): string | null => {
  const cachedTodayTripId = getCachedTodayTripId(user.id);
  if (!cachedTrip || !cachedTodayTripId) {
    return null;
  }

  return cachedTrip.id === cachedTodayTripId ? cachedTodayTripId : null;
};

const loadTodayTripSelection = async (
  user: SessionUser,
  summaries: TripSummary[],
  cloudRepository: CloudTripRepository,
): Promise<{
  todayTripId: string | null;
  tripCache: Record<string, Trip>;
}> => {
  const preferences = await cloudRepository.getTripPreferences();
  const selectedTripId = preferences.todayTripId;

  if (!selectedTripId) {
    setCachedTodayTripId(user.id, null);
    return {
      todayTripId: null,
      tripCache: {},
    };
  }

  if (!summaries.some((trip) => trip.id === selectedTripId)) {
    await cloudRepository.saveTripPreferences({ todayTripId: null });
    setCachedTodayTripId(user.id, null);
    return {
      todayTripId: null,
      tripCache: {},
    };
  }

  setCachedTodayTripId(user.id, selectedTripId);

  try {
    const trip = await cloudRepository.loadTrip(selectedTripId, { cacheOffline: false });
    return {
      todayTripId: selectedTripId,
      tripCache: { [trip.id]: trip },
    };
  } catch {
    return {
      todayTripId: selectedTripId,
      tripCache: {},
    };
  }
};

const loadSignedInMode = async (
  set: (partial: Partial<TripStoreState>) => void,
  get: () => TripStoreState,
  user: SessionUser,
) => {
  const cloudRepository = getCloudRepository();
  const isOffline = typeof navigator !== "undefined" && !navigator.onLine;

  if (isOffline) {
    const cachedTrip = await cloudRepository.getCachedActiveTrip();
    const todayTripId = resolveOfflineTodayTripId(user, cachedTrip);
    if (cachedTrip) {
      setPreferredLoadedTripId(user.id, cachedTrip.id);
      markFirstTripSetupResolved(user.id);
      setSignedInLibraryState(set, {
        authStatus: "signed_in",
        user,
        tripSummaries: [tripToTripSummary(cachedTrip)],
        tripCache: { [cachedTrip.id]: cachedTrip },
        todayTripId,
        error: "Showing the last synced trip while offline.",
        notice: createNotice(
          "Reconnect to preview, open, or sync the latest changes.",
          "inline",
          "warning",
        ),
        syncStatus: "offline",
        isOfflineReadOnly: true,
      });
      await trackEvent("offline_open", { tripId: cachedTrip.id });
      return;
    }

      setSignedInLibraryState(set, {
        authStatus: "signed_in",
        user,
        tripSummaries: [],
        todayTripId: null,
        error: "You are offline and no cached trip is available yet.",
        notice: createNotice("Reconnect to load your cloud trip library.", "inline", "warning"),
        syncStatus: "offline",
      isOfflineReadOnly: true,
      hasLegacyImport: hasLegacyLocalTripData(),
    });
    return;
  }

  try {
    const summaries = await cloudRepository.listTrips();
    const shouldOfferChoice =
      summaries.length === 0 &&
      hasLegacyLocalTripData() &&
      !hasResolvedFirstTripSetup(user.id);

    if (shouldOfferChoice) {
      setSignedInLibraryState(set, {
        authStatus: "signed_in",
        user,
        tripSummaries: [],
        todayTripId: null,
        notice: createNotice(
          "Choose whether to import your local trip or start with the example itinerary.",
          "inline",
        ),
        syncStatus: "idle",
        isOfflineReadOnly: false,
        hasLegacyImport: true,
        firstTripSetup: "choose_source",
      });
      return;
    }

    let todayTripState: {
      todayTripId: string | null;
      tripCache: Record<string, Trip>;
    } = {
      todayTripId: null,
      tripCache: {},
    };

    try {
      todayTripState = await loadTodayTripSelection(user, summaries, cloudRepository);
    } catch {
      setCachedTodayTripId(user.id, null);
    }

    setSignedInLibraryState(set, {
      authStatus: "signed_in",
      user,
      tripSummaries: summaries,
      tripCache: todayTripState.tripCache,
      todayTripId: todayTripState.todayTripId,
      notice:
        summaries.length > 0
          ? createNotice("Trip library ready. Open a trip to start planning.", "account", "success")
          : null,
      syncStatus: summaries.length > 0 ? "saved" : "idle",
      isOfflineReadOnly: false,
      hasLegacyImport: hasLegacyLocalTripData(),
    });
  } catch (error) {
    const cachedTrip = await cloudRepository.getCachedActiveTrip();
    if (cachedTrip) {
      markFirstTripSetupResolved(user.id);
      setSignedInLibraryState(set, {
        authStatus: "signed_in",
        user,
        tripSummaries: [tripToTripSummary(cachedTrip)],
        tripCache: { [cachedTrip.id]: cachedTrip },
        todayTripId: resolveOfflineTodayTripId(user, cachedTrip),
        error: "Unable to reach cloud sync. Showing the last synced trip instead.",
        notice: createNotice(
          "This cached library view is read-only until the connection returns.",
          "inline",
          "warning",
        ),
        syncStatus: "offline",
        isOfflineReadOnly: true,
      });
      return;
    }

      setSignedInLibraryState(set, {
        authStatus: "signed_in",
        user,
        tripSummaries: [],
        todayTripId: null,
        error: error instanceof Error ? error.message : "Unable to load cloud trip data.",
        notice: createNotice("Reconnect or reload to continue setting up your trip.", "inline", "warning"),
        syncStatus: "error",
      isOfflineReadOnly: false,
      hasLegacyImport: false,
    });
  }
};

const enforceEditMode = (
  set: (partial: Partial<TripStoreState>) => void,
  state: TripStoreState,
  actionLabel: string,
): boolean => {
  if (state.plannerInteractionMode === "edit") {
    return false;
  }

  set({
    error: `Switch from View mode to Edit mode before ${actionLabel}.`,
    notice: createNotice(
      `Switch from View mode to Edit mode before ${actionLabel}.`,
      "inline",
      "warning",
    ),
  });
  return true;
};

export const useTripStore = create<TripStoreState>((set, get) => ({
  data: null,
  tripSummaries: [],
  tripCache: {},
  todayTripId: null,
  isLoading: false,
  error: null,
  notice: null,
  authStatus: isSupabaseConfigured() ? "checking" : "disabled",
  mode: "demo",
  user: null,
  syncStatus: "idle",
  isOfflineReadOnly: false,
  hasLegacyImport: false,
  firstTripSetup: "none",
  plannerInteractionMode: "view",

  initialize: async () => {
    registerPlannerTestHooks(set, get);

    set({
      isLoading: true,
      error: null,
      notice: null,
      todayTripId: null,
      authStatus: isSupabaseConfigured() ? "checking" : "disabled",
      firstTripSetup: "none",
      plannerInteractionMode: "view",
    });

    bindConnectivityListeners(set, get);

    if (shouldForceDemoMode()) {
      await loadDemoMode(set, "disabled", null);
      return;
    }

    bindAuthListener(set, get);

    const client = getSupabaseClient();
    if (!client) {
      loadAuthGateState(
        set,
        "disabled",
        createNotice(
          "Configure Supabase for this environment, then sign in to open the planner.",
          "auth",
        ),
      );
      return;
    }

    const { data } = await client.auth.getSession();
    const sessionUser = data.session?.user ? mapUser(data.session.user) : null;

    if (!sessionUser) {
      loadAuthGateState(
        set,
        "signed_out",
        createNotice(
          "Sign in with a magic link to open your trip and sync it across devices.",
          "auth",
        ),
      );
      return;
    }

    await loadSignedInMode(set, get, sessionUser);
  },

  refreshSignedInSession: async () => {
    const state = get();
    if (state.authStatus !== "signed_in" || !state.user) {
      return;
    }

    await refreshSignedInSessionState(set, get, state.user);
  },

  loadData: async () => {
    await get().initialize();
  },

  signInWithMagicLink: async (email: string) => {
    const normalizedEmail = email.trim();
    if (!normalizedEmail) {
      set({ error: "Email address is required.", notice: null });
      return;
    }

    const client = getSupabaseClient();
    if (!client) {
      set({ error: "Supabase is not configured for this environment.", notice: null });
      return;
    }

    const emailRedirectTo =
      typeof window !== "undefined" ? `${window.location.origin}` : undefined;
    const { error } = await client.auth.signInWithOtp({
      email: normalizedEmail,
      options: { emailRedirectTo },
    });

    if (error) {
      set({ error: error.message, notice: null });
      return;
    }

    set({
      error: null,
      notice: createNotice(
        `Magic link sent to ${normalizedEmail}. Open it on this device to connect cloud sync.`,
        "auth",
        "success",
      ),
    });
    await trackEvent("magic_link_requested", { emailDomain: normalizedEmail.split("@")[1] ?? "" });
  },

  signInAsTestUser: async () => {
    if (!canUseLocalTestSignIn()) {
      set({
        error:
          "Local test sign-in needs NEXT_PUBLIC_LOCAL_TEST_SIGN_IN=1, NEXT_PUBLIC_E2E_AUTH_BYPASS=1, and E2E_AUTH_BYPASS=1.",
        notice: null,
      });
      return;
    }

    const session = createLocalTestBypassSession();
    set({
      error: null,
      notice: createNotice("Signing in locally as the test user...", "auth"),
    });

    emitBrowserE2ESignIn(session.user, session.access_token);
    await trackEvent("local_test_sign_in", { userId: session.user.id });
  },

  signOut: async () => {
    const client = getSupabaseClient();
    if (!client) {
      loadAuthGateState(
        set,
        "disabled",
        createNotice("Supabase is not configured in this environment yet.", "auth"),
      );
      return;
    }

    await client.auth.signOut();
    await trackEvent("signed_out");
    loadAuthGateState(
      set,
      "signed_out",
      createNotice("Signed out. Sign back in to reopen your trip.", "auth"),
    );
  },

  refreshTripSummaries: async () => {
    const state = get();
    if (state.authStatus !== "signed_in" || !state.user || state.isOfflineReadOnly) {
      return;
    }

    const cloudRepository = getCloudRepository();
    try {
      const summaries = await cloudRepository.listTrips();
      set({ tripSummaries: sortTripSummaries(summaries) });
    } catch {
      // Keep the current trip list if refresh fails.
    }
  },

  importLegacyTrips: async () => {
    const state = get();
    if (state.authStatus !== "signed_in" || !state.user) {
      set({ error: "Sign in before importing local trip data.", notice: null });
      return;
    }

    const candidate = readLegacyLocalTrips();
    if (!candidate) {
      set({ error: "No local trip data was found to import.", notice: null });
      return;
    }

    const cloudRepository = getCloudRepository();
    set({
      syncStatus: "saving",
      error: null,
      notice: null,
      firstTripSetup: "none",
      plannerInteractionMode: "view",
    });

    try {
      const summaries = await cloudRepository.importLocalTrips(candidate);
      const firstTripId = summaries[0]?.id;

      if (!firstTripId) {
        set({
          syncStatus: "error",
          error: "Import completed, but no cloud trips were returned.",
          notice: null,
        });
        return;
      }

      const trip = await cloudRepository.loadTrip(firstTripId);
      setPreferredLoadedTripId(state.user.id, firstTripId);
      markFirstTripSetupResolved(state.user.id);
      setLoadedCloudTripState(set, trip, {
        authStatus: "signed_in",
        user: state.user,
        tripSummaries: summaries,
        tripCache: get().tripCache,
        todayTripId: state.todayTripId,
        notice: createNotice(
          `Imported ${summaries.length} local ${summaries.length === 1 ? "trip" : "trips"} into cloud sync.`,
          "account",
          "success",
        ),
        hasLegacyImport: false,
      });
      await trackEvent("legacy_import", { importedTrips: summaries.length });
    } catch (error) {
      set({
        syncStatus: "error",
        error: error instanceof Error ? error.message : "Unable to import local trips.",
        notice: createNotice(
          "Your local data is still available if you want to try again later.",
          "inline",
          "warning",
        ),
      });
    }
  },

  createCloudTripFromCurrent: async () => {
    const state = get();
    const activeTrip = state.data ? getActiveTrip(state.data) : null;

    if (!activeTrip) {
      set({ error: "No trip is currently loaded.", notice: null });
      return;
    }

    if (state.authStatus !== "signed_in" || !state.user) {
      set({ error: "Sign in before creating a cloud-synced trip.", notice: null });
      return;
    }

    await persistActiveTrip(
      set,
      get,
      {
        ...activeTrip,
        ownerUserId: state.user.id,
        version: activeTrip.version || 1,
        updatedAt: nowIso(),
      },
      "cloud_trip_created",
    );

    if (!get().error) {
      markFirstTripSetupResolved(state.user.id);
      set({
        hasLegacyImport: false,
        firstTripSetup: "none",
        plannerInteractionMode: "view",
      });
    }
  },

  createTrip: async (input) => {
    const state = get();
    if (state.authStatus !== "signed_in" || !state.user) {
      set({ error: "Sign in before creating another trip.", notice: null });
      return;
    }

    const notice =
      input.source === "blank"
        ? createNotice(
            "Blank trip created. You are in Edit mode now, so add stops when you are ready to plan.",
            "account",
            "success",
          )
        : createNotice(
            "Example trip created. Switch from View mode to Edit mode when you want to change stops or dates.",
            "account",
            "success",
          );

    await createCloudTrip(
      set,
      get,
      state.user,
      input,
      {
        analyticsEvent:
          input.source === "blank" ? "blank_trip_created" : "cloud_trip_created",
        notice,
      },
    );
  },

  startWithExampleTrip: async () => {
    const state = get();

    if (state.authStatus !== "signed_in" || !state.user) {
      set({ error: "Sign in before starting with the example trip.", notice: null });
      return;
    }

    await loadOrCreateStarterTrip(set, get, state.user);
  },

  loadCloudTrip: async (tripId: string) => {
    const state = get();
    if (state.authStatus !== "signed_in" || !state.user) {
      set({ error: "Sign in before loading a cloud trip.", notice: null });
      return;
    }

    const currentTrip = state.data ? getActiveTrip(state.data) : null;
    if (currentTrip?.id === tripId) {
      set({
        plannerInteractionMode: "view",
        notice: createNotice("This trip is already open.", "inline"),
      });
      return;
    }

    const cloudRepository = getCloudRepository();
    set({ isLoading: true, error: null, notice: null, plannerInteractionMode: "view" });

    try {
      const trip = await cloudRepository.loadTrip(tripId);
      const nextSummaries =
        state.tripSummaries.length > 0
          ? upsertTripSummary(state.tripSummaries, tripToTripSummary(trip))
          : await cloudRepository.listTrips();
      setPreferredLoadedTripId(state.user.id, tripId);
      markFirstTripSetupResolved(state.user.id);
      setLoadedCloudTripState(set, trip, {
        authStatus: "signed_in",
        user: state.user,
        tripSummaries: nextSummaries,
        tripCache: get().tripCache,
        todayTripId: state.todayTripId,
        notice: createNotice("Cloud trip loaded successfully.", "account", "success"),
      });
    } catch (error) {
      set({
        isLoading: false,
        syncStatus: "error",
        error: error instanceof Error ? error.message : "Unable to load the selected trip.",
        notice: createNotice(
          "The previously loaded data will remain available if possible.",
          "inline",
          "warning",
        ),
      });
    }
  },

  previewCloudTrip: async (tripId) => {
    const state = get();
    const cachedTrip = state.tripCache[tripId] ?? null;
    if (cachedTrip) {
      return cachedTrip;
    }

    if (state.authStatus !== "signed_in" || !state.user) {
      set({ error: "Sign in before previewing a cloud trip.", notice: null });
      return null;
    }

    if (state.isOfflineReadOnly) {
      set({
        error: "This trip has not been cached locally yet.",
        notice: createNotice(
          "Reconnect to preview trips that are not already cached.",
          "inline",
          "warning",
        ),
      });
      return null;
    }

    const cloudRepository = getCloudRepository();
    try {
      const trip = await cloudRepository.loadTrip(tripId, { cacheOffline: false });
      set({
        tripCache: mergeTripCacheEntry(get().tripCache, trip),
        error: null,
        notice: state.notice?.surface === "inline" ? null : state.notice,
      });
      return trip;
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : "Unable to preview the selected trip.",
        notice: createNotice(
          "Try again once the trip service is available.",
          "inline",
          "warning",
        ),
      });
      return null;
    }
  },

  saveRouteSnapshot: async (tripId, snapshot) => {
    const state = get();
    const activeTrip = state.data ? getActiveTrip(state.data) : null;
    const targetTrip =
      state.tripCache[tripId] ?? (activeTrip?.id === tripId ? activeTrip : null);

    if (!targetTrip) {
      set({
        error: "Load or preview this trip before saving route timings.",
        notice: createNotice("Open the trip once so route timings can be attached to it.", "inline", "warning"),
      });
      return null;
    }

    if (state.isOfflineReadOnly) {
      set({
        syncStatus: "offline",
        error: "Reconnect before saving refreshed route timings.",
        notice: createNotice("The last synced trip is still available to review.", "inline", "warning"),
      });
      return null;
    }

    const nextTrip: Trip = {
      ...targetTrip,
      routeSnapshot: snapshot,
      updatedAt: nowIso(),
    };
    const isLoadedTrip = activeTrip?.id === tripId;

    if (state.authStatus === "signed_in" && state.user) {
      const cloudRepository = getCloudRepository();
      set({
        data: isLoadedTrip ? replaceActiveTrip(state.data, nextTrip) : state.data,
        tripCache: mergeTripCacheEntry(state.tripCache, nextTrip),
        syncStatus: "saving",
        error: null,
        notice: null,
      });

      try {
        let savedTrip: Trip | null = null;
        let savedTripId = tripId;

        await enqueueCloudTripSave(tripId, async () => {
          const latestState = get();
          const latestActiveTrip = latestState.data ? getActiveTrip(latestState.data) : null;
          const latestCachedTrip = latestState.tripCache[tripId] ?? null;
          const latestVersionSource =
            latestActiveTrip?.id === tripId ? latestActiveTrip : latestCachedTrip;
          const tripToSave: Trip = {
            ...nextTrip,
            ownerUserId: state.user!.id,
            version: latestVersionSource?.version ?? nextTrip.version,
          };

          savedTrip = await cloudRepository.saveTrip(tripToSave, {
            cacheOffline: isLoadedTrip,
          });
          savedTripId = savedTrip.id;

          if (isLoadedTrip) {
            setPreferredLoadedTripId(state.user!.id, savedTrip.id);
          }

          const postSaveState = get();
          const currentActiveTrip = postSaveState.data ? getActiveTrip(postSaveState.data) : null;
          const shouldApplySavedTrip =
            isLoadedTrip &&
            currentActiveTrip?.id === savedTrip.id &&
            currentActiveTrip.updatedAt === tripToSave.updatedAt;
          const nextActiveTrip =
            isLoadedTrip && currentActiveTrip?.id === savedTrip.id
              ? shouldApplySavedTrip
                ? savedTrip
                : mergeTripSyncMetadata(currentActiveTrip, savedTrip)
              : null;
          const currentCachedTrip = postSaveState.tripCache[tripId] ?? null;
          const nextCachedTrip =
            currentCachedTrip?.updatedAt === tripToSave.updatedAt
              ? savedTrip
              : currentCachedTrip
                ? mergeTripSyncMetadata(currentCachedTrip, savedTrip)
                : savedTrip;

          set({
            data: nextActiveTrip ? replaceActiveTrip(postSaveState.data, nextActiveTrip) : postSaveState.data,
            tripSummaries: upsertTripSummary(postSaveState.tripSummaries, tripToTripSummary(savedTrip)),
            tripCache: mergeTripCacheEntry(postSaveState.tripCache, nextCachedTrip),
            isLoading: false,
            syncStatus: shouldApplySavedTrip || !isLoadedTrip ? "saved" : "saving",
            mode: "cloud",
            error: null,
            notice:
              shouldApplySavedTrip || !isLoadedTrip
                ? createNotice("Route timings refreshed and saved with this trip.", "account", "success")
                : null,
            isOfflineReadOnly: false,
          });
        });

        await trackEvent("route_snapshot_saved", {
          source: "cloud",
          tripId: savedTripId,
        });
        return savedTrip;
      } catch (error) {
        if (error instanceof TripConflictError) {
          const latestTrip = error.latestTrip ?? null;

          set({
            syncStatus: "error",
            error: "Trip changed on another device. The latest version has been loaded instead.",
            notice: createNotice(
              "Refresh route timings again if you still want to save them on the latest version.",
              "inline",
              "warning",
            ),
            data:
              latestTrip && isLoadedTrip ? replaceActiveTrip(state.data, latestTrip) : state.data,
            tripSummaries: latestTrip
              ? upsertTripSummary(state.tripSummaries, tripToTripSummary(latestTrip))
              : state.tripSummaries,
            tripCache: latestTrip
              ? mergeTripCacheEntry(state.tripCache, latestTrip)
              : state.tripCache,
          });
          return latestTrip;
        }

        set({
          syncStatus: "error",
          error:
            error instanceof Error
              ? error.message
              : "Unable to save refreshed route timings right now.",
          notice: createNotice(
            "The refreshed timings are only available locally until the trip can be saved.",
            "inline",
            "warning",
          ),
        });
        return null;
      }
    }

    if (!state.data || !isLoadedTrip) {
      set({
        syncStatus: "error",
        error: "Only the loaded demo trip can store route timings locally.",
        notice: createNotice("Open the trip you want to refresh before saving route timings.", "inline", "warning"),
      });
      return null;
    }

    const nextData = replaceActiveTrip(state.data, {
      ...nextTrip,
      ownerUserId: null,
      lastSyncedAt: null,
    });
    await localRepository.save(nextData);
    set({
      data: nextData,
      tripCache: mergeTripCacheEntry(state.tripCache, nextData.trips[0]),
      mode: "demo",
      syncStatus: "idle",
      error: null,
      notice: createNotice("Route timings saved locally in this browser.", "account", "success"),
    });

    await trackEvent("route_snapshot_saved", {
      source: "demo",
      tripId,
    });
    return nextData.trips[0];
  },

  setTodayTripId: async (tripId) => {
    const state = get();
    if (state.authStatus !== "signed_in" || !state.user) {
      set({ error: "Sign in before updating the Today trip.", notice: null });
      return;
    }

    if (state.isOfflineReadOnly) {
      set({
        error: "Reconnect before updating the Today trip.",
        notice: createNotice(
          "The cached trip is still available to review while offline.",
          "inline",
          "warning",
        ),
      });
      return;
    }

    const cloudRepository = getCloudRepository();
    set({ error: null, notice: null });

    try {
      const preferences = await cloudRepository.saveTripPreferences({ todayTripId: tripId });
      const nextTodayTripId = preferences.todayTripId;
      const needsHydration =
        nextTodayTripId && !state.tripCache[nextTodayTripId] ? nextTodayTripId : null;
      let hydratedTrip: Trip | null = null;
      if (needsHydration) {
        try {
          hydratedTrip = await cloudRepository.loadTrip(needsHydration, { cacheOffline: false });
        } catch {
          hydratedTrip = null;
        }
      }

      setCachedTodayTripId(state.user.id, nextTodayTripId);
      set({
        todayTripId: nextTodayTripId,
        tripCache: hydratedTrip ? mergeTripCacheEntry(get().tripCache, hydratedTrip) : get().tripCache,
        error: null,
        notice: createNotice(
          nextTodayTripId
            ? "Today trip updated successfully."
            : "Today trip cleared successfully.",
          "account",
          "success",
        ),
      });

      await trackEvent("today_trip_updated", {
        todayTripId: nextTodayTripId ?? "",
        cleared: nextTodayTripId ? "false" : "true",
      });
    } catch (error) {
      set({
        error: describeTodayTripPreferenceError(error),
        notice: createNotice(
          "The previous Today trip selection is still available if you want to try again.",
          "inline",
          "warning",
        ),
      });
    }
  },

  clearLoadedTrip: () => {
    const state = get();
    set({
      data: null,
      plannerInteractionMode: "view",
      error: null,
      notice:
        state.authStatus === "signed_in"
          ? createNotice("No trip loaded. Open one from the dashboard when you are ready.", "account")
          : null,
    });
  },

  renameTrip: async (tripId, input) => {
    const state = get();
    if (state.authStatus !== "signed_in" || !state.user) {
      set({ error: "Sign in before renaming a trip.", notice: null });
      return;
    }

    const nextName = input.name.trim();
    if (!nextName) {
      set({ error: "Trip name is required.", notice: null });
      return;
    }

    const cloudRepository = getCloudRepository();
    set({ syncStatus: "saving", error: null, notice: null });

    try {
      const summary = await cloudRepository.renameTrip(tripId, { name: nextName });
      const activeTrip = state.data ? getActiveTrip(state.data) : null;
      const nextData =
        activeTrip && activeTrip.id === tripId
          ? replaceActiveTrip(state.data, {
              ...activeTrip,
              name: summary.name,
              version: summary.version,
              updatedAt: summary.updatedAt,
              lastSyncedAt: summary.lastSyncedAt,
            })
          : state.data;
      const cachedTrip = state.tripCache[tripId];
      const nextTripCache =
        cachedTrip
          ? mergeTripCacheEntry(state.tripCache, {
              ...cachedTrip,
              name: summary.name,
              version: summary.version,
              updatedAt: summary.updatedAt,
              lastSyncedAt: summary.lastSyncedAt,
            })
          : state.tripCache;

      if (nextData) {
        const renamedActiveTrip = getActiveTrip(nextData);
        if (renamedActiveTrip) {
          await writeCachedActiveTrip(renamedActiveTrip);
        }
      }

      set({
        data: nextData,
        tripSummaries: upsertTripSummary(state.tripSummaries, summary),
        tripCache: nextTripCache,
        syncStatus: "saved",
        error: null,
        notice: createNotice("Trip renamed successfully.", "account", "success"),
      });
      await trackEvent("trip_renamed", { tripId });
    } catch (error) {
      set({
        syncStatus: "error",
        error: error instanceof Error ? error.message : "Unable to rename this trip.",
        notice: createNotice(
          "The previous name is still available if you want to try again.",
          "inline",
          "warning",
        ),
      });
    }
  },

  deleteTrip: async (tripId: string) => {
    const state = get();
    if (state.authStatus !== "signed_in" || !state.user) {
      set({ error: "Sign in before deleting a trip.", notice: null });
      return;
    }

    if (state.tripSummaries.length <= 1) {
      set({
        error: "Create another trip before deleting this one.",
        notice: createNotice("The final remaining trip cannot be deleted yet.", "inline", "warning"),
      });
      return;
    }

    const activeTrip = state.data ? getActiveTrip(state.data) : null;
    const isDeletingActiveTrip = activeTrip?.id === tripId;
    const isDeletingTodayTrip = state.todayTripId === tripId;
    const cloudRepository = getCloudRepository();
    set({ syncStatus: "saving", error: null, notice: null, plannerInteractionMode: "view" });

    try {
      await cloudRepository.deleteTrip(tripId);
      if (isDeletingTodayTrip) {
        try {
          await cloudRepository.saveTripPreferences({ todayTripId: null });
        } catch {
          // A stale Today trip preference will be cleared the next time the library loads.
        }
        setCachedTodayTripId(state.user.id, null);
      }
      const nextSummaries = await cloudRepository.listTrips();

      if (!isDeletingActiveTrip) {
        set({
          tripSummaries: removeTripSummary(nextSummaries, tripId),
          tripCache: removeTripCacheEntry(state.tripCache, tripId),
          todayTripId: isDeletingTodayTrip ? null : state.todayTripId,
          syncStatus: "saved",
          error: null,
          notice: createNotice(
            isDeletingTodayTrip
              ? "Trip deleted and Today trip cleared successfully."
              : "Trip deleted successfully.",
            "account",
            "success",
          ),
        });
        await trackEvent("trip_deleted", {
          tripId,
          activeTripDeleted: false,
          todayTripDeleted: isDeletingTodayTrip ? "true" : "false",
        });
        return;
      }

      await clearCachedActiveTrip();
      set({
        data: null,
        tripSummaries: nextSummaries,
        tripCache: removeTripCacheEntry(state.tripCache, tripId),
        todayTripId: isDeletingTodayTrip ? null : state.todayTripId,
        syncStatus: "saved",
        error: null,
        notice: createNotice(
          isDeletingTodayTrip
            ? "Trip deleted. No trip is loaded, and the Today trip selection was cleared."
            : "Trip deleted. No trip is loaded now.",
          "account",
          "success",
        ),
        plannerInteractionMode: "view",
      });
      await trackEvent("trip_deleted", {
        tripId,
        activeTripDeleted: true,
        todayTripDeleted: isDeletingTodayTrip ? "true" : "false",
      });
    } catch (error) {
      set({
        syncStatus: "error",
        error: error instanceof Error ? error.message : "Unable to delete this trip.",
        notice: createNotice(
          "The current trip list is still available if you want to try again.",
          "inline",
          "warning",
        ),
      });
    }
  },

  resetToSeed: async () => {
    const state = get();
    if (state.authStatus === "signed_in" && state.mode === "cloud") {
      set({ error: "Seed reset is only available in demo mode.", notice: null });
      return;
    }

    const seed = await localRepository.resetToSeed();
    set({
      data: seed,
      tripSummaries: [],
      tripCache: seed.trips.reduce<Record<string, Trip>>((cache, trip) => {
        cache[trip.id] = trip;
        return cache;
      }, {}),
      todayTripId: null,
      error: null,
      notice: createNotice("Demo seed itinerary restored.", "account", "success"),
      mode: "demo",
      syncStatus: "idle",
      isOfflineReadOnly: false,
      firstTripSetup: "none",
      plannerInteractionMode: "view",
    });
  },

  resetToSeedAlignedToToday: async () => {
    const state = get();
    if (state.authStatus === "signed_in" && state.mode === "cloud") {
      set({ error: "Seed reset is only available in demo mode.", notice: null });
      return;
    }

    const shifted = await localRepository.resetToSeedAlignedToToday();
    set({
      data: shifted,
      tripSummaries: [],
      tripCache: shifted.trips.reduce<Record<string, Trip>>((cache, trip) => {
        cache[trip.id] = trip;
        return cache;
      }, {}),
      todayTripId: null,
      error: null,
      notice: createNotice("Demo itinerary shifted so the trip starts now.", "account", "success"),
      mode: "demo",
      syncStatus: "idle",
      isOfflineReadOnly: false,
      firstTripSetup: "none",
      plannerInteractionMode: "view",
    });
  },

  setPlannerInteractionMode: (mode) => {
    const state = get();

    if (mode === "edit") {
      if (state.isOfflineReadOnly) {
        set({
          plannerInteractionMode: "view",
          error: "Reconnect to the internet before editing this trip.",
          notice: createNotice("The last synced version is still available to review.", "inline", "warning"),
        });
        return;
      }

      if (!state.data || !getActiveTrip(state.data)) {
        set({
          plannerInteractionMode: "view",
          error: "Load a trip before entering edit mode.",
          notice: null,
        });
        return;
      }
    }

    set({
      plannerInteractionMode: mode,
      error: null,
      notice: state.notice?.surface === "inline" ? null : state.notice,
    });
  },

  updateTrip: async (nextTrip) => {
    const normalizedTrip: Trip = {
      ...nextTrip,
      stops: ensureStopOrder(nextTrip.stops),
      updatedAt: nowIso(),
    };

    await persistActiveTrip(set, get, normalizedTrip, "trip_saved");
  },

  addStop: async (newStop) => {
    const state = get();
    if (enforceEditMode(set, state, "adding itinerary stops")) {
      return;
    }

    const currentData = state.data;
    if (!currentData) {
      return;
    }

    const activeTrip = getActiveTrip(currentData);
    if (!activeTrip) {
      return;
    }

    const stop: TripStop = {
      ...newStop,
      id: crypto.randomUUID(),
      order: activeTrip.stops.length,
    } as TripStop;

    await persistActiveTrip(
      set,
      get,
      {
        ...activeTrip,
        stops: ensureStopOrder([...activeTrip.stops, stop]),
        updatedAt: nowIso(),
      },
      "stop_added",
    );
  },

  updateStop: async (stopId, updater) => {
    const state = get();
    if (enforceEditMode(set, state, "changing itinerary stops")) {
      return;
    }

    const currentData = state.data;
    if (!currentData) {
      return;
    }

    const activeTrip = getActiveTrip(currentData);
    if (!activeTrip) {
      return;
    }

    await persistActiveTrip(
      set,
      get,
      {
        ...activeTrip,
        stops: ensureStopOrder(
          activeTrip.stops.map((stop) => (stop.id === stopId ? updater(stop) : stop)),
        ),
        updatedAt: nowIso(),
      },
      "stop_updated",
    );
  },

  deleteStop: async (stopId) => {
    const state = get();
    if (enforceEditMode(set, state, "deleting itinerary stops")) {
      return;
    }

    const currentData = state.data;
    if (!currentData) {
      return;
    }

    const activeTrip = getActiveTrip(currentData);
    if (!activeTrip) {
      return;
    }

    await persistActiveTrip(
      set,
      get,
      {
        ...activeTrip,
        stops: ensureStopOrder(activeTrip.stops.filter((stop) => stop.id !== stopId)),
        updatedAt: nowIso(),
      },
      "stop_deleted",
    );
  },

  reorderStops: async (activeId, overId) => {
    const state = get();
    if (enforceEditMode(set, state, "reordering itinerary stops")) {
      return;
    }

    const currentData = state.data;
    if (!currentData || activeId === overId) {
      return;
    }

    const activeTrip = getActiveTrip(currentData);
    if (!activeTrip) {
      return;
    }

    const sorted = ensureStopOrder(activeTrip.stops);
    const activeIndex = sorted.findIndex((stop) => stop.id === activeId);
    const overIndex = sorted.findIndex((stop) => stop.id === overId);

    if (activeIndex < 0 || overIndex < 0) {
      return;
    }

    const [moved] = sorted.splice(activeIndex, 1);
    sorted.splice(overIndex, 0, moved);

    await persistActiveTrip(
      set,
      get,
      {
        ...activeTrip,
        stops: ensureStopOrder(sorted),
        updatedAt: nowIso(),
      },
      "stops_reordered",
    );
  },
}));

const persistActiveTrip = async (
  set: (partial: Partial<TripStoreState>) => void,
  get: () => TripStoreState,
  nextTrip: Trip,
  analyticsEvent: string,
) => {
  const state = get();

  if (state.isOfflineReadOnly) {
    set({
      syncStatus: "offline",
      error: "Reconnect to the internet to keep editing this trip.",
      notice: createNotice(
        "You can still review the last synced version while offline.",
        "inline",
        "warning",
      ),
    });
    return;
  }

  if (state.authStatus === "signed_in" && state.user) {
    const cloudRepository = getCloudRepository();
    const latestActiveTrip = state.data ? getActiveTrip(state.data) : null;
    const latestVersionSource =
      latestActiveTrip?.id === nextTrip.id
        ? latestActiveTrip
        : state.tripCache[nextTrip.id] ?? null;
    const optimisticTrip: Trip = {
      ...nextTrip,
      ownerUserId: state.user.id,
      version: latestVersionSource?.version ?? nextTrip.version,
      lastSyncedAt: latestVersionSource?.lastSyncedAt ?? nextTrip.lastSyncedAt,
    };
    set({
      data: replaceActiveTrip(state.data, optimisticTrip),
      tripCache: mergeTripCacheEntry(state.tripCache, optimisticTrip),
      syncStatus: "saving",
      error: null,
      notice: null,
    });

    try {
      let savedTrip: Trip | null = null;
      let savedTripId = nextTrip.id;

      await enqueueCloudTripSave(nextTrip.id, async () => {
        const latestState = get();
        const latestActiveTrip = latestState.data ? getActiveTrip(latestState.data) : null;
        const latestVersionSource =
          latestActiveTrip?.id === nextTrip.id
            ? latestActiveTrip
            : latestState.tripCache[nextTrip.id] ?? null;
        const tripToSave: Trip = {
          ...optimisticTrip,
          version: latestVersionSource?.version ?? optimisticTrip.version,
        };

        savedTrip = await cloudRepository.saveTrip(tripToSave);
        savedTripId = savedTrip.id;

        setPreferredLoadedTripId(state.user!.id, savedTrip.id);
        const postSaveState = get();
        const currentActiveTrip = postSaveState.data ? getActiveTrip(postSaveState.data) : null;
        const shouldApplySavedTrip =
          currentActiveTrip?.id === savedTrip.id &&
          currentActiveTrip.updatedAt === tripToSave.updatedAt;
        const nextActiveTrip =
          currentActiveTrip?.id === savedTrip.id
            ? shouldApplySavedTrip
              ? savedTrip
              : mergeTripSyncMetadata(currentActiveTrip, savedTrip)
            : savedTrip;
        const currentCachedTrip = postSaveState.tripCache[savedTrip.id] ?? null;
        const nextCachedTrip =
          currentCachedTrip?.updatedAt === tripToSave.updatedAt
            ? savedTrip
            : currentCachedTrip
              ? mergeTripSyncMetadata(currentCachedTrip, savedTrip)
              : savedTrip;

        set({
          data: replaceActiveTrip(postSaveState.data, nextActiveTrip),
          tripSummaries: upsertTripSummary(postSaveState.tripSummaries, tripToTripSummary(savedTrip)),
          tripCache: mergeTripCacheEntry(postSaveState.tripCache, nextCachedTrip),
          isLoading: false,
          syncStatus: shouldApplySavedTrip ? "saved" : "saving",
          mode: "cloud",
          error: null,
          notice: shouldApplySavedTrip
            ? createNotice(
                analyticsEvent === "cloud_trip_created"
                  ? "Cloud trip created. This itinerary is now ready to open on another device."
                  : "Cloud trip saved successfully.",
                "account",
                "success",
              )
            : null,
          isOfflineReadOnly: false,
        });
      });

      await trackEvent(analyticsEvent, {
        source: "cloud",
        tripId: savedTripId,
      });
      return;
    } catch (error) {
      if (error instanceof TripConflictError) {
        set({
          syncStatus: "error",
          error: "Trip changed on another device. The latest version has been loaded.",
          notice: createNotice(
            "Review the refreshed version before making more edits.",
            "inline",
            "warning",
          ),
          data: error.latestTrip ? replaceActiveTrip(state.data, error.latestTrip) : state.data,
          tripSummaries: error.latestTrip
            ? upsertTripSummary(state.tripSummaries, tripToTripSummary(error.latestTrip))
            : state.tripSummaries,
          tripCache: error.latestTrip
            ? mergeTripCacheEntry(state.tripCache, error.latestTrip)
            : state.tripCache,
        });
        await trackEvent("sync_conflict", { tripId: nextTrip.id });
        return;
      }

      if (typeof navigator !== "undefined" && !navigator.onLine) {
        set({
          syncStatus: "offline",
          isOfflineReadOnly: true,
          error: "You are offline. Reconnect to keep editing this trip.",
          notice: createNotice(
            "The last synced version is still available for reference.",
            "inline",
            "warning",
          ),
        });
        await trackEvent("save_failed", { reason: "offline", tripId: nextTrip.id });
        return;
      }

      set({
        syncStatus: "error",
        error: error instanceof Error ? error.message : "Unable to save this trip right now.",
        notice: createNotice(
          "Your last edit did not sync. Try again once the service is available.",
          "inline",
          "warning",
        ),
      });
      await trackEvent("save_failed", { reason: "server", tripId: nextTrip.id });
      return;
    }
  }

  if (!state.data) {
    set({
      syncStatus: "error",
      error: "No trip is currently loaded.",
      notice: createNotice("Reload the planner and try again.", "inline", "warning"),
    });
    return;
  }

  const nextData = replaceActiveTrip(state.data, {
    ...nextTrip,
    ownerUserId: null,
    lastSyncedAt: null,
  });
  await localRepository.save(nextData);
  set({
    data: nextData,
    tripCache: mergeTripCacheEntry(state.tripCache, nextData.trips[0]),
    mode: "demo",
    syncStatus: "idle",
    error: null,
    notice: createNotice("Demo trip updated locally in this browser.", "account", "success"),
  });
  await trackEvent(analyticsEvent, { source: "demo", tripId: nextTrip.id });
};
