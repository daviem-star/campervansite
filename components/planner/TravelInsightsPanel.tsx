"use client";

import { formatDurationMinutes } from "@/lib/date";
import { TravelLegEstimate } from "@/types/trip";

type TravelInsightsPanelProps = {
  estimates: TravelLegEstimate[];
};

export default function TravelInsightsPanel({
  estimates,
}: TravelInsightsPanelProps) {
  const totalDistanceKm = estimates.reduce((sum, estimate) => sum + estimate.distanceKm, 0);
  const totalBufferedMinutes = estimates.reduce(
    (sum, estimate) => sum + estimate.bufferedDurationMinutes,
    0,
  );
  const liveEstimates = estimates.filter((estimate) => estimate.confidence === "live").length;

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-900">Route realism</h3>
        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600">
          {estimates.length} road legs
        </span>
      </div>

      {estimates.length === 0 ? (
        <p className="text-sm text-slate-500">Add more trip stops to generate route estimates.</p>
      ) : (
        <div className="grid gap-2 sm:grid-cols-3">
          <div className="rounded-xl bg-slate-50 px-3 py-2">
            <p className="text-xs text-slate-500">Estimated road distance</p>
            <p className="font-medium text-slate-800">{totalDistanceKm.toFixed(1)} km</p>
          </div>
          <div className="rounded-xl bg-slate-50 px-3 py-2">
            <p className="text-xs text-slate-500">Buffered drive time</p>
            <p className="font-medium text-slate-800">{formatDurationMinutes(totalBufferedMinutes)}</p>
          </div>
          <div className="rounded-xl bg-slate-50 px-3 py-2">
            <p className="text-xs text-slate-500">Live route estimates</p>
            <p className="font-medium text-slate-800">
              {liveEstimates}/{estimates.length}
            </p>
          </div>
        </div>
      )}
    </section>
  );
}
