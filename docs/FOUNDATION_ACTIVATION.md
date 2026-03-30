# Foundation Activation Guide

Use this runbook to take the current `main` branch from repo-complete beta foundation to a verified live preview. As of 2026-03-30, most phase 1 feature work is already in code. The remaining job is operational activation, preview validation, and release hardening.

## What This Guide Covers

- Supabase auth and persistence
- OpenRouteService route estimates and route-access snapping
- Vercel preview and production env wiring
- live smoke testing across devices
- optional local-only bypass flags for deterministic testing

## Current Service Shape

- Required for live cloud preview:
  - Supabase project
  - Vercel project
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  - `SUPABASE_SERVICE_ROLE_KEY`
- Strongly recommended for realistic routing:
  - `OPENROUTESERVICE_API_KEY`
- Already built in with no extra credentials:
  - `/api/geocode` uses Nominatim for GB-focused place search
  - route estimates fall back to internal haversine timings if OpenRouteService is unavailable
- Optional local-only flags:
  - `NEXT_PUBLIC_E2E_AUTH_BYPASS`
  - `E2E_AUTH_BYPASS`
  - `NEXT_PUBLIC_LOCAL_TEST_SIGN_IN`
  - `NEXT_PUBLIC_OPENROUTESERVICE_DEBUG`
- Reference file:
  - `.env.example`

MCP servers are not required for this setup. Provider dashboards and environment variables are enough to activate the branch.

## 1. Supabase Setup

1. Create a dedicated Supabase project for Campervan Trip Planner.
2. Enable email authentication with magic links.
3. Configure the site URL and redirect URLs for:
   - `http://localhost:3000`
   - `http://127.0.0.1:3000`
   - `http://127.0.0.1:3001`
   - your Vercel preview domain
   - your production domain
4. Apply the SQL in `supabase/migrations/20260328_trip_documents.sql`.
5. Record:
   - project URL
   - anon key
   - service role key

## 2. OpenRouteService Setup

1. Create an OpenRouteService API key.
2. Store it as `OPENROUTESERVICE_API_KEY`.
3. This key powers both:
   - live road timings in `/api/route-estimates`
   - snapped routing coordinates in `/api/route-access`
4. Without this key, the planner still works, but it will:
   - use fallback road timings
   - keep raw place coordinates instead of snapped routing coordinates

## 3. Environment Variables

Set the following in `.env.local`, Vercel Preview, and Vercel Production.

Required for live cloud mode:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

Recommended for realistic routing:

- `OPENROUTESERVICE_API_KEY`

Optional local-only and test flags:

- `NEXT_PUBLIC_E2E_AUTH_BYPASS`
- `E2E_AUTH_BYPASS`
- `NEXT_PUBLIC_LOCAL_TEST_SIGN_IN`
- `NEXT_PUBLIC_OPENROUTESERVICE_DEBUG`

Recommended local check after setting the live env vars:

1. Run `npm run dev`.
2. Open `http://localhost:3000`.
3. Confirm the signed-out auth gate shows the magic-link form instead of the setup-only message.
4. If you intentionally enabled the local bypass flags, confirm the extra `Sign in as test user` helper appears. If not, it should stay hidden.

## 4. Vercel Deployment

1. Create or link the Vercel project for this repository.
2. Add the environment variables to Preview and Production.
3. Deploy a preview build.
4. Verify the Supabase redirect URLs match the preview host before testing auth.
5. Do not promote to production until the smoke checklist below and the wider `docs/QA_NOTES.md` device checks pass.

## 5. Live-Service Smoke Checklist

Run this first on preview, then repeat on desktop plus at least one mobile/tablet device.

1. Signed-out user sees the auth gate and cannot browse the seeded itinerary before login.
2. Requesting a magic link shows a success banner with the target email.
3. A signed-in empty account either:
   - auto-gets the starter example trip when no legacy browser data exists, or
   - sees the one-time import-or-example chooser when legacy browser data exists
4. Signed-in user can save a stop edit and the sync state returns to `Saved`.
5. The same cloud trip opens on a second browser or device.
6. Place search works in the stop editor and saving the edited place does not break the itinerary.
7. Route estimates show live OpenRouteService confidence when the key is valid, and fall back cleanly when the service is unavailable.
8. If two devices edit the same trip, the stale device shows recovery messaging and reloads the latest version.
9. If the device loses service after syncing, the app reopens the cached trip in read-only mode and disables `Edit trip`.
10. Desktop rail switching, itinerary scrolling, map framing, and mobile `Today` and `Itinerary` review still behave correctly after live-service wiring.

Use `docs/QA_NOTES.md` for the broader layout and failure-handling matrix after this core smoke pass.

## 6. Automated Validation

Run these before a release candidate:

```bash
npm test
npm run lint
npm run build
npm run test:e2e
```

The Playwright suite uses the repository's internal E2E auth and backend bypass for deterministic coverage. It is valuable regression coverage, but it does not replace live preview testing against real Supabase, OpenRouteService, and Vercel configuration.

## 7. Remaining Hardening After Activation

Activation is not the end of phase 1. After the live path works, we still need to close the small hardening tail:

- Record smoke and device-pass results in `docs/QA_NOTES.md`.
- Decide whether the current console-backed `/api/analytics` endpoint is sufficient for first release or whether lightweight hosted observability is needed.
- Confirm preview-to-production promotion criteria and env parity.
- Only then shift primary roadmap energy into phase 2 planning-quality work.

## 8. Notes

- Offline behavior is intentionally read-only for the last synced active trip in this milestone.
- Forced demo mode and the local test-user helper are for development and automated testing, not the primary shipped experience.
- Provider dashboards and environment variables are enough to activate the branch. MCP servers are not required.
