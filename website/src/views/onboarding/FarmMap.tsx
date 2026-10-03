import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader } from '@googlemaps/js-api-loader';
import SiteFooter from '../../components/SiteFooter';
import SiteHeader from '../../components/SiteHeader';
import { toast } from '../../components/toast';
import { isApiError } from '../../lib/api/client';
import type { FarmBoundaryPoint } from '../../lib/api/types';
import { saveFarmBoundary } from '../../lib/api/users';
import { useT } from '../../lib/i18n';
import { useOnboardingStore } from '../../stores/onboarding';
import { useSessionStore } from '../../stores/session';
import '../../theme/views.css';

const INDIA_CENTER = { lat: 20.5937, lng: 78.9629 };
const PIN_COLOR = '#43A047';
const POLYGON_FILL = '#43A047';
const POLYGON_STROKE = '#2E7D32';

/** Step 4/4 (farmer only) — tap-to-pin farm boundary on a real Google Map. */
export default function FarmMap() {
  const t = useT();
  const navigate = useNavigate();
  const apiKey = (import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string | undefined) ?? '';
  const setOnboarded = useOnboardingStore((s) => s.setOnboarded);

  const mapDivRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const markersRef = useRef<google.maps.Marker[]>([]);
  const polygonRef = useRef<google.maps.Polygon | null>(null);
  const clickListenerRef = useRef<google.maps.MapsEventListener | null>(null);

  const [pins, setPins] = useState<FarmBoundaryPoint[]>([]);
  const [acres, setAcres] = useState(0);
  const [perimeter, setPerimeter] = useState(0);
  const [mapReady, setMapReady] = useState(false);
  const [mapError, setMapError] = useState(false);
  const [locating, setLocating] = useState(false);
  const [saving, setSaving] = useState(false);

  /** Redraw polygon + stats from the current pin list. */
  const redraw = useCallback((points: FarmBoundaryPoint[]) => {
    const map = mapRef.current;
    polygonRef.current?.setMap(null);
    polygonRef.current = null;
    if (!map || points.length < 3) {
      setAcres(0);
      setPerimeter(0);
      return;
    }
    const path = points.map((p) => new google.maps.LatLng(p.lat, p.lng));
    const polygon = new google.maps.Polygon({
      paths: path,
      fillColor: POLYGON_FILL,
      fillOpacity: 0.18,
      strokeColor: POLYGON_STROKE,
      strokeWeight: 2,
      clickable: false,
      map,
    });
    polygonRef.current = polygon;

    const areaSqMeters = google.maps.geometry.spherical.computeArea(path);
    const closedPath = [...path, path[0]];
    const lengthMeters = google.maps.geometry.spherical.computeLength(closedPath);
    setAcres(areaSqMeters / 4046.86);
    setPerimeter(lengthMeters);
  }, []);

  useEffect(() => {
    if (!apiKey || !mapDivRef.current) return;
    let cancelled = false;
    const loader = new Loader({ apiKey, libraries: ['geometry'] });
    loader
      .load()
      .then(() => {
        if (cancelled || !mapDivRef.current) return;
        const map = new google.maps.Map(mapDivRef.current, {
          zoom: 17,
          center: INDIA_CENTER,
          mapTypeId: 'satellite',
        });
        mapRef.current = map;
        clickListenerRef.current = map.addListener('click', (event: google.maps.MapMouseEvent) => {
          if (!event.latLng) return;
          const point = { lat: event.latLng.lat(), lng: event.latLng.lng() };
          setPins((prev) => {
            const next = [...prev, point];
            redraw(next);
            return next;
          });
        });
        setMapReady(true);
      })
      .catch(() => {
        if (!cancelled) setMapError(true);
      });
    return () => {
      cancelled = true;
      clickListenerRef.current?.remove();
      polygonRef.current?.setMap(null);
      for (const marker of markersRef.current) marker.setMap(null);
      markersRef.current = [];
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiKey]);

  /** Sync pin markers with state (drop / click-to-remove). */
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;
    for (const marker of markersRef.current) marker.setMap(null);
    markersRef.current = pins.map((point) => {
      const marker = new google.maps.Marker({
        position: point,
        map,
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          scale: 9,
          fillColor: PIN_COLOR,
          fillOpacity: 1,
          strokeColor: '#ffffff',
          strokeWeight: 2,
        },
      });
      marker.addListener('click', () => {
        setPins((prev) => {
          const next = prev.filter((p) => !(p.lat === point.lat && p.lng === point.lng));
          redraw(next);
          return next;
        });
      });
      return marker;
    });
  }, [pins, mapReady, redraw]);

  const findByGps = () => {
    if (!navigator.geolocation || locating) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocating(false);
        const center = { lat: position.coords.latitude, lng: position.coords.longitude };
        mapRef.current?.panTo(center);
        mapRef.current?.setZoom(18);
      },
      () => {
        setLocating(false);
        toast(t('findByGps'), { error: true });
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  };

  const undoPin = () => {
    setPins((prev) => {
      const next = prev.slice(0, -1);
      redraw(next);
      return next;
    });
  };

  const clearPins = () => {
    setPins([]);
    redraw([]);
  };

  const confirmFarm = async () => {
    if (pins.length < 3 || saving) {
      if (pins.length < 3) toast(t('minPinsToast'), { error: true });
      return;
    }
    setSaving(true);
    try {
      await saveFarmBoundary(pins, Number(acres.toFixed(1)));
      const user = useSessionStore.getState().user;
      if (user) {
        useSessionStore.getState().setUser({
          ...user,
          farmBoundaryPoints: pins,
          landAreaAcres: Number(acres.toFixed(1)),
        });
      }
      setOnboarded(true);
      navigate('/dashboard');
    } catch (e) {
      toast(isApiError(e) ? e.message : t('confirmFarmAndOpen'), { error: true });
      setSaving(false);
    }
  };

  const canConfirm = pins.length >= 3 && !saving;

  const headerAction = apiKey ? (
    <button
      type="button"
      className="av-btn av-btn-primary av-header-action"
      disabled={!canConfirm}
      onClick={() => void confirmFarm()}
    >
      {saving ? <span className="av-spinner" /> : t('saveFinish')}
    </button>
  ) : undefined;

  const controlCard = (
    <div className="map-floatcard">
      <div className="map-mobile-head">
        <h1 className="av-page-title" style={{ fontSize: 22 }}>
          {t('farmGeofencingTitle')}
        </h1>
        <p className="av-page-subtitle" style={{ marginBottom: 10 }}>
          {t('farmGeofencingSub')}
        </p>
      </div>
      <p className="map-hint">{t('geofenceRealHint')}</p>

      <div className="map-stats">
        <div className="map-stat">
          <div className="map-stat-value">{pins.length}</div>
          <div className="map-stat-label">{t('pinsLabel')}</div>
        </div>
        <div className="map-stat">
          <div className="map-stat-value">{acres.toFixed(1)}</div>
          <div className="map-stat-label">{t('acresUnit')}</div>
        </div>
        <div className="map-stat">
          <div className="map-stat-value">{perimeter.toFixed(0)} m</div>
          <div className="map-stat-label">{t('perimeterLabel')}</div>
        </div>
      </div>

      {mapError ? (
        <p className="map-hint" style={{ color: 'var(--av-error)' }}>
          {t('mapLoadError')}
        </p>
      ) : null}

      <div className="map-tools">
        <button type="button" className="av-btn av-btn-ghost" onClick={undoPin} disabled={pins.length === 0}>
          ↩ {t('undoPin')}
        </button>
        <button type="button" className="av-btn av-btn-ghost" onClick={clearPins} disabled={pins.length === 0}>
          ✕ {t('clearPins')}
        </button>
      </div>

      <div className="page-footer-cta">
        <button
          type="button"
          className="av-btn av-btn-primary"
          disabled={!canConfirm}
          onClick={() => void confirmFarm()}
        >
          {saving ? <span className="av-spinner" /> : t('confirmFarmAndOpen')}
        </button>
      </div>
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: '100dvh' }}>
      <SiteHeader step={4} actions={headerAction} />
      {apiKey ? (
        <div className="map-stage">
          <div ref={mapDivRef} className="map-canvas" />
          <button type="button" className="av-btn map-gps-btn" onClick={findByGps} disabled={!mapReady || locating}>
            {locating ? (
              <span className="av-spinner" style={{ borderTopColor: 'var(--av-green-deep)' }} />
            ) : (
              `📍 ${t('findByGps')}`
            )}
          </button>
          {controlCard}
        </div>
      ) : (
        <main style={{ flex: 1 }}>
          <div className="av-container">
            <div className="map-fallback-wrap">
              <div className="map-canvas-fallback">
                <span className="fallback-icon">🛰️</span>
                <h3>{t('mapNeedsKeyTitle')}</h3>
                <p>{t('mapNeedsKeyBody')}</p>
              </div>
              <div className="page-footer-cta">
                <button type="button" className="av-btn av-btn-primary" disabled>
                  {t('confirmFarmAndOpen')}
                </button>
              </div>
            </div>
          </div>
        </main>
      )}
      <div className="av-chrome-footer">
        <SiteFooter />
      </div>
    </div>
  );
}
