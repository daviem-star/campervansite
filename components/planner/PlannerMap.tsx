"use client";

import { useEffect, useMemo, useRef } from "react";
import maplibregl, { GeoJSONSource, LngLatBounds } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

import { MapMarker, MapSegment } from "@/types/trip";

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

type PlannerMapProps = {
  markers: MapMarker[];
  segments: MapSegment[];
  className?: string;
};

export default function PlannerMap({ markers, segments, className }: PlannerMapProps) {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);

  const markerFeatureCollection = useMemo<GeoJSON.FeatureCollection<GeoJSON.Point>>(
    () => ({
      type: "FeatureCollection",
      features: markers.map((marker) => ({
        type: "Feature",
        properties: {
          id: marker.id,
          role: marker.role,
          label: marker.label,
        },
        geometry: {
          type: "Point",
          coordinates: [marker.coordinates.lng, marker.coordinates.lat],
        },
      })),
    }),
    [markers],
  );

  const segmentFeatureCollection = useMemo<GeoJSON.FeatureCollection<GeoJSON.LineString>>(
    () => ({
      type: "FeatureCollection",
      features: segments.map((segment) => ({
        type: "Feature",
        properties: {
          id: segment.id,
          type: segment.type,
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
    [segments],
  );

  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) {
      return;
    }

    const map = new maplibregl.Map({
      container: mapContainerRef.current,
      style: MAP_STYLE,
      center: [-6.0, 57.2],
      zoom: 6,
      cooperativeGestures: true,
    });

    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");

    map.on("load", () => {
      map.addSource("markers", {
        type: "geojson",
        data: markerFeatureCollection,
      });

      map.addSource("segments", {
        type: "geojson",
        data: segmentFeatureCollection,
      });

      map.addLayer({
        id: "road-segments",
        type: "line",
        source: "segments",
        filter: ["==", ["get", "type"], "road"],
        paint: {
          "line-color": "#455a64",
          "line-width": 3,
          "line-opacity": 0.85,
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
          "line-opacity": 0.95,
        },
      });

      map.addLayer({
        id: "markers",
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
        id: "marker-labels",
        type: "symbol",
        source: "markers",
        layout: {
          "text-field": ["get", "label"],
          "text-size": 11,
          "text-anchor": "top",
          "text-offset": [0, 1.2],
          "text-font": ["Noto Sans Regular"],
          "text-max-width": 12,
        },
        paint: {
          "text-color": "#1f2937",
          "text-halo-color": "#ffffff",
          "text-halo-width": 1,
        },
      });
    });

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, [markerFeatureCollection, segmentFeatureCollection]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) {
      return;
    }

    const markerSource = map.getSource("markers") as GeoJSONSource | undefined;
    const segmentSource = map.getSource("segments") as GeoJSONSource | undefined;

    markerSource?.setData(markerFeatureCollection);
    segmentSource?.setData(segmentFeatureCollection);

    if (markers.length > 0) {
      const bounds = new LngLatBounds();
      markers.forEach((marker) => {
        bounds.extend([marker.coordinates.lng, marker.coordinates.lat]);
      });

      if (!bounds.isEmpty()) {
        map.fitBounds(bounds, {
          padding: 60,
          maxZoom: 10,
          duration: 600,
        });
      }
    }
  }, [markerFeatureCollection, markers, segmentFeatureCollection]);

  return <div ref={mapContainerRef} className={className} aria-label="Trip map" />;
}
