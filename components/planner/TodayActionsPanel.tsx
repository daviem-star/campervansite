"use client";

import { formatTime } from "@/lib/date";
import { TodayAction } from "@/types/trip";

type TodayActionsPanelProps = {
  actions: TodayAction[];
};

const typePill = {
  ferry_check_in: "bg-cyan-100 text-cyan-800",
  stay_checkout: "bg-emerald-100 text-emerald-800",
} as const;

export default function TodayActionsPanel({ actions }: TodayActionsPanelProps) {
  return (
    <section className="rounded-[24px] border border-slate-200/80 bg-white px-4 py-4 sm:px-5 sm:py-5">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <p className="planner-eyebrow text-teal-700">Today&apos;s actions</p>
          <p className="planner-copy mt-2 text-slate-600">
            Time-critical steps and ferry checkpoints for the selected itinerary.
          </p>
        </div>
        <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-600">
          {actions.length}
        </span>
      </div>

      {actions.length === 0 ? (
        <p className="planner-copy text-slate-500">No time-critical actions due today.</p>
      ) : (
        <ul className="space-y-3">
          {actions.map((action) => (
            <li
              key={action.id}
              className={`rounded-[18px] border px-3.5 py-3.5 ${
                action.overdue ? "border-rose-200 bg-rose-50/90" : "border-slate-200 bg-slate-50/70"
              }`}
            >
              <div className="mb-1 flex items-center justify-between gap-2">
                <span className="planner-title-sm text-slate-900">{action.label}</span>
                <span
                  className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.08em] ${
                    typePill[action.type]
                  }`}
                >
                  {action.type === "ferry_check_in" ? "Ferry" : "Checkout"}
                </span>
              </div>
              {action.type === "stay_checkout" ? (
                <p className={`planner-copy-sm ${action.overdue ? "text-rose-700" : "text-slate-600"}`}>
                  Checkout by {formatTime(action.dueAt)}
                </p>
              ) : (
                <div className={`planner-copy-sm space-y-0.5 ${action.overdue ? "text-rose-700" : "text-slate-600"}`}>
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
