import { PlannerNoticeTone, SyncStatus, ValidationWarningSeverity } from "@/types/trip";

export const plannerNoticeToneClass: Record<PlannerNoticeTone, string> = {
  info: "tone-info",
  success: "tone-success",
  warning: "tone-warning",
};

export const plannerSyncToneClass: Record<SyncStatus, string> = {
  idle: "tone-neutral",
  saving: "tone-info",
  saved: "tone-success",
  offline: "tone-warning",
  error: "tone-error",
};

export const plannerSyncDotClass: Record<SyncStatus, string> = {
  idle: "bg-state-neutral",
  saving: "bg-state-info",
  saved: "bg-state-success",
  offline: "bg-state-warning",
  error: "bg-state-error",
};

export const plannerRouteConfidenceToneClass = {
  live: "tone-success",
  fallback: "tone-warning",
} as const;

export const plannerRouteStatusToneClass = {
  stale: "tone-warning",
  unavailable: "tone-error",
} as const;

export const plannerValidationToneClass: Record<ValidationWarningSeverity | "clear", string> = {
  high: "tone-error",
  medium: "tone-warning",
  low: "tone-neutral",
  clear: "tone-success",
};
