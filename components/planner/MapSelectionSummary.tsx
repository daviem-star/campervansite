"use client";

import StopTypeIcon from "@/components/planner/StopTypeIcon";
import { plannerRouteConfidenceToneClass } from "@/components/planner/plannerTheme";
import { formatDateOnly, formatDateTime, formatDurationMinutes } from "@/lib/date";
import { SelectedEntityDetails, TripStop } from "@/types/trip";

type MapSelectionSummaryProps = {
  selectedDetails: SelectedEntityDetails | null;
  emptyMessage?: string;
  className?: string;
  testId?: string;
};

const stopToneClass = {
  stay: "border-brand-support/35 bg-brand-support/18 text-brand-primary",
  ferry: "border-state-info-border bg-state-info-surface text-state-info",
  point_of_interest:
    "border-brand-secondary/35 bg-brand-secondary/16 text-brand-secondary-variant",
} as const;

const getStopTypeLabel = (stop: TripStop): string => {
  if (stop.type === "stay") {
    return "Campsite";
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
    return `Check-in ${formatDateTime(stop.checkInAt)} · Check-out ${formatDateTime(stop.checkOutAt)}`;
  }

  if (stop.type === "ferry") {
    return `Departs ${formatDateTime(stop.departureAt)} · Check-in by ${formatDateTime(stop.checkInBy)}`;
  }

  return `Visit on ${formatDateOnly(stop.visitDate)}`;
};

export default function MapSelectionSummary({
  selectedDetails,
  emptyMessage = "Select a stop or ferry leg on the map to inspect it here.",
  className,
  testId,
}: MapSelectionSummaryProps) {
  if (!selectedDetails) {
    return (
      <section
        data-testid={testId}
        className={`rounded-[22px] border border-app-border/80 bg-app-surface px-4 py-4 shadow-[0_16px_34px_rgb(var(--color-app-overlay)_/_0.06)] ${className ?? ""}`}
      >
        <p className="planner-eyebrow planner-section-label">Map selection</p>
        <p className="planner-copy mt-3 text-app-muted">{emptyMessage}</p>
      </section>
    );
  }

  return (
    <section
      data-testid={testId}
      className={`rounded-[22px] border border-app-border/80 bg-app-surface px-4 py-4 shadow-[0_16px_34px_rgb(var(--color-app-overlay)_/_0.06)] ${className ?? ""}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="planner-eyebrow planner-section-label">Map selection</p>
          <div className="mt-3 flex items-center gap-3">
            <span
              className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border ${stopToneClass[selectedDetails.stop.type]}`}
            >
              <StopTypeIcon kind={selectedDetails.stop.type} className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <h3 className="planner-title-sm truncate text-app-text">
                {selectedDetails.stop.title}
              </h3>
              <p className="planner-copy-sm mt-1 text-app-muted">
                {getStopScheduleLabel(selectedDetails.stop)}
              </p>
            </div>
          </div>
        </div>

        <span
          className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${stopToneClass[selectedDetails.stop.type]}`}
        >
          {getStopTypeLabel(selectedDetails.stop)}
        </span>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-[minmax(0,1.15fr)_minmax(220px,0.85fr)]">
        <div className="rounded-[18px] border border-app-border bg-app-surface-muted/55 px-4 py-3.5">
          <p className="planner-eyebrow text-app-muted">Location</p>
          <p className="planner-copy mt-2 text-app-text">
            {getStopLocationLabel(selectedDetails.stop)}
          </p>
        </div>

        {selectedDetails.travelEstimate ? (
          <div className="rounded-[18px] border border-app-border bg-app-surface-muted/55 px-4 py-3.5">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="planner-eyebrow text-app-muted">Travel to stop</p>
                <p className="planner-copy-sm mt-2 text-app-text">
                  {selectedDetails.travelEstimate.fromLabel} to {selectedDetails.travelEstimate.toLabel}
                </p>
              </div>
              <span
                className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${plannerRouteConfidenceToneClass[selectedDetails.travelEstimate.confidence]}`}
              >
                {selectedDetails.travelEstimate.confidence === "live" ? "Live" : "Fallback"}
              </span>
            </div>

            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <div>
                <p className="planner-eyebrow text-app-muted">Buffered time</p>
                <p className="planner-copy mt-1 text-app-text">
                  {formatDurationMinutes(
                    selectedDetails.travelEstimate.bufferedDurationMinutes,
                  )}
                </p>
              </div>
              <div>
                <p className="planner-eyebrow text-app-muted">Distance</p>
                <p className="planner-copy mt-1 text-app-text">
                  {selectedDetails.travelEstimate.distanceKm.toFixed(1)} km
                </p>
              </div>
            </div>
          </div>
        ) : (
          <div className="rounded-[18px] border border-dashed border-app-border bg-app-surface-muted/35 px-4 py-3.5">
            <p className="planner-eyebrow text-app-muted">Travel to stop</p>
            <p className="planner-copy mt-2 text-app-muted">
              No saved route estimate is attached to this stop yet.
            </p>
          </div>
        )}
      </div>
    </section>
  );
}
