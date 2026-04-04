# QA Notes

Manual QA tracking for the Campervan Trip Planner.

This checklist is weighted toward validating the current hosted beta shell: a cloud trip library with one active trip workspace at a time, explicit itinerary edit locking, and trust-first auth/sync behaviour. The main job now is to verify the shipped multi-trip planner against live services and real devices.

## How To Use

For each issue, record:
1. Device + viewport
2. Steps to reproduce
3. Actual result
4. Expected result
5. Severity (`critical`, `high`, `medium`, `low`)
6. Screenshot/video reference (optional)
7. Status (`open`, `in_progress`, `fixed`, `verified`)

## Test Pass Info

- Date:
- Tester:
- Branch: usually `staging` for hosted preview work, `main` for integration validation, `production` only for go-live verification
- Vercel Production Branch setting: should stay on `production` during pre-launch
- Commit:
- Build/Run mode: (`npm run dev` / `npm run start`)

## Latest Hosted Smoke Pass

- Date: 2026-03-30
- Tester: Codex automation plus user-confirmed magic-link login
- Historical branch: `codex/cloud-preview-activation`
- Commit: `d6e1079`
- Build/Run mode: protected Vercel preview
- Preview URL: `campervansite-git-codex-cloud-prev-57af82-daviem-4121s-projects.vercel.app`
- Deployment: `dpl_ZGnK6ce6tHCLFfDTiGZ8K4UCwtdp`
- Result: passed
- Coverage:
  - Signed-out auth gate does not expose itinerary content
  - Magic-link login confirmed by the user
  - Fresh signed-in account auto-creates the starter cloud trip
  - Trip save flow works and returns to saved cloud state
  - Stay-place search works with explicit `Search` submission and saved result selection
  - Live route estimates render on the overview panel
  - Desktop panel switching works across `Trips`, `Overview`, `Itinerary`, and `Today`
  - Same cloud trip loads in a second browser context
  - Stale write conflict reloads the latest trip with recovery messaging
  - Offline reopen shows the last synced trip as read-only with the itinerary mode toggle disabled
- Notes:
  - This hosted smoke pass predates the current separated `Trips` selector, simplified itinerary mode toggle, and tightened top-left account trigger, so those flows still need a current hosted rerun and fresh evidence.
  - Hosted smoke was exercised with `node scripts/preview-smoke.mjs <vercel-share-url>`.
  - The failing hosted search path was repaired by removing nested form markup from `components/planner/StopSearchInput.tsx`.
  - This smoke pass happened before the preview hardening was fast-forwarded into `main`; future hosted passes should be recorded against `staging` commits promoted from `main`.

## Manual QA Checklist

### Activation / Cloud Smoke

- [x] Signed-out state shows the auth gate and does not expose the example itinerary before login
- [x] Magic-link request shows a clear success banner with the target email
- [x] Signed-in empty account auto-creates the starter example trip when no legacy local data exists
- [ ] Signed-in empty account with legacy local data shows the one-time import-or-example chooser
- [ ] Signed-in cloud mode shows the `Trips` section plus the top-left account/status control
- [ ] Account/status control reflects sync state (`saved`, `saving`, `offline`, `error`) and exposes auth actions without leaking into `Overview`
- [ ] Blank trip can be created from `Trips` by entering trip name and home pin
- [ ] Example trip can be created from `Trips`
- [ ] Trip switching loads the selected trip and returns the planner to `View mode`
- [ ] Trip rename works from `Trips` and updates both the list and active trip header
- [ ] Non-active trip delete removes the trip without changing the current workspace
- [ ] Active trip delete loads the most recently updated remaining trip
- [ ] Last-trip delete is blocked clearly
- [x] Cloud trip can be loaded on a second browser/device
- [x] Stop edit returns sync state to `Saved`
- [ ] Legacy local import works once and then drops back into the main planner
- [ ] `Import local trips` is available from `Trips` when legacy browser data exists and disappears after successful import
- [x] Stale write conflict reloads the latest trip and shows recovery messaging
- [x] Last synced trip reopens offline in read-only mode with the itinerary mode toggle disabled
- [x] Stop editor place search returns submitted results after pressing `Search` and an edited place can be saved successfully
- [x] Route estimates succeed when OpenRouteService is configured and fall back gracefully when unavailable

