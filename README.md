# Campervan Trip Planner

A Next.js App Router trip planner for campervan travel. The current working branch is the beta-ready foundation: the planner works immediately in demo mode and becomes cloud-backed once Supabase and OpenRouteService are configured.

## Current Status

- Single active trip planning experience with desktop, tablet, and mobile layouts.
- Demo mode uses seeded trip data plus browser persistence.
- Cloud mode adds email magic-link auth, cloud trip save/load, legacy local import, sync messaging, conflict recovery, and offline read-only reopening of the last synced trip.
- Route realism includes road-leg estimates, buffered drive times, and validation warnings for difficult travel days.
- Automated coverage includes Vitest for logic and Playwright for core trust flows.

This branch is beyond the original local-only MVP. The main remaining gap is live service activation and hosted validation, not the core app architecture.

## What The App Does Today

- Build and edit itinerary stops for:
  - `stay`
  - `ferry`
  - `point_of_interest`
- Visualize the itinerary on a map with ferry port markers and ferry segments.
- Show trip-day navigation, today actions, gap warnings, route insights, and validation warnings.
- Store campsite metadata such as booking status, hookups, hardstanding, amenities, phone, and website.
- Store ferry metadata such as operator, booking reference, vehicle details, and check-in buffers.
- Cache the last synced cloud trip so it can be reopened offline in read-only mode.

## Services Required For Full Mode

- Supabase: email magic-link auth, session verification, and cloud trip persistence.
- OpenRouteService: live route estimates. The app falls back to internal estimates if this is not configured.
- Vercel: intended preview and production hosting target.

The app does not require MCP servers to run. Provider integrations may become useful later, but the normal path is still service dashboards plus environment variables.

## Environment Variables

Copy `.env.example` to `.env.local` and fill in:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `OPENROUTESERVICE_API_KEY`

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

Without Supabase env vars, the planner will run in demo mode. With the env vars populated, the account panel should expose magic-link sign-in and cloud sync flows.

## Validation

Run the full local validation set before merging:

```bash
npm test
npm run lint
npm run build
npm run test:e2e
```

## Activation Checklist

1. Create the Supabase project, enable email magic-link auth, and apply the migration.
2. Create an OpenRouteService API key.
3. Add the required env vars locally and in Vercel Preview/Production.
4. Deploy a preview build and run the smoke checklist in `docs/FOUNDATION_ACTIVATION.md`.
5. Treat the branch as release-ready only after save, import, conflict, offline, and route-estimate checks pass against live services.

## Repo Docs

- `docs/FOUNDATION_ACTIVATION.md`: hosted service setup and smoke-test runbook
- `docs/PRODUCT_PLAN.md`: current product status and next milestone order
- `docs/QA_NOTES.md`: manual QA checklist and issue log

## Next Steps

- Activate Supabase, OpenRouteService, and Vercel for real preview/prod validation.
- Run the live-service smoke checklist on desktop and mobile/tablet.
- Keep README and planning docs aligned with actual shipped behavior on this branch.
- After activation, prioritize beta hardening and the next planning improvements based on live feedback.
