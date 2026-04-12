"use client";

import { useEffect } from "react";

import MapSelectionSummary from "@/components/planner/MapSelectionSummary";
import PlannerMap from "@/components/planner/PlannerMap";
import type { PlannerMapRouteSummary } from "@/lib/plannerMap";
import type {
  MapMarker,
  MapSegment,
  SelectedEntity,
  SelectedEntityDetails,
  Trip,
} from "@/types/trip";

type PlannerMobileMapOverlayProps = {
  trip: Trip;
  markers: MapMarker[];
  segments: MapSegment[];
  routeSummary: PlannerMapRouteSummary;
  selectedEntity: SelectedEntity;
  selectionOrigin?: "itinerary" | "map" | "system";
  selectedDetails: SelectedEntityDetails | null;
  contextLabel: string;
  onSelectEntity: (entity: Exclude<SelectedEntity, null>) => void;
  onClose: () => void;
};

export default function PlannerMobileMapOverlay({
  trip,
  markers,
  segments,
  routeSummary,
  selectedEntity,
  selectionOrigin = "system",
  selectedDetails,
  contextLabel,
  onSelectEntity,
  onClose,
}: PlannerMobileMapOverlayProps) {
  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [onClose]);

  return (
    <div
      data-testid="mobile-trip-map-overlay"
      className="planner-overlay fixed inset-0 z-50 flex min-h-screen flex-col p-2"
      role="dialog"
      aria-modal="true"
      aria-label={`${trip.name} map`}
    >
      <section className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-app-border bg-app-surface shadow-[0_24px_70px_rgb(var(--color-app-overlay)_/_0.22)]">
        <div className="flex items-center justify-between gap-3 border-b border-app-border bg-app-surface-muted/75 px-3 py-2">
          <div className="min-w-0">
            <p className="planner-eyebrow planner-section-label">Trip map</p>
            <h2 className="planner-title-sm truncate text-app-text">{trip.name}</h2>
            <p className="planner-meta mt-0.5 truncate text-app-muted">{contextLabel}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="planner-button-secondary shrink-0 rounded-lg border px-3 py-1.5 text-xs font-semibold"
          >
            Close map
          </button>
        </div>

        <div className="flex min-h-0 flex-1 flex-col bg-app-bg">
          <div className="min-h-[62vh] flex-1">
            <PlannerMap
              trip={trip}
              markers={markers}
              segments={segments}
              routeSummary={routeSummary}
              selectedEntity={selectedEntity}
              selectionOrigin={selectionOrigin}
              onSelectEntity={onSelectEntity}
              isVisible
              className="h-full w-full bg-app-surface"
            />
          </div>

          <div className="max-h-[32vh] overflow-y-auto border-t border-app-border bg-app-surface p-2">
            <MapSelectionSummary
              testId="mobile-trip-map-selection-summary"
              selectedDetails={selectedDetails}
              density="compact"
              className="rounded-lg shadow-none"
            />
          </div>
        </div>
      </section>
    </div>
  );
}
