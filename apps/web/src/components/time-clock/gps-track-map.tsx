'use client';

/**
 * Leaflet-Karte (CDN): GPS-Punkte chronologisch mit Verbindungslinie.
 */

import { useEffect, useRef } from 'react';

export interface GpsMapPoint {
  id: string;
  latitude: number;
  longitude: number;
  recordedAt: string;
  label?: string;
}

type LeafletNs = {
  map: (el: HTMLElement, opts?: object) => LeafletMap;
  tileLayer: (url: string, opts?: object) => { addTo: (m: LeafletMap) => void };
  layerGroup: () => LeafletLayerGroup;
  polyline: (latLngs: [number, number][], opts?: object) => { addTo: (g: LeafletLayerGroup) => void };
  circleMarker: (
    latLng: [number, number],
    opts?: object,
  ) => {
    bindPopup: (html: string) => void;
    addTo: (g: LeafletLayerGroup) => void;
  };
  latLngBounds: (latLngs: [number, number][]) => unknown;
  Icon: { Default: { mergeOptions: (o: object) => void } };
};

type LeafletMap = {
  remove: () => void;
  fitBounds: (b: unknown, opts?: object) => void;
  invalidateSize: () => void;
};

type LeafletLayerGroup = {
  clearLayers: () => void;
  addTo: (m: LeafletMap) => LeafletLayerGroup;
};

declare global {
  interface Window {
    L?: LeafletNs;
  }
}

const LEAFLET_CSS = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
const LEAFLET_JS = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';

function loadLeaflet(): Promise<LeafletNs> {
  return new Promise((resolve, reject) => {
    if (window.L) {
      resolve(window.L);
      return;
    }
    if (!document.querySelector(`link[href="${LEAFLET_CSS}"]`)) {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = LEAFLET_CSS;
      document.head.appendChild(link);
    }
    const existing = document.querySelector(
      `script[src="${LEAFLET_JS}"]`,
    ) as HTMLScriptElement | null;
    if (existing) {
      existing.addEventListener('load', () => {
        if (window.L) resolve(window.L);
        else reject(new Error('Leaflet load failed'));
      });
      return;
    }
    const script = document.createElement('script');
    script.src = LEAFLET_JS;
    script.async = true;
    script.onload = () => {
      if (window.L) resolve(window.L);
      else reject(new Error('Leaflet load failed'));
    };
    script.onerror = () => reject(new Error('Leaflet CDN unreachable'));
    document.head.appendChild(script);
  });
}

export function GpsTrackMap({
  points,
  className,
}: {
  points: GpsMapPoint[];
  className?: string;
}): React.ReactNode {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<{ map: LeafletMap; layer: LeafletLayerGroup } | null>(
    null,
  );

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      if (!containerRef.current || points.length === 0) return;
      const L = await loadLeaflet();
      if (cancelled || !containerRef.current) return;

      L.Icon.Default.mergeOptions({
        iconRetinaUrl:
          'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
        iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
        shadowUrl:
          'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
      });

      if (!mapRef.current) {
        const map = L.map(containerRef.current, { scrollWheelZoom: true });
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution:
            '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>',
          maxZoom: 19,
        }).addTo(map);
        const layer = L.layerGroup().addTo(map);
        mapRef.current = { map, layer };
      }

      const { map, layer } = mapRef.current;
      layer.clearLayers();

      const sorted = [...points].sort(
        (a, b) =>
          new Date(a.recordedAt).getTime() - new Date(b.recordedAt).getTime(),
      );
      const latLngs = sorted.map(
        (p) => [p.latitude, p.longitude] as [number, number],
      );

      if (latLngs.length >= 2) {
        L.polyline(latLngs, {
          color: '#2563eb',
          weight: 4,
          opacity: 0.85,
        }).addTo(layer);
      }

      sorted.forEach((p, i) => {
        const time = new Date(p.recordedAt).toLocaleString('de-DE');
        const marker = L.circleMarker([p.latitude, p.longitude], {
          radius: i === 0 || i === sorted.length - 1 ? 8 : 5,
          color:
            i === 0 ? '#16a34a' : i === sorted.length - 1 ? '#dc2626' : '#2563eb',
          fillColor:
            i === 0 ? '#22c55e' : i === sorted.length - 1 ? '#ef4444' : '#3b82f6',
          fillOpacity: 0.9,
          weight: 2,
        });
        marker.bindPopup(
          `<strong>#${i + 1}</strong><br/>${time}${
            p.label ? `<br/>${p.label}` : ''
          }<br/>${p.latitude.toFixed(5)}, ${p.longitude.toFixed(5)}`,
        );
        marker.addTo(layer);
      });

      map.fitBounds(L.latLngBounds(latLngs), { padding: [40, 40], maxZoom: 16 });
      setTimeout(() => map.invalidateSize(), 50);
    })();

    return () => {
      cancelled = true;
    };
  }, [points]);

  useEffect(() => {
    return () => {
      if (mapRef.current) {
        mapRef.current.map.remove();
        mapRef.current = null;
      }
    };
  }, []);

  if (points.length === 0) return null;

  return (
    <div
      ref={containerRef}
      className={className ?? 'h-[420px] w-full rounded-lg border bg-muted/30'}
      style={{ zIndex: 0 }}
    />
  );
}
