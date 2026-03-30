import { afterEach, describe, expect, it } from "vitest";

import { canUseLocalTestSignIn, isLocalTestSignInEnabled } from "@/lib/runtimeFlags";

describe("runtimeFlags", () => {
  const originalLocalTestSignIn = process.env.NEXT_PUBLIC_LOCAL_TEST_SIGN_IN;
  const originalE2EBypass = process.env.NEXT_PUBLIC_E2E_AUTH_BYPASS;

  afterEach(() => {
    process.env.NEXT_PUBLIC_LOCAL_TEST_SIGN_IN = originalLocalTestSignIn;
    process.env.NEXT_PUBLIC_E2E_AUTH_BYPASS = originalE2EBypass;
  });

  it("keeps the local test sign-in helper hidden when the dedicated flag is absent", () => {
    process.env.NEXT_PUBLIC_LOCAL_TEST_SIGN_IN = "0";
    process.env.NEXT_PUBLIC_E2E_AUTH_BYPASS = "1";

    expect(isLocalTestSignInEnabled()).toBe(false);
    expect(canUseLocalTestSignIn()).toBe(false);
  });

  it("only enables local test sign-in when both the helper flag and browser bypass are enabled", () => {
    process.env.NEXT_PUBLIC_LOCAL_TEST_SIGN_IN = "1";
    process.env.NEXT_PUBLIC_E2E_AUTH_BYPASS = "0";
    expect(canUseLocalTestSignIn()).toBe(false);

    process.env.NEXT_PUBLIC_E2E_AUTH_BYPASS = "1";
    expect(canUseLocalTestSignIn()).toBe(true);
  });
});
