"use client";

import { formatDateOnly, formatDateTime, formatDurationMinutes } from "@/lib/date";
import { TravelLegEstimate } from "@/types/trip";

type TravelInsightsPanelProps = {
  estimates: TravelLegEstimate[];
  legCount: number;
  status: "fresh" | "stale" | "unavailable";
  statusMessage: string | null;
  isRefreshing: boolean;
};

const confidenceTone = {
  live: "border-emerald-200 bg-emerald-50 text-emerald-700",
  fallback: "border-amber-200 bg-amber-50 text-amber-800",
} as const;

const statusTone = {
  stale: "border-amber-200 bg-amber-50 text-amber-800",
  unavailable: "border-rose-200 bg-rose-50 text-rose-800",
} as const;

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
    <section className="rounded-[24px] border border-slate-200/80 bg-white px-4 py-4 sm:px-5 sm:py-5">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="planner-eyebrow text-teal-700">Route realism</p>
          <p className="planner-copy mt-2 text-slate-600">
            Live and cached drive estimates across the current campervan plan.
          </p>
        </div>
        <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-600">
          {legCount} road legs
        </span>
      </div>

      {statusMessage && status !== "fresh" ? (
        <div className={`planner-copy mb-4 rounded-2xl border px-4 py-3 ${statusTone[status]}`}>
          {statusMessage}
        </div>
      ) : null}

      {isRefreshing ? (
        <div className="planner-copy mb-4 rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3 text-sky-700">
          Refreshing route estimates and travel buffers...
        </div>
      ) : null}

      {legCount === 0 ? (
        <p className="planner-copy text-slate-500">Add more trip stops to generate route estimates.</p>
      ) : status === "unavailable" && estimates.length === 0 ? (
        <div className="planner-copy rounded-2xl border border-rose-200 bg-rose-50 px-4 py-4 text-rose-800">
          {statusMessage ?? "Route timings are unavailable right now."}
        </div>
      ) : (
        <div className="space-y-4">
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-[18px] border border-slate-200 bg-slate-50/80 px-3.5 py-3.5">
              <p className="planner-eyebrow text-slate-500">Estimated road distance</p>
              <p className="planner-title-lg mt-2 text-slate-950">
                {totalDistanceKm.toFixed(1)} km
              </p>
            </div>
            <div className="rounded-[18px] border border-slate-200 bg-slate-50/80 px-3.5 py-3.5">
              <p className="planner-eyebrow text-slate-500">Buffered drive time</p>
              <p className="planner-title-lg mt-2 text-slate-950">
                {formatDurationMinutes(totalBufferedMinutes)}
              </p>
            </div>
            <div className="rounded-[18px] border border-slate-200 bg-slate-50/80 px-3.5 py-3.5">
              <p className="planner-eyebrow text-slate-500">Live legs</p>
              <p className="planner-title-lg mt-2 text-slate-950">
                {liveEstimates}
              </p>
            </div>
            <div className="rounded-[18px] border border-slate-200 bg-slate-50/80 px-3.5 py-3.5">
              <p className="planner-eyebrow text-slate-500">Fallback legs</p>
              <p className="planner-title-lg mt-2 text-slate-950">
                {fallbackEstimates}
              </p>
            </div>
          </div>

          <div className="space-y-4">
            {groupedEstimates.map((group) => (
              <div key={group.date} className="space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="planner-title-sm text-slate-900">{formatDateOnly(group.date)}</h4>
                  <span className="planner-meta text-slate-500">
                    {group.estimates.length} leg{group.estimates.length === 1 ? "" : "s"}
                  </span>
                </div>

                <div className="space-y-2">
                  {group.estimates.map((estimate) => (
                    <article
                      key={estimate.id}
                      className="rounded-[18px] border border-slate-200 bg-white px-3.5 py-3.5"
                    >
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                          <p className="planner-title-sm text-slate-900">
                            {estimate.fromLabel} to {estimate.toLabel}
                          </p>
                          <p className="planner-meta mt-1 text-slate-500">
                            Last fetched {formatDateTime(estimate.fetchedAt)}
                          </p>
                        </div>

                        <span
                          data-testid={`route-confidence-${estimate.confidence}`}
                          className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-semibold ${confidenceTone[estimate.confidence]}`}
                        >
                          {estimate.confidence === "live" ? "Live" : "Fallback"}
                        </span>
                      </div>

                      <div className="planner-copy mt-3 grid gap-2 text-slate-700 sm:grid-cols-3">
                        <div>
                          <p className="planner-eyebrow text-slate-500">Distance</p>
                          <p className="mt-1">{estimate.distanceKm.toFixed(1)} km</p>
                        </div>
                        <div>
                          <p className="planner-eyebrow text-slate-500">Drive time</p>
                          <p className="mt-1">{formatDurationMinutes(estimate.durationMinutes)}</p>
                        </div>
                        <div>
                          <p className="planner-eyebrow text-slate-500">Buffered time</p>
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
