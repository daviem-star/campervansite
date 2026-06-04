"use client";

import StopTypeIcon from "@/components/planner/StopTypeIcon";
import type { SavedPlaceOccurrence, SavedPlaceView } from "@/lib/tripLibraryViews";

type SavedPlacesPanelProps = {
  places: SavedPlaceView[];
  loadedTripCount: number;
  totalTripCount: number;
  isOfflineReadOnly: boolean;
  onOpenOccurrence: (occurrence: SavedPlaceOccurrence) => void;
};

export default function SavedPlacesPanel({
  places,
  loadedTripCount,
  totalTripCount,
  isOfflineReadOnly,
  onOpenOccurrence,
}: SavedPlacesPanelProps) {
  return (
    <section data-testid="desktop-saved-places-panel" className="min-h-0 overflow-hidden rounded-[24px] border border-app-border bg-app-surface lg:flex lg:flex-col">
      <div className="border-b border-app-border px-5 py-5">
        <p className="planner-eyebrow planner-section-label">Saved Places</p>
        <h2 className="planner-title-xl mt-2 text-app-text">Places across your trips</h2>
        <p className="planner-copy mt-2 text-app-muted">
          A read-only library derived from campsites, points of interest, and ferry ports.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <span className="planner-pill rounded-full border px-3 py-1 text-xs font-semibold">{places.length} places</span>
          <span className="planner-pill rounded-full border px-3 py-1 text-xs font-semibold">{loadedTripCount} of {totalTripCount} trips loaded</span>
        </div>
        {isOfflineReadOnly && loadedTripCount < totalTripCount ? (
          <p className="planner-copy-sm tone-warning mt-3 rounded-xl border px-3 py-2">
            Offline view: places from uncached trips are not shown.
          </p>
        ) : null}
      </div>

      <div className="min-h-0 flex-1 divide-y divide-app-border overflow-y-auto">
        {places.length === 0 ? (
          <p className="planner-copy m-5 rounded-[18px] border border-dashed border-app-border bg-app-surface-muted p-5 text-app-muted">
            No places are available yet. Add stops to a trip to build this library.
          </p>
        ) : null}
        {places.map((place) => (
          <article key={place.id} className="px-5 py-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 className="planner-title-md text-app-text">{place.label}</h3>
                <div className="mt-2 flex flex-wrap gap-2">
                  {place.kinds.map((kind) => (
                    <span key={kind} className="planner-pill inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold">
                      <StopTypeIcon kind={kind} className="h-3.5 w-3.5" />
                      {kind === "point_of_interest" ? "POI" : kind}
                    </span>
                  ))}
                  <span className="planner-pill rounded-full border px-2.5 py-1 text-[11px] font-semibold">
                    Used {place.occurrences.length} {place.occurrences.length === 1 ? "time" : "times"}
                  </span>
                </div>
                {place.amenitiesSummary ? <p className="planner-copy-sm mt-2 text-app-muted">{place.amenitiesSummary}</p> : null}
                {place.phone || place.websiteUrl ? (
                  <p className="planner-meta mt-1 text-app-muted">{[place.phone, place.websiteUrl].filter(Boolean).join(" · ")}</p>
                ) : null}
              </div>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {place.occurrences.map((occurrence) => (
                <button key={occurrence.id} type="button" onClick={() => onOpenOccurrence(occurrence)} className="planner-button-secondary rounded-xl border px-3 py-2 text-left text-xs font-semibold">
                  {occurrence.tripName} · {occurrence.stopTitle}
                </button>
              ))}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
