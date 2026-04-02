import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createE2EAccessToken } from "@/lib/e2eAuth";
import { SessionUser } from "@/types/trip";

const buildRequest = (token: string | null) =>
  new Request("http://localhost:3000/api/trips", {
    headers: token
      ? {
          Authorization: `Bearer ${token}`,
        }
      : {},
  });

describe("api auth resolution", () => {
  const originalBypass = process.env.E2E_AUTH_BYPASS;
  const originalPublicUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const originalAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    process.env.E2E_AUTH_BYPASS = originalBypass;
    process.env.NEXT_PUBLIC_SUPABASE_URL = originalPublicUrl;
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = originalAnonKey;
    vi.restoreAllMocks();
    vi.doUnmock("@/lib/supabase");
  });

  it("resolves an e2e token to e2e mode when bypass is enabled", async () => {
    process.env.E2E_AUTH_BYPASS = "1";
    const user: SessionUser = {
      id: "e2e-user",
      email: "e2e@example.com",
    };
    const createServerSupabaseAuthClient = vi.fn();

    vi.doMock("@/lib/supabase", () => ({
      createServerSupabaseAuthClient,
    }));

    const { getAuthenticatedRequest } = await import("@/lib/apiAuth");
    const result = await getAuthenticatedRequest(buildRequest(createE2EAccessToken(user)) as never);

    expect(result).toEqual({
      authMode: "e2e",
      user,
    });
    expect(createServerSupabaseAuthClient).not.toHaveBeenCalled();
  });

  it("resolves a real Supabase token to supabase mode even when bypass is enabled", async () => {
    process.env.E2E_AUTH_BYPASS = "1";
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon-key";

    const getUser = vi.fn(async () => ({
      data: {
        user: {
          id: "supabase-user",
          email: "traveller@example.com",
        },
      },
      error: null,
    }));

    vi.doMock("@/lib/supabase", () => ({
      createServerSupabaseAuthClient: vi.fn(() => ({
        auth: {
          getUser,
        },
      })),
    }));

    const { getAuthenticatedRequest } = await import("@/lib/apiAuth");
    const result = await getAuthenticatedRequest(buildRequest("real-supabase-jwt") as never);

    expect(result).toEqual({
      authMode: "supabase",
      user: {
        id: "supabase-user",
        email: "traveller@example.com",
      },
    });
    expect(getUser).toHaveBeenCalledWith("real-supabase-jwt");
  });

  it("returns null for an invalid bearer token", async () => {
    process.env.E2E_AUTH_BYPASS = "1";

    const getUser = vi.fn(async () => ({
      data: {
        user: null,
      },
      error: new Error("Invalid token"),
    }));

    vi.doMock("@/lib/supabase", () => ({
      createServerSupabaseAuthClient: vi.fn(() => ({
        auth: {
          getUser,
        },
      })),
    }));

    const { getAuthenticatedRequest } = await import("@/lib/apiAuth");
    const result = await getAuthenticatedRequest(buildRequest("not-a-valid-token") as never);

    expect(result).toBeNull();
    expect(getUser).toHaveBeenCalledWith("not-a-valid-token");
  });
});
