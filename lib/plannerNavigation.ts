export type PlannerScreen =
  | "dashboard"
  | "today"
  | "saved-places"
  | "bookings"
  | "trip-overview"
  | "trip-itinerary";

export type PlannerScreenEntry = {
  screen: PlannerScreen;
  tripId?: string | null;
};

const defaultScreenEntry: PlannerScreenEntry = {
  screen: "dashboard",
  tripId: null,
};

const normalizeScreenEntry = (entry: PlannerScreenEntry): PlannerScreenEntry => ({
  screen: entry.screen,
  tripId: entry.tripId ?? null,
});

export const createPlannerScreenStack = (): PlannerScreenEntry[] => [defaultScreenEntry];

export const getCurrentPlannerScreen = (
  stack: PlannerScreenEntry[],
): PlannerScreenEntry => {
  if (stack.length === 0) {
    return defaultScreenEntry;
  }

  return normalizeScreenEntry(stack[stack.length - 1] ?? defaultScreenEntry);
};

export const pushPlannerScreen = (
  stack: PlannerScreenEntry[],
  nextEntry: PlannerScreenEntry,
): PlannerScreenEntry[] => {
  const normalizedNextEntry = normalizeScreenEntry(nextEntry);
  const currentEntry = getCurrentPlannerScreen(stack);

  if (
    currentEntry.screen === normalizedNextEntry.screen &&
    currentEntry.tripId === normalizedNextEntry.tripId
  ) {
    return stack.length === 0 ? [normalizedNextEntry] : stack;
  }

  return [...(stack.length === 0 ? [defaultScreenEntry] : stack), normalizedNextEntry];
};

export const replacePlannerScreen = (
  stack: PlannerScreenEntry[],
  nextEntry: PlannerScreenEntry,
): PlannerScreenEntry[] => {
  const normalizedNextEntry = normalizeScreenEntry(nextEntry);

  if (stack.length === 0) {
    return [normalizedNextEntry];
  }

  return [...stack.slice(0, -1), normalizedNextEntry];
};

export const popPlannerScreen = (stack: PlannerScreenEntry[]): PlannerScreenEntry[] => {
  if (stack.length <= 1) {
    return createPlannerScreenStack();
  }

  return stack.slice(0, -1);
};

export const isTripPlannerScreen = (screen: PlannerScreen): boolean =>
  screen === "trip-overview" || screen === "trip-itinerary";
