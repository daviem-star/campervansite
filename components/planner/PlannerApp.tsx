"use client";

import { startTransition, useEffect, useMemo, useRef, useState } from "react";

import AccountPanel from "@/components/planner/AccountPanel";
import DayStrip from "@/components/planner/DayStrip";
import FirstTripSetupPanel from "@/components/planner/FirstTripSetupPanel";
import GapWarnings from "@/components/planner/GapWarnings";
import ItinerarySections from "@/components/planner/ItinerarySections";
import PlannerAuthGate from "@/components/planner/PlannerAuthGate";
import PlannerMap from "@/components/planner/PlannerMap";
import StopEditorModal from "@/components/planner/StopEditorModal";
import TodayActionsPanel from "@/components/planner/TodayActionsPanel";
import TravelInsightsPanel from "@/components/planner/TravelInsightsPanel";
import TripHeader from "@/components/planner/TripHeader";
import ValidationWarningsPanel from "@/components/planner/ValidationWarningsPanel";
import { formatDateOnly, todayDateInTimezone } from "@/lib/date";
import { readCachedRouteEstimateSet, writeCachedRouteEstimateSet } from "@/lib/routeEstimateCache";
import {
  buildTripTravelLegPayload,
  fetchTravelLegEstimates,
  mergeTravelEstimateMetadata,
} from "@/lib/routeEstimates";
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
} from "@/types/trip";

type EditorState = {
  isOpen: boolean;
  mode: "create" | "edit";
  type: StopType;
  initialStop: TripStop | null;
};

type MobileTab = "today" | "itinerary" | "overview" | "map";
type DesktopPanel = "itinerary" | "overview" | "today";
type SelectionOrigin = "itinerary" | "map" | "system";
type RouteInsightsState = "fresh" | "stale" | "unavailable";

const defaultEditorState: EditorState = {
  isOpen: false,
  mode: "create",
  type: "stay",
  initialStop: null,
};

const syncLabel = {
  idle: "Idle",
  saving: "Saving",
  saved: "Saved",
  offline: "Offline",
  error: "Needs attention",
} as const;

const syncTone = {
  idle: "border-slate-200 bg-slate-100 text-slate-700",
  saving: "border-sky-200 bg-sky-50 text-sky-700",
  saved: "border-emerald-200 bg-emerald-50 text-emerald-700",
  offline: "border-amber-200 bg-amber-50 text-amber-800",
  error: "border-rose-200 bg-rose-50 text-rose-700",
} as const;

const panelMeta: Array<{
  id: DesktopPanel;
  label: string;
  detail: string;
}> = [
  {
    id: "itinerary",
    label: "Itinerary",
    detail: "Browse the trip timeline and unlock edit mode when you want to change it.",
  },
  {
    id: "overview",
    label: "Overview",
    detail: "Trip summary, account controls, travel insights, and planning warnings.",
  },
  {
    id: "today",
    label: "Today",
    detail: "Travel-day actions and checks that matter while you are on the road.",
  },
];

const mobilePanelMeta: Record<MobileTab, { label: string; detail: string }> = {
  today: {
    label: "Today",
    detail: "Travel-day actions and checks that matter while you are on the road.",
  },
  itinerary: {
    label: "Itinerary",
    detail: "Browse the trip timeline and unlock edit mode when you want to change it.",
  },
  overview: {
    label: "Overview",
    detail: "Trip summary, account controls, travel insights, and planning warnings.",
  },
  map: {
    label: "Map",
    detail: "See the whole route, reset to the trip overview, and inspect selected stops.",
  },
};

