# Campervan Trip Planner Product Plan

## Product Position

This branch represents the beta foundation for the planner. The app already has the core trip-planning UX and the cloud-sync architecture in code. The immediate job is to make that foundation real with hosted services, real credentials, and preview validation.

## Current Product Status

- One active trip planning experience with:
  - stays
  - ferries
  - points of interest
- Desktop-first planning layout plus mobile/tablet travel review.
- Demo mode with seeded local data and browser persistence.
- Cloud-capable mode with:
  - Supabase email magic-link auth
  - cloud trip save/load/import server routes
  - sync status messaging
  - stale-write conflict recovery
  - offline read-only reopening of the last synced trip
- Route realism support with:
  - live or fallback road-leg estimates
  - buffered drive times
  - validation warnings for travel feasibility
- Automated coverage with unit tests, lint/build checks, and Playwright trust-flow tests.

## Immediate Milestone: Foundation Activation

The next milestone is operational, not feature-led.

- Stand up the hosted stack:
  - Supabase
  - OpenRouteService
  - Vercel
- Configure the runtime contract:
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  - `SUPABASE_SERVICE_ROLE_KEY`
  - `OPENROUTESERVICE_API_KEY`
- Apply the `trip_documents` migration and confirm the planner leaves demo-only mode when env vars are present.
- Validate the live cloud path on preview:
  - magic-link sign-in
  - cloud trip creation/import
  - save and reload
  - stale-write conflict recovery
  - offline read-only reopen
  - route-estimate success and fallback behavior
- Keep branch docs aligned with real shipped behavior while activation work lands.

### Definition Of Done

- Preview deployment is wired to real Supabase and OpenRouteService credentials.
- The smoke checklist in `docs/FOUNDATION_ACTIVATION.md` passes on desktop and mobile/tablet.
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
