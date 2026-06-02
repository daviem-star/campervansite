"use client";

import { formatDateOnly, formatDateTime, formatDayChip, formatDurationMinutes } from "@/lib/date";
import { getPrimaryDateForStop } from "@/lib/tripDerived";
import type {
  ItineraryDay,
  PlannerNoticeTone,
  SelectedEntity,
  StopType,
  Trip,
  TripStop,
  ValidationWarning,
} from "@/types/trip";
import StopTypeIcon from "@/components/planner/StopTypeIcon";

type SaveFeedback = {
  tone: PlannerNoticeTone;
  text: string;
} | null;

type MobileTripPanelProps = {
  trip: Trip | null;
  days: ItineraryDay[];
  selectedDate: string;
  selectedEntity: SelectedEntity;
  routeStatus: "fresh" | "stale" | "unavailable";
  routeStatusLabel: string;
  routeStatusMessage: string | null;
  warnings: ValidationWarning[];
  isOfflineReadOnly: boolean;
  canMutate: boolean;
  isEditing: boolean;
  hasDraftChanges: boolean;
  isSavingDraft: boolean;
  saveFeedback: SaveFeedback;
  onSelectDate: (date: string) => void;
  onSelectEntity: (entity: Exclude<SelectedEntity, null>) => void;
  onViewStop: (stop: TripStop) => void;
  onEditStop: (stop: TripStop) => void;
  onDeleteStop: (stop: TripStop) => void;
  onEnterEditMode: () => void;
  onSave: () => void;
  onCancel: () => void;
  onAddStop: (type: StopType) => void;
  onOpenMap: () => void;
  onGoToTrips: () => void;
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

const feedbackToneClass: Record<PlannerNoticeTone, string> = {
  info: "tone-info",
  success: "tone-success",
  warning: "tone-warning",
};

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
    return `Departs ${formatDateTime(stop.departureAt)}. Check-in by ${formatDateTime(
      stop.checkInBy,
    )}`;
  }

  return `Visit ${formatDateOnly(stop.visitDate)}`;
};

