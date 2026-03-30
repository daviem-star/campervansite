# Foundation Activation Guide

Use this runbook to turn the current branch from a demo-capable planner into a live cloud-backed preview.

## What You Need

- A Supabase project
- An OpenRouteService API key
- A Vercel project connected to this repository
- The four required environment variables

MCP servers are not required for this setup. Normal provider dashboards and environment variables are enough to activate the branch.

## 1. Supabase Setup

1. Create a dedicated Supabase project for Campervan Trip Planner.
2. Enable email authentication with magic links.
3. Configure the site URL and redirect URLs for:
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
3. Remember that the planner still works without this key, but route estimates will use the fallback provider instead of live road timings.

## 3. Environment Variables

Set these in local `.env.local`, Vercel Preview, and Vercel Production:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `OPENROUTESERVICE_API_KEY`

Recommended local check after setting them:

1. Run `npm run dev`.
2. Open the app.
3. Confirm the account panel shows magic-link sign-in instead of the demo-only "not configured" message.

## 4. Vercel Deployment

1. Create or link the Vercel project for this repository.
2. Add the four environment variables to Preview and Production.
3. Deploy a preview build.
4. Verify the Supabase redirect URLs match the preview host before testing auth.
5. Promote to production only after the smoke checklist below passes on preview.

## 5. Live-Service Smoke Checklist

Run this on desktop and mobile/tablet:

1. Signed-out user sees demo itinerary plus magic-link sign-in UI.
2. Requesting a magic link shows a success banner with the target email.
3. Signed-in user can create or import a cloud trip if the account is empty.
4. Signed-in user can load the same cloud trip on a second device or browser.
5. Editing a stop saves successfully and the sync badge returns to `Saved`.
6. Importing local demo data creates a cloud-backed trip and removes the import prompt afterward.
7. If two devices edit the same trip, the stale device shows the conflict recovery message and reloads the latest version.
8. If the device loses service after syncing, the app reopens the cached trip in read-only mode and disables editing controls.
9. Route estimates use OpenRouteService when the key is valid and fall back gracefully when the service is unavailable.

## 6. Automated Validation

Run all of these before a release candidate:

```bash
npm test
npm run lint
npm run build
npm run test:e2e
```

The Playwright suite uses an internal E2E auth/backend bypass for deterministic browser coverage. It validates product behavior, but it does not replace live preview testing against real services.

## 7. Notes

- Offline behavior is intentionally read-only for the last synced active trip in this milestone.
- Cloud activation is the current priority; new feature work should wait until the hosted path is verified.
- Provider integrations can be added later for convenience, but they should not block setup or deployment.
