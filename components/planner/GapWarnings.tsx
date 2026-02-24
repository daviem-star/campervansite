"use client";

import { GapWarning } from "@/types/trip";

type GapWarningsProps = {
  warnings: GapWarning[];
};

export default function GapWarnings({ warnings }: GapWarningsProps) {
  if (warnings.length === 0) {
    return (
      <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
        Base campsite coverage is continuous for the current itinerary.
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3">
      <p className="text-sm font-semibold text-amber-900">Base location gaps detected</p>
      <ul className="mt-2 space-y-1">
        {warnings.map((warning) => (
          <li key={warning.date} className="text-xs text-amber-800">
            {warning.label}
          </li>
        ))}
      </ul>
    </div>
  );
}