const panelIcon = (panel: DesktopPanel) => {
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
    isLoading,
    error,
    statusMessage,
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
    startWithExampleTrip,
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
    () => (activeTrip ? getMapData(activeTrip) : { markers: [], segments: [] }),
    [activeTrip],
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

  const canEditTrip = plannerInteractionMode === "edit" && !isOfflineReadOnly;
  const activePanelMeta = panelMeta.find((panel) => panel.id === desktopPanel) ?? panelMeta[0];
  const activeToolbarMeta = isDesktopViewport ? activePanelMeta : mobilePanelMeta[mobileTab];

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

  const renderSharedNotices = () => (
    <>
      {error ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          {error}
        </div>
      ) : null}
      {statusMessage ? (
        <div className="rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-800">
          {statusMessage}
        </div>
      ) : null}
    </>
  );

  const renderToolbar = () => (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
            {activeToolbarMeta.label}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <h2 className="text-lg font-semibold text-slate-950">{activeTrip?.name}</h2>
            <span
              className={`rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${syncTone[syncStatus]}`}
            >
              {syncLabel[syncStatus]}
            </span>
            <span
              className={`rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${
                plannerInteractionMode === "edit"
                  ? "border-slate-900 bg-slate-900 text-white"
                  : "border-slate-200 bg-slate-50 text-slate-700"
              }`}
            >
              {plannerInteractionMode === "edit" ? "Edit mode" : "View mode"}
            </span>
          </div>
          <p className="mt-2 text-sm text-slate-600">{activeToolbarMeta.detail}</p>
        </div>

        <button
          type="button"
          onClick={() => {
            if (plannerInteractionMode === "edit") {
              setEditor(defaultEditorState);
              setPlannerInteractionMode("view");
              return;
            }

            setPlannerInteractionMode("edit");
          }}
          disabled={isOfflineReadOnly}
          className={`rounded-2xl px-4 py-2 text-sm font-semibold transition ${
            isOfflineReadOnly
              ? "cursor-not-allowed border border-slate-200 bg-slate-100 text-slate-400"
              : plannerInteractionMode === "edit"
                ? "border border-slate-300 bg-white text-slate-700 hover:bg-slate-100"
                : "bg-slate-950 text-white hover:bg-slate-800"
          }`}
        >
          {plannerInteractionMode === "edit" ? "Finish editing" : "Edit trip"}
        </button>
      </div>

      {isOfflineReadOnly ? (
        <p className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800">
          The cached trip is available to review while offline, but editing stays locked until you
          reconnect.
        </p>
      ) : null}
    </div>
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
        showDemoControls={mode === "demo"}
        onResetSeed={resetToSeed}
        onResetSeedAlignedToToday={resetToSeedAlignedToToday}
      />

      <AccountPanel
        authStatus={authStatus}
        mode={mode}
        userEmail={user?.email ?? null}
        syncStatus={syncStatus}
        isOfflineReadOnly={isOfflineReadOnly}
        hasLegacyImport={hasLegacyImport}
        statusMessage={null}
        onSignIn={signInWithMagicLink}
        onSignInAsTestUser={signInAsTestUser}
        onSignOut={signOut}
        onImportLegacy={importLegacyTrips}
        onCreateCloudTripFromCurrent={createCloudTripFromCurrent}
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

  const renderItineraryPanel = (isVisible: boolean) => (
    <div className="space-y-4 lg:flex lg:min-h-0 lg:flex-1 lg:flex-col">
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
        <div className="mb-3 flex items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">Itinerary</h3>
            <p className="text-xs text-slate-500">
              Grouped by campsite stays and the travel days around them
            </p>
          </div>
        </div>

        <div className="mb-4 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-600">
          {canEditTrip
            ? "Edit mode is unlocked. Add, update, and remove itinerary items from this view."
            : "View mode is active. Use Edit trip to unlock changes without accidentally altering the route."}
        </div>

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
          className="max-h-[52vh] overflow-y-auto pr-1 lg:min-h-0 lg:flex-1 lg:overflow-y-auto"
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
        statusMessage={statusMessage}
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
              <nav className="hidden w-[82px] flex-none rounded-3xl border border-slate-200 bg-white p-2 shadow-sm lg:flex lg:flex-col lg:gap-2">
                {panelMeta.map((panel) => {
                  const active = desktopPanel === panel.id;
                  return (
                    <button
                      key={panel.id}
                      type="button"
                      data-testid={`desktop-panel-${panel.id}`}
                      onClick={() => setDesktopPanel(panel.id)}
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
              </nav>

              <div className="min-h-0 min-w-0 lg:flex lg:flex-1 lg:flex-col lg:gap-4">
                {renderSharedNotices()}

                <div className="space-y-4 lg:hidden">
                  {renderToolbar()}

                  <div className="rounded-2xl border border-slate-200 bg-white p-2">
                    <div className="grid grid-cols-4 gap-2">
                      {([
                        ["today", "Today"],
                        ["itinerary", "Itinerary"],
                        ["overview", "Overview"],
                        ["map", "Map"],
                      ] as const).map(([tabId, label]) => (
                        <button
                          key={tabId}
                          type="button"
                          onClick={() => setMobileTab(tabId)}
                          className={`rounded-xl px-3 py-2 text-sm font-semibold transition ${
                            mobileTab === tabId
                              ? "bg-slate-900 text-white"
                              : "border border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100"
                          }`}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {mobileTab === "today" ? renderTodayPanel() : null}
                  {mobileTab === "overview" ? renderOverviewPanel() : null}
                  {mobileTab === "itinerary" ? renderItineraryPanel(mobileTab === "itinerary") : null}
                  {mobileTab === "map" ? (
                    <div className="h-[68vh]">{renderPlannerMap(mobileTab === "map")}</div>
                  ) : null}
                </div>

                <div className="hidden lg:flex lg:min-h-0 lg:flex-1 lg:flex-col lg:gap-4">
                  {renderToolbar()}

                  <div className="min-h-0 flex-1">
                    {desktopPanel === "overview" ? renderOverviewPanel() : null}
                    {desktopPanel === "today" ? renderTodayPanel() : null}
                    {desktopPanel === "itinerary"
                      ? renderItineraryPanel(isDesktopViewport || mobileTab === "itinerary")
                      : null}
                  </div>
                </div>
              </div>
            </div>
          </section>

          <aside className="hidden h-full lg:block lg:min-h-0 lg:w-[54%]">{renderPlannerMap(true)}</aside>
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
    </>
  );
}
