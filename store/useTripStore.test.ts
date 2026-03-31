import { describe, expect, it, vi } from "vitest";

import { shouldReinitializeFromAuthEvent, withPerUserLock } from "@/store/useTripStore";

describe("useTripStore auth bootstrap guards", () => {
  it("only reinitializes for real sign-in state changes", () => {
    expect(shouldReinitializeFromAuthEvent("SIGNED_IN")).toBe(true);
    expect(shouldReinitializeFromAuthEvent("SIGNED_OUT")).toBe(true);
    expect(shouldReinitializeFromAuthEvent("INITIAL_SESSION")).toBe(false);
    expect(shouldReinitializeFromAuthEvent("TOKEN_REFRESHED")).toBe(false);
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
