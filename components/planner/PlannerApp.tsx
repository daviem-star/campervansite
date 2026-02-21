"use client";

import { useEffect, useMemo, useState } from "react";

import DayStrip from "@/components/planner/DayStrip";
import GapWarnings from "@/components/planner/GapWarnings";
import PlannerMap from "@/components/planner/PlannerMap";
import StopEditorModal from "@/components/planner/StopEditorModal";
import StopTimeline from "@/components/planner/StopTimeline";
import TodayActionsPanel from "@/components/planner/TodayActionsPanel";
import TripHeader from "@/components/planner/TripHeader";
import { todayDateInTimezone } from "@/lib/date";
import {
  formatTripDateRange,
  getCostSummary,
  getGapWarnings,
  getMapData,
  getTodayActions,
  getTripDays,
  sortStopsByOrder,
} from "@/lib/tripDerived";
import { useTripStore } from "@/store/useTripStore";
import { NewTripStop, StopType, TripStop } from "@/types/trip";

type EditorState = {
  isOpen: boolean;
  mode: "create" | "edit";
  type: StopType;
  initialStop: TripStop | null;
};

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
    loadData,
    resetToSeed,
    addStop,
    updateStop,
    deleteStop,
    reorderStops,
  } = useTripStore();

  const [selectedDate, setSelectedDate] = useState(todayDateInTimezone());
  const [editor, setEditor] = useState<EditorState>(defaultEditorState);
  const [mobileMapOpen, setMobileMapOpen] = useState(false);

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

  const sortedStops = useMemo(
    () => (activeTrip ? sortStopsByOrder(activeTrip.stops) : []),
    [activeTrip],
  );

  const tripDays = useMemo(() => (activeTrip ? getTripDays(activeTrip) : []), [activeTrip]);
  const effectiveSelectedDate = tripDays.includes(selectedDate)
    ? selectedDate
    : tripDays[0] ?? selectedDate;

  const mapData = useMemo(() => (activeTrip ? getMapData(activeTrip) : { markers: [], segments: [] }), [
    activeTrip,
  ]);

  const gapWarnings = useMemo(() => (activeTrip ? getGapWarnings(activeTrip) : []), [activeTrip]);
  const todayActions = useMemo(() => (activeTrip ? getTodayActions(activeTrip) : []), [activeTrip]);
  const costSummary = useMemo(
    () => (activeTrip ? getCostSummary(activeTrip) : { totalNights: 0, totalCost: 0 }),
    [activeTrip],
  );

  const onCreateStop = async (stop: NewTripStop) => {
    await addStop(stop);
  };

  const onUpdateStop = async (nextStop: TripStop) => {
    await updateStop(nextStop.id, () => nextStop);
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
            onClick={() => void loadData()}
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
      <div className="min-h-screen bg-slate-100/80 pb-24 lg:pb-0">
        <div className="mx-auto flex w-full max-w-[1750px] flex-col gap-4 p-3 lg:h-screen lg:flex-row lg:p-4">
          <section className="h-full overflow-y-auto rounded-3xl bg-white/30 p-1 lg:w-[46%]">
            <div className="space-y-4 rounded-3xl bg-transparent p-2">
              <TripHeader
                tripName={activeTrip.name}
                homeLabel={activeTrip.home.label}
                dateRangeLabel={formatTripDateRange(activeTrip)}
                totalNights={costSummary.totalNights}
                totalCost={costSummary.totalCost}
                onResetSeed={resetToSeed}
              />

              <TodayActionsPanel actions={todayActions} />

              <GapWarnings warnings={gapWarnings} />

              <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-slate-900">Trip days</h3>
                  <span className="text-xs text-slate-500">Selected: {effectiveSelectedDate}</span>
                </div>
                <DayStrip
                  days={tripDays}
                  selectedDate={effectiveSelectedDate}
                  onSelect={setSelectedDate}
                />
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-slate-900">Itinerary timeline</h3>
                  <span className="text-xs text-slate-500">Drag to reorder</span>
                </div>

                <div className="mb-4 flex flex-wrap gap-2">
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
                    className="rounded-full border border-emerald-300 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700"
                  >
                    + Stay
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setEditor({
                        isOpen: true,
                        mode: "create",
                        type: "ferry",
                        initialStop: null,
                      })
                    }
                    className="rounded-full border border-cyan-300 bg-cyan-50 px-3 py-1.5 text-xs font-semibold text-cyan-700"
                  >
                    + Ferry
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setEditor({
                        isOpen: true,
                        mode: "create",
                        type: "point_of_interest",
                        initialStop: null,
                      })
                    }
                    className="rounded-full border border-orange-300 bg-orange-50 px-3 py-1.5 text-xs font-semibold text-orange-700"
                  >
                    + POI
                  </button>
                </div>

                <StopTimeline
                  stops={sortedStops}
                  selectedDate={effectiveSelectedDate}
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
                  onReorder={reorderStops}
                />
              </div>
            </div>
          </section>

          <aside className="hidden h-full lg:block lg:w-[54%]">
            <div className="h-full overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
              <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
                <h3 className="text-sm font-semibold text-slate-900">Map view</h3>
                <p className="text-xs text-slate-500">
                  Home pin + stays/POIs + ferry ports. Ferry legs are dashed.
                </p>
              </div>
              <PlannerMap markers={mapData.markers} segments={mapData.segments} className="h-[calc(100%-53px)] w-full" />
            </div>
          </aside>
        </div>
      </div>

      <div className="fixed inset-x-4 bottom-4 z-40 lg:hidden">
        <button
          type="button"
          onClick={() => setMobileMapOpen((current) => !current)}
          className="w-full rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white shadow-xl"
        >
          {mobileMapOpen ? "Show Itinerary" : "Show Map"}
        </button>
      </div>

      {mobileMapOpen ? (
        <div className="fixed inset-0 z-40 bg-slate-900/55 lg:hidden">
          <div className="absolute inset-3 overflow-hidden rounded-3xl border border-slate-200 bg-white">
            <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
              <h3 className="text-sm font-semibold text-slate-900">Trip map</h3>
              <button
                type="button"
                onClick={() => setMobileMapOpen(false)}
                className="rounded-lg border border-slate-300 px-3 py-1 text-xs font-semibold text-slate-700"
              >
                Close
              </button>
            </div>
            <PlannerMap markers={mapData.markers} segments={mapData.segments} className="h-[calc(100%-51px)] w-full" />
          </div>
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
