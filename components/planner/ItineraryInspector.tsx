"use client";

import {
  dateOnlyFromIso,
  formatDateOnly,
  formatDateTime,
  formatDayChip,
  formatDayNumber,
  formatDurationMinutes,
} from "@/lib/date";
import { ItineraryDay, SelectedEntityDetails, TripStop } from "@/types/trip";
import StopTypeIcon from "@/components/planner/StopTypeIcon";
import { plannerRouteStatusToneClass } from "@/components/planner/plannerTheme";

type ItineraryInspectorProps = {
  selectedDate: string;
  selectedDay: ItineraryDay | null;
  selectedDetails: SelectedEntityDetails | null;
  routeConfidence: {
    summary: "Live" | "Fallback" | "Mixed" | "Pending" | "Unavailable";
    detail: string;
  };
  routeSummary: {
    totalRoadLegs: number;
    pendingRoadLegs: number;
    liveRoadLegs: number;
    fallbackRoadLegs: number;
    isRefreshing: boolean;
  };
  routeStatus: "fresh" | "stale" | "unavailable";
  routeStatusMessage: string | null;
  onRefreshRoute?: () => void;
  onEditSelected?: (stop: TripStop) => void;
  isOfflineReadOnly?: boolean;
};

const stopToneClass = {
  stay: "border-brand-support/35 bg-brand-support/18 text-brand-primary",
  ferry: "border-state-info-border bg-state-info-surface text-state-info",
  point_of_interest:
    "border-brand-secondary/35 bg-brand-secondary/16 text-brand-secondary-variant",
} as const;

const routeToneClass = {
  Live: "tone-success",
  Fallback: "tone-warning",
  Mixed: "tone-info",
  Pending: "tone-neutral",
  Unavailable: "tone-error",
} as const;

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
    return `Check-in ${formatDateTime(stop.checkInAt)} · Check-out ${formatDateTime(
      stop.checkOutAt,
    )}`;
  }

  if (stop.type === "ferry") {
    return `Departs ${formatDateTime(stop.departureAt)} · Check-in by ${formatDateTime(
      stop.checkInBy,
    )}`;
  }

  return `Visit on ${formatDateOnly(stop.visitDate)}`;
};

const getStopMeta = (stop: TripStop): Array<{ label: string; className: string }> => {
  if (stop.type === "stay") {
    return [
      {
        label: stop.bookingStatus ?? "planned",
        className: "planner-pill",
      },
      ...(stop.hookup
        ? [{ label: "Hookup", className: stopToneClass.stay }]
        : []),
      ...(stop.hardstanding
        ? [{ label: "Hardstanding", className: "planner-pill" }]
        : []),
    ];
  }

  if (stop.type === "ferry") {
    return [
      ...(stop.operator
        ? [{ label: stop.operator, className: stopToneClass.ferry }]
        : []),
      ...(stop.bookingRef
        ? [{ label: `Ref ${stop.bookingRef}`, className: "planner-pill" }]
        : []),
      ...(stop.vehicleDetails?.vehicleType
        ? [{ label: stop.vehicleDetails.vehicleType, className: "planner-pill" }]
        : []),
    ];
  }

  return [
    {
      label: formatDateOnly(stop.visitDate),
      className: stopToneClass.point_of_interest,
    },
  ];
};

