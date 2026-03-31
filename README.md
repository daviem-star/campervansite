# Campervan Trip Planner

A Next.js App Router trip planner for campervan travel. The app now ships an auth-first beta planner with a cloud trip library, a single active trip workspace, and deterministic local/test flows for confidence work before launch.

## Current Status

- Cloud multi-trip management v1 is in code:
  - create blank trip
  - create example trip
  - switch trip
  - rename trip
  - delete trip with last-trip guardrails
- The planner keeps one active trip workspace open at a time.
- Desktop navigation uses `Trips`, `Itinerary`, `Overview`, and `Today`, with the map persistent beside the planner.
- Mobile navigation uses `Trips`, `Itinerary`, `Overview`, `Today`, and `Map`.
- `Overview` is trip-only; account and sync controls live in a persistent top-left account/status popup.
- Signed-in onboarding creates a cloud-backed starter example trip automatically, or offers a one-time import/local-choice flow when legacy browser data exists.
- Cloud mode includes email magic-link auth, trip CRUD, sync messaging, conflict recovery, and offline read-only reopening of the last synced trip.
- Forced demo mode and local test sign-in remain available for deterministic local preview and E2E work.
- Automated coverage includes Vitest, API route tests, and Playwright trust flows.

The main remaining gap is hosted activation and live-service validation, not missing core planner architecture.

## What The App Does Today

- Manage a cloud trip library in authenticated cloud mode while keeping one selected trip loaded at a time.
- Build and edit itinerary stops for:
  - `stay`
  - `ferry`
  - `point_of_interest`
- Default to `View mode`, then explicitly unlock `Edit trip` in `Itinerary` before mutating the trip.
- Visualize the itinerary on a map with road-following road legs when live routing is available, plus ferry port markers and ferry segments.
- Show trip-day navigation, today actions, trip overview insights, gap warnings, route insights, and validation warnings.
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

For day-to-day work, keep feature development on short-lived branches that merge back into `main`. Do not keep a permanent cloud-preview branch; use runtime flags and environment variables to separate local testing from protected preview and production. Before launch, keep Vercel's production branch on a dormant `production` branch, treat `staging` as the canonical hosted QA lane, and fast-forward `staging` only from approved `main` commits.

## Validation

Run the full local validation set before merging:

```bash
npm test
npm run lint
npm run build
npm run test:e2e
```

For hosted promotion and smoke:

```bash
npm run promote:staging
npm run smoke:staging -- "<vercel-share-url>"
```

`npm run smoke:staging` performs a git preflight first, so it will stop if the target commit has not been pushed to `main` and fast-forwarded to `staging`.

## Activation Checklist

1. Create or reuse the dedicated Supabase project, enable email magic-link auth, and apply the migration.
2. Create an OpenRouteService API key.
3. Add the required env vars locally and in Vercel Preview, including any map tile overrides if you are not using the default OpenStreetMap raster tiles.
4. Protect the preview deployment, keep the first wave to 1-3 testers, and run the smoke checklist in `docs/FOUNDATION_ACTIVATION.md`.
5. Record device and smoke-pass results in `docs/QA_NOTES.md`.
6. Treat a commit on `main` as ready for `staging` promotion only after auth-first entry, starter/import onboarding, save, conflict, offline, route-estimate, and place-search checks pass against live services.
7. In the Vercel dashboard, set `Settings -> Environments -> Production -> Branch Tracking` to the dormant `production` branch before treating `staging` as the canonical hosted QA branch.
8. Fast-forward or push `staging` to the exact approved `main` commit and run the protected preview smoke there.
   Prefer `npm run promote:staging`, then `npm run smoke:staging -- "<vercel-share-url>"`.
9. When launch is approved, fast-forward or push the dormant `production` branch to the exact approved `staging` commit so Vercel can create the first intentional production deployment.

## Repo Docs

- `docs/PRODUCT_PLAN.md`: canonical roadmap and product scope
- `docs/FOUNDATION_ACTIVATION.md`: hosted service setup and smoke-test runbook
- `docs/HOSTED_SMOKE_TEST_2026-03-30.md`: detailed record of the first hosted smoke pass, including access, failures, fixes, and rerun procedure
- `docs/QA_NOTES.md`: manual QA checklist and issue log

## Roadmap

The live roadmap now sits in [docs/PRODUCT_PLAN.md](docs/PRODUCT_PLAN.md). In short:

1. Validate and harden the hosted multi-trip planner on real services and devices.
2. Use that feedback to improve planning quality and realism.
3. Only then move deeper into on-road tooling, export, and sharing.
