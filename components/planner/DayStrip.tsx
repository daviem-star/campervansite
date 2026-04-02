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
      <div className="planner-copy rounded-[18px] border border-slate-200 bg-white px-4 py-3 text-slate-500">
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
            className={`min-w-[64px] rounded-[18px] border px-3 py-2 text-center transition ${
              active
                ? "border-teal-300 bg-teal-50 text-slate-950"
                : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50"
            }`}
          >
            <p className="planner-title-md leading-none">{formatDayNumber(day)}</p>
            <p className="planner-eyebrow mt-1">{formatDayChip(day)}</p>
          </button>
        );
      })}
    </div>
  );
}
