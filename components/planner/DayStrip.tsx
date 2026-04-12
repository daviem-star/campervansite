"use client";

import {
  formatDateOnly,
  formatDayChip,
  formatDayNumber,
} from "@/lib/date";
import { ItineraryDay } from "@/types/trip";

type DayStripProps = {
  days: ItineraryDay[];
  selectedDate: string;
  onSelect: (date: string) => void;
};

export default function DayStrip({ days, selectedDate, onSelect }: DayStripProps) {
  if (days.length === 0) {
    return (
      <div className="planner-copy rounded-[18px] border border-app-border bg-app-surface px-4 py-3 text-app-muted">
        Add stops to see trip day navigation.
      </div>
    );
  }

  const selectedIndex = Math.max(
    days.findIndex((day) => day.date === selectedDate),
    0,
  );

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={() => onSelect(days[selectedIndex - 1]!.date)}
        disabled={selectedIndex <= 0}
        className="planner-button-secondary hidden rounded-full border px-3 py-2 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-50 sm:inline-flex"
      >
        Prev
      </button>

      <div className="hide-scrollbar flex flex-1 gap-2 overflow-x-auto pb-1">
        {days.map((day) => {
          const active = day.date === selectedDate;
          const detailLabel =
            day.stopCount > 0
              ? `${day.stopCount} stop${day.stopCount === 1 ? "" : "s"}`
              : day.activeStay
                ? "Base day"
                : "Open";

          return (
            <button
              key={day.date}
              type="button"
              aria-current={active ? "date" : undefined}
              onClick={() => onSelect(day.date)}
              title={formatDateOnly(day.date)}
              className={`min-w-[94px] rounded-[20px] border px-3 py-2.5 text-left transition ${
                active
                  ? "border-brand-primary/28 bg-brand-primary/10 text-app-text shadow-[0_12px_30px_rgb(var(--color-app-overlay)_/_0.08)]"
                  : "border-app-border bg-app-surface text-app-muted hover:border-brand-primary/18 hover:bg-app-surface-muted"
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="planner-title-md leading-none">{formatDayNumber(day.date)}</p>
                  <p className="planner-eyebrow mt-1">{formatDayChip(day.date)}</p>
                </div>
                {day.roadLegCount > 0 ? (
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                      active
                        ? "bg-app-surface text-brand-primary"
                        : "bg-app-surface-muted text-app-muted"
                    }`}
                  >
                    {day.roadLegCount} leg{day.roadLegCount === 1 ? "" : "s"}
                  </span>
                ) : null}
              </div>

              <p className="planner-meta mt-2 text-current/80">{detailLabel}</p>
            </button>
          );
        })}
      </div>

      <button
        type="button"
        onClick={() => onSelect(days[selectedIndex + 1]!.date)}
        disabled={selectedIndex >= days.length - 1}
        className="planner-button-secondary hidden rounded-full border px-3 py-2 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-50 sm:inline-flex"
      >
        Next
      </button>
    </div>
  );
}
