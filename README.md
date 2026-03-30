# Campervan Trip Planner

A Next.js App Router trip planner for campervan travel. The current `main` branch is the auth-first beta foundation: signed-out users land on a private access screen, then the full planner opens after magic-link sign-in. Most of the phase 1 product work is already in code; the remaining work is live-service activation, preview validation, and release hardening.

## Current Status

- Single active trip planning experience with desktop, tablet, and mobile layouts.
- Auth-first entry with a signed-out welcome screen instead of a public demo itinerary.
- Signed-in onboarding creates a cloud-backed starter example trip automatically, or offers a one-time import/local-choice flow when legacy browser data exists.
- Cloud mode adds email magic-link auth, cloud trip save/load, sync messaging, conflict recovery, and offline read-only reopening of the last synced trip.
- Desktop uses a rail-based planner shell where the itinerary owns scrolling and overview/today content live in switchable panels.
- Route realism includes road-leg estimates, buffered drive times, route-confidence messaging, snapped routing coordinates for edited places, and validation warnings for difficult travel days.
- Automated coverage includes Vitest, API route tests, and Playwright trust flows.
- Forced demo mode and local test sign-in exist for deterministic local preview and E2E work.

The project is beyond the original local-only MVP. The main remaining gap is live service activation and hosted validation, not the core app architecture.

## What The App Does Today

- Build and edit itinerary stops for:
  - `stay`
  - `ferry`
  - `point_of_interest`
- Default to `View mode`, then explicitly unlock `Edit trip` before mutating the itinerary.
- Visualize the itinerary on a map with road-following road legs when live routing is available, plus ferry port markers and ferry segments.
- Show trip-day navigation, today actions, overview insights, gap warnings, route insights, and validation warnings.
- Search for places in the stop editor with a deliberate submitted lookup and preserve separate routing coordinates when route access data is available.
- Store campsite metadata such as booking status, hookups, hardstanding, amenities, phone, and website.
- Store ferry metadata such as operator, booking reference, vehicle details, and check-in buffers.
- Cache the last synced cloud trip so it can be reopened offline in read-only mode.

## Services Required For Full Mode

- Supabase: email magic-link auth, session verification, and cloud trip persistence.
- OpenRouteService: live route estimates and snapped route-access coordinates. The app falls back when this is not configured.
- Vercel: intended preview and production hosting target.
- Nominatim: live geocode lookup for place search. No extra key is currently required.
- Map tiles: configurable via environment variable, falling back to OpenStreetMap raster tiles for private preview use.

The app does not require MCP servers to run. Provider integrations may become useful later, but the normal path is still service dashboards plus environment variables.

## Environment Variables

Copy `.env.example` to `.env.local` and fill in the live-service values:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `OPENROUTESERVICE_API_KEY`

Optional local-only and test flags are also documented in `.env.example`:

- `NEXT_PUBLIC_E2E_AUTH_BYPASS`
- `E2E_AUTH_BYPASS`
- `NEXT_PUBLIC_LOCAL_TEST_SIGN_IN`
- `NEXT_PUBLIC_OPENROUTESERVICE_DEBUG`
- `NEXT_PUBLIC_MAP_TILE_URL_TEMPLATE`
- `NEXT_PUBLIC_MAP_TILE_ATTRIBUTION`

Supabase schema setup lives in `supabase/migrations/20260328_trip_documents.sql`.

## Local Development

1. Install dependencies:

   ```bash
   npm install
   ```

2. Start the development server:

   ```bash
   npm run dev
   ```

3. Open:

   ```
   http://localhost:3000
   ```

With Supabase env vars populated, the auth gate should expose magic-link sign-in and the post-login planner. Without them, the app stays on the setup gate until the runtime keys are added.

## Validation

Run the full local validation set before merging:

```bash
npm test
npm run lint
npm run build
npm run test:e2e
```

## Activation Checklist

1. Create or reuse the dedicated Supabase project, enable email magic-link auth, and apply the migration.
2. Create an OpenRouteService API key.
3. Add the required env vars locally and in Vercel Preview, including any map tile overrides if you are not using the default OpenStreetMap raster tiles.
4. Protect the preview deployment, keep the first wave to 1-3 testers, and run the smoke checklist in `docs/FOUNDATION_ACTIVATION.md`.
5. Record device and smoke-pass results in `docs/QA_NOTES.md`.
6. Treat the branch as release-ready only after auth-first entry, starter/import onboarding, save, conflict, offline, route-estimate, and place-search checks pass against live services.

## Repo Docs

- `docs/FOUNDATION_ACTIVATION.md`: hosted service setup and smoke-test runbook
- `docs/HOSTED_SMOKE_TEST_2026-03-30.md`: detailed record of the first hosted smoke pass, including access, failures, fixes, and rerun procedure
- `docs/PRODUCT_PLAN.md`: current product status and next milestone order
- `docs/QA_NOTES.md`: manual QA checklist and issue log

## Roadmap Source

The forward plan in this repository now follows the architecture brief in `campervan_architect_brief.docx`, which framed the product in three phases:

1. Foundation and trust: shared trip data, sync, offline confidence, and a reliable trip core
2. Planning quality: route realism, ferry depth, campsite intelligence, and stronger validation
3. On-road readiness: concise travel-day support, sharing/export, and mobile/tablet practicality

The current codebase is late in phase 1. The next development work should continue to respect that sequence rather than jumping ahead to convenience features too early.

## Next Steps

- Finish the hosted-service path on live infrastructure:
  - existing Supabase auth and persistence
  - protected Vercel preview and then production wiring
  - OpenRouteService for live timings and route-access snapping
- Validate the current auth-first planner shell on real devices:
  - starter/import onboarding
  - desktop rail layout
  - edit locking
  - map framing
- After activation, move into the architect brief's next phase: planning quality and realism.
- Keep README and planning docs aligned with actual shipped behavior on `main`.
