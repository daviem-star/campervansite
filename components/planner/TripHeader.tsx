"use client";

type TripHeaderProps = {
  tripName: string;
  homeLabel: string;
  dateRangeLabel: string;
  totalNights: number;
  totalCost: number;
};

export default function TripHeader({
  tripName,
  homeLabel,
  dateRangeLabel,
  totalNights,
  totalCost,
}: TripHeaderProps) {
  return (
    <header className="rounded-[24px] border border-app-border/80 bg-app-surface px-4 py-4 sm:px-5 sm:py-5">
      <div className="min-w-0">
        <p className="planner-eyebrow planner-section-label">Active trip</p>
        <h2 className="planner-title-lg mt-2 text-app-text">{tripName}</h2>
        <div className="planner-copy mt-3 flex flex-wrap items-center gap-2 text-app-muted">
          <span>{dateRangeLabel}</span>
          <span className="hidden text-app-border sm:inline">/</span>
          <span>Home base: {homeLabel}</span>
          <span className="hidden text-app-border sm:inline">/</span>
          <span>{totalNights} night{totalNights === 1 ? "" : "s"}</span>
          <span className="hidden text-app-border sm:inline">/</span>
          <span>Estimated stay cost: GBP {totalCost.toFixed(2)}</span>
        </div>
      </div>
    </header>
  );
}
