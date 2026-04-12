"use client";

import type { ReactNode } from "react";

import TravelInsightsPanel from "@/components/planner/TravelInsightsPanel";
import ValidationWarningsPanel from "@/components/planner/ValidationWarningsPanel";
import { formatTripDateRange, getTripDays } from "@/lib/tripDerived";
import { TravelLegEstimate, Trip, ValidationWarning } from "@/types/trip";

const defaultExpandedWarningSeverities: ValidationWarning["severity"][] = ["high", "medium"];

type DashboardTripDetailsPanelProps = {
  trip: Trip | null;
  todayTripId: string | null;
  canManageTrips: boolean;
  canDeleteTrip: boolean;
  isWorking: boolean;
  isOfflineReadOnly: boolean;
  isPreviewing: boolean;
  isUpdatingTodayTrip: boolean;
  routeEstimates: TravelLegEstimate[];
  routeLegCount: number;
  routeStatus: "fresh" | "stale" | "unavailable";
  routeStatusMessage: string | null;
  isRefreshingRouteInsights: boolean;
  warnings: ValidationWarning[];
  mapPreview?: ReactNode;
  onRefreshRouteInsights?: () => void;
  onOpenTrip?: () => void;
  onToggleTodayTrip?: () => void;
  onRenameTrip?: () => void;
  onDeleteTrip?: () => void;
};

const actionButtonClass =
  "rounded-lg border px-3 py-1.5 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60";

export default function DashboardTripDetailsPanel({
  trip,
  todayTripId,
  canManageTrips,
  canDeleteTrip,
  isWorking,
  isOfflineReadOnly,
  isPreviewing,
  isUpdatingTodayTrip,
  routeEstimates,
  routeLegCount,
  routeStatus,
  routeStatusMessage,
  isRefreshingRouteInsights,
  warnings,
  mapPreview,
  onRefreshRouteInsights,
  onOpenTrip,
  onToggleTodayTrip,
  onRenameTrip,
  onDeleteTrip,
}: DashboardTripDetailsPanelProps) {
  const tripDayCount = trip ? getTripDays(trip).length : 0;
  const isTodayTrip = trip?.id === todayTripId;

  return (
    <div className="space-y-3 lg:min-h-0 lg:overflow-y-auto lg:pr-1">
      <section className="rounded-lg border border-app-border/80 bg-app-surface px-4 py-3.5 sm:px-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="planner-eyebrow planner-section-label">Trip</p>
            {trip ? (
              <>
                <h2 className="planner-title-md mt-1 text-app-text">{trip.name}</h2>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  <span className="planner-pill rounded-lg border px-2.5 py-1 text-xs font-semibold">
                    {formatTripDateRange(trip)}
                  </span>
                  <span className="planner-pill rounded-lg border px-2.5 py-1 text-xs font-semibold">
                    {tripDayCount} {tripDayCount === 1 ? "day" : "days"}
                  </span>
                  <span className="planner-pill rounded-lg border px-2.5 py-1 text-xs font-semibold">
                    {warnings.length} warning{warnings.length === 1 ? "" : "s"}
                  </span>
                  <span className="planner-pill rounded-lg border px-2.5 py-1 text-xs font-semibold">
                    {routeStatus === "fresh" ? "Live" : routeStatus === "stale" ? "Needs refresh" : "Unavailable"}
                  </span>
                </div>
                {isPreviewing ? (
                  <p className="planner-meta mt-2 text-brand-primary">Loading preview...</p>
                ) : null}
              </>
            ) : (
              <p className="planner-copy-sm mt-2 text-app-muted">
                Select a trip from the library to inspect it before opening.
              </p>
            )}
          </div>

          {trip ? (
            <div className="flex flex-wrap gap-1.5">
              {onOpenTrip ? (
                <button
                  type="button"
                  data-testid="dashboard-open-trip-button"
                  onClick={onOpenTrip}
                  disabled={isWorking}
                  className={`${actionButtonClass} planner-button-primary`}
                >
                  Open
                </button>
              ) : null}
              {canManageTrips ? (
                <>
                  <button
                    type="button"
                    onClick={onToggleTodayTrip}
                    disabled={isWorking || isOfflineReadOnly || isUpdatingTodayTrip}
                    className={`${actionButtonClass} ${
                      isTodayTrip
                        ? "border-state-info-border bg-state-info-surface text-state-info"
                        : "planner-button-secondary"
                    }`}
                  >
                    {isUpdatingTodayTrip
                      ? "Updating..."
                      : isTodayTrip
                        ? "Clear Today trip"
                        : "Set Today trip"}
                  </button>
                  <button
                    type="button"
                    onClick={onRenameTrip}
                    disabled={isWorking || isOfflineReadOnly}
                    className={`${actionButtonClass} planner-button-secondary`}
                  >
                    Rename
                  </button>
                  <button
                    type="button"
                    onClick={onDeleteTrip}
                    disabled={!canDeleteTrip || isWorking || isOfflineReadOnly}
                    className={`${actionButtonClass} planner-button-danger`}
                  >
                    Delete
                  </button>
                </>
              ) : null}
            </div>
          ) : null}
        </div>
      </section>

      {mapPreview}

      <TravelInsightsPanel
        estimates={routeEstimates}
        legCount={routeLegCount}
        status={routeStatus}
        statusMessage={routeStatusMessage}
        isRefreshing={isRefreshingRouteInsights}
        onRefresh={trip ? onRefreshRouteInsights : undefined}
        title="Route"
        description="Distance and live status."
        showDetailsByDefault={false}
        collapsibleDetails
        density="compact"
        emptyMessage={
          trip ? null : "Select a trip on Dashboard to inspect saved route timings."
        }
      />

      <ValidationWarningsPanel
        warnings={warnings}
        title="Warnings"
        description="Highest-risk issues stay visible first."
        defaultExpandedSeverities={defaultExpandedWarningSeverities}
        collapseLowSeverity
        showSeverityCounts
        compactHealthyState
        density="compact"
        emptyMessage={
          trip ? null : "Planning warnings will appear here when you preview a trip."
        }
      />
    </div>
  );
}