export default function ItineraryInspector({
  selectedDate,
  selectedDay,
  selectedDetails,
  routeConfidence,
  routeSummary,
  routeStatus,
  routeStatusMessage,
  onRefreshRoute,
  onEditSelected,
  isOfflineReadOnly = false,
}: ItineraryInspectorProps) {
  return (
    <div className="space-y-4">
      <section className="overflow-hidden rounded-[24px] border border-app-border/80 bg-app-surface shadow-[0_18px_40px_rgb(var(--color-app-overlay)_/_0.08)]">
        <div className="border-b border-app-border/80 bg-[linear-gradient(160deg,rgb(var(--color-brand-primary)_/_0.08),rgb(var(--color-app-surface))_52%,rgb(var(--color-brand-secondary)_/_0.08))] px-4 py-4 sm:px-5">
          {selectedDetails ? (
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="planner-eyebrow planner-section-label">Selected stop</p>
                <div className="mt-3 flex items-center gap-3">
                  <span
                    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border ${stopToneClass[selectedDetails.stop.type]}`}
                  >
                    <StopTypeIcon kind={selectedDetails.stop.type} className="h-5 w-5" />
                  </span>
                  <div className="min-w-0">
                    <h3 className="planner-title-lg truncate text-app-text">
                      {selectedDetails.stop.title}
                    </h3>
                    <p className="planner-copy-sm mt-1 text-app-muted">
                      {getStopScheduleLabel(selectedDetails.stop)}
                    </p>
                  </div>
                </div>
              </div>

              {selectedDetails.stop && onEditSelected ? (
                <button
                  type="button"
                  onClick={() => onEditSelected(selectedDetails.stop)}
                  disabled={isOfflineReadOnly}
                  className="planner-button-secondary rounded-full border px-3 py-1.5 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Edit
                </button>
              ) : null}
            </div>
          ) : (
            <div>
              <p className="planner-eyebrow planner-section-label">Selected day</p>
              <h3 className="planner-title-lg mt-3 text-app-text">
                {formatDayChip(selectedDate)} {formatDayNumber(selectedDate)}
              </h3>
              <p className="planner-copy-sm mt-1 text-app-muted">{formatDateOnly(selectedDate)}</p>
            </div>
          )}
        </div>

        <div className="space-y-4 px-4 py-4 sm:px-5 sm:py-5">
          {selectedDetails ? (
            <>
              <div>
                <p className="planner-eyebrow text-app-muted">Location</p>
                <p className="planner-copy mt-2 text-app-text">
                  {getStopLocationLabel(selectedDetails.stop)}
                </p>
              </div>

              {getStopMeta(selectedDetails.stop).length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {getStopMeta(selectedDetails.stop).map((item) => (
                    <span
                      key={`${selectedDetails.stop.id}-${item.label}`}
                      className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${item.className}`}
                    >
                      {item.label}
                    </span>
                  ))}
                </div>
              ) : null}

              {selectedDetails.travelEstimate ? (
                <div className="rounded-[20px] border border-app-border bg-app-surface-muted/65 px-4 py-3.5">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="planner-eyebrow text-app-muted">Travel to stop</p>
                      <p className="planner-copy-sm mt-2 text-app-text">
                        {selectedDetails.travelEstimate.fromLabel} to {selectedDetails.travelEstimate.toLabel}
                      </p>
                    </div>
                    <span
                      className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${
                        selectedDetails.travelEstimate.confidence === "live"
                          ? "tone-success"
                          : "tone-warning"
                      }`}
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
              ) : null}

              {selectedDetails.stop.notes ? (
                <div>
                  <p className="planner-eyebrow text-app-muted">Notes</p>
                  <p className="planner-copy mt-2 text-app-muted">{selectedDetails.stop.notes}</p>
                </div>
              ) : null}
            </>
          ) : (
            <>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-[20px] border border-app-border bg-app-surface-muted/65 px-4 py-3.5">
                  <p className="planner-eyebrow text-app-muted">Stops</p>
                  <p className="planner-title-lg mt-2 text-app-text">{selectedDay?.stopCount ?? 0}</p>
                </div>
                <div className="rounded-[20px] border border-app-border bg-app-surface-muted/65 px-4 py-3.5">
                  <p className="planner-eyebrow text-app-muted">Drive time</p>
                  <p className="planner-title-lg mt-2 text-app-text">
                    {formatDurationMinutes(selectedDay?.bufferedDriveMinutes ?? 0)}
                  </p>
                </div>
              </div>

              <div className="rounded-[20px] border border-app-border bg-app-surface-muted/65 px-4 py-3.5">
                <p className="planner-eyebrow text-app-muted">Base for the day</p>
                <p className="planner-copy mt-2 text-app-text">
                  {selectedDay?.activeStay
                    ? `${selectedDay.activeStay.title} · ${selectedDay.activeStay.place.label}`
                    : "No overnight base is attached to this day yet."}
                </p>
              </div>
            </>
          )}
        </div>
      </section>

      <section className="rounded-[24px] border border-app-border/80 bg-app-surface px-4 py-4 shadow-[0_18px_40px_rgb(var(--color-app-overlay)_/_0.08)] sm:px-5 sm:py-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="planner-eyebrow planner-section-label">Route signal</p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span
                className={`rounded-full border px-3 py-1 text-xs font-semibold ${routeToneClass[routeConfidence.summary]}`}
              >
                {routeConfidence.summary}
              </span>
              <span className="planner-meta text-app-muted">{routeConfidence.detail}</span>
            </div>
          </div>

          {onRefreshRoute ? (
            <button
              type="button"
              onClick={onRefreshRoute}
              className="planner-button-secondary rounded-full border px-3 py-1.5 text-xs font-semibold"
            >
              {routeSummary.isRefreshing ? "Refreshing..." : "Refresh"}
            </button>
          ) : null}
        </div>

        {routeStatusMessage && routeStatus !== "fresh" ? (
          <p
            className={`planner-copy-sm mt-4 rounded-2xl border px-3 py-2 ${plannerRouteStatusToneClass[routeStatus]}`}
          >
            {routeStatusMessage}
          </p>
        ) : null}

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div className="rounded-[20px] border border-app-border bg-app-surface-muted/65 px-4 py-3.5">
            <p className="planner-eyebrow text-app-muted">Road legs</p>
            <p className="planner-title-lg mt-2 text-app-text">{routeSummary.totalRoadLegs}</p>
            <p className="planner-copy-sm mt-1 text-app-muted">
              {routeSummary.liveRoadLegs} live · {routeSummary.fallbackRoadLegs} fallback
            </p>
          </div>
          <div className="rounded-[20px] border border-app-border bg-app-surface-muted/65 px-4 py-3.5">
            <p className="planner-eyebrow text-app-muted">Pending refresh</p>
            <p className="planner-title-lg mt-2 text-app-text">{routeSummary.pendingRoadLegs}</p>
            <p className="planner-copy-sm mt-1 text-app-muted">
              {selectedDetails
                ? `Focus date ${formatDateOnly(
                    selectedDetails.stop.type === "point_of_interest"
                      ? selectedDetails.stop.visitDate
                      : selectedDetails.stop.type === "stay"
                        ? dateOnlyFromIso(selectedDetails.stop.checkInAt)
                        : dateOnlyFromIso(selectedDetails.stop.departureAt),
                  )}`
                : `Viewing ${formatDateOnly(selectedDate)}`}
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
