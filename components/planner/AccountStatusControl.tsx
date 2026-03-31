"use client";

import { FormEvent, useEffect, useRef, useState } from "react";

import { canUseLocalTestSignIn, isLocalTestSignInEnabled } from "@/lib/runtimeFlags";
import { PlannerNotice, SyncStatus } from "@/types/trip";

type AuthStatus = "disabled" | "checking" | "signed_out" | "signed_in";
type PlannerMode = "demo" | "cloud";

type AccountStatusControlProps = {
  authStatus: AuthStatus;
  mode: PlannerMode;
  userEmail: string | null;
  syncStatus: SyncStatus;
  isOfflineReadOnly: boolean;
  notice: PlannerNotice | null;
  onSignIn: (email: string) => Promise<void>;
  onSignInAsTestUser: () => Promise<void>;
  onSignOut: () => Promise<void>;
  onCreateCloudTripFromCurrent: () => Promise<void>;
  onResetSeed: () => Promise<void>;
  onResetSeedAlignedToToday: () => Promise<void>;
};

const statusTone = {
  idle: "border-slate-200 bg-slate-100 text-slate-700",
  saving: "border-sky-200 bg-sky-50 text-sky-700",
  saved: "border-emerald-200 bg-emerald-50 text-emerald-700",
  offline: "border-amber-200 bg-amber-50 text-amber-800",
  error: "border-rose-200 bg-rose-50 text-rose-700",
} as const;

const statusLabel: Record<SyncStatus, string> = {
  idle: "Demo mode",
  saving: "Saving",
  saved: "Saved",
  offline: "Offline",
  error: "Needs attention",
};

const statusDot = {
  idle: "bg-slate-400",
  saving: "bg-sky-500",
  saved: "bg-emerald-500",
  offline: "bg-amber-500",
  error: "bg-rose-500",
} as const;

const noticeTone = {
  info: "border-sky-200 bg-sky-50 text-sky-800",
  success: "border-emerald-200 bg-emerald-50 text-emerald-800",
  warning: "border-amber-200 bg-amber-50 text-amber-800",
} as const;

const buttonClass =
  "rounded-2xl border px-4 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60";

