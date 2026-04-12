"use client";

import { useEffect } from "react";

import MapSelectionSummary from "@/components/planner/MapSelectionSummary";
import PlannerMap from "@/components/planner/PlannerMap";
import StopTypeIcon from "@/components/planner/StopTypeIcon";
import type { PlannerMapRouteSummary } from "@/lib/plannerMap";
import { formatDateOnly, formatDateTime, formatDayChip, formatDurationMinutes } from "@/lib/date";
import type {
  ItineraryDay,
  MapMarker,
  MapSegment,
  SelectedEntity,
  SelectedEntityDetails,
  Trip,
  TripStop,
} from "@/types/trip";

type PlannerMapCockpitProps = {
  trip: Trip;
  markers: MapMarker[];
  segments: MapSegment[];
  routeSummary: PlannerMapRouteSummary;
  selectedEntity: SelectedEntity;
  selectionOrigin?: "itinerary" | "map" | "system";
  selectedDetails: SelectedEntityDetails | null;
  itineraryDays: ItineraryDay[];
  selectedDate: string;
  routeStatus: "fresh" | "stale" | "unavailable";
  routeStatusLabel: string;
  routeStatusMessage: string | null;
  isRefreshing: boolean;
  roadLegCount: number;
  totalDistanceKm: number;
  lastRefreshLabel: string | null;
  onSelectDate: (date: string) => void;
  onSelectMapEntity: (entity: Exclude<SelectedEntity, null>) => void;
  onSelectItineraryEntity: (entity: Exclude<SelectedEntity, null>) => void;
  onRefresh: () => void;
  onClose: () => void;
};

const routeToneClass = {
  fresh: "tone-success",
  stale: "tone-warning",
  unavailable: "tone-error",
} as const;

const stopToneClass = {
  stay: "border-brand-support/35 bg-brand-support/18 text-brand-primary",
  ferry: "border-state-info-border bg-state-info-surface text-state-info",
  point_of_interest:
    "border-brand-secondary/35 bg-brand-secondary/16 text-brand-secondary-variant",
} as const;

const getStopTypeLabel = (stop: TripStop): string => {
  if (stop.type === "stay") {
    return "Stay";
  }

  if (stop.type === "ferry") {
    return "Ferry";
  }

  return "POI";
};

const getStopLocationLabel = (stop: TripStop): string => {
  if (stop.type === "stay") {
    return stop.place.label;
  }

  if (stop.type === "ferry") {
    return `${stop.departurePort.label} to ${stop.arrivalPort.label}`;
  }

  return stop.place.label;
};

const getStopScheduleLabel = (stop: TripStop): string => {
  if (stop.type === "stay") {
    return `${formatDateTime(stop.checkInAt)} to ${formatDateTime(stop.checkOutAt)}`;
  }

  if (stop.type === "ferry") {
    return `${formatDateTime(stop.departureAt)} departure`;
  }

  return formatDateOnly(stop.visitDate);
};

