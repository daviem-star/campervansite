"use client";

import { formatDateTime } from "@/lib/date";
import { TripSummary } from "@/types/trip";

type TripsPanelProps = {
  trips: TripSummary[];
  activeTripId: string;
  hasLegacyImport: boolean;
  isOfflineReadOnly: boolean;
  isWorking: boolean;
  onCreateTrip: () => void;
  onImportLegacyTrips: () => Promise<void>;
  onOpenTrip: (tripId: string) => Promise<void>;
  onRenameTrip: (trip: TripSummary) => void;
  onDeleteTrip: (trip: TripSummary) => Promise<void>;
};

const actionButtonClass =
  "rounded-2xl border px-3 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50";

export default function TripsPanel({
  trips,
  activeTripId,
  hasLegacyImport,
  isOfflineReadOnly,
  isWorking,
  onCreateTrip,
  onImportLegacyTrips,
  onOpenTrip,
  onRenameTrip,
  onDeleteTrip,
}: TripsPanelProps) {
  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm lg:flex lg:h-full lg:min-h-0 lg:flex-col">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
            Trips
          </p>
          <h2 className="mt-2 text-xl font-semibold text-slate-950">Manage your trip library</h2>
          <p className="mt-2 text-sm text-slate-600">
            Open another trip, rename it, or start a fresh plan without leaving the current
            workspace model.
          </p>
        </div>

        <button
          type="button"
          onClick={onCreateTrip}
          disabled={isWorking || isOfflineReadOnly}
          className="rounded-2xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400"
        >
          New trip
        </button>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-semibold text-slate-600">
          {trips.length} {trips.length === 1 ? "trip" : "trips"}
        </span>

        {hasLegacyImport ? (
          <button
            type="button"
            onClick={() => void onImportLegacyTrips()}
            disabled={isWorking || isOfflineReadOnly}
            className={`${actionButtonClass} border-sky-200 bg-sky-50 text-sky-700 hover:bg-sky-100`}
          >
            Import local trips
          </button>
        ) : null}
      </div>

      {isOfflineReadOnly ? (
        <p className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Trip switching and trip management stay locked while the planner is using the cached
          offline copy.
        </p>
      ) : null}

      <div
        data-testid="trips-scroll-region"
        className="mt-4 space-y-3 lg:min-h-0 lg:flex-1 lg:overflow-y-auto lg:pr-1"
      >
        {trips.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-slate-300 bg-slate-50 px-5 py-6 text-sm text-slate-600">
            No cloud trips are available yet.
          </div>
        ) : null}

        {trips.map((trip) => {
          const isActive = trip.id === activeTripId;
          const isOnlyTrip = trips.length === 1;

          return (
            <article
              key={trip.id}
              data-testid={`trip-summary-${trip.id}`}
              className={`rounded-3xl border p-4 transition ${
                isActive
                  ? "border-slate-950 bg-slate-950 text-white shadow-lg shadow-slate-950/10"
                  : "border-slate-200 bg-white text-slate-900 shadow-sm"
              }`}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-lg font-semibold">{trip.name}</h3>
                    {isActive ? (
                      <span className="rounded-full border border-white/20 bg-white/10 px-2.5 py-0.5 text-[11px] font-semibold text-white">
                        Open now
                      </span>
                    ) : null}
                  </div>
                  <p className={`mt-2 text-sm ${isActive ? "text-white/75" : "text-slate-600"}`}>
                    Updated {formatDateTime(trip.updatedAt)}
                  </p>
                  <p className={`mt-1 text-xs ${isActive ? "text-white/60" : "text-slate-500"}`}>
                    Version {trip.version}
                    {trip.lastSyncedAt ? ` · Last synced ${formatDateTime(trip.lastSyncedAt)}` : ""}
                  </p>
                </div>

                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => void onOpenTrip(trip.id)}
                    disabled={isWorking || isOfflineReadOnly || isActive}
                    className={`${actionButtonClass} ${
                      isActive
                        ? "border-white/20 bg-white/10 text-white hover:bg-white/15"
                        : "border-slate-300 bg-white text-slate-700 hover:bg-slate-100"
                    }`}
                  >
                    Open
                  </button>
                  <button
                    type="button"
                    onClick={() => onRenameTrip(trip)}
                    disabled={isWorking || isOfflineReadOnly}
                    className={`${actionButtonClass} ${
                      isActive
                        ? "border-white/20 bg-white/10 text-white hover:bg-white/15"
                        : "border-slate-300 bg-white text-slate-700 hover:bg-slate-100"
                    }`}
                  >
                    Rename
                  </button>
                  <button
                    type="button"
                    onClick={() => void onDeleteTrip(trip)}
                    disabled={isWorking || isOfflineReadOnly || isOnlyTrip}
                    className={`${actionButtonClass} ${
                      isActive
                        ? "border-rose-300/40 bg-rose-400/10 text-rose-100 hover:bg-rose-400/20"
                        : "border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100"
                    }`}
                  >
                    Delete
                  </button>
                </div>
              </div>

              {isOnlyTrip ? (
                <p className={`mt-3 text-xs ${isActive ? "text-white/60" : "text-slate-500"}`}>
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
