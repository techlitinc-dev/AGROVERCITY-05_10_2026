import React, { useEffect, useRef, useState } from 'react';
import { MapPin } from 'lucide-react';
import { loadGoogleMaps } from '../../lib/googleMaps';

export interface RouteMapPoint {
  lat: number;
  lng: number;
}

export interface RouteMapBounds {
  south: number;
  west: number;
  north: number;
  east: number;
}

export interface RouteMapProps {
  origin?: RouteMapPoint | null;
  destination?: RouteMapPoint | null;
  /** Encoded polyline (Google encoded polyline format) drawn between the pins. */
  polyline?: string | null;
  bounds?: RouteMapBounds | null;
  /** Tailwind height class for the map container. Defaults to h-72. */
  heightClass?: string;
  /** Kept visible on the placeholder card, e.g. 152 km · ~2h 32m. */
  distanceKm?: number | null;
  durationMin?: number | null;
  /** Extra hint line on the placeholder (e.g. the GEO_REQUIRED explanation). */
  hint?: string | null;
}

type LoadState = 'loading' | 'ready' | 'failed';

/** Classic teardrop pin path (24×24 viewBox) — emerald for pickup, rose for drop. */
const PIN_PATH = 'M12 2C8.13 2 5 5.13 5 8.5c0 5.25 7 13 7 13s7-7.75 7-13C19 5.13 15.87 2 12 2z';

const pinIcon = (fill: string): google.maps.Symbol => ({
  path: PIN_PATH,
  fillColor: fill,
  fillOpacity: 1,
  strokeColor: '#ffffff',
  strokeWeight: 1.5,
  scale: 1.6,
  anchor: new google.maps.Point(12, 21),
});

