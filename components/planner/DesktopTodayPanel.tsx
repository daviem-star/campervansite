"use client";

import TodayActionsPanel from "@/components/planner/TodayActionsPanel";
import TripMapPreviewPanel from "@/components/planner/TripMapPreviewPanel";
import ValidationWarningsPanel from "@/components/planner/ValidationWarningsPanel";
import { formatDateOnly, todayDateInTimezone } from "@/lib/date";
import type { PlannerMapRouteSummary } from "@/lib/plannerMap";
import type {
  ItineraryDay,
  MapMarker,
  MapSegment,
  SelectedEntity,
  SelectedEntityDetails,
  Trip,
  TripStop,
  ValidationWarning,
} from "@/types/trip";

type DesktopTodayPanelProps = {
  trip: Trip | null;
  actions: Parameters<typeof TodayActionsPanel>[0]["actions"];
  itineraryDays: ItineraryDay[];
  warnings: ValidationWarning[];
  routeStatusLabel: string;
  markers: MapMarker[];
  segments: MapSegment[];
  routeSummary: PlannerMapRouteSummary;
  selectedEntity: SelectedEntity;
  selectedDetails: SelectedEntityDetails | null;
  onSelectEntity: (entity: Exclude<SelectedEntity, null>) => void;
  onOpenTrip?: () => void;
  onGoToDashboard: () => void;
  onViewStop: (stop: TripStop) => void;
};

const getNextStop = (days: ItineraryDay[]): TripStop | null => {
  const today = todayDateInTimezone();
  const sortedDays = [...days].sort((a, b) => a.date.localeCompare(b.date));
  const day =
    sortedDays.find((item) => item.date >= today && item.stopCount > 0) ??
    sortedDays.find((item) => item.stopCount > 0);
  const row = day?.rows.find((item) => item.kind === "stop");
  return row?.kind === "stop" ? row.stop : null;
};

export default function DesktopTodayPanel({
  trip,
  actions,
  itineraryDays,
  warnings,
  routeStatusLabel,
  markers,
  segments,
  routeSummary,
  selectedEntity,
  selectedDetails,
  onSelectEntity,
  onOpenTrip,
  onGoToDashboard,
  onViewStop,
}: DesktopTodayPanelProps) {
  const nextStop = getNextStop(itineraryDays);

  if (!trip) {
    return (
      <section data-testid="desktop-today-panel" className="rounded-[24px] border border-app-border bg-app-surface p-6">
        <p className="planner-eyebrow planner-section-label">Today</p>
        <h2 className="planner-title-xl mt-2 text-app-text">Choose a Today trip</h2>
        <p className="planner-copy mt-3 max-w-2xl text-app-muted">
          Set a Today trip from Dashboard to keep check-ins, check-outs, route health, and the next
          stop ready here.
        </p>
        <button type="button" onClick={onGoToDashboard} className="planner-button-primary mt-5 rounded-xl border px-4 py-2 text-sm font-semibold">
          Open Dashboard
        </button>
      </section>
    );
  }

  return (
    <div data-testid="desktop-today-panel" className="min-h-0 space-y-4 overflow-y-auto pr-1">
      <section className="rounded-[24px] border border-app-border bg-app-surface px-5 py-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="planner-eyebrow planner-section-label">Today</p>
            <h2 className="planner-title-xl mt-2 text-app-text">{trip.name}</h2>
            <p className="planner-copy mt-2 text-app-muted">{formatDateOnly(todayDateInTimezone())}</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="planner-pill rounded-lg border px-3 py-1.5 text-xs font-semibold">
              Route {routeStatusLabel}
            </span>
            {onOpenTrip ? (
              <button type="button" onClick={onOpenTrip} className="planner-button-primary rounded-xl border px-4 py-2 text-sm font-semibold">
                Open trip
              </button>
            ) : null}
          </div>
        </div>
      </section>

      <div className="grid gap-4 xl:grid-cols-[minmax(300px,0.72fr)_minmax(0,1.28fr)]">
        <div className="space-y-4">
          <TodayActionsPanel actions={actions} tripName={trip.name} />
          <section className="rounded-[24px] border border-app-border bg-app-surface px-5 py-5">
            <p className="planner-eyebrow planner-section-label">Next stop</p>
            {nextStop ? (
              <button type="button" onClick={() => onViewStop(nextStop)} className="planner-clickable-row mt-3 w-full rounded-[18px] border border-app-border bg-app-surface-muted px-4 py-4 text-left">
                <p className="planner-title-md text-app-text">{nextStop.title}</p>
                <p className="planner-copy-sm mt-1 text-app-muted">Open stop details</p>
              </button>
            ) : (
              <p className="planner-copy mt-3 text-app-muted">No upcoming stop is scheduled.</p>
            )}
          </section>
          <ValidationWarningsPanel warnings={warnings} density="compact" title="Today trip warnings" collapseLowSeverity compactHealthyState />
        </div>

        <TripMapPreviewPanel
          trip={trip}
          markers={markers}
          segments={segments}
          routeSummary={routeSummary}
          selectedEntity={selectedEntity}
          selectedDetails={selectedDetails}
          onSelectEntity={onSelectEntity}
          title="Today trip map"
          description="Review the active route and select a stop for context."
          panelTestId="today-trip-map-panel"
          selectionSummaryTestId="today-map-selection-summary"
          selectionSummaryPlacement="map-overlay"
        />
      </div>
    </div>
  );
}
