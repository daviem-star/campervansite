# Campervan Trip Planner Product Plan

`docs/PRODUCT_PLAN.md` is the canonical roadmap for this repository. Operational setup and smoke steps belong in `docs/FOUNDATION_ACTIVATION.md`.

## Product Direction

As of March 31, 2026, the `main` branch contains the beta planner foundation in code with cloud multi-trip management v1 implemented.

The product model is now:

- one fully loaded active trip workspace at a time
- a cloud trip library around that workspace
- explicit edit locking for itinerary mutations
- trust-first behaviour for auth, sync, conflicts, and offline reopening

This is no longer a single-trip-only planner. It is also not a multi-open editor. The product centers on one selected trip at a time, with a dedicated `Trips` section to create, switch, rename, delete, and import trips.

## Current Product State

### Information Architecture

- Desktop navigation uses:
  - `Trips`
  - `Itinerary`
  - `Overview`
  - `Today`
- Desktop keeps the map persistent beside the planner.
- Mobile navigation uses:
  - `Trips`
  - `Itinerary`
  - `Overview`
  - `Today`
  - `Map`
- A persistent top-left account/status control is available in the planner shell on all viewports.

### Panel Responsibilities

- `Trips`
  - trip library
  - active-trip badge
  - new blank trip
  - new example trip
  - open/switch trip
  - rename trip
  - delete trip
  - import local trips
- `Itinerary`
  - day strip
  - edit lock
  - stop create/edit/delete
- `Overview`
  - selected trip summary
  - travel insights
  - validation warnings
  - gap warnings
- `Today`
  - selected trip travel-day actions
- Account/status popup
  - auth state
  - account identity
  - sync/connectivity state
  - sign in/sign out
  - local test sign-in helper
  - demo-only reset tools

### Multi-Trip V1

- Cloud mode now supports:
  - create blank trip
  - create example trip
  - switch trips
  - rename trips
  - hard delete trips
- Blank trip creation requires:
  - trip name
  - home pin
- Example trip creation clones the seeded example with a fresh trip id, owner, version, and timestamps.
- Deleting the active trip automatically loads the most recently updated remaining trip.
- The last remaining cloud trip cannot be deleted in v1.

### Cloud Mode, Demo Mode, And Local Development

- `Cloud-only` means authenticated cloud mode in any environment:
  - localhost with Supabase configured
  - localhost with the E2E bypass path
  - hosted preview/production
- Demo mode remains single-trip.
- The `Trips` section is hidden in demo mode.

### Trust And Quality Foundations Already In Code

- signed-out auth gate before planner access
- starter-trip onboarding for empty cloud accounts
- one-time import-or-example chooser when legacy local data exists
- Supabase magic-link auth
- cloud trip list/load/save/create/rename/delete/import API routes
- stale-write conflict recovery
- cached last-synced trip reopening in offline read-only mode
- route estimates with live and fallback behaviour
- snapped routing coordinates for edited places
- validation warnings, gap warnings, and today actions
- deterministic automated coverage via Vitest, API route tests, and Playwright

## Immediate Priority: Stabilize And Activate

The immediate product priority is no longer “build multi-trip.” That work is now in code. The next job is to validate and harden it against live services and real devices.

### Highest-Priority Validation Work

- Verify hosted auth and cloud persistence against real Supabase configuration.
- Verify multi-trip flows on live preview:
  - create blank trip
  - create example trip
  - switch trip
  - rename trip
  - delete non-active trip
  - delete active trip with fallback load
  - last-trip delete blocked
- Verify the onboarding trust path:
  - starter example creation
  - legacy import chooser
  - legacy import returning cleanly into the planner
- Verify trust protections still hold after the new IA:
  - `Overview` stays trip-only
  - account/sync controls live in the account/status popup
  - `View mode` hides mutation controls until `Edit trip`
  - offline reopen keeps `Edit trip` disabled and the itinerary non-mutable

### Definition Of Done For This Milestone

- Protected preview is live against real Supabase and OpenRouteService configuration.
- The hosted smoke checklist passes for the new `Trips` shell and account/status control.
- `docs/QA_NOTES.md` records device and smoke results for the current planner IA.
- `README.md`, `docs/PRODUCT_PLAN.md`, and `docs/FOUNDATION_ACTIVATION.md` all describe the same product honestly without duplicated roadmap drift.

## Next Product Phase: Planning Quality

After hosted validation is stable, the next product phase is not more CRUD. It is better trip planning quality.

Priority areas:

- improve route-realism quality and provider resilience
- deepen ferry planning into a more complete booking and check-in workflow
- improve campsite intelligence and trust signals where they genuinely help planning
- strengthen place-search quality and route-access accuracy for edited stops
- tune warnings and planner guidance from real preview usage rather than only seeded data

## Later Product Phase: On-Road Readiness

Once the planner is trustworthy in hosted use:

- improve concise travel-day support on mobile and tablet
- consider safe offline expansion beyond the current read-only reopen model
- add export, sharing, or handoff paths
- treat observability, degraded-mode behaviour, and performance as first-class travel concerns

## Explicit Non-Goals For Now

- multi-user collaboration or shared-trip editing
- offline editing or merge resolution
- duplicate-trip and archive-trip flows in v1
- trip-level home or timezone editing after creation
- sharing and export in this milestone
- broad feature expansion before hosted validation of the new trip library shell is complete
