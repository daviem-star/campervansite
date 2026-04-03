"use client";

import { formatDateTime } from "@/lib/date";
import { TripSummary } from "@/types/trip";

type TripsPanelProps = {
  trips: TripSummary[];
  loadedTripId: string | null;
  previewTripId: string | null;
  activeTripId: string | null;
  hasLegacyImport: boolean;
  isOfflineReadOnly: boolean;
  isWorking: boolean;
  isPreviewingTripId: string | null;
  isActivatingTripId: string | null;
  onCreateTrip: () => void;
  onImportLegacyTrips: () => Promise<void>;
  onPreviewTrip: (tripId: string) => Promise<void>;
  onToggleActiveTrip: (tripId: string) => Promise<void>;
  onOpenTrip: (tripId: string) => Promise<void>;
  onRenameTrip: (trip: TripSummary) => void;
  onDeleteTrip: (trip: TripSummary) => Promise<void>;
};

const actionButtonClass =
  "rounded-xl border px-3 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50";

export default function TripsPanel({
  trips,
  loadedTripId,
  previewTripId,
  activeTripId,
  hasLegacyImport,
  isOfflineReadOnly,
  isWorking,
  isPreviewingTripId,
  isActivatingTripId,
  onCreateTrip,
  onImportLegacyTrips,
  onPreviewTrip,
  onToggleActiveTrip,
  onOpenTrip,
  onRenameTrip,
  onDeleteTrip,
}: TripsPanelProps) {
  return (
    <section className="overflow-hidden rounded-[24px] border border-app-border/80 bg-app-surface lg:flex lg:h-full lg:min-h-0 lg:flex-col">
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-app-border px-4 py-4 sm:px-5 sm:py-5">
        <div>
          <p className="planner-eyebrow planner-section-label">Trip library</p>
          <h2 className="planner-title-lg mt-2 text-app-text">Manage your trips</h2>
          <p className="planner-copy mt-2 max-w-2xl text-app-muted">
            Click any trip to preview it, open the one you want to work on, and set an active trip
            for Today.
          </p>
        </div>

        <button
          type="button"
          onClick={onCreateTrip}
          disabled={isWorking || isOfflineReadOnly}
          className="planner-button-primary rounded-xl border px-4 py-2 text-sm font-semibold transition disabled:cursor-not-allowed"
        >
          New trip
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-2 border-b border-app-border px-4 py-3.5 sm:px-5">
        <span className="planner-pill rounded-full border px-3 py-1 text-xs font-semibold">
          {trips.length} {trips.length === 1 ? "trip" : "trips"}
        </span>

        {hasLegacyImport ? (
          <button
            type="button"
            onClick={() => void onImportLegacyTrips()}
            disabled={isWorking || isOfflineReadOnly}
            className={`${actionButtonClass} tone-info`}
          >
            Import local trips
          </button>
        ) : null}
      </div>

      {isOfflineReadOnly ? (
        <p className="planner-copy tone-warning mx-4 mt-4 rounded-xl border px-4 py-3 sm:mx-5">
          Trip switching and trip management stay locked while the planner is using the cached
          offline copy.
        </p>
      ) : null}

      <div
        data-testid="trips-scroll-region"
        className="divide-y divide-app-border lg:min-h-0 lg:flex-1 lg:overflow-y-auto"
      >
        {trips.length === 0 ? (
          <div className="planner-copy m-4 rounded-[18px] border border-dashed border-app-border bg-app-surface-muted px-4 py-5 text-app-muted sm:m-5">
            No cloud trips are available yet.
          </div>
        ) : null}

        {trips.map((trip) => {
          const isLoaded = trip.id === loadedTripId;
          const isPreviewed = trip.id === previewTripId;
          const isActive = trip.id === activeTripId;
          const isOnlyTrip = trips.length === 1;
          const isPreviewing = trip.id === isPreviewingTripId;
          const isActivating = trip.id === isActivatingTripId;

          return (
            <article
              key={trip.id}
              data-testid={`trip-summary-${trip.id}`}
              onClick={() => void onPreviewTrip(trip.id)}
              className={`cursor-pointer px-4 py-4 transition sm:px-5 ${
                isPreviewed
                  ? "bg-brand-primary/10 text-app-text"
                  : "bg-app-surface text-app-text hover:bg-app-surface-muted/60"
              }`}
            >
              <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="planner-title-md">{trip.name}</h3>
                    {isLoaded ? (
                      <span className="planner-pill-active rounded-full border bg-app-surface px-2.5 py-0.5 text-[11px] font-semibold">
                        Loaded
                      </span>
                    ) : null}
                    {isActive ? (
                      <span className="rounded-full border border-state-info-border bg-state-info-surface px-2.5 py-0.5 text-[11px] font-semibold text-state-info">
                        Active
                      </span>
                    ) : null}
                    {isPreviewed ? (
                      <span className="planner-pill rounded-full border bg-app-surface px-2.5 py-0.5 text-[11px] font-semibold">
                        Previewed
                      </span>
                    ) : null}
                  </div>
                  <p className="planner-copy mt-2 text-app-muted">
                    Updated {formatDateTime(trip.updatedAt)}
                  </p>
                  <p className="planner-meta mt-1 text-app-muted">
                    Version {trip.version}
                    {trip.lastSyncedAt ? ` · Last synced ${formatDateTime(trip.lastSyncedAt)}` : ""}
                  </p>
                  {isPreviewing ? (
                    <p className="planner-meta mt-2 text-brand-primary">Loading preview...</p>
                  ) : null}
                </div>

                <div className="flex flex-wrap gap-2 xl:justify-end">
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      void onToggleActiveTrip(trip.id);
                    }}
                    disabled={isWorking || isOfflineReadOnly || isActivating}
                    className={`${actionButtonClass} ${
                      isActive
                        ? "border-state-info-border bg-state-info-surface text-state-info"
                        : "planner-button-secondary border"
                    }`}
                  >
                    {isActivating ? "Updating..." : isActive ? "Clear active" : "Set active"}
                  </button>
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      void onOpenTrip(trip.id);
                    }}
                    disabled={isWorking || isOfflineReadOnly || isLoaded}
                    className={`${actionButtonClass} ${
                      isLoaded
                        ? "border-app-border bg-app-surface text-app-muted"
                        : "planner-button-secondary border"
                    }`}
                  >
                    Open
                  </button>
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      onRenameTrip(trip);
                    }}
                    disabled={isWorking || isOfflineReadOnly}
                    className={`${actionButtonClass} ${
                      isLoaded
                        ? "border-brand-primary/25 bg-brand-primary/10 text-brand-primary hover:bg-brand-primary/16"
                        : "planner-button-secondary border"
                    }`}
                  >
                    Rename
                  </button>
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      void onDeleteTrip(trip);
                    }}
                    disabled={isWorking || isOfflineReadOnly || isOnlyTrip}
                    className={`${actionButtonClass} planner-button-danger`}
                  >
                    Delete
                  </button>
                </div>
              </div>

              {isOnlyTrip ? (
                <p className="planner-meta mt-3 text-app-muted">
                  Create another trip before deleting this one.
                </p>
              ) : null}
            </article>
          );
        })}
      </div>
    </section>
  );
}
