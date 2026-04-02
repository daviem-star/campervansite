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
    <header className="rounded-[24px] border border-slate-200/80 bg-white px-4 py-4 sm:px-5 sm:py-5">
      <div className="min-w-0">
        <p className="planner-eyebrow text-teal-700">Active trip</p>
        <h2 className="planner-title-lg mt-2 text-slate-950">{tripName}</h2>
        <div className="planner-copy mt-3 flex flex-wrap items-center gap-2 text-slate-600">
          <span>{dateRangeLabel}</span>
          <span className="hidden text-slate-300 sm:inline">/</span>
          <span>Home base: {homeLabel}</span>
          <span className="hidden text-slate-300 sm:inline">/</span>
          <span>{totalNights} night{totalNights === 1 ? "" : "s"}</span>
          <span className="hidden text-slate-300 sm:inline">/</span>
          <span>Estimated stay cost: GBP {totalCost.toFixed(2)}</span>
        </div>
      </div>
    </header>
  );
}
