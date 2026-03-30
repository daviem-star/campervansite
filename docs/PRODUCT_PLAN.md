# Campervan Trip Planner Product Plan

## Product Position

The `main` branch now contains the beta planner foundation in code. This is no longer just a local-only MVP or a design exploration. The repository already has the auth-first entry, cloud-backed trip core, desktop/tablet/mobile planner shell, route-realism foundations, and deterministic automated coverage.

As of 2026-03-30, the live roadmap is:

1. Close out phase 1 by activating and hardening the hosted path.
2. Use real preview feedback to sharpen planning quality.
3. Only then expand into deeper on-road tooling.

The older `docs/EXECUTION_PLAN_2026-02-27.md` file is now historical context, not the current source of truth.

## Current Product Status

- The root route now opens the planner, not the older marketing landing page.
- The planner supports one active trip workspace with:
  - stays
  - ferries
  - points of interest
- Auth-first access is in place:
  - signed-out users land on a private access gate
  - signed-in users continue into the full planner
- Signed-in onboarding handles both first-run cases:
  - automatic starter example trip creation for empty cloud accounts
  - one-time import-or-example choice when legacy browser data exists
- Cloud sync foundations are implemented:
  - Supabase magic-link auth
  - cloud trip list/load/save/import API routes
  - schema migration for `trip_documents`
  - stale-write conflict recovery
  - cached last-synced trip reopening in offline read-only mode
- The planner shell is established across form factors:
  - desktop rail with switchable `Itinerary`, `Overview`, and `Today` panels
  - mobile defaulting to `Today` with tabbed review panels
  - tablet/desktop map plus itinerary pairing
  - global `Edit trip` locking to prevent accidental mutation
- Planning-quality groundwork is already present:
  - live or fallback road-leg estimates
  - buffered campervan drive timings
  - route-confidence messaging
  - stale route cache reuse when refresh fails
  - snapped routing coordinates for edited places when OpenRouteService is available
  - validation warnings, gap warnings, today actions, and travel insights
- Search and editing foundations are in place:
  - GB-focused geocode search via Nominatim
  - stop create/edit flows for stays, ferries, and POIs
  - campsite and ferry metadata fields already represented in the data model and editor
- Automated coverage is materially stronger than before:
  - Vitest coverage for data normalization, route estimates, routing helpers, cache logic, runtime flags, and Supabase helpers
  - API route tests for route estimates and route access
  - Playwright trust-flow coverage for auth gate, starter-trip onboarding, legacy import, save flow, stale conflict recovery, offline read-only reopen, route-confidence display, route caching behavior, and desktop shell interactions
  - forced demo mode plus local test sign-in for deterministic local preview work

## Phase 1: Foundation And Trust

Status: mostly implemented in code; still open operationally until live preview validation is complete.

### What Is Done

- The core planner app is the primary experience on `main`.
- Auth-first access, onboarding, sync, conflict recovery, and offline review behavior are implemented.
- The planner shell, map behavior, and edit locking are in place across desktop, tablet, and mobile.
- Route realism, place search, and route-access plumbing exist in code with fallback behavior.
- Test harnesses exist for both local deterministic flows and browser-level trust checks.

### What Still Remains

- Activate the hosted stack end to end:
  - Supabase project, auth settings, redirect URLs, and applied migration
  - Vercel Preview and Production env wiring
  - OpenRouteService key for live route estimates and snapped route-access coordinates
- Run and record live preview smoke testing on real services:
  - auth gate
  - magic-link flow
  - starter trip creation
  - legacy import choice
  - save and reload on multiple devices
  - stale-write recovery
  - offline read-only reopen
  - route estimate live and fallback behavior
  - geocode search and edited-place route access
- Capture the outcome in `docs/QA_NOTES.md` rather than relying only on automated coverage.
- Decide the minimum release-hardening layer still missing from the current beta:
  - analytics and observability beyond console logging
  - preview-to-production promotion criteria
  - any remaining copy or polish fixes discovered during live-device validation

### Definition Of Done

- A preview deployment is running against a real Supabase project with the migration applied.
- OpenRouteService-backed route estimates and route-access snapping have been verified, alongside the fallback paths.
- The activation and device smoke checklist passes and is recorded in `docs/QA_NOTES.md`.
- `README.md`, `docs/PRODUCT_PLAN.md`, `docs/FOUNDATION_ACTIVATION.md`, and `docs/QA_NOTES.md` all describe the branch accurately.

## Phase 2: Planning Quality

Status: foundations present, but the product work is still ahead of us.

Some second-phase groundwork is already in code, especially around route realism, warnings, ferry metadata, and campsite fields. The remaining job is to turn that raw capability into higher-trust planning.

Priority areas:

- Improve route realism quality, presentation, and provider resilience.
- Deepen ferry planning into a more complete booking and check-in workflow.
- Improve campsite intelligence and trust signals where they genuinely help trip preparation.
- Strengthen place-search quality and route-access accuracy for edited stops.
- Tune warnings and planner guidance from real preview usage rather than only seeded data.

## Phase 3: On-Road Readiness

Status: intentionally deferred until the hosted planner is trustworthy.

Priority areas:

- Improve concise travel-day use on mobile and tablet.
- Consider safe offline expansion beyond the current read-only reopening model.
- Add export, sharing, or handoff paths once the core planner is dependable.
- Treat performance, degraded-mode behaviour, and observability as first-class travel concerns.

## Explicit Non-Goals For Now

- Multi-user collaboration or shared-trip editing.
- Offline editing or merge resolution.
- A separate `/ui-lab` or theme-exploration branch becoming the roadmap driver again.
- MCP or provider integrations being required for normal development or deployment.
- Broad feature expansion before hosted activation and trust validation are closed.
