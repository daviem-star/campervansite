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
    <div className="mx-auto max-w-3xl rounded-[2rem] border border-app-border bg-app-surface p-8 shadow-sm">
      <span className="tone-warning planner-eyebrow inline-flex rounded-full border px-3 py-1">
        First Trip Setup
      </span>
      <h1 className="planner-title-hero mt-5 text-app-text">Choose how this account should start.</h1>
      <p className="planner-copy mt-4 text-app-muted">
        We found local trip data in this browser, but your signed-in cloud account does not have a
        trip yet. Pick one path to initialize the planner.
      </p>

      <div className="mt-8 grid gap-4 lg:grid-cols-2">
        <section className="rounded-3xl border border-app-border bg-app-surface-muted p-5">
          <p className="planner-title-lg text-app-text">Import local trip</p>
          <p className="planner-copy mt-3 text-app-muted">
            Bring your existing local itinerary into cloud sync so you can keep working from what
            you already planned.
          </p>
          <button
            type="button"
            onClick={() => void onImportLocalTrip()}
            disabled={isWorking}
            className="planner-button-primary mt-5 rounded-2xl border px-4 py-3 text-sm font-semibold transition disabled:cursor-not-allowed"
          >
            {isWorking ? "Working..." : "Import local trip"}
          </button>
        </section>

        <section className="rounded-3xl border border-app-border bg-app-surface-muted p-5">
          <p className="planner-title-lg text-app-text">Start with example trip</p>
          <p className="planner-copy mt-3 text-app-muted">
            Create a fresh cloud-backed copy of the example itinerary, then tailor it in the
            planner once you unlock edit mode.
          </p>
          <button
            type="button"
            onClick={() => void onStartWithExampleTrip()}
            disabled={isWorking}
            className="planner-button-secondary mt-5 rounded-2xl border px-4 py-3 text-sm font-semibold transition disabled:cursor-not-allowed"
          >
            {isWorking ? "Working..." : "Start with example trip"}
          </button>
        </section>
      </div>

      <button
        type="button"
        onClick={() => void onSignOut()}
        disabled={isWorking}
        className="planner-button-secondary mt-8 rounded-2xl border px-4 py-3 text-sm font-semibold transition disabled:cursor-not-allowed"
      >
        Sign out instead
      </button>
    </div>
  );
}
