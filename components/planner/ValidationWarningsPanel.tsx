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
      <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
        Route realism and itinerary validation look healthy for the current plan.
      </div>
    );
  }

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-900">Planning warnings</h3>
        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600">
          {warnings.length}
        </span>
      </div>

      <ul className="space-y-2">
        {warnings.map((warning) => (
          <li
            key={warning.id}
            className={`rounded-xl border px-3 py-2 ${severityTone[warning.severity]}`}
          >
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-semibold">{warning.label}</p>
              <span className="rounded-full border border-current/20 bg-white/60 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.08em]">
                {warning.severity}
              </span>
            </div>
            <p className="mt-1 text-xs">{warning.detail}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
