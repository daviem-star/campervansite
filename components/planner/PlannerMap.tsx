"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import maplibregl, { GeoJSONSource, LngLatBounds } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

import { formatDateOnly, formatDateTime } from "@/lib/date";
import { findStopById } from "@/lib/tripDerived";
import { MapMarker, MapSegment, SelectedEntity, StopType, Trip } from "@/types/trip";

declare global {
  interface Window {
    __plannerMapRegistry?: Record<
      string,
      Array<{
        getClientPointForEntity: (
          entity: Exclude<SelectedEntity, null>,
        ) => { x: number; y: number } | null;
        selectEntity: (entity: Exclude<SelectedEntity, null>) => void;
      }>
    >;
  }
}

const DEFAULT_MAP_TILE_URL_TEMPLATE = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
const DEFAULT_MAP_TILE_ATTRIBUTION = "&copy; OpenStreetMap contributors";
const MAP_TILE_URL_TEMPLATE =
  process.env.NEXT_PUBLIC_MAP_TILE_URL_TEMPLATE?.trim() || DEFAULT_MAP_TILE_URL_TEMPLATE;
const MAP_TILE_ATTRIBUTION =
  process.env.NEXT_PUBLIC_MAP_TILE_ATTRIBUTION?.trim() || DEFAULT_MAP_TILE_ATTRIBUTION;

const MAP_STYLE: maplibregl.StyleSpecification = {
  version: 8,
  sources: {
    osm: {
      type: "raster",
      tiles: [MAP_TILE_URL_TEMPLATE],
      tileSize: 256,
      attribution: MAP_TILE_ATTRIBUTION,
    },
  },
  layers: [
    {
      id: "osm",
      type: "raster",
      source: "osm",
      minzoom: 0,
      maxzoom: 19,
    },
  ],
};

const DETAIL_ZOOM = 10.5;
const MAP_ZOOM_STEP = 0.8;
const OVERVIEW_DURATION_MS = 680;
const PAN_DURATION_MS = 560;
const ZOOM_DURATION_MS = 620;

type PlannerMapProps = {
  trip: Trip;
  markers: MapMarker[];
  segments: MapSegment[];
  routeSummary: {
    totalRoadLegs: number;
    pendingRoadLegs: number;
    liveRoadLegs: number;
    fallbackRoadLegs: number;
    isRefreshing: boolean;
  };
  selectedEntity: SelectedEntity;
  selectionOrigin?: "itinerary" | "map" | "system";
  onSelectEntity: (entity: Exclude<SelectedEntity, null>) => void;
  className?: string;
  isVisible?: boolean;
  testRegistryKey?: string;
};

const routeChipToneClass = {
  neutral: "border-app-border bg-app-surface/95 text-app-muted",
  warning: "border-brand-secondary/30 bg-brand-secondary/14 text-brand-secondary-variant",
} as const;

const MAP_PALETTE = {
  routeLive: "#163B25",
  routeFallback: "#C97512",
  ferry: "#406174",
  ferrySelected: "#163B25",
  home: "#0E3527",
  stay: "#6A8B2C",
  poi: "#F49727",
  ferryPort: "#406174",
  default: "#163B25",
  selectedFill: "rgba(22, 59, 37, 0.16)",
  selectedStroke: "#163B25",
  label: "#1C241D",
  labelMuted: "#5C6458",
  labelHalo: "#FFFDF7",
} as const;

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
  const color =
    kind === "stay" ? MAP_PALETTE.stay : kind === "ferry" ? MAP_PALETTE.ferry : MAP_PALETTE.poi;

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

const getSegmentGeometryCoordinates = (segment: MapSegment): Array<[number, number]> => {
  if (segment.geometry && segment.geometry.coordinates.length >= 2) {
    return segment.geometry.coordinates.map((coordinate) => [coordinate.lng, coordinate.lat]);
  }

  return [
    [segment.from.lng, segment.from.lat],
    [segment.to.lng, segment.to.lat],
  ];
};

const getSegmentGeometrySignature = (segment: MapSegment): string => {
  return getSegmentGeometryCoordinates(segment)
    .map(([lng, lat]) => `${lat.toFixed(5)}:${lng.toFixed(5)}`)
    .join(">");
};