export default function MobileTripPanel({
  trip,
  days,
  selectedDate,
  selectedEntity,
  routeStatus,
  routeStatusLabel,
  routeStatusMessage,
  warnings,
  isOfflineReadOnly,
  canMutate,
  isEditing,
  hasDraftChanges,
  isSavingDraft,
  saveFeedback,
  onSelectDate,
  onSelectEntity,
  onViewStop,
  onEditStop,
  onDeleteStop,
  onEnterEditMode,
  onSave,
  onCancel,
  onAddStop,
  onOpenMap,
  onGoToTrips,
}: MobileTripPanelProps) {
  const selectedDay = days.find((day) => day.date === selectedDate) ?? days[0] ?? null;
  const highPriorityWarnings = warnings.filter((warning) => warning.severity !== "low");

  if (!trip) {
    return (
      <div data-testid="mobile-trip-panel" className="space-y-3">
        <section className="rounded-lg border border-app-border bg-app-surface px-4 py-5">
          <p className="planner-eyebrow planner-section-label">Trip</p>
          <h2 className="planner-title-lg mt-2 text-app-text">Open a trip</h2>
          <p className="planner-copy mt-2 text-app-muted">
            Choose a trip from the library to see the mobile itinerary companion.
          </p>
          <button
            type="button"
            onClick={onGoToTrips}
            className="planner-button-primary mt-4 w-full rounded-lg border px-4 py-2 text-sm font-semibold"
          >
            Go to trips
          </button>
        </section>
      </div>
    );
  }

  return (
    <div data-testid="mobile-trip-panel" className="space-y-3">
      <section className="rounded-lg border border-app-border bg-app-surface px-4 py-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="planner-eyebrow planner-section-label">Current trip</p>
            <h2 className="planner-title-lg mt-2 truncate text-app-text">{trip.name}</h2>
          </div>
          <span className={`rounded-lg border px-2.5 py-1 text-xs font-semibold ${routeToneClass[routeStatus]}`}>
            {routeStatusLabel}
          </span>
        </div>

        {routeStatusMessage && routeStatus !== "fresh" ? (
          <p className={`planner-copy-sm mt-3 rounded-lg border px-3 py-2 ${routeToneClass[routeStatus]}`}>
            {routeStatusMessage}
          </p>
        ) : null}

        <div className="mt-4 grid grid-cols-3 gap-2">
          <div className="rounded-lg border border-app-border bg-app-surface-muted/55 px-3 py-2">
            <p className="planner-eyebrow text-app-muted">Days</p>
            <p className="planner-title-sm mt-1 text-app-text">{days.length}</p>
          </div>
          <div className="rounded-lg border border-app-border bg-app-surface-muted/55 px-3 py-2">
            <p className="planner-eyebrow text-app-muted">Stops</p>
            <p className="planner-title-sm mt-1 text-app-text">{trip.stops.length}</p>
          </div>
          <div className="rounded-lg border border-app-border bg-app-surface-muted/55 px-3 py-2">
            <p className="planner-eyebrow text-app-muted">Warnings</p>
            <p className="planner-title-sm mt-1 text-app-text">{warnings.length}</p>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={onOpenMap}
            className="planner-button-primary rounded-lg border px-4 py-2 text-sm font-semibold"
          >
            Open map
          </button>
          <button
            type="button"
            onClick={onEnterEditMode}
            disabled={isOfflineReadOnly || isEditing}
            className="planner-button-secondary rounded-lg border px-4 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isEditing ? "Editing" : "Quick edit"}
          </button>
        </div>
      </section>

      <section className="rounded-lg border border-app-border bg-app-surface px-3 py-3">
        <div className="flex gap-2 overflow-x-auto pb-1">
          {days.map((day) => (
            <button
              key={day.date}
              type="button"
              onClick={() => onSelectDate(day.date)}
              className={`shrink-0 rounded-lg border px-3 py-2 text-left transition ${
                day.date === selectedDate
                  ? "border-brand-primary/30 bg-brand-primary text-brand-on-primary"
                  : "border-app-border bg-app-surface-muted/55 text-app-text"
              }`}
            >
              <span className="planner-eyebrow block">Day</span>
              <span className="text-sm font-semibold">{formatDayChip(day.date)}</span>
            </button>
          ))}
        </div>
      </section>

      {isEditing ? (
        <section className="rounded-lg border border-brand-primary/25 bg-brand-primary/5 px-4 py-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="planner-title-sm text-app-text">Quick edit</p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onSave}
                disabled={!hasDraftChanges || isSavingDraft}
                className="planner-button-primary rounded-lg border px-3 py-1.5 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSavingDraft ? "Saving..." : "Save"}
              </button>
              <button
                type="button"
                onClick={onCancel}
                disabled={isSavingDraft}
                className="planner-button-secondary rounded-lg border px-3 py-1.5 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-60"
              >
                Cancel
              </button>
            </div>
          </div>

          <div className="mt-3 grid grid-cols-3 gap-2">
            {([
              ["stay", "Stay"],
              ["ferry", "Ferry"],
              ["point_of_interest", "POI"],
            ] as const).map(([type, label]) => (
              <button
                key={type}
                type="button"
                onClick={() => onAddStop(type)}
                disabled={isOfflineReadOnly}
                className={`rounded-lg border px-2.5 py-2 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-60 ${stopToneClass[type]}`}
              >
                + {label}
              </button>
            ))}
          </div>

          {saveFeedback ? (
            <p className={`planner-copy-sm mt-3 rounded-lg border px-3 py-2 ${feedbackToneClass[saveFeedback.tone]}`}>
              {saveFeedback.text}
            </p>
          ) : null}
        </section>
      ) : null}

      <section className="rounded-lg border border-app-border bg-app-surface px-4 py-4">
        <div className="mb-3 flex items-start justify-between gap-3">
          <div>
            <p className="planner-eyebrow planner-section-label">Active day</p>
            <h3 className="planner-title-md mt-1 text-app-text">
              {selectedDay ? `${formatDayChip(selectedDay.date)} · ${formatDateOnly(selectedDay.date)}` : "No day selected"}
            </h3>
          </div>
          {selectedDay ? (
            <span className="planner-pill rounded-lg border px-2.5 py-1 text-xs font-semibold">
              {selectedDay.stopCount} stops
            </span>
          ) : null}
        </div>

        {!selectedDay || selectedDay.rows.length === 0 ? (
          <p className="planner-copy-sm text-app-muted">No stops are scheduled on this day yet.</p>
        ) : (
          <div className="space-y-2">
            {selectedDay.rows.map((row) =>
              row.kind === "travel" ? (
                <article
                  key={row.id}
                  className="rounded-lg border border-dashed border-app-border bg-app-surface-muted/55 px-3 py-2.5"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="planner-eyebrow text-app-muted">Travel</p>
                      <p className="planner-copy-sm mt-1 text-app-text">
                        {row.fromLabel} to {row.toLabel}
                      </p>
                    </div>
                    <span className="rounded-lg border border-app-border bg-app-surface px-2.5 py-1 text-xs font-semibold text-app-text">
                      {row.estimate && routeStatus === "fresh"
                        ? formatDurationMinutes(row.estimate.durationMinutes)
                        : "Refresh"}
                    </span>
                  </div>
                </article>
              ) : (
                <article
                  key={row.id}
                  className={`rounded-lg border bg-app-surface px-3 py-3 ${
                    selectedEntity?.stopId === row.stop.id
                      ? "planner-selected"
                      : getPrimaryDateForStop(row.stop) === selectedDate
                        ? "border-brand-primary/18"
                        : "border-app-border"
                  }`}
                >
                  <div className="flex items-start gap-2.5">
                    <span
                      className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border ${stopToneClass[row.stop.type]}`}
                    >
                      <StopTypeIcon kind={row.stop.type} className="h-4 w-4" />
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        onSelectEntity({ kind: row.stop.type, stopId: row.stop.id });
                        onViewStop(row.stop);
                      }}
                      className="min-w-0 flex-1 text-left"
                    >
                      <p className="planner-eyebrow text-app-muted">{getStopTypeLabel(row.stop)}</p>
                      <h4 className="planner-title-md mt-1 text-app-text">{row.stop.title}</h4>
                      <p className="planner-copy-sm mt-1 text-app-muted">{getStopLocationLabel(row.stop)}</p>
                      <p className="planner-meta mt-1 text-app-muted">{getStopScheduleLabel(row.stop)}</p>
                    </button>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => onViewStop(row.stop)}
                      className="planner-button-primary rounded-lg border px-3 py-1.5 text-xs font-semibold"
                    >
                      View
                    </button>
                    <button
                      type="button"
                      onClick={() => onEditStop(row.stop)}
                      disabled={isOfflineReadOnly}
                      className="planner-button-secondary rounded-lg border px-3 py-1.5 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      Edit
                    </button>
                  </div>
                  {canMutate ? (
                    <button
                      type="button"
                      onClick={() => onDeleteStop(row.stop)}
                      className="planner-button-danger mt-2 w-full rounded-lg border px-3 py-1.5 text-xs font-semibold"
                    >
                      Delete
                    </button>
                  ) : null}
                </article>
              ),
            )}
          </div>
        )}
      </section>

      <section className="rounded-lg border border-app-border bg-app-surface px-4 py-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="planner-eyebrow planner-section-label">Trip health</p>
            <p className="planner-copy-sm mt-1 text-app-muted">
              {highPriorityWarnings.length > 0
                ? `${highPriorityWarnings.length} high or medium warning${highPriorityWarnings.length === 1 ? "" : "s"}`
                : "No high-priority warnings"}
            </p>
          </div>
          <span className="planner-pill rounded-lg border px-2.5 py-1 text-xs font-semibold">
            {warnings.length}
          </span>
        </div>
      </section>
    </div>
  );
}
