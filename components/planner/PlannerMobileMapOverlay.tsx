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
      className="planner-overlay fixed inset-0 z-50 flex min-h-screen flex-col"
      role="dialog"
      aria-modal="true"
      aria-label={`${trip.name} map`}
    >
      <div className="flex items-center justify-between border-b border-app-border bg-app-surface px-4 py-4">
        <div className="min-w-0">
          <p className="planner-eyebrow planner-section-label">Trip map</p>
          <h2 className="planner-title-sm mt-1 truncate text-app-text">{trip.name}</h2>
          <p className="planner-copy-sm mt-1 text-app-muted">{contextLabel}</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="planner-button-secondary shrink-0 rounded-full border px-4 py-2 text-sm font-semibold"
        >
          Close map
        </button>
      </div>

      <div className="flex-1 overflow-y-auto bg-app-bg px-4 py-4">
        <div className="mx-auto flex max-w-3xl flex-col gap-4">
          <div className="h-[52vh] min-h-[320px] overflow-hidden rounded-[24px] border border-app-border bg-app-surface shadow-[0_18px_40px_rgb(var(--color-app-overlay)_/_0.08)]">
            <PlannerMap
              trip={trip}
              markers={markers}
              segments={segments}
              routeSummary={routeSummary}
              selectedEntity={selectedEntity}
              selectionOrigin={selectionOrigin}
              onSelectEntity={onSelectEntity}
              isVisible
              className="h-full w-full rounded-[22px] border border-app-border bg-app-surface"
            />
          </div>

          <MapSelectionSummary
            testId="mobile-trip-map-selection-summary"
            selectedDetails={selectedDetails}
          />
        </div>
      </div>
    </div>
  );
}
