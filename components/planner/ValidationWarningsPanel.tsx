"use client";

import { ValidationWarning } from "@/types/trip";

type ValidationWarningsPanelProps = {
  warnings: ValidationWarning[];
};

const severityTone = {
  high: "border-rose-200 bg-rose-50 text-rose-800",
  medium: "border-amber-200 bg-amber-50 text-amber-800",
  low: "border-slate-200 bg-slate-50 text-slate-700",
} as const;

export default function ValidationWarningsPanel({
  warnings,
}: ValidationWarningsPanelProps) {
  if (warnings.length === 0) {
    return (
      <section className="rounded-[24px] border border-emerald-200 bg-emerald-50/80 px-4 py-4 text-emerald-900 sm:px-5 sm:py-5">
        <p className="planner-eyebrow text-emerald-700">Planning warnings</p>
        <p className="planner-copy mt-3 font-medium">
          Route realism and itinerary validation look healthy for the current plan.
        </p>
      </section>
    );
  }

  return (
    <section className="rounded-[24px] border border-slate-200/80 bg-white px-4 py-4 sm:px-5 sm:py-5">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <p className="planner-eyebrow text-amber-700">Planning warnings</p>
          <p className="planner-copy mt-2 text-slate-600">
            Review anything that could affect timing, coverage, or trip confidence.
          </p>
        </div>
        <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-600">
          {warnings.length}
        </span>
      </div>

      <ul className="space-y-2">
        {warnings.map((warning) => (
          <li
            key={warning.id}
            className={`rounded-[18px] border px-3.5 py-3 ${severityTone[warning.severity]}`}
          >
            <div className="flex items-center justify-between gap-3">
              <p className="planner-title-sm">{warning.label}</p>
              <span className="rounded-full border border-current/20 bg-white/60 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.08em]">
                {warning.severity}
              </span>
            </div>
            <p className="planner-copy-sm mt-1">{warning.detail}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
