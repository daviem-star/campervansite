"use client";

import { GapWarning } from "@/types/trip";

type GapWarningsProps = {
  warnings: GapWarning[];
};

export default function GapWarnings({ warnings }: GapWarningsProps) {
  if (warnings.length === 0) {
    return (
      <section className="rounded-[24px] border border-emerald-200 bg-emerald-50/80 px-4 py-4 text-emerald-900 sm:px-5 sm:py-5">
        <p className="planner-eyebrow text-emerald-700">Base coverage</p>
        <p className="planner-copy mt-3 font-medium">
          Base campsite coverage is continuous for the current itinerary.
        </p>
      </section>
    );
  }

  return (
    <section className="rounded-[24px] border border-amber-200 bg-amber-50/80 px-4 py-4 sm:px-5 sm:py-5">
      <p className="planner-eyebrow text-amber-700">Base coverage</p>
      <p className="planner-title-sm mt-3 text-amber-950">Base location gaps detected</p>
      <ul className="mt-3 space-y-2">
        {warnings.map((warning) => (
          <li
            key={warning.date}
            className="planner-copy-sm rounded-[18px] border border-amber-200/80 bg-white/40 px-3 py-2 text-amber-900"
          >
            {warning.label}
          </li>
        ))}
      </ul>
    </section>
  );
}
