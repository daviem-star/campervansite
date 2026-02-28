"use client";

import { useCallback, useEffect, useMemo, useRef } from "react";
import maplibregl, { GeoJSONSource, LngLatBounds } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

import { formatDateOnly, formatDateTime } from "@/lib/date";
import { findStopById } from "@/lib/tripDerived";
import { MapMarker, MapSegment, SelectedEntity, StopType, Trip } from "@/types/trip";

const MAP_STYLE: maplibregl.StyleSpecification = {
  version: 8,
  sources: {
    osm: {
      type: "raster",
      tiles: [
        "https://a.tile.openstreetmap.org/{z}/{x}/{y}.png",
        "https://b.tile.openstreetmap.org/{z}/{x}/{y}.png",
        "https://c.tile.openstreetmap.org/{z}/{x}/{y}.png",
      ],
      tileSize: 256,
      attribution: "&copy; OpenStreetMap contributors",
    },
  },
  layers: [
    {
      id: "osm",
      type: "raster",
      source: "osm",
      minzoom: 0,
      maxzoom: 22,
    },
  ],
};

const OVERVIEW_MAX_ZOOM = 10;
const OVERVIEW_DURATION_MS = 680;

type PlannerMapProps = {
  trip: Trip;
  markers: MapMarker[];
  segments: MapSegment[];
  selectedEntity: SelectedEntity;
  onSelectEntity: (entity: Exclude<SelectedEntity, null>) => void;
  className?: string;
  isVisible?: boolean;
};

const isSameEntity = (markerOrSegment: { stopId?: string; entityKind?: StopType }, selected: SelectedEntity) => {
  if (!selected) {
    return false;
  }

  return (
    markerOrSegment.stopId === selected.stopId &&
    markerOrSegment.entityKind === selected.kind
  );
};

const escapeHtml = (value: string): string =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");

const popupIconSvg = (kind: StopType): string => {
  const color = kind === "stay" ? "#047857" : kind === "ferry" ? "#0e7490" : "#c2410c";

  if (kind === "stay") {
    return `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M4 18h16" stroke="${color}" stroke-width="1.8" stroke-linecap="round"/><path d="M6 18V10.8c0-.4.3-.8.8-.8h2.5c.3 0 .6-.1.8-.4l1.3-1.8c.3-.4.9-.4 1.2 0l1.3 1.8c.2.3.5.4.8.4h2.5c.5 0 .8.4.8.8V18" stroke="${color}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
  }

  if (kind === "ferry") {
    return `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M5 11h14" stroke="${color}" stroke-width="1.8" stroke-linecap="round"/><path d="M7 11l1.5-4h7L17 11" stroke="${color}" stroke-width="1.8" stroke-linejoin="round"/><path d="M4 16c1 .9 2 .9 3 0 1 .9 2 .9 3 0 1 .9 2 .9 3 0 1 .9 2 .9 3 0 1 .9 2 .9 3 0" stroke="${color}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
  }

  return `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M12 20s6-5.1 6-10a6 6 0 10-12 0c0 4.9 6 10 6 10z" stroke="${color}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><circle cx="12" cy="10" r="2" stroke="${color}" stroke-width="1.8"/></svg>`;
};

const entityLabel = (kind: StopType): string => {
  if (kind === "stay") {
    return "Campsite";
  }
  if (kind === "ferry") {
    return "Ferry";
  }
  return "POI";
};

