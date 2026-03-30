# Archived Execution Plan - 2026-02-27

As of 2026-03-30, this document is historical context only. It does not represent the current roadmap for `main`.

Current sources of truth:

- `docs/PRODUCT_PLAN.md` for product status and milestone order
- `docs/FOUNDATION_ACTIVATION.md` for the remaining phase 1 activation and hardening work

## What Happened To This Plan?

- Branch A ideas were largely folded into `main` through the itinerary-first desktop shell, switchable rail panels, stable map framing, and scroll-behaviour hardening.
- Branch B was exploratory UI-lab work. It did not become the shipping product direction, and there is no active `/ui-lab` route on `main`.

## Historical Snapshot

### Branch A: `feat/dashboard-itinerary-map-ux`

Status: mostly landed or superseded by the current shell.

1. Increase itinerary panel prominence.
   Result: landed in the itinerary-first desktop rail layout.
2. Make Trip Details and Today's Actions collapsible.
   Result: superseded by switchable `Overview` and `Today` panels rather than collapsible stacked sections.
3. Keep itinerary and day strip always visible and primary.
   Result: landed.
4. Map selection behavior: pan-only plus popup.
   Result: largely landed.
5. Keep fit-to-trip overview and protect against over-zoom.
   Result: landed in the current map framing work.
6. Popup content focused on operational summary.
   Result: simplified into the current map selection behavior.

### Branch B: `feat/ui-theme-lab`

Status: exploratory, not active.

1. Create `/ui-lab` route.
   Result: not on `main`.
2. Implement dark close-inspired theme.
   Result: not the current priority.
3. Desktop hover-expand sidebar.
   Result: not pursued on `main`.
4. Mobile drawer sidebar via menu button.
   Result: not pursued on `main`.
5. Top action buttons as visual mocks with local toggle state.
   Result: not pursued on `main`.

## Historical Validation

The original validation steps were:

1. `npm run lint`
2. `npm run build`
3. Manual desktop/mobile checks for collapse behavior, map camera, popup behavior, and UI-lab interactions

For current validation, use the live checklists in `docs/FOUNDATION_ACTIVATION.md` and `docs/QA_NOTES.md`.
