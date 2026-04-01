"use client";

import { startTransition, useEffect, useMemo, useRef, useState } from "react";

import AccountStatusControl from "@/components/planner/AccountStatusControl";
import DayStrip from "@/components/planner/DayStrip";
import FirstTripSetupPanel from "@/components/planner/FirstTripSetupPanel";
import GapWarnings from "@/components/planner/GapWarnings";
import ItinerarySections from "@/components/planner/ItinerarySections";
import PlannerAuthGate from "@/components/planner/PlannerAuthGate";
import PlannerMap from "@/components/planner/PlannerMap";
import StopEditorModal from "@/components/planner/StopEditorModal";
import TodayActionsPanel from "@/components/planner/TodayActionsPanel";
import TravelInsightsPanel from "@/components/planner/TravelInsightsPanel";
import TripCreateModal from "@/components/planner/TripCreateModal";
import TripHeader from "@/components/planner/TripHeader";
import TripRenameModal from "@/components/planner/TripRenameModal";
import TripsPanel from "@/components/planner/TripsPanel";
import ValidationWarningsPanel from "@/components/planner/ValidationWarningsPanel";
import { formatDateOnly, todayDateInTimezone } from "@/lib/date";
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
} from "@/lib/tripDerived";
import { useTripStore } from "@/store/useTripStore";
import {
  NewTripStop,
  SelectedEntity,
  StopType,
  TravelLegEstimate,
  TripStop,
  TripSummary,
} from "@/types/trip";

type EditorState = {
  isOpen: boolean;
  mode: "create" | "edit";
  type: StopType;
  initialStop: TripStop | null;
};

type MobileTab = "trips" | "today" | "itinerary" | "overview" | "map";
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
  { id: "trips", label: "Trips" },
  { id: "overview", label: "Overview" },
  { id: "itinerary", label: "Itinerary" },
  { id: "today", label: "Today" },
];

const mobilePanelMeta: Array<{
  id: MobileTab;
  label: string;
}> = [
  { id: "trips", label: "Trips" },
  { id: "overview", label: "Overview" },
  { id: "itinerary", label: "Itinerary" },
  { id: "today", label: "Today" },
  { id: "map", label: "Map" },
];

const noticeToneClass = {
  info: "border-sky-200 bg-sky-50 text-sky-800",
  success: "border-emerald-200 bg-emerald-50 text-emerald-800",
  warning: "border-amber-200 bg-amber-50 text-amber-800",
} as const;

