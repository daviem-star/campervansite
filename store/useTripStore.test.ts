import { describe, expect, it, vi } from "vitest";

import {
  resolveAuthStateChangeAction,
  withPerUserLock,
} from "@/store/useTripStore";

describe("useTripStore auth bootstrap guards", () => {
  it("refreshes in place for a same-user sign-in event", () => {
    expect(
      resolveAuthStateChangeAction({
        event: "SIGNED_IN",
        currentUserId: "user-1",
        sessionUserId: "user-1",
      }),
    ).toBe("refresh_signed_in");
  });

  it("reinitializes when a sign-in event changes users or no user is loaded", () => {
    expect(
      resolveAuthStateChangeAction({
        event: "SIGNED_IN",
        currentUserId: null,
        sessionUserId: "user-1",
      }),
    ).toBe("initialize");
    expect(
      resolveAuthStateChangeAction({
        event: "SIGNED_IN",
        currentUserId: "user-1",
        sessionUserId: "user-2",
      }),
    ).toBe("initialize");
  });

  it("ignores non-sign-in auth churn and reinitializes on sign-out", () => {
    expect(
      resolveAuthStateChangeAction({
        event: "SIGNED_OUT",
        currentUserId: "user-1",
        sessionUserId: null,
      }),
    ).toBe("initialize");
    expect(
      resolveAuthStateChangeAction({
        event: "INITIAL_SESSION",
        currentUserId: "user-1",
        sessionUserId: "user-1",
      }),
    ).toBe("ignore");
    expect(
      resolveAuthStateChangeAction({
        event: "TOKEN_REFRESHED",
        currentUserId: "user-1",
        sessionUserId: "user-1",
      }),
    ).toBe("ignore");
  });

  it("reuses the same in-flight starter bootstrap for a user", async () => {
    const pending = new Map<string, Promise<string>>();
    const action = vi.fn(async () => {
      await Promise.resolve();
      return "starter-trip";
    });

    const [first, second] = await Promise.all([
      withPerUserLock(pending, "user-1", action),
      withPerUserLock(pending, "user-1", action),
    ]);

    expect(first).toBe("starter-trip");
    expect(second).toBe("starter-trip");
    expect(action).toHaveBeenCalledTimes(1);
    expect(pending.size).toBe(0);
  });
});
