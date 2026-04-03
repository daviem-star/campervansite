"use client";

import { startTransition, useEffect, useMemo, useRef, useState } from "react";

import AccountStatusControl from "@/components/planner/AccountStatusControl";
import DayStrip from "@/components/planner/DayStrip";
import FirstTripSetupPanel from "@/components/planner/FirstTripSetupPanel";
import GapWarnings from "@/components/planner/GapWarnings";
import ItinerarySections from "@/components/planner/ItinerarySections";
import PlannerAuthGate from "@/components/planner/PlannerAuthGate";
import PlannerBrandBadge from "@/components/planner/PlannerBrandBadge";
import PlannerMap from "@/components/planner/PlannerMap";
import { plannerNoticeToneClass } from "@/components/planner/plannerTheme";
import StopEditorModal from "@/components/planner/StopEditorModal";
import TodayStatusControl from "@/components/planner/TodayStatusControl";
import TravelInsightsPanel from "@/components/planner/TravelInsightsPanel";
import TripCreateModal from "@/components/planner/TripCreateModal";
import TripRenameModal from "@/components/planner/TripRenameModal";
import TripsPanel from "@/components/planner/TripsPanel";
import ValidationWarningsPanel from "@/components/planner/ValidationWarningsPanel";
import { nowIso, todayDateInTimezone } from "@/lib/date";
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

type MobileTab = "trips" | "itinerary" | "overview";
type DesktopPanel = "trips" | "itinerary" | "overview";
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

const desktopPanelMeta: Array<{
  id: DesktopPanel;
  label: string;
}> = [
  { id: "trips", label: "Dashboard" },
  { id: "overview", label: "Overview" },
  { id: "itinerary", label: "Itinerary" },
];

const mobilePanelMeta: Array<{
  id: MobileTab;
  label: string;
}> = [
  { id: "trips", label: "Dashboard" },
  { id: "overview", label: "Overview" },
  { id: "itinerary", label: "Itinerary" },
];

