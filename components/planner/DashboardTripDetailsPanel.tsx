"use client";

import TravelInsightsPanel from "@/components/planner/TravelInsightsPanel";
import ValidationWarningsPanel from "@/components/planner/ValidationWarningsPanel";
import { formatTripDateRange, getCostSummary } from "@/lib/tripDerived";
import { TravelLegEstimate, Trip, ValidationWarning } from "@/types/trip";

const defaultExpandedWarningSeverities: ValidationWarning["severity"][] = ["high", "medium"];

type DashboardTripDetailsPanelProps = {
  trip: Trip | null;
  loadedTripId: string | null;
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
  onRefreshRouteInsights?: () => void;
  onOpenTrip?: () => void;
  onToggleTodayTrip?: () => void;
  onRenameTrip?: () => void;
  onDeleteTrip?: () => void;
};

const actionButtonClass =
  "rounded-xl border px-3 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60";

export default function DashboardTripDetailsPanel({
  trip,
  loadedTripId,
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
  onRefreshRouteInsights,
  onOpenTrip,
  onToggleTodayTrip,
  onRenameTrip,
  onDeleteTrip,
}: DashboardTripDetailsPanelProps) {
  const costSummary = trip ? getCostSummary(trip) : { totalNights: 0, totalCost: 0 };
  const isLoaded = trip?.id === loadedTripId;
  const isTodayTrip = trip?.id === todayTripId;

  return (
    <div className="space-y-4 lg:min-h-0 lg:overflow-y-auto lg:pr-1">
      <section className="rounded-[24px] border border-app-border/80 bg-app-surface px-4 py-4 sm:px-5 sm:py-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <p className="planner-eyebrow planner-section-label">Trip overview</p>
            {trip ? (
              <>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <h2 className="planner-title-lg text-app-text">{trip.name}</h2>
                  {isLoaded ? (
                    <span className="planner-pill-active rounded-full border bg-app-surface px-2.5 py-0.5 text-[11px] font-semibold">
                      Loaded
                    </span>
                  ) : null}
                  {isTodayTrip ? (
                    <span className="rounded-full border border-state-info-border bg-state-info-surface px-2.5 py-0.5 text-[11px] font-semibold text-state-info">
                      Today trip
                    </span>
                  ) : null}
                </div>
                <p className="planner-copy mt-2 flex flex-wrap items-center gap-2 text-app-muted">
                  <span>{formatTripDateRange(trip)}</span>
                  <span className="hidden text-app-border sm:inline">/</span>
                  <span>Home base: {trip.home.label}</span>
                  <span className="hidden text-app-border sm:inline">/</span>
                  <span>
                    {costSummary.totalNights} night{costSummary.totalNights === 1 ? "" : "s"}
                  </span>
                  <span className="hidden text-app-border sm:inline">/</span>
                  <span>Estimated stay cost: GBP {costSummary.totalCost.toFixed(2)}</span>
                </p>
                {isPreviewing ? (
                  <p className="planner-copy-sm mt-3 text-brand-primary">
                    Loading this trip preview...
                  </p>
                ) : null}
              </>
            ) : (
              <p className="planner-copy mt-3 text-app-muted">
                Select a trip from the library to inspect its saved details before opening it.
              </p>
            )}
          </div>

          {trip ? (
            <div className="flex flex-wrap gap-2">
              {onOpenTrip ? (
                <button
                  type="button"
                  onClick={onOpenTrip}
                  disabled={isWorking && !isLoaded}
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

      <TravelInsightsPanel
        estimates={routeEstimates}
        legCount={routeLegCount}
        status={routeStatus}
        statusMessage={routeStatusMessage}
        isRefreshing={isRefreshingRouteInsights}
        onRefresh={trip ? onRefreshRouteInsights : undefined}
        emptyMessage={
          trip ? null : "Select a trip on Dashboard to inspect saved route timings."
        }
      />

      <ValidationWarningsPanel
        warnings={warnings}
        title="Warnings"
        description="Grouped by severity so the highest-risk issues stay visible first."
        defaultExpandedSeverities={defaultExpandedWarningSeverities}
        collapseLowSeverity
        showSeverityCounts
        emptyMessage={
          trip ? null : "Planning warnings will appear here when you preview a trip."
        }
      />
    </div>
  );
}
