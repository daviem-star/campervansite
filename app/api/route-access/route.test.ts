import { afterEach, describe, expect, it, vi } from "vitest";

import { POST } from "@/app/api/route-access/route";
import { clearRouteAccessCache } from "@/lib/routeAccess";

const buildRequest = (place?: Record<string, unknown>) =>
  new Request("http://localhost:3000/api/route-access", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      place,
    }),
  });

describe("/api/route-access", () => {
  const originalFetch = global.fetch;
  const originalOrsKey = process.env.OPENROUTESERVICE_API_KEY;

  afterEach(() => {
    clearRouteAccessCache();
    global.fetch = originalFetch;
    process.env.OPENROUTESERVICE_API_KEY = originalOrsKey;
    vi.restoreAllMocks();
  });

  it("returns snapped routing coordinates when ors snapping succeeds", async () => {
    process.env.OPENROUTESERVICE_API_KEY = "test-key";
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        locations: [
          {
            location: [-7.4472, 57.0358],
            snapped_distance: 112.4,
          },
        ],
      }),
    }) as typeof fetch;

    const response = await POST(
      buildRequest({
        label: "Barra Sands Campsite",
        coordinates: { lat: 57.04, lng: -7.458 },
      }) as never,
    );
    const payload = (await response.json()) as {
      place: {
        coordinates: { lat: number; lng: number };
        routingCoordinates?: { lat: number; lng: number };
      };
    };

    expect(response.status).toBe(200);
    expect(payload.place).toEqual({
      coordinates: { lat: 57.04, lng: -7.458 },
      label: "Barra Sands Campsite",
      routingCoordinates: { lat: 57.0358, lng: -7.4472 },
    });
  });

  it("returns the original place when routing access cannot be resolved", async () => {
    process.env.OPENROUTESERVICE_API_KEY = "test-key";
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        locations: [null],
      }),
    }) as typeof fetch;

    const response = await POST(
      buildRequest({
        label: "Remote Beach",
        coordinates: { lat: 56.9247, lng: -7.5464 },
      }) as never,
    );
    const payload = (await response.json()) as {
      place: {
        coordinates: { lat: number; lng: number };
        routingCoordinates?: { lat: number; lng: number };
      };
    };

    expect(response.status).toBe(200);
    expect(payload.place).toEqual({
      coordinates: { lat: 56.9247, lng: -7.5464 },
      label: "Remote Beach",
    });
  });

  it("preserves existing routing coordinates without calling ors again", async () => {
    process.env.OPENROUTESERVICE_API_KEY = "test-key";
    global.fetch = vi.fn() as typeof fetch;

    const response = await POST(
      buildRequest({
        label: "Camp",
        coordinates: { lat: 57.04, lng: -7.458 },
        routingCoordinates: { lat: 57.0358, lng: -7.4472 },
      }) as never,
    );
    const payload = (await response.json()) as {
      place: {
        routingCoordinates?: { lat: number; lng: number };
      };
    };

    expect(response.status).toBe(200);
    expect(payload.place.routingCoordinates).toEqual({ lat: 57.0358, lng: -7.4472 });
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("rejects invalid requests", async () => {
    const response = await POST(buildRequest({ label: "", coordinates: null }) as never);
    const payload = (await response.json()) as { error: string };

    expect(response.status).toBe(400);
    expect(payload.error).toMatch(/valid place/i);
  });
});
