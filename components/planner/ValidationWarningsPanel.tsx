"use client";

import { useMemo, useState } from "react";

import { plannerValidationToneClass } from "@/components/planner/plannerTheme";
import {
  groupValidationWarningsBySeverity,
  hasElevatedValidationWarnings,
  validationWarningGroupMeta,
  validationWarningSeverityOrder,
} from "@/lib/validationWarnings";
import { ValidationWarning } from "@/types/trip";

const defaultExpandedWarningSeverities: ValidationWarning["severity"][] = [
  "high",
  "medium",
  "low",
];

type ValidationWarningsPanelProps = {
  warnings: ValidationWarning[];
  emptyMessage?: string | null;
  title?: string;
  description?: string;
  defaultExpandedSeverities?: ValidationWarning["severity"][];
  collapseLowSeverity?: boolean;
  showSeverityCounts?: boolean;
  compactHealthyState?: boolean;
  density?: "default" | "compact";
  testId?: string;
};

export default function ValidationWarningsPanel({
  warnings,
  emptyMessage = null,
  title = "Planning warnings",
  description = "Review anything that could affect timing, coverage, or trip confidence.",
  defaultExpandedSeverities = defaultExpandedWarningSeverities,
  collapseLowSeverity = false,
  showSeverityCounts = false,
  compactHealthyState = false,
  density = "default",
  testId,
}: ValidationWarningsPanelProps) {
  const isCompact = density === "compact";
  const groupedWarnings = useMemo(
    () => groupValidationWarningsBySeverity(warnings),
    [warnings],
  );
  const hasElevatedWarnings = useMemo(
    () => hasElevatedValidationWarnings(warnings),
    [warnings],
  );
  const lowSeverityWarnings = groupedWarnings.low;
  const highWarningCount = groupedWarnings.high.length;
  const mediumWarningCount = groupedWarnings.medium.length;
  const hasHighWarnings = highWarningCount > 0;
  const elevatedWarningCount = highWarningCount + mediumWarningCount;
  const [isLowSeverityExpanded, setIsLowSeverityExpanded] = useState(
    () => defaultExpandedSeverities.includes("low"),
  );
  const elevatedWarningSummary = hasHighWarnings
    ? `${highWarningCount} high-priority issue${highWarningCount === 1 ? "" : "s"} need attention${
        mediumWarningCount > 0
          ? `, plus ${mediumWarningCount} medium-priority note${mediumWarningCount === 1 ? "" : "s"}`
          : ""
      }.`
    : mediumWarningCount > 0
      ? `${mediumWarningCount} medium-priority issue${mediumWarningCount === 1 ? "" : "s"} deserve a review before you commit.`
      : warnings.length > 0
        ? `${warnings.length} low-priority note${warnings.length === 1 ? "" : "s"} are available for extra context.`
        : "Route realism and itinerary validation look healthy for the current plan.";
  const headerCountClass = hasHighWarnings
    ? "tone-error"
    : hasElevatedWarnings
      ? "tone-warning"
      : "planner-pill";
  const headerLabelClass = hasHighWarnings
    ? "text-state-error"
    : hasElevatedWarnings
      ? "text-state-warning"
      : "planner-section-label-accent";
  const sectionClass = `rounded-[24px] border border-app-border/80 bg-app-surface px-4 ${
    isCompact ? "py-3.5 sm:px-5 sm:py-4" : "py-4 sm:px-5 sm:py-5"
  }`;
  const warningCardClass = `rounded-[18px] border ${isCompact ? "px-3 py-2.5" : "px-3.5 py-3"}`;

  if (emptyMessage) {
    return (
      <section data-testid={testId} className={sectionClass}>
        <p className="planner-eyebrow planner-section-label">{title}</p>
        <p className={`${isCompact ? "planner-copy-sm mt-2.5" : "planner-copy mt-3"} text-app-muted`}>
          {emptyMessage}
        </p>
      </section>
    );
  }

  if (warnings.length === 0 && !compactHealthyState) {
    return (
      <section
        data-testid={testId}
        className={`tone-success rounded-[24px] border px-4 ${
          isCompact ? "py-3.5 sm:px-5 sm:py-4" : "py-4 sm:px-5 sm:py-5"
        }`}
      >
        <p className="planner-eyebrow text-state-success">{title}</p>
        <p className={`${isCompact ? "planner-copy-sm mt-2.5" : "planner-copy mt-3"} font-medium`}>
          Route realism and itinerary validation look healthy for the current plan.
        </p>
      </section>
    );
  }

  if (!hasElevatedWarnings && compactHealthyState) {
    return (
      <section
        data-testid={testId}
        className={`tone-success rounded-[20px] border px-4 ${
          isCompact ? "py-3 sm:px-5 sm:py-3.5" : "py-3.5 sm:px-5 sm:py-4"
        }`}
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="planner-eyebrow text-state-success">{title}</p>
            <p className={`${isCompact ? "planner-copy-sm mt-1.5" : "planner-copy mt-2"} font-medium`}>
              {warnings.length === 0
                ? "No high or medium warnings for the current plan."
                : "No high or medium warnings. Low-severity notes are available if you want extra context."}
            </p>
          </div>

          {lowSeverityWarnings.length > 0 && collapseLowSeverity ? (
            <button
              type="button"
              onClick={() => setIsLowSeverityExpanded((current) => !current)}
              className="planner-button-secondary rounded-full border px-3 py-1 text-[11px] font-semibold"
            >
              {isLowSeverityExpanded
                ? "Hide low severity"
                : `Show low severity (${lowSeverityWarnings.length})`}
            </button>
          ) : null}
        </div>

        {lowSeverityWarnings.length > 0 &&
        (!collapseLowSeverity || isLowSeverityExpanded) ? (
          <ul className={`space-y-2 ${isCompact ? "mt-2.5" : "mt-3"}`}>
            {lowSeverityWarnings.map((warning) => (
              <li
                key={warning.id}
                className={`${warningCardClass} ${plannerValidationToneClass[warning.severity]}`}
              >
                <div className="flex items-center justify-between gap-3">
                  <p className="planner-title-sm">{warning.label}</p>
                  <span className="rounded-full border border-current/20 bg-app-surface/60 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.08em]">
                    {warning.severity}
                  </span>
                </div>
                <p className="planner-copy-sm mt-1">{warning.detail}</p>
              </li>
            ))}
          </ul>
        ) : null}
      </section>
    );
  }

  return (
    <section data-testid={testId} className={sectionClass}>
      <div className={`flex flex-wrap items-start justify-between gap-3 ${isCompact ? "mb-4" : "mb-5"}`}>
        <div className="min-w-0 flex-1">
          <p className={`planner-eyebrow ${headerLabelClass}`}>{title}</p>
          <p className={`${isCompact ? "planner-title-sm mt-1.5" : "planner-title-md mt-2"} text-app-text`}>
            {elevatedWarningSummary}
          </p>
          <p className={`${isCompact ? "planner-copy-sm mt-1.5" : "planner-copy mt-2"} text-app-muted`}>
            {description}
          </p>
        </div>
        <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${headerCountClass}`}>
          {hasElevatedWarnings ? elevatedWarningCount : warnings.length}
        </span>
      </div>

      <div className={isCompact ? "space-y-3" : "space-y-4"}>
        {validationWarningSeverityOrder.map((severity) => {
          const severityWarnings = groupedWarnings[severity];

          if (severityWarnings.length === 0) {
            return null;
          }

          const isCollapsibleLowSeverity = collapseLowSeverity && severity === "low";
          const isExpanded =
            severity === "low"
              ? (isCollapsibleLowSeverity
                  ? isLowSeverityExpanded
                  : defaultExpandedSeverities.includes("low"))
              : defaultExpandedSeverities.includes(severity);

          return (
            <section key={severity} className={isCompact ? "space-y-1.5" : "space-y-2"}>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="planner-title-sm text-app-text">
                    {validationWarningGroupMeta[severity].label}
                  </p>
                  <p className={`planner-copy-sm text-app-muted ${isCompact ? "mt-0.5" : "mt-1"}`}>
                    {validationWarningGroupMeta[severity].description}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  {showSeverityCounts ? (
                    <span className="planner-pill rounded-full border px-3 py-1 text-[11px] font-semibold">
                      {severityWarnings.length}
                    </span>
                  ) : null}

                  {isCollapsibleLowSeverity ? (
                    <button
                      type="button"
                      onClick={() => setIsLowSeverityExpanded((current) => !current)}
                      className="planner-button-secondary rounded-full border px-3 py-1 text-[11px] font-semibold"
                    >
                      {isExpanded ? "Hide low severity" : `Show low severity (${severityWarnings.length})`}
                    </button>
                  ) : null}
                </div>
              </div>

              {isExpanded ? (
                <ul className={isCompact ? "space-y-1.5" : "space-y-2"}>
                  {severityWarnings.map((warning) => (
                    <li
                      key={warning.id}
                      className={`${warningCardClass} ${plannerValidationToneClass[warning.severity]}`}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <p className="planner-title-sm">{warning.label}</p>
                        <span className="rounded-full border border-current/20 bg-app-surface/60 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.08em]">
                          {warning.severity}
                        </span>
                      </div>
                      <p className="planner-copy-sm mt-1">{warning.detail}</p>
                    </li>
                  ))}
                </ul>
              ) : null}
            </section>
          );
        })}
      </div>
    </section>
  );
}
