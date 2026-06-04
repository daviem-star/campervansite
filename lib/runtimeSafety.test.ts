import { afterEach, describe, expect, it } from "vitest";

import { getUnsafeHostedEnvFlags, isProductionOrHostedRuntime } from "@/lib/runtimeSafety";

describe("runtimeSafety", () => {
  const originalNodeEnv = process.env.NODE_ENV;
  const originalVercelEnv = process.env.VERCEL_ENV;
  const originalServerBypass = process.env.E2E_AUTH_BYPASS;
  const originalBrowserBypass = process.env.NEXT_PUBLIC_E2E_AUTH_BYPASS;
  const originalLocalSignIn = process.env.NEXT_PUBLIC_LOCAL_TEST_SIGN_IN;
  const originalRouteDebug = process.env.NEXT_PUBLIC_OPENROUTESERVICE_DEBUG;

  const restoreEnv = (name: string, value: string | undefined) => {
    if (value === undefined) {
      delete process.env[name];
      return;
    }

    process.env[name] = value;
  };

  afterEach(() => {
    restoreEnv("NODE_ENV", originalNodeEnv);
    restoreEnv("VERCEL_ENV", originalVercelEnv);
    restoreEnv("E2E_AUTH_BYPASS", originalServerBypass);
    restoreEnv("NEXT_PUBLIC_E2E_AUTH_BYPASS", originalBrowserBypass);
    restoreEnv("NEXT_PUBLIC_LOCAL_TEST_SIGN_IN", originalLocalSignIn);
    restoreEnv("NEXT_PUBLIC_OPENROUTESERVICE_DEBUG", originalRouteDebug);
  });

  it("does not report local test flags in a local test runtime", () => {
    process.env.NODE_ENV = "test";
    delete process.env.VERCEL_ENV;
    process.env.E2E_AUTH_BYPASS = "1";
    process.env.NEXT_PUBLIC_E2E_AUTH_BYPASS = "1";
    process.env.NEXT_PUBLIC_LOCAL_TEST_SIGN_IN = "1";

    expect(isProductionOrHostedRuntime()).toBe(false);
    expect(getUnsafeHostedEnvFlags()).toEqual([]);
  });

  it.each([
    { nodeEnv: "production", vercelEnv: undefined },
    { nodeEnv: "test", vercelEnv: "preview" },
    { nodeEnv: "test", vercelEnv: "production" },
  ])("detects unsafe flags in restricted runtime $nodeEnv/$vercelEnv", ({ nodeEnv, vercelEnv }) => {
    process.env.NODE_ENV = nodeEnv;
    restoreEnv("VERCEL_ENV", vercelEnv);
    process.env.E2E_AUTH_BYPASS = "1";
    process.env.NEXT_PUBLIC_E2E_AUTH_BYPASS = "1";
    process.env.NEXT_PUBLIC_LOCAL_TEST_SIGN_IN = "1";
    process.env.NEXT_PUBLIC_OPENROUTESERVICE_DEBUG = "1";

    expect(isProductionOrHostedRuntime()).toBe(true);
    expect(getUnsafeHostedEnvFlags()).toEqual([
      "E2E_AUTH_BYPASS",
      "NEXT_PUBLIC_E2E_AUTH_BYPASS",
      "NEXT_PUBLIC_LOCAL_TEST_SIGN_IN",
      "NEXT_PUBLIC_OPENROUTESERVICE_DEBUG",
    ]);
  });
});
