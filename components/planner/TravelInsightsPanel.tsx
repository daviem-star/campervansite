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
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-900">Route realism</h3>
        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600">
          {legCount} road legs
        </span>
      </div>

      {statusMessage && status !== "fresh" ? (
        <div className={`mb-3 rounded-xl border px-3 py-2 text-sm ${statusTone[status]}`}>
          {statusMessage}
        </div>
      ) : null}

      {isRefreshing ? (
        <div className="mb-3 rounded-xl border border-sky-200 bg-sky-50 px-3 py-2 text-sm text-sky-700">
          Refreshing route estimates and travel buffers...
        </div>
      ) : null}

      {legCount === 0 ? (
        <p className="text-sm text-slate-500">Add more trip stops to generate route estimates.</p>
      ) : status === "unavailable" && estimates.length === 0 ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-3 text-sm text-rose-800">
          {statusMessage ?? "Route timings are unavailable right now."}
        </div>
      ) : (
        <div className="space-y-4">
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-xl bg-slate-50 px-3 py-2">
              <p className="text-xs text-slate-500">Estimated road distance</p>
              <p className="font-medium text-slate-800">{totalDistanceKm.toFixed(1)} km</p>
            </div>
            <div className="rounded-xl bg-slate-50 px-3 py-2">
              <p className="text-xs text-slate-500">Buffered drive time</p>
              <p className="font-medium text-slate-800">
                {formatDurationMinutes(totalBufferedMinutes)}
              </p>
            </div>
            <div className="rounded-xl bg-slate-50 px-3 py-2">
              <p className="text-xs text-slate-500">Live legs</p>
              <p className="font-medium text-slate-800">{liveEstimates}</p>
            </div>
            <div className="rounded-xl bg-slate-50 px-3 py-2">
              <p className="text-xs text-slate-500">Fallback legs</p>
              <p className="font-medium text-slate-800">{fallbackEstimates}</p>
            </div>
          </div>

          <div className="space-y-3">
            {groupedEstimates.map((group) => (
              <div key={group.date} className="space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-semibold text-slate-900">
                    {formatDateOnly(group.date)}
                  </h4>
                  <span className="text-xs text-slate-500">
                    {group.estimates.length} leg{group.estimates.length === 1 ? "" : "s"}
                  </span>
                </div>

                <div className="space-y-2">
                  {group.estimates.map((estimate) => (
                    <article
                      key={estimate.id}
                      className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3"
                    >
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                          <p className="text-sm font-semibold text-slate-900">
                            {estimate.fromLabel} to {estimate.toLabel}
                          </p>
                          <p className="mt-1 text-xs text-slate-500">
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

                      <div className="mt-3 grid gap-2 text-sm text-slate-700 sm:grid-cols-3">
                        <div>
                          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">
                            Distance
                          </p>
                          <p className="mt-1">{estimate.distanceKm.toFixed(1)} km</p>
                        </div>
                        <div>
                          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">
                            Drive time
                          </p>
                          <p className="mt-1">{formatDurationMinutes(estimate.durationMinutes)}</p>
                        </div>
                        <div>
                          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">
                            Buffered time
                          </p>
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
