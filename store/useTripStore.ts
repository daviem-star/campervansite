"use client";

import { create } from "zustand";

import { trackEvent } from "@/lib/analytics";
import { nowIso } from "@/lib/date";
import { createLocalTestBypassSession } from "@/lib/e2eAuth";
import {
  CloudTripRepository,
  createDemoAppDataFromTrip,
  hasLegacyLocalTripData,
  hasResolvedFirstTripSetup,
  LegacyLocalStorageTripRepository,
  markFirstTripSetupResolved,
  pickInitialCloudTripId,
  readLegacyLocalTrips,
  setPreferredActiveTripId,
  TripConflictError,
} from "@/lib/repository";
import { getSeedData } from "@/lib/seedData";
import {
  BrowserAuthUser,
  getBrowserSupabaseClient,
  isSupabaseConfigured,
  emitBrowserE2ESignIn,
} from "@/lib/supabase";
import { canUseLocalTestSignIn, shouldForceDemoMode } from "@/lib/runtimeFlags";
import { ensureStopOrder } from "@/lib/tripDerived";
import { AppData, NewTripStop, SessionUser, SyncStatus, Trip, TripStop } from "@/types/trip";

const localRepository = new LegacyLocalStorageTripRepository();

let authListenerBound = false;
let connectivityListenersBound = false;

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

type AuthStatus = "disabled" | "checking" | "signed_out" | "signed_in";
type PlannerMode = "demo" | "cloud";
type FirstTripSetup = "none" | "choose_source";
type PlannerInteractionMode = "view" | "edit";

type TripStoreState = {
  data: AppData | null;
  isLoading: boolean;
  error: string | null;
  statusMessage: string | null;
  authStatus: AuthStatus;
  mode: PlannerMode;
  user: SessionUser | null;
  syncStatus: SyncStatus;
  isOfflineReadOnly: boolean;
  hasLegacyImport: boolean;
  firstTripSetup: FirstTripSetup;
  plannerInteractionMode: PlannerInteractionMode;
  initialize: () => Promise<void>;
  loadData: () => Promise<void>;
  signInWithMagicLink: (email: string) => Promise<void>;
  signInAsTestUser: () => Promise<void>;
  signOut: () => Promise<void>;
  importLegacyTrips: () => Promise<void>;
  createCloudTripFromCurrent: () => Promise<void>;
  startWithExampleTrip: () => Promise<void>;
  loadCloudTrip: (tripId: string) => Promise<void>;
  resetToSeed: () => Promise<void>;
  resetToSeedAlignedToToday: () => Promise<void>;
  setPlannerInteractionMode: (mode: PlannerInteractionMode) => void;
  updateTrip: (nextTrip: Trip) => Promise<void>;
  addStop: (newStop: NewTripStop) => Promise<void>;
  updateStop: (stopId: string, updater: (stop: TripStop) => TripStop) => Promise<void>;
  deleteStop: (stopId: string) => Promise<void>;
  reorderStops: (activeId: string, overId: string) => Promise<void>;
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
  client.auth.onAuthStateChange((_event, session) => {
    set({ authStatus: session?.user ? "signed_in" : "signed_out" });
    void get().initialize();
  });
};

const bindConnectivityListeners = (
  set: (partial: Partial<TripStoreState>) => void,
  get: () => TripStoreState,
) => {
  if (connectivityListenersBound || typeof window === "undefined") {
    return;
  }

  connectivityListenersBound = true;

  window.addEventListener("offline", () => {
    if (get().authStatus === "signed_in") {
      set({
        syncStatus: "offline",
        isOfflineReadOnly: true,
      });
    }
  });

  window.addEventListener("online", () => {
    if (get().authStatus === "signed_in") {
      void get().initialize();
    }
  });
};

