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
  "rounded-xl border px-3 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50";

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
    <section className="overflow-hidden rounded-[24px] border border-slate-200/80 bg-white lg:flex lg:h-full lg:min-h-0 lg:flex-col">
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-200 px-4 py-4 sm:px-5 sm:py-5">
        <div>
          <p className="planner-eyebrow text-teal-700">Trip library</p>
          <h2 className="planner-title-lg mt-2 text-slate-950">Manage your trips</h2>
          <p className="planner-copy mt-2 max-w-2xl text-slate-600">
            Open, rename, or start a fresh plan without leaving the planner.
          </p>
        </div>

        <button
          type="button"
          onClick={onCreateTrip}
          disabled={isWorking || isOfflineReadOnly}
          className="rounded-xl bg-teal-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-teal-800 disabled:cursor-not-allowed disabled:bg-slate-400"
        >
          New trip
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 px-4 py-3.5 sm:px-5">
        <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-600">
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
        <p className="planner-copy mx-4 mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-amber-800 sm:mx-5">
          Trip switching and trip management stay locked while the planner is using the cached
          offline copy.
        </p>
      ) : null}

      <div
        data-testid="trips-scroll-region"
        className="divide-y divide-slate-200 lg:min-h-0 lg:flex-1 lg:overflow-y-auto"
      >
        {trips.length === 0 ? (
          <div className="planner-copy m-4 rounded-[18px] border border-dashed border-slate-300 bg-slate-50 px-4 py-5 text-slate-600 sm:m-5">
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
              className={`px-4 py-4 transition sm:px-5 ${
                isActive
                  ? "bg-teal-50/80 text-slate-950"
                  : "bg-white text-slate-900"
              }`}
            >
              <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="planner-title-md">{trip.name}</h3>
                    {isActive ? (
                      <span className="rounded-full border border-teal-200 bg-white px-2.5 py-0.5 text-[11px] font-semibold text-teal-700">
                        Open now
                      </span>
                    ) : null}
                  </div>
                  <p className="planner-copy mt-2 text-slate-600">
                    Updated {formatDateTime(trip.updatedAt)}
                  </p>
                  <p className="planner-meta mt-1 text-slate-500">
                    Version {trip.version}
                    {trip.lastSyncedAt ? ` · Last synced ${formatDateTime(trip.lastSyncedAt)}` : ""}
                  </p>
                </div>

                <div className="flex flex-wrap gap-2 xl:justify-end">
                  <button
                    type="button"
                    onClick={() => void onOpenTrip(trip.id)}
                    disabled={isWorking || isOfflineReadOnly || isActive}
                    className={`${actionButtonClass} ${
                      isActive
                        ? "border-slate-200 bg-white text-slate-400"
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
                        ? "border-teal-200 bg-white text-teal-700 hover:bg-teal-50"
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
                        ? "border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100"
                        : "border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100"
                    }`}
                  >
                    Delete
                  </button>
                </div>
              </div>

              {isOnlyTrip ? (
                <p className="planner-meta mt-3 text-slate-500">
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