const saveFeedbackToneClass: Record<PlannerNoticeTone, string> = plannerNoticeToneClass;

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
  const [mobileTab, setMobileTab] = useState<MobileTab>("trips");
  const [desktopPanel, setDesktopPanel] = useState<DesktopPanel>("trips");
  const [isDesktopViewport, setIsDesktopViewport] = useState(false);
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
  const panelSelectionVersionRef = useRef(0);
  const loadedRouteRefreshCounterRef = useRef(0);
  const previewRouteRefreshCounterRef = useRef(0);

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

  const loadedTrip = useMemo(() => {
    if (!data) {
      return null;
    }

    return data.trips.find((trip) => trip.id === data.activeTripId) ?? null;
  }, [data]);
  const displayTrip = plannerInteractionMode === "edit" && draftTrip ? draftTrip : loadedTrip;
  const previewTrip = previewTripId ? tripCache[previewTripId] ?? null : null;
  const activeTrip = activeTripId ? tripCache[activeTripId] ?? null : null;

  const isCloudTripLibraryAvailable = authStatus === "signed_in" && mode === "cloud";
  const desktopTripsPanel = desktopPanelMeta.find((panel) => panel.id === "trips") ?? null;
  const desktopViewPanels = desktopPanelMeta.filter((panel) => panel.id !== "trips");
  const desktopRailPanels = desktopTripsPanel
    ? [desktopTripsPanel, ...desktopViewPanels]
    : desktopViewPanels;
  const mobileTripsPanel = mobilePanelMeta.find((panel) => panel.id === "trips") ?? null;
  const mobileViewPanels = mobilePanelMeta.filter((panel) => panel.id !== "trips");
  const mobilePanels = mobileTripsPanel ? [mobileTripsPanel, ...mobileViewPanels] : mobileViewPanels;

  useEffect(() => {
    if (!loadedTrip) {
      if (desktopPanel !== "trips") {
        setDesktopPanel("trips");
      }

      if (mobileTab !== "trips") {
        setMobileTab("trips");
      }
    }
  }, [desktopPanel, loadedTrip, mobileTab]);

  useEffect(() => {
    if (previewTripId && !tripSummaries.some((trip) => trip.id === previewTripId)) {
      setPreviewTripId(null);
    }

    if (activeTripId && !tripSummaries.some((trip) => trip.id === activeTripId)) {
      setActiveTripId(null);
    }
  }, [activeTripId, previewTripId, tripSummaries]);

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

  const itinerarySections = useMemo(
    () => (displayTrip ? getItinerarySections(displayTrip) : []),
    [displayTrip],
  );

  const mapData = useMemo(
    () =>
      displayTrip
        ? getMapData(displayTrip, loadedRoutePanel.estimates)
        : { markers: [], segments: [] },
    [displayTrip, loadedRoutePanel.estimates],
  );

  const loadedGapWarnings = useMemo(() => (displayTrip ? getGapWarnings(displayTrip) : []), [displayTrip]);
  const previewGapWarnings = useMemo(() => (previewTrip ? getGapWarnings(previewTrip) : []), [previewTrip]);
  const todayActions = useMemo(() => (activeTrip ? getTodayActions(activeTrip) : []), [activeTrip]);
  const costSummary = useMemo(
    () => (displayTrip ? getCostSummary(displayTrip) : { totalNights: 0, totalCost: 0 }),
    [displayTrip],
  );
  const previewCostSummary = useMemo(
    () => (previewTrip ? getCostSummary(previewTrip) : { totalNights: 0, totalCost: 0 }),
    [previewTrip],
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
  const dashboardGapWarnings = isCloudTripLibraryAvailable ? previewGapWarnings : loadedGapWarnings;
  const dashboardCostSummary = isCloudTripLibraryAvailable ? previewCostSummary : costSummary;
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
  const isTripLibraryBusy = isLoading || isManagingTrips || syncStatus === "saving";
  const activePanelMeta = desktopPanelMeta.find((panel) => panel.id === desktopPanel) ?? desktopPanelMeta[0];
  const activePanelSummary =
    desktopPanel === "itinerary"
      ? loadedTrip
        ? `${tripDays.length} ${tripDays.length === 1 ? "day" : "days"} in loaded trip`
        : "Load a trip to edit stops and map details"
      : desktopPanel === "trips"
        ? dashboardTrip
          ? `${isCloudTripLibraryAvailable ? "Previewing" : "Showing"} ${dashboardTrip.name}`
          : "Preview a trip or set one active for Today"
        : displayTrip
          ? `Loaded trip · ${formatTripDateRange(displayTrip)}`
          : "Load a trip to inspect its overview";
  const isPanelDisabled = (panelId: DesktopPanel | MobileTab) => panelId !== "trips" && !loadedTrip;
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

  const showDashboardPanel = (selectionVersion?: number) => {
    if (
      typeof selectionVersion === "number" &&
      panelSelectionVersionRef.current !== selectionVersion
    ) {
      return;
    }

    if (isDesktopViewport) {
      setDesktopPanel("trips");
      return;
    }

    setMobileTab("trips");
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
    if (!loadedTrip) {
      return;
    }

    setPlannerInteractionMode("edit");

    if (useTripStore.getState().plannerInteractionMode === "edit") {
      setDraftTrip(cloneTrip(loadedTrip));
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
    const selectionVersion = panelSelectionVersionRef.current;

    if (tripId === loadedTrip?.id) {
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
        setPreviewTripId(tripId);
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

    const previousLoadedTripId = loadedTrip?.id ?? null;
    const selectionVersion = panelSelectionVersionRef.current;
    setIsManagingTrips(true);

    try {
      await createTrip(input);
      const nextState = useTripStore.getState();
      const nextLoadedTripId = nextState.data?.activeTripId ?? null;
      const didCreate = !nextState.error && nextLoadedTripId !== previousLoadedTripId;

      if (didCreate) {
        setPreviewTripId(nextLoadedTripId);
        if (input.source === "blank") {
          showItineraryPanel(selectionVersion);
          setEditor(defaultEditorState);
          const nextTrip =
            nextState.data?.trips.find((trip) => trip.id === nextLoadedTripId) ?? null;
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
        showDashboardPanel(selectionVersion);
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
        setPreviewTripId(nextState.data?.activeTripId ?? null);
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

  const renderOverviewPanel = () => (
    <div
      data-testid="overview-scroll-region"
      className="space-y-4 pr-1 lg:flex lg:h-full lg:min-h-0 lg:flex-col lg:overflow-y-auto"
    >
      {displayTrip ? (
        <div className="px-1">
          <p className="planner-eyebrow planner-section-label">Loaded trip</p>
          <h2 className="planner-title-lg mt-2 text-app-text">{displayTrip.name}</h2>
          <p className="planner-copy mt-2 flex flex-wrap items-center gap-2 text-app-muted">
            <span>{formatTripDateRange(displayTrip)}</span>
            <span className="hidden text-app-border sm:inline">/</span>
            <span>Home base: {displayTrip.home.label}</span>
            <span className="hidden text-app-border sm:inline">/</span>
            <span>{costSummary.totalNights} night{costSummary.totalNights === 1 ? "" : "s"}</span>
            <span className="hidden text-app-border sm:inline">/</span>
            <span>Estimated stay cost: GBP {costSummary.totalCost.toFixed(2)}</span>
          </p>
        </div>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.1fr)_minmax(280px,0.9fr)]">
        <TravelInsightsPanel
          estimates={loadedRoutePanel.estimates}
          legCount={loadedRouteRequests.length}
          status={loadedRoutePanel.status}
          statusMessage={loadedRoutePanel.statusMessage}
          isRefreshing={loadedRoutePanel.isRefreshing}
          onRefresh={() => void syncLoadedRoutePanel(true)}
        />

        <div className="space-y-4">
          <ValidationWarningsPanel warnings={loadedValidationWarnings} />
          <GapWarnings warnings={loadedGapWarnings} />
        </div>
      </div>
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
              isActivatingTripId={isActivatingTripId}
              onCreateTrip={() => setIsTripCreateOpen(true)}
              onImportLegacyTrips={handleImportLegacyTrips}
              onPreviewTrip={handlePreviewTrip}
              onToggleActiveTrip={handleToggleActiveTrip}
              onOpenTrip={handleOpenTrip}
              onRenameTrip={setTripToRename}
              onDeleteTrip={handleDeleteTrip}
            />
          ) : (
            <section className="rounded-[24px] border border-app-border/80 bg-app-surface px-4 py-4 sm:px-5 sm:py-5">
              <p className="planner-eyebrow planner-section-label">Dashboard</p>
              <h2 className="planner-title-lg mt-2 text-app-text">Cloud trip library is hidden in demo mode</h2>
              <p className="planner-copy mt-3 text-app-muted">
                Sign in and create a cloud-backed trip to manage multiple trips here. Until then,
                Dashboard stays available without the cloud trip library controls.
              </p>
            </section>
          )}

          <div className="space-y-4 lg:min-h-0 lg:overflow-y-auto lg:pr-1">
            <section className="rounded-[24px] border border-app-border/80 bg-app-surface px-4 py-4 sm:px-5 sm:py-5">
              <p className="planner-eyebrow planner-section-label">
                {isCloudTripLibraryAvailable ? "Previewed trip" : "Loaded trip"}
              </p>
              {dashboardTrip ? (
                <>
                  <h2 className="planner-title-lg mt-2 text-app-text">{dashboardTrip.name}</h2>
                  <p className="planner-copy mt-2 flex flex-wrap items-center gap-2 text-app-muted">
                    <span>{formatTripDateRange(dashboardTrip)}</span>
                    <span className="hidden text-app-border sm:inline">/</span>
                    <span>Home base: {dashboardTrip.home.label}</span>
                    <span className="hidden text-app-border sm:inline">/</span>
                    <span>
                      {dashboardCostSummary.totalNights} night
                      {dashboardCostSummary.totalNights === 1 ? "" : "s"}
                    </span>
                  </p>
                </>
              ) : (
                <p className="planner-copy mt-3 text-app-muted">
                  {isCloudTripLibraryAvailable
                    ? "Click a trip in the library to preview its route realism and planning warnings without loading it into the main planner."
                    : "No trip is loaded yet in demo mode."}
                </p>
              )}
            </section>

            <TravelInsightsPanel
              estimates={dashboardRoutePanel.estimates}
              legCount={dashboardRouteRequests.length}
              status={dashboardRoutePanel.status}
              statusMessage={dashboardRoutePanel.statusMessage}
              isRefreshing={dashboardRoutePanel.isRefreshing}
              onRefresh={
                dashboardTrip
                  ? isCloudTripLibraryAvailable
                    ? () => void syncPreviewRoutePanel(true)
                    : () => void syncLoadedRoutePanel(true)
                  : undefined
              }
              emptyMessage={
                dashboardTrip
                  ? null
                  : isCloudTripLibraryAvailable
                    ? "Click a trip on Dashboard to inspect saved route timings."
                    : "Route realism will appear here once a trip is loaded."
              }
            />

            <ValidationWarningsPanel
              warnings={dashboardValidationWarnings}
              emptyMessage={
                dashboardTrip
                  ? null
                  : isCloudTripLibraryAvailable
                    ? "Planning warnings will appear here when you preview a trip."
                    : "Planning warnings will appear here when a trip is loaded."
              }
            />

            <GapWarnings
              warnings={dashboardGapWarnings}
              emptyMessage={
                dashboardTrip
                  ? null
                  : isCloudTripLibraryAvailable
                    ? "Base coverage gaps will appear here when you preview a trip."
                    : "Base coverage gaps will appear here when a trip is loaded."
              }
            />
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
        className={`overflow-hidden rounded-[24px] border bg-app-surface transition-[border-color,box-shadow] duration-200 lg:flex lg:min-h-0 lg:flex-1 lg:flex-col ${
          plannerInteractionMode === "edit"
            ? "planner-selected"
            : "border-app-border/80"
        }`}
      >
        <div className="border-b border-app-border px-4 py-4 sm:px-5 sm:py-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="planner-eyebrow planner-section-label">Itinerary</p>
              <h2 className="planner-title-lg mt-2 text-app-text">Stops and travel flow</h2>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <span
                  className={`rounded-full border px-3 py-1 text-xs font-semibold ${
                    plannerInteractionMode === "edit"
                      ? "planner-pill-active"
                      : "planner-pill"
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
                    ? "cursor-not-allowed border-app-border bg-app-surface-muted text-app-muted"
                    : plannerInteractionMode === "edit"
                      ? "cursor-default border-app-border bg-app-surface-muted text-app-muted"
                      : "planner-button-primary"
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
                  className="planner-button-primary rounded-xl border px-3.5 py-2 text-sm font-semibold transition disabled:cursor-not-allowed"
                >
                  {isSavingDraft ? "Saving..." : "Save"}
                </button>

                <button
                  type="button"
                  data-testid="planner-mode-cancel"
                  onClick={exitEditMode}
                  disabled={isSavingDraft}
                  className="planner-button-secondary rounded-xl border px-3.5 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>

          {isOfflineReadOnly ? (
            <p className="planner-copy-sm tone-warning mt-4 rounded-xl border px-3 py-2 font-medium">
              The cached trip is available to review while offline, but editing stays locked until
              you reconnect.
            </p>
          ) : null}

          <div className="mt-4 rounded-[20px] border border-app-border bg-app-surface-muted/70 p-3.5 sm:p-4">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="planner-title-sm text-app-text">Trip days</h3>
              <span className="planner-meta text-app-muted">
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
                ["stay", "+ Stay", "border border-brand-support/35 bg-brand-support/18 text-brand-primary"],
                ["ferry", "+ Ferry", "border border-state-info-border bg-state-info-surface text-state-info"],
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
                  className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${tone}`}
                >
                  {label}
                </button>
              ))}
            </div>
          ) : null}

          <div className="mt-4 rounded-[20px] border border-app-border bg-app-surface-muted/70 p-3.5 sm:p-4">
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <div className="flex flex-wrap gap-2">
                <span className="planner-pill rounded-full border bg-app-surface px-3 py-1 text-xs font-semibold">
                  {routeMapSummary.totalRoadLegs} road legs
                </span>
                <span className="rounded-full border border-brand-support/35 bg-brand-support/18 px-3 py-1 text-xs font-semibold text-brand-primary">
                  {routeMapSummary.liveRoadLegs} live
                </span>
                <span className="tone-warning rounded-full border px-3 py-1 text-xs font-semibold">
                  {routeMapSummary.fallbackRoadLegs} fallback
                </span>
                {routeMapSummary.pendingRoadLegs > 0 ? (
                  <span className="tone-info rounded-full border px-3 py-1 text-xs font-semibold">
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
      className="h-full w-full rounded-[18px] border border-app-border bg-app-surface"
    />
  );

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
                <h1 className="planner-title-xl text-app-text">{activePanelMeta.label}</h1>
                <span className="planner-pill rounded-full border px-3 py-1 text-xs font-semibold">
                  {activePanelSummary}
                </span>
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
                  {desktopRailPanels.map((panel) => {
                    const active = desktopPanel === panel.id;
                    const disabled = isPanelDisabled(panel.id);

                    return (
                      <button
                        key={panel.id}
                        type="button"
                        data-testid={`desktop-panel-${panel.id}`}
                        onClick={() => selectDesktopPanel(panel.id)}
                        disabled={disabled}
                        className={`flex w-full items-center gap-3 rounded-[18px] border px-3.5 py-3 text-left text-sm font-medium transition ${
                          active
                            ? "border-app-border bg-app-surface text-brand-primary shadow-[0_1px_2px_rgb(var(--color-app-overlay)_/_0.04)]"
                            : disabled
                              ? "cursor-not-allowed border-transparent text-app-muted/60"
                              : "border-transparent text-app-muted hover:border-app-border hover:bg-app-surface hover:text-app-text"
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
                  {renderSharedNotices()}

                  <div className="rounded-[20px] border border-app-border bg-app-surface p-2">
                    <div className="flex gap-2 overflow-x-auto pb-1">
                      {mobilePanels.map((panel) => {
                        const disabled = isPanelDisabled(panel.id);
                        return (
                          <button
                            key={panel.id}
                            type="button"
                            data-testid={`mobile-panel-${panel.id}`}
                            onClick={() => selectMobileTab(panel.id)}
                            disabled={disabled}
                            className={`shrink-0 rounded-[16px] px-3 py-2 text-sm font-semibold transition ${
                              mobileTab === panel.id
                                ? "border border-brand-primary bg-brand-primary text-brand-on-primary"
                                : disabled
                                  ? "cursor-not-allowed border border-app-border bg-app-surface-muted/60 text-app-muted/70"
                                  : "border border-app-border bg-app-surface-muted text-app-muted hover:bg-app-surface"
                            }`}
                          >
                            {panel.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {mobileTab === "trips" ? renderDashboardPanel() : null}
                  {mobileTab === "overview" && loadedTrip ? renderOverviewPanel() : null}
                  {mobileTab === "itinerary" && loadedTrip ? renderItineraryPanel(true) : null}
                </div>
              </section>
            </div>

            <div className="hidden lg:flex lg:min-h-0 lg:flex-col lg:p-6">
              <div className="space-y-4">{renderSharedNotices()}</div>

              <div
                data-testid="desktop-panel-region"
                className={`min-h-0 flex-1 lg:flex lg:flex-col ${
                  desktopPanel === "trips" ? "mt-0" : "mt-5"
                }`}
              >
                {desktopPanel === "trips" ? renderDashboardPanel() : null}
                {desktopPanel === "overview" && loadedTrip ? renderOverviewPanel() : null}
                {desktopPanel === "itinerary" && loadedTrip ? renderItineraryPanel(isDesktopViewport) : null}
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
