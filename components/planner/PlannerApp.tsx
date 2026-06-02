"use client";

import { startTransition, useEffect, useMemo, useRef, useState } from "react";

import AccountStatusControl from "@/components/planner/AccountStatusControl";
import DashboardTripDetailsPanel from "@/components/planner/DashboardTripDetailsPanel";
import DayStrip from "@/components/planner/DayStrip";
import FirstTripSetupPanel from "@/components/planner/FirstTripSetupPanel";
import MobilePlannerShell, {
  type MobilePlannerScreen,
} from "@/components/planner/MobilePlannerShell";
import MobileTodayPanel from "@/components/planner/MobileTodayPanel";
import MobileTripPanel from "@/components/planner/MobileTripPanel";
import MobileTripsPanel from "@/components/planner/MobileTripsPanel";
import PlannerAuthGate from "@/components/planner/PlannerAuthGate";
import PlannerBrandBadge from "@/components/planner/PlannerBrandBadge";
import PlannerMap from "@/components/planner/PlannerMap";
import PlannerMapCockpit from "@/components/planner/PlannerMapCockpit";
import PlannerMobileMapOverlay from "@/components/planner/PlannerMobileMapOverlay";
import StopDetailsDrawer from "@/components/planner/StopDetailsDrawer";
import TripMapPreviewPanel from "@/components/planner/TripMapPreviewPanel";
import { plannerNoticeToneClass } from "@/components/planner/plannerTheme";
import StopEditorModal from "@/components/planner/StopEditorModal";
import StopTimeline from "@/components/planner/StopTimeline";
import TodayStatusControl from "@/components/planner/TodayStatusControl";
import TravelInsightsPanel from "@/components/planner/TravelInsightsPanel";
import TripCreateModal from "@/components/planner/TripCreateModal";
import TripRenameModal from "@/components/planner/TripRenameModal";
import TripsPanel from "@/components/planner/TripsPanel";
import ValidationWarningsPanel from "@/components/planner/ValidationWarningsPanel";
import {
  dateOnlyFromIso,
  formatDateOnly,
  nowIso,
  todayDateInTimezone,
} from "@/lib/date";
import {
  createPlannerScreenStack,
  getCurrentPlannerScreen,
  isTripPlannerScreen,
  PlannerScreen,
  PlannerScreenEntry,
  pushPlannerScreen,
  replacePlannerScreen,
} from "@/lib/plannerNavigation";
import {
  getRouteEstimateCacheState,
  readCachedRouteEstimateSet,
  writeCachedRouteEstimateSet,
} from "@/lib/routeEstimateCache";
import {
  buildTripTravelLegPayload,
  fetchTravelLegEstimates,
  mergeTravelEstimateMetadata,
} from "@/lib/routeEstimates";
import { getExampleTripDefaultName } from "@/lib/tripFactories";
import {
  formatTripDateRange,
  getItineraryDays,
  getMapData,
  getSelectedEntityDetails,
  getSelectedEntityPrimaryDate,
  getTodayActions,
  getTripDays,
  getValidationWarnings,
  moveStopByOffset,
  reorderStopsById,
  ensureStopOrder,
} from "@/lib/tripDerived";
import { getPlannerMapRouteSummary, type PlannerMapRouteSummary } from "@/lib/plannerMap";
import { useTripStore } from "@/store/useTripStore";
import {
  NewTripStop,
  PlannerNoticeTone,
  PersistedRouteSnapshot,
  SelectedEntity,
  StopType,
  TravelLegEstimate,
  TravelLegRequest,
  Trip,
  TripStop,
  TripSummary,
  ValidationWarning,
} from "@/types/trip";

type EditorState = {
  isOpen: boolean;
  mode: "create" | "edit";
  type: StopType;
  initialStop: TripStop | null;
};

type SelectionOrigin = "itinerary" | "map" | "system";
type MobileMapOverlayContext = "overview" | "dashboard" | "itinerary" | "today";
type RouteInsightsState = "fresh" | "stale" | "unavailable";
type RoutePanelState = {
  estimates: TravelLegEstimate[];
  isRefreshing: boolean;
  status: RouteInsightsState;
  statusMessage: string | null;
};

const defaultEditorState: EditorState = {
  isOpen: false,
  mode: "create",
  type: "stay",
  initialStop: null,
};

const defaultRoutePanelState: RoutePanelState = {
  estimates: [],
  isRefreshing: false,
  status: "fresh",
  statusMessage: null,
};

const saveFeedbackToneClass: Record<PlannerNoticeTone, string> = plannerNoticeToneClass;
const defaultExpandedWarningSeverities: ValidationWarning["severity"][] = ["high", "medium"];

const routeStatusLabels: Record<RouteInsightsState, string> = {
  fresh: "Live",
  stale: "Needs refresh",
  unavailable: "Unavailable",
};

const getRouteStatusLabel = (panel: RoutePanelState): string =>
  panel.isRefreshing ? "Refreshing route..." : routeStatusLabels[panel.status];

const getRouteStatusToneClass = (status: RouteInsightsState): string => {
  if (status === "fresh") {
    return "tone-success";
  }

  if (status === "unavailable") {
    return "tone-error";
  }

  return "tone-warning";
};

const getLatestRouteRefreshLabel = (estimates: TravelLegEstimate[]): string | null => {
  const latestFetchedAt = estimates.reduce<string | null>((latest, estimate) => {
    if (!latest) {
      return estimate.fetchedAt;
    }

    return new Date(estimate.fetchedAt).getTime() > new Date(latest).getTime()
      ? estimate.fetchedAt
      : latest;
  }, null);

  return latestFetchedAt ? formatDateOnly(dateOnlyFromIso(latestFetchedAt)) : null;
};

const cloneTrip = (trip: Trip): Trip => structuredClone(trip);

const getRouteSnapshotKey = (trip: Trip | null): string => {
  const snapshot = trip?.routeSnapshot;

  return snapshot ? `${snapshot.signature}:${snapshot.fetchedAt}` : "";
};

const describeRouteSnapshotAge = (fetchedAt: string, now: number = Date.now()): string => {
  const timestamp = new Date(fetchedAt).getTime();
  if (!Number.isFinite(timestamp)) {
    return "an unknown age";
  }

  const elapsedMs = Math.max(0, now - timestamp);
  const elapsedMinutes = Math.floor(elapsedMs / 60_000);
  const elapsedHours = Math.floor(elapsedMs / 3_600_000);
  const elapsedDays = Math.floor(elapsedMs / 86_400_000);

  if (elapsedDays >= 1) {
    return `${elapsedDays} day${elapsedDays === 1 ? "" : "s"} old`;
  }

  if (elapsedHours >= 1) {
    return `${elapsedHours} hour${elapsedHours === 1 ? "" : "s"} old`;
  }

  if (elapsedMinutes >= 1) {
    return `${elapsedMinutes} minute${elapsedMinutes === 1 ? "" : "s"} old`;
  }

  return "just refreshed";
};

const buildRoutePanelFromSnapshot = (
  snapshot: PersistedRouteSnapshot,
  requests: TravelLegRequest[],
  signature: string,
  now: number = Date.now(),
): RoutePanelState => {
  const signatureMatches = snapshot.signature === signature;
  const estimates = signatureMatches
    ? mergeTravelEstimateMetadata(snapshot.estimates, requests)
    : snapshot.estimates;
  const cacheState = getRouteEstimateCacheState(snapshot.fetchedAt, now);
  const ageLabel = describeRouteSnapshotAge(snapshot.fetchedAt, now);

  if (!signatureMatches) {
    return {
      estimates,
      isRefreshing: false,
      status: "stale",
      statusMessage: `Saved route data is ${ageLabel} and no longer matches this itinerary. Refresh the route to bring it live.`,
    };
  }

  if (cacheState === "stale") {
    return {
      estimates,
      isRefreshing: false,
      status: "stale",
      statusMessage: `Saved route data is ${ageLabel}. Refresh the route to bring it live.`,
    };
  }

  return {
    estimates,
    isRefreshing: false,
    status: "fresh",
    statusMessage: null,
  };
};

const dashboardIcon = () => {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
      <rect x="4" y="5" width="16" height="14" rx="2.2" />
      <path d="M8 9h8" strokeLinecap="round" />
      <path d="M8 13h5" strokeLinecap="round" />
    </svg>
  );
};

