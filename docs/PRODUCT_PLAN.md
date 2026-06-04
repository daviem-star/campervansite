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
The current shell now presents that through a dashboard-first nested workflow rather than separate app-level `Overview` and `Itinerary` destinations.

## Current Product State

### Information Architecture

- Desktop defaults to `Dashboard`.
- Mobile defaults to a simplified on-road companion shell with `Today`, `Trip`, and `Trips`
  destinations.
- The collapsible desktop left rail is app-level and includes:
  - `Dashboard`
  - `Today`
  - `Saved Places`
  - `Bookings`
- The rail remembers expanded or icon-only mode on the current device.
- `Dashboard` owns the trip library plus a side-by-side trip detail and map preview.
- Opening a trip creates a nested in-app flow:
  - `Dashboard`
  - `Trip Overview`
  - `Trip Itinerary`
- Nested trip screens use breadcrumb context with `Dashboard > Trip`, plus top tabs for `Overview` and `Itinerary`.
- A persistent top-left account/status control is available in the planner shell on all viewports.
- `Today` remains available as an operational status control on desktop and becomes the primary
  mobile travel-day destination.

### Panel Responsibilities

- `Dashboard`
  - trip library
  - preview-first trip selection
  - selected-trip detail panel
  - new blank trip
  - new example trip
  - open/switch trip
  - rename trip
  - delete trip
  - import local trips
- `Trip Overview`
  - compact trip summary
  - read-only trip map preview with linked stop selection
  - severity-grouped warnings with healthy-state collapse
  - summary-first travel insights with expandable route details
- `Itinerary`
  - day strip
  - edit lock
  - stop create/edit/delete
  - linked desktop/tablet map plus mobile full-screen map launcher
- `Today`
  - selected trip travel-day actions from the status control
- `Saved Places`
  - read-only deduplicated places derived across available trips
  - direct links back to each owning itinerary stop
- `Bookings`
  - read-only campsite and ferry booking details derived across available trips
  - missing booking-detail attention states and direct itinerary links
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
- New blank trips land in `Itinerary` in `Edit mode` so stop creation is immediately available.
- Example trip creation clones the seeded example with a fresh trip id, owner, version, and timestamps.
- Existing and example trips continue to open view-first.
- Deleting the active trip automatically loads the most recently updated remaining trip.
- The last remaining cloud trip cannot be deleted in v1.

### Cloud Mode, Demo Mode, And Local Development

- `Cloud-only` means authenticated cloud mode in any environment:
  - localhost with Supabase configured
  - localhost with the E2E bypass path
  - hosted preview/production
- Demo mode remains single-trip.
- The cloud trip library is hidden in demo mode, but `Dashboard` still remains the planner landing screen.

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
- Verify dashboard-first multi-trip flows on live preview:
  - create blank trip
  - create example trip
  - preview a trip from Dashboard
  - open a trip into Overview
  - switch between Overview and Itinerary
  - return to Dashboard from the breadcrumb
  - rename trip
  - delete non-active trip
  - last-trip delete blocked
- Verify the onboarding trust path:
  - starter example creation
  - legacy import chooser
  - legacy import returning cleanly into the planner
- Verify trust protections still hold after the new IA:
  - `Dashboard` stays the app-level landing screen
  - `Overview` stays trip-only inside the nested trip workspace
  - account/sync controls live in the account/status popup
  - `View mode` hides mutation controls until switching to `Edit mode`
  - offline reopen keeps the itinerary mode toggle disabled and the itinerary non-mutable

### Definition Of Done For This Milestone

- Protected preview is live against real Supabase and OpenRouteService configuration.
- The hosted smoke checklist passes for the dashboard-first shell and account/status control.
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
