# Campervan Trip Planner Product Plan

## Product Position

The `main` branch represents the beta foundation for the planner. The app already has the core trip-planning UX and the cloud-sync architecture in code. The immediate job is to make that foundation real with hosted services, real credentials, and preview validation.

This plan is aligned with the beta architecture brief in `campervan_architect_brief.docx`, which recommended a phased roadmap:

1. Foundation and trust
2. Planning quality
3. On-road readiness

The current codebase sits in phase 1, with part of that phase already implemented in code.

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

## Immediate Milestone: Finish Foundation And Trust

The architect brief identified foundation and trust as the first major delivery phase. In this repository, that means finishing the service activation and stabilisation work around the planner shell that now exists.

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
- Capture evidence that the planner now satisfies the brief's "one trip across desktop and mobile" expectation before expanding the surface area.

### Definition Of Done

- Preview deployment is wired to real Supabase credentials, and OpenRouteService can be added without destabilizing the planner shell.
- The smoke checklist in `docs/FOUNDATION_ACTIVATION.md` passes on desktop and mobile/tablet for auth-first entry, onboarding, edit locking, and offline read-only behavior.
- `README.md`, `docs/PRODUCT_PLAN.md`, and `docs/QA_NOTES.md` accurately describe the branch.

## Next Milestone After Activation: Planning Quality

Once the hosted path is live and stable, move into the architect brief's second phase: making desktop planning more trustworthy and differentiated.

- Improve route estimate quality and presentation.
- Deepen ferry handling with operator logic, booking detail, vehicle detail, and check-in confidence.
- Expand campsite data where it improves trip preparation.
- Refine warnings and travel-feasibility guidance using live user feedback and route data.

## Following Milestone: On-Road Readiness

After planning quality is strong enough for real trip preparation, move into the brief's third phase: making the product genuinely useful while travelling.

- Improve offline travel mode beyond the current read-only baseline when it is safe to do so.
- Strengthen concise travel-day support for mobile/tablet use.
- Add sharing/export/handoff capabilities so the trip is usable outside the app.
- Keep performance, observability, and degraded-mode behaviour visible as first-class requirements.

## Explicit Non-Goals For Now

- Collaboration or trip sharing between users.
- Offline editing or merge resolution.
- Making MCP or provider integrations a prerequisite for development.

Those can be revisited later, but they should not block activation or the first beta rollout.
