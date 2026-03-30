"use client";

type FirstTripSetupPanelProps = {
  isWorking: boolean;
  onImportLocalTrip: () => Promise<void>;
  onStartWithExampleTrip: () => Promise<void>;
  onSignOut: () => Promise<void>;
};

export default function FirstTripSetupPanel({
  isWorking,
  onImportLocalTrip,
  onStartWithExampleTrip,
  onSignOut,
}: FirstTripSetupPanelProps) {
  return (
    <div className="mx-auto max-w-3xl rounded-[2rem] border border-slate-200 bg-white p-8 shadow-sm">
        <span className="inline-flex rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.12em] text-amber-700">
          First Trip Setup
        </span>
        <h1 className="mt-5 text-3xl font-semibold tracking-tight text-slate-950">
          Choose how this account should start.
        </h1>
        <p className="mt-4 text-base leading-7 text-slate-600">
          We found local trip data in this browser, but your signed-in cloud account does not have
          a trip yet. Pick one path to initialize the planner.
        </p>

        <div className="mt-8 grid gap-4 lg:grid-cols-2">
          <section className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
            <p className="text-lg font-semibold text-slate-950">Import local trip</p>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              Bring your existing local itinerary into cloud sync so you can keep working from what
              you already planned.
            </p>
            <button
              type="button"
              onClick={() => void onImportLocalTrip()}
              disabled={isWorking}
              className="mt-5 rounded-2xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400"
            >
              {isWorking ? "Working..." : "Import local trip"}
            </button>
          </section>

          <section className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
            <p className="text-lg font-semibold text-slate-950">Start with example trip</p>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              Create a fresh cloud-backed copy of the example itinerary, then tailor it in the
              planner once you unlock edit mode.
            </p>
            <button
              type="button"
              onClick={() => void onStartWithExampleTrip()}
              disabled={isWorking}
              className="mt-5 rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-800 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isWorking ? "Working..." : "Start with example trip"}
            </button>
          </section>
        </div>

        <button
          type="button"
          onClick={() => void onSignOut()}
          disabled={isWorking}
          className="mt-8 rounded-2xl border border-slate-300 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
        >
          Sign out instead
        </button>
    </div>
  );
}