const loadDemoMode = async (
  set: (partial: Partial<TripStoreState>) => void,
  authStatus: AuthStatus,
  user: SessionUser | null,
  statusMessage: string | null = null,
) => {
  const demoData = await localRepository.load();
  set({
    data: demoData,
    isLoading: false,
    error: null,
    statusMessage,
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
  statusMessage: string | null,
  error: string | null = null,
) => {
  set({
    data: null,
    isLoading: false,
    error,
    statusMessage,
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

const buildStarterCloudTrip = (user: SessionUser): Trip => {
  const template = structuredClone(getSeedData().trips[0]);
  const createdAt = nowIso();

  return {
    ...template,
    id: `trip_example_${crypto.randomUUID()}`,
    ownerUserId: user.id,
    version: 1,
    createdAt,
    updatedAt: createdAt,
    lastSyncedAt: null,
  };
};

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
      statusMessage: "You can still review the last synced version while offline.",
    });
    return;
  }

  if (state.authStatus === "signed_in" && state.user) {
    const cloudRepository = getCloudRepository();
    set({ syncStatus: "saving", error: null });

    try {
      const savedTrip = await cloudRepository.saveTrip({
        ...nextTrip,
        ownerUserId: state.user.id,
      });

      setPreferredActiveTripId(state.user.id, savedTrip.id);
      set({
        data: replaceActiveTrip(state.data, savedTrip),
        isLoading: false,
        syncStatus: "saved",
        mode: "cloud",
        error: null,
        statusMessage:
          analyticsEvent === "cloud_trip_created"
            ? "Cloud trip created. This itinerary is now ready to open on another device."
            : "Cloud trip saved successfully.",
        isOfflineReadOnly: false,
      });
      await trackEvent(analyticsEvent, {
        source: "cloud",
        tripId: savedTrip.id,
      });
      return;
    } catch (error) {
      if (error instanceof TripConflictError) {
        set({
          syncStatus: "error",
          error: "Trip changed on another device. The latest version has been loaded.",
          statusMessage: "Review the refreshed version before making more edits.",
          data: error.latestTrip
            ? replaceActiveTrip(state.data, error.latestTrip)
            : state.data,
        });
        await trackEvent("sync_conflict", { tripId: nextTrip.id });
        return;
      }

      if (typeof navigator !== "undefined" && !navigator.onLine) {
        set({
          syncStatus: "offline",
          isOfflineReadOnly: true,
          error: "You are offline. Reconnect to keep editing this trip.",
          statusMessage: "The last synced version is still available for reference.",
        });
        await trackEvent("save_failed", { reason: "offline", tripId: nextTrip.id });
        return;
      }

      set({
        syncStatus: "error",
        error: error instanceof Error ? error.message : "Unable to save this trip right now.",
        statusMessage: "Your last edit did not sync. Try again once the service is available.",
      });
      await trackEvent("save_failed", { reason: "server", tripId: nextTrip.id });
      return;
    }
  }

  if (!state.data) {
    set({
      syncStatus: "error",
      error: "No trip is currently loaded.",
      statusMessage: "Reload the planner and try again.",
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
    mode: "demo",
    syncStatus: "idle",
    error: null,
    statusMessage: "Demo trip updated locally in this browser.",
  });
  await trackEvent(analyticsEvent, { source: "demo", tripId: nextTrip.id });
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
    if (cachedTrip) {
      setPreferredActiveTripId(user.id, cachedTrip.id);
      markFirstTripSetupResolved(user.id);
      set({
        data: createDemoAppDataFromTrip(cachedTrip),
        isLoading: false,
        error: "Showing the last synced trip while offline.",
        statusMessage: "Reconnect to resume editing and sync the latest changes.",
        authStatus: "signed_in",
        user,
        mode: "cloud",
        syncStatus: "offline",
        isOfflineReadOnly: true,
        hasLegacyImport: false,
        firstTripSetup: "none",
        plannerInteractionMode: "view",
      });
      await trackEvent("offline_open", { tripId: cachedTrip.id });
      return;
    }
  }

  try {
    const summaries = await cloudRepository.listTrips();
    const initialTripId = pickInitialCloudTripId(summaries, user);

    if (!initialTripId) {
      const shouldOfferChoice =
        hasLegacyLocalTripData() && !hasResolvedFirstTripSetup(user.id);

      if (shouldOfferChoice) {
        set({
          data: null,
          isLoading: false,
          error: null,
          statusMessage:
            "Choose whether to import your local trip or start with the example itinerary.",
          authStatus: "signed_in",
          user,
          mode: "cloud",
          syncStatus: "idle",
          isOfflineReadOnly: false,
          hasLegacyImport: true,
          firstTripSetup: "choose_source",
          plannerInteractionMode: "view",
        });
        return;
      }

      set({
        data: null,
        isLoading: true,
        error: null,
        statusMessage: "Creating your starter trip from the example itinerary...",
        authStatus: "signed_in",
        user,
        mode: "cloud",
        syncStatus: "saving",
        isOfflineReadOnly: false,
        hasLegacyImport: false,
        firstTripSetup: "none",
        plannerInteractionMode: "view",
      });

      const starterTrip = buildStarterCloudTrip(user);
      await persistActiveTrip(set, get, starterTrip, "cloud_trip_created");

      if (!get().error) {
        markFirstTripSetupResolved(user.id);
        set({
          isLoading: false,
          hasLegacyImport: false,
          firstTripSetup: "none",
          plannerInteractionMode: "view",
          statusMessage:
            "Example trip ready. Open Edit trip when you want to change stops or dates.",
        });
      } else {
        set({
          isLoading: false,
        });
      }

      return;
    }

    const trip = await cloudRepository.loadTrip(initialTripId);
    setPreferredActiveTripId(user.id, trip.id);
    markFirstTripSetupResolved(user.id);
    set({
      data: createDemoAppDataFromTrip(trip),
      isLoading: false,
      error: null,
      statusMessage: "Cloud trip loaded. Changes will sync across devices while you are online.",
      authStatus: "signed_in",
      user,
      mode: "cloud",
      syncStatus: "saved",
      isOfflineReadOnly: false,
      hasLegacyImport: false,
      firstTripSetup: "none",
      plannerInteractionMode: "view",
    });
    await trackEvent("trip_loaded", { source: "cloud", tripId: trip.id });
  } catch (error) {
    const cachedTrip = await cloudRepository.getCachedActiveTrip();
    if (cachedTrip) {
      markFirstTripSetupResolved(user.id);
      set({
        data: createDemoAppDataFromTrip(cachedTrip),
        isLoading: false,
        error: "Unable to reach cloud sync. Showing the last synced trip instead.",
        statusMessage: "This trip is read-only until the connection returns.",
        authStatus: "signed_in",
        user,
        mode: "cloud",
        syncStatus: "offline",
        isOfflineReadOnly: true,
        hasLegacyImport: false,
        firstTripSetup: "none",
        plannerInteractionMode: "view",
      });
      return;
    }

    set({
      data: null,
      isLoading: false,
      error: error instanceof Error ? error.message : "Unable to load cloud trip data.",
      statusMessage: "Reconnect or reload to continue setting up your trip.",
      authStatus: "signed_in",
      user,
      mode: "cloud",
      syncStatus: "error",
      isOfflineReadOnly: false,
      hasLegacyImport: false,
      firstTripSetup: "none",
      plannerInteractionMode: "view",
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
    error: `Switch to Edit trip before ${actionLabel}.`,
    statusMessage: "View mode keeps the itinerary locked until you explicitly edit it.",
  });
  return true;
};

export const useTripStore = create<TripStoreState>((set, get) => ({
  data: null,
  isLoading: false,
  error: null,
  statusMessage: null,
  authStatus: isSupabaseConfigured() ? "checking" : "disabled",
  mode: "demo",
  user: null,
  syncStatus: "idle",
  isOfflineReadOnly: false,
  hasLegacyImport: false,
  firstTripSetup: "none",
  plannerInteractionMode: "view",

  initialize: async () => {
    set({
      isLoading: true,
      error: null,
      statusMessage: null,
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
        "Configure Supabase for this environment, then sign in to open the planner.",
      );
      return;
    }

    const { data } = await client.auth.getSession();
    const sessionUser = data.session?.user ? mapUser(data.session.user) : null;

    if (!sessionUser) {
      loadAuthGateState(
        set,
        "signed_out",
        "Sign in with a magic link to open your trip and sync it across devices.",
      );
      return;
    }

    await loadSignedInMode(set, get, sessionUser);
  },

  loadData: async () => {
    await get().initialize();
  },

  signInWithMagicLink: async (email: string) => {
    const normalizedEmail = email.trim();
    if (!normalizedEmail) {
      set({ error: "Email address is required.", statusMessage: null });
      return;
    }

    const client = getSupabaseClient();
    if (!client) {
      set({ error: "Supabase is not configured for this environment.", statusMessage: null });
      return;
    }

    const emailRedirectTo =
      typeof window !== "undefined" ? `${window.location.origin}` : undefined;
    const { error } = await client.auth.signInWithOtp({
      email: normalizedEmail,
      options: { emailRedirectTo },
    });

    if (error) {
      set({ error: error.message, statusMessage: null });
      return;
    }

    set({
      error: null,
      statusMessage: `Magic link sent to ${normalizedEmail}. Open it on this device to connect cloud sync.`,
    });
    await trackEvent("magic_link_requested", { emailDomain: normalizedEmail.split("@")[1] ?? "" });
  },

  signInAsTestUser: async () => {
    if (!canUseLocalTestSignIn()) {
      set({
        error:
          "Local test sign-in needs NEXT_PUBLIC_LOCAL_TEST_SIGN_IN=1, NEXT_PUBLIC_E2E_AUTH_BYPASS=1, and E2E_AUTH_BYPASS=1.",
        statusMessage: null,
      });
      return;
    }

    const session = createLocalTestBypassSession();
    set({
      error: null,
      statusMessage: "Signing in locally as the test user...",
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
        "Supabase is not configured in this environment yet.",
      );
      return;
    }

    await client.auth.signOut();
    await trackEvent("signed_out");
    loadAuthGateState(set, "signed_out", "Signed out. Sign back in to reopen your trip.");
  },

  importLegacyTrips: async () => {
    const state = get();
    if (state.authStatus !== "signed_in" || !state.user) {
      set({ error: "Sign in before importing local trip data.", statusMessage: null });
      return;
    }

    const candidate = readLegacyLocalTrips();
    if (!candidate) {
      set({ error: "No local trip data was found to import.", statusMessage: null });
      return;
    }

    const cloudRepository = getCloudRepository();
    set({
      syncStatus: "saving",
      error: null,
      statusMessage: null,
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
          statusMessage: null,
        });
        return;
      }

      const trip = await cloudRepository.loadTrip(firstTripId);
      setPreferredActiveTripId(state.user.id, firstTripId);
      markFirstTripSetupResolved(state.user.id);
      set({
        data: createDemoAppDataFromTrip(trip),
        mode: "cloud",
        syncStatus: "saved",
        isOfflineReadOnly: false,
        hasLegacyImport: false,
        firstTripSetup: "none",
        plannerInteractionMode: "view",
        error: null,
        statusMessage: `Imported ${summaries.length} local ${summaries.length === 1 ? "trip" : "trips"} into cloud sync.`,
      });
      await trackEvent("legacy_import", { importedTrips: summaries.length });
    } catch (error) {
      set({
        syncStatus: "error",
        error: error instanceof Error ? error.message : "Unable to import local trips.",
        statusMessage: "Your local data is still available if you want to try again later.",
      });
    }
  },

  createCloudTripFromCurrent: async () => {
    const state = get();
    const activeTrip = state.data ? getActiveTrip(state.data) : null;

    if (!activeTrip) {
      set({ error: "No trip is currently loaded.", statusMessage: null });
      return;
    }

    if (state.authStatus !== "signed_in" || !state.user) {
      set({ error: "Sign in before creating a cloud-synced trip.", statusMessage: null });
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

  startWithExampleTrip: async () => {
    const state = get();

    if (state.authStatus !== "signed_in" || !state.user) {
      set({ error: "Sign in before starting with the example trip.", statusMessage: null });
      return;
    }

    set({
      isLoading: true,
      syncStatus: "saving",
      error: null,
      statusMessage: "Creating your starter trip from the example itinerary...",
      firstTripSetup: "none",
      hasLegacyImport: false,
      plannerInteractionMode: "view",
    });

    const starterTrip = buildStarterCloudTrip(state.user);
    await persistActiveTrip(set, get, starterTrip, "cloud_trip_created");

    if (!get().error) {
      markFirstTripSetupResolved(state.user.id);
      set({
        isLoading: false,
        hasLegacyImport: false,
        firstTripSetup: "none",
        plannerInteractionMode: "view",
        statusMessage:
          "Example trip ready. Open Edit trip when you want to change stops or dates.",
      });
    } else {
      set({ isLoading: false });
    }
  },

  loadCloudTrip: async (tripId: string) => {
    const state = get();
    if (state.authStatus !== "signed_in" || !state.user) {
      set({ error: "Sign in before loading a cloud trip.", statusMessage: null });
      return;
    }

    const cloudRepository = getCloudRepository();
    set({ isLoading: true, error: null, statusMessage: null });

    try {
      const trip = await cloudRepository.loadTrip(tripId);
      setPreferredActiveTripId(state.user.id, tripId);
      markFirstTripSetupResolved(state.user.id);
      set({
        data: createDemoAppDataFromTrip(trip),
        isLoading: false,
        syncStatus: "saved",
        mode: "cloud",
        isOfflineReadOnly: false,
        hasLegacyImport: false,
        firstTripSetup: "none",
        plannerInteractionMode: "view",
        statusMessage: "Cloud trip loaded successfully.",
      });
    } catch (error) {
      set({
        isLoading: false,
        syncStatus: "error",
        error: error instanceof Error ? error.message : "Unable to load the selected trip.",
        statusMessage: "The previously loaded data will remain available if possible.",
      });
    }
  },

  resetToSeed: async () => {
    const state = get();
    if (state.authStatus === "signed_in" && state.mode === "cloud") {
      set({ error: "Seed reset is only available in demo mode.", statusMessage: null });
      return;
    }

    const seed = await localRepository.resetToSeed();
    set({
      data: seed,
      error: null,
      statusMessage: "Demo seed itinerary restored.",
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
      set({ error: "Seed reset is only available in demo mode.", statusMessage: null });
      return;
    }

    const shifted = await localRepository.resetToSeedAlignedToToday();
    set({
      data: shifted,
      error: null,
      statusMessage: "Demo itinerary shifted so the trip starts now.",
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
          statusMessage: "The last synced version is still available to review.",
        });
        return;
      }

      if (!state.data || !getActiveTrip(state.data)) {
        set({
          plannerInteractionMode: "view",
          error: "Load a trip before entering edit mode.",
          statusMessage: null,
        });
        return;
      }
    }

    set({
      plannerInteractionMode: mode,
      error: null,
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
        stops: ensureStopOrder(activeTrip.stops.map((stop) => (stop.id === stopId ? updater(stop) : stop))),
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
