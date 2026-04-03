"use client";

import { useState } from "react";

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
  showDetailsByDefault?: boolean;
  collapsibleDetails?: boolean;
};

type RouteConfidenceSnapshot = {
  summary: "Live" | "Fallback" | "Mixed" | "Pending" | "Unavailable";
  detail: string;
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

export const getRouteConfidenceSnapshot = (
  estimates: TravelLegEstimate[],
  legCount: number,
): RouteConfidenceSnapshot => {
  const liveEstimates = estimates.filter((estimate) => estimate.confidence === "live").length;
  const fallbackEstimates = estimates.filter((estimate) => estimate.confidence === "fallback").length;
  const pendingEstimates = Math.max(legCount - estimates.length, 0);
  const summary =
    liveEstimates > 0 && fallbackEstimates === 0
      ? "Live"
      : fallbackEstimates > 0 && liveEstimates === 0
        ? "Fallback"
        : liveEstimates > 0 && fallbackEstimates > 0
          ? "Mixed"
          : pendingEstimates > 0
            ? "Pending"
            : "Unavailable";
  const detail =
    summary === "Live"
      ? `${liveEstimates} live leg${liveEstimates === 1 ? "" : "s"}`
      : summary === "Fallback"
        ? `${fallbackEstimates} fallback leg${fallbackEstimates === 1 ? "" : "s"}`
        : summary === "Mixed"
          ? `${liveEstimates} live / ${fallbackEstimates} fallback`
          : summary === "Pending"
            ? `${pendingEstimates} leg${pendingEstimates === 1 ? "" : "s"} pending refresh`
            : "No route data available";

  return { summary, detail };
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
  showDetailsByDefault = true,
  collapsibleDetails = false,
}: TravelInsightsPanelProps) {
  const totalDistanceKm = estimates.reduce((sum, estimate) => sum + estimate.distanceKm, 0);
  const totalBufferedMinutes = estimates.reduce(
    (sum, estimate) => sum + estimate.bufferedDurationMinutes,
    0,
  );
  const groupedEstimates = groupEstimatesByDate(estimates);
  const [isDetailsExpanded, setIsDetailsExpanded] = useState(showDetailsByDefault);
  const routeConfidence = getRouteConfidenceSnapshot(estimates, legCount);
  const shouldShowDetails = !collapsibleDetails || isDetailsExpanded;

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
          <div className="overflow-hidden rounded-[20px] border border-app-border/80 bg-app-surface-muted/45">
            <div className="grid gap-px bg-app-border/70 sm:grid-cols-3">
              <div className="bg-app-surface/85 px-4 py-4">
                <p className="planner-eyebrow text-app-muted">Buffered drive time</p>
                <p className="planner-title-lg mt-2 text-app-text">
                  {formatDurationMinutes(totalBufferedMinutes)}
                </p>
              </div>
              <div className="bg-app-surface/85 px-4 py-4">
                <p className="planner-eyebrow text-app-muted">Road legs</p>
                <p className="planner-title-lg mt-2 text-app-text">{legCount}</p>
              </div>
              <div className="bg-app-surface/85 px-4 py-4">
                <p className="planner-eyebrow text-app-muted">Routing confidence</p>
                <p className="planner-title-lg mt-2 text-app-text">{routeConfidence.summary}</p>
                <p className="planner-copy-sm mt-1 text-app-muted">{routeConfidence.detail}</p>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-app-border/70 pt-4">
            <div>
              <p className="planner-copy-sm font-medium text-app-text">
                Estimated road distance {totalDistanceKm.toFixed(1)} km.
              </p>
              {collapsibleDetails ? (
                <p className="planner-copy-sm mt-1 text-app-muted">
                  {isDetailsExpanded
                    ? "Showing detailed route legs."
                    : "Route details are hidden until you need them."}
                </p>
              ) : null}
            </div>
            {collapsibleDetails ? (
              <button
                type="button"
                onClick={() => setIsDetailsExpanded((current) => !current)}
                className="planner-button-secondary rounded-full border px-3 py-1 text-xs font-semibold"
              >
                {isDetailsExpanded ? "Hide route details" : "Show route details"}
              </button>
            ) : null}
          </div>

          {shouldShowDetails ? (
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
          ) : null}
        </div>
      )}
    </section>
  );
}
