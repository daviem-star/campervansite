"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";

type SidebarItem = {
  id: string;
  label: string;
  icon: ReactNode;
  hasCaret?: boolean;
  active?: boolean;
};

type FilterId = "sources" | "identity" | "discoveries" | "filters";
type ViewMode = "chart" | "list";

const sidebarItemsTop: SidebarItem[] = [
  {
    id: "inventory",
    label: "Inventory",
    active: true,
    hasCaret: true,
    icon: (
      <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" aria-hidden="true">
        <path d="M4 6h16M4 12h16M4 18h10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    id: "dashboards",
    label: "Dashboards",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" aria-hidden="true">
        <path d="M5 5h6v14H5zM13 11h6v8h-6zM13 5h6v4h-6z" stroke="currentColor" strokeWidth="1.8" />
      </svg>
    ),
  },
  {
    id: "playbooks",
    label: "Playbooks",
    hasCaret: true,
    icon: (
      <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" aria-hidden="true">
        <path d="M12 3l7 4v10l-7 4-7-4V7z" stroke="currentColor" strokeWidth="1.8" />
        <path d="M9 12h6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    id: "logs",
    label: "Logs",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" aria-hidden="true">
        <path d="M7 4h10v16H7z" stroke="currentColor" strokeWidth="1.8" />
        <path d="M10 9h4M10 13h4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
    ),
  },
];

const sidebarItemsBottom: SidebarItem[] = [
  {
    id: "extensions",
    label: "Extensions",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" aria-hidden="true">
        <path d="M10 4h4v4h4v4h-4v4h-4v-4H6V8h4z" stroke="currentColor" strokeWidth="1.8" />
      </svg>
    ),
  },
  {
    id: "integrations",
    label: "Integrations",
    hasCaret: true,
    icon: (
      <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" aria-hidden="true">
        <path d="M8 8h8v8H8z" stroke="currentColor" strokeWidth="1.8" />
        <path
          d="M12 2v4M12 18v4M2 12h4M18 12h4"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
        />
      </svg>
    ),
  },
  {
    id: "settings",
    label: "Settings",
    hasCaret: true,
    icon: (
      <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" aria-hidden="true">
        <path d="M12 8a4 4 0 100 8 4 4 0 000-8z" stroke="currentColor" strokeWidth="1.8" />
        <path
          d="M4 12h2m12 0h2M12 4v2m0 12v2M6.5 6.5l1.5 1.5m8 8l1.5 1.5m0-11l-1.5 1.5m-8 8L6.5 17.5"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
        />
      </svg>
    ),
  },
];

const settingsChildren = [
  "General settings",
  "Lists",
  "Custom apps",
  "Admin management",
  "Target groups",
  "Departments",
];

function SidebarNavItem({ item, expanded }: { item: SidebarItem; expanded: boolean }) {
  return (
    <button
      type="button"
      className={`flex w-full items-center rounded-xl border px-3 py-2.5 text-left text-sm transition ${
        item.active
          ? "border-ui-nav-border bg-ui-nav-active text-white"
          : "border-transparent text-slate-300 hover:bg-ui-chrome-hover hover:text-slate-100"
      }`}
    >
      <span className="inline-flex h-5 w-5 items-center justify-center">{item.icon}</span>
      <span
        className={`ml-3 truncate text-[14px] font-medium transition-all duration-200 ${
          expanded ? "max-w-[160px] opacity-100" : "max-w-0 opacity-0"
        }`}
      >
        {item.label}
      </span>
      {item.hasCaret ? (
        <span
          className={`ml-auto text-xs text-slate-500 transition-opacity duration-200 ${
            expanded ? "opacity-100" : "opacity-0"
          }`}
        >
          ▾
        </span>
      ) : null}
    </button>
  );
}

