import { useEffect, useRef } from 'react';
import { Loader } from '@googlemaps/js-api-loader';
import { useT } from '../../../lib/i18n';

export interface MapPoint {
  lat: number;
  lng: number;
}

interface ClaimFarmMapProps {
  /** Claim capture coordinates ("lat,lng"). */
  gpsCoordinates?: string | null;
  /** Farmer farm-boundary polygon (from the user profile), when available. */
  boundaryPoints?: MapPoint[];
}

const INDIA_CENTER = { lat: 20.5937, lng: 78.9629 };

function parseGps(raw?: string | null): MapPoint | null {
  if (!raw) return null;
  const parts = raw.split(',');
  if (parts.length < 2) return null;
  const lat = Number(parts[0]);
  const lng = Number(parts[1]);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return { lat, lng };
}

/**
 * Read-only farm/claim map — reuses the `@googlemaps/js-api-loader` dependency
 * already shipped for onboarding (no new map library). Shows the claim capture
 * point plus the farmer's boundary polygon when both are available; falls back
 * to a coordinate card when no Maps key is configured.
 */
export default function ClaimFarmMap({ gpsCoordinates, boundaryPoints = [] }: ClaimFarmMapProps) {
  const t = useT();
  const apiKey = (import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string | undefined) ?? '';
  const divRef = useRef<HTMLDivElement | null>(null);
  const point = parseGps(gpsCoordinates);
  const boundaryKey = boundaryPoints.map((p) => `${p.lat},${p.lng}`).join('|');

  useEffect(() => {
    if (!apiKey || !divRef.current || !point) return;
    let cancelled = false;
    const loader = new Loader({ apiKey, libraries: ['geometry'] });
    loader
      .load()
      .then(() => {
        if (cancelled || !divRef.current) return;
        const map = new google.maps.Map(divRef.current, {
          zoom: 15,
          center: point,
          mapTypeId: 'satellite',
        });
        new google.maps.Marker({ position: point, map, title: t('insClaimLocation') });
        if (boundaryPoints.length >= 3) {
          const path = boundaryPoints.map((p) => new google.maps.LatLng(p.lat, p.lng));
          new google.maps.Polygon({
            paths: path,
            strokeColor: '#2E7D32',
            strokeWeight: 2,
            fillColor: '#43A047',
            fillOpacity: 0.18,
            map,
          });
        }
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiKey, gpsCoordinates, boundaryKey]);

  if (!apiKey) {
    return (
      <div className="ins-map-fallback">
        <span className="ins-map-fallback-icon" aria-hidden>
          🛰️
        </span>
        <p className="ins-map-fallback-title">{t('insMapNeedsKeyTitle')}</p>
        <p className="ins-map-fallback-body">{t('insMapNeedsKeyBody')}</p>
      </div>
    );
  }

  if (!point) {
    return (
      <div className="ins-map-fallback">
        <span className="ins-map-fallback-icon" aria-hidden>
          📍
        </span>
        <p className="ins-map-fallback-title">{t('insNoGps')}</p>
      </div>
    );
  }

  return <div ref={divRef} className="ins-map-canvas" data-center={`${INDIA_CENTER.lat},${INDIA_CENTER.lng}`} />;
}
