"use client";

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

type TripMapPreviewPanelProps = {
  trip: Trip | null;
  markers: MapMarker[];
  segments: MapSegment[];
  routeSummary: PlannerMapRouteSummary;
  selectedEntity: SelectedEntity;
  selectionOrigin?: "itinerary" | "map" | "system";
  selectedDetails: SelectedEntityDetails | null;
  onSelectEntity: (entity: Exclude<SelectedEntity, null>) => void;
  onOpenMobileMap?: () => void;
  title?: string;
  description?: string;
  emptyMessage?: string;
  mobileCtaLabel?: string;
  mobileCtaDescription?: string;
  panelTestId?: string;
  mobileButtonTestId?: string;
  selectionSummaryTestId?: string;
};

export default function TripMapPreviewPanel({
  trip,
  markers,
  segments,
  routeSummary,
  selectedEntity,
  selectionOrigin = "system",
  selectedDetails,
  onSelectEntity,
  onOpenMobileMap,
  title = "Map",
  description = "Select a stop or ferry leg to inspect the route in context.",
  emptyMessage = "Select a trip to preview its map.",
  mobileCtaLabel = "View map",
  mobileCtaDescription = "Open the route in a dedicated full-screen map view.",
  panelTestId,
  mobileButtonTestId,
  selectionSummaryTestId,
}: TripMapPreviewPanelProps) {
  return (
    <section
      data-testid={panelTestId}
      className="rounded-[24px] border border-app-border/80 bg-app-surface px-4 py-4 shadow-[0_18px_40px_rgb(var(--color-app-overlay)_/_0.08)] sm:px-5 sm:py-5"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="planner-eyebrow planner-section-label">{title}</p>
          <p className="planner-copy-sm mt-2 text-app-muted">{description}</p>
        </div>
      </div>

      {!trip ? (
        <p className="planner-copy mt-4 text-app-muted">{emptyMessage}</p>
      ) : (
        <>
          <div className="mt-4 md:hidden">
            <div className="rounded-[20px] border border-app-border bg-app-surface-muted/55 px-4 py-4">
              <p className="planner-copy text-app-text">{mobileCtaDescription}</p>
              {onOpenMobileMap ? (
                <button
                  type="button"
                  data-testid={mobileButtonTestId}
                  onClick={onOpenMobileMap}
                  className="planner-button-secondary mt-4 rounded-full border px-4 py-2 text-sm font-semibold"
                >
                  {mobileCtaLabel}
                </button>
              ) : null}
            </div>
          </div>

          <div className="mt-4 hidden md:block">
            <div className="h-[360px] overflow-hidden rounded-[20px] border border-app-border bg-app-surface lg:h-[420px]">
              <PlannerMap
                trip={trip}
                markers={markers}
                segments={segments}
                routeSummary={routeSummary}
                selectedEntity={selectedEntity}
                selectionOrigin={selectionOrigin}
                onSelectEntity={onSelectEntity}
                isVisible
                testRegistryKey={panelTestId}
                className="h-full w-full rounded-[18px] border border-app-border bg-app-surface"
              />
            </div>

            <MapSelectionSummary
              testId={selectionSummaryTestId}
              selectedDetails={selectedDetails}
              className="mt-4"
            />
          </div>
        </>
      )}
    </section>
  );
}
