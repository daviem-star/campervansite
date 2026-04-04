import { MapSegment } from "@/types/trip";

export type PlannerMapRouteSummary = {
  totalRoadLegs: number;
  pendingRoadLegs: number;
  liveRoadLegs: number;
  fallbackRoadLegs: number;
  isRefreshing: boolean;
};

export const getPlannerMapRouteSummary = (
  segments: MapSegment[],
  isRefreshing: boolean,
): PlannerMapRouteSummary => {
  const roadSegments = segments.filter((segment) => segment.type === "road");

  return {
    totalRoadLegs: roadSegments.length,
    pendingRoadLegs: roadSegments.filter((segment) => segment.routeStatus === "pending").length,
    liveRoadLegs: roadSegments.filter((segment) => segment.routeStatus === "live").length,
    fallbackRoadLegs: roadSegments.filter((segment) => segment.routeStatus === "fallback").length,
    isRefreshing,
  };
};
