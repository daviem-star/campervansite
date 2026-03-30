import { describe, expect, it } from "vitest";

import {
  LOCAL_TEST_USER_EMAIL,
  LOCAL_TEST_USER_ID,
  createLocalTestBypassSession,
  createLocalTestUser,
} from "@/lib/e2eAuth";

describe("e2eAuth", () => {
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
});