### Mobile

- [ ] Default screen is `Dashboard`
- [ ] Signed-in cloud mode exposes the dashboard-first flow with nested `Overview` and `Itinerary`, plus full-screen map launchers instead of a dedicated `Map` tab
- [ ] Demo mode or missing cloud config hides `Trips`
- [ ] Tab switching preserves selection/highlights (`Trips` / `Overview` / `Itinerary` / `Today`)
- [ ] The tab row remains horizontally usable without crushing labels
- [ ] Top-left account/status icon opens cleanly and exposes auth/sync controls
- [ ] `Dashboard`, `Overview`, and `Itinerary` each expose a working `View map` launcher on mobile
- [ ] `Overview` is trip-only and does not contain account or sync controls
- [ ] Loaded-trip shell keeps the compact summary visible while `Overview` starts with the trip map instead of a duplicate overview card
- [ ] Day chip selection scrolls to the correct itinerary section
- [ ] Map interactions select and highlight itinerary items
- [ ] Today actions are readable and correctly formatted

### Tablet

- [ ] Inline itinerary map aligns cleanly inside the itinerary panel
- [ ] Itinerary list scroll behavior works as expected
- [ ] Day selection + auto-scroll works
- [ ] Map/list sync works in both directions
- [ ] Reset Map returns to trip overview

### Desktop

- [ ] Authenticated desktop defaults to `Dashboard`, with a visible trip map preview before opening a trip
- [ ] Signed-in cloud mode shows the top-left account/status control, a separate `Trips` selector, and `Overview`, `Itinerary`, and `Today` in the left rail
- [ ] Demo mode hides `Trips` while keeping the rest of the planner usable
- [x] Left rail switches cleanly between `Trips`, `Overview`, `Itinerary`, and `Today` when the trip library is available
- [ ] Lower itinerary sections remain reachable and their `Edit` actions stay clickable
- [ ] Itinerary auto-scroll keeps the top toolbar and rail visible instead of shifting the whole planner upward
- [ ] `Overview` remains trip-only and does not contain auth or sync controls
- [ ] Loaded-trip shell shows the compact trip summary and `Overview` no longer repeats a standalone `Trip overview` card
- [ ] Desktop/tablet `Overview` shows the larger route map above `Warnings` and `Route realism`
- [ ] Desktop/tablet `Overview` only reveals the selected-stop helper after choosing a stop, and that helper stays embedded on the map instead of below it
- [ ] Top-left account/status popup holds auth, sync, and demo-only reset controls
- [ ] View mode hides mutation controls until switching to `Edit mode`
- [ ] Offline read-only state keeps the itinerary mode toggle disabled and the itinerary non-mutable
- [ ] First itinerary selection focuses map
- [ ] Subsequent itinerary selections pan only (zoom preserved)
- [ ] Map click selects itinerary item without auto-zoom jump
- [ ] Ferry segment and ferry ports select the ferry itinerary item
- [ ] Initial map overview shows the full trip rather than starting tightly zoomed

### Validation / Failure Handling

- [ ] Geocode search: short query prompt (<3 chars)
- [ ] Geocode search: waits for explicit `Search` submission instead of querying on every keystroke
- [ ] Geocode search: no matches state
- [ ] Geocode search: service error state
- [ ] Route-access fallback does not block stop save when snapped routing coordinates are unavailable
- [ ] Auth/session failure state explains what the user should do next
- [ ] Cloud service error state falls back cleanly without breaking the planner
- [ ] Stop editor invalid date/time shows clear error
- [ ] Stop editor invalid cost shows clear error
- [ ] Trip creation rejects blank name and blank-home submissions clearly
- [ ] Trip rename rejects empty names clearly
- [ ] Trip delete confirmation is explicit and clearly communicates the last-trip guardrail

## Issue Log

| ID | Device / Viewport | Area | Steps | Actual | Expected | Severity | Status | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| QA-001 |  |  |  |  |  |  | open |  |

## Fix Verification Log

| Issue ID | Fix Branch/Commit | Verified By | Verified Date | Result | Notes |
| --- | --- | --- | --- | --- | --- |
|  |  |  |  |  |  |
