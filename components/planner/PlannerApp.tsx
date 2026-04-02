"use client";

import { startTransition, useEffect, useMemo, useRef, useState } from "react";

import AccountPanel from "@/components/planner/AccountPanel";
import AccountStatusControl from "@/components/planner/AccountStatusControl";
import DayStrip from "@/components/planner/DayStrip";
import FirstTripSetupPanel from "@/components/planner/FirstTripSetupPanel";
import GapWarnings from "@/components/planner/GapWarnings";
import ItinerarySections from "@/components/planner/ItinerarySections";
import PlannerAuthGate from "@/components/planner/PlannerAuthGate";
import PlannerBrandBadge from "@/components/planner/PlannerBrandBadge";
import PlannerMap from "@/components/planner/PlannerMap";
import StopEditorModal from "@/components/planner/StopEditorModal";
import TodayActionsPanel from "@/components/planner/TodayActionsPanel";
import TravelInsightsPanel from "@/components/planner/TravelInsightsPanel";
import TripCreateModal from "@/components/planner/TripCreateModal";
import TripHeader from "@/components/planner/TripHeader";
import TripRenameModal from "@/components/planner/TripRenameModal";
import TripsPanel from "@/components/planner/TripsPanel";
import ValidationWarningsPanel from "@/components/planner/ValidationWarningsPanel";
import { formatDateOnly, nowIso, todayDateInTimezone } from "@/lib/date";
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
  getGapWarnings,
  getItinerarySections,
  getMapData,
  getSelectedEntityPrimaryDate,
  getTodayActions,
  getTripDays,
  getValidationWarnings,
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
} from "@/types/trip";

type EditorState = {
  isOpen: boolean;
  mode: "create" | "edit";
  type: StopType;
  initialStop: TripStop | null;
};

type MobileTab = "trips" | "today" | "itinerary" | "overview";
type DesktopPanel = "trips" | "itinerary" | "overview" | "today";
type SelectionOrigin = "itinerary" | "map" | "system";
type RouteInsightsState = "fresh" | "stale" | "unavailable";
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

const desktopPanelMeta: Array<{
  id: DesktopPanel;
  label: string;
}> = [
  { id: "trips", label: "Dashboard" },
  { id: "overview", label: "Overview" },
  { id: "itinerary", label: "Itinerary" },
  { id: "today", label: "Today" },
];

const mobilePanelMeta: Array<{
  id: MobileTab;
  label: string;
}> = [
  { id: "trips", label: "Dashboard" },
  { id: "overview", label: "Overview" },
  { id: "itinerary", label: "Itinerary" },
  { id: "today", label: "Today" },
];

const noticeToneClass = {
  info: "border-sky-200 bg-sky-50 text-sky-800",
  success: "border-emerald-200 bg-emerald-50 text-emerald-800",
  warning: "border-amber-200 bg-amber-50 text-amber-800",
} as const;

const saveFeedbackToneClass: Record<PlannerNoticeTone, string> = {
  info: "border-sky-200 bg-sky-50 text-sky-700",
  success: "border-emerald-200 bg-emerald-50 text-emerald-700",
  warning: "border-amber-200 bg-amber-50 text-amber-800",
};

const cloneTrip = (trip: Trip): Trip => structuredClone(trip);

