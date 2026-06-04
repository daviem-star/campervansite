import { describe, expect, it } from "vitest";

import {
  parsePlannerRailCollapsed,
  plannerRailPreferenceStorageKey,
  readPlannerRailCollapsed,
  writePlannerRailCollapsed,
} from "@/lib/plannerRail";

describe("planner rail preference", () => {
  it("parses only boolean storage values", () => {
    expect(parsePlannerRailCollapsed("true")).toBe(true);
    expect(parsePlannerRailCollapsed("false")).toBe(false);
    expect(parsePlannerRailCollapsed("collapsed")).toBeNull();
  });

  it("defaults to expanded and writes the preference", () => {
    const values = new Map<string, string>();
    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
    } as Storage;

    expect(readPlannerRailCollapsed(storage)).toBe(false);
    writePlannerRailCollapsed(storage, true);
    expect(values.get(plannerRailPreferenceStorageKey)).toBe("true");
    expect(readPlannerRailCollapsed(storage)).toBe(true);
  });
});
