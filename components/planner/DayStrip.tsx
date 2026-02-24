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
      <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-500">
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
                ? "border-sky-300 bg-sky-100 text-slate-900"
                : "border-slate-200 bg-white text-slate-600 hover:bg-slate-100"
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
