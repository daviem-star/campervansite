import { ValidationWarning, ValidationWarningSeverity } from "@/types/trip";

export const validationWarningSeverityOrder = ["high", "medium", "low"] as const;

export const validationWarningGroupMeta: Record<
  ValidationWarningSeverity,
  {
    label: string;
    description: string;
  }
> = {
  high: {
    label: "High priority",
    description: "Fix these first because they are most likely to affect the trip.",
  },
  medium: {
    label: "Medium priority",
    description: "These items deserve a review before you commit to the route.",
  },
  low: {
    label: "Low priority",
    description: "Helpful context and softer route-confidence notes.",
  },
};

export const groupValidationWarningsBySeverity = (
  warnings: ValidationWarning[],
): Record<ValidationWarningSeverity, ValidationWarning[]> => {
  return validationWarningSeverityOrder.reduce<
    Record<ValidationWarningSeverity, ValidationWarning[]>
  >(
    (groups, severity) => {
      groups[severity] = warnings.filter((warning) => warning.severity === severity);
      return groups;
    },
    {
      high: [],
      medium: [],
      low: [],
    },
  );
};

export const hasElevatedValidationWarnings = (
  warnings: ValidationWarning[],
): boolean => {
  return warnings.some(
    (warning) => warning.severity === "high" || warning.severity === "medium",
  );
};
