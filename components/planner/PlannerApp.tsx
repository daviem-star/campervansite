"use client";

import { type ReactNode, useEffect, useMemo, useState } from "react";

import DayStrip from "@/components/planner/DayStrip";
import GapWarnings from "@/components/planner/GapWarnings";
import ItinerarySections from "@/components/planner/ItinerarySections";
import PlannerMap from "@/components/planner/PlannerMap";
import StopEditorModal from "@/components/planner/StopEditorModal";
import TodayActionsPanel from "@/components/planner/TodayActionsPanel";
import TripHeader from "@/components/planner/TripHeader";
import { formatDateOnly, todayDateInTimezone } from "@/lib/date";
import {
  formatTripDateRange,
  getCostSummary,
  getGapWarnings,
  getItinerarySections,
  getMapData,
  getSelectedEntityPrimaryDate,
  getTodayActions,
  getTripDays,
} from "@/lib/tripDerived";
import { useTripStore } from "@/store/useTripStore";
import { NewTripStop, SelectedEntity, StopType, TripStop } from "@/types/trip";

type EditorState = {
  isOpen: boolean;
  mode: "create" | "edit";
  type: StopType;
  initialStop: TripStop | null;
};

type PlannerPanelId = "trip_overview" | "today_actions" | "itinerary_map";

type SidebarItem = {
  id: PlannerPanelId;
  label: string;
  hint: string;
  icon: ReactNode;
};

const defaultEditorState: EditorState = {
  isOpen: false,
  mode: "create",
  type: "stay",
  initialStop: null,
};

const sidebarItems: SidebarItem[] = [
  {
    id: "trip_overview",
    label: "Trip overview",
    hint: "Description, details and cost",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" aria-hidden="true">
        <path d="M6 5h12M6 12h12M6 19h7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    id: "today_actions",
    label: "Today actions",
    hint: "Critical tasks due today",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" aria-hidden="true">
        <path
          d="M7 4v3m10-3v3M5 9h14M6 20h12a1 1 0 001-1V8a1 1 0 00-1-1H6a1 1 0 00-1 1v11a1 1 0 001 1z"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    ),
  },
  {
    id: "itinerary_map",
    label: "Itinerary + map",
    hint: "Plan days and route",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" aria-hidden="true">
        <path
          d="M3 6l6-2 6 2 6-2v14l-6 2-6-2-6 2V6z"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path d="M9 4v14M15 6v14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
    ),
  },
];

function PlannerChrome({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-ui-bg text-slate-100 md:h-[100dvh] md:overflow-hidden">
      <div className="mx-auto max-w-[1780px] p-2 md:h-full md:p-4">
        <div className="overflow-hidden rounded-[24px] border border-ui-border bg-ui-surface shadow-[0_30px_80px_rgba(2,6,23,0.7)] md:flex md:h-full md:flex-col">
          <div className="flex items-center gap-2 border-b border-ui-border bg-ui-chrome px-4 py-3">
            <span className="h-3 w-3 rounded-full bg-slate-600" />
            <span className="h-3 w-3 rounded-full bg-slate-600" />
            <span className="h-3 w-3 rounded-full bg-slate-600" />
            <div className="mx-auto w-full max-w-[420px] truncate rounded-xl bg-ui-border-soft px-4 py-1.5 text-center text-sm text-slate-300">
              Campervan Planner
            </div>
            <div className="h-6 w-6 rounded-full bg-amber-400 text-center text-[11px] font-bold leading-6 text-ui-chrome">
              CV
            </div>
          </div>
          <div className="md:min-h-0 md:flex-1">{children}</div>
        </div>
      </div>
    </div>
  );
}

function SidebarNavItem({
  item,
  expanded,
  active,
  onSelect,
}: {
  item: SidebarItem;
  expanded: boolean;
  active: boolean;
  onSelect: (panelId: PlannerPanelId) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onSelect(item.id)}
      className={`flex w-full items-center rounded-xl border px-3 py-2.5 text-left text-sm transition ${
        active
          ? "border-ui-nav-border bg-ui-nav-active text-white"
          : "border-transparent text-slate-300 hover:bg-ui-chrome-hover hover:text-slate-100"
      }`}
      title={item.label}
    >
      <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center">{item.icon}</span>
      <span
        className={`ml-3 truncate text-[14px] font-medium transition-all duration-200 ${
          expanded ? "max-w-[180px] opacity-100" : "max-w-0 opacity-0"
        }`}
      >
        {item.label}
      </span>
    </button>
  );
}

