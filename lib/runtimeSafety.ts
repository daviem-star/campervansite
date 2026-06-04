export const UNSAFE_HOSTED_ENV_FLAGS = [
  "E2E_AUTH_BYPASS",
  "NEXT_PUBLIC_E2E_AUTH_BYPASS",
  "NEXT_PUBLIC_LOCAL_TEST_SIGN_IN",
  "NEXT_PUBLIC_OPENROUTESERVICE_DEBUG",
] as const;

export type UnsafeHostedEnvFlag = (typeof UNSAFE_HOSTED_ENV_FLAGS)[number];

export const isProductionOrHostedRuntime = (): boolean => {
  return (
    process.env.NODE_ENV === "production" ||
    process.env.VERCEL_ENV === "preview" ||
    process.env.VERCEL_ENV === "production"
  );
};

export const isLocalOrTestRuntime = (): boolean => {
  return (
    !isProductionOrHostedRuntime() &&
    (process.env.NODE_ENV === "development" || process.env.NODE_ENV === "test")
  );
};

export const getUnsafeHostedEnvFlags = (): UnsafeHostedEnvFlag[] => {
  if (!isProductionOrHostedRuntime()) {
    return [];
  }

  const enabledFlags: UnsafeHostedEnvFlag[] = [];

  if (process.env.E2E_AUTH_BYPASS === "1") {
    enabledFlags.push("E2E_AUTH_BYPASS");
  }
  if (process.env.NEXT_PUBLIC_E2E_AUTH_BYPASS === "1") {
    enabledFlags.push("NEXT_PUBLIC_E2E_AUTH_BYPASS");
  }
  if (process.env.NEXT_PUBLIC_LOCAL_TEST_SIGN_IN === "1") {
    enabledFlags.push("NEXT_PUBLIC_LOCAL_TEST_SIGN_IN");
  }
  if (process.env.NEXT_PUBLIC_OPENROUTESERVICE_DEBUG === "1") {
    enabledFlags.push("NEXT_PUBLIC_OPENROUTESERVICE_DEBUG");
  }

  return enabledFlags;
};
