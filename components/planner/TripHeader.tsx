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
    <header className="rounded-3xl border border-ui-border bg-ui-raised p-5 shadow-sm">
      <div className="mb-2">
        <div>
          <h1 className="text-2xl font-semibold text-slate-100">{tripName}</h1>
          <p className="mt-1 text-sm text-slate-300">{dateRangeLabel}</p>
        </div>
      </div>

      <div className="mt-3 rounded-xl border border-ui-border bg-ui-surface-alt px-3 py-2">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-400">Trip details</p>
          <p className="text-xs text-slate-400">Home pin, total nights, and stay costs</p>
        </div>

        <div className="mt-3 grid gap-2 text-sm sm:grid-cols-3">
          <div className="rounded-xl border border-ui-border bg-ui-raised px-3 py-2">
            <p className="text-xs text-slate-400">Home pin</p>
            <p className="font-medium text-slate-100">{homeLabel}</p>
          </div>
          <div className="rounded-xl border border-ui-border bg-ui-raised px-3 py-2">
            <p className="text-xs text-slate-400">Total nights</p>
            <p className="font-medium text-slate-100">{totalNights}</p>
          </div>
          <div className="rounded-xl border border-ui-border bg-ui-raised px-3 py-2">
            <p className="text-xs text-slate-400">Estimated stay cost</p>
            <p className="font-medium text-slate-100">GBP {totalCost.toFixed(2)}</p>
          </div>
        </div>
      </div>
    </header>
  );
}
