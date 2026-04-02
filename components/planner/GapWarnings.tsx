"use client";

import { GapWarning } from "@/types/trip";

type GapWarningsProps = {
  warnings: GapWarning[];
};

export default function GapWarnings({ warnings }: GapWarningsProps) {
  if (warnings.length === 0) {
    return (
      <section className="tone-success rounded-[24px] border px-4 py-4 sm:px-5 sm:py-5">
        <p className="planner-eyebrow text-state-success">Base coverage</p>
        <p className="planner-copy mt-3 font-medium">
          Base campsite coverage is continuous for the current itinerary.
        </p>
      </section>
    );
  }

  return (
    <section className="tone-warning rounded-[24px] border px-4 py-4 sm:px-5 sm:py-5">
      <p className="planner-eyebrow text-state-warning">Base coverage</p>
      <p className="planner-title-sm mt-3 text-state-warning">Base location gaps detected</p>
      <ul className="mt-3 space-y-2">
        {warnings.map((warning) => (
          <li
            key={warning.date}
            className="planner-copy-sm rounded-[18px] border border-white/35 bg-white/35 px-3 py-2 text-state-warning"
          >
            {warning.label}
          </li>
        ))}
      </ul>
    </section>
  );
}
