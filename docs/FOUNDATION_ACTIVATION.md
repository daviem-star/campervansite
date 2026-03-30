# Foundation Activation Guide

Use this runbook to activate the cloud-sync foundation in a real environment and verify the beta-ready trust flows.

## 1. Supabase Setup

1. Create a dedicated Supabase project for Campervan Trip Planner.
2. Enable Email auth with magic links in `Authentication -> Providers -> Email`.
3. Add redirect URLs for:
   - `http://127.0.0.1:3000`
   - `http://127.0.0.1:3001`
   - your Vercel preview domain
   - your production domain
4. Apply the SQL in `supabase/migrations/20260328_trip_documents.sql`.

## 2. Environment Variables

Set these in local `.env.local`, Vercel Preview, and Vercel Production:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `OPENROUTESERVICE_API_KEY`

Recommended validation after setting them:

1. `npm run dev`
2. Open the app and confirm the account panel shows the magic-link sign-in UI instead of the “not configured” demo-only message.

## 3. Vercel Deployment

1. Create or link the Vercel project for this repository.
2. Add the four environment variables above to Preview and Production.
3. Deploy a preview build and verify the auth redirect URL matches the preview host.
4. Promote to production only after the smoke checklist below passes on preview.

## 4. Smoke Checklist

Run this on desktop and mobile/tablet:

1. Signed-out user sees demo itinerary plus magic-link request UI.
2. Requesting a magic link shows a success banner with the target email.
3. Signed-in user loads the same cloud trip on a second device/browser.
4. Editing a stop saves successfully and the sync badge returns to `Saved`.
5. Importing local demo data creates a cloud-backed trip and removes the import prompt afterward.
6. If two devices edit the same trip, the stale device shows the conflict recovery message and reloads the latest version.
7. If the device goes offline after syncing, the app reopens the cached trip in read-only mode and disables editing controls.
8. Route estimates load when `OPENROUTESERVICE_API_KEY` is valid and fall back gracefully when the service is unavailable.

## 5. Automated Validation

Run all three before a release candidate:

```bash
npm test
npm run lint
npm run build
```

Run browser coverage locally after Playwright browsers are installed:

```bash
npm run test:e2e
```

## 6. Notes

- The Playwright suite uses an internal E2E auth/backend bypass for deterministic browser coverage. It does not replace real preview-environment smoke testing.
- Offline behavior is intentionally read-only for the last synced active trip in this milestone.
