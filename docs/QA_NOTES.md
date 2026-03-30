# QA Notes

Manual QA tracking for the Campervan Trip Planner.

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
- Branch:
- Commit:
- Build/Run mode: (`npm run dev` / `npm run start`)

## Manual QA Checklist

### Cloud / Sync Smoke

- [ ] Signed-out state shows the auth gate and does not expose the example itinerary before login
- [ ] Magic-link request shows a clear success banner with the target email
- [ ] Signed-in empty account auto-creates the starter example trip when no legacy local data exists
- [ ] Signed-in empty account with legacy local data shows the one-time import-or-example chooser
- [ ] Cloud trip can be loaded on a second browser/device
- [ ] Stop edit returns sync state to `Saved`
- [ ] Legacy local import works once and then drops back into the main planner
- [ ] Stale write conflict reloads the latest trip and shows recovery messaging
- [ ] Last synced trip reopens offline in read-only mode with the global `Edit trip` control disabled
- [ ] Route estimates succeed when OpenRouteService is configured and fall back gracefully when unavailable

### Mobile

- [ ] Default tab is `Today`
- [ ] Tab switching preserves selection/highlights (`Today` / `Itinerary` / `Overview` / `Map`)
- [ ] Itinerary tab has fixed controls and scrollable itinerary list only
- [ ] Day chip selection scrolls to the correct itinerary section
- [ ] Map interactions select and highlight itinerary items
- [ ] Today actions are readable and correctly formatted

### Tablet

- [ ] Split layout aligns itinerary pane top and map top
- [ ] Itinerary list scroll behavior works as expected
- [ ] Day selection + auto-scroll works
- [ ] Map/list sync works in both directions
- [ ] Reset Map returns to trip overview

### Desktop

- [ ] Authenticated desktop defaults to the `Itinerary` panel with the map visible
- [ ] Left rail switches cleanly between `Itinerary`, `Overview`, and `Today`
- [ ] Lower itinerary sections remain reachable and their `Edit` actions stay clickable
- [ ] Itinerary auto-scroll keeps the top toolbar and rail visible instead of shifting the whole planner upward
- [ ] View mode hides mutation controls until `Edit trip` is enabled
- [ ] Offline read-only state keeps `Edit trip` disabled and the itinerary non-mutable
- [ ] First itinerary selection focuses map
- [ ] Subsequent itinerary selections pan only (zoom preserved)
- [ ] Map click selects itinerary item without auto-zoom jump
- [ ] Ferry segment and ferry ports select the ferry itinerary item
- [ ] Initial map overview shows the full trip rather than starting tightly zoomed

### Validation / Failure Handling

- [ ] Geocode search: short query prompt (<2 chars)
- [ ] Geocode search: no matches state
- [ ] Geocode search: service error state
- [ ] Auth/session failure state explains what the user should do next
- [ ] Cloud service error state falls back cleanly without breaking the planner
- [ ] Stop editor invalid date/time shows clear error
- [ ] Stop editor invalid cost shows clear error

## Issue Log

| ID | Device / Viewport | Area | Steps | Actual | Expected | Severity | Status | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| QA-001 |  |  |  |  |  |  | open |  |

## Fix Verification Log

| Issue ID | Fix Branch/Commit | Verified By | Verified Date | Result | Notes |
| --- | --- | --- | --- | --- | --- |
|  |  |  |  |  |  |
