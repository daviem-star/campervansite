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
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-900">Today&apos;s actions</h3>
        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600">
          {actions.length}
        </span>
      </div>

      {actions.length === 0 ? (
        <p className="text-sm text-slate-500">No time-critical actions due today.</p>
      ) : (
        <ul className="space-y-2">
          {actions.map((action) => (
            <li
              key={action.id}
              className={`rounded-xl border px-3 py-2 ${
                action.overdue ? "border-rose-200 bg-rose-50" : "border-slate-200 bg-slate-50"
              }`}
            >
              <div className="mb-1 flex items-center justify-between gap-2">
                <span className="text-sm font-semibold text-slate-900">{action.label}</span>
                <span
                  className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.08em] ${
                    typePill[action.type]
                  }`}
                >
                  {action.type === "ferry_check_in" ? "Ferry" : "Checkout"}
                </span>
              </div>
              {action.type === "stay_checkout" ? (
                <p className={`text-xs ${action.overdue ? "text-rose-700" : "text-slate-600"}`}>
                  Checkout by {formatTime(action.dueAt)}
                </p>
              ) : (
                <div className={`space-y-0.5 text-xs ${action.overdue ? "text-rose-700" : "text-slate-600"}`}>
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
