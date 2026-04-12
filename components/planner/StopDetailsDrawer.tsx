"use client";

import StopTypeIcon from "@/components/planner/StopTypeIcon";
import { formatDateOnly, formatDateTime, formatDurationMinutes } from "@/lib/date";
import { SelectedEntityDetails, TripStop } from "@/types/trip";

type StopDetailsDrawerProps = {
  isOpen: boolean;
  selectedDetails: SelectedEntityDetails | null;
  routeStatus: "fresh" | "stale" | "unavailable";
  routeStatusMessage: string | null;
  onClose: () => void;
  onEdit: (stop: TripStop) => void;
  isOfflineReadOnly?: boolean;
};

const stopToneClass = {
  stay: "border-brand-support/35 bg-brand-support/18 text-brand-primary",
  ferry: "border-state-info-border bg-state-info-surface text-state-info",
  point_of_interest:
    "border-brand-secondary/35 bg-brand-secondary/16 text-brand-secondary-variant",
} as const;

const routeToneClass = {
  fresh: "tone-success",
  stale: "tone-warning",
  unavailable: "tone-error",
} as const;

const routeLabel = {
  fresh: "Live",
  stale: "Needs refresh",
  unavailable: "Unavailable",
} as const;

const getStopTypeLabel = (stop: TripStop): string => {
  if (stop.type === "stay") {
    return "Stay";
  }

  if (stop.type === "ferry") {
    return "Ferry";
  }

  return "Point of interest";
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
    return `Check-in ${formatDateTime(stop.checkInAt)} - Check-out ${formatDateTime(
      stop.checkOutAt,
    )}`;
  }

  if (stop.type === "ferry") {
    return `Departs ${formatDateTime(stop.departureAt)} - Arrives ${formatDateTime(
      stop.arrivalAt,
    )}`;
  }

  return `Visit on ${formatDateOnly(stop.visitDate)}`;
};

const getStopMeta = (stop: TripStop): string[] => {
  if (stop.type === "stay") {
    return [
      stop.bookingStatus ? `Status ${stop.bookingStatus}` : "Status planned",
      ...(stop.hookup ? ["Hookup"] : []),
      ...(stop.hardstanding ? ["Hardstanding"] : []),
      ...(stop.costPerNight !== undefined ? [`GBP ${stop.costPerNight.toFixed(2)} per night`] : []),
      ...(stop.phone ? [`Phone ${stop.phone}`] : []),
      ...(stop.websiteUrl ? [stop.websiteUrl] : []),
      ...(stop.amenitiesSummary ? [stop.amenitiesSummary] : []),
    ];
  }

  if (stop.type === "ferry") {
    return [
      ...(stop.operator ? [`Operator ${stop.operator}`] : []),
      ...(stop.bookingRef ? [`Booking ${stop.bookingRef}`] : []),
      `Check-in by ${formatDateTime(stop.checkInBy)}`,
      ...(stop.vehicleDetails?.vehicleType ? [`Vehicle ${stop.vehicleDetails.vehicleType}`] : []),
      ...(stop.vehicleDetails?.registration ? [`Registration ${stop.vehicleDetails.registration}`] : []),
      ...(stop.vehicleDetails?.lengthMeters
        ? [`Length ${stop.vehicleDetails.lengthMeters.toFixed(1)} m`]
        : []),
      ...(stop.vehicleDetails?.notes ? [stop.vehicleDetails.notes] : []),
    ];
  }

  return [formatDateOnly(stop.visitDate)];
};

