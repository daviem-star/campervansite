# Campervan Trip Planner MVP Plan

## Product Goal
Create a practical web planner + trip companion for campervan travel where users can build an itinerary of stays, ferries, and points of interest, then visualize the journey on a map.

## MVP Scope
- Single user, no authentication.
- One active trip with local browser persistence.
- Stop CRUD + drag-and-drop reorder.
- Stop types:
  - `stay`
  - `ferry`
  - `point_of_interest`
- Home treated as a dedicated pinned location.
- OSM/Nominatim location search.
- Desktop/tablet split layout: itinerary left, map right.
- Mobile layout: itinerary-first with map toggle panel.
- Ferry-specific visuals (marker styling + dashed segment).
- Today-only action dashboard for time-critical tasks.
- Gap warning for days without known base campsite.
- Optional stay cost per night with derived totals.

## Locked Business Rules
- Timezone: `Europe/London`.
- Default stay check-in: `15:00`.
- Default stay checkout: `11:00`.
- Ferry `checkInBy` defaults to departure minus 45 minutes and can be edited.
- Gap warnings are non-blocking.
- Today dashboard is read-only reminders (no completion checkbox state).

## Data Contracts
Implemented in `types/trip.ts`:

- `StopType = "stay" | "ferry" | "point_of_interest"`
- `PlaceRef`, `TripStop`, `Trip`, `AppDataV1`
- `TripRepository` contract implemented by local storage repository

Storage shape:

```ts
{
  schemaVersion: 1,
  activeTripId: string,
  trips: Trip[]
}
```

## Architecture
- Next.js App Router frontend.
- Local persistence through `LocalStorageTripRepository`.
- Zustand store for app state and trip mutations.
- Derived logic in `lib/tripDerived.ts` for:
  - cost totals
  - gap detection
  - today actions
  - map markers/segments
- Geocode proxy at `app/api/geocode/route.ts`:
  - UK-only query defaults
  - request throttling
  - in-memory short cache

## Map Rendering
- MapLibre GL with OpenStreetMap raster tiles.
- Marker roles:
  - `home`
  - `stay`
  - `poi`
  - `ferry_port`
- Segment styles:
  - solid line for non-ferry legs
  - dashed line for ferry legs

## Seed Data
Seed itinerary includes:
- Home: Killearn, Scotland
- Stay stops in Barra, South Uist, Harris, and Skye
- Four ferry sailings from provided August 2026 data
- One POI stop per island region

## QA Checklist
1. Create/edit/delete each stop type.
2. Verify drag reorder updates itinerary and map.
3. Verify ferry check-in defaults to departure -45 min.
4. Verify today dashboard actions render correctly.
5. Verify gap warnings appear when base overnight coverage is broken.
6. Verify stay totals (nights + cost) update as stops change.
7. Verify desktop split layout and mobile map toggle behavior.
8. Run `npm run lint` and `npm run build`.

## Post-MVP Extensions
- JSON export/import UI
- Multi-trip support and history
- Auth + cloud sync
- Real driving route geometry
- PWA install/offline map caching
