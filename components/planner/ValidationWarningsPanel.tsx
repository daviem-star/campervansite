"use client";

import { plannerValidationToneClass } from "@/components/planner/plannerTheme";
import { ValidationWarning } from "@/types/trip";

type ValidationWarningsPanelProps = {
  warnings: ValidationWarning[];
  emptyMessage?: string | null;
};

export default function ValidationWarningsPanel({
  warnings,
  emptyMessage = null,
}: ValidationWarningsPanelProps) {
  if (emptyMessage) {
    return (
      <section className="rounded-[24px] border border-app-border/80 bg-app-surface px-4 py-4 sm:px-5 sm:py-5">
        <p className="planner-eyebrow planner-section-label">Planning warnings</p>
        <p className="planner-copy mt-3 text-app-muted">{emptyMessage}</p>
      </section>
    );
  }

  if (warnings.length === 0) {
    return (
      <section className="tone-success rounded-[24px] border px-4 py-4 sm:px-5 sm:py-5">
        <p className="planner-eyebrow text-state-success">Planning warnings</p>
        <p className="planner-copy mt-3 font-medium">
          Route realism and itinerary validation look healthy for the current plan.
        </p>
      </section>
    );
  }

  return (
    <section className="rounded-[24px] border border-app-border/80 bg-app-surface px-4 py-4 sm:px-5 sm:py-5">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <p className="planner-eyebrow planner-section-label-accent">Planning warnings</p>
          <p className="planner-copy mt-2 text-app-muted">
            Review anything that could affect timing, coverage, or trip confidence.
          </p>
        </div>
        <span className="planner-pill rounded-full border px-3 py-1 text-xs font-semibold">
          {warnings.length}
        </span>
      </div>

      <ul className="space-y-2">
        {warnings.map((warning) => (
          <li
            key={warning.id}
            className={`rounded-[18px] border px-3.5 py-3 ${plannerValidationToneClass[warning.severity]}`}
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
