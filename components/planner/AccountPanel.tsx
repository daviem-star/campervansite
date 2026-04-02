"use client";

import { FormEvent, useState } from "react";

import { plannerSyncToneClass } from "@/components/planner/plannerTheme";
import { canUseLocalTestSignIn, isLocalTestSignInEnabled } from "@/lib/runtimeFlags";
import { SyncStatus } from "@/types/trip";

type AuthStatus = "disabled" | "checking" | "signed_out" | "signed_in";
type PlannerMode = "demo" | "cloud";

type AccountPanelProps = {
  authStatus: AuthStatus;
  mode: PlannerMode;
  userEmail: string | null;
  syncStatus: SyncStatus;
  isOfflineReadOnly: boolean;
  hasLegacyImport: boolean;
  statusMessage: string | null;
  onSignIn: (email: string) => Promise<void>;
  onSignInAsTestUser: () => Promise<void>;
  onSignOut: () => Promise<void>;
  onImportLegacy: () => Promise<void>;
  onCreateCloudTripFromCurrent: () => Promise<void>;
};

const syncLabel: Record<SyncStatus, string> = {
  idle: "Demo mode",
  saving: "Saving",
  saved: "Cloud mode",
  offline: "Offline",
  error: "Needs attention",
};

export default function AccountPanel({
  authStatus,
  mode,
  userEmail,
  syncStatus,
  isOfflineReadOnly,
  hasLegacyImport,
  statusMessage,
  onSignIn,
  onSignInAsTestUser,
  onSignOut,
  onImportLegacy,
  onCreateCloudTripFromCurrent,
}: AccountPanelProps) {
  const [email, setEmail] = useState("");
  const [isWorking, setIsWorking] = useState(false);
  const showLocalTestSignIn = isLocalTestSignInEnabled();
  const localTestSignInReady = canUseLocalTestSignIn();
  const displayedStatusLabel =
    syncStatus === "saving" || syncStatus === "offline" || syncStatus === "error"
      ? syncLabel[syncStatus]
      : mode === "cloud"
        ? "Cloud mode"
        : "Demo mode";
  const displayedStatusTone =
    syncStatus === "saving" || syncStatus === "offline" || syncStatus === "error"
      ? plannerSyncToneClass[syncStatus]
      : mode === "cloud"
        ? plannerSyncToneClass.saved
        : plannerSyncToneClass.idle;

  const submitMagicLink = async (event: FormEvent) => {
    event.preventDefault();
    setIsWorking(true);

    try {
      await onSignIn(email);
    } finally {
      setIsWorking(false);
    }
  };

  const runAction = async (action: () => Promise<void>) => {
    setIsWorking(true);

    try {
      await action();
    } finally {
      setIsWorking(false);
    }
  };

  return (
    <section className="rounded-3xl border border-app-border bg-app-surface p-4 shadow-sm">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-sm font-semibold text-app-text">Account and sync</h2>
            <span
              className={`rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${displayedStatusTone}`}
            >
              {displayedStatusLabel}
            </span>
            {mode === "demo" ? (
              <span className="planner-pill rounded-full border px-2.5 py-0.5 text-[11px] font-semibold">
                Demo trip
              </span>
            ) : null}
          </div>

          <p className="mt-1 text-sm text-app-muted">
            {authStatus === "disabled"
              ? "Cloud sync is not configured in this environment yet, so the planner is running in demo mode."
              : authStatus === "checking"
                ? "Checking your session and the latest trip state."
                : authStatus === "signed_out"
                  ? "Plan in demo mode now, or sign in with a magic link to sync the same trip across devices."
                  : `Signed in as ${userEmail ?? "your account"}. ${
                      mode === "cloud"
                        ? "This trip is using cloud persistence."
                        : "You are still viewing a demo trip until you create or import a cloud trip."
                    }`}
          </p>

          {isOfflineReadOnly ? (
            <p className="tone-warning mt-2 rounded-xl border px-3 py-2 text-xs font-medium">
              You can review the last synced trip offline, but edits are disabled until you reconnect.
            </p>
          ) : null}

          {statusMessage ? (
            <p className="tone-info mt-2 rounded-xl border px-3 py-2 text-xs font-medium">
              {statusMessage}
            </p>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {authStatus === "signed_in" ? (
            <>
              {mode === "demo" ? (
                <button
                  type="button"
                  onClick={() => void runAction(onCreateCloudTripFromCurrent)}
                  disabled={isWorking}
                  className="planner-button-primary rounded-xl border px-3 py-2 text-xs font-semibold transition disabled:cursor-not-allowed"
                >
                  Create cloud trip
                </button>
              ) : null}

              {hasLegacyImport ? (
                <button
                  type="button"
                  onClick={() => void runAction(onImportLegacy)}
                  disabled={isWorking}
                  className="tone-info rounded-xl border px-3 py-2 text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Import local trips
                </button>
              ) : null}

              <button
                type="button"
                onClick={() => void runAction(onSignOut)}
                disabled={isWorking}
                className="planner-button-secondary rounded-xl border px-3 py-2 text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-60"
              >
                Sign out
              </button>
            </>
          ) : null}
        </div>
      </div>

      {authStatus === "signed_out" ? (
        <div className="mt-4 space-y-3">
          <form onSubmit={submitMagicLink} className="flex flex-col gap-2 sm:flex-row">
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@example.com"
              className="planner-input flex-1 rounded-xl border px-3 py-2 text-sm"
            />
            <button
              type="submit"
              disabled={isWorking}
              className="planner-button-primary rounded-xl border px-4 py-2 text-sm font-semibold transition disabled:cursor-not-allowed"
            >
              {isWorking ? "Sending..." : "Send magic link"}
            </button>
          </form>

          {showLocalTestSignIn ? (
            <div className="rounded-2xl border border-dashed border-app-border bg-app-surface-muted px-4 py-4">
              <p className="text-xs font-medium uppercase tracking-[0.12em] text-app-muted">
                Local dev only
              </p>
              <p className="mt-2 text-sm text-app-muted">
                Use the built-in test account to open signed-in planner flows without sending email.
              </p>
              {!localTestSignInReady ? (
                <p className="mt-2 text-xs text-state-warning">
                  Enable the E2E auth bypass env flags to use local test sign-in.
                </p>
              ) : null}
              <button
                type="button"
                onClick={() => void runAction(onSignInAsTestUser)}
                disabled={isWorking || !localTestSignInReady}
                className="planner-button-secondary mt-3 rounded-xl border px-4 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60"
              >
                Sign in as test user
              </button>
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
