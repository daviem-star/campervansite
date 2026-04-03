import { describe, expect, it } from "vitest";

import {
  createPlannerScreenStack,
  getCurrentPlannerScreen,
  popPlannerScreen,
  pushPlannerScreen,
  replacePlannerScreen,
} from "@/lib/plannerNavigation";

describe("plannerNavigation", () => {
  it("pushes trip screens and pops back through visited screens", () => {
    const dashboard = createPlannerScreenStack();
    const overview = pushPlannerScreen(dashboard, {
      screen: "trip-overview",
      tripId: "trip-1",
    });
    const itinerary = pushPlannerScreen(overview, {
      screen: "trip-itinerary",
      tripId: "trip-1",
    });

    expect(getCurrentPlannerScreen(itinerary)).toEqual({
      screen: "trip-itinerary",
      tripId: "trip-1",
    });
    expect(getCurrentPlannerScreen(popPlannerScreen(itinerary))).toEqual({
      screen: "trip-overview",
      tripId: "trip-1",
    });
    expect(getCurrentPlannerScreen(popPlannerScreen(popPlannerScreen(itinerary)))).toEqual({
      screen: "dashboard",
      tripId: null,
    });
  });

  it("avoids duplicate consecutive entries and can replace the current screen", () => {
    const dashboard = createPlannerScreenStack();
    const overview = pushPlannerScreen(dashboard, {
      screen: "trip-overview",
      tripId: "trip-1",
    });
    const duplicateOverview = pushPlannerScreen(overview, {
      screen: "trip-overview",
      tripId: "trip-1",
    });
    const replaced = replacePlannerScreen(duplicateOverview, {
      screen: "trip-overview",
      tripId: "trip-2",
    });

    expect(duplicateOverview).toHaveLength(2);
    expect(getCurrentPlannerScreen(replaced)).toEqual({
      screen: "trip-overview",
      tripId: "trip-2",
    });
  });
});
