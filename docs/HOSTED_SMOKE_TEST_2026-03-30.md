# Hosted Smoke Test Deep Dive

This document records the first end-to-end hosted smoke pass for the protected Vercel preview on `codex/cloud-preview-activation`. It is both a historical record of what actually happened on 2026-03-30 and a repeatable operator guide for rerunning the same hosted verification later.

## Purpose And Outcome

This was the first full hosted smoke test against live Supabase, live OpenRouteService, and a protected Vercel preview for the Campervan Trip Planner.

Final outcome:

- Branch: `codex/cloud-preview-activation`
- Final smoke-runner commit: `d6e1079`
- QA recording commit: `d3e23c2`
- Final passing deployment: `dpl_ZGnK6ce6tHCLFfDTiGZ8K4UCwtdp`
- Preview alias: `campervansite-git-codex-cloud-prev-57af82-daviem-4121s-projects.vercel.app`
- Result: full hosted smoke pass completed successfully

The final hosted pass verified:

- signed-out auth gate behavior
- starter cloud-trip creation
- stop-edit save flow
- deliberate place search and save
- live route-confidence rendering
- desktop rail switching
- second-context cloud load
- stale-write conflict recovery
- offline read-only reopen
- manual magic-link login, confirmed separately by the user

## Prerequisites

The smoke run was only possible once the hosted stack and local operator tooling were both in place.

Required operator prerequisites:

- Vercel MCP connected and able to inspect deployments
- Vercel CLI installed and authenticated
- Supabase CLI installed and authenticated
- local repo linked to the correct Supabase project
- GitHub-connected Vercel project created for this repository
- Vercel Preview environment variables populated
- Supabase preview redirect wildcard added for hosted auth
- ability to run Playwright outside the default sandbox when browser launch is blocked in an agent session

Runtime values the process depended on, without exposing the secret contents:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `OPENROUTESERVICE_API_KEY`

Manual setup that mattered before the smoke runner could work:

- the existing cloud Supabase project was reused instead of creating a new database
- the Vercel project was connected to the GitHub repository so branch previews deployed automatically
- Supabase redirect URLs were updated to include the Vercel preview wildcard `https://*-daviem-4121s-projects.vercel.app/**`
- the user manually confirmed that hosted magic-link sign-in worked in the preview UI

## How Access Worked

Hosted smoke access required two separate layers of access:

1. Vercel preview access
2. Supabase app-session access

Vercel deployment protection blocked anonymous browser access to the preview. That meant normal Playwright navigation to the branch alias would be redirected to Vercel login unless the browser first received a temporary preview share URL.

The access model ended up looking like this:

- Vercel protection stopped unauthenticated browser sessions at the edge.
- The user manually verified the email magic-link flow through the hosted UI.
- Automation requested a fresh Vercel share URL for the preview and used that URL as the browser entrypoint.
- Automation then created a temporary Supabase test user with the service-role key.
- The same temporary user signed in with the anon key and password flow.
- The resulting live Supabase session was injected into browser local storage before the app loaded.

Why both layers were required:

- The Vercel share URL only solved preview protection. It did not sign the browser into the app.
- The Supabase session priming only solved app auth. It did not bypass Vercel protection.

Important operational nuance:

- Share URLs should be treated as short-lived access tokens.
- A share URL that worked against one deployment could stop working after a new deployment.
- After the final `d6e1079` preview deployment, a fresh share URL had to be minted before the browser automation could continue.
- Share URLs should never be committed to the repository.

## Implementation Chronology

### 1. Protected preview groundwork

The cloud-preview branch was prepared to run against live services and a protected Vercel preview. This work was recorded in commit `d37455a` (`feat(hosting): prepare protected cloud preview`).

That preparation included:

- preview-oriented env var documentation
- hosted tile configuration support
- request logging around hosted route and geocode paths
- deliberate submitted place search instead of per-keystroke geocoding
- activation and QA note updates for hosted verification

### 2. Hosted preview returned `404: NOT_FOUND`

The first hosted preview looked like it built successfully, but the actual branch alias returned `404: NOT_FOUND`.

Diagnosis:

- Vercel builds appeared healthy.
- The protected preview URL still returned `NOT_FOUND`.
- This pointed to a hosting-level configuration problem rather than an application runtime crash.

Root cause:

- Vercel was effectively treating the project as `Other` instead of a Next.js app.

Fix:

- `vercel.json` was added with `framework: "nextjs"` in commit `7843443` (`fix(hosting): pin vercel framework preset`).

After the fix:

- the preview alias returned the Vercel protection gate instead of `404`
- authenticated owner fetches returned app HTML
- `/api/session` returned `{"error":"Unauthenticated."}` instead of `404`

This confirmed the preview was now hosting the actual Next.js app.

### 3. Manual hosted auth verification

Before browser automation was trusted, the user manually verified that:

- the protected preview was reachable
- the Supabase magic-link flow delivered the user back into the hosted preview
- hosted app auth succeeded on the branch alias

That mattered because it proved the live auth path worked independently of any automation shortcuts.

### 4. First Playwright smoke runner attempt