const buildPopupHtml = (trip: Trip, selectedEntity: Exclude<SelectedEntity, null>): string => {
  const stop = findStopById(trip, selectedEntity.stopId);
  if (!stop) {
    return `<div style="padding:8px;font:12px sans-serif;color:#334155;">Item not found.</div>`;
  }

  if (stop.type === "stay") {
    return `
      <div style="min-width:220px;padding:4px 2px;font-family:system-ui,sans-serif;">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;">
          ${popupIconSvg("stay")}
          <div>
            <div style="font-weight:700;color:#0f172a;">${escapeHtml(stop.title)}</div>
            <div style="font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:.04em;">${entityLabel("stay")}</div>
          </div>
        </div>
        <div style="font-size:12px;color:#334155;line-height:1.35;">${escapeHtml(stop.place.label)}</div>
        <div style="margin-top:6px;font-size:12px;color:#475569;">Check-in: ${escapeHtml(formatDateTime(stop.checkInAt))}</div>
        <div style="font-size:12px;color:#475569;">Check-out: ${escapeHtml(formatDateTime(stop.checkOutAt))}</div>
      </div>`;
  }

  if (stop.type === "ferry") {
    return `
      <div style="min-width:240px;padding:4px 2px;font-family:system-ui,sans-serif;">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;">
          ${popupIconSvg("ferry")}
          <div>
            <div style="font-weight:700;color:#0f172a;">${escapeHtml(stop.title)}</div>
            <div style="font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:.04em;">${entityLabel("ferry")}</div>
          </div>
        </div>
        <div style="font-size:12px;color:#334155;line-height:1.35;">${escapeHtml(stop.departurePort.label)} to ${escapeHtml(stop.arrivalPort.label)}</div>
        <div style="margin-top:6px;font-size:12px;color:#475569;">Departure: ${escapeHtml(formatDateTime(stop.departureAt))}</div>
        <div style="font-size:12px;color:#475569;">Arrival: ${escapeHtml(formatDateTime(stop.arrivalAt))}</div>
        <div style="font-size:12px;color:#475569;">Check-in by: ${escapeHtml(formatDateTime(stop.checkInBy))}</div>
      </div>`;
  }

  return `
    <div style="min-width:220px;padding:4px 2px;font-family:system-ui,sans-serif;">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;">
        ${popupIconSvg("point_of_interest")}
        <div>
          <div style="font-weight:700;color:#0f172a;">${escapeHtml(stop.title)}</div>
          <div style="font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:.04em;">${entityLabel("point_of_interest")}</div>
        </div>
      </div>
      <div style="font-size:12px;color:#334155;line-height:1.35;">${escapeHtml(stop.place.label)}</div>
      <div style="margin-top:6px;font-size:12px;color:#475569;">Visit date: ${escapeHtml(formatDateOnly(stop.visitDate))}</div>
    </div>`;
};

const selectedTitle = (trip: Trip, selectedEntity: SelectedEntity): string | null => {
  if (!selectedEntity) {
    return null;
  }

  const stop = findStopById(trip, selectedEntity.stopId);
  return stop ? stop.title : null;
};

