"use client";

import { GapWarning } from "@/types/trip";

type GapWarningsProps = {
  warnings: GapWarning[];
};

export default function GapWarnings({ warnings }: GapWarningsProps) {
  if (warnings.length === 0) {
    return (
      <div className="rounded-2xl border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-200">
        Base campsite coverage is continuous for the current itinerary.
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-amber-500/50 bg-amber-500/12 p-3">
      <p className="text-sm font-semibold text-amber-200">Base location gaps detected</p>
      <ul className="mt-2 space-y-1">
        {warnings.map((warning) => (
          <li key={warning.date} className="text-xs text-amber-100">
            {warning.label}
          </li>
        ))}
      </ul>
    </div>
  );
}