const panelIcon = (panel: DesktopPanel) => {
  if (panel === "trips") {
    return (
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
        <rect x="4" y="5" width="16" height="14" rx="2.2" />
        <path d="M8 9h8" strokeLinecap="round" />
        <path d="M8 13h5" strokeLinecap="round" />
      </svg>
    );
  }

  if (panel === "itinerary") {
    return (
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
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
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
        <rect x="4" y="4" width="7" height="7" rx="1.6" />
        <rect x="13" y="4" width="7" height="4" rx="1.4" />
        <rect x="13" y="10" width="7" height="10" rx="1.6" />
        <rect x="4" y="13" width="7" height="7" rx="1.6" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M5 12h14" strokeLinecap="round" />
      <path d="M12 5v14" strokeLinecap="round" />
      <circle cx="12" cy="12" r="8" />
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
    addStop,
    updateStop,
    deleteStop,
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

  const isCloudTripLibraryAvailable = authStatus === "signed_in" && mode === "cloud";
  const desktopTripsPanel = isCloudTripLibraryAvailable
    ? desktopPanelMeta.find((panel) => panel.id === "trips") ?? null
    : null;
  const desktopViewPanels = desktopPanelMeta.filter((panel) => panel.id !== "trips");
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
    if (!activeTrip) {
      return {
        requests: [],
        signature: "",
      };
    }

    return buildTripTravelLegPayload(activeTrip);
  }, [activeTrip]);

  const routeRequests = routePayload.requests;
  const routeSignature = routePayload.signature;
  const routeRequestsRef = useRef(routeRequests);
  const activeTripRef = useRef(activeTrip);

  useEffect(() => {
    routeRequestsRef.current = routeRequests;
    activeTripRef.current = activeTrip;
  }, [activeTrip, routeRequests]);

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

  const tripDays = useMemo(() => (activeTrip ? getTripDays(activeTrip) : []), [activeTrip]);
  const effectiveSelectedDate = tripDays.includes(selectedDate)
    ? selectedDate
    : tripDays[0] ?? selectedDate;

  const itinerarySections = useMemo(
    () => (activeTrip ? getItinerarySections(activeTrip) : []),
    [activeTrip],
  );

  const mapData = useMemo(
    () => (activeTrip ? getMapData(activeTrip, routeEstimates) : { markers: [], segments: [] }),
    [activeTrip, routeEstimates],
  );

  const gapWarnings = useMemo(() => (activeTrip ? getGapWarnings(activeTrip) : []), [activeTrip]);
  const todayActions = useMemo(() => (activeTrip ? getTodayActions(activeTrip) : []), [activeTrip]);
  const costSummary = useMemo(
    () => (activeTrip ? getCostSummary(activeTrip) : { totalNights: 0, totalCost: 0 }),
    [activeTrip],
  );
  const validationWarnings = useMemo(
    () => (activeTrip ? getValidationWarnings(activeTrip, routeEstimates) : []),
    [activeTrip, routeEstimates],
  );
  const effectiveSelectedEntity = useMemo<SelectedEntity>(() => {
    if (!activeTrip || !selectedEntity) {
      return null;
    }

    return activeTrip.stops.some((stop) => stop.id === selectedEntity.stopId)
      ? selectedEntity
      : null;
  }, [activeTrip, selectedEntity]);
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

  const exitEditMode = () => {
    setEditor(defaultEditorState);
    setPlannerInteractionMode("view");
  };

  const onCreateStop = async (stop: NewTripStop) => {
    await addStop(stop);
  };

  const onUpdateStop = async (nextStop: TripStop) => {
    await updateStop(nextStop.id, () => nextStop);
  };

  const onSelectDate = (date: string) => {
    setSelectedDate(date);
  };

  const selectEntity = (entity: Exclude<SelectedEntity, null>, origin: SelectionOrigin) => {
    setSelectionOrigin(origin);
    setSelectedEntity(entity);

    if (activeTrip) {
      const entityDate = getSelectedEntityPrimaryDate(activeTrip, entity);
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
          setPlannerInteractionMode("edit");
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

  const renderSharedNotices = () => (
    <>
      {error ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          {error}
        </div>
      ) : null}
      {inlineNotice ? (
        <div
          data-testid="planner-inline-notice"
          className={`rounded-2xl border px-4 py-3 text-sm ${noticeToneClass[inlineNotice.tone]}`}
        >
          {inlineNotice.text}
        </div>
      ) : null}
    </>
  );

  const renderOverviewPanel = () => (
    <div
      data-testid="overview-scroll-region"
      className="space-y-4 pr-1 lg:flex lg:h-full lg:min-h-0 lg:flex-col lg:gap-4 lg:space-y-0 lg:overflow-y-auto"
    >
      <TripHeader
        tripName={activeTrip?.name ?? ""}
        homeLabel={activeTrip?.home.label ?? ""}
        dateRangeLabel={activeTrip ? formatTripDateRange(activeTrip) : ""}
        totalNights={costSummary.totalNights}
        totalCost={costSummary.totalCost}
      />

      <TravelInsightsPanel
        estimates={routeEstimates}
        legCount={routeRequests.length}
        status={routeInsightsState}
        statusMessage={routeStatusMessage}
        isRefreshing={isEstimatingRoutes}
      />
      <ValidationWarningsPanel warnings={validationWarnings} />
      <GapWarnings warnings={gapWarnings} />
    </div>
  );

  const renderTodayPanel = () => (
    <div
      data-testid="today-scroll-region"
      className="space-y-4 pr-1 lg:flex lg:h-full lg:min-h-0 lg:flex-col lg:gap-4 lg:space-y-0 lg:overflow-y-auto"
    >
      <TodayActionsPanel actions={todayActions} />
    </div>
  );

  const renderTripsPanel = () => (
    <div data-testid="desktop-panel-trips-region" className="lg:flex lg:h-full lg:min-h-0 lg:flex-col">
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
    </div>
  );

  const renderItineraryPanel = (isVisible: boolean) => (
    <div
      data-testid="desktop-panel-itinerary-region"
      className="space-y-4 lg:flex lg:h-full lg:min-h-0 lg:flex-1 lg:flex-col"
    >
      <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm lg:flex-none">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-900">Trip days</h3>
          <span className="text-xs text-slate-500">
            Selected: {formatDateOnly(effectiveSelectedDate)}
          </span>
        </div>
        <DayStrip
          days={tripDays}
          selectedDate={effectiveSelectedDate}
          onSelect={onSelectDate}
        />
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm lg:flex lg:min-h-0 lg:flex-1 lg:flex-col">
        <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-sm font-semibold text-slate-900">Itinerary</h3>
            </div>
            <p className="mt-2 text-xs text-slate-500">
              Grouped by campsite stays and the travel days around them.
            </p>
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
                    ? "Edit mode is active. Use Cancel to return to view-only review."
                    : "View mode is active. Click to switch to Edit mode and change this itinerary."
              }
              onClick={() => {
                if (plannerInteractionMode === "view") {
                  setPlannerInteractionMode("edit");
                }
              }}
              disabled={isOfflineReadOnly}
              className={`rounded-2xl border px-4 py-2 text-sm font-semibold transition ${
                isOfflineReadOnly
                  ? "cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400"
                  : plannerInteractionMode === "edit"
                    ? "cursor-default border-slate-900 bg-slate-900 text-white"
                    : "border-slate-900 bg-slate-900 text-white hover:bg-slate-800"
              }`}
            >
              {plannerInteractionMode === "edit" ? "Edit mode" : "View mode"}
            </button>

            {plannerInteractionMode === "edit" ? (
              <button
                type="button"
                data-testid="planner-mode-cancel"
                onClick={exitEditMode}
                className="rounded-2xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
              >
                Cancel
              </button>
            ) : null}
          </div>
        </div>

        {isOfflineReadOnly ? (
          <p className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800">
            The cached trip is available to review while offline, but editing stays locked until
            you reconnect.
          </p>
        ) : null}

        {canEditTrip ? (
          <div className="mb-4 flex flex-wrap gap-2">
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
                onClick={() =>
                  setEditor({
                    isOpen: true,
                    mode: "create",
                    type,
                    initialStop: null,
                  })
                }
                data-testid={`planner-add-${type}`}
                className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${tone}`}
              >
                {label}
              </button>
            ))}
          </div>
        ) : null}

        <div
          data-testid="desktop-itinerary-scroll-region"
          data-itinerary-scroll-container="true"
          className="max-h-[52vh] overflow-y-auto pr-1 lg:max-h-none lg:min-h-0 lg:flex-1 lg:overflow-y-auto"
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
                void deleteStop(stop.id);
              }
            }}
          />
        </div>
      </div>
    </div>
  );

  const renderPlannerMap = (isVisible: boolean) => (
    <PlannerMap
      trip={activeTrip!}
      markers={mapData.markers}
      segments={mapData.segments}
      routeSummary={routeMapSummary}
      selectedEntity={effectiveSelectedEntity}
      selectionOrigin={selectionOrigin}
      onSelectEntity={onSelectEntityFromMap}
      isVisible={isVisible}
      className="h-full w-full rounded-3xl border border-slate-200 bg-white shadow-sm"
    />
  );

  if (isLoading && !activeTrip && authStatus === "checking") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-100 px-4 py-10">
        <p className="text-sm text-slate-600">Loading trip planner...</p>
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
        <p className="text-sm text-slate-600">Preparing your trip workspace...</p>
      </div>
    );
  }

  if (!activeTrip) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-100 px-4 py-10">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-sm">
          <p className="text-sm text-slate-700">{error ?? "No trip loaded."}</p>
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
      <div className="min-h-screen bg-slate-100/80 pb-6 lg:h-[100dvh] lg:overflow-hidden lg:pb-0">
        <div className="mx-auto flex h-full w-full max-w-[1760px] flex-col gap-4 p-3 lg:flex-row lg:items-stretch lg:p-4">
          <section className="rounded-3xl bg-white/30 p-1 lg:h-full lg:w-[46%] lg:overflow-hidden">
            <div className="rounded-3xl p-2 lg:flex lg:h-full lg:min-h-0 lg:gap-3">
              <div
                data-testid="planner-rail-column"
                className="hidden w-[104px] flex-none lg:flex lg:flex-col lg:gap-3"
              >
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

                {desktopTripsPanel ? (
                  <button
                    type="button"
                    data-testid="desktop-panel-trips"
                    onClick={() => selectDesktopPanel(desktopTripsPanel.id)}
                    className={`rounded-3xl border p-3 text-left shadow-sm transition ${
                      desktopPanel === desktopTripsPanel.id
                        ? "border-slate-950 bg-slate-950 text-white"
                        : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50"
                    }`}
                    title={desktopTripsPanel.label}
                  >
                    <div className="flex flex-col items-center gap-2 text-center">
                      {panelIcon(desktopTripsPanel.id)}
                      <div>
                        <span className="block text-[11px] font-semibold">
                          {desktopTripsPanel.label}
                        </span>
                        <span
                          className={`block text-[10px] ${
                            desktopPanel === desktopTripsPanel.id
                              ? "text-white/70"
                              : "text-slate-500"
                          }`}
                        >
                          Workspace
                        </span>
                      </div>
                    </div>
                  </button>
                ) : null}

                <nav className="flex-1 rounded-3xl border border-slate-200 bg-white p-2 shadow-sm">
                  <p className="px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                    Active trip
                  </p>

                  <div className="mt-2 flex h-full flex-col gap-2">
                    {desktopViewPanels.map((panel) => {
                      const active = desktopPanel === panel.id;
                      return (
                        <button
                          key={panel.id}
                          type="button"
                          data-testid={`desktop-panel-${panel.id}`}
                          onClick={() => selectDesktopPanel(panel.id)}
                          className={`group flex flex-col items-center gap-2 rounded-2xl px-2 py-3 text-center transition ${
                            active
                              ? "bg-slate-950 text-white"
                              : "text-slate-600 hover:bg-slate-100 hover:text-slate-950"
                          }`}
                          title={panel.label}
                        >
                          {panelIcon(panel.id)}
                          <span className="text-[11px] font-semibold">{panel.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </nav>
              </div>

              <div className="min-h-0 min-w-0 lg:flex lg:flex-1 lg:flex-col lg:gap-4">
                <div className="space-y-4 lg:hidden">
                  <div className="flex items-start justify-start">
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

                  {renderSharedNotices()}

                  <div className="rounded-2xl border border-slate-200 bg-white p-2">
                    {mobileTripsPanel ? (
                      <div className="mb-2">
                        <button
                          type="button"
                          data-testid="mobile-panel-trips"
                          onClick={() => selectMobileTab(mobileTripsPanel.id)}
                          className={`w-full rounded-xl px-3 py-2 text-sm font-semibold transition ${
                            mobileTab === mobileTripsPanel.id
                              ? "bg-slate-900 text-white"
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
                          className={`shrink-0 rounded-xl px-3 py-2 text-sm font-semibold transition ${
                            mobileTab === panel.id
                              ? "bg-slate-900 text-white"
                              : "border border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100"
                          }`}
                        >
                          {panel.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {mobileTab === "trips" && isCloudTripLibraryAvailable ? renderTripsPanel() : null}
                  {mobileTab === "today" ? renderTodayPanel() : null}
                  {mobileTab === "overview" ? renderOverviewPanel() : null}
                  {mobileTab === "itinerary" ? renderItineraryPanel(true) : null}
                  {mobileTab === "map" ? <div className="h-[68vh]">{renderPlannerMap(true)}</div> : null}
                </div>

                <div className="hidden lg:flex lg:min-h-0 lg:flex-1 lg:flex-col lg:gap-4">
                  {renderSharedNotices()}

                  <div data-testid="desktop-panel-region" className="min-h-0 flex-1 lg:flex lg:flex-col">
                    {desktopPanel === "trips" && isCloudTripLibraryAvailable ? renderTripsPanel() : null}
                    {desktopPanel === "overview" ? renderOverviewPanel() : null}
                    {desktopPanel === "today" ? renderTodayPanel() : null}
                    {desktopPanel === "itinerary" ? renderItineraryPanel(isDesktopViewport) : null}
                  </div>
                </div>
              </div>
            </div>
          </section>

          <aside className="hidden h-full lg:block lg:min-h-0 lg:w-[54%]">
            <div className="h-full rounded-3xl bg-white/30 p-1">
              <div className="h-full rounded-3xl p-2">{renderPlannerMap(true)}</div>
            </div>
          </aside>
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
