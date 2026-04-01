# Scaling Considerations

This document captures the main scaling considerations for the current campervan planner architecture as of April 1, 2026. It is a design review based on the codebase and current service choices, not a formal load-test result.

The short version is encouraging:

- the current stack should comfortably support early growth
- hundreds of registered users should not, by itself, create a serious performance problem
- the first likely pressure points are external provider limits and request patterns, not React, Next.js, Vercel, or Supabase in isolation

## Current Architecture Snapshot

The current hosted planner is built around:

- Next.js App Router for the web app shell and API routes
- React client components for the planner UI
- Vercel as the intended hosting platform
- Supabase for auth and trip persistence
- a single active trip loaded at a time in the client
- route and geocode lookups through third-party services

The main cloud persistence model today is:

- one trip document per `(owner_user_id, trip_id)`
- the full trip stored as `jsonb`
- save operations writing the full trip document back to Supabase

This is a reasonable model for v1 because it keeps the system simple and easy to reason about. It is not automatically a problem at moderate scale, but it does shape where the first bottlenecks are likely to appear.

## What Should Scale Well In The Near Term

### Frontend Rendering

Most planner rendering work happens in the browser. One user opening a large trip does not directly consume rendering capacity for another user. The map and itinerary UI may become heavy for an individual browser session if trips become very large, but that is a per-user UX concern rather than a multi-user hosting bottleneck.

### Basic Trip CRUD

The core cloud flows are straightforward:

- list a signed-in user's trips
- load one selected trip
- save one selected trip
- rename or delete a trip

These are simple request and database patterns and should remain acceptable for early growth, especially while most users are not editing continuously.

### Database Access Pattern

The `trip_documents` table has:

- a primary key on `(owner_user_id, trip_id)`
- an index on `(owner_user_id, updated_at desc)`
- row-level security policies for per-user isolation

That setup is sensible for the current "one user working in one active trip at a time" model.

## Likely First Pressure Points

### External Geocoding Limits

The geocode route currently does all of the following:

- uses Nominatim directly
- keeps only in-memory cache entries
- enforces a one-request-per-second delay in-process

This is an important scaling consideration. A few users searching occasionally is fine. Many users searching places around the same time could create visible latency and may also run into provider usage expectations faster than the rest of the app.

This is the most obvious early-growth concern because it is tied to a third-party service with comparatively lightweight protection and no shared cache layer.

### External Routing Limits

Route estimates and snapped routing coordinates depend on OpenRouteService. The app has helpful fallback behaviour and some caching, but the cache is also local to the running instance. If the app scales across multiple server instances, cache effectiveness drops.

This means growth in active trip editing can increase:

- route estimate calls
- route-access snap calls
- sensitivity to provider latency or quota limits

In practice, route and geocode traffic is more likely to become the first noticeable issue than raw app server capacity.

### Whole-Document Trip Saves

The app currently saves the whole trip document on each cloud write rather than patching only the changed field or stop. This is a fair tradeoff for a simpler v1, but it means write cost grows with trip size.

This does not mean hundreds of users will immediately cause trouble. It does mean that, as trips grow longer and editing frequency rises, the save path will do more work than a narrower patch-based model would.

### Dynamic Per-User API Routes

The trip routes are intentionally dynamic and uncached because they serve user-specific data. That is correct for trust and correctness, but it means scaling depends on real request volume rather than static caching.

For hundreds of users this is still likely acceptable. It simply means that growth should be tracked with actual request and latency metrics rather than assuming the hosting platform will hide everything automatically.

### Limited Shared Caching

Several performance protections today are local rather than shared:

- browser-side route estimate cache
- in-memory geocode cache
- in-memory route-access cache
- in-memory route-estimate cache on the server

These are useful, but they do not behave like a shared distributed cache. As soon as the app runs on multiple instances, cache hits become less predictable across users and across cold starts.

### Limited Observability

The app logs useful information with `console.info` and `console.warn`, but there is not yet a full observability story for:

- request latency trends
- provider error-rate trends
- route/geocode volume per active user
- Supabase query timing
- save payload size growth

That means the current system may still scale fine, but there is less early warning when it stops scaling comfortably.

## What "Hundreds Of Users" Probably Means In Practice

### Hundreds Of Registered Users

This should be manageable with the current architecture, assuming only a fraction are active at once.

### Hundreds Of Occasional Active Users

This still looks realistic if usage is spread out through the day and most sessions are light:

- sign in
- load a trip
- review or lightly edit it
- run a few route lookups

### Hundreds Of Concurrent Heavy Planner Sessions

This is where the first real stress is likely to appear. The app would probably remain functional, but users may begin to feel:

- slower place search
- slower route refreshes
- more frequent provider fallbacks
- higher save latency for larger trips

That is still not a sign that the stack choice was wrong. It is simply the point where provider strategy, caching strategy, and write shape start to matter more.

## Recommended Growth Considerations By Stage

### Before Meaningful Public Growth

Treat these as the first scale-readiness basics:

- add hosted monitoring for API latency, error rate, and provider failures
- track request counts for `/api/geocode`, `/api/route-estimates`, and `/api/route-access`
- track average trip document size and save frequency
- confirm expected free-tier or hobby-tier limits for Supabase, OpenRouteService, tile usage, and hosting
- run a small synthetic load exercise against the trip routes and route/geocode endpoints

### If Active Usage Starts Growing Noticeably

At this stage, the likely highest-value improvements are:

- introduce a shared cache for geocode and route results if provider traffic becomes noisy
- consider moving away from direct Nominatim usage if usage policy or traffic volume becomes uncomfortable
- add rate limiting or soft client-side request shaping around place search and route refresh flows
- review whether all trip mutations should save immediately or whether some edits can be batched or debounced

### If The Product Grows Into Heavier Daily Use

This is the stage where structural changes may become worth the complexity:

- split large trip documents into more granular persisted entities if save payloads become too large
- store derived route results separately from the canonical trip document when route activity dominates write volume
- add a more durable shared cache or queue-backed strategy around expensive third-party calls
- review whether analytics and operational logs should move beyond console output into proper dashboards and alerts

## Specific Things To Watch

These are the signals most likely to tell us that the current architecture is approaching an uncomfortable limit:

- place search feeling slow even when the rest of the planner feels fast
- route estimates frequently falling back even when API keys are present
- Supabase write latency climbing as trips grow longer
- users reporting conflicts or save delays during active editing
- Vercel function cold starts making route and geocode requests feel inconsistent
- tile usage or third-party provider quotas becoming more restrictive than the app server itself

## Suggested Rule Of Thumb

The current stack is well suited to early and moderate growth. We do not need to redesign it preemptively just because the app might reach hundreds of users.

The right mindset is:

- do not over-engineer before the traffic exists
- do instrument the app before growth hides the real bottleneck
- expect external provider strategy to matter before core framework choice does
- revisit the whole-trip save model only when real usage shows it is the limiting factor

## Bottom Line

The current full stack is not obviously too small for a few hundred users. The most likely early scaling issues are:

1. geocoding and routing provider limits or latency
2. per-instance rather than shared caching
3. whole-document saves as trips and edit frequency grow
4. limited observability before hosted usage increases

If growth stays moderate, the existing architecture should remain workable. If growth becomes sustained and heavier, the next investments should focus on provider resilience, caching, request shaping, and visibility before attempting a major rewrite.