export default function PlannerApp() {
  const {
    data,
    isLoading,
    error,
    loadData,
    addStop,
    updateStop,
    deleteStop,
  } = useTripStore();

  const [selectedDate, setSelectedDate] = useState(todayDateInTimezone());
  const [selectedEntity, setSelectedEntity] = useState<SelectedEntity>(null);
  const [editor, setEditor] = useState<EditorState>(defaultEditorState);
  const [activePanel, setActivePanel] = useState<PlannerPanelId>("itinerary_map");
  const [desktopSidebarExpanded, setDesktopSidebarExpanded] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  useEffect(() => {
    if (!data && !isLoading) {
      void loadData();
    }
  }, [data, isLoading, loadData]);

  const activeTrip = useMemo(() => {
    if (!data) {
      return null;
    }

    return data.trips.find((trip) => trip.id === data.activeTripId) ?? null;
  }, [data]);

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

  const selectEntity = (entity: Exclude<SelectedEntity, null>) => {
    setSelectedEntity(entity);

    if (activeTrip) {
      const entityDate = getSelectedEntityPrimaryDate(activeTrip, entity);
      if (entityDate) {
        setSelectedDate(entityDate);
      }
    }
  };

  const onSelectEntityFromItinerary = (entity: Exclude<SelectedEntity, null>) => {
    selectEntity(entity);
  };

  const onSelectEntityFromMap = (entity: Exclude<SelectedEntity, null>) => {
    selectEntity(entity);
  };

  const setPanel = (panelId: PlannerPanelId) => {
    setActivePanel(panelId);
    setMobileSidebarOpen(false);
  };

  if (isLoading && !activeTrip) {
    return (
      <PlannerChrome>
        <div className="flex min-h-[360px] items-center justify-center px-4 py-10">
          <p className="text-sm text-slate-300">Loading trip planner...</p>
        </div>
      </PlannerChrome>
    );
  }

  if (!activeTrip) {
    return (
      <PlannerChrome>
        <div className="flex min-h-[360px] items-center justify-center px-4 py-10">
          <div className="rounded-2xl border border-ui-border bg-ui-raised p-6 text-center shadow-sm">
            <p className="text-sm text-slate-300">{error ?? "No trip loaded."}</p>
            <button
              type="button"
              onClick={() => void loadData()}
              className="mt-3 rounded-xl border border-ui-border-soft bg-ui-overlay px-4 py-2 text-sm font-semibold text-white transition hover:border-slate-300"
            >
              Reload
            </button>
          </div>
        </div>
      </PlannerChrome>
    );
  }

  const renderPlannerMap = (isVisible: boolean) => (
    <PlannerMap
      trip={activeTrip}
      markers={mapData.markers}
      segments={mapData.segments}
      selectedEntity={effectiveSelectedEntity}
      onSelectEntity={onSelectEntityFromMap}
      isVisible={isVisible}
      className="h-full w-full rounded-3xl border border-slate-700/80 bg-ui-map shadow-[0_20px_45px_rgba(2,6,23,0.45)]"
    />
  );

  return (
    <>
      <PlannerChrome>
        <div className="relative flex min-h-[720px] md:h-full md:min-h-0">
          <aside
            className={`hidden border-r border-ui-border bg-ui-surface-alt py-4 transition-[width] duration-200 md:block md:h-full md:min-h-0 ${
              desktopSidebarExpanded ? "md:w-[264px]" : "md:w-[84px]"
            }`}
            onMouseEnter={() => setDesktopSidebarExpanded(true)}
            onMouseLeave={() => setDesktopSidebarExpanded(false)}
            onFocusCapture={() => setDesktopSidebarExpanded(true)}
          >
            <div className="mb-4 px-3">
              <div className="flex h-10 items-center">
                <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-cyan-400 via-indigo-500 to-fuchsia-600" />
                <span
                  className={`ml-3 overflow-hidden whitespace-nowrap text-lg font-semibold tracking-tight text-slate-100 transition-all duration-200 ${
                    desktopSidebarExpanded ? "max-w-[160px] opacity-100" : "max-w-0 opacity-0"
                  }`}
                >
                  Planner
                </span>
              </div>
            </div>

            <nav className="space-y-1.5 px-2">
              {sidebarItems.map((item) => (
                <SidebarNavItem
                  key={item.id}
                  item={item}
                  expanded={desktopSidebarExpanded}
                  active={activePanel === item.id}
                  onSelect={setPanel}
                />
              ))}
            </nav>

            <div
              className={`mt-4 overflow-hidden rounded-xl border border-ui-border bg-ui-raised transition-all duration-200 ${
                desktopSidebarExpanded ? "mx-2 max-h-52 p-3 opacity-100" : "mx-0 max-h-0 p-0 opacity-0"
              }`}
            >
              <p className="mb-1 text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">Current view</p>
              <p className="text-sm text-slate-300">
                {sidebarItems.find((item) => item.id === activePanel)?.hint}
              </p>
            </div>
          </aside>

          <main className="flex min-w-0 flex-1 flex-col md:min-h-0">
            <div className="flex items-center gap-3 border-b border-slate-800/80 px-3 py-3 md:px-5">
              <button
                type="button"
                onClick={() => setMobileSidebarOpen(true)}
                className="rounded-lg border border-slate-700 bg-ui-chrome-soft p-2 text-slate-200 md:hidden"
                aria-label="Open menu"
              >
                <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" aria-hidden="true">
                  <path d="M4 6h16M4 12h16M4 18h16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                </svg>
              </button>

              <div className="min-w-0">
                <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">Planner panel</p>
                <p className="truncate text-sm font-semibold text-slate-100">
                  {sidebarItems.find((item) => item.id === activePanel)?.label}
                </p>
              </div>
            </div>

            <section className="flex-1 min-h-0 p-3 md:overflow-hidden md:p-4">
              {activePanel === "trip_overview" ? (
                <div className="mx-auto max-w-[980px] space-y-4 md:h-full md:overflow-y-auto md:pr-1">
                  <div>
                    <TripHeader
                      tripName={activeTrip.name}
                      homeLabel={activeTrip.home.label}
                      dateRangeLabel={formatTripDateRange(activeTrip)}
                      totalNights={costSummary.totalNights}
                      totalCost={costSummary.totalCost}
                    />
                    <div className="rounded-2xl border border-ui-border bg-ui-raised px-4 py-3 text-sm text-slate-300">
                      This panel centralizes trip description, details, and cost summary.
                    </div>
                  </div>
                </div>
              ) : null}

              {activePanel === "today_actions" ? (
                <div className="mx-auto max-w-[980px] space-y-4 md:h-full md:overflow-y-auto md:pr-1">
                  <div>
                    <TodayActionsPanel actions={todayActions} />
                    <GapWarnings warnings={gapWarnings} />
                  </div>
                </div>
              ) : null}

              {activePanel === "itinerary_map" ? (
                <div className="flex min-h-[640px] flex-col gap-4 md:h-full md:min-h-0 md:flex-row md:items-stretch">
                  <section className="rounded-3xl border border-slate-800/70 bg-ui-panel p-1 md:h-full md:min-h-0 md:w-[52%] md:overflow-hidden">
                    <div className="rounded-3xl p-2 md:flex md:h-full md:min-h-0 md:flex-col md:gap-4">
                      <div className="rounded-2xl border border-ui-border bg-ui-raised p-3 shadow-sm">
                        <div className="mb-3 flex items-center justify-between">
                          <h3 className="text-sm font-semibold text-slate-100">Trip days</h3>
                          <span className="text-xs text-slate-400">
                            Selected: {formatDateOnly(effectiveSelectedDate)}
                          </span>
                        </div>
                        <DayStrip
                          days={tripDays}
                          selectedDate={effectiveSelectedDate}
                          onSelect={onSelectDate}
                        />
                      </div>

                      <div className="rounded-2xl border border-ui-border bg-ui-raised p-3 shadow-sm md:flex md:min-h-0 md:flex-1 md:flex-col">
                        <div className="mb-3 flex items-center justify-between gap-2">
                          <h3 className="text-sm font-semibold text-slate-100">Itinerary</h3>
                          <span className="text-xs text-slate-400">Grouped by campsite stays and travel days</span>
                        </div>

                        <div className="mb-4">
                          <button
                            type="button"
                            onClick={() =>
                              setEditor({
                                isOpen: true,
                                mode: "create",
                                type: "stay",
                                initialStop: null,
                              })
                            }
                            className="rounded-full border border-ui-accent-border bg-ui-accent-strong px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-ui-accent-deep"
                          >
                            Add item
                          </button>
                        </div>

                        <div className="min-h-0 flex-1 overflow-y-auto pr-1">
                          <ItinerarySections
                            sections={itinerarySections}
                            selectedDate={effectiveSelectedDate}
                            selectedEntity={effectiveSelectedEntity}
                            isVisible={activePanel === "itinerary_map"}
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
                              const confirmed = window.confirm(`Delete \"${stop.title}\"?`);
                              if (confirmed) {
                                void deleteStop(stop.id);
                              }
                            }}
                          />
                        </div>
                      </div>
                    </div>
                  </section>

                  <aside className="md:h-full md:min-h-0 md:w-[48%]">
                    <div className="h-[66vh] md:h-full">{renderPlannerMap(activePanel === "itinerary_map")}</div>
                  </aside>
                </div>
              ) : null}
            </section>
          </main>
        </div>
      </PlannerChrome>

      {mobileSidebarOpen ? (
        <div className="fixed inset-0 z-50 bg-black/65 md:hidden" onClick={() => setMobileSidebarOpen(false)}>
          <aside
            className="h-full w-[82%] max-w-[320px] border-r border-ui-border bg-ui-surface-alt p-4"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-400">Navigation</p>
              <button
                type="button"
                onClick={() => setMobileSidebarOpen(false)}
                className="rounded-lg border border-ui-border px-2 py-1 text-xs text-slate-300 transition hover:border-slate-500"
              >
                Close
              </button>
            </div>

            <nav className="space-y-1.5">
              {sidebarItems.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setPanel(item.id)}
                  className={`w-full rounded-xl border px-3 py-2.5 text-left text-sm transition ${
                    activePanel === item.id
                      ? "border-ui-nav-border bg-ui-nav-active text-white"
                      : "border-transparent text-slate-300 hover:bg-ui-chrome-hover hover:text-slate-100"
                  }`}
                >
                  <span className="flex items-center gap-2 font-medium">
                    <span className="inline-flex h-5 w-5 items-center justify-center">{item.icon}</span>
                    {item.label}
                  </span>
                  <span className="mt-1 block pl-7 text-xs text-slate-400">{item.hint}</span>
                </button>
              ))}
            </nav>
          </aside>
        </div>
      ) : null}

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
