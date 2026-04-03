import { describe, expect, it } from "vitest";

import {
  groupValidationWarningsBySeverity,
  hasElevatedValidationWarnings,
  validationWarningGroupMeta,
} from "@/lib/validationWarnings";
import { ValidationWarning } from "@/types/trip";

const warnings: ValidationWarning[] = [
  {
    id: "high-1",
    kind: "travel_feasibility",
    severity: "high",
    label: "Very long drive",
    detail: "Details",
  },
  {
    id: "medium-1",
    kind: "coverage_gap",
    severity: "medium",
    label: "Coverage gap",
    detail: "Details",
  },
  {
    id: "low-1",
    kind: "route_confidence",
    severity: "low",
    label: "Fallback timing",
    detail: "Details",
  },
];

describe("validationWarnings", () => {
  it("groups warnings by severity while preserving all severities", () => {
    const grouped = groupValidationWarningsBySeverity(warnings);

    expect(grouped.high.map((warning) => warning.id)).toEqual(["high-1"]);
    expect(grouped.medium.map((warning) => warning.id)).toEqual(["medium-1"]);
    expect(grouped.low.map((warning) => warning.id)).toEqual(["low-1"]);
  });

  it("exposes readable metadata for each severity section", () => {
    expect(validationWarningGroupMeta.high.label).toBe("High priority");
    expect(validationWarningGroupMeta.low.description).toContain("route-confidence");
  });

  it("treats only high and medium warnings as elevated", () => {
    expect(hasElevatedValidationWarnings(warnings)).toBe(true);
    expect(
      hasElevatedValidationWarnings([
        {
          id: "low-only",
          kind: "route_confidence",
          severity: "low",
          label: "Low only",
          detail: "Details",
        },
      ]),
    ).toBe(false);
  });
});
