import {
  buildTravelEstimateRequests,
  buildTravelLegSignature,
} from "@/lib/tripDerived";
import { isOpenRouteServiceDebugEnabled } from "@/lib/runtimeFlags";
import { TravelLegEstimate, TravelLegRequest, Trip } from "@/types/trip";

export const buildTripTravelLegPayload = (
  trip: Trip,
): {
  requests: TravelLegRequest[];
  signature: string;
} => {
  const requests = buildTravelEstimateRequests(trip);

  return {
    requests,
    signature: buildTravelLegSignature(requests),
  };
};

export const mergeTravelEstimateMetadata = (
  estimates: TravelLegEstimate[],
  requests: TravelLegRequest[],
): TravelLegEstimate[] => {
  if (estimates.length === 0 || requests.length === 0) {
    return [];
  }

  const estimateById = new Map(estimates.map((estimate) => [estimate.id, estimate]));

  return requests.flatMap((request) => {
    const estimate = estimateById.get(request.id);
    if (!estimate) {
      return [];
    }

    return [
      {
        ...estimate,
        fromId: request.fromId,
        fromLabel: request.fromLabel,
        toId: request.toId,
        toLabel: request.toLabel,
        date: request.date,
        relatedStopId: request.relatedStopId,
      },
    ];
  });
};

export const fetchTravelLegEstimates = async (
  requests: TravelLegRequest[],
): Promise<TravelLegEstimate[]> => {
  if (requests.length === 0) {
    return [];
  }

  const response = await fetch("/api/route-estimates", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(isOpenRouteServiceDebugEnabled() ? { "x-route-debug": "1" } : {}),
    },
    body: JSON.stringify({ legs: requests }),
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
