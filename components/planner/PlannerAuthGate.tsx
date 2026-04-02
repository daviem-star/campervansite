"use client";

import { FormEvent, useState } from "react";

import PlannerBrandBadge from "@/components/planner/PlannerBrandBadge";
import { canUseLocalTestSignIn, isLocalTestSignInEnabled } from "@/lib/runtimeFlags";
import { PlannerNotice } from "@/types/trip";

type PlannerAuthGateProps = {
  authStatus: "disabled" | "signed_out";
  error: string | null;
  notice: PlannerNotice | null;
  onSignIn: (email: string) => Promise<void>;
  onSignInAsTestUser: () => Promise<void>;
};

const noticeToneClass = {
  info: "border-sky-200 bg-sky-50 text-sky-800",
  success: "border-emerald-200 bg-emerald-50 text-emerald-800",
  warning: "border-amber-200 bg-amber-50 text-amber-800",
} as const;

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
    <div className="min-h-screen bg-slate-100 px-4 py-10">
      <div className="mx-auto grid max-w-6xl gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        <section className="rounded-[2rem] border border-slate-200 bg-white p-8 shadow-sm">
          <div className="max-w-2xl">
            <PlannerBrandBadge className="mb-5" />
            <h1 className="planner-title-hero text-slate-950">
              Sign in first, then plan from the full trip workspace.
            </h1>
            <p className="planner-copy mt-4 text-slate-600">
              The planner is now private by default. Once you sign in, the same trip can open on
              desktop before departure and on tablet or mobile while travelling.
            </p>

            <div className="mt-8 grid gap-3 sm:grid-cols-3">
              {[
                ["Itinerary-first", "See stays, ferries, and POIs in one connected timeline."],
                ["Cloud sync", "Keep the same trip available across devices while you are online."],
                ["Travel review", "Reopen the last synced trip offline in read-only mode."],
              ].map(([title, body]) => (
                <div key={title} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <p className="planner-title-sm text-slate-900">{title}</p>
                  <p className="planner-copy mt-2 text-slate-600">{body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="rounded-[2rem] border border-slate-200 bg-white p-8 shadow-sm">
          <h2 className="planner-title-xl text-slate-950">
            {authStatus === "disabled" ? "Planner setup required" : "Continue with magic link"}
          </h2>
          <p className="planner-copy mt-3 text-slate-600">
            {authStatus === "disabled"
              ? "Supabase is not configured in this environment yet, so sign-in is unavailable until the runtime keys are added."
              : "Enter your email address and we’ll send a magic link to open the planner on this device."}
          </p>

          {error ? (
            <p className="planner-copy mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-amber-800">
              {error}
            </p>
          ) : null}

          {notice ? (
            <p
              data-testid="auth-notice"
              className={`planner-copy mt-4 rounded-2xl border px-4 py-3 ${noticeToneClass[notice.tone]}`}
            >
              {notice.text}
            </p>
          ) : null}

          {authStatus === "signed_out" ? (
            <form onSubmit={onSubmit} className="mt-6 space-y-3">
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-slate-700">Email address</span>
                <input
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="you@example.com"
                  className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm text-slate-900 focus:border-sky-500 focus:outline-none"
                />
              </label>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full rounded-2xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400"
              >
                {isSubmitting ? "Sending..." : "Send magic link"}
              </button>

              {showLocalTestSignIn ? (
                <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-4">
                  <p className="planner-eyebrow text-slate-500">Local dev only</p>
                  <p className="planner-copy mt-2 text-slate-600">
                    Skip email delivery and open the planner with the local test account.
                  </p>
                  {!localTestSignInReady ? (
                    <p className="planner-meta mt-2 text-amber-700">
                      Enable the E2E auth bypass env flags to use local test sign-in.
                    </p>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => void onSignInAsTestUser()}
                    disabled={isSubmitting || !localTestSignInReady}
                    className="mt-3 w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    Sign in as test user
                  </button>
                </div>
              ) : null}
            </form>
          ) : (
            <div className="planner-copy mt-6 rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-5 text-slate-600">
              Add the Supabase keys to `.env.local`, restart the app, and this sign-in form will
              become available here.
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
