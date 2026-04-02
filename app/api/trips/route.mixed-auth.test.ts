import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createBlankTrip } from "@/lib/tripFactories";

describe("/api/trips mixed auth mode", () => {
  const originalBypass = process.env.E2E_AUTH_BYPASS;
  const originalPublicUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const originalAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const originalServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  beforeEach(() => {
    vi.resetModules();
    process.env.E2E_AUTH_BYPASS = "1";
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon-key";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-key";
  });

  afterEach(() => {
    process.env.E2E_AUTH_BYPASS = originalBypass;
    process.env.NEXT_PUBLIC_SUPABASE_URL = originalPublicUrl;
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = originalAnonKey;
    process.env.SUPABASE_SERVICE_ROLE_KEY = originalServiceRoleKey;
    vi.restoreAllMocks();
    vi.doUnmock("@/lib/supabase");
  });

  it("uses the Supabase path for real bearer tokens even when e2e bypass is enabled", async () => {
    const supabaseTrip = createBlankTrip("supabase-user", {
      name: "Cloud-backed trip",
      home: {
        label: "Aberdeen, Scotland",
        coordinates: { lat: 57.1497, lng: -2.0943 },
      },
    });

    const query = {
      select: vi.fn(() => query),
      eq: vi.fn(() => query),
      order: vi.fn(async () => ({
        data: [
          {
            trip_id: supabaseTrip.id,
            trip_name: supabaseTrip.name,
            version: 3,
            updated_at: "2026-04-01T12:00:00.000Z",
            last_synced_at: "2026-04-01T12:00:00.000Z",
          },
        ],
        error: null,
      })),
    };

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
      isSupabaseServerConfigured: vi.fn(() => true),
      createServerSupabaseAuthClient: vi.fn(() => ({
        auth: {
          getUser,
        },
      })),
      createServerSupabaseServiceClient: vi.fn(() => ({
        from: vi.fn(() => query),
      })),
    }));

    const { GET } = await import("@/app/api/trips/route");
    const response = await GET(
      new Request("http://localhost:3000/api/trips", {
        headers: {
          Authorization: "Bearer real-supabase-jwt",
        },
      }) as never,
    );
    const payload = (await response.json()) as {
      trips: Array<{
        id: string;
        name: string;
      }>;
    };

    expect(response.status).toBe(200);
    expect(payload.trips).toEqual([
      expect.objectContaining({
        id: supabaseTrip.id,
        name: "Cloud-backed trip",
      }),
    ]);
    expect(getUser).toHaveBeenCalledWith("real-supabase-jwt");
  });
});