const panelIcon = (panel: DesktopPanel) => {
  if (panel === "trips") {
    return (
      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
        <rect x="4" y="5" width="16" height="14" rx="2.2" />
        <path d="M8 9h8" strokeLinecap="round" />
        <path d="M8 13h5" strokeLinecap="round" />
      </svg>
    );
  }

  if (panel === "itinerary") {
    return (
      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M6 5h12" strokeLinecap="round" />
        <path d="M6 12h12" strokeLinecap="round" />
        <path d="M6 19h12" strokeLinecap="round" />
        <circle cx="4.5" cy="5" r="1" fill="currentColor" stroke="none" />
        <circle cx="4.5" cy="12" r="1" fill="currentColor" stroke="none" />
        <circle cx="4.5" cy="19" r="1" fill="currentColor" stroke="none" />
      </svg>
    );
  }

  if (panel === "overview") {
    return (
      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
        <rect x="4" y="4" width="7" height="7" rx="1.6" />
        <rect x="13" y="4" width="7" height="4" rx="1.4" />
        <rect x="13" y="10" width="7" height="10" rx="1.6" />
        <rect x="4" y="13" width="7" height="7" rx="1.6" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
      <circle cx="12" cy="12" r="7" />
      <path d="M12 8v4l2.5 2.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
};

export default function PlannerApp() {
  const {
    data,
    tripSummaries,
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
  const [mobileTab, setMobileTab] = useState<MobileTab>("today");
  const [desktopPanel, setDesktopPanel] = useState<DesktopPanel>("itinerary");
  const [isDesktopViewport, setIsDesktopViewport] = useState(false);
  const [routeEstimates, setRouteEstimates] = useState<TravelLegEstimate[]>([]);
  const [isEstimatingRoutes, setIsEstimatingRoutes] = useState(false);
  const [routeInsightsState, setRouteInsightsState] = useState<RouteInsightsState>("fresh");
  const [routeStatusMessage, setRouteStatusMessage] = useState<string | null>(null);
  const [isTripCreateOpen, setIsTripCreateOpen] = useState(false);
  const [tripToRename, setTripToRename] = useState<TripSummary | null>(null);
  const [isManagingTrips, setIsManagingTrips] = useState(false);
  const [draftTrip, setDraftTrip] = useState<Trip | null>(null);
  const [isSavingDraft, setIsSavingDraft] = useState(false);
  const [saveFeedback, setSaveFeedback] = useState<{
    tone: PlannerNoticeTone;
    text: string;
  } | null>(null);
  const panelSelectionVersionRef = useRef(0);
  const routeRefreshCounterRef = useRef(0);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const mediaQuery = window.matchMedia("(min-width: 1024px)");
    const onChange = () => setIsDesktopViewport(mediaQuery.matches);

    onChange();
    mediaQuery.addEventListener("change", onChange);
    return () => mediaQuery.removeEventListener("change", onChange);
  }, []);

  useEffect(() => {
    void initialize();
  }, [initialize]);

  const activeTrip = useMemo(() => {
    if (!data) {
      return null;
    }

    return data.trips.find((trip) => trip.id === data.activeTripId) ?? null;
  }, [data]);
  const displayTrip = plannerInteractionMode === "edit" && draftTrip ? draftTrip : activeTrip;

  const isCloudTripLibraryAvailable = authStatus === "signed_in" && mode === "cloud";
  const desktopTripsPanel = isCloudTripLibraryAvailable
    ? desktopPanelMeta.find((panel) => panel.id === "trips") ?? null
    : null;
  const desktopViewPanels = desktopPanelMeta.filter((panel) => panel.id !== "trips");
  const desktopRailPanels = desktopTripsPanel
    ? [desktopTripsPanel, ...desktopViewPanels]
    : desktopViewPanels;
  const mobileTripsPanel = isCloudTripLibraryAvailable
    ? mobilePanelMeta.find((panel) => panel.id === "trips") ?? null
    : null;
  const mobileViewPanels = mobilePanelMeta.filter((panel) => panel.id !== "trips");

  useEffect(() => {
    if (!isCloudTripLibraryAvailable) {
      if (desktopPanel === "trips") {
        setDesktopPanel("overview");
      }

      if (mobileTab === "trips") {
        setMobileTab("overview");
      }
    }
  }, [desktopPanel, isCloudTripLibraryAvailable, mobileTab]);

  const routePayload = useMemo(() => {
    if (!displayTrip) {
      return {
        requests: [],
        signature: "",
      };
    }

    return buildTripTravelLegPayload(displayTrip);
  }, [displayTrip]);

  const routeRequests = routePayload.requests;
  const routeSignature = routePayload.signature;
  const routeRequestsRef = useRef(routeRequests);
  const activeTripRef = useRef(displayTrip);

  useEffect(() => {
    routeRequestsRef.current = routeRequests;
    activeTripRef.current = displayTrip;
  }, [displayTrip, routeRequests]);

  useEffect(() => {
    if (plannerInteractionMode !== "edit") {
      setDraftTrip(null);
      return;
    }

    if (!activeTrip) {
      setDraftTrip(null);
      return;
    }

    setDraftTrip((current) => current ?? cloneTrip(activeTrip));
  }, [activeTrip, plannerInteractionMode]);

  useEffect(() => {
    if (!saveFeedback || saveFeedback.tone === "warning") {
      return;
    }

    const timer = window.setTimeout(() => setSaveFeedback(null), 2200);
    return () => window.clearTimeout(timer);
  }, [saveFeedback]);

  useEffect(() => {
    const currentTrip = activeTripRef.current;
    const currentRequests = routeRequestsRef.current;

    if (!currentTrip || currentRequests.length === 0) {
      startTransition(() => {
        setRouteEstimates([]);
        setRouteInsightsState("fresh");
        setRouteStatusMessage(null);
        setIsEstimatingRoutes(false);
      });
      return;
    }

    let cancelled = false;
    const refreshId = routeRefreshCounterRef.current + 1;
    routeRefreshCounterRef.current = refreshId;

    const loadRouteEstimates = async () => {
      const cached = await readCachedRouteEstimateSet(routeSignature);
      if (cancelled || routeRefreshCounterRef.current !== refreshId) {
        return;
      }

      if (cached.state === "fresh" && cached.entry) {
        setRouteEstimates(mergeTravelEstimateMetadata(cached.entry.estimates, currentRequests));
        setRouteInsightsState("fresh");
        setRouteStatusMessage(null);
        setIsEstimatingRoutes(false);
        return;
      }

      if (cached.entry) {
        setRouteEstimates(mergeTravelEstimateMetadata(cached.entry.estimates, currentRequests));
        setRouteInsightsState("stale");
        setRouteStatusMessage("Showing the last successful route timings while a refresh runs.");
      } else {
        setRouteEstimates([]);
        setRouteInsightsState("fresh");
        setRouteStatusMessage(null);
      }

      setIsEstimatingRoutes(true);

      try {
        const estimates = await fetchTravelLegEstimates(currentRequests);
        if (cancelled || routeRefreshCounterRef.current !== refreshId) {
          return;
        }

        const mergedEstimates = mergeTravelEstimateMetadata(estimates, currentRequests);
        setRouteEstimates(mergedEstimates);
        setRouteInsightsState("fresh");
        setRouteStatusMessage(null);
        await writeCachedRouteEstimateSet(routeSignature, mergedEstimates);
      } catch (caught) {
        if (cancelled || routeRefreshCounterRef.current !== refreshId) {
          return;
        }

        if (cached.entry) {
          setRouteInsightsState("stale");
          setRouteStatusMessage(
            caught instanceof Error
              ? `${caught.message} Showing the last successful route timings instead.`
              : "Unable to refresh route estimates. Showing the last successful timings instead.",
          );
        } else {
          setRouteInsightsState("unavailable");
          setRouteStatusMessage(
            caught instanceof Error ? caught.message : "Unable to refresh route estimates.",
          );
        }
      } finally {
        if (!cancelled && routeRefreshCounterRef.current === refreshId) {
          setIsEstimatingRoutes(false);
        }
      }
    };

    void loadRouteEstimates();

    return () => {
      cancelled = true;
    };
  }, [routeSignature]);

  useEffect(() => {
    if (routeRequests.length === 0) {
      return;
    }

    setRouteEstimates((currentEstimates) =>
      mergeTravelEstimateMetadata(currentEstimates, routeRequests),
    );
  }, [routeRequests]);

  const tripDays = useMemo(() => (displayTrip ? getTripDays(displayTrip) : []), [displayTrip]);
  const effectiveSelectedDate = tripDays.includes(selectedDate)
    ? selectedDate
    : tripDays[0] ?? selectedDate;

  const itinerarySections = useMemo(
    () => (displayTrip ? getItinerarySections(displayTrip) : []),
    [displayTrip],
  );

  const mapData = useMemo(
    () => (displayTrip ? getMapData(displayTrip, routeEstimates) : { markers: [], segments: [] }),
    [displayTrip, routeEstimates],
  );

  const gapWarnings = useMemo(() => (displayTrip ? getGapWarnings(displayTrip) : []), [displayTrip]);
  const todayActions = useMemo(() => (displayTrip ? getTodayActions(displayTrip) : []), [displayTrip]);
  const costSummary = useMemo(
    () => (displayTrip ? getCostSummary(displayTrip) : { totalNights: 0, totalCost: 0 }),
    [displayTrip],
  );
  const validationWarnings = useMemo(
    () => (displayTrip ? getValidationWarnings(displayTrip, routeEstimates) : []),
    [displayTrip, routeEstimates],
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
      isRefreshing: isEstimatingRoutes,
    };
  }, [isEstimatingRoutes, mapData.segments]);

  const canEditTrip = plannerInteractionMode === "edit" && !isOfflineReadOnly;
  const isTripLibraryBusy = isLoading || isManagingTrips || syncStatus === "saving";
  const activePanelMeta = desktopPanelMeta.find((panel) => panel.id === desktopPanel) ?? desktopPanelMeta[0];
  const stopCount = displayTrip?.stops.length ?? 0;
  const stayCount = displayTrip?.stops.filter((stop) => stop.type === "stay").length ?? 0;
  const activePanelSummary =
    desktopPanel === "itinerary"
      ? `${tripDays.length} ${tripDays.length === 1 ? "day" : "days"} in plan`
      : desktopPanel === "today"
        ? `${todayActions.length} action${todayActions.length === 1 ? "" : "s"} in focus`
      : desktopPanel === "trips"
          ? "Account, library, and trip health"
          : displayTrip
            ? formatTripDateRange(displayTrip)
            : "No trip selected";
  const hasDraftChanges = useMemo(() => {
    if (plannerInteractionMode !== "edit" || !draftTrip || !activeTrip) {
      return false;
    }

    return JSON.stringify(draftTrip) !== JSON.stringify(activeTrip);
  }, [activeTrip, draftTrip, plannerInteractionMode]);

  const confirmDiscardDraftChanges = (actionLabel: string) => {
    if (!hasDraftChanges) {
      return true;
    }

    return window.confirm(
      `Discard your unsaved itinerary changes before ${actionLabel}?`,
    );
  };

  const openCreateStopEditor = (type: StopType) => {
    setEditor({
      isOpen: true,
      mode: "create",
      type,
      initialStop: null,
    });
  };

  const selectDesktopPanel = (panel: DesktopPanel) => {
    panelSelectionVersionRef.current += 1;
    setDesktopPanel(panel);
  };

  const selectMobileTab = (panel: MobileTab) => {
    panelSelectionVersionRef.current += 1;
    setMobileTab(panel);
  };

  const showOverviewPanel = (selectionVersion?: number) => {
    if (
      typeof selectionVersion === "number" &&
      panelSelectionVersionRef.current !== selectionVersion
    ) {
      return;
    }

    if (isDesktopViewport) {
      setDesktopPanel("overview");
      return;
    }

    setMobileTab("overview");
  };

  const showItineraryPanel = (selectionVersion?: number) => {
    if (
      typeof selectionVersion === "number" &&
      panelSelectionVersionRef.current !== selectionVersion
    ) {
      return;
    }

    if (isDesktopViewport) {
      setDesktopPanel("itinerary");
      return;
    }

    setMobileTab("itinerary");
  };

  const enterEditMode = () => {
    if (!activeTrip) {
      return;
    }

    setPlannerInteractionMode("edit");

    if (useTripStore.getState().plannerInteractionMode === "edit") {
      setDraftTrip(cloneTrip(activeTrip));
    }
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

  const onSelectEntityFromMap = (entity: Exclude<SelectedEntity, null>) => {
    selectEntity(entity, "map");
  };

  const handleOpenTrip = async (tripId: string) => {
    const selectionVersion = panelSelectionVersionRef.current;

    if (tripId === activeTrip?.id) {
      showOverviewPanel();
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
        showOverviewPanel(selectionVersion);
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

    const previousActiveTripId = activeTrip?.id ?? null;
    const selectionVersion = panelSelectionVersionRef.current;
    setIsManagingTrips(true);

    try {
      await createTrip(input);
      const nextState = useTripStore.getState();
      const nextActiveTripId = nextState.data?.activeTripId ?? null;
      const didCreate = !nextState.error && nextActiveTripId !== previousActiveTripId;

      if (didCreate) {
        if (input.source === "blank") {
          showItineraryPanel(selectionVersion);
          setEditor(defaultEditorState);
          const nextTrip =
            nextState.data?.trips.find((trip) => trip.id === nextActiveTripId) ?? null;
          setPlannerInteractionMode("edit");
          if (nextTrip && useTripStore.getState().plannerInteractionMode === "edit") {
            setDraftTrip(cloneTrip(nextTrip));
          }
        } else {
          showOverviewPanel(selectionVersion);
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
    const selectionVersion = panelSelectionVersionRef.current;
    if (trip.id === activeTrip?.id && !confirmDiscardDraftChanges(`deleting "${trip.name}"`)) {
      return;
    }

    const confirmed = window.confirm(
      trip.id === activeTrip?.id
        ? `Delete "${trip.name}"? The planner will immediately load another remaining trip.`
        : `Delete "${trip.name}"? This cannot be undone.`,
    );
    if (!confirmed) {
      return;
    }

    setIsManagingTrips(true);

    try {
      const isDeletingActiveTrip = trip.id === activeTrip?.id;
      await deleteTrip(trip.id);
      const nextState = useTripStore.getState();

      if (!nextState.error && isDeletingActiveTrip) {
        showOverviewPanel(selectionVersion);
      }
    } finally {
      setIsManagingTrips(false);
    }
  };

  const handleImportLegacyTrips = async () => {
    if (!confirmDiscardDraftChanges("importing local trips")) {
      return;
    }

    const selectionVersion = panelSelectionVersionRef.current;
    setIsManagingTrips(true);

    try {
      await importLegacyTrips();
      const nextState = useTripStore.getState();
      if (!nextState.error) {
        showOverviewPanel(selectionVersion);
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
        <div className="rounded-[24px] border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          {error}
        </div>
      ) : null}
      {inlineNotice ? (
        <div
          data-testid="planner-inline-notice"
          className={`rounded-[24px] border px-4 py-3 text-sm ${noticeToneClass[inlineNotice.tone]}`}
        >
          {inlineNotice.text}
        </div>
      ) : null}
    </>
  );

  const renderOverviewPanel = () => (
    <div
      data-testid="overview-scroll-region"
      className="space-y-4 pr-1 lg:flex lg:h-full lg:min-h-0 lg:flex-col lg:overflow-y-auto"
    >
      <TripHeader
        tripName={displayTrip?.name ?? ""}
        homeLabel={displayTrip?.home.label ?? ""}
        dateRangeLabel={displayTrip ? formatTripDateRange(displayTrip) : ""}
        totalNights={costSummary.totalNights}
        totalCost={costSummary.totalCost}
      />

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.1fr)_minmax(280px,0.9fr)]">
        <TravelInsightsPanel
          estimates={routeEstimates}
          legCount={routeRequests.length}
          status={routeInsightsState}
          statusMessage={routeStatusMessage}
          isRefreshing={isEstimatingRoutes}
        />

        <div className="space-y-4">
          <ValidationWarningsPanel warnings={validationWarnings} />
          <GapWarnings warnings={gapWarnings} />
        </div>
      </div>
    </div>
  );

  const renderTodayPanel = () => (
    <div
      data-testid="today-scroll-region"
      className="space-y-4 pr-1 lg:flex lg:h-full lg:min-h-0 lg:flex-col lg:overflow-y-auto"
    >
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.08fr)_minmax(280px,0.92fr)]">
        <TodayActionsPanel actions={todayActions} />

        <section className="rounded-[24px] border border-slate-200/80 bg-white px-4 py-4 sm:px-5 sm:py-5">
          <p className="planner-eyebrow text-teal-700">Daily snapshot</p>

          <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
            <div className="rounded-[18px] border border-slate-200 bg-slate-50/80 px-3.5 py-3.5">
              <p className="planner-eyebrow text-slate-500">Selected date</p>
              <p className="planner-title-lg mt-2 text-slate-950">
                {formatDateOnly(effectiveSelectedDate)}
              </p>
            </div>
            <div className="rounded-[18px] border border-slate-200 bg-slate-50/80 px-3.5 py-3.5">
              <p className="planner-eyebrow text-slate-500">Campsites</p>
              <p className="planner-metric mt-2 text-slate-950">{stayCount}</p>
            </div>
            <div className="rounded-[18px] border border-slate-200 bg-slate-50/80 px-3.5 py-3.5">
              <p className="planner-eyebrow text-slate-500">Stops in plan</p>
              <p className="planner-metric mt-2 text-slate-950">{stopCount}</p>
            </div>
            <div className="rounded-[18px] border border-slate-200 bg-slate-50/80 px-3.5 py-3.5">
              <p className="planner-eyebrow text-slate-500">Live road legs</p>
              <p className="planner-metric mt-2 text-slate-950">{routeMapSummary.liveRoadLegs}</p>
            </div>
          </div>
        </section>
      </div>
    </div>
  );

  const renderDashboardPanel = () => (
    <div data-testid="desktop-panel-trips-region" className="lg:flex lg:h-full lg:min-h-0 lg:flex-col">
      <div className="space-y-4 pr-1 lg:flex lg:h-full lg:min-h-0 lg:flex-col lg:overflow-y-auto">
        <TripHeader
          tripName={displayTrip?.name ?? ""}
          homeLabel={displayTrip?.home.label ?? ""}
          dateRangeLabel={displayTrip ? formatTripDateRange(displayTrip) : ""}
          totalNights={costSummary.totalNights}
          totalCost={costSummary.totalCost}
        />

        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.08fr)_minmax(320px,0.92fr)]">
          <TripsPanel
            trips={tripSummaries}
            activeTripId={activeTrip?.id ?? ""}
            hasLegacyImport={hasLegacyImport}
            isOfflineReadOnly={isOfflineReadOnly}
            isWorking={isTripLibraryBusy}
            onCreateTrip={() => setIsTripCreateOpen(true)}
            onImportLegacyTrips={handleImportLegacyTrips}
            onOpenTrip={handleOpenTrip}
            onRenameTrip={setTripToRename}
            onDeleteTrip={handleDeleteTrip}
          />

          <AccountPanel
            authStatus={authStatus}
            mode={mode}
            userEmail={user?.email ?? null}
            syncStatus={syncStatus}
            isOfflineReadOnly={isOfflineReadOnly}
            hasLegacyImport={hasLegacyImport}
            statusMessage={accountNotice?.text ?? null}
            onSignIn={signInWithMagicLink}
            onSignInAsTestUser={signInAsTestUser}
            onSignOut={signOut}
            onImportLegacy={handleImportLegacyTrips}
            onCreateCloudTripFromCurrent={createCloudTripFromCurrent}
          />
        </div>

        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.1fr)_minmax(280px,0.9fr)]">
          <TravelInsightsPanel
            estimates={routeEstimates}
            legCount={routeRequests.length}
            status={routeInsightsState}
            statusMessage={routeStatusMessage}
            isRefreshing={isEstimatingRoutes}
          />

          <div className="space-y-4">
            <ValidationWarningsPanel warnings={validationWarnings} />
            <GapWarnings warnings={gapWarnings} />
          </div>
        </div>
      </div>
    </div>
  );

  const renderItineraryPanel = (isVisible: boolean) => (
    <div
      data-testid="desktop-panel-itinerary-region"
      className="lg:flex lg:h-full lg:min-h-0 lg:flex-1 lg:flex-col"
    >
      <section
        className={`overflow-hidden rounded-[24px] border bg-white transition-[border-color,box-shadow] duration-200 lg:flex lg:min-h-0 lg:flex-1 lg:flex-col ${
          plannerInteractionMode === "edit"
            ? "border-teal-300 shadow-[0_0_0_1px_rgba(13,148,136,0.24),0_0_0_14px_rgba(20,184,166,0.12),0_28px_60px_rgba(15,23,42,0.08)]"
            : "border-slate-200/80"
        }`}
      >
        <div className="border-b border-slate-200 px-4 py-4 sm:px-5 sm:py-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="planner-eyebrow text-teal-700">Itinerary</p>
              <h2 className="planner-title-lg mt-2 text-slate-950">Stops and travel flow</h2>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <span
                  className={`rounded-full border px-3 py-1 text-xs font-semibold ${
                    plannerInteractionMode === "edit"
                      ? "border-teal-200 bg-teal-50 text-teal-800"
                      : "border-slate-200 bg-slate-50 text-slate-700"
                  }`}
                >
                  {plannerInteractionMode === "edit" ? "Edit mode active" : "View mode active"}
                </span>
                {saveFeedback ? (
                  <span
                    className={`rounded-full border px-3 py-1 text-xs font-semibold ${saveFeedbackToneClass[saveFeedback.tone]}`}
                  >
                    {saveFeedback.text}
                  </span>
                ) : null}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                data-testid="planner-mode-toggle"
                aria-pressed={plannerInteractionMode === "edit"}
                title={
                  isOfflineReadOnly
                    ? "View mode stays locked while offline. Reconnect before switching to Edit mode."
                    : plannerInteractionMode === "edit"
                      ? "Edit mode is active. Save or cancel before returning to view-only review."
                      : "View mode is active. Click to switch to Edit mode and change this itinerary."
                }
                onClick={() => {
                  if (plannerInteractionMode === "view") {
                    enterEditMode();
                  }
                }}
                disabled={isOfflineReadOnly || plannerInteractionMode === "edit"}
                className={`rounded-xl border px-3.5 py-2 text-sm font-semibold transition ${
                  isOfflineReadOnly
                    ? "cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400"
                    : plannerInteractionMode === "edit"
                      ? "cursor-default border-slate-200 bg-slate-100 text-slate-400"
                      : "border-slate-950 bg-slate-950 text-white hover:bg-slate-800"
                }`}
              >
                Edit mode
              </button>

              <div
                className={`flex items-center gap-2 overflow-hidden transition-[max-width,opacity] duration-200 ${
                  plannerInteractionMode === "edit" ? "max-w-[16rem] opacity-100" : "max-w-0 opacity-0"
                }`}
              >
                <button
                  type="button"
                  data-testid="planner-mode-save"
                  onClick={() => void handleSaveItinerary()}
                  disabled={!hasDraftChanges || isSavingDraft}
                  className="rounded-xl border border-teal-700 bg-teal-700 px-3.5 py-2 text-sm font-semibold text-white transition hover:bg-teal-800 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-200 disabled:text-slate-500"
                >
                  {isSavingDraft ? "Saving..." : "Save"}
                </button>

                <button
                  type="button"
                  data-testid="planner-mode-cancel"
                  onClick={exitEditMode}
                  disabled={isSavingDraft}
                  className="rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>

          {isOfflineReadOnly ? (
            <p className="planner-copy-sm mt-4 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 font-medium text-amber-800">
              The cached trip is available to review while offline, but editing stays locked until
              you reconnect.
            </p>
          ) : null}

          <div className="mt-4 rounded-[20px] border border-slate-200 bg-slate-50/70 p-3.5 sm:p-4">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="planner-title-sm text-slate-900">Trip days</h3>
              <span className="planner-meta text-slate-500">
                {tripDays.length} {tripDays.length === 1 ? "day" : "days"}
              </span>
            </div>
            <DayStrip
              days={tripDays}
              selectedDate={effectiveSelectedDate}
              onSelect={onSelectDate}
            />
          </div>

          {canEditTrip ? (
            <div className="mt-4 flex flex-wrap gap-2">
              {([
                ["stay", "+ Stay", "border-emerald-300 bg-emerald-50 text-emerald-700"],
                ["ferry", "+ Ferry", "border-cyan-300 bg-cyan-50 text-cyan-700"],
                [
                  "point_of_interest",
                  "+ POI",
                  "border-orange-300 bg-orange-50 text-orange-700",
                ],
              ] as const).map(([type, label, tone]) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => openCreateStopEditor(type)}
                  data-testid={`planner-add-${type}`}
                  className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${tone}`}
                >
                  {label}
                </button>
              ))}
            </div>
          ) : null}

          <div className="mt-4 rounded-[20px] border border-slate-200 bg-slate-50/70 p-3.5 sm:p-4">
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <div className="flex flex-wrap gap-2">
                <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-600">
                  {routeMapSummary.totalRoadLegs} road legs
                </span>
                <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                  {routeMapSummary.liveRoadLegs} live
                </span>
                <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-800">
                  {routeMapSummary.fallbackRoadLegs} fallback
                </span>
                {routeMapSummary.pendingRoadLegs > 0 ? (
                  <span className="rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-xs font-semibold text-sky-700">
                    {routeMapSummary.pendingRoadLegs} pending
                  </span>
                ) : null}
              </div>
            </div>

            <div className="h-[240px] lg:h-[300px]">{renderPlannerMap(isVisible)}</div>
          </div>
        </div>

        <div
          data-testid="desktop-itinerary-scroll-region"
          data-itinerary-scroll-container="true"
          className="max-h-[48vh] overflow-y-auto px-4 py-4 pr-3 sm:px-5 sm:py-5 sm:pr-4 lg:max-h-none lg:min-h-0 lg:flex-1 lg:overflow-y-auto"
        >
          <ItinerarySections
            sections={itinerarySections}
            selectedDate={effectiveSelectedDate}
            selectedEntity={effectiveSelectedEntity}
            isVisible={isVisible}
            isOfflineReadOnly={isOfflineReadOnly}
            canMutate={canEditTrip}
            onSelectDate={onSelectDate}
            onSelectEntity={onSelectEntityFromItinerary}
            onEdit={(stop) =>
              setEditor({
                isOpen: true,
                mode: "edit",
                type: stop.type,
                initialStop: stop,
              })
            }
            onDelete={(stop) => {
              const confirmed = window.confirm(`Delete "${stop.title}"?`);
              if (confirmed) {
                void onDeleteStop(stop.id);
              }
            }}
          />
        </div>
      </section>
    </div>
  );

  const renderPlannerMap = (isVisible: boolean) => (
    <PlannerMap
      trip={displayTrip!}
      markers={mapData.markers}
      segments={mapData.segments}
      routeSummary={routeMapSummary}
      selectedEntity={effectiveSelectedEntity}
      selectionOrigin={selectionOrigin}
      onSelectEntity={onSelectEntityFromMap}
      isVisible={isVisible}
      className="h-full w-full rounded-[18px] border border-slate-200 bg-white"
    />
  );

  if (isLoading && !activeTrip && authStatus === "checking") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-100 px-4 py-10">
        <p className="planner-copy text-slate-600">Loading trip planner...</p>
      </div>
    );
  }

  if (!activeTrip && (authStatus === "signed_out" || authStatus === "disabled")) {
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

  if (!activeTrip && authStatus === "signed_in" && firstTripSetup === "choose_source") {
    return (
      <div className="min-h-screen bg-slate-100 px-4 py-10">
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

  if (isLoading && !activeTrip) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-100 px-4 py-10">
        <p className="planner-copy text-slate-600">Preparing your trip workspace...</p>
      </div>
    );
  }

  if (!activeTrip) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-100 px-4 py-10">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-sm">
          <p className="planner-copy text-slate-700">{error ?? "No trip loaded."}</p>
          <button
            type="button"
            onClick={() => void initialize()}
            className="mt-3 rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
          >
            Reload
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="min-h-screen bg-[var(--bg)] p-3 sm:p-4 lg:h-[100dvh] lg:overflow-hidden lg:p-5">
        <div className="mx-auto h-full w-full max-w-[1660px] overflow-hidden rounded-[30px] border border-slate-200/80 bg-white/85 shadow-[0_28px_80px_rgba(15,23,42,0.08)] backdrop-blur-sm">
          <div className="flex h-full flex-col lg:grid lg:grid-cols-[240px_minmax(0,1fr)] lg:grid-rows-[auto_minmax(0,1fr)]">
            <div className="hidden lg:flex lg:items-center lg:border-r lg:border-b lg:border-slate-200 lg:bg-slate-50/65 lg:px-4 lg:py-4">
              <PlannerBrandBadge compact variant="rail" />
            </div>

            <header className="hidden lg:flex lg:items-center lg:justify-between lg:gap-6 lg:border-b lg:border-slate-200 lg:px-6 lg:py-4">
              <div className="min-w-0 flex flex-wrap items-center gap-3">
                <h1 className="planner-title-xl text-slate-950">{activePanelMeta.label}</h1>
                <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-600">
                  {activePanelSummary}
                </span>
              </div>
            </header>

            <aside
              data-testid="planner-rail-column"
              className="hidden lg:flex lg:min-h-0 lg:flex-col lg:border-r lg:border-slate-200 lg:bg-slate-50/65"
            >
              <nav className="flex-1 overflow-y-auto px-3 py-4">
                <div className="space-y-1">
                  {desktopRailPanels.map((panel) => {
                    const active = desktopPanel === panel.id;

                    return (
                      <button
                        key={panel.id}
                        type="button"
                        data-testid={`desktop-panel-${panel.id}`}
                        onClick={() => selectDesktopPanel(panel.id)}
                        className={`flex w-full items-center gap-3 rounded-[18px] border px-3.5 py-3 text-left text-sm font-medium transition ${
                          active
                            ? "border-slate-200 bg-white text-teal-800 shadow-[0_1px_2px_rgba(15,23,42,0.04)]"
                            : "border-transparent text-slate-700 hover:border-slate-200 hover:bg-white hover:text-slate-950"
                        }`}
                        title={panel.label}
                      >
                        <span className="shrink-0">{panelIcon(panel.id)}</span>
                        <span className="min-w-0 flex-1 truncate">{panel.label}</span>
                      </button>
                    );
                  })}
                </div>
              </nav>

              <div className="border-t border-slate-200 px-3 py-4">
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
              <div className="border-b border-slate-200 px-4 py-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <PlannerBrandBadge compact variant="rail" />
                  </div>

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
              </div>

              <section className="min-h-0">
                <div className="space-y-4 p-4 sm:p-5">
                  {renderSharedNotices()}

                  <div className="rounded-[20px] border border-slate-200 bg-white p-2">
                    {mobileTripsPanel ? (
                      <div className="mb-2">
                        <button
                          type="button"
                          data-testid="mobile-panel-trips"
                          onClick={() => selectMobileTab(mobileTripsPanel.id)}
                          className={`w-full rounded-[16px] px-3 py-2 text-sm font-semibold transition ${
                            mobileTab === mobileTripsPanel.id
                              ? "border border-slate-200 bg-slate-950 text-white"
                              : "border border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100"
                          }`}
                        >
                          {mobileTripsPanel.label}
                        </button>
                      </div>
                    ) : null}

                    <div className="flex gap-2 overflow-x-auto pb-1">
                      {mobileViewPanels.map((panel) => (
                        <button
                          key={panel.id}
                          type="button"
                          data-testid={`mobile-panel-${panel.id}`}
                          onClick={() => selectMobileTab(panel.id)}
                          className={`shrink-0 rounded-[16px] px-3 py-2 text-sm font-semibold transition ${
                            mobileTab === panel.id
                              ? "border border-slate-200 bg-slate-950 text-white"
                              : "border border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100"
                          }`}
                        >
                          {panel.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {mobileTab === "trips" && isCloudTripLibraryAvailable ? renderDashboardPanel() : null}
                  {mobileTab === "today" ? renderTodayPanel() : null}
                  {mobileTab === "overview" ? renderOverviewPanel() : null}
                  {mobileTab === "itinerary" ? renderItineraryPanel(true) : null}
                </div>
              </section>
            </div>

            <div className="hidden lg:flex lg:min-h-0 lg:flex-col lg:p-6">
              <div className="space-y-4">{renderSharedNotices()}</div>

              <div
                data-testid="desktop-panel-region"
                className="mt-5 min-h-0 flex-1 lg:flex lg:flex-col"
              >
                {desktopPanel === "trips" && isCloudTripLibraryAvailable ? renderDashboardPanel() : null}
                {desktopPanel === "overview" ? renderOverviewPanel() : null}
                {desktopPanel === "today" ? renderTodayPanel() : null}
                {desktopPanel === "itinerary" ? renderItineraryPanel(isDesktopViewport) : null}
              </div>
            </div>
          </div>
        </div>
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
