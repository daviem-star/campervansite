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

### Mobile

- [ ] Default tab is `Today`
- [ ] Tab switching preserves selection/highlights (`Today` / `Itinerary` / `Map`)
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

- [ ] Left pane fixed sections remain visible while itinerary list scrolls
- [ ] First itinerary selection focuses map
- [ ] Subsequent itinerary selections pan only (zoom preserved)
- [ ] Map click selects itinerary item without auto-zoom jump
- [ ] Ferry segment and ferry ports select the ferry itinerary item

### Validation / Failure Handling

- [ ] Geocode search: short query prompt (<2 chars)
- [ ] Geocode search: no matches state
- [ ] Geocode search: service error state
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
