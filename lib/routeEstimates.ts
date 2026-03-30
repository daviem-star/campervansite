import { buildTravelEstimateRequests } from "@/lib/tripDerived";
import { TravelLegEstimate, Trip } from "@/types/trip";

export const fetchTravelLegEstimates = async (trip: Trip): Promise<TravelLegEstimate[]> => {
  const legs = buildTravelEstimateRequests(trip);
  if (legs.length === 0) {
    return [];
  }

  const response = await fetch("/api/route-estimates", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ legs }),
  });

  const payload = (await response.json().catch(() => null)) as
    | {
        error?: string;
        estimates?: TravelLegEstimate[];
      }
    | null;

  if (!response.ok) {
    throw new Error(
      payload?.error ??
        (typeof navigator !== "undefined" && !navigator.onLine
          ? "Route timings could not refresh because you are offline."
          : "Unable to estimate route timings right now."),
    );
  }

  return payload?.estimates ?? [];
};
