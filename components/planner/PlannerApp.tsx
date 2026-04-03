"use client";

import { startTransition, useEffect, useMemo, useRef, useState } from "react";

import AccountStatusControl from "@/components/planner/AccountStatusControl";
import DashboardTripDetailsPanel from "@/components/planner/DashboardTripDetailsPanel";
import DayStrip from "@/components/planner/DayStrip";
import FirstTripSetupPanel from "@/components/planner/FirstTripSetupPanel";
import ItineraryInspector from "@/components/planner/ItineraryInspector";
import PlannerAuthGate from "@/components/planner/PlannerAuthGate";
import PlannerBrandBadge from "@/components/planner/PlannerBrandBadge";
import PlannerMap from "@/components/planner/PlannerMap";
import { plannerNoticeToneClass } from "@/components/planner/plannerTheme";
import StopEditorModal from "@/components/planner/StopEditorModal";
import StopTimeline from "@/components/planner/StopTimeline";
import TodayStatusControl from "@/components/planner/TodayStatusControl";
import TravelInsightsPanel, {
  getRouteConfidenceSnapshot,
} from "@/components/planner/TravelInsightsPanel";
import TripHeader from "@/components/planner/TripHeader";
import TripCreateModal from "@/components/planner/TripCreateModal";
import TripRenameModal from "@/components/planner/TripRenameModal";
import TripsPanel from "@/components/planner/TripsPanel";
import ValidationWarningsPanel from "@/components/planner/ValidationWarningsPanel";
import {
  formatDateOnly,
  formatDayChip,
  formatDurationMinutes,
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
import { readCachedRouteEstimateSet, writeCachedRouteEstimateSet } from "@/lib/routeEstimateCache";
import {
  buildTripTravelLegPayload,
  fetchTravelLegEstimates,
  mergeTravelEstimateMetadata,
} from "@/lib/routeEstimates";
import { getExampleTripDefaultName } from "@/lib/tripFactories";
import {
  formatTripDateRange,
  getCostSummary,
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
import { useTripStore } from "@/store/useTripStore";
import {
  NewTripStop,
  PlannerNoticeTone,
  SelectedEntity,
  StopType,
  TravelLegEstimate,
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
type RouteInsightsState = "fresh" | "stale" | "unavailable";
type RoutePanelState = {
  estimates: TravelLegEstimate[];
  isRefreshing: boolean;
  status: RouteInsightsState;
  statusMessage: string | null;
};
type MapRouteSummary = {
  totalRoadLegs: number;
  pendingRoadLegs: number;
  liveRoadLegs: number;
  fallbackRoadLegs: number;
  isRefreshing: boolean;
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

const cloneTrip = (trip: Trip): Trip => structuredClone(trip);

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
  const [activeTripId, setActiveTripId] = useState<string | null>(null);
  const [isPreviewingTripId, setIsPreviewingTripId] = useState<string | null>(null);
  const [isActivatingTripId, setIsActivatingTripId] = useState<string | null>(null);
  const [draftTrip, setDraftTrip] = useState<Trip | null>(null);
  const [isSavingDraft, setIsSavingDraft] = useState(false);
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
  const activeTrip = activeTripId ? tripCache[activeTripId] ?? null : null;
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

    if (activeTripId && !tripSummaries.some((trip) => trip.id === activeTripId)) {
      setActiveTripId(null);
    }
  }, [activeTripId, previewTripId, tripSummaries]);

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
    const cached = await readCachedRouteEstimateSet(currentSignature);
    if (loadedRouteRefreshCounterRef.current !== refreshId) {
      return;
    }

    const cachedEstimates = cached.entry
      ? mergeTravelEstimateMetadata(cached.entry.estimates, currentRequests)
      : [];

    setLoadedRoutePanel((current) => ({
      ...current,
      estimates: cachedEstimates,
      status: cached.entry ? (cached.state === "fresh" ? "fresh" : "stale") : "fresh",
      statusMessage:
        cached.state === "stale"
          ? "Showing saved route timings until you refresh them."
          : null,
      isRefreshing: false,
    }));

    if (!fetchFresh) {
      return;
    }

    setLoadedRoutePanel((current) => ({
      ...current,
      estimates: cachedEstimates,
      isRefreshing: true,
      status: cached.entry ? (cached.state === "fresh" ? "fresh" : "stale") : current.status,
      statusMessage:
        cached.state === "stale"
          ? "Showing saved route timings while a refresh runs."
          : current.statusMessage,
    }));

    try {
      const estimates = await fetchTravelLegEstimates(currentRequests);
      if (loadedRouteRefreshCounterRef.current !== refreshId) {
        return;
      }

      const mergedEstimates = mergeTravelEstimateMetadata(estimates, currentRequests);
      await writeCachedRouteEstimateSet(currentSignature, mergedEstimates);
      setLoadedRoutePanel({
        estimates: mergedEstimates,
        isRefreshing: false,
        status: "fresh",
        statusMessage: null,
      });
    } catch (caught) {
      if (loadedRouteRefreshCounterRef.current !== refreshId) {
        return;
      }

      setLoadedRoutePanel({
        estimates: cachedEstimates,
        isRefreshing: false,
        status: cached.entry ? "stale" : "unavailable",
        statusMessage:
          cached.entry
            ? caught instanceof Error
              ? `${caught.message} Showing the last successful route timings instead.`
              : "Unable to refresh route estimates. Showing the last successful timings instead."
            : caught instanceof Error
              ? caught.message
              : "Unable to refresh route estimates.",
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
    const cached = await readCachedRouteEstimateSet(currentSignature);
    if (previewRouteRefreshCounterRef.current !== refreshId) {
      return;
    }

    const cachedEstimates = cached.entry
      ? mergeTravelEstimateMetadata(cached.entry.estimates, currentRequests)
      : [];

    setPreviewRoutePanel((current) => ({
      ...current,
      estimates: cachedEstimates,
      status: cached.entry ? (cached.state === "fresh" ? "fresh" : "stale") : "fresh",
      statusMessage:
        cached.state === "stale"
          ? "Showing saved route timings until you refresh them."
          : null,
      isRefreshing: false,
    }));

    if (!fetchFresh) {
      return;
    }

    setPreviewRoutePanel((current) => ({
      ...current,
      estimates: cachedEstimates,
      isRefreshing: true,
      status: cached.entry ? (cached.state === "fresh" ? "fresh" : "stale") : current.status,
      statusMessage:
        cached.state === "stale"
          ? "Showing saved route timings while a refresh runs."
          : current.statusMessage,
    }));

    try {
      const estimates = await fetchTravelLegEstimates(currentRequests);
      if (previewRouteRefreshCounterRef.current !== refreshId) {
        return;
      }

      const mergedEstimates = mergeTravelEstimateMetadata(estimates, currentRequests);
      await writeCachedRouteEstimateSet(currentSignature, mergedEstimates);
      setPreviewRoutePanel({
        estimates: mergedEstimates,
        isRefreshing: false,
        status: "fresh",
        statusMessage: null,
      });
    } catch (caught) {
      if (previewRouteRefreshCounterRef.current !== refreshId) {
        return;
      }

      setPreviewRoutePanel({
        estimates: cachedEstimates,
        isRefreshing: false,
        status: cached.entry ? "stale" : "unavailable",
        statusMessage:
          cached.entry
            ? caught instanceof Error
              ? `${caught.message} Showing the last successful route timings instead.`
              : "Unable to refresh route estimates. Showing the last successful timings instead."
            : caught instanceof Error
              ? caught.message
              : "Unable to refresh route estimates.",
      });
    }
  };

  useEffect(() => {
    void syncLoadedRoutePanel(false);
  }, [loadedRouteSignature]);

  useEffect(() => {
    void syncPreviewRoutePanel(false);
  }, [previewRouteSignature]);

  useEffect(() => {
    if (!loadedTrip) {
      return;
    }

    void syncLoadedRoutePanel(true);
  }, [loadedTrip]);

  const tripDays = useMemo(() => (displayTrip ? getTripDays(displayTrip) : []), [displayTrip]);
  const effectiveSelectedDate = tripDays.includes(selectedDate)
    ? selectedDate
    : tripDays[0] ?? selectedDate;

  const itineraryDays = useMemo(
    () => (displayTrip ? getItineraryDays(displayTrip, loadedRoutePanel.estimates) : []),
    [displayTrip, loadedRoutePanel.estimates],
  );

  const mapData = useMemo(
    () =>
      displayTrip
        ? getMapData(displayTrip, loadedRoutePanel.estimates)
        : { markers: [], segments: [] },
    [displayTrip, loadedRoutePanel.estimates],
  );

  const todayActions = useMemo(() => (activeTrip ? getTodayActions(activeTrip) : []), [activeTrip]);
  const costSummary = useMemo(
    () => (displayTrip ? getCostSummary(displayTrip) : { totalNights: 0, totalCost: 0 }),
    [displayTrip],
  );
  const loadedValidationWarnings = useMemo(
    () => (displayTrip ? getValidationWarnings(displayTrip, loadedRoutePanel.estimates) : []),
    [displayTrip, loadedRoutePanel.estimates],
  );
  const previewValidationWarnings = useMemo(
    () => (previewTrip ? getValidationWarnings(previewTrip, previewRoutePanel.estimates) : []),
    [previewRoutePanel.estimates, previewTrip],
  );
  const loadedRouteConfidence = useMemo(
    () => getRouteConfidenceSnapshot(loadedRoutePanel.estimates, loadedRouteRequests.length),
    [loadedRoutePanel.estimates, loadedRouteRequests.length],
  );
  const dashboardTrip = isCloudTripLibraryAvailable ? previewTrip : displayTrip;
  const dashboardRoutePanel = isCloudTripLibraryAvailable ? previewRoutePanel : loadedRoutePanel;
  const dashboardRouteRequests = isCloudTripLibraryAvailable ? previewRouteRequests : loadedRouteRequests;
  const dashboardValidationWarnings = isCloudTripLibraryAvailable
    ? previewValidationWarnings
    : loadedValidationWarnings;
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
  const inlineNotice = notice?.surface === "inline" ? notice : null;
  const accountNotice = notice?.surface === "account" ? notice : null;
  const authNotice = notice?.surface === "auth" ? notice : null;
  const routeMapSummary = useMemo<MapRouteSummary>(() => {
    const roadSegments = mapData.segments.filter((segment) => segment.type === "road");

    return {
      totalRoadLegs: roadSegments.length,
      pendingRoadLegs: roadSegments.filter((segment) => segment.routeStatus === "pending").length,
      liveRoadLegs: roadSegments.filter((segment) => segment.routeStatus === "live").length,
      fallbackRoadLegs: roadSegments.filter((segment) => segment.routeStatus === "fallback").length,
      isRefreshing: loadedRoutePanel.isRefreshing,
    };
  }, [loadedRoutePanel.isRefreshing, mapData.segments]);

  const canEditTrip = plannerInteractionMode === "edit" && !isOfflineReadOnly;
  const currentItineraryDay = useMemo(
    () => itineraryDays.find((day) => day.date === effectiveSelectedDate) ?? itineraryDays[0] ?? null,
    [effectiveSelectedDate, itineraryDays],
  );
  const selectedEntityDetails = useMemo(
    () =>
      displayTrip
        ? getSelectedEntityDetails(displayTrip, effectiveSelectedEntity, loadedRoutePanel.estimates)
        : null,
    [displayTrip, effectiveSelectedEntity, loadedRoutePanel.estimates],
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

  const handleToggleActiveTrip = async (tripId: string) => {
    if (activeTripId === tripId) {
      setActiveTripId(null);
      return;
    }

    setIsActivatingTripId(tripId);

    try {
      const trip = await previewCloudTrip(tripId);
      if (trip) {
        setActiveTripId(trip.id);
      }
    } finally {
      setIsActivatingTripId((current) => (current === tripId ? null : current));
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

  const renderTripWorkspaceHeader = () => {
    if (!loadedTrip || !isTripScreen) {
      return null;
    }

    return (
      <section className="overflow-hidden rounded-[24px] border border-app-border/80 bg-app-surface shadow-[0_18px_42px_rgb(var(--color-app-overlay)_/_0.08)]">
        <div className="border-b border-app-border/80 bg-[linear-gradient(155deg,rgb(var(--color-brand-primary)_/_0.08),rgb(var(--color-app-surface))_50%,rgb(var(--color-brand-secondary)_/_0.08))] px-4 py-4 sm:px-5 sm:py-5">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2 text-sm text-app-muted">
                <button
                  type="button"
                  onClick={() => setScreenStack(createPlannerScreenStack())}
                  className="planner-eyebrow text-app-muted transition hover:text-app-text"
                >
                  Dashboard
                </button>
                <span aria-hidden="true" className="text-app-border">
                  &gt;
                </span>
                <span className="truncate font-medium text-app-text">{loadedTrip.name}</span>
              </div>

              <h2 className="planner-title-xl mt-3 text-app-text">{loadedTrip.name}</h2>

              <div className="mt-3 flex flex-wrap gap-2">
                <span className="planner-pill rounded-full border px-3 py-1 text-xs font-semibold">
                  {formatTripDateRange(loadedTrip)}
                </span>
                <span className="planner-pill rounded-full border px-3 py-1 text-xs font-semibold">
                  {tripDays.length} {tripDays.length === 1 ? "day" : "days"}
                </span>
                <span className="planner-pill rounded-full border px-3 py-1 text-xs font-semibold">
                  {loadedRouteConfidence.summary} routing
                </span>
                {currentScreenEntry.screen === "trip-itinerary" ? (
                  <span
                    className={`rounded-full border px-3 py-1 text-xs font-semibold ${
                      plannerInteractionMode === "edit" ? "planner-pill-active" : "planner-pill"
                    }`}
                  >
                    {plannerInteractionMode === "edit" ? "Editing draft" : "Review mode"}
                  </span>
                ) : null}
              </div>
            </div>

            <div className="flex max-w-full flex-wrap gap-2">
              {(
                [
                  { screen: "trip-overview", label: "Overview" },
                  { screen: "trip-itinerary", label: "Itinerary" },
                ] as const
              ).map((item) => (
                <button
                  key={item.screen}
                  type="button"
                  data-testid={`trip-workspace-tab-${item.screen}`}
                  onClick={() => switchTripScreen(item.screen)}
                  className={`rounded-full border px-4 py-2 text-sm font-semibold transition ${
                    currentScreenEntry.screen === item.screen
                      ? "border-brand-primary/25 bg-brand-primary/10 text-brand-primary shadow-[0_10px_26px_rgb(var(--color-app-overlay)_/_0.08)]"
                      : "border-app-border bg-app-surface text-app-muted hover:bg-app-surface-muted hover:text-app-text"
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>
    );
  };

  const renderOverviewPanel = () => (
    <div
      data-testid="overview-scroll-region"
      className="space-y-5 pr-1 lg:flex lg:h-full lg:min-h-0 lg:flex-col lg:overflow-y-auto"
    >
      {displayTrip ? (
        <TripHeader
          tripName={displayTrip.name}
          homeLabel={displayTrip.home.label}
          dateRangeLabel={formatTripDateRange(displayTrip)}
          totalNights={costSummary.totalNights}
          totalCost={costSummary.totalCost}
          warningCount={loadedValidationWarnings.length}
          routeConfidenceLabel={loadedRouteConfidence.summary}
        />
      ) : null}

      <ValidationWarningsPanel
        key={`overview-warnings-${displayTrip?.id ?? "none"}`}
        warnings={loadedValidationWarnings}
        title="Warnings"
        description="High and medium issues stay upfront so you can judge trip health quickly."
        defaultExpandedSeverities={defaultExpandedWarningSeverities}
        collapseLowSeverity
        showSeverityCounts
        compactHealthyState
      />

      <TravelInsightsPanel
        key={`overview-route-${displayTrip?.id ?? "none"}`}
        estimates={loadedRoutePanel.estimates}
        legCount={loadedRouteRequests.length}
        status={loadedRoutePanel.status}
        statusMessage={loadedRoutePanel.statusMessage}
        isRefreshing={loadedRoutePanel.isRefreshing}
        onRefresh={() => void syncLoadedRoutePanel(true)}
        description="A quick read on whether the current route still looks grounded."
        showDetailsByDefault={false}
        collapsibleDetails
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
              activeTripId={activeTripId}
              hasLegacyImport={hasLegacyImport}
              isOfflineReadOnly={isOfflineReadOnly}
              isWorking={isTripLibraryBusy}
              isPreviewingTripId={isPreviewingTripId}
              onCreateTrip={() => setIsTripCreateOpen(true)}
              onImportLegacyTrips={handleImportLegacyTrips}
              onPreviewTrip={handlePreviewTrip}
            />
          ) : (
            <section className="rounded-[24px] border border-app-border/80 bg-app-surface px-4 py-4 sm:px-5 sm:py-5">
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
            loadedTripId={loadedTrip?.id ?? null}
            activeTripId={activeTripId}
            canManageTrips={isCloudTripLibraryAvailable && !!dashboardTripSummary}
            canDeleteTrip={tripSummaries.length > 1}
            isWorking={isTripLibraryBusy}
            isOfflineReadOnly={isOfflineReadOnly}
            isPreviewing={dashboardTrip ? isPreviewingTripId === dashboardTrip.id : false}
            isActivating={dashboardTrip ? isActivatingTripId === dashboardTrip.id : false}
            routeEstimates={dashboardRoutePanel.estimates}
            routeLegCount={dashboardRouteRequests.length}
            routeStatus={dashboardRoutePanel.status}
            routeStatusMessage={dashboardRoutePanel.statusMessage}
            isRefreshingRouteInsights={dashboardRoutePanel.isRefreshing}
            warnings={dashboardValidationWarnings}
            onRefreshRouteInsights={
              dashboardTrip
                ? isCloudTripLibraryAvailable
                  ? () => void syncPreviewRoutePanel(true)
                  : () => void syncLoadedRoutePanel(true)
                : undefined
            }
            onOpenTrip={dashboardTrip ? () => void handleOpenTrip(dashboardTrip.id) : undefined}
            onToggleActiveTrip={
              dashboardTrip ? () => void handleToggleActiveTrip(dashboardTrip.id) : undefined
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
      className="lg:flex lg:h-full lg:min-h-0 lg:flex-1 lg:flex-col"
    >
      <section
        className={`overflow-hidden rounded-[24px] border bg-app-surface transition-[border-color,box-shadow] duration-200 lg:flex lg:min-h-0 lg:flex-1 lg:flex-col ${
          plannerInteractionMode === "edit"
            ? "planner-selected"
            : "border-app-border/80"
        }`}
      >
        <div className="lg:grid lg:min-h-0 lg:flex-1 lg:grid-cols-[minmax(0,1.12fr)_minmax(320px,0.88fr)]">
          <div
            data-testid="desktop-itinerary-scroll-region"
            data-itinerary-scroll-container="true"
            className="min-h-0 px-4 py-4 sm:px-5 sm:py-5 lg:overflow-y-auto"
          >
            <div className="space-y-5">
              <section className="rounded-[26px] border border-app-border/80 bg-[linear-gradient(160deg,rgb(var(--color-brand-primary)_/_0.08),rgb(var(--color-app-surface))_48%,rgb(var(--color-brand-secondary)_/_0.08))] px-4 py-4 shadow-[0_18px_40px_rgb(var(--color-app-overlay)_/_0.08)] sm:px-5 sm:py-5">
                <div className="flex flex-col gap-4">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <p className="planner-eyebrow planner-section-label">Itinerary workspace</p>
                      <h3 className="planner-title-lg mt-2 text-app-text">
                        {currentItineraryDay
                          ? `${formatDayChip(currentItineraryDay.date)} · ${formatDateOnly(currentItineraryDay.date)}`
                          : "Build your route day by day"}
                      </h3>
                      <p className="planner-copy mt-2 text-app-muted">
                        {currentItineraryDay?.activeStay
                          ? `Base: ${currentItineraryDay.activeStay.title}`
                          : "Select a day to review movements, base coverage, and stop details."}
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
                        className={`rounded-full border px-4 py-2 text-sm font-semibold transition ${
                          isOfflineReadOnly
                            ? "cursor-not-allowed border-app-border bg-app-surface-muted text-app-muted"
                            : plannerInteractionMode === "edit"
                              ? "cursor-default border-app-border bg-app-surface text-app-text"
                              : "planner-button-primary"
                        }`}
                      >
                        {plannerInteractionMode === "edit" ? "Editing draft" : "Edit itinerary"}
                      </button>

                      <div
                        className={`flex items-center gap-2 transition-[max-width,opacity] duration-200 ${
                          plannerInteractionMode === "edit" ? "max-w-[18rem] opacity-100" : "max-w-0 overflow-hidden opacity-0"
                        }`}
                      >
                        <button
                          type="button"
                          data-testid="planner-mode-save"
                          onClick={() => void handleSaveItinerary()}
                          disabled={!hasDraftChanges || isSavingDraft}
                          className="planner-button-primary rounded-full border px-4 py-2 text-sm font-semibold transition disabled:cursor-not-allowed"
                        >
                          {isSavingDraft ? "Saving..." : "Save"}
                        </button>

                        <button
                          type="button"
                          data-testid="planner-mode-cancel"
                          onClick={exitEditMode}
                          disabled={isSavingDraft}
                          className="planner-button-secondary rounded-full border px-4 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  </div>

                  {saveFeedback ? (
                    <p
                      className={`planner-copy-sm rounded-2xl border px-3 py-2 font-medium ${saveFeedbackToneClass[saveFeedback.tone]}`}
                    >
                      {saveFeedback.text}
                    </p>
                  ) : null}

                  {isOfflineReadOnly ? (
                    <p className="planner-copy-sm tone-warning rounded-2xl border px-3 py-2 font-medium">
                      The cached trip stays available for review while offline, but editing and saving
                      stay locked until you reconnect.
                    </p>
                  ) : null}

                  <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(260px,0.72fr)]">
                    <div className="rounded-[22px] border border-app-border bg-app-surface/85 p-3.5">
                      <div className="mb-3 flex items-center justify-between">
                        <h4 className="planner-title-sm text-app-text">Trip days</h4>
                        <span className="planner-meta text-app-muted">
                          {tripDays.length} {tripDays.length === 1 ? "day" : "days"}
                        </span>
                      </div>
                      <DayStrip
                        days={itineraryDays}
                        selectedDate={effectiveSelectedDate}
                        onSelect={onSelectDate}
                      />
                    </div>

                    <div className="rounded-[22px] border border-app-border bg-app-surface/85 p-4">
                      <p className="planner-eyebrow text-app-muted">Day snapshot</p>
                      <div className="mt-3 grid gap-3 sm:grid-cols-3 xl:grid-cols-2">
                        <div>
                          <p className="planner-title-lg text-app-text">
                            {currentItineraryDay?.stopCount ?? 0}
                          </p>
                          <p className="planner-copy-sm mt-1 text-app-muted">Stops in focus</p>
                        </div>
                        <div>
                          <p className="planner-title-lg text-app-text">
                            {formatDurationMinutes(currentItineraryDay?.bufferedDriveMinutes ?? 0)}
                          </p>
                          <p className="planner-copy-sm mt-1 text-app-muted">Buffered drive</p>
                        </div>
                        <div>
                          <p className="planner-title-lg text-app-text">
                            {currentItineraryDay?.roadLegCount ?? 0}
                          </p>
                          <p className="planner-copy-sm mt-1 text-app-muted">Road legs</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
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
                        className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-60 ${tone}`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
              </section>

              <StopTimeline
                days={itineraryDays}
                selectedDate={effectiveSelectedDate}
                selectedEntity={effectiveSelectedEntity}
                isVisible
                isOfflineReadOnly={isOfflineReadOnly}
                canMutate={canEditTrip}
                onSelectDate={onSelectDate}
                onSelectEntity={onSelectEntityFromItinerary}
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

          <aside className="border-t border-app-border bg-app-surface-muted/35 px-4 py-4 sm:px-5 sm:py-5 lg:min-h-0 lg:overflow-y-auto lg:border-l lg:border-t-0">
            <div className="space-y-4 lg:sticky lg:top-0">
              <ItineraryInspector
                selectedDate={effectiveSelectedDate}
                selectedDay={currentItineraryDay}
                selectedDetails={selectedEntityDetails}
                routeConfidence={loadedRouteConfidence}
                routeSummary={routeMapSummary}
                routeStatus={loadedRoutePanel.status}
                routeStatusMessage={loadedRoutePanel.statusMessage}
                onRefreshRoute={() => void syncLoadedRoutePanel(true)}
                onEditSelected={openEditStopEditor}
                isOfflineReadOnly={isOfflineReadOnly}
              />

              <section className="rounded-[24px] border border-app-border/80 bg-app-surface p-3.5 shadow-[0_18px_40px_rgb(var(--color-app-overlay)_/_0.08)] sm:p-4">
                <div className="mb-3 flex items-center justify-between">
                  <div>
                    <p className="planner-eyebrow planner-section-label">Map</p>
                    <p className="planner-copy-sm mt-1 text-app-muted">
                      Timeline selections stay linked to the current route view.
                    </p>
                  </div>
                </div>
                <div className="h-[280px] overflow-hidden rounded-[20px] border border-app-border bg-app-surface lg:h-[340px]">
                  {renderPlannerMap()}
                </div>
              </section>
            </div>
          </aside>
        </div>
      </section>
    </div>
  );

  const renderPlannerMap = () => (
    <PlannerMap
      trip={displayTrip!}
      markers={mapData.markers}
      segments={mapData.segments}
      routeSummary={routeMapSummary}
      selectedEntity={effectiveSelectedEntity}
      selectionOrigin={selectionOrigin}
      onSelectEntity={onSelectEntityFromMap}
      isVisible
      className="h-full w-full rounded-[18px] border border-app-border bg-app-surface"
    />
  );

  const renderCurrentScreen = () => {
    if (currentScreenEntry.screen === "trip-itinerary" && loadedTrip) {
      return renderItineraryPanel();
    }

    if (currentScreenEntry.screen === "trip-overview" && loadedTrip) {
      return renderOverviewPanel();
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
              <PlannerBrandBadge compact variant="rail" />
            </div>

            <header className="hidden lg:flex lg:items-center lg:justify-between lg:gap-6 lg:border-b lg:border-app-border lg:px-6 lg:py-4">
              <div className="min-w-0 flex flex-wrap items-center gap-3">
                <h1 className="planner-title-xl text-app-text">{shellTitle}</h1>
                {!isTripScreen ? (
                  <span className="planner-pill rounded-full border px-3 py-1 text-xs font-semibold">
                    {shellSummary}
                  </span>
                ) : null}
              </div>

              <div className="flex items-center gap-3">
                <div className="rounded-2xl border border-app-border bg-app-surface px-3 py-2">
                  <p className="planner-eyebrow text-app-muted">Active trip</p>
                  <p className="planner-title-sm mt-1 text-app-text">
                    {activeTrip?.name ?? "No active trip"}
                  </p>
                </div>
                <TodayStatusControl activeTripName={activeTrip?.name ?? null} actions={todayActions} />
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

            <div className="min-h-0 flex-1 lg:hidden">
              <div className="border-b border-app-border px-4 py-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <PlannerBrandBadge compact variant="rail" />
                  </div>

                  <div className="flex items-center gap-2">
                    <div className="rounded-2xl border border-app-border bg-app-surface px-3 py-2">
                      <p className="planner-eyebrow text-app-muted">Active trip</p>
                      <p className="planner-title-sm mt-1 max-w-[9rem] truncate text-app-text">
                        {activeTrip?.name ?? "No active trip"}
                      </p>
                    </div>
                    <TodayStatusControl activeTripName={activeTrip?.name ?? null} actions={todayActions} />
                  </div>
                </div>
              </div>

              <section className="min-h-0">
                <div className="space-y-4 p-4 sm:p-5">
                  {!isTripScreen ? (
                    <div className="flex flex-wrap items-center gap-3">
                      <h1 className="planner-title-lg text-app-text">{shellTitle}</h1>
                      <span className="planner-pill rounded-full border px-3 py-1 text-xs font-semibold">
                        {shellSummary}
                      </span>
                    </div>
                  ) : null}

                  {renderSharedNotices()}
                  {renderTripWorkspaceHeader()}
                  {renderCurrentScreen()}
                </div>
              </section>
            </div>

            <div className="hidden lg:flex lg:min-h-0 lg:flex-col lg:p-6">
              <div className="space-y-4">
                {renderSharedNotices()}
                {renderTripWorkspaceHeader()}
              </div>

              <div
                data-testid="desktop-panel-region"
                className={`min-h-0 flex-1 lg:flex lg:flex-col ${isTripScreen ? "mt-5" : "mt-0"}`}
              >
                {renderCurrentScreen()}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="fixed bottom-4 left-4 z-40 lg:hidden">
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
      </div>

      <StopEditorModal
        isOpen={editor.isOpen}
        mode={editor.mode}
        stopType={editor.type}
        initialStop={editor.initialStop}
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
