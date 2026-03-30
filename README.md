# Campervan Trip Planner

A Next.js App Router trip planner for campervan travel. Build an itinerary with **stays**, **ferries**, and **points of interest**, then view the route on a map with ferry legs highlighted.

## MVP Capabilities
- Single-user planner with local browser persistence.
- One active trip with a special `Home` pin.
- Stop types:
  - `stay`
  - `ferry`
  - `point_of_interest`
- Add, edit, delete, and drag-reorder itinerary stops.
- OSM/Nominatim-powered location search through `/api/geocode`.
- Map view with:
  - distinct ferry port markers
  - dashed ferry segments
  - solid overland segments (MVP approximation)
- Today dashboard for:
  - ferry check-in reminders
  - campsite checkout reminders
- Gap warnings for days without a known base campsite.
- Optional stay `costPerNight` with derived total stay cost.

## Beta-Ready Foundation Additions
- Demo mode plus Supabase-backed email magic-link auth when environment variables are configured.
- Cloud trip persistence through server routes backed by a single canonical trip JSON document.
- Offline read-only recovery for the last synced active trip.
- Sync-status messaging and one-time legacy local import flow.
- Route-estimate broker through `/api/route-estimates` with OpenRouteService support and fallback estimates.
- Validation warnings for heavy drive days, tight ferry check-in windows, late campsite arrivals, and overnight coverage gaps.

## Tech Stack
- Next.js 16 (App Router)
- React 19 + TypeScript (strict mode)
- Tailwind CSS
- Zustand (client state)
- dnd-kit (drag/drop reorder)
- MapLibre GL + OpenStreetMap tiles
- date-fns + date-fns-tz

## Project Structure
- `app/`
  - `page.tsx`: planner entry
  - `layout.tsx`: app metadata and shell
  - `api/geocode/route.ts`: Nominatim proxy + throttling + cache
- `components/planner/`: planner UI components
- `types/trip.ts`: core domain contracts
- `lib/`: seed data, repository, date helpers, derived business logic
- `store/useTripStore.ts`: Zustand store and persistence wiring
- `docs/PRODUCT_PLAN.md`: full product/implementation plan

## Getting Started
1. Install dependencies:

   ```bash
   npm install
   ```

2. Start development server:

   ```bash
   npm run dev
   ```

3. Open:

   ```
   http://localhost:3000
   ```

## Validation
Run before merging:

```bash
npm test
npm run test:e2e
npm run lint && npm run build
```

## Environment
To enable cloud sync and live route estimates, copy `.env.example` to `.env.local` and fill in:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `OPENROUTESERVICE_API_KEY`
Supabase schema setup lives in `supabase/migrations/20260328_trip_documents.sql`.
Operational activation and smoke-test steps live in `docs/FOUNDATION_ACTIVATION.md`.

## Data Model Notes
- Root storage key: `campervan_trip_planner_v1`
- Root schema:
  - `schemaVersion`
  - `activeTripId`
  - `trips[]`
- Default timezone is fixed to `Europe/London` for MVP.
- Seed data includes an Outer Hebrides trip for August 2026.

## Roadmap (Post-MVP)
- JSON export/import UI
- Multi-trip management
- Optional account-based sync
- Real driving route geometry
- PWA install and stronger offline map behavior

## Important Usage Notes
- Nominatim has fair-use requirements. The app proxies geocode requests and applies throttling/caching, but you should still keep usage low-volume.
- Basic offline support means local itinerary data persists in browser storage. Live geocoding and map tile fetches require connectivity.