export default function PlannerApp() {
  const {
    data,
    tripSummaries,
    tripCache,
    todayTripId,
    isLoading,
    error,
    notice,
    authStatus,
    mode,
    user,
    syncStatus,
    isOfflineReadOnly,
    hasLegacyImport,
    firstTripSetup,
    plannerInteractionMode,
    initialize,
    signInWithMagicLink,
    signInAsTestUser,
    signOut,
    importLegacyTrips,
    createCloudTripFromCurrent,
    createTrip,
    startWithExampleTrip,
    loadCloudTrip,
    previewCloudTrip,
    saveRouteSnapshot,
    setTodayTripId,
    renameTrip,
    deleteTrip,
    resetToSeed,
    resetToSeedAlignedToToday,
    setPlannerInteractionMode,
    updateTrip,
  } = useTripStore();

  const [selectedDate, setSelectedDate] = useState(todayDateInTimezone());
  const [selectedEntity, setSelectedEntity] = useState<SelectedEntity>(null);
  const [selectionOrigin, setSelectionOrigin] = useState<SelectionOrigin>("system");
  const [editor, setEditor] = useState<EditorState>(defaultEditorState);
  const [screenStack, setScreenStack] = useState<PlannerScreenEntry[]>(() =>
    createPlannerScreenStack(),
  );
  const [loadedRoutePanel, setLoadedRoutePanel] = useState<RoutePanelState>(defaultRoutePanelState);
  const [previewRoutePanel, setPreviewRoutePanel] = useState<RoutePanelState>(defaultRoutePanelState);
  const [isTripCreateOpen, setIsTripCreateOpen] = useState(false);
  const [tripToRename, setTripToRename] = useState<TripSummary | null>(null);
  const [isManagingTrips, setIsManagingTrips] = useState(false);
  const [previewTripId, setPreviewTripId] = useState<string | null>(null);
  const [isPreviewingTripId, setIsPreviewingTripId] = useState<string | null>(null);
  const [isUpdatingTodayTripId, setIsUpdatingTodayTripId] = useState<string | null>(null);
  const [draftTrip, setDraftTrip] = useState<Trip | null>(null);
  const [isSavingDraft, setIsSavingDraft] = useState(false);
  const [dashboardSelectedEntity, setDashboardSelectedEntity] = useState<SelectedEntity>(null);
  const [dashboardSelectionOrigin, setDashboardSelectionOrigin] =
    useState<SelectionOrigin>("system");
  const [todaySelectedEntity, setTodaySelectedEntity] = useState<SelectedEntity>(null);
  const [todaySelectionOrigin, setTodaySelectionOrigin] = useState<SelectionOrigin>("system");
  const [mobileMapOverlay, setMobileMapOverlay] = useState<MobileMapOverlayContext | null>(null);
  const [mobileScreen, setMobileScreen] = useState<MobilePlannerScreen>("today");
  const [isMapCockpitOpen, setIsMapCockpitOpen] = useState(false);
  const [isStopDetailsOpen, setIsStopDetailsOpen] = useState(false);
  const [saveFeedback, setSaveFeedback] = useState<{
    tone: PlannerNoticeTone;
    text: string;
  } | null>(null);
  const loadedRouteRefreshCounterRef = useRef(0);
  const previewRouteRefreshCounterRef = useRef(0);

  useEffect(() => {
    void initialize();
  }, [initialize]);

  const loadedTrip = useMemo(() => {
    if (!data) {
      return null;
    }

    return data.trips.find((trip) => trip.id === data.activeTripId) ?? null;
  }, [data]);
  const displayTrip = plannerInteractionMode === "edit" && draftTrip ? draftTrip : loadedTrip;
  const previewTrip = previewTripId ? tripCache[previewTripId] ?? null : null;
  const todayTrip = todayTripId ? tripCache[todayTripId] ?? null : null;
  const currentScreenEntry = useMemo(
    () => getCurrentPlannerScreen(screenStack),
    [screenStack],
  );
  const isTripScreen = isTripPlannerScreen(currentScreenEntry.screen);

  const isCloudTripLibraryAvailable = authStatus === "signed_in" && mode === "cloud";

  useEffect(() => {
    if (previewTripId && !tripSummaries.some((trip) => trip.id === previewTripId)) {
      setPreviewTripId(null);
    }
  }, [previewTripId, tripSummaries]);

  useEffect(() => {
    if (!loadedTrip && isTripScreen) {
      setScreenStack(createPlannerScreenStack());
    }
  }, [isTripScreen, loadedTrip]);

  useEffect(() => {
    if (!isCloudTripLibraryAvailable || previewTripId || isPreviewingTripId || tripSummaries.length === 0) {
      return;
    }

    const nextPreviewTripId = tripSummaries[0].id;
    let isCancelled = false;
    setIsPreviewingTripId(nextPreviewTripId);

    void (async () => {
      try {
        const nextTrip = await previewCloudTrip(nextPreviewTripId);
        if (!isCancelled && nextTrip) {
          setPreviewTripId(nextTrip.id);
        }
      } finally {
        if (!isCancelled) {
          setIsPreviewingTripId((current) =>
            current === nextPreviewTripId ? null : current,
          );
        }
      }
    })();

    return () => {
      isCancelled = true;
    };
  }, [
    isCloudTripLibraryAvailable,
    isPreviewingTripId,
    previewCloudTrip,
    previewTripId,
    tripSummaries,
  ]);

  useEffect(() => {
    if (plannerInteractionMode !== "edit") {
      setDraftTrip(null);
      return;
    }

    if (!loadedTrip) {
      setDraftTrip(null);
      return;
    }

    setDraftTrip((current) => current ?? cloneTrip(loadedTrip));
  }, [loadedTrip, plannerInteractionMode]);

  useEffect(() => {
    if (plannerInteractionMode !== "edit" || !loadedTrip) {
      return;
    }

    setDraftTrip((current) => {
      if (!current || current.id !== loadedTrip.id) {
        return current;
      }

      return {
        ...current,
        version: loadedTrip.version,
        routeSnapshot: loadedTrip.routeSnapshot,
        lastSyncedAt: loadedTrip.lastSyncedAt,
      };
    });
  }, [loadedTrip, plannerInteractionMode]);

  useEffect(() => {
    if (!saveFeedback || saveFeedback.tone === "warning") {
      return;
    }

    const timer = window.setTimeout(() => setSaveFeedback(null), 2200);
    return () => window.clearTimeout(timer);
  }, [saveFeedback]);

  const loadedRoutePayload = useMemo(() => {
    if (!displayTrip) {
      return {
        requests: [],
        signature: "",
      };
    }

    return buildTripTravelLegPayload(displayTrip);
  }, [displayTrip]);
  const previewRoutePayload = useMemo(() => {
    if (!previewTrip) {
      return {
        requests: [],
        signature: "",
      };
    }

    return buildTripTravelLegPayload(previewTrip);
  }, [previewTrip]);
  const loadedRouteRequests = loadedRoutePayload.requests;
  const loadedRouteSignature = loadedRoutePayload.signature;
  const previewRouteRequests = previewRoutePayload.requests;
  const previewRouteSignature = previewRoutePayload.signature;
  const loadedRouteSnapshotKey = getRouteSnapshotKey(displayTrip);
  const previewRouteSnapshotKey = getRouteSnapshotKey(previewTrip);
  const loadedTripRef = useRef(displayTrip);
  const loadedRouteRequestsRef = useRef(loadedRouteRequests);
  const loadedRouteSignatureRef = useRef(loadedRouteSignature);
  const previewTripRef = useRef(previewTrip);
  const previewRouteRequestsRef = useRef(previewRouteRequests);
  const previewRouteSignatureRef = useRef(previewRouteSignature);

  useEffect(() => {
    loadedTripRef.current = displayTrip;
    loadedRouteRequestsRef.current = loadedRouteRequests;
    loadedRouteSignatureRef.current = loadedRouteSignature;
    previewTripRef.current = previewTrip;
    previewRouteRequestsRef.current = previewRouteRequests;
    previewRouteSignatureRef.current = previewRouteSignature;
  }, [
    displayTrip,
    loadedRouteRequests,
    loadedRouteSignature,
    previewRouteRequests,
    previewRouteSignature,
    previewTrip,
  ]);

  const resolveBaseRoutePanelState = async (
    currentTrip: Trip,
    currentRequests: TravelLegRequest[],
    currentSignature: string,
  ): Promise<RoutePanelState> => {
    const persistedSnapshot = currentTrip.routeSnapshot ?? null;
    if (persistedSnapshot) {
      return buildRoutePanelFromSnapshot(
        persistedSnapshot,
        currentRequests,
        currentSignature,
      );
    }

    const cached = await readCachedRouteEstimateSet(currentSignature);
    const cachedEstimates = cached.entry
      ? mergeTravelEstimateMetadata(cached.entry.estimates, currentRequests)
      : [];

    if (cached.entry) {
      return {
        estimates: cachedEstimates,
        isRefreshing: false,
        status: "stale",
        statusMessage:
          "Showing a local route preview saved on this device. Refresh the route to bring it live for this trip.",
      };
    }

    return {
      estimates: [],
      isRefreshing: false,
      status: "stale",
      statusMessage: "No saved route data yet. Refresh the route to bring it live for this trip.",
    };
  };

  const syncLoadedRoutePanel = async (fetchFresh: boolean) => {
    const currentTrip = loadedTripRef.current;
    const currentRequests = loadedRouteRequestsRef.current;
    const currentSignature = loadedRouteSignatureRef.current;

    if (!currentTrip || currentRequests.length === 0) {
      startTransition(() => setLoadedRoutePanel(defaultRoutePanelState));
      return;
    }

    const refreshId = loadedRouteRefreshCounterRef.current + 1;
    loadedRouteRefreshCounterRef.current = refreshId;
    const basePanel = await resolveBaseRoutePanelState(
      currentTrip,
      currentRequests,
      currentSignature,
    );
    if (loadedRouteRefreshCounterRef.current !== refreshId) {
      return;
    }

    setLoadedRoutePanel(basePanel);

    if (!fetchFresh) {
      return;
    }

    setLoadedRoutePanel({
      ...basePanel,
      isRefreshing: true,
    });

    try {
      const estimates = await fetchTravelLegEstimates(currentRequests);
      if (loadedRouteRefreshCounterRef.current !== refreshId) {
        return;
      }

      const mergedEstimates = mergeTravelEstimateMetadata(estimates, currentRequests);
      const fetchedAt = nowIso();
      await writeCachedRouteEstimateSet(currentSignature, mergedEstimates, fetchedAt);

      const savedTrip = await saveRouteSnapshot(currentTrip.id, {
        signature: currentSignature,
        fetchedAt,
        estimates: mergedEstimates,
      });
      if (loadedRouteRefreshCounterRef.current !== refreshId) {
        return;
      }

      if (savedTrip?.routeSnapshot) {
        setLoadedRoutePanel(
          buildRoutePanelFromSnapshot(
            savedTrip.routeSnapshot,
            currentRequests,
            currentSignature,
          ),
        );
        return;
      }

      setLoadedRoutePanel({
        estimates: mergedEstimates,
        isRefreshing: false,
        status: "stale",
        statusMessage:
          "Refreshed route data is only available on this device until the trip can be saved.",
      });
    } catch (caught) {
      if (loadedRouteRefreshCounterRef.current !== refreshId) {
        return;
      }

      setLoadedRoutePanel({
        ...basePanel,
        isRefreshing: false,
        status: basePanel.estimates.length > 0 ? "stale" : "unavailable",
        statusMessage:
          basePanel.estimates.length > 0
            ? caught instanceof Error
              ? `${caught.message} Showing the last saved route data instead.`
              : "Unable to refresh the route. Showing the last saved route data instead."
            : caught instanceof Error
              ? caught.message
              : "Unable to refresh the route.",
      });
    }
  };

  const syncPreviewRoutePanel = async (fetchFresh: boolean) => {
    const currentTrip = previewTripRef.current;
    const currentRequests = previewRouteRequestsRef.current;
    const currentSignature = previewRouteSignatureRef.current;

    if (!currentTrip || currentRequests.length === 0) {
      startTransition(() => setPreviewRoutePanel(defaultRoutePanelState));
      return;
    }

    const refreshId = previewRouteRefreshCounterRef.current + 1;
    previewRouteRefreshCounterRef.current = refreshId;
    const basePanel = await resolveBaseRoutePanelState(
      currentTrip,
      currentRequests,
      currentSignature,
    );
    if (previewRouteRefreshCounterRef.current !== refreshId) {
      return;
    }

    setPreviewRoutePanel(basePanel);

    if (!fetchFresh) {
      return;
    }

    setPreviewRoutePanel({
      ...basePanel,
      isRefreshing: true,
    });

    try {
      const estimates = await fetchTravelLegEstimates(currentRequests);
      if (previewRouteRefreshCounterRef.current !== refreshId) {
        return;
      }

      const mergedEstimates = mergeTravelEstimateMetadata(estimates, currentRequests);
      const fetchedAt = nowIso();
      await writeCachedRouteEstimateSet(currentSignature, mergedEstimates, fetchedAt);

      const savedTrip = await saveRouteSnapshot(currentTrip.id, {
        signature: currentSignature,
        fetchedAt,
        estimates: mergedEstimates,
      });
      if (previewRouteRefreshCounterRef.current !== refreshId) {
        return;
      }

      if (savedTrip?.routeSnapshot) {
        setPreviewRoutePanel(
          buildRoutePanelFromSnapshot(
            savedTrip.routeSnapshot,
            currentRequests,
            currentSignature,
          ),
        );
        return;
      }

      setPreviewRoutePanel({
        estimates: mergedEstimates,
        isRefreshing: false,
        status: "stale",
        statusMessage:
          "Refreshed route data is only available on this device until the trip can be saved.",
      });
    } catch (caught) {
      if (previewRouteRefreshCounterRef.current !== refreshId) {
        return;
      }

      setPreviewRoutePanel({
        ...basePanel,
        isRefreshing: false,
        status: basePanel.estimates.length > 0 ? "stale" : "unavailable",
        statusMessage:
          basePanel.estimates.length > 0
            ? caught instanceof Error
              ? `${caught.message} Showing the last saved route data instead.`
              : "Unable to refresh the route. Showing the last saved route data instead."
            : caught instanceof Error
              ? caught.message
              : "Unable to refresh the route.",
      });
    }
  };

  useEffect(() => {
    const currentTrip = loadedTripRef.current;
    const currentRequests = loadedRouteRequestsRef.current;
    const currentSignature = loadedRouteSignatureRef.current;

    if (!currentTrip || currentRequests.length === 0) {
      startTransition(() => setLoadedRoutePanel(defaultRoutePanelState));
      return;
    }

    const refreshId = loadedRouteRefreshCounterRef.current + 1;
    loadedRouteRefreshCounterRef.current = refreshId;

    void (async () => {
      const basePanel = await resolveBaseRoutePanelState(
        currentTrip,
        currentRequests,
        currentSignature,
      );
      if (loadedRouteRefreshCounterRef.current !== refreshId) {
        return;
      }

      setLoadedRoutePanel(basePanel);
    })();
  }, [loadedRouteSignature, loadedRouteSnapshotKey, loadedTrip?.id]);

  useEffect(() => {
    const currentTrip = previewTripRef.current;
    const currentRequests = previewRouteRequestsRef.current;
    const currentSignature = previewRouteSignatureRef.current;

    if (!currentTrip || currentRequests.length === 0) {
      startTransition(() => setPreviewRoutePanel(defaultRoutePanelState));
      return;
    }

    const refreshId = previewRouteRefreshCounterRef.current + 1;
    previewRouteRefreshCounterRef.current = refreshId;

    void (async () => {
      const basePanel = await resolveBaseRoutePanelState(
        currentTrip,
        currentRequests,
        currentSignature,
      );
      if (previewRouteRefreshCounterRef.current !== refreshId) {
        return;
      }

      setPreviewRoutePanel(basePanel);
    })();
  }, [previewRouteSignature, previewRouteSnapshotKey, previewTrip?.id]);

  const tripDays = useMemo(() => (displayTrip ? getTripDays(displayTrip) : []), [displayTrip]);
  const effectiveSelectedDate = tripDays.includes(selectedDate)
    ? selectedDate
    : tripDays[0] ?? selectedDate;

  const itineraryDays = useMemo(
    () => (displayTrip ? getItineraryDays(displayTrip, loadedRoutePanel.estimates) : []),
    [displayTrip, loadedRoutePanel.estimates],
  );
  const activeItineraryDays = useMemo(() => {
    if (itineraryDays.length === 0) {
      return [];
    }

    const activeDays = itineraryDays.filter((day) => day.rows.length > 0);
    const selectedDay = itineraryDays.find((day) => day.date === effectiveSelectedDate) ?? null;
    const shouldKeepSelectedDay =
      selectedDay && !activeDays.some((day) => day.date === selectedDay.date);

    const days = shouldKeepSelectedDay ? [...activeDays, selectedDay] : activeDays;
    return (days.length > 0 ? days : itineraryDays).sort((a, b) => a.date.localeCompare(b.date));
  }, [effectiveSelectedDate, itineraryDays]);

  const loadedMapData = useMemo(
    () =>
      displayTrip
        ? getMapData(displayTrip, loadedRoutePanel.estimates)
        : { markers: [], segments: [] },
    [displayTrip, loadedRoutePanel.estimates],
  );

  const todayTripSummary = useMemo(
    () => (todayTripId ? tripSummaries.find((trip) => trip.id === todayTripId) ?? null : null),
    [todayTripId, tripSummaries],
  );
  const todayTripName = todayTrip?.name ?? todayTripSummary?.name ?? null;
  const todayActions = useMemo(() => (todayTrip ? getTodayActions(todayTrip) : []), [todayTrip]);
  const todayRoutePayload = useMemo(() => {
    if (!todayTrip) {
      return {
        requests: [],
        signature: "",
      };
    }

    return buildTripTravelLegPayload(todayTrip);
  }, [todayTrip]);
  const todayRoutePanel = useMemo<RoutePanelState>(() => {
    if (!todayTrip || todayRoutePayload.requests.length === 0) {
      return defaultRoutePanelState;
    }

    if (!todayTrip.routeSnapshot) {
      return {
        estimates: [],
        isRefreshing: false,
        status: "stale",
        statusMessage: "No saved route data yet. Open the trip to refresh the route.",
      };
    }

    return buildRoutePanelFromSnapshot(
      todayTrip.routeSnapshot,
      todayRoutePayload.requests,
      todayRoutePayload.signature,
    );
  }, [todayRoutePayload, todayTrip]);
  const todayItineraryDays = useMemo(
    () => (todayTrip ? getItineraryDays(todayTrip, todayRoutePanel.estimates) : []),
    [todayRoutePanel.estimates, todayTrip],
  );
  const todayValidationWarnings = useMemo(
    () => (todayTrip ? getValidationWarnings(todayTrip, todayRoutePanel.estimates) : []),
    [todayRoutePanel.estimates, todayTrip],
  );
  const todayMapData = useMemo(
    () =>
      todayTrip
        ? getMapData(todayTrip, todayRoutePanel.estimates)
        : { markers: [], segments: [] },
    [todayRoutePanel.estimates, todayTrip],
  );
  const loadedValidationWarnings = useMemo(
    () => (displayTrip ? getValidationWarnings(displayTrip, loadedRoutePanel.estimates) : []),
    [displayTrip, loadedRoutePanel.estimates],
  );
  const previewValidationWarnings = useMemo(
    () => (previewTrip ? getValidationWarnings(previewTrip, previewRoutePanel.estimates) : []),
    [previewRoutePanel.estimates, previewTrip],
  );
  const dashboardTrip = isCloudTripLibraryAvailable ? previewTrip : displayTrip;
  const dashboardRoutePanel = isCloudTripLibraryAvailable ? previewRoutePanel : loadedRoutePanel;
  const dashboardRouteRequests = isCloudTripLibraryAvailable ? previewRouteRequests : loadedRouteRequests;
  const dashboardValidationWarnings = isCloudTripLibraryAvailable
    ? previewValidationWarnings
    : loadedValidationWarnings;
  const dashboardMapData = useMemo(
    () =>
      dashboardTrip
        ? getMapData(dashboardTrip, dashboardRoutePanel.estimates)
        : { markers: [], segments: [] },
    [dashboardRoutePanel.estimates, dashboardTrip],
  );
  const dashboardTripSummary = useMemo(
    () =>
      dashboardTrip
        ? tripSummaries.find((trip) => trip.id === dashboardTrip.id) ?? null
        : null,
    [dashboardTrip, tripSummaries],
  );
  const effectiveSelectedEntity = useMemo<SelectedEntity>(() => {
    if (!displayTrip || !selectedEntity) {
      return null;
    }

    return displayTrip.stops.some((stop) => stop.id === selectedEntity.stopId)
      ? selectedEntity
      : null;
  }, [displayTrip, selectedEntity]);
  const effectiveDashboardSelectedEntity = useMemo<SelectedEntity>(() => {
    if (!dashboardTrip || !dashboardSelectedEntity) {
      return null;
    }

    return dashboardTrip.stops.some((stop) => stop.id === dashboardSelectedEntity.stopId)
      ? dashboardSelectedEntity
      : null;
  }, [dashboardSelectedEntity, dashboardTrip]);
  const inlineNotice = notice?.surface === "inline" ? notice : null;
  const accountNotice = notice?.surface === "account" ? notice : null;
  const authNotice = notice?.surface === "auth" ? notice : null;
  const loadedRouteMapSummary = useMemo<PlannerMapRouteSummary>(
    () => getPlannerMapRouteSummary(loadedMapData.segments, loadedRoutePanel.isRefreshing),
    [loadedMapData.segments, loadedRoutePanel.isRefreshing],
  );
  const dashboardRouteMapSummary = useMemo<PlannerMapRouteSummary>(
    () => getPlannerMapRouteSummary(dashboardMapData.segments, dashboardRoutePanel.isRefreshing),
    [dashboardMapData.segments, dashboardRoutePanel.isRefreshing],
  );
  const todayRouteMapSummary = useMemo<PlannerMapRouteSummary>(
    () => getPlannerMapRouteSummary(todayMapData.segments, todayRoutePanel.isRefreshing),
    [todayMapData.segments, todayRoutePanel.isRefreshing],
  );

  const canEditTrip = plannerInteractionMode === "edit" && !isOfflineReadOnly;
  const selectedEntityDetails = useMemo(
    () =>
      displayTrip
        ? getSelectedEntityDetails(displayTrip, effectiveSelectedEntity, loadedRoutePanel.estimates)
        : null,
    [displayTrip, effectiveSelectedEntity, loadedRoutePanel.estimates],
  );
  const dashboardSelectedEntityDetails = useMemo(
    () =>
      dashboardTrip
        ? getSelectedEntityDetails(
            dashboardTrip,
            effectiveDashboardSelectedEntity,
            dashboardRoutePanel.estimates,
          )
        : null,
    [dashboardRoutePanel.estimates, dashboardTrip, effectiveDashboardSelectedEntity],
  );
  const effectiveTodaySelectedEntity = useMemo<SelectedEntity>(() => {
    if (!todayTrip || !todaySelectedEntity) {
      return null;
    }

    return todayTrip.stops.some((stop) => stop.id === todaySelectedEntity.stopId)
      ? todaySelectedEntity
      : null;
  }, [todaySelectedEntity, todayTrip]);
  const todaySelectedEntityDetails = useMemo(
    () =>
      todayTrip
        ? getSelectedEntityDetails(
            todayTrip,
            effectiveTodaySelectedEntity,
            todayRoutePanel.estimates,
          )
        : null,
    [effectiveTodaySelectedEntity, todayRoutePanel.estimates, todayTrip],
  );
  const isTripLibraryBusy = isLoading || isManagingTrips || syncStatus === "saving";
  const shellTitle =
    currentScreenEntry.screen === "trip-itinerary"
      ? "Itinerary"
      : currentScreenEntry.screen === "trip-overview"
        ? "Overview"
        : "Dashboard";
  const shellSummary =
    currentScreenEntry.screen === "trip-itinerary"
      ? loadedTrip
        ? `${loadedTrip.name} · ${tripDays.length} ${tripDays.length === 1 ? "day" : "days"}`
        : "Open a trip to manage its itinerary"
      : currentScreenEntry.screen === "trip-overview"
        ? loadedTrip
          ? loadedTrip.name
          : "Open a trip to review its route realism"
        : dashboardTrip
          ? `${isCloudTripLibraryAvailable ? "Previewing" : "Showing"} ${dashboardTrip.name}`
          : "Select a trip to preview its latest route realism and warnings";
  const hasDraftChanges = useMemo(() => {
    if (plannerInteractionMode !== "edit" || !draftTrip || !loadedTrip) {
      return false;
    }

    return JSON.stringify(draftTrip) !== JSON.stringify(loadedTrip);
  }, [draftTrip, loadedTrip, plannerInteractionMode]);

  useEffect(() => {
    setDashboardSelectedEntity(null);
    setDashboardSelectionOrigin("system");
  }, [dashboardTrip?.id]);

  useEffect(() => {
    setTodaySelectedEntity(null);
    setTodaySelectionOrigin("system");
  }, [todayTrip?.id]);

  useEffect(() => {
    setMobileScreen((current) => {
      if (mode === "demo") {
        return "trip";
      }

      if (todayTripId && current === "trip" && !isTripScreen) {
        return "today";
      }

      if (!todayTripId && (current === "today" || (current === "trip" && !loadedTrip))) {
        return "trips";
      }

      return current;
    });
  }, [isTripScreen, loadedTrip, mode, todayTripId]);

  useEffect(() => {
    if (!mobileMapOverlay) {
      return;
    }

    if (mobileMapOverlay === "dashboard" && !dashboardTrip) {
      setMobileMapOverlay(null);
      return;
    }

    if (mobileMapOverlay === "today" && !todayTrip) {
      setMobileMapOverlay(null);
      return;
    }

    if (
      mobileMapOverlay !== "dashboard" &&
      mobileMapOverlay !== "today" &&
      !displayTrip
    ) {
      setMobileMapOverlay(null);
    }
  }, [dashboardTrip, displayTrip, mobileMapOverlay, todayTrip]);

  useEffect(() => {
    if (isMapCockpitOpen && !displayTrip) {
      setIsMapCockpitOpen(false);
    }
  }, [displayTrip, isMapCockpitOpen]);

  const confirmDiscardDraftChanges = (actionLabel: string) => {
    if (!hasDraftChanges) {
      return true;
    }

    return window.confirm(
      `Discard your unsaved itinerary changes before ${actionLabel}?`,
    );
  };

  const navigateToScreen = (nextEntry: PlannerScreenEntry) => {
    setScreenStack((current) => pushPlannerScreen(current, nextEntry));
  };

  const switchTripScreen = (screen: Exclude<PlannerScreen, "dashboard">) => {
    if (!loadedTrip) {
      return;
    }

    setScreenStack((current) =>
      replacePlannerScreen(current, {
        screen,
        tripId: loadedTrip.id,
      }),
    );
  };

  const startEditSession = () => {
    if (!loadedTrip || isOfflineReadOnly) {
      return false;
    }

    setDraftTrip((current) => current ?? cloneTrip(loadedTrip));
    setPlannerInteractionMode("edit");
    return true;
  };

  const openCreateStopEditor = (type: StopType) => {
    if (!startEditSession()) {
      return;
    }

    setEditor({
      isOpen: true,
      mode: "create",
      type,
      initialStop: null,
    });
  };

  const enterEditMode = () => {
    startEditSession();
  };

  const exitEditMode = () => {
    setEditor(defaultEditorState);
    setDraftTrip(null);
    setSaveFeedback(null);
    setPlannerInteractionMode("view");
  };

  const mutateDraftTrip = (updater: (trip: Trip) => Trip) => {
    setDraftTrip((current) => {
      if (!current) {
        return current;
      }

      return {
        ...updater(current),
        updatedAt: nowIso(),
      };
    });
  };

  const onCreateStop = async (stop: NewTripStop) => {
    if (!canEditTrip || !draftTrip) {
      return;
    }

    mutateDraftTrip((currentTrip) => ({
      ...currentTrip,
      stops: ensureStopOrder([
        ...currentTrip.stops,
        {
          ...stop,
          id: crypto.randomUUID(),
          order: currentTrip.stops.length,
        } as TripStop,
      ]),
    }));
  };

  const onUpdateStop = async (nextStop: TripStop) => {
    if (!canEditTrip || !draftTrip) {
      return;
    }

    mutateDraftTrip((currentTrip) => ({
      ...currentTrip,
      stops: ensureStopOrder(
        currentTrip.stops.map((stop) => (stop.id === nextStop.id ? nextStop : stop)),
      ),
    }));
  };

  const onDeleteStop = async (stopId: string) => {
    if (!canEditTrip || !draftTrip) {
      return;
    }

    mutateDraftTrip((currentTrip) => ({
      ...currentTrip,
      stops: ensureStopOrder(currentTrip.stops.filter((stop) => stop.id !== stopId)),
    }));
  };

  const onReorderStops = async (activeId: string, overId: string) => {
    if (!canEditTrip || !draftTrip) {
      return;
    }

    const nextStops = reorderStopsById(draftTrip.stops, activeId, overId);
    const movedStop = nextStops.find((stop) => stop.id === activeId) ?? null;

    mutateDraftTrip((currentTrip) => ({
      ...currentTrip,
      stops: nextStops,
    }));

    if (movedStop) {
      setSelectedDate(getSelectedEntityPrimaryDate({ ...draftTrip, stops: nextStops }, { kind: movedStop.type, stopId: movedStop.id }) ?? selectedDate);
      setSelectedEntity({ kind: movedStop.type, stopId: movedStop.id });
    }
  };

  const onMoveStop = (stopId: string, offset: -1 | 1) => {
    if (!canEditTrip || !draftTrip) {
      return;
    }

    const nextStops = moveStopByOffset(draftTrip.stops, stopId, offset);
    const movedStop = nextStops.find((stop) => stop.id === stopId) ?? null;

    mutateDraftTrip((currentTrip) => ({
      ...currentTrip,
      stops: nextStops,
    }));

    if (movedStop) {
      setSelectedDate(getSelectedEntityPrimaryDate({ ...draftTrip, stops: nextStops }, { kind: movedStop.type, stopId: movedStop.id }) ?? selectedDate);
      setSelectedEntity({ kind: movedStop.type, stopId: movedStop.id });
    }
  };

  const onSelectDate = (date: string) => {
    setSelectedDate(date);
  };

  const selectEntity = (entity: Exclude<SelectedEntity, null>, origin: SelectionOrigin) => {
    setSelectionOrigin(origin);
    setSelectedEntity(entity);

    if (displayTrip) {
      const entityDate = getSelectedEntityPrimaryDate(displayTrip, entity);
      if (entityDate) {
        setSelectedDate(entityDate);
      }
    }
  };

  const onSelectEntityFromItinerary = (entity: Exclude<SelectedEntity, null>) => {
    selectEntity(entity, "itinerary");
  };

  const onViewStopDetails = (stop: TripStop) => {
    selectEntity({ kind: stop.type, stopId: stop.id }, "itinerary");
    setIsStopDetailsOpen(true);
  };

  const openEditStopEditor = (stop: TripStop) => {
    if (!startEditSession()) {
      return;
    }

    setSelectedEntity({ kind: stop.type, stopId: stop.id });
    setSelectedDate(getSelectedEntityPrimaryDate(displayTrip ?? loadedTrip!, { kind: stop.type, stopId: stop.id }) ?? selectedDate);
    setEditor({
      isOpen: true,
      mode: "edit",
      type: stop.type,
      initialStop: stop,
    });
  };

  const onSelectEntityFromMap = (entity: Exclude<SelectedEntity, null>) => {
    selectEntity(entity, "map");
  };

  const onSelectEntityFromDashboardMap = (entity: Exclude<SelectedEntity, null>) => {
    setDashboardSelectionOrigin("map");
    setDashboardSelectedEntity(entity);
  };

  const onSelectEntityFromTodayMap = (entity: Exclude<SelectedEntity, null>) => {
    setTodaySelectionOrigin("map");
    setTodaySelectedEntity(entity);
  };

  const openMobileMapOverlay = (context: MobileMapOverlayContext) => {
    setMobileMapOverlay(context);
  };

  const handlePreviewTrip = async (tripId: string) => {
    if (previewTripId === tripId) {
      return;
    }

    setIsPreviewingTripId(tripId);

    try {
      const trip = await previewCloudTrip(tripId);
      if (trip) {
        setPreviewTripId(trip.id);
      }
    } finally {
      setIsPreviewingTripId((current) => (current === tripId ? null : current));
    }
  };

  const handleToggleTodayTrip = async (tripId: string) => {
    setIsUpdatingTodayTripId(tripId);

    try {
      await setTodayTripId(todayTripId === tripId ? null : tripId);
    } finally {
      setIsUpdatingTodayTripId((current) => (current === tripId ? null : current));
    }
  };

  const handleOpenTrip = async (tripId: string) => {
    if (tripId === loadedTrip?.id) {
      navigateToScreen({ screen: "trip-overview", tripId });
      return;
    }

    if (!confirmDiscardDraftChanges("opening another trip")) {
      return;
    }

    setIsManagingTrips(true);

    try {
      await loadCloudTrip(tripId);
      const nextState = useTripStore.getState();
      if (!nextState.error && nextState.data?.activeTripId === tripId) {
        setPreviewTripId(tripId);
        setSelectedEntity(null);
        navigateToScreen({ screen: "trip-overview", tripId });
      }
    } finally {
      setIsManagingTrips(false);
    }
  };

  const handleCreateTrip = async (
    input: Parameters<typeof createTrip>[0],
  ): Promise<boolean> => {
    if (!confirmDiscardDraftChanges("creating a new trip")) {
      return false;
    }

    const previousLoadedTripId = loadedTrip?.id ?? null;
    setIsManagingTrips(true);

    try {
      await createTrip(input);
      const nextState = useTripStore.getState();
      const nextLoadedTripId = nextState.data?.activeTripId ?? null;
      const didCreate = !nextState.error && nextLoadedTripId !== previousLoadedTripId;

      if (didCreate) {
        setPreviewTripId(nextLoadedTripId);
        if (input.source === "blank") {
          if (nextLoadedTripId) {
            navigateToScreen({ screen: "trip-itinerary", tripId: nextLoadedTripId });
          }
          setEditor(defaultEditorState);
          const nextTrip =
            nextState.data?.trips.find((trip) => trip.id === nextLoadedTripId) ?? null;
          setPlannerInteractionMode("edit");
          if (nextTrip && useTripStore.getState().plannerInteractionMode === "edit") {
            setDraftTrip(cloneTrip(nextTrip));
          }
        } else {
          if (nextLoadedTripId) {
            navigateToScreen({ screen: "trip-overview", tripId: nextLoadedTripId });
          }
        }
      }

      return didCreate;
    } finally {
      setIsManagingTrips(false);
    }
  };

  const handleRenameTrip = async (name: string): Promise<boolean> => {
    if (!tripToRename) {
      return false;
    }

    setIsManagingTrips(true);

    try {
      await renameTrip(tripToRename.id, { name });
      const nextState = useTripStore.getState();
      const renamedTrip = nextState.tripSummaries.find((trip) => trip.id === tripToRename.id);
      return !nextState.error && renamedTrip?.name === name.trim();
    } finally {
      setIsManagingTrips(false);
    }
  };

  const handleDeleteTrip = async (trip: TripSummary) => {
    if (trip.id === loadedTrip?.id && !confirmDiscardDraftChanges(`deleting "${trip.name}"`)) {
      return;
    }

    const confirmed = window.confirm(
      trip.id === loadedTrip?.id
        ? `Delete "${trip.name}"? This will return you to Dashboard with no trip loaded.`
        : `Delete "${trip.name}"? This cannot be undone.`,
    );
    if (!confirmed) {
      return;
    }

    setIsManagingTrips(true);

    try {
      const isDeletingLoadedTrip = trip.id === loadedTrip?.id;
      await deleteTrip(trip.id);
      const nextState = useTripStore.getState();

      if (!nextState.error && isDeletingLoadedTrip) {
        setPreviewTripId((current) => (current === trip.id ? null : current));
        setScreenStack(createPlannerScreenStack());
      }
    } finally {
      setIsManagingTrips(false);
    }
  };

  const handleImportLegacyTrips = async () => {
    if (!confirmDiscardDraftChanges("importing local trips")) {
      return;
    }

    setIsManagingTrips(true);

    try {
      await importLegacyTrips();
      const nextState = useTripStore.getState();
      if (!nextState.error) {
        setPreviewTripId(nextState.data?.activeTripId ?? null);
        if (nextState.data?.activeTripId) {
          navigateToScreen({
            screen: "trip-overview",
            tripId: nextState.data.activeTripId,
          });
        }
      }
    } finally {
      setIsManagingTrips(false);
    }
  };

  const handleSaveItinerary = async () => {
    if (!draftTrip || !hasDraftChanges || isSavingDraft) {
      return;
    }

    setIsSavingDraft(true);
    setSaveFeedback({ tone: "info", text: "Saving itinerary..." });

    try {
      await updateTrip(draftTrip);
      const nextState = useTripStore.getState();

      if (nextState.syncStatus === "saved" && !nextState.error) {
        setDraftTrip(null);
        setPlannerInteractionMode("view");
        setEditor(defaultEditorState);
        setSaveFeedback({ tone: "success", text: "Itinerary saved" });
        return;
      }

      setSaveFeedback({
        tone: "warning",
        text: nextState.error ?? "Unable to save the itinerary right now.",
      });
    } finally {
      setIsSavingDraft(false);
    }
  };

  const renderSharedNotices = () => (
    <>
      {error ? (
        <div className="tone-warning rounded-[24px] border px-4 py-3 text-sm">
          {error}
        </div>
      ) : null}
      {inlineNotice ? (
        <div
          data-testid="planner-inline-notice"
          className={`rounded-[24px] border px-4 py-3 text-sm ${plannerNoticeToneClass[inlineNotice.tone]}`}
        >
          {inlineNotice.text}
        </div>
      ) : null}
    </>
  );

  const renderTripCommandBarContent = () => {
    if (!loadedTrip || !isTripScreen) {
      return null;
    }

    const summaryTrip = displayTrip ?? loadedTrip;
    const summaryPillClass =
      "inline-flex max-w-full items-center gap-2 rounded-lg border border-app-border/80 bg-app-surface/92 px-2.5 py-1 text-xs";
    const warningSummaryClass =
      loadedValidationWarnings.length > 0
        ? "border-brand-secondary/35 bg-brand-secondary/16 text-brand-secondary-variant"
        : "border-state-success-border bg-state-success-surface text-state-success";

    return (
      <div data-testid="trip-command-bar" className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2 text-xs text-app-muted">
          <button
            type="button"
            onClick={() => setScreenStack(createPlannerScreenStack())}
            className="planner-link-button planner-eyebrow inline-flex items-center gap-1 transition"
          >
            <span aria-hidden="true">&lt;</span>
            Dashboard
          </button>
          <span aria-hidden="true" className="text-app-border">
            &gt;
          </span>
          <span className="truncate font-medium text-app-text">{summaryTrip.name}</span>
        </div>

        <div className="mt-1 flex flex-wrap items-center gap-3">
          <h1 className="planner-title-md text-app-text">{summaryTrip.name}</h1>
          <div className="flex max-w-full flex-wrap gap-1.5">
            {(
              [
                { screen: "trip-overview", label: "Overview" },
                { screen: "trip-itinerary", label: "Itinerary" },
              ] as const
            ).map((item) => {
              const active = currentScreenEntry.screen === item.screen;

              return (
                <button
                  key={item.screen}
                  type="button"
                  aria-current={active ? "page" : undefined}
                  data-testid={
                    item.screen === "trip-overview"
                      ? "desktop-panel-overview"
                      : "desktop-panel-itinerary"
                  }
                  onClick={() => switchTripScreen(item.screen)}
                  className={`planner-button-tab rounded-lg border px-2.5 py-1 text-xs font-semibold transition ${
                    active ? "planner-button-tab-active" : ""
                  }`}
                >
                  {item.label}
                </button>
              );
            })}
          </div>
        </div>

        <div
          data-testid="trip-command-bar-summary"
          className="mt-1.5 flex flex-wrap gap-1.5"
        >
          <span className={`${summaryPillClass} min-w-0`}>
            <span className="truncate font-medium text-app-text">
              {formatTripDateRange(summaryTrip)}
            </span>
          </span>
          <span className={summaryPillClass}>
            <span className="font-medium text-app-text">
              {tripDays.length} {tripDays.length === 1 ? "day" : "days"}
            </span>
          </span>
          <span
            className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs ${warningSummaryClass}`}
          >
            <span className="font-medium">{loadedValidationWarnings.length} warnings</span>
          </span>
          <span className={summaryPillClass}>
            <span className="font-medium text-app-text">
              {getRouteStatusLabel(loadedRoutePanel)}
            </span>
          </span>
          {currentScreenEntry.screen === "trip-itinerary" ? (
            <span
              className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs ${
                plannerInteractionMode === "edit"
                  ? "border-brand-primary/25 bg-brand-primary/10 text-brand-primary"
                  : "border-app-border/80 bg-app-surface/92 text-app-muted"
              }`}
            >
              <span className="font-medium">
                {plannerInteractionMode === "edit" ? "Editing" : "Review"}
              </span>
            </span>
          ) : null}
        </div>
      </div>
    );
  };

  const renderTripDaysPanel = () => {
    if (currentScreenEntry.screen !== "trip-itinerary" || !loadedTrip) {
      return null;
    }

    return (
      <section className="rounded-lg border border-app-border/80 bg-app-surface px-3 py-3 shadow-[0_8px_20px_rgb(var(--color-app-overlay)_/_0.05)] sm:px-4">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <h2 className="planner-title-sm text-app-text">Trip days</h2>
            <p className="planner-meta mt-0.5 text-app-muted">
              {activeItineraryDays.length} active / {tripDays.length} total
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              data-testid="planner-mode-toggle"
              onClick={() => {
                if (plannerInteractionMode === "view") {
                  enterEditMode();
                }
              }}
              disabled={isOfflineReadOnly || plannerInteractionMode === "edit"}
              className={`rounded-lg border px-3 py-1.5 text-sm font-semibold transition ${
                isOfflineReadOnly
                  ? "cursor-not-allowed border-app-border bg-app-surface-muted text-app-muted"
                  : plannerInteractionMode === "edit"
                    ? "cursor-default border-app-border bg-app-surface text-app-text"
                    : "planner-button-primary"
              }`}
            >
              {plannerInteractionMode === "edit" ? "Editing draft" : "Edit itinerary"}
            </button>

            {plannerInteractionMode === "edit" ? (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  data-testid="planner-mode-save"
                  onClick={() => void handleSaveItinerary()}
                  disabled={!hasDraftChanges || isSavingDraft}
                  className="planner-button-primary rounded-lg border px-3 py-1.5 text-sm font-semibold transition disabled:cursor-not-allowed"
                >
                  {isSavingDraft ? "Saving..." : "Save"}
                </button>

                <button
                  type="button"
                  data-testid="planner-mode-cancel"
                  onClick={exitEditMode}
                  disabled={isSavingDraft}
                  className="planner-button-secondary rounded-lg border px-3 py-1.5 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Cancel
                </button>
              </div>
            ) : null}
          </div>
        </div>

        <DayStrip
          days={activeItineraryDays}
          selectedDate={effectiveSelectedDate}
          onSelect={onSelectDate}
        />

        <div className="mt-2 flex flex-wrap gap-2">
          {([
            [
              "stay",
              "+ Stay",
              "border border-brand-support/35 bg-brand-support/18 text-brand-primary",
            ],
            [
              "ferry",
              "+ Ferry",
              "border border-state-info-border bg-state-info-surface text-state-info",
            ],
            [
              "point_of_interest",
              "+ POI",
              "border border-brand-secondary/35 bg-brand-secondary/16 text-brand-secondary-variant",
            ],
          ] as const).map(([type, label, tone]) => (
            <button
              key={type}
              type="button"
              onClick={() => openCreateStopEditor(type)}
              data-testid={`planner-add-${type}`}
              disabled={isOfflineReadOnly}
              className={`rounded-lg border px-2.5 py-1 text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-60 ${tone}`}
            >
              {label}
            </button>
          ))}
        </div>

        {saveFeedback ? (
          <p
            className={`planner-copy-sm mt-2 rounded-lg border px-3 py-2 font-medium ${saveFeedbackToneClass[saveFeedback.tone]}`}
          >
            {saveFeedback.text}
          </p>
        ) : null}

        {isOfflineReadOnly ? (
          <p className="planner-copy-sm tone-warning mt-2 rounded-lg border px-3 py-2 font-medium">
            The cached trip stays available for review while offline, but editing and saving stay
            locked until you reconnect.
          </p>
        ) : null}
      </section>
    );
  };

  const renderOverviewPanel = () => (
    <div
      data-testid="overview-scroll-region"
      className="space-y-4 pr-1 lg:flex lg:h-full lg:min-h-0 lg:flex-col lg:overflow-y-auto"
    >
      <section className="rounded-lg border border-app-border/80 bg-app-surface px-4 py-3.5 shadow-[0_12px_28px_rgb(var(--color-app-overlay)_/_0.06)] sm:px-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="planner-eyebrow planner-section-label">Current route</p>
            <h3 className="planner-title-lg mt-2 text-app-text">
              {getRouteStatusLabel(loadedRoutePanel)}
            </h3>
            <p className="planner-copy-sm mt-1.5 text-app-muted">
              The map stays pinned beside this view while you check warnings and route health.
            </p>
          </div>

          <span
            className={`rounded-lg border px-3 py-1 text-xs font-semibold ${getRouteStatusToneClass(
              loadedRoutePanel.status,
            )}`}
          >
            {getRouteStatusLabel(loadedRoutePanel)}
          </span>
        </div>

        {loadedRoutePanel.statusMessage && loadedRoutePanel.status !== "fresh" ? (
          <p
            className={`planner-copy-sm mt-3 rounded-lg border px-3 py-2 ${getRouteStatusToneClass(
              loadedRoutePanel.status,
            )}`}
          >
            {loadedRoutePanel.statusMessage}
          </p>
        ) : null}
      </section>

      <ValidationWarningsPanel
        key={`overview-warnings-${displayTrip?.id ?? "none"}`}
        testId="overview-warnings-panel"
        warnings={loadedValidationWarnings}
        title="Warnings"
        description="High and medium issues stay upfront so you can judge trip health quickly."
        defaultExpandedSeverities={defaultExpandedWarningSeverities}
        collapseLowSeverity
        showSeverityCounts
        compactHealthyState
        density="compact"
      />

      <TravelInsightsPanel
        key={`overview-route-${displayTrip?.id ?? "none"}`}
        testId="overview-route-insights-panel"
        estimates={loadedRoutePanel.estimates}
        legCount={loadedRouteRequests.length}
        status={loadedRoutePanel.status}
        statusMessage={loadedRoutePanel.statusMessage}
        isRefreshing={loadedRoutePanel.isRefreshing}
        description="A quick read on whether the current route is live for this itinerary."
        showDetailsByDefault={false}
        collapsibleDetails
        density="compact"
      />
    </div>
  );

  const renderDashboardPanel = () => (
    <div data-testid="desktop-panel-trips-region" className="lg:flex lg:h-full lg:min-h-0 lg:flex-col">
      <div className="space-y-4 pr-1 lg:flex lg:h-full lg:min-h-0 lg:flex-col lg:overflow-hidden">
        <div className="grid gap-4 lg:min-h-0 lg:flex-1 lg:items-stretch xl:grid-cols-[minmax(0,1.02fr)_minmax(320px,0.98fr)]">
          {isCloudTripLibraryAvailable ? (
            <TripsPanel
              trips={tripSummaries}
              loadedTripId={loadedTrip?.id ?? null}
              previewTripId={previewTripId}
              todayTripId={todayTripId}
              hasLegacyImport={hasLegacyImport}
              isOfflineReadOnly={isOfflineReadOnly}
              isWorking={isTripLibraryBusy}
              isPreviewingTripId={isPreviewingTripId}
              onCreateTrip={() => setIsTripCreateOpen(true)}
              onImportLegacyTrips={handleImportLegacyTrips}
              onPreviewTrip={handlePreviewTrip}
            />
          ) : (
            <section className="rounded-lg border border-app-border/80 bg-app-surface px-4 py-4 sm:px-5 sm:py-5">
              <p className="planner-eyebrow planner-section-label">Dashboard</p>
              <h2 className="planner-title-lg mt-2 text-app-text">
                Cloud trip library is hidden in demo mode
              </h2>
              <p className="planner-copy mt-3 text-app-muted">
                Sign in and create a cloud-backed trip to manage multiple trips here. Until then,
                Dashboard stays available without the cloud trip library controls.
              </p>
            </section>
          )}

          <DashboardTripDetailsPanel
            trip={dashboardTrip}
            todayTripId={todayTripId}
            canManageTrips={isCloudTripLibraryAvailable && !!dashboardTripSummary}
            canDeleteTrip={tripSummaries.length > 1}
            isWorking={isTripLibraryBusy}
            isOfflineReadOnly={isOfflineReadOnly}
            isPreviewing={dashboardTrip ? isPreviewingTripId === dashboardTrip.id : false}
            isUpdatingTodayTrip={
              dashboardTrip ? isUpdatingTodayTripId === dashboardTrip.id : false
            }
            routeEstimates={dashboardRoutePanel.estimates}
            routeLegCount={dashboardRouteRequests.length}
            routeStatus={dashboardRoutePanel.status}
            routeStatusMessage={dashboardRoutePanel.statusMessage}
            isRefreshingRouteInsights={dashboardRoutePanel.isRefreshing}
            warnings={dashboardValidationWarnings}
            mapPreview={
              <TripMapPreviewPanel
                trip={dashboardTrip}
                markers={dashboardMapData.markers}
                segments={dashboardMapData.segments}
                routeSummary={dashboardRouteMapSummary}
                selectedEntity={effectiveDashboardSelectedEntity}
                selectionOrigin={dashboardSelectionOrigin}
                selectedDetails={dashboardSelectedEntityDetails}
                onSelectEntity={onSelectEntityFromDashboardMap}
                onOpenMobileMap={() => openMobileMapOverlay("dashboard")}
                title="Map"
                description="Preview the route before opening the trip."
                density="compact"
                selectionSummaryPlacement="map-overlay"
                emptyMessage="Select a trip from the library to preview its map."
                mobileCtaLabel="View map"
                mobileCtaDescription="Open the previewed route in a dedicated full-screen map view."
                panelTestId="dashboard-trip-map-panel"
                mobileButtonTestId="dashboard-mobile-map-button"
                selectionSummaryTestId="dashboard-map-selection-summary"
              />
            }
            onRefreshRouteInsights={
              dashboardTrip
                ? isCloudTripLibraryAvailable
                  ? () => void syncPreviewRoutePanel(true)
                  : () => void syncLoadedRoutePanel(true)
                : undefined
            }
            onOpenTrip={dashboardTrip ? () => void handleOpenTrip(dashboardTrip.id) : undefined}
            onToggleTodayTrip={
              dashboardTrip ? () => void handleToggleTodayTrip(dashboardTrip.id) : undefined
            }
            onRenameTrip={dashboardTripSummary ? () => setTripToRename(dashboardTripSummary) : undefined}
            onDeleteTrip={
              dashboardTripSummary ? () => void handleDeleteTrip(dashboardTripSummary) : undefined
            }
          />
        </div>
      </div>
    </div>
  );

  const renderItineraryPanel = () => (
    <div
      data-testid="desktop-panel-itinerary-region"
      className="space-y-3 lg:flex lg:h-full lg:min-h-0 lg:flex-1 lg:flex-col"
    >
      {renderTripDaysPanel()}

      <section
        className={`overflow-hidden rounded-lg border bg-app-surface transition-[border-color,box-shadow] duration-200 lg:flex lg:min-h-0 lg:flex-1 lg:flex-col ${
          plannerInteractionMode === "edit" ? "planner-selected" : "border-app-border/80"
        }`}
      >
        <div
          data-testid="desktop-itinerary-scroll-region"
          data-itinerary-scroll-container="true"
          className="min-h-0 px-4 py-4 sm:px-5 sm:py-4 lg:overflow-y-auto"
        >
          <div className="space-y-4">
            <StopTimeline
              days={activeItineraryDays}
              selectedDate={effectiveSelectedDate}
              selectedEntity={effectiveSelectedEntity}
              isVisible
              routeStatus={loadedRoutePanel.status}
              isOfflineReadOnly={isOfflineReadOnly}
              canMutate={canEditTrip}
              onSelectDate={onSelectDate}
              onSelectEntity={onSelectEntityFromItinerary}
              onView={onViewStopDetails}
              onEdit={openEditStopEditor}
              onDelete={(stop) => {
                const confirmed = window.confirm(`Delete "${stop.title}"?`);
                if (confirmed) {
                  void onDeleteStop(stop.id);
                }
              }}
              onReorder={onReorderStops}
              onMove={onMoveStop}
            />
          </div>
        </div>
      </section>
    </div>
  );

  const renderTripMapPanel = () => {
    const latestRefresh = getLatestRouteRefreshLabel(loadedRoutePanel.estimates);

    return (
      <aside
        data-testid="trip-persistent-map-panel"
        className="hidden min-h-0 lg:flex lg:flex-col"
      >
        <section className="sticky top-0 flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-app-border/80 bg-app-surface p-4 shadow-[0_12px_28px_rgb(var(--color-app-overlay)_/_0.06)]">
          <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="planner-eyebrow planner-section-label">Map</p>
              <p className="planner-copy-sm mt-1 text-app-muted">
                Overview and itinerary share this route view.
              </p>
            </div>

            <div className="flex flex-wrap items-center justify-end gap-2">
              <span
                className={`rounded-lg border px-3 py-1.5 text-xs font-semibold ${getRouteStatusToneClass(
                  loadedRoutePanel.status,
                )}`}
              >
                {getRouteStatusLabel(loadedRoutePanel)}
              </span>
              <button
                type="button"
                onClick={() => setIsMapCockpitOpen(true)}
                className="planner-button-secondary rounded-lg border px-3 py-1.5 text-xs font-semibold transition"
              >
                Open map
              </button>
              <button
                type="button"
                onClick={() => void syncLoadedRoutePanel(true)}
                disabled={loadedRoutePanel.isRefreshing || loadedRouteRequests.length === 0}
                className="planner-button-primary rounded-lg border px-3 py-1.5 text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loadedRoutePanel.isRefreshing ? "Refreshing route..." : "Refresh route"}
              </button>
            </div>
          </div>

          {loadedRoutePanel.statusMessage && loadedRoutePanel.status !== "fresh" ? (
            <p
              className={`planner-copy-sm mb-3 rounded-lg border px-3 py-2 ${getRouteStatusToneClass(
                loadedRoutePanel.status,
              )}`}
            >
              {loadedRoutePanel.statusMessage}
            </p>
          ) : null}

          <div className="mb-3 grid gap-2 sm:grid-cols-3">
            <div className="rounded-lg border border-app-border bg-app-surface-muted/55 px-3 py-2.5">
              <p className="planner-eyebrow text-app-muted">Road legs</p>
              <p className="planner-title-sm mt-1 text-app-text">{loadedRouteRequests.length}</p>
            </div>
            <div className="rounded-lg border border-app-border bg-app-surface-muted/55 px-3 py-2.5">
              <p className="planner-eyebrow text-app-muted">Distance</p>
              <p className="planner-title-sm mt-1 text-app-text">
                {loadedRoutePanel.estimates
                  .reduce((sum, estimate) => sum + estimate.distanceKm, 0)
                  .toFixed(1)}{" "}
                km
              </p>
            </div>
            <div className="rounded-lg border border-app-border bg-app-surface-muted/55 px-3 py-2.5">
              <p className="planner-eyebrow text-app-muted">Last refresh</p>
              <p className="planner-title-sm mt-1 text-app-text">{latestRefresh ?? "Not yet"}</p>
            </div>
          </div>

          <div className="min-h-[520px] flex-1 overflow-hidden rounded-lg border border-app-border bg-app-surface">
            {renderPlannerMap()}
          </div>
        </section>
      </aside>
    );
  };

  const renderTripWorkspacePanel = () => (
    <div
      data-testid="trip-shared-workspace"
      className="space-y-4 lg:grid lg:h-full lg:min-h-0 lg:grid-cols-[minmax(0,1fr)_minmax(420px,0.95fr)] lg:gap-4 lg:space-y-0"
    >
      <section className="rounded-lg border border-app-border bg-app-surface px-4 py-4 lg:hidden">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="planner-eyebrow planner-section-label">Map</p>
            <p className="planner-copy-sm mt-1 text-app-muted">
              Open the shared route map for this trip.
            </p>
          </div>
          <button
            type="button"
            data-testid={`${currentScreenEntry.screen === "trip-itinerary" ? "itinerary" : "overview"}-mobile-map-button`}
            onClick={() =>
              openMobileMapOverlay(
                currentScreenEntry.screen === "trip-itinerary" ? "itinerary" : "overview",
              )
            }
            className="planner-button-secondary rounded-lg border px-4 py-2 text-sm font-semibold"
          >
            View map
          </button>
        </div>
      </section>
      <div className="min-h-0">
        {currentScreenEntry.screen === "trip-itinerary" ? renderItineraryPanel() : renderOverviewPanel()}
      </div>
      {renderTripMapPanel()}
    </div>
  );

  const renderPlannerMap = () => (
    <PlannerMap
      trip={displayTrip!}
      markers={loadedMapData.markers}
      segments={loadedMapData.segments}
      routeSummary={loadedRouteMapSummary}
      selectedEntity={effectiveSelectedEntity}
      selectionOrigin={selectionOrigin}
      onSelectEntity={onSelectEntityFromMap}
      isVisible
      className="h-full w-full rounded-lg border border-app-border bg-app-surface"
    />
  );

  const renderMapCockpit = () => {
    if (!isMapCockpitOpen || !displayTrip) {
      return null;
    }

    return (
      <PlannerMapCockpit
        trip={displayTrip}
        markers={loadedMapData.markers}
        segments={loadedMapData.segments}
        routeSummary={loadedRouteMapSummary}
        selectedEntity={effectiveSelectedEntity}
        selectionOrigin={selectionOrigin}
        selectedDetails={selectedEntityDetails}
        itineraryDays={activeItineraryDays}
        selectedDate={effectiveSelectedDate}
        routeStatus={loadedRoutePanel.status}
        routeStatusLabel={getRouteStatusLabel(loadedRoutePanel)}
        routeStatusMessage={loadedRoutePanel.statusMessage}
        isRefreshing={loadedRoutePanel.isRefreshing}
        roadLegCount={loadedRouteRequests.length}
        totalDistanceKm={loadedRoutePanel.estimates.reduce(
          (sum, estimate) => sum + estimate.distanceKm,
          0,
        )}
        lastRefreshLabel={getLatestRouteRefreshLabel(loadedRoutePanel.estimates)}
        onSelectDate={onSelectDate}
        onSelectMapEntity={onSelectEntityFromMap}
        onSelectItineraryEntity={onSelectEntityFromItinerary}
        onRefresh={() => void syncLoadedRoutePanel(true)}
        onClose={() => setIsMapCockpitOpen(false)}
      />
    );
  };

  const renderMobileMapOverlay = () => {
    if (!mobileMapOverlay) {
      return null;
    }

    if (mobileMapOverlay === "dashboard") {
      if (!dashboardTrip) {
        return null;
      }

      return (
        <PlannerMobileMapOverlay
          trip={dashboardTrip}
          markers={dashboardMapData.markers}
          segments={dashboardMapData.segments}
          routeSummary={dashboardRouteMapSummary}
          selectedEntity={effectiveDashboardSelectedEntity}
          selectionOrigin={dashboardSelectionOrigin}
          selectedDetails={dashboardSelectedEntityDetails}
          contextLabel="Previewing the current dashboard route."
          onSelectEntity={onSelectEntityFromDashboardMap}
          onClose={() => setMobileMapOverlay(null)}
        />
      );
    }

    if (mobileMapOverlay === "today") {
      if (!todayTrip) {
        return null;
      }

      return (
        <PlannerMobileMapOverlay
          trip={todayTrip}
          markers={todayMapData.markers}
          segments={todayMapData.segments}
          routeSummary={todayRouteMapSummary}
          selectedEntity={effectiveTodaySelectedEntity}
          selectionOrigin={todaySelectionOrigin}
          selectedDetails={todaySelectedEntityDetails}
          contextLabel="Reviewing the Today trip route."
          onSelectEntity={onSelectEntityFromTodayMap}
          onClose={() => setMobileMapOverlay(null)}
        />
      );
    }

    if (!displayTrip) {
      return null;
    }

    return (
      <PlannerMobileMapOverlay
        trip={displayTrip}
        markers={loadedMapData.markers}
        segments={loadedMapData.segments}
        routeSummary={loadedRouteMapSummary}
        selectedEntity={effectiveSelectedEntity}
        selectionOrigin={selectionOrigin}
        selectedDetails={selectedEntityDetails}
        contextLabel={
          mobileMapOverlay === "overview"
            ? "Reviewing the current trip route from Overview."
            : "Reviewing the itinerary-linked map."
        }
        onSelectEntity={onSelectEntityFromMap}
        onClose={() => setMobileMapOverlay(null)}
      />
    );
  };

  const renderMobileShell = () => {
    const mobileTitle =
      mobileScreen === "today"
        ? "Today"
        : mobileScreen === "trip"
          ? "Trip"
          : "Trips";
    const mobileSummary =
      mobileScreen === "today"
        ? todayTripName
          ? `${todayTripName} · ${todayActions.length} action${todayActions.length === 1 ? "" : "s"}`
          : "Choose a Today trip for travel-day support"
        : mobileScreen === "trip"
          ? displayTrip
            ? `${displayTrip.name} · ${activeItineraryDays.length} active day${activeItineraryDays.length === 1 ? "" : "s"}`
            : "Open a trip to review the mobile itinerary"
          : `${tripSummaries.length} trip${tripSummaries.length === 1 ? "" : "s"} available`;

    const accountControl = (
      <AccountStatusControl
        authStatus={authStatus}
        mode={mode}
        userEmail={user?.email ?? null}
        syncStatus={syncStatus}
        isOfflineReadOnly={isOfflineReadOnly}
        notice={accountNotice}
        onSignIn={signInWithMagicLink}
        onSignInAsTestUser={signInAsTestUser}
        onSignOut={signOut}
        onCreateCloudTripFromCurrent={createCloudTripFromCurrent}
        onResetSeed={resetToSeed}
        onResetSeedAlignedToToday={resetToSeedAlignedToToday}
      />
    );
    const todayControl = <TodayStatusControl todayTripName={todayTripName} actions={todayActions} />;

    const content =
      mobileScreen === "today" ? (
        <MobileTodayPanel
          todayTrip={todayTrip}
          todayTripName={todayTripName}
          actions={todayActions}
          itineraryDays={todayItineraryDays}
          syncStatus={syncStatus}
          isOfflineReadOnly={isOfflineReadOnly}
          routeStatus={todayRoutePanel.status}
          routeStatusLabel={getRouteStatusLabel(todayRoutePanel)}
          warnings={todayValidationWarnings}
          onOpenMap={() => openMobileMapOverlay("today")}
          onOpenTrip={
            todayTrip
              ? () => {
                  void handleOpenTrip(todayTrip.id).then(() => setMobileScreen("trip"));
                }
              : undefined
          }
          onGoToTrips={() => setMobileScreen("trips")}
          onViewStop={(stop) => {
            if (displayTrip?.id === todayTrip?.id) {
              onViewStopDetails(stop);
              return;
            }

            if (todayTrip) {
              void handleOpenTrip(todayTrip.id);
            }
          }}
        />
      ) : mobileScreen === "trip" ? (
        <MobileTripPanel
          trip={displayTrip}
          days={activeItineraryDays}
          selectedDate={effectiveSelectedDate}
          selectedEntity={effectiveSelectedEntity}
          routeStatus={loadedRoutePanel.status}
          routeStatusLabel={getRouteStatusLabel(loadedRoutePanel)}
          routeStatusMessage={loadedRoutePanel.statusMessage}
          warnings={loadedValidationWarnings}
          isOfflineReadOnly={isOfflineReadOnly}
          canMutate={canEditTrip}
          isEditing={plannerInteractionMode === "edit"}
          hasDraftChanges={hasDraftChanges}
          isSavingDraft={isSavingDraft}
          saveFeedback={saveFeedback}
          onSelectDate={onSelectDate}
          onSelectEntity={onSelectEntityFromItinerary}
          onViewStop={onViewStopDetails}
          onEditStop={openEditStopEditor}
          onDeleteStop={(stop) => {
            const confirmed = window.confirm(`Delete "${stop.title}"?`);
            if (confirmed) {
              void onDeleteStop(stop.id);
            }
          }}
          onEnterEditMode={enterEditMode}
          onSave={() => void handleSaveItinerary()}
          onCancel={exitEditMode}
          onAddStop={openCreateStopEditor}
          onOpenMap={() => openMobileMapOverlay("itinerary")}
          onGoToTrips={() => setMobileScreen("trips")}
        />
      ) : (
        <MobileTripsPanel
          trips={isCloudTripLibraryAvailable ? tripSummaries : []}
          previewTrip={dashboardTrip}
          loadedTripId={loadedTrip?.id ?? null}
          previewTripId={previewTripId}
          todayTripId={todayTripId}
          hasLegacyImport={hasLegacyImport}
          isOfflineReadOnly={isOfflineReadOnly}
          isWorking={isTripLibraryBusy}
          isPreviewingTripId={isPreviewingTripId}
          isUpdatingTodayTrip={
            dashboardTrip ? isUpdatingTodayTripId === dashboardTrip.id : false
          }
          routeStatusLabel={getRouteStatusLabel(dashboardRoutePanel)}
          warningCount={dashboardValidationWarnings.length}
          warnings={dashboardValidationWarnings}
          canManageTrips={isCloudTripLibraryAvailable && !!dashboardTripSummary}
          canDeleteTrip={tripSummaries.length > 1}
          onCreateTrip={() => setIsTripCreateOpen(true)}
          onImportLegacyTrips={handleImportLegacyTrips}
          onPreviewTrip={handlePreviewTrip}
          onOpenTrip={
            dashboardTrip
              ? () => {
                  void handleOpenTrip(dashboardTrip.id).then(() => setMobileScreen("trip"));
                }
              : undefined
          }
          onToggleTodayTrip={
            dashboardTrip ? () => void handleToggleTodayTrip(dashboardTrip.id) : undefined
          }
          onRenameTrip={dashboardTripSummary ? () => setTripToRename(dashboardTripSummary) : undefined}
          onDeleteTrip={
            dashboardTripSummary ? () => void handleDeleteTrip(dashboardTripSummary) : undefined
          }
        />
      );

    return (
      <MobilePlannerShell
        activeScreen={mobileScreen}
        title={mobileTitle}
        summary={mobileSummary}
        accountControl={accountControl}
        todayControl={todayControl}
        onScreenChange={setMobileScreen}
      >
        <div className="space-y-3">
          {renderSharedNotices()}
          {content}
        </div>
      </MobilePlannerShell>
    );
  };

  const renderCurrentScreen = () => {
    if (
      (currentScreenEntry.screen === "trip-itinerary" ||
        currentScreenEntry.screen === "trip-overview") &&
      loadedTrip
    ) {
      return renderTripWorkspacePanel();
    }

    return renderDashboardPanel();
  };

  if (isLoading && authStatus === "checking") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-app-bg px-4 py-10">
        <p className="planner-copy text-app-muted">Loading trip planner...</p>
      </div>
    );
  }

  if (authStatus === "signed_out" || (authStatus === "disabled" && mode !== "demo")) {
    return (
      <PlannerAuthGate
        authStatus={authStatus}
        error={error}
        notice={authNotice}
        onSignIn={signInWithMagicLink}
        onSignInAsTestUser={signInAsTestUser}
      />
    );
  }

  if (authStatus === "signed_in" && firstTripSetup === "choose_source") {
    return (
      <div className="min-h-screen bg-app-bg px-4 py-10">
        <div className="mx-auto max-w-3xl space-y-4">
          {renderSharedNotices()}
          <FirstTripSetupPanel
            isWorking={isLoading || syncStatus === "saving"}
            onImportLocalTrip={importLegacyTrips}
            onStartWithExampleTrip={startWithExampleTrip}
            onSignOut={signOut}
          />
        </div>
      </div>
    );
  }

  if (isLoading && authStatus === "signed_in" && !loadedTrip && tripSummaries.length === 0) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-app-bg px-4 py-10">
        <p className="planner-copy text-app-muted">Preparing your trip workspace...</p>
      </div>
    );
  }

  return (
    <>
      <div className="min-h-screen bg-app-bg p-3 sm:p-4 lg:h-[100dvh] lg:overflow-hidden lg:p-5">
        <div className="mx-auto h-full w-full max-w-[1660px] overflow-hidden rounded-[30px] border border-app-border/80 bg-app-surface/85 shadow-[0_28px_80px_rgb(var(--color-app-overlay)_/_0.08)] backdrop-blur-sm">
          <div className="flex h-full flex-col lg:grid lg:grid-cols-[240px_minmax(0,1fr)] lg:grid-rows-[auto_minmax(0,1fr)]">
            <div className="hidden lg:flex lg:items-center lg:border-r lg:border-b lg:border-app-border lg:bg-app-surface-muted/65 lg:px-4 lg:py-4">
              <PlannerBrandBadge variant="rail" />
            </div>

            <header
              className={`hidden lg:flex lg:items-center lg:justify-between lg:gap-6 lg:border-b lg:border-app-border lg:px-6 ${
                isTripScreen ? "lg:py-2.5" : "lg:py-4"
              }`}
            >
              <div className="min-w-0 flex flex-1 flex-wrap items-center gap-3">
                {isTripScreen ? (
                  renderTripCommandBarContent()
                ) : (
                  <>
                    <h1 className="planner-title-xl text-app-text">{shellTitle}</h1>
                    <span className="planner-pill rounded-lg border px-3 py-1 text-xs font-semibold">
                      {shellSummary}
                    </span>
                  </>
                )}
              </div>

              <div className="flex shrink-0 items-center gap-3">
                <div className="rounded-lg border border-app-border bg-app-surface px-3 py-2">
                  <p className="planner-eyebrow text-app-muted">Today trip</p>
                  <p className="planner-title-sm mt-1 text-app-text">
                    {todayTripName ?? "No Today trip"}
                  </p>
                </div>
                <TodayStatusControl todayTripName={todayTripName} actions={todayActions} />
              </div>
            </header>

            <aside
              data-testid="planner-rail-column"
              className="hidden lg:flex lg:min-h-0 lg:flex-col lg:border-r lg:border-app-border lg:bg-app-surface-muted/65"
            >
              <nav className="flex-1 overflow-y-auto px-3 py-4">
                <div className="space-y-1">
                  <button
                    type="button"
                    data-testid="desktop-panel-dashboard"
                    onClick={() => setScreenStack(createPlannerScreenStack())}
                    className="flex w-full items-center gap-3 rounded-[18px] border border-app-border bg-app-surface px-3.5 py-3 text-left text-sm font-medium text-brand-primary shadow-[0_1px_2px_rgb(var(--color-app-overlay)_/_0.04)] transition"
                    title="Dashboard"
                  >
                    <span className="shrink-0">{dashboardIcon()}</span>
                    <span className="min-w-0 flex-1 truncate">Dashboard</span>
                  </button>
                </div>
              </nav>

              <div className="border-t border-app-border px-3 py-4">
                <AccountStatusControl
                  authStatus={authStatus}
                  mode={mode}
                  userEmail={user?.email ?? null}
                  syncStatus={syncStatus}
                  isOfflineReadOnly={isOfflineReadOnly}
                  notice={accountNotice}
                  variant="rail"
                  onSignIn={signInWithMagicLink}
                  onSignInAsTestUser={signInAsTestUser}
                  onSignOut={signOut}
                  onCreateCloudTripFromCurrent={createCloudTripFromCurrent}
                  onResetSeed={resetToSeed}
                  onResetSeedAlignedToToday={resetToSeedAlignedToToday}
                />
              </div>
            </aside>

            {renderMobileShell()}

            <div className="hidden lg:flex lg:min-h-0 lg:flex-col lg:p-6">
              <div className="space-y-4">
                {renderSharedNotices()}
              </div>

              <div
                data-testid="desktop-panel-region"
                className="min-h-0 flex-1 lg:flex lg:flex-col"
              >
                {renderCurrentScreen()}
              </div>
            </div>
          </div>
        </div>
      </div>

      {renderMapCockpit()}
      {renderMobileMapOverlay()}

      <StopDetailsDrawer
        isOpen={isStopDetailsOpen}
        selectedDetails={selectedEntityDetails}
        routeStatus={loadedRoutePanel.status}
        routeStatusMessage={loadedRoutePanel.statusMessage}
        onClose={() => setIsStopDetailsOpen(false)}
        onEdit={(stop) => {
          setIsStopDetailsOpen(false);
          openEditStopEditor(stop);
        }}
        isOfflineReadOnly={isOfflineReadOnly}
      />

      <StopEditorModal
        isOpen={editor.isOpen}
        mode={editor.mode}
        stopType={editor.type}
        initialStop={editor.initialStop}
        existingStops={displayTrip?.stops ?? []}
        onClose={() => setEditor(defaultEditorState)}
        onCreate={onCreateStop}
        onUpdate={onUpdateStop}
      />

      {isTripCreateOpen ? (
        <TripCreateModal
          isOpen
          isWorking={isTripLibraryBusy}
          defaultExampleName={getExampleTripDefaultName()}
          onClose={() => setIsTripCreateOpen(false)}
          onCreate={handleCreateTrip}
        />
      ) : null}

      {tripToRename ? (
        <TripRenameModal
          key={tripToRename.id}
          isOpen
          isWorking={isTripLibraryBusy}
          currentName={tripToRename.name}
          onClose={() => setTripToRename(null)}
          onRename={handleRenameTrip}
        />
      ) : null}
    </>
  );
}
