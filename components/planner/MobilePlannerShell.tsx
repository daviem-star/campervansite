"use client";

import type { ReactNode } from "react";
import Image from "next/image";
import { CalendarDays, Map, Route, type LucideIcon } from "lucide-react";

export type MobilePlannerScreen = "today" | "trip" | "trips";

type MobilePlannerShellProps = {
  activeScreen: MobilePlannerScreen;
  title: string;
  summary: string;
  accountControl: ReactNode;
  todayControl: ReactNode;
  themeControl: ReactNode;
  children: ReactNode;
  onScreenChange: (screen: MobilePlannerScreen) => void;
};

const navItems: { screen: MobilePlannerScreen; label: string; shortLabel: string; icon: LucideIcon }[] = [
  { screen: "today", label: "Today", shortLabel: "Today", icon: CalendarDays },
  { screen: "trip", label: "Current trip", shortLabel: "Trip", icon: Route },
  { screen: "trips", label: "Trip library", shortLabel: "Trips", icon: Map },
];

export default function MobilePlannerShell({
  activeScreen,
  title,
  summary,
  accountControl,
  todayControl,
  themeControl,
  children,
  onScreenChange,
}: MobilePlannerShellProps) {
  return (
    <div className="flex min-h-[100dvh] flex-col bg-app-bg lg:hidden">
      <header className="sticky top-0 z-30 border-b border-app-border bg-app-surface px-4 py-3 shadow-[0_6px_20px_rgb(var(--color-app-overlay)_/_0.06)]">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-start gap-2.5">
            <Image
              src="/campervan-logo.png"
              alt=""
              width={708}
              height={624}
              className="mt-0.5 h-9 w-9 shrink-0 object-contain"
            />
            <div className="min-w-0">
              <p className="planner-eyebrow planner-section-label">Campervansite</p>
              <h1 className="planner-title-lg mt-1 truncate text-app-text">{title}</h1>
              <p className="planner-meta mt-1 line-clamp-2 text-app-muted">{summary}</p>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            {todayControl}
            {themeControl}
            {accountControl}
          </div>
        </div>
      </header>

      <main className="min-h-0 flex-1 px-3 pb-28 pt-3 sm:px-4">{children}</main>

      <nav
        aria-label="Mobile planner sections"
        className="fixed inset-x-3 bottom-3 z-40 rounded-[22px] border border-app-border bg-app-surface/95 p-1.5 shadow-[0_16px_44px_rgb(var(--color-app-overlay)_/_0.18)] backdrop-blur"
      >
        <div className="grid grid-cols-3 gap-1">
          {navItems.map((item) => {
            const active = activeScreen === item.screen;
            const Icon = item.icon;

            return (
              <button
                key={item.screen}
                type="button"
                aria-current={active ? "page" : undefined}
                data-testid={`mobile-nav-${item.screen}`}
                onClick={() => onScreenChange(item.screen)}
                className={`flex min-h-14 flex-col items-center justify-center gap-1 rounded-[16px] border px-2 py-1.5 text-center text-xs font-semibold transition ${
                  active
                    ? "border-brand-primary/30 bg-brand-primary text-brand-on-primary"
                    : "border-transparent text-app-muted hover:border-app-border hover:bg-app-surface-muted hover:text-app-text"
                }`}
              >
                <Icon className="h-4 w-4" aria-hidden="true" />
                <span className="block sm:hidden">{item.shortLabel}</span>
                <span className="hidden sm:block">{item.label}</span>
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
