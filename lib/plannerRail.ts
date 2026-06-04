export const plannerRailPreferenceStorageKey = "campervansite:rail-collapsed";

export const parsePlannerRailCollapsed = (value: unknown): boolean | null => {
  if (value === "true") {
    return true;
  }

  if (value === "false") {
    return false;
  }

  return null;
};

export const readPlannerRailCollapsed = (storage: Storage | undefined): boolean => {
  if (!storage) {
    return false;
  }

  try {
    return parsePlannerRailCollapsed(storage.getItem(plannerRailPreferenceStorageKey)) ?? false;
  } catch {
    return false;
  }
};

export const writePlannerRailCollapsed = (
  storage: Storage | undefined,
  collapsed: boolean,
): void => {
  try {
    storage?.setItem(plannerRailPreferenceStorageKey, String(collapsed));
  } catch {
    // The rail still works for the current session when storage is unavailable.
  }
};
