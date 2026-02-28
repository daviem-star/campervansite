"use client";

import { formatDayChip, formatDayNumber } from "@/lib/date";

type DayStripProps = {
  days: string[];
  selectedDate: string;
  onSelect: (date: string) => void;
};

export default function DayStrip({ days, selectedDate, onSelect }: DayStripProps) {
  if (days.length === 0) {
    return (
      <div className="rounded-2xl border border-ui-border bg-ui-surface px-4 py-3 text-sm text-slate-400">
        Add stays to see trip day navigation.
      </div>
    );
  }

  return (
    <div className="hide-scrollbar flex gap-2 overflow-x-auto pb-1">
      {days.map((day) => {
        const active = day === selectedDate;
        return (
          <button
            key={day}
            type="button"
            onClick={() => onSelect(day)}
            className={`min-w-[64px] rounded-2xl border px-3 py-2 text-center transition ${
              active
                ? "border-ui-accent bg-ui-accent-strong text-white"
                : "border-ui-border bg-ui-surface text-slate-300 hover:border-slate-600 hover:bg-ui-chrome-soft"
            }`}
          >
            <p className="text-lg font-semibold leading-none">{formatDayNumber(day)}</p>
            <p className="mt-1 text-xs font-medium uppercase tracking-[0.1em]">{formatDayChip(day)}</p>
          </button>
        );
      })}
    </div>
  );
}
