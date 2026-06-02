"use client";

import { formatDateOnly, formatDateTime, formatTime, todayDateInTimezone } from "@/lib/date";
import type { ItineraryDay, SyncStatus, TodayAction, Trip, TripStop, ValidationWarning } from "@/types/trip";

type MobileTodayPanelProps = {
  todayTrip: Trip | null;
  todayTripName: string | null;
  actions: TodayAction[];
  itineraryDays: ItineraryDay[];
  syncStatus: SyncStatus;
  isOfflineReadOnly: boolean;
  routeStatusLabel: string;
  routeStatus: "fresh" | "stale" | "unavailable";
  warnings: ValidationWarning[];
  onOpenMap: () => void;
  onOpenTrip?: () => void;
  onGoToTrips: () => void;
  onViewStop: (stop: TripStop) => void;
};

const routeToneClass = {
  fresh: "tone-success",
  stale: "tone-warning",
  unavailable: "tone-error",
} as const;

const syncLabel: Record<SyncStatus, string> = {
  idle: "Demo",
  saving: "Saving",
  saved: "Synced",
  offline: "Offline",
  error: "Sync issue",
};

const getStopLocationLabel = (stop: TripStop): string => {
  if (stop.type === "ferry") {
    return `${stop.departurePort.label} to ${stop.arrivalPort.label}`;
  }

  return stop.place.label;
};

const getStopTimeLabel = (stop: TripStop): string => {
  if (stop.type === "stay") {
    return `Check-out ${formatDateTime(stop.checkOutAt)}`;
  }

  if (stop.type === "ferry") {
    return `Check-in by ${formatDateTime(stop.checkInBy)}`;
  }

  return `Visit ${formatDateOnly(stop.visitDate)}`;
};

const getNextStop = (days: ItineraryDay[]): TripStop | null => {
  const today = todayDateInTimezone();
  const sortedDays = [...days].sort((a, b) => a.date.localeCompare(b.date));
  const currentOrFutureDay =
    sortedDays.find((day) => day.date >= today && day.rows.some((row) => row.kind === "stop")) ??
    sortedDays.find((day) => day.rows.some((row) => row.kind === "stop"));

  const row = currentOrFutureDay?.rows.find((item) => item.kind === "stop") ?? null;
  return row?.kind === "stop" ? row.stop : null;
};

