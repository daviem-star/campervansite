import { isBrowserE2EAuthBypassEnabled } from "@/lib/e2eAuth";

export const FORCE_DEMO_MODE_STORAGE_KEY = "campervan_trip_planner_force_demo_mode";

export const shouldForceDemoMode = (): boolean => {
  if (typeof window === "undefined") {
    return false;
  }

  return window.localStorage.getItem(FORCE_DEMO_MODE_STORAGE_KEY) === "1";
};

export const isOpenRouteServiceDebugEnabled = (): boolean => {
  return process.env.NEXT_PUBLIC_OPENROUTESERVICE_DEBUG === "1";
};

export const isLocalTestSignInEnabled = (): boolean => {
  return process.env.NEXT_PUBLIC_LOCAL_TEST_SIGN_IN === "1";
};

export const canUseLocalTestSignIn = (): boolean => {
  return isLocalTestSignInEnabled() && isBrowserE2EAuthBypassEnabled();
};
