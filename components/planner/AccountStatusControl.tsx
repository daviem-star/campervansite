"use client";

import { FormEvent, useEffect, useRef, useState } from "react";

import {
  plannerNoticeToneClass,
  plannerSyncDotClass,
  plannerSyncToneClass,
} from "@/components/planner/plannerTheme";
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
  variant?: "default" | "rail";
  onSignIn: (email: string) => Promise<void>;
  onSignInAsTestUser: () => Promise<void>;
  onSignOut: () => Promise<void>;
  onCreateCloudTripFromCurrent: () => Promise<void>;
  onResetSeed: () => Promise<void>;
  onResetSeedAlignedToToday: () => Promise<void>;
};

const statusLabel: Record<SyncStatus, string> = {
  idle: "Demo mode",
  saving: "Saving",
  saved: "Cloud mode",
  offline: "Offline",
  error: "Needs attention",
};

const buttonClass =
  "rounded-2xl border px-4 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60";

export default function AccountStatusControl({
  authStatus,
  mode,
  userEmail,
  syncStatus,
  isOfflineReadOnly,
  notice,
  variant = "default",
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
        ? "Cloud sync is active for this account and trip library."
        : "This planner is still using demo data. Demo changes stay on this device until you create a cloud trip."
      : authStatus === "signed_out"
        ? "Sign in to keep the same trip available across devices while you are online."
      : "Planner access is waiting on environment configuration in this workspace.";
  const accountInitial = userEmail?.charAt(0).toUpperCase() ?? (mode === "demo" ? "D" : "A");
  const isRail = variant === "rail";
  const displayedStatusLabel =
    syncStatus === "saving" || syncStatus === "offline" || syncStatus === "error"
      ? statusLabel[syncStatus]
      : mode === "cloud"
        ? "Cloud mode"
        : "Demo mode";
  const displayedStatusTone =
    syncStatus === "saving" || syncStatus === "offline" || syncStatus === "error"
      ? plannerSyncToneClass[syncStatus]
      : mode === "cloud"
        ? plannerSyncToneClass.saved
        : plannerSyncToneClass.idle;
  const displayedStatusDot =
    syncStatus === "saving" || syncStatus === "offline" || syncStatus === "error"
      ? plannerSyncDotClass[syncStatus]
      : mode === "cloud"
        ? plannerSyncDotClass.saved
        : plannerSyncDotClass.idle;
  const panelClassName = isRail
    ? "fixed inset-y-0 left-0 z-40 w-[min(24rem,92vw)] overflow-y-auto border-r border-app-border bg-app-surface p-5 shadow-2xl lg:absolute lg:bottom-[calc(100%+0.75rem)] lg:left-0 lg:top-auto lg:inset-y-auto lg:max-h-[min(78vh,44rem)] lg:w-[23rem] lg:overflow-y-auto lg:rounded-[28px] lg:border lg:shadow-[0_24px_60px_rgb(var(--color-app-overlay)_/_0.16)]"
    : "fixed inset-y-0 left-0 z-40 w-[min(24rem,92vw)] overflow-y-auto border-r border-app-border bg-app-surface p-5 shadow-2xl lg:absolute lg:left-0 lg:top-[calc(100%+0.75rem)] lg:inset-y-auto lg:max-h-[min(78vh,44rem)] lg:w-[23rem] lg:overflow-y-auto lg:rounded-[28px] lg:border lg:shadow-[0_24px_60px_rgb(var(--color-app-overlay)_/_0.16)]";

  return (
    <div ref={containerRef} className="relative z-30 lg:w-full">
      <button
        type="button"
        aria-label="Open account and sync"
        aria-expanded={isOpen}
        data-testid="account-status-trigger"
        onClick={() => setIsOpen((current) => !current)}
        title={accountLabel}
        className={
          isRail
            ? "inline-flex w-full items-center gap-3 rounded-[18px] border border-app-border bg-app-surface px-3 py-2.5 text-left transition hover:border-brand-primary/18 hover:bg-app-surface-muted"
            : "inline-flex items-center gap-3 rounded-2xl border border-app-border bg-app-surface px-3 py-2 text-left transition hover:border-brand-primary/18 hover:bg-app-surface-muted lg:w-full lg:flex-col lg:justify-center lg:gap-2 lg:rounded-3xl lg:px-1 lg:py-3"
        }
      >
        <span
          className={`relative flex items-center justify-center bg-brand-primary text-sm font-semibold text-brand-on-primary ${
            isRail ? "h-9 w-9 rounded-xl" : "h-10 w-10 rounded-full lg:h-12 lg:w-12"
          }`}
        >
          {accountInitial}
          <span
            className={`absolute bottom-0.5 right-0.5 h-3 w-3 rounded-full border-2 border-app-surface ${displayedStatusDot}`}
          />
        </span>

        <span className={`min-w-0 ${isRail ? "flex-1" : "lg:hidden"}`}>
          <span className="planner-title-sm block truncate text-app-text">{accountLabel}</span>
          <span className="planner-meta block text-app-muted">{displayedStatusLabel}</span>
        </span>

        {isRail ? (
          <span
            className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] ${displayedStatusTone}`}
          >
            {displayedStatusLabel}
          </span>
        ) : null}
      </button>

      {isOpen ? (
        <>
          <div className="fixed inset-0 z-30 bg-app-overlay/30 lg:hidden" />

          <div
            data-testid="account-status-panel"
            className={panelClassName}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="planner-eyebrow text-app-muted">Account and sync</p>
                <h2 className="planner-title-lg mt-2 text-app-text">{accountLabel}</h2>
                <p className="planner-copy mt-1 text-app-muted">
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
                className="planner-button-secondary rounded-xl border px-3 py-1.5 text-sm transition"
              >
                Close
              </button>
            </div>

            <div className="mt-5 flex flex-wrap items-center gap-2">
              <span
                className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold ${displayedStatusTone}`}
              >
                {displayedStatusLabel}
              </span>
              <span className="planner-pill rounded-full border px-2.5 py-0.5 text-xs font-semibold">
                {mode === "cloud" ? "Cloud mode" : "Demo mode"}
              </span>
            </div>

            {isOfflineReadOnly ? (
              <p className="planner-copy tone-warning mt-4 rounded-2xl border px-4 py-3">
                The last synced trip is available to review, but edits and trip management stay
                locked until the connection returns.
              </p>
            ) : null}

            <div className="mt-5 rounded-3xl border border-app-border bg-app-surface-muted p-4">
              <p className="planner-eyebrow text-app-muted">Sync details</p>
              <p className="planner-copy mt-2 text-app-muted">{syncDetails}</p>
              {notice ? (
                <p
                  data-testid="account-notice"
                  className={`planner-copy mt-3 rounded-2xl border px-3 py-2 ${plannerNoticeToneClass[notice.tone]}`}
                >
                  {notice.text}
                </p>
              ) : null}
            </div>

            <div className="mt-5 space-y-4">
              {authStatus === "signed_in" ? (
                <>
                  <div className="rounded-3xl border border-app-border bg-app-surface-muted p-4">
                    <p className="planner-title-sm text-app-text">Account</p>
                    <p className="planner-copy mt-1 break-all text-app-muted">
                      {userEmail ?? "Signed-in account"}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => void runAction(onSignOut)}
                    disabled={isWorking}
                    className={`${buttonClass} planner-button-secondary`}
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
                  className={`${buttonClass} planner-button-primary`}
                >
                  Create cloud trip
                </button>
              ) : null}

              {authStatus === "signed_out" ? (
                <div className="space-y-3 rounded-3xl border border-app-border bg-app-surface-muted p-4">
                  <div>
                    <p className="planner-title-sm text-app-text">Sign in</p>
                    <p className="planner-copy mt-1 text-app-muted">
                      Send a magic link to this device so the planner can open cloud mode.
                    </p>
                  </div>

                  <form onSubmit={submitMagicLink} className="space-y-3">
                    <input
                      type="email"
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                      placeholder="you@example.com"
                      className="planner-input w-full rounded-2xl border px-4 py-3 text-sm"
                    />
                    <button
                      type="submit"
                      disabled={isWorking}
                      className="planner-button-primary w-full rounded-2xl border px-4 py-3 text-sm font-semibold transition disabled:cursor-not-allowed"
                    >
                      {isWorking ? "Sending..." : "Send magic link"}
                    </button>
                  </form>
                </div>
              ) : null}

              {authStatus === "signed_out" && showLocalTestSignIn ? (
                <div className="rounded-3xl border border-dashed border-app-border bg-app-surface p-4">
                  <p className="planner-eyebrow text-app-muted">Local dev only</p>
                  <p className="planner-copy mt-2 text-app-muted">
                    Use the built-in test account to exercise signed-in cloud flows without email.
                  </p>
                  {!localTestSignInReady ? (
                    <p className="planner-meta mt-2 text-state-warning">
                      Enable the E2E auth bypass env flags to use local test sign-in.
                    </p>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => void runAction(onSignInAsTestUser)}
                    disabled={isWorking || !localTestSignInReady}
                    className="planner-button-secondary mt-3 rounded-2xl border px-4 py-3 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    Sign in as test user
                  </button>
                </div>
              ) : null}

              {authStatus === "disabled" ? (
                <p className="planner-copy rounded-2xl border border-app-border bg-app-surface-muted px-4 py-3 text-app-muted">
                  Cloud sync is unavailable in this environment right now, so the planner stays in
                  demo mode.
                </p>
              ) : null}

              {mode === "demo" ? (
                <div className="space-y-3 rounded-3xl border border-app-border bg-app-surface-muted p-4">
                  <div>
                    <p className="planner-title-sm text-app-text">Demo tools</p>
                    <p className="planner-copy mt-1 text-app-muted">
                      Keep the seeded itinerary handy while we are testing locally.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => void runAction(onResetSeed)}
                    disabled={isWorking}
                    className={`${buttonClass} planner-button-secondary w-full`}
                  >
                    Reset seed data
                  </button>

                  <button
                    type="button"
                    onClick={() => void runAction(onResetSeedAlignedToToday)}
                    disabled={isWorking}
                    className={`${buttonClass} planner-button-support w-full`}
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
