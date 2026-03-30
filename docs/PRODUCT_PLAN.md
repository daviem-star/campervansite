# Campervan Trip Planner Product Plan

## Product Position

This branch represents the beta foundation for the planner. The app already has the core trip-planning UX and the cloud-sync architecture in code. The immediate job is to make that foundation real with hosted services, real credentials, and preview validation.

## Current Product Status

- One active trip planning experience with:
  - stays
  - ferries
  - points of interest
- Auth-first access model with a signed-out welcome screen.
- Signed-in starter flow that either:
  - auto-creates the example trip in the cloud, or
  - offers a one-time local-import-or-example choice when legacy browser data exists
- Desktop-first planning layout plus mobile/tablet travel review.
- Cloud-capable mode with:
  - Supabase email magic-link auth
  - cloud trip save/load/import server routes
  - sync status messaging
  - stale-write conflict recovery
  - offline read-only reopening of the last synced trip
- Planner shell now defaults to:
  - `Itinerary` as the main desktop panel
  - `View mode` until the user explicitly unlocks `Edit trip`
  - overview and today content moved into switchable panels instead of a permanently stacked left column
- Route realism support with:
  - live or fallback road-leg estimates
  - buffered drive times
  - validation warnings for travel feasibility
- Automated coverage with unit tests, lint/build checks, and Playwright trust-flow tests.

## Immediate Milestone: UI Stability And Service Activation

The next milestone is to make the new planner shell feel reliable before moving deeper into provider integrations.

- Validate the auth-first UI and live cloud path on preview:
  - magic-link sign-in
  - starter example trip creation
  - local import choice flow
  - save and reload
  - stale-write conflict recovery
  - offline read-only reopen
  - route-estimate success and fallback behavior once OpenRouteService is wired
- Keep the new desktop rail layout, edit locking, and full-trip map framing stable on real devices.
- Stand up the remaining hosted stack pieces cleanly:
  - Supabase
  - OpenRouteService
  - Vercel

### Definition Of Done

- Preview deployment is wired to real Supabase credentials, and OpenRouteService can be added without destabilizing the planner shell.
- The smoke checklist in `docs/FOUNDATION_ACTIVATION.md` passes on desktop and mobile/tablet for auth-first entry, onboarding, edit locking, and offline read-only behavior.
- `README.md`, `docs/PRODUCT_PLAN.md`, and `docs/QA_NOTES.md` accurately describe the branch.

## Next Milestone After Activation: Beta Hardening

Once the services are live, the next priority is real-world hardening rather than broad feature expansion.

- Fix issues discovered from live preview and closed-beta use.
- Tighten auth/session/service failure states using real provider behavior.
- Improve any cloud-trip management surfaces that testers immediately need.
- Keep documentation and smoke coverage aligned as real usage reveals gaps.

## Following Milestone: Planning Trust Improvements

After the hosted foundation is stable, invest in deeper planning confidence.

- Improve route estimate quality and presentation.
- Expand campsite and ferry metadata where it improves planning decisions.
- Refine warnings and travel-feasibility guidance using live user feedback.

## Explicit Non-Goals For Now

- Collaboration or trip sharing between users.
- Offline editing or merge resolution.
- Making MCP or provider integrations a prerequisite for development.

Those can be revisited later, but they should not block activation or the first beta rollout.
