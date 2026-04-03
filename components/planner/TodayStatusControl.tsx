"use client";

import { useEffect, useRef, useState } from "react";

import TodayActionsPanel from "@/components/planner/TodayActionsPanel";
import { TodayAction } from "@/types/trip";

type TodayStatusControlProps = {
  activeTripName: string | null;
  actions: TodayAction[];
};

export default function TodayStatusControl({
  activeTripName,
  actions,
}: TodayStatusControlProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const hasActions = actions.length > 0;

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
        className={`inline-flex items-center gap-3 rounded-2xl border px-3 py-2 text-left transition ${
          hasActions
            ? "border-state-info-border bg-state-info-surface text-state-info shadow-[0_10px_24px_rgb(var(--color-app-overlay)_/_0.08)]"
            : "border-app-border bg-app-surface text-app-text hover:border-brand-primary/18 hover:bg-app-surface-muted"
        }`}
      >
        <span
          className={`relative flex h-10 w-10 items-center justify-center rounded-full text-sm font-semibold ${
            hasActions ? "bg-state-info text-white" : "bg-brand-primary text-brand-on-primary"
          }`}
        >
          T
        </span>

        <span className="min-w-0">
          <span className="planner-title-sm block text-app-text">Today</span>
          <span className="planner-meta block truncate text-app-muted">
            {activeTripName ?? "No active trip"}
          </span>
        </span>

        <span
          className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] ${
            hasActions
              ? "border-state-info-border bg-white/75 text-state-info"
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
            <TodayActionsPanel actions={actions} tripName={activeTripName} />
          </div>
        </>
      ) : null}
    </div>
  );
}
