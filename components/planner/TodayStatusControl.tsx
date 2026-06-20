"use client";

import { useEffect, useRef, useState } from "react";
import { CalendarDays } from "lucide-react";

import TodayActionsPanel from "@/components/planner/TodayActionsPanel";
import { TodayAction } from "@/types/trip";

type TodayStatusControlProps = {
  todayTripName: string | null;
  actions: TodayAction[];
  variant?: "default" | "header";
};

export default function TodayStatusControl({
  todayTripName,
  actions,
  variant = "default",
}: TodayStatusControlProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const hasActions = actions.length > 0;
  const isHeader = variant === "header";

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const onPointerDown = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [isOpen]);

  return (
    <div ref={containerRef} className="relative z-30">
      <button
        type="button"
        aria-expanded={isOpen}
        aria-label="Open Today actions"
        onClick={() => setIsOpen((current) => !current)}
        className={`inline-flex items-center gap-2 rounded-2xl border px-2 py-2 text-left transition sm:gap-3 sm:px-3 ${
          isHeader
            ? "border-white/25 bg-white/10 text-white hover:border-white/45 hover:bg-white/16"
            : hasActions
            ? "border-state-info-border bg-state-info-surface text-state-info shadow-[0_10px_24px_rgb(var(--color-app-overlay)_/_0.08)]"
            : "border-app-border bg-app-surface text-app-text hover:border-brand-primary/18 hover:bg-app-surface-muted"
        }`}
      >
        <span
          className={`relative flex h-10 w-10 items-center justify-center rounded-full text-sm font-semibold ${
            isHeader
              ? "bg-[#fffdf7] text-[#0e3527]"
              : hasActions
                ? "bg-state-info text-app-surface"
                : "bg-brand-primary text-brand-on-primary"
          }`}
        >
          <CalendarDays className="h-4 w-4" aria-hidden="true" />
        </span>

        <span className="hidden min-w-0 sm:block">
          <span className={`planner-title-sm block ${isHeader ? "text-[#fffdf7]" : "text-app-text"}`}>Today</span>
          <span className={`planner-meta block truncate ${isHeader ? "text-white/70" : "text-app-muted"}`}>
            {todayTripName ?? "No Today trip"}
          </span>
        </span>

        <span
          className={`hidden rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] sm:inline-flex ${
            isHeader
              ? "border-white/25 bg-white/10 text-white"
              : hasActions
              ? "border-state-info-border bg-state-info-surface text-state-info"
              : "border-app-border bg-app-surface text-app-muted"
          }`}
        >
          {actions.length}
        </span>
      </button>

      {isOpen ? (
        <>
          <div className="fixed inset-0 z-30 bg-app-overlay/30 lg:hidden" />

          <div className="fixed inset-x-4 top-[5.25rem] z-40 max-h-[min(70vh,36rem)] overflow-y-auto lg:absolute lg:right-0 lg:left-auto lg:top-[calc(100%+0.75rem)] lg:w-[24rem] lg:max-w-[24rem]">
            <TodayActionsPanel actions={actions} tripName={todayTripName} />
          </div>
        </>
      ) : null}
    </div>
  );
}
