# Execution Plan - Dashboard UX + UI Lab
Date: 2026-02-27

## Scope
1. Branch A: `feat/dashboard-itinerary-map-ux`
2. Branch B: `feat/ui-theme-lab`

## Branch A Goals
1. Increase itinerary panel prominence (desktop split to 52/48).
2. Make Trip Details and Today's Actions collapsible, default collapsed.
3. Keep itinerary/day strip always visible and primary.
4. Map selection behavior: pan-only + popup (no auto-zoom jumps).
5. Keep fit-to-trip overview, enforce minimum zoom floor 8.0.
6. Popup content: operational summary only (times, notes, stop details).

## Branch B Goals
1. Create `/ui-lab` route in `feat/ui-theme-lab`.
2. Implement dark close-inspired theme.
3. Desktop hover-expand sidebar.
4. Mobile drawer sidebar via menu button.
5. Top action buttons as visual mocks with local toggle state.

## Validation
1. `npm run lint`
2. `npm run build`
3. Manual desktop/mobile checks for collapse behavior, map camera, popup behavior, and ui-lab interactions.