export default function StopDetailsDrawer({
  isOpen,
  selectedDetails,
  routeStatus,
  routeStatusMessage,
  onClose,
  onEdit,
  isOfflineReadOnly = false,
}: StopDetailsDrawerProps) {
  if (!isOpen || !selectedDetails) {
    return null;
  }

  const { stop, travelEstimate } = selectedDetails;
  const meta = getStopMeta(stop);

  return (
    <div className="fixed inset-0 z-50">
      <button
        type="button"
        aria-label="Close stop details"
        className="absolute inset-0 h-full w-full cursor-default bg-app-overlay/35"
        onClick={onClose}
      />

      <aside
        role="dialog"
        aria-modal="true"
        aria-labelledby="stop-details-title"
        className="absolute bottom-0 right-0 top-0 flex w-full max-w-xl flex-col overflow-hidden border-l border-app-border bg-app-surface shadow-[0_24px_80px_rgb(var(--color-app-overlay)_/_0.22)] sm:rounded-l-[24px]"
      >
        <div className="border-b border-app-border bg-app-surface-muted/55 px-5 py-4">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="planner-eyebrow planner-section-label">Stop details</p>
              <div className="mt-3 flex items-center gap-3">
                <span
                  className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border ${stopToneClass[stop.type]}`}
                >
                  <StopTypeIcon kind={stop.type} className="h-5 w-5" />
                </span>
                <div className="min-w-0">
                  <h2 id="stop-details-title" className="planner-title-lg truncate text-app-text">
                    {stop.title}
                  </h2>
                  <p className="planner-copy-sm mt-1 text-app-muted">{getStopTypeLabel(stop)}</p>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="planner-button-secondary rounded-full border px-3 py-1.5 text-xs font-semibold"
            >
              Close
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-5">
          <div className="space-y-5">
            <section>
              <p className="planner-eyebrow text-app-muted">When</p>
              <p className="planner-copy mt-2 text-app-text">{getStopScheduleLabel(stop)}</p>
            </section>

            <section>
              <p className="planner-eyebrow text-app-muted">Where</p>
              <p className="planner-copy mt-2 text-app-text">{getStopLocationLabel(stop)}</p>
            </section>

            {meta.length > 0 ? (
              <section>
                <p className="planner-eyebrow text-app-muted">Details</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {meta.map((item) => (
                    <span
                      key={item}
                      className="planner-pill rounded-full border px-3 py-1 text-xs font-semibold"
                    >
                      {item}
                    </span>
                  ))}
                </div>
              </section>
            ) : null}

            <section className="rounded-[20px] border border-app-border bg-app-surface-muted/55 px-4 py-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="planner-eyebrow text-app-muted">Travel to stop</p>
                  <p className="planner-copy mt-2 text-app-text">
                    {travelEstimate
                      ? `${travelEstimate.fromLabel} to ${travelEstimate.toLabel}`
                      : "Refresh the route to calculate this leg."}
                  </p>
                </div>
                <span
                  className={`rounded-full border px-3 py-1 text-xs font-semibold ${routeToneClass[routeStatus]}`}
                >
                  {routeLabel[routeStatus]}
                </span>
              </div>

              {travelEstimate ? (
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <div>
                    <p className="planner-eyebrow text-app-muted">Drive time</p>
                    <p className="planner-copy mt-1 text-app-text">
                      {formatDurationMinutes(travelEstimate.durationMinutes)}
                    </p>
                  </div>
                  <div>
                    <p className="planner-eyebrow text-app-muted">Distance</p>
                    <p className="planner-copy mt-1 text-app-text">
                      {travelEstimate.distanceKm.toFixed(1)} km
                    </p>
                  </div>
                </div>
              ) : null}

              {routeStatusMessage && routeStatus !== "fresh" ? (
                <p className="planner-copy-sm mt-4 text-app-muted">{routeStatusMessage}</p>
              ) : null}
            </section>

            {stop.notes ? (
              <section>
                <p className="planner-eyebrow text-app-muted">Notes</p>
                <p className="planner-copy mt-2 whitespace-pre-wrap text-app-text">{stop.notes}</p>
              </section>
            ) : null}
          </div>
        </div>

        <div className="border-t border-app-border bg-app-surface px-5 py-4">
          <button
            type="button"
            onClick={() => onEdit(stop)}
            disabled={isOfflineReadOnly}
            className="planner-button-primary w-full rounded-full border px-4 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-60"
          >
            Edit stop
          </button>
        </div>
      </aside>
    </div>
  );
}