function SidebarBlock({ expanded }: { expanded: boolean }) {
  return (
    <>
      <div className="mb-4 px-3">
        <div className="flex h-10 items-center">
          <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-cyan-400 via-indigo-500 to-fuchsia-600" />
          <span
            className={`ml-3 overflow-hidden whitespace-nowrap text-lg font-semibold tracking-tight text-slate-100 transition-all duration-200 ${
              expanded ? "max-w-[140px] opacity-100" : "max-w-0 opacity-0"
            }`}
          >
            NavTheme
          </span>
        </div>
      </div>

      <nav className="space-y-1.5 px-2">
        {sidebarItemsTop.map((item) => (
          <SidebarNavItem key={item.id} item={item} expanded={expanded} />
        ))}
      </nav>

      <div className="my-4 border-t border-slate-800/80" />

      <nav className="space-y-1.5 px-2">
        {sidebarItemsBottom.map((item) => (
          <SidebarNavItem key={item.id} item={item} expanded={expanded} />
        ))}
      </nav>

      <div
        className={`mt-4 overflow-hidden rounded-xl border border-ui-border bg-ui-raised transition-all duration-200 ${
          expanded ? "mx-2 max-h-80 p-3 opacity-100" : "mx-0 max-h-0 p-0 opacity-0"
        }`}
      >
        <p className="mb-2 text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">Settings</p>
        <ul className="space-y-1.5">
          {settingsChildren.map((item, index) => (
            <li
              key={item}
              className={`rounded-lg px-2 py-1.5 text-sm ${
                index === 0
                  ? "bg-ui-nav-sub-active text-slate-100"
                  : "text-slate-400 hover:bg-ui-chrome-hover hover:text-slate-200"
              }`}
            >
              {item}
            </li>
          ))}
        </ul>
      </div>
    </>
  );
}

