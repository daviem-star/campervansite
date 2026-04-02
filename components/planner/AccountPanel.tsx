"use client";

import { FormEvent, useState } from "react";

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

const syncTone: Record<SyncStatus, string> = {
  idle: "border-slate-200 bg-slate-100 text-slate-700",
  saving: "border-sky-200 bg-sky-50 text-sky-700",
  saved: "border-teal-200 bg-teal-50 text-teal-700",
  offline: "border-amber-200 bg-amber-50 text-amber-800",
  error: "border-rose-200 bg-rose-50 text-rose-700",
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
      ? syncTone[syncStatus]
      : mode === "cloud"
        ? syncTone.saved
        : syncTone.idle;

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
    <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-sm font-semibold text-slate-900">Account and sync</h2>
            <span
              className={`rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${displayedStatusTone}`}
            >
              {displayedStatusLabel}
            </span>
            {mode === "demo" ? (
              <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-0.5 text-[11px] font-semibold text-slate-600">
                Demo trip
              </span>
            ) : null}
          </div>

          <p className="mt-1 text-sm text-slate-600">
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
            <p className="mt-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800">
              You can review the last synced trip offline, but edits are disabled until you reconnect.
            </p>
          ) : null}

          {statusMessage ? (
            <p className="mt-2 rounded-xl border border-sky-200 bg-sky-50 px-3 py-2 text-xs font-medium text-sky-800">
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
                  className="rounded-xl bg-slate-900 px-3 py-2 text-xs font-semibold text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:bg-slate-400"
                >
                  Create cloud trip
                </button>
              ) : null}

              {hasLegacyImport ? (
                <button
                  type="button"
                  onClick={() => void runAction(onImportLegacy)}
                  disabled={isWorking}
                  className="rounded-xl border border-sky-200 bg-sky-50 px-3 py-2 text-xs font-semibold text-sky-700 transition hover:bg-sky-100 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Import local trips
                </button>
              ) : null}

              <button
                type="button"
                onClick={() => void runAction(onSignOut)}
                disabled={isWorking}
                className="rounded-xl border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
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
              className="flex-1 rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-sky-500 focus:outline-none"
            />
            <button
              type="submit"
              disabled={isWorking}
              className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:bg-slate-400"
            >
              {isWorking ? "Sending..." : "Send magic link"}
            </button>
          </form>

          {showLocalTestSignIn ? (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-4">
              <p className="text-xs font-medium uppercase tracking-[0.12em] text-slate-500">
                Local dev only
              </p>
              <p className="mt-2 text-sm text-slate-600">
                Use the built-in test account to open signed-in planner flows without sending email.
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
                className="mt-3 rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
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