export default function AccountStatusControl({
  authStatus,
  mode,
  userEmail,
  syncStatus,
  isOfflineReadOnly,
  notice,
  onSignIn,
  onSignInAsTestUser,
  onSignOut,
  onCreateCloudTripFromCurrent,
  onResetSeed,
  onResetSeedAlignedToToday,
}: AccountStatusControlProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isWorking, setIsWorking] = useState(false);
  const [email, setEmail] = useState("");
  const containerRef = useRef<HTMLDivElement | null>(null);
  const showLocalTestSignIn = isLocalTestSignInEnabled();
  const localTestSignInReady = canUseLocalTestSignIn();

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

  const runAction = async (action: () => Promise<void>) => {
    setIsWorking(true);

    try {
      await action();
      setIsOpen(false);
    } finally {
      setIsWorking(false);
    }
  };

  const submitMagicLink = async (event: FormEvent) => {
    event.preventDefault();
    setIsWorking(true);

    try {
      await onSignIn(email);
      setIsOpen(false);
    } finally {
      setIsWorking(false);
    }
  };

  const accountLabel =
    authStatus === "signed_in"
      ? userEmail ?? "Signed-in account"
      : authStatus === "signed_out"
        ? "Sign in to sync"
      : mode === "demo"
        ? "Demo mode"
        : "Account";
  const syncDetails =
    authStatus === "signed_in"
      ? mode === "cloud"
        ? "Cloud sync is active. Routine load and save updates appear here instead of as planner banners."
        : "This planner is still using demo data. Demo changes stay on this device until you create a cloud trip."
      : authStatus === "signed_out"
        ? "Sign in to keep the same trip available across devices while you are online."
        : "Planner access is waiting on environment configuration in this workspace.";
  const accountInitial = userEmail?.charAt(0).toUpperCase() ?? (mode === "demo" ? "D" : "A");

  return (
    <div ref={containerRef} className="relative z-30 lg:w-full">
      <button
        type="button"
        aria-label="Open account and sync"
        aria-expanded={isOpen}
        data-testid="account-status-trigger"
        onClick={() => setIsOpen((current) => !current)}
        title={accountLabel}
        className="group inline-flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-3 py-2 text-left shadow-sm transition hover:border-slate-300 hover:bg-slate-50 lg:w-full lg:flex-col lg:justify-center lg:gap-2 lg:rounded-3xl lg:px-2 lg:py-3"
      >
        <span className="relative flex h-10 w-10 items-center justify-center rounded-full bg-slate-950 text-sm font-semibold text-white lg:h-12 lg:w-12">
          {accountInitial}
          <span
            className={`absolute bottom-0.5 right-0.5 h-3 w-3 rounded-full border-2 border-white ${statusDot[syncStatus]}`}
          />
        </span>

        <span className="min-w-0 lg:hidden">
          <span className="block truncate text-sm font-semibold text-slate-900">{accountLabel}</span>
          <span className="block text-xs text-slate-500">{statusLabel[syncStatus]}</span>
        </span>

        <span className="hidden h-7 w-7 items-center justify-center rounded-full border border-slate-200 bg-slate-50 text-slate-500 transition group-hover:border-slate-300 group-hover:bg-white lg:inline-flex">
          <svg
            viewBox="0 0 20 20"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            className={`h-3.5 w-3.5 transition ${isOpen ? "rotate-180" : ""}`}
            aria-hidden="true"
          >
            <path d="m5 7 5 5 5-5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
      </button>

      {isOpen ? (
        <>
          <div className="fixed inset-0 z-30 bg-slate-900/30 lg:hidden" />

          <div
            data-testid="account-status-panel"
            className="fixed inset-y-0 left-0 z-40 w-[min(24rem,92vw)] overflow-y-auto border-r border-slate-200 bg-white p-5 shadow-2xl lg:absolute lg:left-0 lg:top-[calc(100%+0.75rem)] lg:inset-y-auto lg:max-h-[min(78vh,44rem)] lg:w-[22rem] lg:overflow-y-auto lg:rounded-3xl lg:border lg:shadow-xl"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                  Account and sync
                </p>
                <h2 className="mt-2 text-lg font-semibold text-slate-950">{accountLabel}</h2>
                <p className="mt-1 text-sm text-slate-600">
                  {authStatus === "signed_in"
                    ? mode === "cloud"
                      ? "Cloud mode is active for this account."
                      : "This planner is still using demo data."
                    : authStatus === "signed_out"
                      ? "Sign in to unlock cloud sync and multi-trip management."
                    : mode === "demo"
                      ? "Trips stay local in demo mode until cloud sync is available."
                      : "Sign in to manage trips in cloud mode."}
                </p>
              </div>

              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="rounded-xl border border-slate-200 px-3 py-1.5 text-sm text-slate-600 transition hover:bg-slate-100"
              >
                Close
              </button>
            </div>

            <div className="mt-5 flex flex-wrap items-center gap-2">
              <span
                className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold ${statusTone[syncStatus]}`}
              >
                {statusLabel[syncStatus]}
              </span>
              <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-0.5 text-xs font-semibold text-slate-600">
                {mode === "cloud" ? "Cloud mode" : "Demo mode"}
              </span>
            </div>

            {isOfflineReadOnly ? (
              <p className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                The last synced trip is available to review, but edits and trip management stay
                locked until the connection returns.
              </p>
            ) : null}

            <div className="mt-5 rounded-3xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                Sync details
              </p>
              <p className="mt-2 text-sm text-slate-600">{syncDetails}</p>
              {notice ? (
                <p
                  data-testid="account-notice"
                  className={`mt-3 rounded-2xl border px-3 py-2 text-sm ${noticeTone[notice.tone]}`}
                >
                  {notice.text}
                </p>
              ) : null}
            </div>

            <div className="mt-5 space-y-4">
              {authStatus === "signed_in" ? (
                <>
                  <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
                    <p className="text-sm font-semibold text-slate-900">Account</p>
                    <p className="mt-1 break-all text-sm text-slate-600">
                      {userEmail ?? "Signed-in account"}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => void runAction(onSignOut)}
                    disabled={isWorking}
                    className={`${buttonClass} border-slate-300 text-slate-700 hover:bg-slate-100`}
                  >
                    Sign out
                  </button>
                </>
              ) : null}

              {authStatus === "signed_in" && mode === "demo" ? (
                <button
                  type="button"
                  onClick={() => void runAction(onCreateCloudTripFromCurrent)}
                  disabled={isWorking}
                  className={`${buttonClass} border-slate-950 bg-slate-950 text-white hover:bg-slate-800`}
                >
                  Create cloud trip
                </button>
              ) : null}

              {authStatus === "signed_out" ? (
                <div className="space-y-3 rounded-3xl border border-slate-200 bg-slate-50 p-4">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">Sign in</p>
                    <p className="mt-1 text-sm text-slate-600">
                      Send a magic link to this device so the planner can open cloud mode.
                    </p>
                  </div>

                  <form onSubmit={submitMagicLink} className="space-y-3">
                    <input
                      type="email"
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                      placeholder="you@example.com"
                      className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm text-slate-900 focus:border-sky-500 focus:outline-none"
                    />
                    <button
                      type="submit"
                      disabled={isWorking}
                      className="w-full rounded-2xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400"
                    >
                      {isWorking ? "Sending..." : "Send magic link"}
                    </button>
                  </form>
                </div>
              ) : null}

              {authStatus === "signed_out" && showLocalTestSignIn ? (
                <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                    Local dev only
                  </p>
                  <p className="mt-2 text-sm text-slate-600">
                    Use the built-in test account to exercise signed-in cloud flows without email.
                  </p>
                  {!localTestSignInReady ? (
                    <p className="mt-2 text-xs text-amber-700">
                      Enable the E2E auth bypass env flags to use local test sign-in.
                    </p>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => void runAction(onSignInAsTestUser)}
                    disabled={isWorking || !localTestSignInReady}
                    className="mt-3 rounded-2xl border border-slate-300 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    Sign in as test user
                  </button>
                </div>
              ) : null}

              {authStatus === "disabled" ? (
                <p className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                  Cloud sync is unavailable in this environment right now, so the planner stays in
                  demo mode.
                </p>
              ) : null}

              {mode === "demo" ? (
                <div className="space-y-3 rounded-3xl border border-slate-200 bg-slate-50 p-4">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">Demo tools</p>
                    <p className="mt-1 text-sm text-slate-600">
                      Keep the seeded itinerary handy while we are testing locally.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => void runAction(onResetSeed)}
                    disabled={isWorking}
                    className={`${buttonClass} w-full border-slate-300 text-slate-700 hover:bg-slate-100`}
                  >
                    Reset seed data
                  </button>

                  <button
                    type="button"
                    onClick={() => void runAction(onResetSeedAlignedToToday)}
                    disabled={isWorking}
                    className={`${buttonClass} w-full border-sky-300 bg-sky-50 text-sky-700 hover:bg-sky-100`}
                  >
                    Make trip happen now
                  </button>
                </div>
              ) : null}
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
