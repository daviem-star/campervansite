import { NextRequest, NextResponse } from "next/server";

import { GeocodeResult } from "@/types/trip";

type CacheEntry = {
  expiresAt: number;
  data: GeocodeResult[];
};

const CACHE_TTL_MS = 5 * 60 * 1000;
const cache = new Map<string, CacheEntry>();
let lastNominatimCall = 0;

const sleep = async (ms: number): Promise<void> => {
  await new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
};

const normalizeQuery = (value: string): string => value.trim().replace(/\s+/g, " ");

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const q = normalizeQuery(searchParams.get("q") ?? "");

  if (q.length < 2) {
    return NextResponse.json({ error: "Query must be at least 2 characters." }, { status: 400 });
  }

  const cacheKey = q.toLowerCase();
  const cached = cache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return NextResponse.json(cached.data);
  }

  const elapsed = Date.now() - lastNominatimCall;
  if (elapsed < 1000) {
    await sleep(1000 - elapsed);
  }

  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("q", q);
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("addressdetails", "1");
  url.searchParams.set("countrycodes", "gb");
  url.searchParams.set("limit", "8");

  lastNominatimCall = Date.now();

  try {
    const response = await fetch(url.toString(), {
      headers: {
        "User-Agent": "CampervanTripPlanner/1.0 (personal-project)",
        "Accept-Language": "en-GB",
      },
      next: { revalidate: 300 },
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: "Failed to search location at the moment." },
        { status: 502 },
      );
    }

    const raw = (await response.json()) as Array<{
      display_name: string;
      lat: string;
      lon: string;
      osm_id?: string;
      osm_type?: string;
    }>;

    const data: GeocodeResult[] = raw
      .map((item) => ({
        label: item.display_name,
        lat: Number(item.lat),
        lng: Number(item.lon),
        osmId: item.osm_id,
        osmType: item.osm_type,
      }))
      .filter((item) => Number.isFinite(item.lat) && Number.isFinite(item.lng));

    cache.set(cacheKey, {
      data,
      expiresAt: Date.now() + CACHE_TTL_MS,
    });

    return NextResponse.json(data);
  } catch {
    return NextResponse.json(
      { error: "Unable to connect to geocoding service." },
      { status: 502 },
    );
  }
}