function ToolbarButton({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-xl border px-3 py-2 text-sm font-medium transition ${
        active
          ? "border-ui-accent bg-ui-accent-strong text-white"
          : "border-slate-700 bg-ui-raised text-slate-200 hover:border-slate-500"
      }`}
    >
      {label}
    </button>
  );
}

export default function UiLabDashboard() {
  const [desktopExpanded, setDesktopExpanded] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [liveMode, setLiveMode] = useState(true);
  const [filters, setFilters] = useState<Record<FilterId, boolean>>({
    sources: true,
    identity: false,
    discoveries: true,
    filters: false,
  });

  const toggleFilter = (key: FilterId) => {
    setFilters((current) => ({
      ...current,
      [key]: !current[key],
    }));
  };

  return (
    <div className="min-h-screen bg-ui-bg text-slate-100">
      <div className="mx-auto max-w-[1780px] p-2 md:p-4">
        <div className="overflow-hidden rounded-[24px] border border-ui-border bg-ui-surface shadow-[0_30px_80px_rgba(2,6,23,0.7)]">
          <div className="flex items-center gap-2 border-b border-ui-border bg-ui-chrome px-4 py-3">
            <span className="h-3 w-3 rounded-full bg-slate-600" />
            <span className="h-3 w-3 rounded-full bg-slate-600" />
            <span className="h-3 w-3 rounded-full bg-slate-600" />
            <div className="mx-auto w-full max-w-[420px] truncate rounded-xl bg-ui-border-soft px-4 py-1.5 text-center text-sm text-slate-300">
              Campervan UI Lab
            </div>
            <div className="h-6 w-6 rounded-full bg-amber-400 text-center text-xs font-bold leading-6 text-ui-chrome">DM</div>
          </div>

          <div className="relative flex min-h-[720px]">
            <aside
              className={`hidden border-r border-ui-border bg-ui-surface-alt py-4 transition-[width] duration-200 md:block ${
                desktopExpanded ? "md:w-[264px]" : "md:w-[84px]"
              }`}
              onMouseEnter={() => setDesktopExpanded(true)}
              onMouseLeave={() => setDesktopExpanded(false)}
              onFocusCapture={() => setDesktopExpanded(true)}
            >
              <SidebarBlock expanded={desktopExpanded} />
            </aside>

            <main className="flex min-w-0 flex-1 flex-col">
              <div className="flex items-center gap-3 border-b border-slate-800/80 px-3 py-3 md:px-5">
                <button
                  type="button"
                  onClick={() => setMobileSidebarOpen(true)}
                  className="rounded-lg border border-slate-700 bg-ui-chrome-soft p-2 text-slate-200 md:hidden"
                  aria-label="Open menu"
                >
                  <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" aria-hidden="true">
                    <path d="M4 6h16M4 12h16M4 18h16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                  </svg>
                </button>

                <Link
                  href="/"
                  className="rounded-lg border border-slate-700 bg-ui-chrome-soft px-3 py-2 text-xs font-semibold uppercase tracking-[0.08em] text-slate-200 hover:border-slate-500"
                >
                  Back to Planner
                </Link>

                <div className="hidden flex-1 md:block">
                  <input
                    type="text"
                    value=""
                    readOnly
                    placeholder="Search items, sources, tags"
                    className="w-full rounded-xl border border-slate-700 bg-ui-raised px-4 py-2 text-sm text-slate-300 placeholder:text-slate-500"
                  />
                </div>
              </div>

              <div className="border-b border-slate-800/80 px-3 py-3 md:px-5">
                <div className="flex flex-wrap items-center gap-2">
                  <ToolbarButton label="Sources" active={filters.sources} onClick={() => toggleFilter("sources")} />
                  <ToolbarButton
                    label="Identity risks"
                    active={filters.identity}
                    onClick={() => toggleFilter("identity")}
                  />
                  <ToolbarButton
                    label="New discoveries"
                    active={filters.discoveries}
                    onClick={() => toggleFilter("discoveries")}
                  />
                  <ToolbarButton
                    label="More filters"
                    active={filters.filters}
                    onClick={() => toggleFilter("filters")}
                  />

                  <div className="ml-auto flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setViewMode("chart")}
                      className={`rounded-lg border px-3 py-2 text-sm font-semibold transition ${
                        viewMode === "chart"
                          ? "border-ui-accent bg-ui-accent-strong text-white"
                          : "border-slate-700 bg-ui-raised text-slate-300"
                      }`}
                    >
                      Chart
                    </button>
                    <button
                      type="button"
                      onClick={() => setViewMode("list")}
                      className={`rounded-lg border px-3 py-2 text-sm font-semibold transition ${
                        viewMode === "list"
                          ? "border-ui-accent bg-ui-accent-strong text-white"
                          : "border-slate-700 bg-ui-raised text-slate-300"
                      }`}
                    >
                      List
                    </button>
                    <button
                      type="button"
                      onClick={() => setLiveMode((value) => !value)}
                      className="inline-flex items-center gap-2 rounded-lg border border-slate-700 bg-ui-raised px-3 py-2 text-sm"
                    >
                      <span className="font-semibold text-slate-300">Live</span>
                      <span
                        className={`h-5 w-9 rounded-full p-0.5 transition ${
                          liveMode ? "bg-emerald-500" : "bg-slate-600"
                        }`}
                      >
                        <span
                          className={`block h-4 w-4 rounded-full bg-white transition-transform ${
                            liveMode ? "translate-x-4" : "translate-x-0"
                          }`}
                        />
                      </span>
                    </button>
                  </div>
                </div>
              </div>

              <section className="flex-1 p-3 md:p-5">
                <div className="h-full rounded-2xl border border-slate-800 bg-gradient-to-b from-ui-raised to-ui-panel p-4 md:p-6">
                  <div className="grid grid-cols-7 gap-2 rounded-xl border border-slate-700/70 bg-ui-raised-2 px-3 py-2 text-xs font-semibold uppercase tracking-[0.06em] text-slate-400 md:grid-cols-8">
                    <span className="col-span-2 md:col-span-2">Source</span>
                    <span>Total accounts</span>
                    <span>SSO</span>
                    <span>Login form</span>
                    <span>Risky users</span>
                    <span className="hidden md:block">Identity risks</span>
                    <span className="hidden md:block">Risk level</span>
                  </div>

                  <div className="mt-8 flex h-[60vh] min-h-[320px] flex-col items-center justify-center rounded-2xl border border-dashed border-slate-700/80 bg-ui-panel-alt text-center">
                    <div className="mb-4 h-16 w-16 rounded-full border border-slate-600" />
                    <p className="text-lg font-semibold text-slate-100">No results found</p>
                    <p className="mt-1 max-w-md text-sm text-slate-400">
                      This is a UI theme mock. Top controls toggle local state only while we validate layout and
                      hierarchy.
                    </p>
                    <button
                      type="button"
                      className="mt-5 rounded-xl border border-ui-accent-border bg-ui-accent-deep px-4 py-2 text-sm font-semibold text-white"
                    >
                      Go to Live view
                    </button>
                  </div>
                </div>
              </section>
            </main>
          </div>
        </div>
      </div>

      {mobileSidebarOpen ? (
        <div className="fixed inset-0 z-50 bg-black/65 md:hidden" onClick={() => setMobileSidebarOpen(false)}>
          <aside
            className="h-full w-[82%] max-w-[320px] border-r border-ui-border bg-ui-surface-alt p-4"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-400">Navigation</p>
              <button
                type="button"
                onClick={() => setMobileSidebarOpen(false)}
                className="rounded-lg border border-slate-700 px-2 py-1 text-xs text-slate-300"
              >
                Close
              </button>
            </div>
            <SidebarBlock expanded />
          </aside>
        </div>
      ) : null}
    </div>
  );
}