export default function PlannerMap({
  trip,
  markers,
  segments,
  selectedEntity,
  onSelectEntity,
  className,
  isVisible = true,
}: PlannerMapProps) {
  const mapCanvasRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const popupRef = useRef<maplibregl.Popup | null>(null);
  const onSelectEntityRef = useRef(onSelectEntity);
  const tripRef = useRef(trip);
  const markersRef = useRef(markers);
  const segmentsRef = useRef(segments);

  useEffect(() => {
    onSelectEntityRef.current = onSelectEntity;
    tripRef.current = trip;
    markersRef.current = markers;
    segmentsRef.current = segments;
  }, [markers, onSelectEntity, segments, trip]);

  const geometrySignature = useMemo(
    () =>
      `${markers
        .map((marker) => `${marker.id}:${marker.coordinates.lat.toFixed(5)}:${marker.coordinates.lng.toFixed(5)}`)
        .join("|")}::${segments
        .map((segment) => `${segment.id}:${segment.from.lat.toFixed(5)}:${segment.to.lat.toFixed(5)}`)
        .join("|")}`,
    [markers, segments],
  );

  const markerFeatureCollection = useMemo<GeoJSON.FeatureCollection<GeoJSON.Point>>(
    () => ({
      type: "FeatureCollection",
      features: markers.map((marker) => ({
        type: "Feature",
        properties: {
          id: marker.id,
          role: marker.role,
          label: marker.label,
          stopId: marker.stopId ?? "",
          entityKind: marker.entityKind ?? "",
          ferryPart: marker.ferryPart ?? "",
          isSelected: isSameEntity(marker, selectedEntity),
        },
        geometry: {
          type: "Point",
          coordinates: [marker.coordinates.lng, marker.coordinates.lat],
        },
      })),
    }),
    [markers, selectedEntity],
  );

  const segmentFeatureCollection = useMemo<GeoJSON.FeatureCollection<GeoJSON.LineString>>(
    () => ({
      type: "FeatureCollection",
      features: segments.map((segment) => ({
        type: "Feature",
        properties: {
          id: segment.id,
          type: segment.type,
          stopId: segment.stopId ?? "",
          entityKind: segment.entityKind ?? "",
          isSelected: isSameEntity(segment, selectedEntity) && segment.type === "ferry",
        },
        geometry: {
          type: "LineString",
          coordinates: [
            [segment.from.lng, segment.from.lat],
            [segment.to.lng, segment.to.lat],
          ],
        },
      })),
    }),
    [segments, selectedEntity],
  );

  const markerFeatureCollectionRef = useRef(markerFeatureCollection);
  const segmentFeatureCollectionRef = useRef(segmentFeatureCollection);
  const pendingMapClickAnchorRef = useRef<maplibregl.LngLatLike | null>(null);
  const geometrySignatureRef = useRef(geometrySignature);
  const fittedGeometrySignatureRef = useRef<string | null>(null);

  useEffect(() => {
    markerFeatureCollectionRef.current = markerFeatureCollection;
    segmentFeatureCollectionRef.current = segmentFeatureCollection;
  }, [markerFeatureCollection, segmentFeatureCollection]);

  useEffect(() => {
    geometrySignatureRef.current = geometrySignature;
  }, [geometrySignature]);

  const fitOverview = useCallback((map: maplibregl.Map) => {
    if (markersRef.current.length === 0) {
      return;
    }

    const bounds = new LngLatBounds();
    markersRef.current.forEach((marker) => {
      bounds.extend([marker.coordinates.lng, marker.coordinates.lat]);
    });

    if (bounds.isEmpty()) {
      return;
    }

    const camera = map.cameraForBounds(bounds, {
      padding: 60,
      maxZoom: OVERVIEW_MAX_ZOOM,
    });

    if (!camera || !camera.center) {
      map.fitBounds(bounds, {
        padding: 60,
        maxZoom: OVERVIEW_MAX_ZOOM,
        duration: OVERVIEW_DURATION_MS,
      });
      return;
    }

    map.easeTo({
      center: camera.center,
      zoom: camera.zoom ?? OVERVIEW_MAX_ZOOM,
      duration: OVERVIEW_DURATION_MS,
      essential: true,
    });
  }, []);

  const openPopupForSelection = (
    map: maplibregl.Map,
    selection: Exclude<SelectedEntity, null>,
    anchor: maplibregl.LngLatLike,
  ) => {
    const html = buildPopupHtml(tripRef.current, selection);

    popupRef.current?.remove();
    popupRef.current = new maplibregl.Popup({ closeButton: false, closeOnClick: false, offset: 10 })
      .setLngLat(anchor)
      .setHTML(html)
      .addTo(map);
  };

  useEffect(() => {
    if (!mapCanvasRef.current || mapRef.current) {
      return;
    }

    const map = new maplibregl.Map({
      container: mapCanvasRef.current,
      style: MAP_STYLE,
      center: [-6.0, 57.2],
      zoom: 6,
      cooperativeGestures: true,
    });

    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");

    map.on("load", () => {
      map.addSource("markers", {
        type: "geojson",
        data: markerFeatureCollectionRef.current,
      });

      map.addSource("segments", {
        type: "geojson",
        data: segmentFeatureCollectionRef.current,
      });

      map.addLayer({
        id: "road-segments",
        type: "line",
        source: "segments",
        filter: ["==", ["get", "type"], "road"],
        paint: {
          "line-color": "#64748b",
          "line-width": 2.5,
          "line-opacity": 0.65,
        },
      });

      map.addLayer({
        id: "ferry-segments",
        type: "line",
        source: "segments",
        filter: ["==", ["get", "type"], "ferry"],
        paint: {
          "line-color": "#0891b2",
          "line-width": 3.5,
          "line-dasharray": [2, 2],
          "line-opacity": 0.9,
        },
      });

      map.addLayer({
        id: "selected-ferry-segments",
        type: "line",
        source: "segments",
        filter: ["all", ["==", ["get", "type"], "ferry"], ["==", ["get", "isSelected"], true]],
        paint: {
          "line-color": "#0369a1",
          "line-width": 6,
          "line-dasharray": [2, 1.5],
          "line-opacity": 0.95,
        },
      });

      map.addLayer({
        id: "ferry-segments-hit",
        type: "line",
        source: "segments",
        filter: ["==", ["get", "type"], "ferry"],
        paint: {
          "line-color": "#000000",
          "line-opacity": 0,
          "line-width": 12,
        },
      });

      map.addLayer({
        id: "markers-base",
        type: "circle",
        source: "markers",
        paint: {
          "circle-radius": [
            "match",
            ["get", "role"],
            "home",
            8,
            "ferry_port",
            7,
            6,
          ],
          "circle-color": [
            "match",
            ["get", "role"],
            "home",
            "#111827",
            "stay",
            "#16a34a",
            "poi",
            "#f97316",
            "ferry_port",
            "#0ea5e9",
            "#6366f1",
          ],
          "circle-stroke-width": 2,
          "circle-stroke-color": "#ffffff",
        },
      });

      map.addLayer({
        id: "markers-selected",
        type: "circle",
        source: "markers",
        filter: ["==", ["get", "isSelected"], true],
        paint: {
          "circle-radius": [
            "match",
            ["get", "role"],
            "ferry_port",
            11,
            "home",
            12,
            10,
          ],
          "circle-color": "rgba(14,165,233,0.18)",
          "circle-stroke-color": "#0284c7",
          "circle-stroke-width": 2,
        },
      });

      map.addLayer({
        id: "markers-hit",
        type: "circle",
        source: "markers",
        paint: {
          "circle-radius": 14,
          "circle-color": "#000000",
          "circle-opacity": 0,
        },
      });

      map.addLayer({
        id: "marker-labels",
        type: "symbol",
        source: "markers",
        layout: {
          "text-field": ["get", "label"],
          "text-size": 11,
          "text-anchor": "top",
          "text-offset": [0, 1.1],
          "text-font": ["Noto Sans Regular"],
          "text-max-width": 12,
        },
        paint: {
          "text-color": "#1f2937",
          "text-halo-color": "#ffffff",
          "text-halo-width": 1,
        },
      });

      map.on("mouseenter", "markers-hit", () => {
        map.getCanvas().style.cursor = "pointer";
      });
      map.on("mouseleave", "markers-hit", () => {
        map.getCanvas().style.cursor = "";
      });
      map.on("mouseenter", "ferry-segments-hit", () => {
        map.getCanvas().style.cursor = "pointer";
      });
      map.on("mouseleave", "ferry-segments-hit", () => {
        map.getCanvas().style.cursor = "";
      });

      map.on("click", "markers-hit", (event) => {
        const feature = event.features?.[0];
        const stopId = feature?.properties?.stopId;
        const entityKind = feature?.properties?.entityKind;
        if (!stopId || !entityKind) {
          return;
        }
        if (entityKind !== "stay" && entityKind !== "ferry" && entityKind !== "point_of_interest") {
          return;
        }

        const nextSelection = { kind: entityKind, stopId } as Exclude<SelectedEntity, null>;
        pendingMapClickAnchorRef.current = event.lngLat;
        onSelectEntityRef.current(nextSelection);
      });

      map.on("click", "ferry-segments-hit", (event) => {
        const feature = event.features?.[0];
        const stopId = feature?.properties?.stopId;
        if (!stopId) {
          return;
        }

        const nextSelection: Exclude<SelectedEntity, null> = { kind: "ferry", stopId };
        pendingMapClickAnchorRef.current = event.lngLat;
        onSelectEntityRef.current(nextSelection);
      });

      fitOverview(map);
      fittedGeometrySignatureRef.current = geometrySignatureRef.current;
    });

    mapRef.current = map;

    return () => {
      popupRef.current?.remove();
      popupRef.current = null;
      map.remove();
      mapRef.current = null;
    };
  }, [fitOverview]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) {
      return;
    }

    const markerSource = map.getSource("markers") as GeoJSONSource | undefined;
    const segmentSource = map.getSource("segments") as GeoJSONSource | undefined;
    markerSource?.setData(markerFeatureCollection);
    segmentSource?.setData(segmentFeatureCollection);
  }, [markerFeatureCollection, segmentFeatureCollection]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) {
      return;
    }

    if (fittedGeometrySignatureRef.current === geometrySignature) {
      return;
    }

    fitOverview(map);
    fittedGeometrySignatureRef.current = geometrySignature;
    // geometrySignature intentionally excludes selection flags so the map does not re-fit on selection.
  }, [fitOverview, geometrySignature]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) {
      return;
    }

    if (isVisible) {
      map.resize();
    }
  }, [isVisible]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) {
      return;
    }

    if (!selectedEntity) {
      popupRef.current?.remove();
      popupRef.current = null;
      pendingMapClickAnchorRef.current = null;
      return;
    }

    const clickAnchor = pendingMapClickAnchorRef.current;
    if (!clickAnchor) {
      popupRef.current?.remove();
      popupRef.current = null;
      pendingMapClickAnchorRef.current = null;
      return;
    }

    openPopupForSelection(map, selectedEntity, clickAnchor);
    pendingMapClickAnchorRef.current = null;
  }, [selectedEntity, trip]);

  const currentSelectionTitle = selectedTitle(trip, selectedEntity);

  return (
    <div className={`relative overflow-hidden ${className ?? ""}`}>
      <div ref={mapCanvasRef} className="h-full w-full" aria-label="Trip map" />

      <div className="pointer-events-none absolute left-3 right-3 top-3 z-10 flex items-start justify-between gap-3">
        <div className="pointer-events-auto flex items-center gap-2 rounded-xl border border-slate-200 bg-white/95 p-2 shadow-sm backdrop-blur">
          <button
            type="button"
            onClick={() => {
              const map = mapRef.current;
              if (map) {
                fitOverview(map);
                popupRef.current?.remove();
                popupRef.current = null;
              }
            }}
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-100"
          >
            Reset Map
          </button>
        </div>

        {currentSelectionTitle ? (
          <div className="pointer-events-auto rounded-xl border border-sky-200 bg-white/95 px-3 py-2 text-xs text-slate-700 shadow-sm backdrop-blur">
            <p className="font-semibold text-slate-900">Selected</p>
            <p>{currentSelectionTitle}</p>
          </div>
        ) : null}
      </div>
    </div>
  );
}
