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
      <div className="planner-copy rounded-[18px] border border-app-border bg-app-surface px-4 py-3 text-app-muted">
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
                ? "border-brand-primary/30 bg-brand-primary/10 text-app-text"
                : "border-app-border bg-app-surface text-app-muted hover:border-brand-primary/18 hover:bg-app-surface-muted"
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
