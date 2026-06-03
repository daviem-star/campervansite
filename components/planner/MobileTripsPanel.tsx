"use client";

import { formatDateTime } from "@/lib/date";
import type { Trip, TripSummary, ValidationWarning } from "@/types/trip";

type MobileTripsPanelProps = {
  trips: TripSummary[];
  previewTrip: Trip | null;
  loadedTripId: string | null;
  previewTripId: string | null;
  todayTripId: string | null;
  hasLegacyImport: boolean;
  isOfflineReadOnly: boolean;
  isWorking: boolean;
  isPreviewingTripId: string | null;
  isUpdatingTodayTrip: boolean;
  routeStatusLabel: string;
  warningCount: number;
  warnings: ValidationWarning[];
  canManageTrips: boolean;
  canDeleteTrip: boolean;
  onCreateTrip: () => void;
  onImportLegacyTrips: () => Promise<void>;
  onPreviewTrip: (tripId: string) => Promise<void>;
  onOpenTrip?: () => void;
  onToggleTodayTrip?: () => void;
  onRenameTrip?: () => void;
  onDeleteTrip?: () => void;
};

const utilityButtonClass =
  "rounded-lg border px-3 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60";

export default function MobileTripsPanel({
  trips,
  previewTrip,
  loadedTripId,
  previewTripId,
  todayTripId,
  hasLegacyImport,
  isOfflineReadOnly,
  isWorking,
  isPreviewingTripId,
  isUpdatingTodayTrip,
  routeStatusLabel,
  warningCount,
  warnings,
  canManageTrips,
  canDeleteTrip,
  onCreateTrip,
  onImportLegacyTrips,
  onPreviewTrip,
  onOpenTrip,
  onToggleTodayTrip,
  onRenameTrip,
  onDeleteTrip,
}: MobileTripsPanelProps) {
  const highPriorityWarnings = warnings.filter((warning) => warning.severity !== "low");
  const isTodayTrip = previewTrip?.id === todayTripId;

  return (
    <div data-testid="mobile-trips-panel" className="space-y-3">
      <section className="rounded-lg border border-app-border bg-app-surface px-4 py-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="planner-eyebrow planner-section-label">Trips</p>
            <h2 className="planner-title-lg mt-2 text-app-text">Trip library</h2>
            <p className="planner-copy-sm mt-1 text-app-muted">Choose the trip you are travelling with.</p>
          </div>
          <span className="planner-pill rounded-lg border px-2.5 py-1 text-xs font-semibold">
            {trips.length}
          </span>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={onCreateTrip}
            disabled={isWorking || isOfflineReadOnly}
            className={`${utilityButtonClass} planner-button-primary`}
          >
            New trip
          </button>
          {hasLegacyImport ? (
            <button
              type="button"
              onClick={() => void onImportLegacyTrips()}
              disabled={isWorking || isOfflineReadOnly}
              className={`${utilityButtonClass} tone-info`}
            >
              Import local
            </button>
          ) : null}
        </div>

        {isOfflineReadOnly ? (
          <p className="planner-copy-sm tone-warning mt-3 rounded-lg border px-3 py-2">
            Trip switching and management stay locked while using the cached offline copy.
          </p>
        ) : null}
      </section>

      <section className="overflow-hidden rounded-lg border border-app-border bg-app-surface">
        {trips.length === 0 ? (
          <p className="planner-copy px-4 py-5 text-app-muted">No cloud trips are available yet.</p>
        ) : (
          <div className="divide-y divide-app-border">
            {trips.map((trip) => {
              const isLoaded = trip.id === loadedTripId;
              const isPreviewed = trip.id === previewTripId;
              const isToday = trip.id === todayTripId;
              const isPreviewing = trip.id === isPreviewingTripId;

              return (
                <button
                  key={trip.id}
                  type="button"
                  aria-pressed={isPreviewed}
                  data-testid={`mobile-trip-summary-${trip.id}`}
                  onClick={() => void onPreviewTrip(trip.id)}
                  className={`block w-full px-4 py-3 text-left transition ${
                    isPreviewed ? "planner-library-row-selected" : "bg-app-surface"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="planner-title-md truncate text-app-text">{trip.name}</h3>
                      <p className="planner-meta mt-1 text-app-muted">
                        Updated {formatDateTime(trip.updatedAt)}
                      </p>
                      {isPreviewing ? (
                        <p className="planner-meta mt-1 text-brand-primary">Loading preview...</p>
                      ) : null}
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1">
                      {isLoaded ? (
                        <span className="planner-pill-active rounded-lg border px-2 py-0.5 text-[11px] font-semibold">
                          Open
                        </span>
                      ) : null}
                      {isToday ? (
                        <span className="rounded-lg border border-state-info-border bg-state-info-surface px-2 py-0.5 text-[11px] font-semibold text-state-info">
                          Today
                        </span>
                      ) : null}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </section>

      <section className="rounded-lg border border-app-border bg-app-surface px-4 py-4">
        <p className="planner-eyebrow planner-section-label">Preview</p>
        {previewTrip ? (
          <>
            <div className="mt-2 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h3 className="planner-title-md truncate text-app-text">{previewTrip.name}</h3>
                <p className="planner-copy-sm mt-1 text-app-muted">
                  {routeStatusLabel}. {warningCount} warning{warningCount === 1 ? "" : "s"}.
                </p>
              </div>
              <span className="planner-pill rounded-lg border px-2.5 py-1 text-xs font-semibold">
                {previewTrip.stops.length} stops
              </span>
            </div>

            {highPriorityWarnings.length > 0 ? (
              <p className="planner-copy-sm tone-warning mt-3 rounded-lg border px-3 py-2">
                {highPriorityWarnings[0].label}
              </p>
            ) : null}

            <div className="mt-4 grid grid-cols-2 gap-2">
              {onOpenTrip ? (
                <button
                  type="button"
                  onClick={onOpenTrip}
                  disabled={isWorking}
                  className={`${utilityButtonClass} planner-button-primary`}
                >
                  Open
                </button>
              ) : null}
              {canManageTrips && onToggleTodayTrip ? (
                <button
                  type="button"
                  onClick={onToggleTodayTrip}
                  disabled={isWorking || isOfflineReadOnly || isUpdatingTodayTrip}
                  className={`${utilityButtonClass} ${
                    isTodayTrip
                      ? "border-state-info-border bg-state-info-surface text-state-info"
                      : "planner-button-secondary"
                  }`}
                >
                  {isUpdatingTodayTrip ? "Updating..." : isTodayTrip ? "Clear Today" : "Set Today"}
                </button>
              ) : null}
              {canManageTrips && onRenameTrip ? (
                <button
                  type="button"
                  onClick={onRenameTrip}
                  disabled={isWorking || isOfflineReadOnly}
                  className={`${utilityButtonClass} planner-button-secondary`}
                >
                  Rename
                </button>
              ) : null}
              {canManageTrips && onDeleteTrip ? (
                <button
                  type="button"
                  onClick={onDeleteTrip}
                  disabled={!canDeleteTrip || isWorking || isOfflineReadOnly}
                  className={`${utilityButtonClass} planner-button-danger`}
                >
                  Delete
                </button>
              ) : null}
            </div>
          </>
        ) : (
          <p className="planner-copy-sm mt-2 text-app-muted">Select a trip to preview it.</p>
        )}
      </section>
    </div>
  );
}
