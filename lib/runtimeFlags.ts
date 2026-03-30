export const FORCE_DEMO_MODE_STORAGE_KEY = "campervan_trip_planner_force_demo_mode";

export const shouldForceDemoMode = (): boolean => {
  if (typeof window === "undefined") {
    return false;
  }

  return window.localStorage.getItem(FORCE_DEMO_MODE_STORAGE_KEY) === "1";
};
