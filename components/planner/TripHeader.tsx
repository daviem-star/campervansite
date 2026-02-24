"use client";

type TripHeaderProps = {
  tripName: string;
  homeLabel: string;
  dateRangeLabel: string;
  totalNights: number;
  totalCost: number;
  onResetSeed: () => Promise<void>;
  onResetSeedAlignedToToday: () => Promise<void>;
};

export default function TripHeader({
  tripName,
  homeLabel,
  dateRangeLabel,
  totalNights,
  totalCost,
  onResetSeed,
  onResetSeedAlignedToToday,
}: TripHeaderProps) {
  return (
    <header className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-2 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">{tripName}</h1>
          <p className="mt-1 text-sm text-slate-600">{dateRangeLabel}</p>
        </div>

        <div className="flex flex-col items-end gap-2">
          <button
            type="button"
            onClick={onResetSeed}
            className="rounded-xl border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-100"
          >
            Reset seed data
          </button>
          <button
            type="button"
            onClick={onResetSeedAlignedToToday}
            className="rounded-xl border border-sky-300 bg-sky-50 px-3 py-1.5 text-xs font-semibold text-sky-700 transition hover:bg-sky-100"
          >
            Make trip happen now
          </button>
        </div>
      </div>

      <div className="grid gap-2 text-sm sm:grid-cols-3">
        <div className="rounded-xl bg-slate-50 px-3 py-2">
          <p className="text-xs text-slate-500">Home pin</p>
          <p className="font-medium text-slate-800">{homeLabel}</p>
        </div>
        <div className="rounded-xl bg-slate-50 px-3 py-2">
          <p className="text-xs text-slate-500">Total nights</p>
          <p className="font-medium text-slate-800">{totalNights}</p>
        </div>
        <div className="rounded-xl bg-slate-50 px-3 py-2">
          <p className="text-xs text-slate-500">Estimated stay cost</p>
          <p className="font-medium text-slate-800">GBP {totalCost.toFixed(2)}</p>
        </div>
      </div>
    </header>
  );
}
