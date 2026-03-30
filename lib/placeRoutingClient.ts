import { normalizePlaceRef } from "@/lib/placeRouting";
import { PlaceRef } from "@/types/trip";

type RouteAccessResponse = {
  place?: PlaceRef;
};

export const ensurePlaceRoutingCoordinates = async (place: PlaceRef): Promise<PlaceRef> => {
  const normalizedPlace = normalizePlaceRef(place);
  if (normalizedPlace.routingCoordinates) {
    return normalizedPlace;
  }

  try {
    const response = await fetch("/api/route-access", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        place: normalizedPlace,
      }),
    });

    const payload = (await response.json().catch(() => null)) as RouteAccessResponse | null;
    if (!response.ok || !payload?.place) {
      return normalizedPlace;
    }

    return normalizePlaceRef(payload.place);
  } catch {
    return normalizedPlace;
  }
};
