"use client";

import StopTypeIcon from "@/components/planner/StopTypeIcon";
import { formatDateOnly, formatDateTime, formatDurationMinutes } from "@/lib/date";
import { SelectedEntityDetails, TripStop } from "@/types/trip";

type MapSelectionSummaryProps = {
  selectedDetails: SelectedEntityDetails | null;
  emptyMessage?: string;
  className?: string;
  testId?: string;
  density?: "default" | "compact";
  presentation?: "panel" | "map-overlay";
  hideWhenEmpty?: boolean;
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
  density = "default",
  presentation = "panel",
  hideWhenEmpty = false,
}: MapSelectionSummaryProps) {
  const isCompact = density === "compact";
  const isOverlay = presentation === "map-overlay";
  const containerClass = `${
    isCompact ? "rounded-lg" : "rounded-[22px]"
  } border border-app-border/80 bg-app-surface shadow-[0_16px_34px_rgb(var(--color-app-overlay)_/_0.06)] ${
    isCompact ? "px-4 py-3.5" : "px-4 py-4"
  } ${className ?? ""}`;

  if (!selectedDetails) {
    if (hideWhenEmpty) {
      return null;
    }

    return (
      <section data-testid={testId} className={containerClass}>
        <p className="planner-eyebrow planner-section-label">Map selection</p>
        <p className={`text-app-muted ${isCompact ? "planner-copy-sm mt-2.5" : "planner-copy mt-3"}`}>
          {emptyMessage}
        </p>
      </section>
    );
  }

  if (isOverlay) {
    return (
      <section
        data-testid={testId}
        className={`pointer-events-none absolute bottom-4 left-4 z-10 max-w-[320px] rounded-[18px] border border-app-border/80 bg-app-surface/96 px-3.5 py-3 text-app-text shadow-[0_18px_32px_rgb(var(--color-app-overlay)_/_0.16)] backdrop-blur ${className ?? ""}`}
      >
        <div className="flex items-start gap-2.5">
          <span
            className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl border ${
              stopToneClass[selectedDetails.stop.type]
            }`}
          >
            <StopTypeIcon kind={selectedDetails.stop.type} className="h-4 w-4" />
          </span>

          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="planner-eyebrow text-app-muted">Selected stop</p>
                <h3 className="planner-copy mt-1 truncate font-semibold text-app-text">
                  {selectedDetails.stop.title}
                </h3>
              </div>

              <span
                className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${stopToneClass[selectedDetails.stop.type]}`}
              >
                {getStopTypeLabel(selectedDetails.stop)}
              </span>
            </div>

            <p className="planner-meta mt-1.5 leading-4 text-app-muted">
              {getStopLocationLabel(selectedDetails.stop)}
            </p>

            <p className="planner-meta mt-1 leading-4 text-app-muted">
              {selectedDetails.travelEstimate
                ? `${formatDurationMinutes(
                    selectedDetails.travelEstimate.durationMinutes,
                  )} · ${selectedDetails.travelEstimate.distanceKm.toFixed(1)} km`
                : getStopScheduleLabel(selectedDetails.stop)}
            </p>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section data-testid={testId} className={containerClass}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="planner-eyebrow planner-section-label">Map selection</p>
          <div className={`flex items-center ${isCompact ? "mt-2.5 gap-2.5" : "mt-3 gap-3"}`}>
            <span
              className={`flex shrink-0 items-center justify-center rounded-2xl border ${
                isCompact ? "h-9 w-9" : "h-10 w-10"
              } ${stopToneClass[selectedDetails.stop.type]}`}
            >
              <StopTypeIcon
                kind={selectedDetails.stop.type}
                className={isCompact ? "h-4 w-4" : "h-5 w-5"}
              />
            </span>
            <div className="min-w-0">
              <h3 className={`${isCompact ? "planner-copy font-semibold" : "planner-title-sm"} truncate text-app-text`}>
                {selectedDetails.stop.title}
              </h3>
              <p className={`text-app-muted ${isCompact ? "planner-meta mt-0.5" : "planner-copy-sm mt-1"}`}>
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

      <div
        className={`grid md:grid-cols-[minmax(0,1.15fr)_minmax(220px,0.85fr)] ${
          isCompact ? "mt-3 gap-2.5" : "mt-4 gap-3"
        }`}
      >
        <div
          className={`rounded-[18px] border border-app-border bg-app-surface-muted/55 ${
            isCompact ? "px-3.5 py-3" : "px-4 py-3.5"
          }`}
        >
          <p className="planner-eyebrow text-app-muted">Location</p>
          <p className={`${isCompact ? "planner-copy-sm mt-1.5" : "planner-copy mt-2"} text-app-text`}>
            {getStopLocationLabel(selectedDetails.stop)}
          </p>
        </div>

        {selectedDetails.travelEstimate ? (
          <div
            className={`rounded-[18px] border border-app-border bg-app-surface-muted/55 ${
              isCompact ? "px-3.5 py-3" : "px-4 py-3.5"
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="planner-eyebrow text-app-muted">Travel to stop</p>
                <p className={`${isCompact ? "planner-meta mt-1.5" : "planner-copy-sm mt-2"} text-app-text`}>
                  {selectedDetails.travelEstimate.fromLabel} to {selectedDetails.travelEstimate.toLabel}
                </p>
              </div>
              <span
                className="tone-success rounded-full border px-2.5 py-1 text-[11px] font-semibold"
              >
                Live
              </span>
            </div>

            <div className={`grid gap-3 sm:grid-cols-2 ${isCompact ? "mt-2.5" : "mt-3"}`}>
              <div>
                <p className="planner-eyebrow text-app-muted">Drive time</p>
                <p className={`${isCompact ? "planner-copy-sm mt-0.5" : "planner-copy mt-1"} text-app-text`}>
                  {formatDurationMinutes(
                    selectedDetails.travelEstimate.durationMinutes,
                  )}
                </p>
              </div>
              <div>
                <p className="planner-eyebrow text-app-muted">Distance</p>
                <p className={`${isCompact ? "planner-copy-sm mt-0.5" : "planner-copy mt-1"} text-app-text`}>
                  {selectedDetails.travelEstimate.distanceKm.toFixed(1)} km
                </p>
              </div>
            </div>
          </div>
        ) : (
          <div
            className={`rounded-[18px] border border-dashed border-app-border bg-app-surface-muted/35 ${
              isCompact ? "px-3.5 py-3" : "px-4 py-3.5"
            }`}
          >
            <p className="planner-eyebrow text-app-muted">Travel to stop</p>
            <p className={`${isCompact ? "planner-copy-sm mt-1.5" : "planner-copy mt-2"} text-app-muted`}>
              No saved route estimate is attached to this stop yet.
            </p>
          </div>
        )}
      </div>
    </section>
  );
}
