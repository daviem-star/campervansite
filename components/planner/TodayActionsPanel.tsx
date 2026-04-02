"use client";

import { formatTime } from "@/lib/date";
import { TodayAction } from "@/types/trip";

type TodayActionsPanelProps = {
  actions: TodayAction[];
};

const typePill = {
  ferry_check_in: "border border-state-info-border bg-state-info-surface text-state-info",
  stay_checkout: "border border-brand-support/35 bg-brand-support/18 text-brand-primary",
} as const;

export default function TodayActionsPanel({ actions }: TodayActionsPanelProps) {
  return (
    <section className="rounded-[24px] border border-app-border/80 bg-app-surface px-4 py-4 sm:px-5 sm:py-5">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <p className="planner-eyebrow planner-section-label">Today&apos;s actions</p>
          <p className="planner-copy mt-2 text-app-muted">
            Time-critical steps and ferry checkpoints for the selected itinerary.
          </p>
        </div>
        <span className="planner-pill rounded-full border px-3 py-1 text-xs font-semibold">
          {actions.length}
        </span>
      </div>

      {actions.length === 0 ? (
        <p className="planner-copy text-app-muted">No time-critical actions due today.</p>
      ) : (
        <ul className="space-y-3">
          {actions.map((action) => (
            <li
              key={action.id}
              className={`rounded-[18px] border px-3.5 py-3.5 ${
                action.overdue ? "tone-error" : "border-app-border bg-app-surface-muted/70"
              }`}
            >
              <div className="mb-1 flex items-center justify-between gap-2">
                <span className="planner-title-sm text-app-text">{action.label}</span>
                <span
                  className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.08em] ${
                    typePill[action.type]
                  }`}
                >
                  {action.type === "ferry_check_in" ? "Ferry" : "Checkout"}
                </span>
              </div>
              {action.type === "stay_checkout" ? (
                <p className={`planner-copy-sm ${action.overdue ? "text-state-error" : "text-app-muted"}`}>
                  Checkout by {formatTime(action.dueAt)}
                </p>
              ) : (
                <div className={`planner-copy-sm space-y-0.5 ${action.overdue ? "text-state-error" : "text-app-muted"}`}>
                  <p>Departure: {action.departureAt ? formatTime(action.departureAt) : "--:--"}</p>
                  <p>Latest check-in: {formatTime(action.dueAt)}</p>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
