# Foundation Activation Guide

Use this runbook to take approved commits from `main` through `staging` and into a verified live preview. Roadmap and product-scope decisions live in `docs/PRODUCT_PLAN.md`; this guide is only for environment setup, promotion, and smoke validation.

## What This Guide Covers

- Supabase auth and persistence
- OpenRouteService route estimates and route-access snapping
- Vercel preview and production env wiring
- preview-only quota guardrails for search, tiles, and tester access
- live smoke testing across devices
- optional local-only bypass flags for deterministic testing

The pre-launch release model is one app codebase with short-lived feature branches merging into `main`, approved commits fast-forwarded into `staging` for protected cloud QA, and a dormant `production` branch reserved for the first intentional go-live cutover.

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
- The E2E auth flags enable explicit local test-user and E2E flows. They can coexist with real Supabase magic-link auth and do not replace cloud-backed sign-in.
- Optional hosted-preview tile configuration:
  - `NEXT_PUBLIC_MAP_TILE_URL_TEMPLATE`
  - `NEXT_PUBLIC_MAP_TILE_ATTRIBUTION`
- Reference file:
  - `.env.example`

MCP servers are not required for this setup. Provider dashboards and environment variables are enough to activate preview from `staging` after promotion from `main` and keep production dormant until launch.

## 1. Supabase Setup

1. Create or reuse the dedicated Supabase project for Campervan Trip Planner.
2. Enable email authentication with magic links.
3. Configure the site URL and redirect URLs for:
   - `http://localhost:3000`
   - `http://127.0.0.1:3000`
   - `http://127.0.0.1:3001`
   - your Vercel preview domain
   - Vercel preview wildcard redirects, for example `https://*-<your-vercel-team-or-account-slug>.vercel.app/**`
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

Optional hosted-preview tile overrides:

- `NEXT_PUBLIC_MAP_TILE_URL_TEMPLATE`
- `NEXT_PUBLIC_MAP_TILE_ATTRIBUTION`

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
2. Add the environment variables to Preview first, including any map tile overrides if you are not using the default OpenStreetMap raster tiles.
3. Add the same app-facing variables to Production with production-safe values so the project is launch-ready even before you use the production branch.
4. Enable deployment protection for the preview and keep the first hosted wave to 1-3 testers.
5. In the Vercel dashboard, open `Settings -> Environments -> Production -> Branch Tracking`, set the Production Branch to `production`, and do not push that branch until launch is approved.
6. Keep `main` as the integration branch, and create long-lived local `staging` and `production` refs if they do not already exist.
7. The repo disables Vercel auto-deploys for `main` in `vercel.json`, so `main` can absorb merges without creating a duplicate preview build. Leave `staging`, `production`, and feature branches deployable.
8. When a `main` commit passes local validation and you want hosted QA, fast-forward `staging` to that exact commit and push `staging`.
   Use `npm run promote:staging` from a clean `main` worktree to automate the push plus fast-forward sequence.
9. The repo pins the Vercel framework preset in `vercel.json`; if the dashboard still shows `Other`, redeploy after pulling the latest branch so the override takes effect.
10. Verify the preview deployment metadata and Supabase redirect URLs match the `staging` preview host before testing auth.
11. Do not push or promote production until the smoke checklist below and the wider `docs/QA_NOTES.md` device checks pass.

Recommended local-first flow:

```bash
npm run validate:local
```

Pause here after the local gate passes. Continue to hosted QA only when you want to verify Vercel and live-service behavior for that exact commit.

Recommended promotion commands:

```bash
npm run promote:staging

git switch production
git merge --ff-only staging
git push origin production
```

The staged hosted smoke runner now has a promotion preflight. Use:

```bash
npm run smoke:staging -- "<vercel-share-url>"
```

That command refuses to run if:

- the worktree is dirty
- `HEAD` has not been pushed to `origin/main`
- `origin/staging` has not been fast-forwarded to the same commit as `origin/main`

## 5. Live-Service Smoke Checklist

Run this first on preview, then repeat on desktop plus at least one mobile/tablet device.

1. Signed-out user sees the auth gate and cannot browse the seeded itinerary before login.
2. Requesting a magic link shows a success banner with the target email.
3. A signed-in empty account either:
   - auto-gets the starter example trip when no legacy browser data exists, or
   - sees the one-time import-or-example chooser when legacy browser data exists
4. Signed-in cloud mode shows the `Trips` section and top-left account/status control.
5. Multi-trip flows work:
   - create blank trip
   - create example trip
   - switch trip
   - rename trip
   - delete non-active trip
   - delete active trip with fallback load
   - block deleting the last remaining trip
6. Signed-in user can save a stop edit and the sync state returns to `Saved`.
7. The same cloud trip opens on a second browser or device.
8. Place search works in the stop editor after a deliberate submitted lookup, and saving the edited place does not break the itinerary.
9. Route estimates show live OpenRouteService confidence when the key is valid, and fall back cleanly when the service is unavailable.
10. If two devices edit the same trip, the stale device shows recovery messaging and reloads the latest version.
11. If the device loses service after syncing, the app reopens the cached trip in read-only mode and disables the itinerary mode toggle.
12. Desktop rail switching, itinerary scrolling, map framing, mobile tabs, and the account/status popup all behave correctly after live-service wiring.

Use `docs/QA_NOTES.md` for the broader layout and failure-handling matrix after this core smoke pass.

## 6. Automated Validation

Run the bundled local gate before a release candidate:

```bash
npm run validate:local
```

That command expands to:

```bash
npm test
npm run lint
npm run build
npm run test:e2e
```

The Playwright suite uses the repository's internal E2E auth and backend bypass for deterministic coverage. It is valuable regression coverage, but it does not replace live preview testing against real Supabase, OpenRouteService, and Vercel configuration on the promoted `staging` branch.

## 7. Remaining Hardening After Activation

After the live path works, we still need to close the remaining hardening tail:

- Record smoke and device-pass results in `docs/QA_NOTES.md`.
- Decide whether the current console-backed `/api/analytics` endpoint is sufficient for first release or whether lightweight hosted observability is needed.
- Review preview logs for `/api/geocode`, `/api/route-access`, and `/api/route-estimates` before expanding beyond the first 1-3 testers.
- Confirm preview-to-production promotion criteria and env parity.
- Only then shift primary roadmap energy into phase 2 planning-quality work.

## 8. Notes

- Offline behavior is intentionally read-only for the last synced active trip in this milestone.
- Forced demo mode and the local test-user helper are for development and automated testing, not the primary shipped experience.
- Provider dashboards and environment variables are enough to activate preview from `staging` after promotion from `main` and hold production for later. The repo now carries the `main` deployment-disable rule, while the production-branch tracking toggle still lives in the Vercel dashboard. MCP servers are not required.
- The default hosted-preview tile fallback still uses OpenStreetMap raster tiles, so wider/public rollout should switch to a more durable tile provider before removing preview access limits.
