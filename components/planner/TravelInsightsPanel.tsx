"use client";

import {
  plannerRouteConfidenceToneClass,
  plannerRouteStatusToneClass,
} from "@/components/planner/plannerTheme";
import { formatDateOnly, formatDateTime, formatDurationMinutes } from "@/lib/date";
import { TravelLegEstimate } from "@/types/trip";

type TravelInsightsPanelProps = {
  estimates: TravelLegEstimate[];
  legCount: number;
  status: "fresh" | "stale" | "unavailable";
  statusMessage: string | null;
  isRefreshing: boolean;
  onRefresh?: () => void;
  isRefreshDisabled?: boolean;
  emptyMessage?: string | null;
  title?: string;
  description?: string;
};

const groupEstimatesByDate = (
  estimates: TravelLegEstimate[],
): Array<{
  date: string;
  estimates: TravelLegEstimate[];
}> => {
  const grouped = new Map<string, TravelLegEstimate[]>();

  estimates.forEach((estimate) => {
    const list = grouped.get(estimate.date) ?? [];
    list.push(estimate);
    grouped.set(estimate.date, list);
  });

  return Array.from(grouped.entries()).map(([date, groupedEstimates]) => ({
    date,
    estimates: groupedEstimates,
  }));
};

export default function TravelInsightsPanel({
  estimates,
  legCount,
  status,
  statusMessage,
  isRefreshing,
  onRefresh,
  isRefreshDisabled = false,
  emptyMessage = null,
  title = "Route realism",
  description = "Live and cached drive estimates across the current campervan plan.",
}: TravelInsightsPanelProps) {
  const totalDistanceKm = estimates.reduce((sum, estimate) => sum + estimate.distanceKm, 0);
  const totalBufferedMinutes = estimates.reduce(
    (sum, estimate) => sum + estimate.bufferedDurationMinutes,
    0,
  );
  const liveEstimates = estimates.filter((estimate) => estimate.confidence === "live").length;
  const fallbackEstimates = estimates.filter((estimate) => estimate.confidence === "fallback").length;
  const groupedEstimates = groupEstimatesByDate(estimates);

  return (
    <section className="rounded-[24px] border border-app-border/80 bg-app-surface px-4 py-4 sm:px-5 sm:py-5">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="planner-eyebrow planner-section-label">{title}</p>
          <p className="planner-copy mt-2 text-app-muted">{description}</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="planner-pill rounded-full border px-3 py-1 text-xs font-semibold">
            {legCount} road legs
          </span>
          {onRefresh ? (
            <button
              type="button"
              onClick={onRefresh}
              disabled={isRefreshDisabled || isRefreshing}
              className="planner-button-secondary rounded-full border px-3 py-1 text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isRefreshing ? "Refreshing..." : "Refresh"}
            </button>
          ) : null}
        </div>
      </div>

      {statusMessage && status !== "fresh" ? (
        <div className={`planner-copy mb-4 rounded-2xl border px-4 py-3 ${plannerRouteStatusToneClass[status]}`}>
          {statusMessage}
        </div>
      ) : null}

      {isRefreshing ? (
        <div className="planner-copy tone-info mb-4 rounded-2xl border px-4 py-3">
          Refreshing route estimates and travel buffers...
        </div>
      ) : null}

      {legCount === 0 ? (
        <p className="planner-copy text-app-muted">
          {emptyMessage ?? "Add more trip stops to generate route estimates."}
        </p>
      ) : status === "unavailable" && estimates.length === 0 ? (
        <div className="planner-copy tone-error rounded-2xl border px-4 py-4">
          {statusMessage ?? "Route timings are unavailable right now."}
        </div>
      ) : (
        <div className="space-y-4">
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-[18px] border border-app-border bg-app-surface-muted/80 px-3.5 py-3.5">
              <p className="planner-eyebrow text-app-muted">Estimated road distance</p>
              <p className="planner-title-lg mt-2 text-app-text">
                {totalDistanceKm.toFixed(1)} km
              </p>
            </div>
            <div className="rounded-[18px] border border-app-border bg-app-surface-muted/80 px-3.5 py-3.5">
              <p className="planner-eyebrow text-app-muted">Buffered drive time</p>
              <p className="planner-title-lg mt-2 text-app-text">
                {formatDurationMinutes(totalBufferedMinutes)}
              </p>
            </div>
            <div className="rounded-[18px] border border-app-border bg-app-surface-muted/80 px-3.5 py-3.5">
              <p className="planner-eyebrow text-app-muted">Live legs</p>
              <p className="planner-title-lg mt-2 text-app-text">
                {liveEstimates}
              </p>
            </div>
            <div className="rounded-[18px] border border-app-border bg-app-surface-muted/80 px-3.5 py-3.5">
              <p className="planner-eyebrow text-app-muted">Fallback legs</p>
              <p className="planner-title-lg mt-2 text-app-text">
                {fallbackEstimates}
              </p>
            </div>
          </div>

          <div className="space-y-4">
            {groupedEstimates.map((group) => (
              <div key={group.date} className="space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="planner-title-sm text-app-text">{formatDateOnly(group.date)}</h4>
                  <span className="planner-meta text-app-muted">
                    {group.estimates.length} leg{group.estimates.length === 1 ? "" : "s"}
                  </span>
                </div>

                <div className="space-y-2">
                  {group.estimates.map((estimate) => (
                    <article
                      key={estimate.id}
                      className="rounded-[18px] border border-app-border bg-app-surface px-3.5 py-3.5"
                    >
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                          <p className="planner-title-sm text-app-text">
                            {estimate.fromLabel} to {estimate.toLabel}
                          </p>
                          <p className="planner-meta mt-1 text-app-muted">
                            Last fetched {formatDateTime(estimate.fetchedAt)}
                          </p>
                        </div>

                        <span
                          data-testid={`route-confidence-${estimate.confidence}`}
                          className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-semibold ${plannerRouteConfidenceToneClass[estimate.confidence]}`}
                        >
                          {estimate.confidence === "live" ? "Live" : "Fallback"}
                        </span>
                      </div>

                      <div className="planner-copy mt-3 grid gap-2 text-app-text sm:grid-cols-3">
                        <div>
                          <p className="planner-eyebrow text-app-muted">Distance</p>
                          <p className="mt-1">{estimate.distanceKm.toFixed(1)} km</p>
                        </div>
                        <div>
                          <p className="planner-eyebrow text-app-muted">Drive time</p>
                          <p className="mt-1">{formatDurationMinutes(estimate.durationMinutes)}</p>
                        </div>
                        <div>
                          <p className="planner-eyebrow text-app-muted">Buffered time</p>
                          <p className="mt-1">
                            {formatDurationMinutes(estimate.bufferedDurationMinutes)}
                          </p>
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
