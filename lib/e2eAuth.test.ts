import { afterEach, describe, expect, it } from "vitest";

import {
  LOCAL_TEST_USER_EMAIL,
  LOCAL_TEST_USER_ID,
  createLocalTestBypassSession,
  createLocalTestUser,
  isBrowserE2EAuthBypassEnabled,
  isServerE2EAuthBypassEnabled,
} from "@/lib/e2eAuth";

describe("e2eAuth", () => {
  const originalNodeEnv = process.env.NODE_ENV;
  const originalVercelEnv = process.env.VERCEL_ENV;
  const originalBrowserBypass = process.env.NEXT_PUBLIC_E2E_AUTH_BYPASS;
  const originalServerBypass = process.env.E2E_AUTH_BYPASS;

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
    restoreEnv("NEXT_PUBLIC_E2E_AUTH_BYPASS", originalBrowserBypass);
    restoreEnv("E2E_AUTH_BYPASS", originalServerBypass);
  });

  it("builds the fixed local test user identity", () => {
    expect(createLocalTestUser()).toEqual({
      id: LOCAL_TEST_USER_ID,
      email: LOCAL_TEST_USER_EMAIL,
    });
  });

  it("creates a bypass session for the fixed local test user", () => {
    const session = createLocalTestBypassSession();

    expect(session.user).toEqual({
      id: LOCAL_TEST_USER_ID,
      email: LOCAL_TEST_USER_EMAIL,
    });
    expect(session.access_token).toMatch(/^campervan-e2e:/);
  });

  it.each(["development", "test"])("allows bypass in local %s mode", (nodeEnv) => {
    process.env.NODE_ENV = nodeEnv;
    delete process.env.VERCEL_ENV;
    process.env.NEXT_PUBLIC_E2E_AUTH_BYPASS = "1";
    process.env.E2E_AUTH_BYPASS = "1";

    expect(isBrowserE2EAuthBypassEnabled()).toBe(true);
    expect(isServerE2EAuthBypassEnabled()).toBe(true);
  });

  it.each([
    { nodeEnv: "production", vercelEnv: undefined },
    { nodeEnv: "test", vercelEnv: "preview" },
    { nodeEnv: "test", vercelEnv: "production" },
    { nodeEnv: "staging", vercelEnv: undefined },
  ])("disables bypass in restricted runtime $nodeEnv/$vercelEnv", ({ nodeEnv, vercelEnv }) => {
    process.env.NODE_ENV = nodeEnv;
    restoreEnv("VERCEL_ENV", vercelEnv);
    process.env.NEXT_PUBLIC_E2E_AUTH_BYPASS = "1";
    process.env.E2E_AUTH_BYPASS = "1";

    expect(isBrowserE2EAuthBypassEnabled()).toBe(false);
    expect(isServerE2EAuthBypassEnabled()).toBe(false);
  });
});
