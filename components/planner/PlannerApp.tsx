"use client";

import { startTransition, useEffect, useMemo, useState } from "react";

import AccountPanel from "@/components/planner/AccountPanel";
import DayStrip from "@/components/planner/DayStrip";
import GapWarnings from "@/components/planner/GapWarnings";
import ItinerarySections from "@/components/planner/ItinerarySections";
import PlannerMap from "@/components/planner/PlannerMap";
import StopEditorModal from "@/components/planner/StopEditorModal";
import TodayActionsPanel from "@/components/planner/TodayActionsPanel";
import TravelInsightsPanel from "@/components/planner/TravelInsightsPanel";
import TripHeader from "@/components/planner/TripHeader";
import ValidationWarningsPanel from "@/components/planner/ValidationWarningsPanel";
import { formatDateOnly, todayDateInTimezone } from "@/lib/date";
import { fetchTravelLegEstimates } from "@/lib/routeEstimates";
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

type MobileTab = "today" | "itinerary" | "map";
type SelectionOrigin = "itinerary" | "map" | "system";

const defaultEditorState: EditorState = {
  isOpen: false,
  mode: "create",
  type: "stay",
  initialStop: null,
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
    initialize,
    signInWithMagicLink,
    signOut,
    importLegacyTrips,
    createCloudTripFromCurrent,
    resetToSeed,
    resetToSeedAlignedToToday,
    addStop,
    updateStop,
    deleteStop,
  } = useTripStore();

  const [selectedDate, setSelectedDate] = useState(todayDateInTimezone());
  const [selectedEntity, setSelectedEntity] = useState<SelectedEntity>(null);
  const [selectionOrigin, setSelectionOrigin] = useState<SelectionOrigin>("system");
  const [editor, setEditor] = useState<EditorState>(defaultEditorState);
  const [mobileTab, setMobileTab] = useState<MobileTab>("today");
  const [isDesktopViewport, setIsDesktopViewport] = useState(false);
  const [routeEstimates, setRouteEstimates] = useState<TravelLegEstimate[]>([]);
  const [isEstimatingRoutes, setIsEstimatingRoutes] = useState(false);
  const [routeError, setRouteError] = useState<string | null>(null);

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

  useEffect(() => {
    if (!activeTrip) {
      startTransition(() => {
        setRouteEstimates([]);
        setRouteError(null);
      });
      return;
    }

    let cancelled = false;
    startTransition(() => {
      setIsEstimatingRoutes(true);
    });

    void fetchTravelLegEstimates(activeTrip)
      .then((estimates) => {
        if (cancelled) {
          return;
        }

        setRouteEstimates(estimates);
        setRouteError(null);
      })
      .catch((caught) => {
        if (cancelled) {
          return;
        }

        setRouteEstimates([]);
        setRouteError(
          caught instanceof Error ? caught.message : "Unable to refresh route estimates.",
        );
      })
      .finally(() => {
        if (!cancelled) {
          setIsEstimatingRoutes(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [activeTrip]);

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

  if (isLoading && !activeTrip) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-100 px-4 py-10">
        <p className="text-sm text-slate-600">Loading trip planner...</p>
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

  const renderPlannerMap = (isVisible: boolean) => (
    <PlannerMap
      trip={activeTrip}
      markers={mapData.markers}
      segments={mapData.segments}
      selectedEntity={effectiveSelectedEntity}
      selectionOrigin={selectionOrigin}
      onSelectEntity={onSelectEntityFromMap}
      isVisible={isVisible}
      className="h-full w-full rounded-3xl border border-slate-200 bg-white shadow-sm"
    />
  );

  return (
    <>
      <div className="min-h-screen bg-slate-100/80 pb-6">
        <div className="mx-auto flex w-full max-w-[1750px] flex-col gap-4 p-3 lg:h-screen lg:flex-row lg:items-stretch lg:p-4">
          <section className="rounded-3xl bg-white/30 p-1 lg:h-full lg:w-[46%] lg:overflow-hidden">
            <div className="rounded-3xl p-2 lg:flex lg:h-full lg:min-h-0 lg:flex-col lg:gap-4">
              <AccountPanel
                authStatus={authStatus}
                mode={mode}
                userEmail={user?.email ?? null}
                syncStatus={syncStatus}
                isOfflineReadOnly={isOfflineReadOnly}
                hasLegacyImport={hasLegacyImport}
                statusMessage={statusMessage}
                onSignIn={signInWithMagicLink}
                onSignOut={signOut}
                onImportLegacy={importLegacyTrips}
                onCreateCloudTripFromCurrent={createCloudTripFromCurrent}
              />

              <TripHeader
                tripName={activeTrip.name}
                homeLabel={activeTrip.home.label}
                dateRangeLabel={formatTripDateRange(activeTrip)}
                totalNights={costSummary.totalNights}
                totalCost={costSummary.totalCost}
                showDemoControls={mode === "demo"}
                onResetSeed={resetToSeed}
                onResetSeedAlignedToToday={resetToSeedAlignedToToday}
              />

              <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-2 lg:mt-0 lg:hidden">
                <div className="grid grid-cols-3 gap-2">
                  {([
                    ["today", "Today"],
                    ["itinerary", "Itinerary"],
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

              <div className={`${mobileTab === "today" ? "block" : "hidden"} mt-4 space-y-4 lg:mt-0 lg:block`}>
                {error ? (
                  <div className="rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                    {error}
                  </div>
                ) : null}
                {routeError ? (
                  <div className="rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                    {routeError}
                  </div>
                ) : null}
                {isEstimatingRoutes ? (
                  <div className="rounded-2xl border border-sky-200 bg-sky-50 px-3 py-2 text-sm text-sky-700">
                    Refreshing route estimates and travel buffers...
                  </div>
                ) : null}
                <TodayActionsPanel actions={todayActions} />
                <TravelInsightsPanel estimates={routeEstimates} />
                <ValidationWarningsPanel warnings={validationWarnings} />
                <GapWarnings warnings={gapWarnings} />
              </div>

              <div
                className={`${
                  mobileTab === "itinerary" ? "block" : "hidden"
                } mt-4 space-y-4 lg:mt-0 lg:flex lg:min-h-0 lg:flex-1 lg:flex-col`}
              >
                <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
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
                    <h3 className="text-sm font-semibold text-slate-900">Itinerary</h3>
                    <span className="text-xs text-slate-500">Grouped by campsite stays and travel days</span>
                  </div>

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
                        disabled={isOfflineReadOnly}
                        onClick={() =>
                          setEditor({
                            isOpen: true,
                            mode: "create",
                            type,
                            initialStop: null,
                          })
                        }
                        className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${tone} disabled:cursor-not-allowed disabled:opacity-50`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>

                  <div className="max-h-[52vh] overflow-y-auto pr-1 lg:max-h-none lg:min-h-0 lg:flex-1">
                    <ItinerarySections
                      sections={itinerarySections}
                      selectedDate={effectiveSelectedDate}
                      selectedEntity={effectiveSelectedEntity}
                      isVisible={isDesktopViewport || mobileTab === "itinerary"}
                      isReadOnly={isOfflineReadOnly}
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

              <div className={`${mobileTab === "map" ? "block" : "hidden"} mt-4 lg:hidden`}>
                <div className="h-[68vh]">{renderPlannerMap(mobileTab === "map")}</div>
              </div>
            </div>
          </section>

          <aside className="hidden h-full lg:block lg:w-[54%]">{renderPlannerMap(true)}</aside>
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