export default function MobileTodayPanel({
  todayTrip,
  todayTripName,
  actions,
  itineraryDays,
  syncStatus,
  isOfflineReadOnly,
  routeStatusLabel,
  routeStatus,
  warnings,
  onOpenMap,
  onOpenTrip,
  onGoToTrips,
  onViewStop,
}: MobileTodayPanelProps) {
  const sortedActions = [...actions].sort((left, right) => {
    if (left.overdue !== right.overdue) {
      return left.overdue ? -1 : 1;
    }

    return left.dueAt.localeCompare(right.dueAt);
  });
  const nextStop = getNextStop(itineraryDays);

  if (!todayTrip) {
    return (
      <div data-testid="mobile-today-panel" className="space-y-3">
        <section className="rounded-lg border border-app-border bg-app-surface px-4 py-5">
          <p className="planner-eyebrow planner-section-label">Today</p>
          <h2 className="planner-title-lg mt-2 text-app-text">Choose a Today trip</h2>
          <p className="planner-copy mt-2 text-app-muted">
            Pick the trip you are travelling with so check-ins, check-outs, and map shortcuts stay
            one tap away.
          </p>
          <button
            type="button"
            onClick={onGoToTrips}
            className="planner-button-primary mt-4 w-full rounded-lg border px-4 py-2 text-sm font-semibold"
          >
            Pick from trips
          </button>
        </section>
      </div>
    );
  }

  return (
    <div data-testid="mobile-today-panel" className="space-y-3">
      <section className="rounded-lg border border-app-border bg-app-surface px-4 py-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="planner-eyebrow planner-section-label">Today</p>
            <h2 className="planner-title-lg mt-2 truncate text-app-text">{todayTripName}</h2>
            <p className="planner-copy-sm mt-1 text-app-muted">{formatDateOnly(todayDateInTimezone())}</p>
          </div>
          <span className="rounded-lg border border-app-border bg-app-surface-muted px-2.5 py-1 text-xs font-semibold text-app-muted">
            {syncLabel[syncStatus]}
          </span>
        </div>

        {isOfflineReadOnly ? (
          <p className="planner-copy-sm tone-warning mt-3 rounded-lg border px-3 py-2">
            Offline read-only mode. Review stays available, edits unlock when the connection returns.
          </p>
        ) : null}

        <div className="mt-4 grid grid-cols-3 gap-2">
          <div className="rounded-lg border border-app-border bg-app-surface-muted/55 px-3 py-2">
            <p className="planner-eyebrow text-app-muted">Actions</p>
            <p className="planner-title-sm mt-1 text-app-text">{actions.length}</p>
          </div>
          <div className={`rounded-lg border px-3 py-2 ${routeToneClass[routeStatus]}`}>
            <p className="planner-eyebrow">Route</p>
            <p className="planner-title-sm mt-1">{routeStatusLabel}</p>
          </div>
          <div className="rounded-lg border border-app-border bg-app-surface-muted/55 px-3 py-2">
            <p className="planner-eyebrow text-app-muted">Warnings</p>
            <p className="planner-title-sm mt-1 text-app-text">{warnings.length}</p>
          </div>
        </div>

        <button
          type="button"
          onClick={onOpenMap}
          className="planner-button-primary mt-4 w-full rounded-lg border px-4 py-2.5 text-sm font-semibold"
        >
          Open map
        </button>
      </section>

      <section className="rounded-lg border border-app-border bg-app-surface px-4 py-4">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <p className="planner-eyebrow planner-section-label">Due now</p>
            <h3 className="planner-title-md mt-1 text-app-text">Travel actions</h3>
          </div>
          <span className="planner-pill rounded-lg border px-2.5 py-1 text-xs font-semibold">
            {sortedActions.length}
          </span>
        </div>

        {sortedActions.length === 0 ? (
          <p className="planner-copy-sm text-app-muted">No time-critical actions due today.</p>
        ) : (
          <div className="space-y-2">
            {sortedActions.map((action) => (
              <article
                key={action.id}
                className={`rounded-lg border px-3 py-3 ${
                  action.overdue ? "tone-error" : "border-app-border bg-app-surface-muted/55"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="planner-title-sm text-app-text">{action.label}</p>
                    <p className="planner-copy-sm mt-1 text-app-muted">{action.detail}</p>
                  </div>
                  <span className="rounded-lg border border-app-border bg-app-surface px-2.5 py-1 text-xs font-semibold text-app-text">
                    {formatTime(action.dueAt)}
                  </span>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="rounded-lg border border-app-border bg-app-surface px-4 py-4">
        <p className="planner-eyebrow planner-section-label">Next stop</p>
        {nextStop ? (
          <button
            type="button"
            onClick={() => onViewStop(nextStop)}
            className="mt-3 block w-full rounded-lg border border-app-border bg-app-surface-muted/55 px-3 py-3 text-left transition hover:border-brand-primary/20"
          >
            <p className="planner-title-md text-app-text">{nextStop.title}</p>
            <p className="planner-copy-sm mt-1 text-app-muted">{getStopLocationLabel(nextStop)}</p>
            <p className="planner-meta mt-1 text-app-muted">{getStopTimeLabel(nextStop)}</p>
          </button>
        ) : (
          <p className="planner-copy-sm mt-2 text-app-muted">No upcoming stop is scheduled yet.</p>
        )}

        {onOpenTrip ? (
          <button
            type="button"
            onClick={onOpenTrip}
            className="planner-button-secondary mt-3 w-full rounded-lg border px-4 py-2 text-sm font-semibold"
          >
            Open trip
          </button>
        ) : null}
      </section>
    </div>
  );
}