A Playwright-based hosted smoke runner was then created. The first version lived in `/tmp`.

That failed immediately with a Node module-resolution error:

```text
Error [ERR_MODULE_NOT_FOUND]: Cannot find package '@supabase/supabase-js' imported from /private/tmp/preview-smoke.mjs
```

Diagnosis:

- the script was outside the repo
- Node resolved modules relative to `/tmp`
- the runner needed repo-local dependencies such as `@supabase/supabase-js` and `playwright`

Fix:

- the runner was moved into the repository as `scripts/preview-smoke.mjs`
- this became part of commit `d6e1079`

### 5. Hosted place search failed inside the smoke run

Once the smoke runner could execute, it progressed far enough to hit the hosted stop-editor search path. That path failed even though the earlier hosted auth and trip-load steps were working.

Observed failure:

- the runner timed out waiting for an `Oban` result button after clicking `Search`

This was initially ambiguous. It could have been:

- a broken UI selector in the runner
- a failed `/api/geocode` call
- a hosted-only issue in the search interaction

### 6. Backend health check separated UI from API behavior

To isolate the problem, the deployed geocode endpoint was queried directly:

```bash
vercel curl '/api/geocode?q=Oban' --deployment https://campervansite-git-codex-cloud-prev-57af82-daviem-4121s-projects.vercel.app
```

That returned valid `Oban` results from the hosted deployment. This was the key turning point in the investigation because it showed:

- `/api/geocode` itself was healthy
- the problem lived in the browser interaction path, not the deployed backend

### 7. Root cause: nested form markup in the stop editor

The hosted search failure was traced to the structure of `components/planner/StopSearchInput.tsx`.

Problem:

- `StopEditorModal` already wrapped the stop editor in a parent `<form>`
- `StopSearchInput` introduced another nested `<form>` around the search input and button

Why that mattered:

- nested forms are invalid HTML
- in hosted browser use, clicking `Search` inside the nested form could trigger outer-form behavior instead of reliably issuing the geocode request
- this explained why the smoke runner sometimes never saw the `/api/geocode` request at all

Fix in commit `d6e1079`:

- remove the nested `<form>`
- replace it with a plain container
- make the search button `type="button"`
- add explicit Enter-key handling on the search input

This converted search into a deliberate UI action instead of a nested-form side effect.

### 8. Smoke runner diagnostics were improved

While debugging the search path, the smoke runner itself was strengthened:

- it started waiting explicitly for the hosted `/api/geocode?q=Oban` response
- it captured response status and body for investigation
- it captured dropdown text when results did not render

That improvement made it easier to distinguish:

- backend failures
- missing requests
- UI rendering failures

### 9. Local validation rerun

After the search fix, local validation was rerun:

```bash
npm run lint
npm test
npm run build
```

All three passed before the updated branch was pushed.

### 10. Fresh deployment and fresh share URL

The updated branch was pushed and Vercel built deployment `dpl_ZGnK6ce6tHCLFfDTiGZ8K4UCwtdp` from commit `d6e1079`.

At that point, the previously used Vercel share URL no longer worked for a clean browser context. A fresh share URL had to be minted for the new deployment before automation could continue.

### 11. Final hosted smoke pass

With:

- the framework preset pinned
- the stop-search control repaired
- the smoke runner moved into the repo
- diagnostics added
- a fresh share URL minted

the hosted smoke suite reran and passed end to end.

That pass was later summarized in `docs/QA_NOTES.md` and recorded in commit `d3e23c2` (`docs(qa): record hosted preview smoke pass`).

## What Was Fixed

Two real application or hosting issues had to be fixed before the hosted smoke pass succeeded.

### Fix 1: Pin the Vercel framework preset

File:

- `vercel.json`

Change:

- pin the framework preset to `nextjs`

Why it mattered:

- Vercel had been serving `404: NOT_FOUND` even though the project was building
- explicitly pinning the framework preset made Vercel host the app correctly as a Next.js deployment

Result:

- preview alias stopped returning `NOT_FOUND`
- hosted app and API routes became reachable

### Fix 2: Repair the stop-editor search interaction

File:

- `components/planner/StopSearchInput.tsx`

Change:

- remove nested form markup
- convert the search action to an explicit `type="button"` click
- add Enter-key handling directly on the input

Root cause:

- the stop editor already used a parent form
- `StopSearchInput` introduced another form inside it
- hosted browser interaction could submit the outer form instead of reliably triggering the geocode request

Result:

- the deliberate `Search` action consistently issued `/api/geocode`
- results rendered reliably
- edited place selection and save worked in the hosted smoke path

### Smoke-runner improvements

File:

- `scripts/preview-smoke.mjs`

Change:

- move the runner into the repository
- add direct geocode-response diagnostics and dropdown debug capture

Why it mattered:

- the runner needed repo-local dependencies
- the additional diagnostics made hosted failures materially easier to diagnose

## How The Smoke Runner Worked

The hosted smoke runner lives at `scripts/preview-smoke.mjs`.

It was designed to verify the real protected preview while avoiding the need to automate an email inbox.

High-level flow:

1. Read `.env.local`
2. Pull the live Supabase URL, anon key, and service-role key
3. Derive the Supabase project ref from `NEXT_PUBLIC_SUPABASE_URL`
4. Build the Supabase local-storage key `sb-<project-ref>-auth-token`
5. Create a temporary preview smoke user with a unique email
6. Sign that user in with password to get a real session
7. Launch Playwright Chromium in headless mode
8. Open a signed-out browser context and verify the auth gate
9. Open a signed-in browser context by priming local storage before app load
10. Enter the protected preview through a Vercel share URL
11. Exercise the hosted smoke path across multiple browser contexts

Exact command shape:

```bash
node scripts/preview-smoke.mjs "<vercel-share-url>"
```

Why the runner lives in the repo:

- it must resolve local `node_modules`
- it imports `@supabase/supabase-js`
- it imports `playwright`
- keeping it in-repo avoids the `/tmp` module-resolution failure that blocked the first attempt

Key behaviors implemented in the runner:

- signed-out context priming that clears local E2E and forced-demo flags
- signed-in context priming that injects a live Supabase session into browser storage
- `gotoPreview()` guard that confirms the browser actually lands on the preview origin
- geocode-response waiting and diagnostics for the deliberate place-search step
- multi-context conflict testing
- offline simulation by aborting `/api/trips` requests in a fresh context after an initial online sync

## What Was Tested

The final hosted smoke pass covered these behaviors:

- signed-out auth gate is visible
- signed-out browser cannot see the seeded itinerary before login
- fresh signed-in account auto-creates the starter cloud trip
- first stop can be edited and saved
- stay-place search works only after deliberate submitted lookup
- saved place selection persists through the stop-update flow
- live route confidence appears on the overview panel
- desktop rail switching works across `Itinerary`, `Overview`, and `Today`
- same cloud trip loads in a second browser context
- stale-write conflict reloads the latest version and shows recovery messaging
- offline reopen shows the last synced trip and disables `Edit trip`
- manual magic-link auth was confirmed separately by the user in the real hosted UI

The runner used three browser shapes:

- Context A for the main signed-in editing flow
- Context B for second-context cloud load and stale-write conflict testing
- Offline context for cached reopen with `/api/trips` aborted after initial sync

Relevant runtime and hosting interfaces exercised during the process:

- `/api/geocode`
- `/api/session`
- `/api/trips`
- protected Vercel preview access through a temporary share URL

## Evidence And Verification

Local validation run before the final hosted retry:

```bash
npm run lint
npm test
npm run build
```

Final hosted smoke result:

```json
{
  "signedOutGate": true,
  "starterTrip": true,
  "saveFlow": true,
  "placeSearch": true,
  "liveRoutes": true,
  "secondContextLoad": true,
  "conflictRecovery": true,
  "offlineReadOnly": true,
  "desktopSwitching": true,
  "manualMagicLink": "user-confirmed",
  "testUserEmail": "preview-smoke-1774904321485-fa6017ac@example.com"
}
```

Notes on that result:

- every automated smoke flag ended `true`
- the `testUserEmail` value is only an example of the generated temporary-user pattern
- it is not a durable credential and should not be treated as one

Supporting repo record:

- `docs/QA_NOTES.md` contains the lightweight summary of the passing hosted smoke run
- the QA note records the branch, commit, deployment, and checklist coverage

## Operational Lessons

Main lessons from the first hosted smoke pass:

- Protected preview access and app auth are separate problems and need separate solutions.
- Hosted verification can surface real HTML and interaction bugs that are easy to miss in local-only or bypass-based testing.
- If a new deployment is created, regenerate the Vercel share URL before assuming browser automation is broken.
- Keep smoke automation inside the repo when it depends on repo-local packages.
- In sandboxed agent environments, browser automation may need elevated execution even when the script and dependencies are correct.
- Querying a deployed API endpoint directly is one of the fastest ways to separate backend health from UI interaction failures.
- A passing build is not the same as a working preview. The earlier `404: NOT_FOUND` incident proved that hosting configuration can invalidate an otherwise healthy build.
- Manual user verification still mattered even with automation, especially for the real email magic-link round trip.

## Repeat Procedure

Use this checklist for future reruns of the hosted smoke pass:

1. Confirm Vercel CLI and Supabase CLI are both authenticated locally.
2. Confirm the repo is linked to the correct Supabase project.
3. Confirm Vercel Preview env vars are present.
4. Confirm the Supabase preview redirect wildcard still matches the active Vercel team or account slug.
5. Mint a fresh Vercel share URL for the current protected preview.
6. Run:

   ```bash
   node scripts/preview-smoke.mjs "<vercel-share-url>"
   ```

7. If the run fails on a hosted UI path, test the specific deployed API endpoint directly before changing app code.
8. If the run fails after a new deployment, mint a new share URL and retry.
9. Record the result in `docs/QA_NOTES.md`.

Useful investigation pattern for endpoint isolation:

```bash
vercel curl '/api/geocode?q=Oban' --deployment https://<branch-alias>
```

That pattern is especially useful when the browser UI appears broken but the suspected backend route may still be healthy.
