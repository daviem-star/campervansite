import { afterEach, describe, expect, it, vi } from "vitest";

import { POST } from "@/app/api/route-estimates/route";

const buildRequest = (debugHeader?: string) =>
  new Request("http://localhost:3000/api/route-estimates", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(debugHeader ? { "x-route-debug": debugHeader } : {}),
    },
    body: JSON.stringify({
      legs: [
        {
          id: "leg-1",
          fromId: "home",
          fromLabel: "Home",
          toId: "stay-1",
          toLabel: "Camp one",
          date: "2026-04-03",
          relatedStopId: "stay-1",
          from: { lat: 56, lng: -4 },
          to: { lat: 56.2, lng: -4.1 },
        },
      ],
    }),
  });

describe("/api/route-estimates", () => {
  const originalFetch = global.fetch;
  const originalOrsKey = process.env.OPENROUTESERVICE_API_KEY;
  const originalDebugFlag = process.env.NEXT_PUBLIC_OPENROUTESERVICE_DEBUG;

  afterEach(() => {
    global.fetch = originalFetch;
    process.env.OPENROUTESERVICE_API_KEY = originalOrsKey;
    process.env.NEXT_PUBLIC_OPENROUTESERVICE_DEBUG = originalDebugFlag;
    vi.restoreAllMocks();
  });

  it("keeps the existing response shape when debug mode is off", async () => {
    process.env.OPENROUTESERVICE_API_KEY = "test-key";
    process.env.NEXT_PUBLIC_OPENROUTESERVICE_DEBUG = "0";

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        features: [
          {
            geometry: {
              coordinates: [
                [-4, 56],
                [-4.05, 56.1],
                [-4.1, 56.2],
              ],
            },
            properties: {
              summary: {
                distance: 12345,
                duration: 3600,
              },
            },
          },
        ],
      }),
    }) as typeof fetch;

    const response = await POST(buildRequest() as never);
    const payload = (await response.json()) as Record<string, unknown>;

    expect(response.status).toBe(200);
    expect(payload.estimates).toBeDefined();
    expect(payload.debug).toBeUndefined();
    expect(
      (
        payload.estimates as Array<{
          provider: string;
          confidence: string;
          geometry?: { type: string; coordinates: Array<{ lat: number; lng: number }> };
        }>
      )[0],
    ).toMatchObject({
      provider: "openrouteservice_driving_car",
      confidence: "live",
      geometry: {
        type: "LineString",
        coordinates: [
          { lat: 56, lng: -4 },
          { lat: 56.1, lng: -4.05 },
          { lat: 56.2, lng: -4.1 },
        ],
      },
    });
  });

  it("returns fallback timings without geometry when the ors api key is missing", async () => {
    delete process.env.OPENROUTESERVICE_API_KEY;
    process.env.NEXT_PUBLIC_OPENROUTESERVICE_DEBUG = "1";

    const fetchSpy = vi.fn();
    global.fetch = fetchSpy as typeof fetch;

    const response = await POST(buildRequest("1") as never);
    const payload = (await response.json()) as {
      estimates: Array<{ provider: string; confidence: string; geometry?: unknown }>;
    };

    expect(response.status).toBe(200);
    expect(payload.estimates[0]).toMatchObject({
      provider: "fallback_haversine",
      confidence: "fallback",
    });
    expect(payload.estimates[0]?.geometry).toBeUndefined();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("includes debug details and maps non-ok ors responses to fallback reasons", async () => {
    process.env.OPENROUTESERVICE_API_KEY = "test-key";
    process.env.NEXT_PUBLIC_OPENROUTESERVICE_DEBUG = "1";

    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 403,
      text: async () => '{"error":"forbidden"}',
    }) as typeof fetch;

    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    const response = await POST(buildRequest("1") as never);
    const payload = (await response.json()) as {
      estimates: Array<{ provider: string; confidence: string }>;
      debug: {
        enabled: boolean;
        cacheStatus: string;
        legs: Array<{
          orsStatus: number | null;
          fallbackReason: string;
          providerReturned: string;
          responseBodyExcerpt?: string;
        }>;
      };
    };

    expect(payload.estimates[0]).toMatchObject({
      provider: "fallback_haversine",
      confidence: "fallback",
    });
    expect(payload.estimates[0]?.geometry).toBeUndefined();
    expect(payload.debug).toMatchObject({
      enabled: true,
      cacheStatus: "bypassed",
    });
    expect(payload.debug.legs[0]).toMatchObject({
      orsStatus: 403,
      fallbackReason: "ors_non_ok",
      providerReturned: "fallback_haversine",
    });
    expect(payload.debug.legs[0].responseBodyExcerpt).toContain("forbidden");
    expect(warnSpy).toHaveBeenCalled();
  });

  it("maps invalid ors payloads to the expected fallback reason in debug mode", async () => {
    process.env.OPENROUTESERVICE_API_KEY = "test-key";
    process.env.NEXT_PUBLIC_OPENROUTESERVICE_DEBUG = "1";

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        features: [
          {
            properties: {
              summary: {
                distance: null,
              },
            },
          },
        ],
      }),
    }) as typeof fetch;

    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    const response = await POST(buildRequest("1") as never);
    const payload = (await response.json()) as {
      debug: {
        legs: Array<{
          orsStatus: number | null;
          fallbackReason: string;
          providerReturned: string;
        }>;
      };
    };

    expect(payload.debug.legs[0]).toMatchObject({
      orsStatus: 200,
      fallbackReason: "ors_invalid_payload",
      providerReturned: "fallback_haversine",
    });
    expect(warnSpy).toHaveBeenCalled();
  });

  it("maps ors code 2010 responses to unroutable-point fallback reasons in debug mode", async () => {
    process.env.OPENROUTESERVICE_API_KEY = "test-key";
    process.env.NEXT_PUBLIC_OPENROUTESERVICE_DEBUG = "1";

    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
      text: async () =>
        JSON.stringify({
          error: {
            code: 2010,
            message: "Could not find routable point within a radius of 350.0 meters.",
          },
        }),
    }) as typeof fetch;

    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    const response = await POST(buildRequest("1") as never);
    const payload = (await response.json()) as {
      debug: {
        legs: Array<{
          orsStatus: number | null;
          fallbackReason: string;
          providerReturned: string;
        }>;
      };
    };

    expect(payload.debug.legs[0]).toMatchObject({
      orsStatus: 404,
      fallbackReason: "ors_unroutable_point",
      providerReturned: "fallback_haversine",
    });
    expect(warnSpy).toHaveBeenCalled();
  });
});
