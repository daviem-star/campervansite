"use client";

import { formatTime } from "@/lib/date";
import { TodayAction } from "@/types/trip";

type TodayActionsPanelProps = {
  actions: TodayAction[];
};

const typePill = {
  ferry_check_in: "bg-cyan-500/20 text-cyan-300",
  stay_checkout: "bg-emerald-500/20 text-emerald-300",
} as const;

export default function TodayActionsPanel({ actions }: TodayActionsPanelProps) {
  return (
    <section className="rounded-2xl border border-ui-border bg-ui-raised p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold text-slate-100">Today&apos;s actions</h3>
          <span className="rounded-full border border-ui-border bg-ui-surface px-2 py-0.5 text-xs font-semibold text-slate-300">
            {actions.length}
          </span>
        </div>
      </div>

      {actions.length === 0 ? (
        <p className="text-sm text-slate-400">No time-critical actions due today.</p>
      ) : (
        <ul className="space-y-2">
          {actions.map((action) => (
            <li
              key={action.id}
              className={`rounded-xl border px-3 py-2 ${
                action.overdue ? "border-rose-500/50 bg-rose-500/10" : "border-ui-border bg-ui-surface-alt"
              }`}
            >
              <div className="mb-1 flex items-center justify-between gap-2">
                <span className="text-sm font-semibold text-slate-100">{action.label}</span>
                <span
                  className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.08em] ${
                    typePill[action.type]
                  }`}
                >
                  {action.type === "ferry_check_in" ? "Ferry" : "Checkout"}
                </span>
              </div>
              {action.type === "stay_checkout" ? (
                <p className={`text-xs ${action.overdue ? "text-rose-300" : "text-slate-300"}`}>
                  Checkout by {formatTime(action.dueAt)}
                </p>
              ) : (
                <div className={`space-y-0.5 text-xs ${action.overdue ? "text-rose-300" : "text-slate-300"}`}>
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