const buildPopupHtml = (trip: Trip, selectedEntity: Exclude<SelectedEntity, null>): string => {
  const stop = findStopById(trip, selectedEntity.stopId);
  if (!stop) {
    return `<div style="padding:8px;font:12px sans-serif;color:${MAP_PALETTE.labelMuted};">Item not found.</div>`;
  }

  if (stop.type === "stay") {
    return `
      <div style="min-width:220px;padding:4px 2px;font-family:system-ui,sans-serif;">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;">
          ${popupIconSvg("stay")}
          <div>
            <div style="font-weight:700;color:${MAP_PALETTE.label};">${escapeHtml(stop.title)}</div>
            <div style="font-size:11px;color:${MAP_PALETTE.labelMuted};text-transform:uppercase;letter-spacing:.04em;">${entityLabel("stay")}</div>
          </div>
        </div>
        <div style="font-size:12px;color:${MAP_PALETTE.label};line-height:1.35;">${escapeHtml(stop.place.label)}</div>
        <div style="margin-top:6px;font-size:12px;color:${MAP_PALETTE.labelMuted};">Check-in: ${escapeHtml(formatDateTime(stop.checkInAt))}</div>
        <div style="font-size:12px;color:${MAP_PALETTE.labelMuted};">Check-out: ${escapeHtml(formatDateTime(stop.checkOutAt))}</div>
        ${
          stop.notes
            ? `<div style="margin-top:4px;font-size:12px;color:${MAP_PALETTE.labelMuted};">Notes: ${escapeHtml(stop.notes)}</div>`
            : ""
        }
      </div>`;
  }

  if (stop.type === "ferry") {
    return `
      <div style="min-width:240px;padding:4px 2px;font-family:system-ui,sans-serif;">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;">
          ${popupIconSvg("ferry")}
          <div>
            <div style="font-weight:700;color:${MAP_PALETTE.label};">${escapeHtml(stop.title)}</div>
            <div style="font-size:11px;color:${MAP_PALETTE.labelMuted};text-transform:uppercase;letter-spacing:.04em;">${entityLabel("ferry")}</div>
          </div>
        </div>
        <div style="font-size:12px;color:${MAP_PALETTE.label};line-height:1.35;">${escapeHtml(stop.departurePort.label)} to ${escapeHtml(stop.arrivalPort.label)}</div>
        <div style="margin-top:6px;font-size:12px;color:${MAP_PALETTE.labelMuted};">Departure: ${escapeHtml(formatDateTime(stop.departureAt))}</div>
        <div style="font-size:12px;color:${MAP_PALETTE.labelMuted};">Arrival: ${escapeHtml(formatDateTime(stop.arrivalAt))}</div>
        <div style="font-size:12px;color:${MAP_PALETTE.labelMuted};">Check-in by: ${escapeHtml(formatDateTime(stop.checkInBy))}</div>
        ${
          stop.notes
            ? `<div style="margin-top:4px;font-size:12px;color:${MAP_PALETTE.labelMuted};">Notes: ${escapeHtml(stop.notes)}</div>`
            : ""
        }
      </div>`;
  }

  return `
    <div style="min-width:220px;padding:4px 2px;font-family:system-ui,sans-serif;">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;">
        ${popupIconSvg("point_of_interest")}
        <div>
          <div style="font-weight:700;color:${MAP_PALETTE.label};">${escapeHtml(stop.title)}</div>
          <div style="font-size:11px;color:${MAP_PALETTE.labelMuted};text-transform:uppercase;letter-spacing:.04em;">${entityLabel("point_of_interest")}</div>
        </div>
      </div>
      <div style="font-size:12px;color:${MAP_PALETTE.label};line-height:1.35;">${escapeHtml(stop.place.label)}</div>
      <div style="margin-top:6px;font-size:12px;color:${MAP_PALETTE.labelMuted};">Visit date: ${escapeHtml(formatDateOnly(stop.visitDate))}</div>
      ${
        stop.notes
          ? `<div style="margin-top:4px;font-size:12px;color:${MAP_PALETTE.labelMuted};">Notes: ${escapeHtml(stop.notes)}</div>`
          : ""
      }
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
  routeSummary,
  selectedEntity,
  selectionOrigin = "system",
  onSelectEntity,
  className,
  isVisible = true,
  testRegistryKey,
}: PlannerMapProps) {
  const mapCanvasRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const popupRef = useRef<maplibregl.Popup | null>(null);
  const onSelectEntityRef = useRef(onSelectEntity);
  const tripRef = useRef(trip);
  const markersRef = useRef(markers);
  const segmentsRef = useRef(segments);
  const selectedEntityRef = useRef(selectedEntity);
  const selectionOriginRef = useRef(selectionOrigin);
  const [mapError, setMapError] = useState<string | null>(null);

  useEffect(() => {
    onSelectEntityRef.current = onSelectEntity;
    tripRef.current = trip;
    markersRef.current = markers;
    segmentsRef.current = segments;
    selectedEntityRef.current = selectedEntity;
    selectionOriginRef.current = selectionOrigin;
  }, [
    markers,
    onSelectEntity,
    segments,
    selectedEntity,
    selectionOrigin,
    trip,
  ]);

  const geometrySignature = useMemo(
    () =>
      `${markers
        .map((marker) => `${marker.id}:${marker.coordinates.lat.toFixed(5)}:${marker.coordinates.lng.toFixed(5)}`)
        .join("|")}::${segments
        .map((segment) => `${segment.id}:${getSegmentGeometrySignature(segment)}`)
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
          routeStatus: segment.routeStatus ?? "",
          routeConfidence: segment.routeConfidence ?? "",
          isSelected: isSameEntity(segment, selectedEntity) && segment.type === "ferry",
        },
        geometry: {
          type: "LineString",
          coordinates: getSegmentGeometryCoordinates(segment),
        },
      })),
    }),
    [segments, selectedEntity],
  );

  const markerFeatureCollectionRef = useRef(markerFeatureCollection);
  const segmentFeatureCollectionRef = useRef(segmentFeatureCollection);
  const hasFocusedFromOverviewRef = useRef(false);
  const lastSelectionRef = useRef<string | null>(null);
  const lastSelectionOriginRef = useRef<"itinerary" | "map" | "system" | null>(null);
  const pendingMapClickAnchorRef = useRef<maplibregl.LngLatLike | null>(null);

  useEffect(() => {
    markerFeatureCollectionRef.current = markerFeatureCollection;
    segmentFeatureCollectionRef.current = segmentFeatureCollection;
  }, [markerFeatureCollection, segmentFeatureCollection]);

  const getFerryMarkersForStop = useCallback((stopId: string): MapMarker[] => {
    return markersRef.current.filter(
      (marker) => marker.stopId === stopId && marker.entityKind === "ferry",
    );
  }, []);

  const getFerryMidpoint = useCallback(
    (stopId: string): [number, number] | null => {
      const ferryMarkers = getFerryMarkersForStop(stopId);

      if (ferryMarkers.length === 0) {
        return null;
      }

      if (ferryMarkers.length === 1) {
        return [ferryMarkers[0].coordinates.lng, ferryMarkers[0].coordinates.lat];
      }

      return [
        (ferryMarkers[0].coordinates.lng + ferryMarkers[1].coordinates.lng) / 2,
        (ferryMarkers[0].coordinates.lat + ferryMarkers[1].coordinates.lat) / 2,
      ];
    },
    [getFerryMarkersForStop],
  );

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

    map.fitBounds(bounds, {
      padding: { top: 80, right: 80, bottom: 80, left: 80 },
      maxZoom: 8.2,
      duration: OVERVIEW_DURATION_MS,
    });

    hasFocusedFromOverviewRef.current = false;
    lastSelectionRef.current = null;
    lastSelectionOriginRef.current = null;
  }, []);

  const getSelectionCenter = useCallback(
    (selection: Exclude<SelectedEntity, null>): [number, number] | null => {
      if (selection.kind === "ferry") {
        return getFerryMidpoint(selection.stopId);
      }

      const marker = markersRef.current.find(
        (candidate) => candidate.stopId === selection.stopId && candidate.entityKind === selection.kind,
      );

      if (!marker) {
        return null;
      }

      return [marker.coordinates.lng, marker.coordinates.lat];
    },
    [getFerryMidpoint],
  );

  const focusFerryPorts = useCallback(
    (map: maplibregl.Map, stopId: string): boolean => {
      const ferryMarkers = getFerryMarkersForStop(stopId);

      if (ferryMarkers.length === 0) {
        return false;
      }

      if (ferryMarkers.length === 1) {
        map.flyTo({
          center: [ferryMarkers[0].coordinates.lng, ferryMarkers[0].coordinates.lat],
          zoom: Math.max(map.getZoom(), DETAIL_ZOOM),
          duration: ZOOM_DURATION_MS,
          essential: true,
        });
        return true;
      }

      const bounds = new LngLatBounds();
      ferryMarkers.forEach((marker) => bounds.extend([marker.coordinates.lng, marker.coordinates.lat]));
      map.fitBounds(bounds, {
        padding: 100,
        maxZoom: DETAIL_ZOOM,
        duration: ZOOM_DURATION_MS,
      });

      return true;
    },
    [getFerryMarkersForStop],
  );

  const animatePanOnly = useCallback((map: maplibregl.Map, center: [number, number]) => {
    map.flyTo({
      center,
      zoom: map.getZoom(),
      duration: PAN_DURATION_MS,
      essential: true,
    });
  }, []);

  const animatePanZoom = useCallback(
    (map: maplibregl.Map, center: [number, number], targetZoom: number) => {
      map.flyTo({
        center,
        zoom: targetZoom,
        duration: ZOOM_DURATION_MS,
        curve: 1.25,
        speed: 0.9,
        essential: true,
      });
    },
    [],
  );

  const nextMapStepZoom = useCallback((currentZoom: number): number => {
    if (currentZoom >= DETAIL_ZOOM) {
      return currentZoom;
    }

    return Math.min(currentZoom + MAP_ZOOM_STEP, DETAIL_ZOOM);
  }, []);

  const openPopupForSelection = (
    map: maplibregl.Map,
    selection: Exclude<SelectedEntity, null>,
    anchor?: maplibregl.LngLatLike,
  ) => {
    const html = buildPopupHtml(tripRef.current, selection);

    let popupAnchor = anchor;

    if (!popupAnchor) {
      if (selection.kind === "ferry") {
        const ferryMarkers = markersRef.current.filter(
          (marker) => marker.stopId === selection.stopId && marker.entityKind === "ferry",
        );
        if (ferryMarkers.length >= 2) {
          popupAnchor = [
            (ferryMarkers[0].coordinates.lng + ferryMarkers[1].coordinates.lng) / 2,
            (ferryMarkers[0].coordinates.lat + ferryMarkers[1].coordinates.lat) / 2,
          ];
        } else if (ferryMarkers[0]) {
          popupAnchor = [ferryMarkers[0].coordinates.lng, ferryMarkers[0].coordinates.lat];
        }
      } else {
        const marker = markersRef.current.find(
          (candidate) => candidate.stopId === selection.stopId && candidate.entityKind === selection.kind,
        );
        if (marker) {
          popupAnchor = [marker.coordinates.lng, marker.coordinates.lat];
        }
      }
    }

    if (!popupAnchor) {
      return;
    }

    popupRef.current?.remove();
    popupRef.current = new maplibregl.Popup({ closeButton: false, closeOnClick: false, offset: 10 })
      .setLngLat(popupAnchor)
      .setHTML(html)
      .addTo(map);
  };

  useEffect(() => {
    if (!mapCanvasRef.current || mapRef.current || mapError) {
      return;
    }

    let scheduledMapErrorFrame: number | null = null;
    const webglProbe = document.createElement("canvas");
    const webglContext =
      webglProbe.getContext("webgl2") ??
      webglProbe.getContext("webgl") ??
      webglProbe.getContext("experimental-webgl");

    if (!webglContext) {
      scheduledMapErrorFrame = window.requestAnimationFrame(() => {
        setMapError("Map preview is unavailable because WebGL could not start in this browser.");
      });
      return () => {
        if (scheduledMapErrorFrame !== null) {
          window.cancelAnimationFrame(scheduledMapErrorFrame);
        }
      };
    }

    let map: maplibregl.Map;

    try {
      map = new maplibregl.Map({
        container: mapCanvasRef.current,
        style: MAP_STYLE,
        center: [-6.0, 57.2],
        zoom: 6,
        cooperativeGestures: true,
      });
    } catch {
      scheduledMapErrorFrame = window.requestAnimationFrame(() => {
        setMapError("Map preview is unavailable because WebGL failed to initialize.");
      });
      return () => {
        if (scheduledMapErrorFrame !== null) {
          window.cancelAnimationFrame(scheduledMapErrorFrame);
        }
      };
    }

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
        id: "road-segments-live",
        type: "line",
        source: "segments",
        filter: [
          "all",
          ["==", ["get", "type"], "road"],
          ["==", ["get", "routeStatus"], "live"],
        ],
        paint: {
          "line-color": MAP_PALETTE.routeLive,
          "line-width": 2.5,
          "line-opacity": 0.65,
        },
      });

      map.addLayer({
        id: "road-segments-fallback",
        type: "line",
        source: "segments",
        filter: [
          "all",
          ["==", ["get", "type"], "road"],
          ["==", ["get", "routeStatus"], "fallback"],
        ],
        paint: {
          "line-color": MAP_PALETTE.routeFallback,
          "line-width": 3,
          "line-dasharray": [1.5, 1.5],
          "line-opacity": 0.9,
        },
      });

      map.addLayer({
        id: "ferry-segments",
        type: "line",
        source: "segments",
        filter: ["==", ["get", "type"], "ferry"],
        paint: {
          "line-color": MAP_PALETTE.ferry,
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
          "line-color": MAP_PALETTE.ferrySelected,
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
          "line-color": MAP_PALETTE.default,
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
            MAP_PALETTE.home,
            "stay",
            MAP_PALETTE.stay,
            "poi",
            MAP_PALETTE.poi,
            "ferry_port",
            MAP_PALETTE.ferryPort,
            MAP_PALETTE.default,
          ],
          "circle-stroke-width": 2,
          "circle-stroke-color": MAP_PALETTE.labelHalo,
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
          "circle-color": MAP_PALETTE.selectedFill,
          "circle-stroke-color": MAP_PALETTE.selectedStroke,
          "circle-stroke-width": 2,
        },
      });

      map.addLayer({
        id: "markers-hit",
        type: "circle",
        source: "markers",
        paint: {
          "circle-radius": 14,
          "circle-color": MAP_PALETTE.default,
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
          "text-color": MAP_PALETTE.label,
          "text-halo-color": MAP_PALETTE.labelHalo,
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
    });

    mapRef.current = map;

    return () => {
      if (scheduledMapErrorFrame !== null) {
        window.cancelAnimationFrame(scheduledMapErrorFrame);
      }
      popupRef.current?.remove();
      popupRef.current = null;
      map.remove();
      mapRef.current = null;
    };
  }, [fitOverview, mapError]);

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

    fitOverview(map);
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

    const selection = selectedEntityRef.current;
    const origin = selectionOriginRef.current;

    if (!selection) {
      popupRef.current?.remove();
      popupRef.current = null;
      lastSelectionRef.current = null;
      lastSelectionOriginRef.current = null;
      pendingMapClickAnchorRef.current = null;
      return;
    }

    const selectionKey = `${selection.kind}:${selection.stopId}`;
    const isSameSelection =
      lastSelectionRef.current === selectionKey &&
      lastSelectionOriginRef.current === origin &&
      !pendingMapClickAnchorRef.current;

    if (!isSameSelection) {
      const fromItinerary = origin === "itinerary";
      const fromMap = origin === "map";

      if (!hasFocusedFromOverviewRef.current) {
        const handledFerryBounds =
          fromItinerary &&
          selection.kind === "ferry" &&
          focusFerryPorts(map, selection.stopId);

        if (!handledFerryBounds) {
          const center = getSelectionCenter(selection);
          if (center) {
            animatePanZoom(map, center, DETAIL_ZOOM);
          }
        }

        hasFocusedFromOverviewRef.current = true;
      } else if (fromItinerary) {
        if (selection.kind === "ferry") {
          focusFerryPorts(map, selection.stopId);
        } else {
          const center = getSelectionCenter(selection);
          if (center) {
            animatePanOnly(map, center);
          }
        }
      } else if (fromMap) {
        const center = getSelectionCenter(selection);
        if (center) {
          animatePanZoom(map, center, nextMapStepZoom(map.getZoom()));
        }
      } else {
        const center = getSelectionCenter(selection);
        if (center) {
          animatePanOnly(map, center);
        }
      }
    }

    openPopupForSelection(map, selection, pendingMapClickAnchorRef.current ?? undefined);
    pendingMapClickAnchorRef.current = null;
    lastSelectionRef.current = selectionKey;
    lastSelectionOriginRef.current = origin;
  }, [
    animatePanOnly,
    animatePanZoom,
    focusFerryPorts,
    getSelectionCenter,
    nextMapStepZoom,
    selectedEntity,
    selectionOrigin,
    trip,
  ]);

  useEffect(() => {
    if (
      !testRegistryKey ||
      process.env.NEXT_PUBLIC_E2E_AUTH_BYPASS !== "1" ||
      typeof window === "undefined"
    ) {
      return;
    }

    const registry = window.__plannerMapRegistry ?? {};
    const entry = {
      getClientPointForEntity: (entity: Exclude<SelectedEntity, null>) => {
        const map = mapRef.current;
        const center = getSelectionCenter(entity);

        if (!map || !center) {
          return null;
        }

        const point = map.project(center);
        const rect = map.getCanvas().getBoundingClientRect();

        return {
          x: rect.left + point.x,
          y: rect.top + point.y,
        };
      },
      selectEntity: (entity: Exclude<SelectedEntity, null>) => {
        onSelectEntityRef.current(entity);
      },
    };
    registry[testRegistryKey] = [...(registry[testRegistryKey] ?? []), entry];
    window.__plannerMapRegistry = registry;

    return () => {
      const entries = window.__plannerMapRegistry?.[testRegistryKey];
      if (!entries) {
        return;
      }

      const nextEntries = entries.filter((candidate) => candidate !== entry);
      if (nextEntries.length === 0) {
        if (window.__plannerMapRegistry) {
          delete window.__plannerMapRegistry[testRegistryKey];
        }
        return;
      }

      window.__plannerMapRegistry![testRegistryKey] = nextEntries;
    };
  }, [getSelectionCenter, testRegistryKey]);

  const currentSelectionTitle = selectedTitle(trip, selectedEntity);
  const routeStatusChip = useMemo(() => {
    if (routeSummary.totalRoadLegs === 0) {
      return null;
    }

    if (
      routeSummary.pendingRoadLegs === routeSummary.totalRoadLegs &&
      routeSummary.liveRoadLegs === 0 &&
      routeSummary.fallbackRoadLegs === 0
    ) {
      return {
        tone: "neutral" as const,
        title: "Routing in progress",
        detail: "Road geometry is still loading, so direct placeholder lines stay hidden for now.",
      };
    }

    if (routeSummary.fallbackRoadLegs > 0) {
      return {
        tone: "warning" as const,
        title:
          routeSummary.fallbackRoadLegs === 1
            ? "1 fallback road leg"
            : `${routeSummary.fallbackRoadLegs} fallback road legs`,
        detail: "Fallback road legs are shown as direct dashed lines until live routing is available.",
      };
    }

    if (routeSummary.isRefreshing) {
      return {
        tone: "neutral" as const,
        title: "Refreshing route geometry",
        detail: "Live road routing is already visible and will update if fresher data arrives.",
      };
    }

    return null;
  }, [routeSummary]);

  return (
    <div data-testid="planner-map-panel" className={`relative overflow-hidden ${className ?? ""}`}>
      {mapError ? (
        <div className="flex h-full w-full items-center justify-center bg-app-surface-muted p-6" aria-label="Trip map unavailable">
          <div className="max-w-sm rounded-2xl border border-app-border bg-app-surface p-5 text-center shadow-sm">
            <p className="planner-title-sm text-app-text">Map unavailable</p>
            <p className="planner-copy mt-2 text-app-muted">{mapError}</p>
          </div>
        </div>
      ) : (
        <div ref={mapCanvasRef} className="h-full w-full" aria-label="Trip map" />
      )}

      <div className="pointer-events-none absolute left-3 right-3 top-3 z-10 flex items-start justify-between gap-3">
        <div className="pointer-events-auto flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-2 rounded-xl border border-app-border bg-app-surface/95 p-2 shadow-sm backdrop-blur">
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
              className="planner-button-secondary rounded-lg border px-3 py-1.5 text-xs font-semibold transition"
            >
              Reset Map
            </button>
          </div>

          {routeStatusChip ? (
            <div
              data-testid="map-route-status-chip"
              className={`max-w-xs rounded-xl border px-3 py-2 text-xs shadow-sm backdrop-blur ${routeChipToneClass[routeStatusChip.tone]}`}
            >
              <p className="font-semibold">{routeStatusChip.title}</p>
              <p className="mt-1 leading-5">{routeStatusChip.detail}</p>
            </div>
          ) : null}
        </div>

        {currentSelectionTitle ? (
          <div className="pointer-events-auto rounded-xl border border-brand-primary/22 bg-app-surface/95 px-3 py-2 text-xs text-app-muted shadow-sm backdrop-blur">
            <p className="font-semibold text-app-text">Selected</p>
            <p>{currentSelectionTitle}</p>
          </div>
        ) : null}
      </div>
    </div>
  );
}