export default function PlannerMapCockpit({
  trip,
  markers,
  segments,
  routeSummary,
  selectedEntity,
  selectionOrigin = "system",
  selectedDetails,
  itineraryDays,
  selectedDate,
  routeStatus,
  routeStatusLabel,
  routeStatusMessage,
  isRefreshing,
  roadLegCount,
  totalDistanceKm,
  lastRefreshLabel,
  onSelectDate,
  onSelectMapEntity,
  onSelectItineraryEntity,
  onRefresh,
  onClose,
}: PlannerMapCockpitProps) {
  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [onClose]);

  const totalStops = itineraryDays.reduce((sum, day) => sum + day.stopCount, 0);

  return (
    <div
      data-testid="planner-map-cockpit"
      className="planner-overlay fixed inset-0 z-50 flex min-h-screen flex-col p-2 text-app-text sm:p-3"
      role="dialog"
      aria-modal="true"
      aria-label={`${trip.name} map cockpit`}
    >
      <section className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-app-border bg-app-surface shadow-[0_24px_70px_rgb(var(--color-app-overlay)_/_0.22)]">
        <header className="flex min-h-12 items-center justify-between gap-3 border-b border-app-border bg-app-surface-muted/75 px-3 py-2">
          <div className="min-w-0">
            <p className="planner-eyebrow text-app-muted">Map cockpit</p>
            <h2 className="planner-title-lg truncate text-app-text">{trip.name}</h2>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <span className={`rounded-lg border px-2.5 py-1 text-xs font-semibold ${routeToneClass[routeStatus]}`}>
              {routeStatusLabel}
            </span>
            <button
              type="button"
              onClick={onRefresh}
              disabled={isRefreshing || roadLegCount === 0}
              className="planner-button-primary rounded-lg border px-3 py-1.5 text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isRefreshing ? "Refreshing..." : "Refresh"}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="planner-button-secondary rounded-lg border px-3 py-1.5 text-xs font-semibold"
            >
              Close
            </button>
          </div>
        </header>

        <div className="grid min-h-0 flex-1 lg:grid-cols-[minmax(0,1.9fr)_minmax(310px,0.82fr)]">
          <div data-testid="planner-map-cockpit-map-surface" className="min-h-[56vh] lg:min-h-0">
            <PlannerMap
              trip={trip}
              markers={markers}
              segments={segments}
              routeSummary={routeSummary}
              selectedEntity={selectedEntity}
              selectionOrigin={selectionOrigin}
              onSelectEntity={onSelectMapEntity}
              isVisible
              className="h-full w-full bg-app-surface"
              testRegistryKey="planner-map-cockpit"
            />
          </div>

          <aside
            data-testid="planner-map-cockpit-side-panel"
            className="min-h-0 overflow-y-auto border-t border-app-border bg-app-surface lg:border-l lg:border-t-0"
          >
            <div className="space-y-2.5 p-2.5">
              <section className="grid grid-cols-3 overflow-hidden rounded-lg border border-app-border bg-app-surface-muted/50">
                <div className="border-r border-app-border px-2.5 py-1.5">
                  <p className="planner-eyebrow text-app-muted">Legs</p>
                  <p className="planner-title-sm mt-0.5 text-app-text">{roadLegCount}</p>
                </div>
                <div className="border-r border-app-border px-2.5 py-1.5">
                  <p className="planner-eyebrow text-app-muted">Distance</p>
                  <p className="planner-title-sm mt-0.5 text-app-text">{totalDistanceKm.toFixed(1)} km</p>
                </div>
                <div className="px-2.5 py-1.5">
                  <p className="planner-eyebrow text-app-muted">Stops</p>
                  <p className="planner-title-sm mt-0.5 text-app-text">{totalStops}</p>
                </div>
              </section>

              <section className="rounded-lg border border-app-border bg-app-surface-muted/40 px-2.5 py-2">
                <div className="flex items-center justify-between gap-2">
                  <p className="planner-eyebrow text-app-muted">Route data</p>
                  <span className={`rounded-lg border px-2 py-0.5 text-[10px] font-semibold ${routeToneClass[routeStatus]}`}>
                    {lastRefreshLabel ?? "Not refreshed"}
                  </span>
                </div>
                {routeStatusMessage && routeStatus !== "fresh" ? (
                  <p className={`planner-copy-sm mt-2 rounded-lg border px-2.5 py-2 ${routeToneClass[routeStatus]}`}>
                    {routeStatusMessage}
                  </p>
                ) : null}
              </section>

              <MapSelectionSummary
                selectedDetails={selectedDetails}
                density="compact"
                emptyMessage="Select a stop or ferry leg on the map."
                testId="planner-map-cockpit-selection-summary"
              />

              <section className="rounded-lg border border-app-border bg-app-surface">
                <div className="flex items-center justify-between border-b border-app-border px-2.5 py-2">
                  <div>
                    <p className="planner-eyebrow planner-section-label">Itinerary</p>
                  </div>
                  <span className="planner-pill rounded-lg border px-2 py-0.5 text-[10px] font-semibold">
                    {itineraryDays.length} active
                  </span>
                </div>

                <div className="divide-y divide-app-border">
                  {itineraryDays.map((day) => (
                    <div
                      key={day.date}
                      className={day.date === selectedDate ? "bg-brand-primary/5" : "bg-app-surface"}
                    >
                      <button
                        type="button"
                        onClick={() => onSelectDate(day.date)}
                        className="flex w-full items-center justify-between gap-2 px-2.5 py-1.5 text-left"
                      >
                        <span>
                          <span className="planner-eyebrow block text-app-muted">{formatDayChip(day.date)}</span>
                          <span className="planner-copy-sm mt-0.5 block font-semibold text-app-text">
                            {formatDateOnly(day.date)}
                          </span>
                        </span>
                        <span className="planner-meta text-app-muted">
                          {day.stopCount} stop{day.stopCount === 1 ? "" : "s"}
                        </span>
                      </button>

                      {day.rows.length > 0 ? (
                        <div className="space-y-1 px-1.5 pb-1.5">
                          {day.rows.map((row) =>
                            row.kind === "travel" ? (
                              <div
                                key={row.id}
                                className="rounded-lg border border-dashed border-app-border bg-app-surface-muted/45 px-2 py-1.5"
                              >
                                <div className="flex items-center justify-between gap-2">
                                  <p className="planner-eyebrow text-app-muted">Travel</p>
                                  <span className={`rounded-md border px-2 py-0.5 text-[10px] font-semibold ${
                                    row.estimate ? "tone-success" : "tone-warning"
                                  }`}
                                  >
                                    {row.estimate
                                      ? formatDurationMinutes(row.estimate.durationMinutes)
                                      : "Refresh"}
                                  </span>
                                </div>
                                <p className="planner-meta mt-0.5 truncate text-app-muted">
                                  {row.fromLabel} to {row.toLabel}
                                </p>
                              </div>
                            ) : (
                              <button
                                key={row.id}
                                type="button"
                                onClick={() =>
                                  onSelectItineraryEntity({
                                    kind: row.stop.type,
                                    stopId: row.stop.id,
                                  })
                                }
                                className={`flex w-full items-start gap-2 rounded-lg border px-2 py-1.5 text-left transition ${
                                  selectedEntity?.stopId === row.stop.id
                                    ? "border-brand-primary/35 bg-brand-primary/10"
                                    : "border-app-border bg-app-surface hover:bg-app-surface-muted"
                                }`}
                              >
                                <span
                                  className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border ${
                                    stopToneClass[row.stop.type]
                                  }`}
                                >
                                  <StopTypeIcon kind={row.stop.type} className="h-3.5 w-3.5" />
                                </span>
                                <span className="min-w-0 flex-1">
                                  <span className="flex items-center justify-between gap-2">
                                    <span className="planner-copy-sm truncate font-semibold text-app-text">
                                      {row.stop.title}
                                    </span>
                                    <span className="planner-meta shrink-0 text-app-muted">
                                      {getStopTypeLabel(row.stop)}
                                    </span>
                                  </span>
                                  <span className="planner-meta mt-0.5 block truncate text-app-muted">
                                    {getStopLocationLabel(row.stop)}
                                  </span>
                                  <span className="planner-meta mt-0.5 block truncate text-app-muted">
                                    {getStopScheduleLabel(row.stop)}
                                  </span>
                                </span>
                              </button>
                            ),
                          )}
                        </div>
                      ) : null}
                    </div>
                  ))}
                </div>
              </section>
            </div>
          </aside>
        </div>
      </section>
    </div>
  );
}