/** Subtle, desaturated look that sits well next to the app's slate/emerald UI. */
const MAP_STYLES: google.maps.MapTypeStyle[] = [
  { featureType: 'poi', elementType: 'labels', stylers: [{ visibility: 'off' }] },
  { featureType: 'transit', elementType: 'labels.icon', stylers: [{ visibility: 'off' }] },
  { featureType: 'landscape', elementType: 'geometry', stylers: [{ color: '#f8fafc' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#dbeafe' }] },
];

const hasPoint = (p: RouteMapPoint | null | undefined): p is RouteMapPoint =>
  !!p && typeof p.lat === 'number' && typeof p.lng === 'number';

const formatDuration = (min: number): string => {
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
};

/**
 * Renders a Google Map with pickup/drop markers and the routed polyline.
 * Falls back to a tasteful placeholder card when the API key is missing, the
 * script fails to load, or no route data is available yet.
 */
export const RouteMap: React.FC<RouteMapProps> = ({
  origin,
  destination,
  polyline,
  bounds,
  heightClass = 'h-72',
  distanceKm = null,
  durationMin = null,
  hint = null,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [state, setState] = useState<LoadState>(() =>
    typeof window !== 'undefined' && !!window.google?.maps ? 'ready' : 'loading'
  );

  useEffect(() => {
    let alive = true;
    loadGoogleMaps().then((ok) => {
      if (alive) setState(ok ? 'ready' : 'failed');
    });
    return () => {
      alive = false;
    };
  }, []);

  // Stable key over the inputs the map effect actually consumes.
  const coordsKey = [
    origin?.lat ?? '',
    origin?.lng ?? '',
    destination?.lat ?? '',
    destination?.lng ?? '',
    polyline ?? '',
    bounds ? `${bounds.south},${bounds.west},${bounds.north},${bounds.east}` : '',
  ].join('|');

  useEffect(() => {
    if (state !== 'ready' || !containerRef.current) return;
    const g = window.google;
    if (!g?.maps) return;

    const markers: google.maps.Marker[] = [];
    let line: google.maps.Polyline | null = null;

    const map = new g.maps.Map(containerRef.current, {
      disableDefaultUI: true,
      zoomControl: true,
      gestureHandling: 'greedy',
      backgroundColor: '#f1f5f9',
      styles: MAP_STYLES,
    });

    const fit = new g.maps.LatLngBounds();
    let hasGeometry = false;

    if (polyline) {
      try {
        const path = g.maps.geometry.encoding.decodePath(polyline);
        if (path.length > 0) {
          line = new g.maps.Polyline({
            path,
            map,
            strokeColor: '#059669',
            strokeOpacity: 0.9,
            strokeWeight: 4,
            geodesic: true,
          });
          path.forEach((p) => fit.extend(p));
          hasGeometry = true;
        }
      } catch {
        // Malformed polyline — fall through to markers/bounds only.
      }
    }

    if (hasPoint(origin)) {
      markers.push(new g.maps.Marker({ position: origin, map, title: 'Pickup', icon: pinIcon('#059669'), zIndex: 2 }));
      fit.extend(origin);
      hasGeometry = true;
    }
    if (hasPoint(destination)) {
      markers.push(new g.maps.Marker({ position: destination, map, title: 'Drop', icon: pinIcon('#e11d48'), zIndex: 2 }));
      fit.extend(destination);
      hasGeometry = true;
    }

    // Mock-mode routes come back with polyline: null — draw a straight
    // origin→destination line (per docs/deployment/google-maps-setup.md).
    if (!line && hasPoint(origin) && hasPoint(destination)) {
      line = new g.maps.Polyline({
        path: [origin, destination],
        map,
        strokeColor: '#059669',
        strokeOpacity: 0.55,
        strokeWeight: 3,
        geodesic: true,
      });
    }

    if (bounds && !line) {
      fit.union(
        new g.maps.LatLngBounds(
          { lat: bounds.south, lng: bounds.west },
          { lat: bounds.north, lng: bounds.east }
        )
      );
      hasGeometry = true;
    }

    if (!hasGeometry) {
      map.setCenter({ lat: 20.59, lng: 78.96 });
      map.setZoom(4);
    } else if (!line && !bounds && markers.length === 1) {
      map.setCenter(hasPoint(origin) ? origin : (destination as RouteMapPoint));
      map.setZoom(11);
    } else {
      map.fitBounds(fit, 48);
    }

    return () => {
      markers.forEach((m) => m.setMap(null));
      line?.setMap(null);
      g.maps.event.clearInstanceListeners(map);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, coordsKey]);

  const chips =
    distanceKm != null || durationMin != null ? (
      <div className="flex items-center gap-2 text-[11px] font-bold text-slate-600">
        {distanceKm != null && <span>{Math.round(distanceKm)} km</span>}
        {distanceKm != null && durationMin != null && <span className="text-slate-300">·</span>}
        {durationMin != null && <span>~{formatDuration(durationMin)}</span>}
      </div>
    ) : null;

  const placeholder = (title: string, sub?: string | null) => (
    <div
      className={`${heightClass} rounded-2xl border border-dashed border-slate-300 bg-slate-50 flex flex-col items-center justify-center gap-2 text-center px-6`}
    >
      <MapPin className="w-8 h-8 text-slate-300" />
      <p className="text-xs font-bold text-slate-500 max-w-sm">{title}</p>
      {sub && <p className="text-[11px] text-slate-400 max-w-sm">{sub}</p>}
      {chips}
    </div>
  );

  if (state === 'loading') {
    return placeholder('Loading map…');
  }
  if (state === 'failed') {
    return placeholder('Map preview unavailable — add VITE_GOOGLE_MAPS_API_KEY to website/.env', hint);
  }
  if (!hasPoint(origin) && !hasPoint(destination) && !polyline) {
    return placeholder(hint ?? 'Route preview will appear once route data is available.');
  }
  return <div ref={containerRef} className={`${heightClass} rounded-2xl overflow-hidden border border-slate-200/80`} />;
};
