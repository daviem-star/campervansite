"use client";

type TripHeaderProps = {
  tripName: string;
  homeLabel: string;
  dateRangeLabel: string;
  totalNights: number;
  totalCost: number;
  warningCount: number;
  routeConfidenceLabel: string;
};

export default function TripHeader({
  tripName,
  homeLabel,
  dateRangeLabel,
  totalNights,
  totalCost,
  warningCount,
  routeConfidenceLabel,
}: TripHeaderProps) {
  const warningValue = warningCount === 0 ? "Clear" : `${warningCount} open`;
  const warningDetail = warningCount === 0 ? "No issues surfaced" : "Needs review";

  return (
    <header className="relative shrink-0 overflow-hidden rounded-[28px] border border-brand-primary/15 bg-[linear-gradient(145deg,rgb(var(--color-brand-primary)_/_0.08),rgb(var(--color-app-surface))_42%,rgb(var(--color-brand-secondary)_/_0.08))] px-5 py-5 shadow-[0_24px_60px_rgb(var(--color-app-overlay)_/_0.08)] sm:px-6 sm:py-6">
      <div className="pointer-events-none absolute -left-10 top-0 h-28 w-28 rounded-full bg-brand-primary/10 blur-3xl" />
      <div className="pointer-events-none absolute right-0 top-0 h-32 w-32 rounded-full bg-brand-secondary/15 blur-3xl" />

      <div className="relative z-10 min-w-0">
        <p className="planner-eyebrow planner-section-label">Trip overview</p>
        <h2 className="planner-title-xl mt-3 text-app-text">{tripName}</h2>
        <div className="planner-copy mt-3 flex flex-wrap items-center gap-2 text-app-muted">
          <span>{dateRangeLabel}</span>
          <span className="hidden text-app-border sm:inline">/</span>
          <span>Home base: {homeLabel}</span>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-[20px] border border-app-border/70 bg-app-surface/85 px-4 py-3.5 shadow-[0_10px_30px_rgb(var(--color-app-overlay)_/_0.05)] backdrop-blur-sm">
            <p className="planner-eyebrow text-app-muted">Nights</p>
            <p className="planner-title-lg mt-2 text-app-text">
              {totalNights} night{totalNights === 1 ? "" : "s"}
            </p>
            <p className="planner-copy-sm mt-1 text-app-muted">Trip length</p>
          </div>

          <div className="rounded-[20px] border border-app-border/70 bg-app-surface/85 px-4 py-3.5 shadow-[0_10px_30px_rgb(var(--color-app-overlay)_/_0.05)] backdrop-blur-sm">
            <p className="planner-eyebrow text-app-muted">Estimated cost</p>
            <p className="planner-title-lg mt-2 text-app-text">GBP {totalCost.toFixed(2)}</p>
            <p className="planner-copy-sm mt-1 text-app-muted">Current stay total</p>
          </div>

          <div
            className={`rounded-[20px] border px-4 py-3.5 shadow-[0_10px_30px_rgb(var(--color-app-overlay)_/_0.05)] backdrop-blur-sm ${
              warningCount === 0
                ? "border-state-success-border/60 bg-state-success-surface/80"
                : "border-state-warning-border/60 bg-state-warning-surface/80"
            }`}
          >
            <p className="planner-eyebrow text-app-muted">Warnings</p>
            <p className="planner-title-lg mt-2 text-app-text">{warningValue}</p>
            <p className="planner-copy-sm mt-1 text-app-muted">{warningDetail}</p>
          </div>

          <div className="rounded-[20px] border border-brand-primary/15 bg-brand-primary/10 px-4 py-3.5 shadow-[0_10px_30px_rgb(var(--color-app-overlay)_/_0.05)] backdrop-blur-sm">
            <p className="planner-eyebrow text-app-muted">Routing confidence</p>
            <p className="planner-title-lg mt-2 text-app-text">{routeConfidenceLabel}</p>
            <p className="planner-copy-sm mt-1 text-app-muted">Current route signal</p>
          </div>
        </div>
      </div>
    </header>
  );
}
