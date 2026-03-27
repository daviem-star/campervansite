"use client";

import { FormEvent, useState } from "react";

import { formatDateTime } from "@/lib/date";
import { Trip } from "@/types/trip";

type TripLandingProps = {
  trips: Trip[];
  activeTripId: string;
  isBusy: boolean;
  error: string | null;
  onOpenTrip: (tripId: string) => void;
  onCreateTrip: (name: string) => Promise<void>;
  onDeleteTrip: (tripId: string) => Promise<void>;
  onLoadAlignedSeed: () => Promise<void>;
  onExportData: () => void;
  onImportData: () => void;
};

export default function TripLanding({
  trips,
  activeTripId,
  isBusy,
  error,
  onOpenTrip,
  onCreateTrip,
  onDeleteTrip,
  onLoadAlignedSeed,
  onExportData,
  onImportData,
}: TripLandingProps) {
  const [tripName, setTripName] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (tripName.trim().length === 0 || isCreating) {
      return;
    }

    setIsCreating(true);
    try {
      await onCreateTrip(tripName.trim());
      setTripName("");
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="min-h-screen bg-ui-bg px-4 py-8 text-slate-100">
      <div className="mx-auto w-full max-w-4xl space-y-4">
        <header className="rounded-3xl border border-ui-border bg-ui-surface p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">Campervan Planner</p>
          <h1 className="mt-2 text-2xl font-semibold text-slate-100">Choose a trip or start a new one</h1>
          <p className="mt-2 text-sm text-slate-300">
            Trips are stored in this browser. Export JSON if you want a backup or to move data.
          </p>
          {error ? (
            <p className="mt-3 rounded-xl border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">
              {error}
            </p>
          ) : null}
        </header>

        <section className="rounded-3xl border border-ui-border bg-ui-surface-alt p-5 shadow-sm">
          <h2 className="text-sm font-semibold uppercase tracking-[0.08em] text-slate-400">Create new trip</h2>
          <form onSubmit={handleSubmit} className="mt-3 flex flex-col gap-3 sm:flex-row">
            <input
              type="text"
              value={tripName}
              onChange={(event) => setTripName(event.target.value)}
              placeholder="Trip name"
              className="h-11 flex-1 rounded-xl border border-ui-border bg-ui-overlay px-3 text-sm text-slate-100 placeholder:text-slate-500"
              disabled={isBusy || isCreating}
            />
            <button
              type="submit"
              disabled={isBusy || isCreating || tripName.trim().length === 0}
              className="h-11 rounded-xl border border-ui-accent-border bg-ui-accent-strong px-4 text-sm font-semibold text-white transition hover:bg-ui-accent-deep disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isCreating ? "Creating..." : "Create trip"}
            </button>
          </form>
        </section>

        <section className="rounded-3xl border border-ui-border bg-ui-surface-alt p-5 shadow-sm">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="mr-auto text-sm font-semibold uppercase tracking-[0.08em] text-slate-400">Your trips</h2>
            <button
              type="button"
              onClick={onLoadAlignedSeed}
              className="rounded-lg border border-ui-border-soft bg-ui-overlay px-3 py-1.5 text-xs font-semibold text-slate-200 transition hover:border-slate-400"
            >
              Load aligned seed
            </button>
            <button
              type="button"
              onClick={onExportData}
              className="rounded-lg border border-ui-border-soft bg-ui-overlay px-3 py-1.5 text-xs font-semibold text-slate-200 transition hover:border-slate-400"
            >
              Export JSON
            </button>
            <button
              type="button"
              onClick={onImportData}
              className="rounded-lg border border-ui-border-soft bg-ui-overlay px-3 py-1.5 text-xs font-semibold text-slate-200 transition hover:border-slate-400"
            >
              Import JSON
            </button>
          </div>

          <div className="mt-3 space-y-2">
            {trips.map((trip) => (
              <div
                key={trip.id}
                className={`flex flex-col gap-2 rounded-xl border p-3 sm:flex-row sm:items-center ${
                  activeTripId === trip.id
                    ? "border-ui-accent-border bg-ui-accent-subtle"
                    : "border-ui-border bg-ui-raised"
                }`}
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-slate-100">
                    {trip.name}{" "}
                    {activeTripId === trip.id ? (
                      <span className="ml-1 rounded-md border border-ui-accent-border bg-ui-accent-subtle px-1.5 py-0.5 text-[10px] uppercase tracking-[0.08em] text-cyan-200">
                        Active
                      </span>
                    ) : null}
                  </p>
                  <p className="truncate text-xs text-slate-400">
                    {trip.stops.length} {trip.stops.length === 1 ? "stop" : "stops"} • Updated {formatDateTime(trip.updatedAt)}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => onOpenTrip(trip.id)}
                    className="rounded-lg border border-ui-accent-border bg-ui-accent-strong px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-ui-accent-deep"
                  >
                    Open
                  </button>
                  {trips.length > 1 ? (
                    <button
                      type="button"
                      onClick={() => void onDeleteTrip(trip.id)}
                      className="rounded-lg border border-rose-500/40 bg-rose-500/10 px-3 py-1.5 text-xs font-semibold text-rose-200 transition hover:bg-rose-500/20"
                    >
                      Delete
                    </button>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
