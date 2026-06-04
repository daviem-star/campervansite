"use client";

import { FormEvent, useState } from "react";

import PlannerBrandBadge from "@/components/planner/PlannerBrandBadge";
import ThemeModeToggle from "@/components/planner/ThemeModeToggle";
import { plannerNoticeToneClass } from "@/components/planner/plannerTheme";
import { canUseLocalTestSignIn, isLocalTestSignInEnabled } from "@/lib/runtimeFlags";
import { PlannerNotice } from "@/types/trip";

type PlannerAuthGateProps = {
  authStatus: "disabled" | "signed_out";
  error: string | null;
  notice: PlannerNotice | null;
  onSignIn: (email: string) => Promise<void>;
  onSignInAsTestUser: () => Promise<void>;
};

export default function PlannerAuthGate({
  authStatus,
  error,
  notice,
  onSignIn,
  onSignInAsTestUser,
}: PlannerAuthGateProps) {
  const [email, setEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const showLocalTestSignIn = isLocalTestSignInEnabled();
  const localTestSignInReady = canUseLocalTestSignIn();

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setIsSubmitting(true);

    try {
      await onSignIn(email);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-app-bg px-4 py-10">
      <div className="mx-auto mb-4 flex max-w-6xl justify-end">
        <ThemeModeToggle />
      </div>
      <div className="mx-auto grid max-w-6xl gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        <section className="rounded-[2rem] border border-app-border bg-app-surface p-8 shadow-sm">
          <div className="max-w-2xl">
            <PlannerBrandBadge className="mb-5" />
            <h1 className="planner-title-hero text-app-text">
              Sign in first, then plan from the full trip workspace.
            </h1>
            <p className="planner-copy mt-4 text-app-muted">
              The planner is now private by default. Once you sign in, the same trip can open on
              desktop before departure and on tablet or mobile while travelling.
            </p>

            <div className="mt-8 grid gap-3 sm:grid-cols-3">
              {[
                ["Itinerary-first", "See stays, ferries, and POIs in one connected timeline."],
                ["Cloud sync", "Keep the same trip available across devices while you are online."],
                ["Travel review", "Reopen the last synced trip offline in read-only mode."],
              ].map(([title, body]) => (
                <div key={title} className="rounded-2xl border border-app-border bg-app-surface-muted p-4">
                  <p className="planner-title-sm text-app-text">{title}</p>
                  <p className="planner-copy mt-2 text-app-muted">{body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="rounded-[2rem] border border-app-border bg-app-surface p-8 shadow-sm">
          <h2 className="planner-title-xl text-app-text">
            {authStatus === "disabled" ? "Planner setup required" : "Continue with magic link"}
          </h2>
          <p className="planner-copy mt-3 text-app-muted">
            {authStatus === "disabled"
              ? "Supabase is not configured in this environment yet, so sign-in is unavailable until the runtime keys are added."
              : "Enter your email address and we’ll send a magic link to open the planner on this device."}
          </p>

          {error ? (
            <p className="planner-copy tone-warning mt-4 rounded-2xl border px-4 py-3">
              {error}
            </p>
          ) : null}

          {notice ? (
            <p
              data-testid="auth-notice"
              className={`planner-copy mt-4 rounded-2xl border px-4 py-3 ${plannerNoticeToneClass[notice.tone]}`}
            >
              {notice.text}
            </p>
          ) : null}

          {authStatus === "signed_out" ? (
            <form onSubmit={onSubmit} className="mt-6 space-y-3">
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-app-text">Email address</span>
                <input
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="you@example.com"
                  className="planner-input w-full rounded-2xl border px-4 py-3 text-sm"
                />
              </label>

              <button
                type="submit"
                disabled={isSubmitting}
                className="planner-button-primary w-full rounded-2xl border px-4 py-3 text-sm font-semibold transition disabled:cursor-not-allowed"
              >
                {isSubmitting ? "Sending..." : "Send magic link"}
              </button>

              {showLocalTestSignIn ? (
                <div className="rounded-2xl border border-dashed border-app-border bg-app-surface-muted px-4 py-4">
                  <p className="planner-eyebrow text-app-muted">Local dev only</p>
                  <p className="planner-copy mt-2 text-app-muted">
                    Skip email delivery and open the planner with the local test account.
                  </p>
                  {!localTestSignInReady ? (
                    <p className="planner-meta mt-2 text-state-warning">
                      Enable the E2E auth bypass env flags to use local test sign-in.
                    </p>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => void onSignInAsTestUser()}
                    disabled={isSubmitting || !localTestSignInReady}
                    className="planner-button-secondary mt-3 w-full rounded-2xl border px-4 py-3 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    Sign in as test user
                  </button>
                </div>
              ) : null}
            </form>
          ) : (
            <div className="planner-copy mt-6 rounded-2xl border border-dashed border-app-border bg-app-surface-muted px-4 py-5 text-app-muted">
              Add the Supabase keys to `.env.local`, restart the app, and this sign-in form will
              become available here.
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
