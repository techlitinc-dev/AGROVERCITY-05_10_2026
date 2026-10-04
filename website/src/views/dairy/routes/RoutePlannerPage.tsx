import { useEffect, useState } from 'react';
import { fetchProcurementRoutes, type ProcurementRoute, type RouteStop } from '../../../lib/api/dairyMarketplace';
import { useT } from '../../../lib/i18n';
import '../../../theme/dairy.css';

export default function RoutePlannerPage() {
  const t = useT();
  const [routes, setRoutes] = useState<ProcurementRoute[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedRouteId, setSelectedRouteId] = useState<string>('');
  const [shiftFilter, setShiftFilter] = useState<'all' | 'am' | 'pm'>('all');

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    setError(null);
    fetchProcurementRoutes()
      .then((data) => {
        if (mounted) {
          setRoutes(data || []);
          if (data && data.length > 0) {
            setSelectedRouteId(data[0].id);
          }
        }
      })
      .catch((err) => {
        if (mounted) setError(err?.response?.data?.error?.message || t('dairyLoadFailed'));
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, [t]);

  const activeRoute = routes.find((r) => r.id === selectedRouteId) || routes[0];

  const filteredStops: RouteStop[] = (activeRoute?.stops || []).filter((stop) => {
    if (shiftFilter === 'am') {
      return stop.pickupWindow.toLowerCase().includes('am') || stop.pickupWindow.toLowerCase().includes('morning');
    }
    if (shiftFilter === 'pm') {
      return stop.pickupWindow.toLowerCase().includes('pm') || stop.pickupWindow.toLowerCase().includes('evening');
    }
    return true;
  });

  // Region-sorted text tour list (alphabetical by locationPin, then by sequence)
  const sortedTour: RouteStop[] = [...filteredStops].sort((a, b) => {
    const locComp = (a.locationPin || '').localeCompare(b.locationPin || '');
    if (locComp !== 0) return locComp;
    return a.sequence - b.sequence;
  });

  return (
    <div className="dairy-route-planner" style={{ padding: '1.5rem', maxWidth: '1000px', margin: '0 auto' }}>
      <div style={{ marginBottom: '1.5rem' }}>
        <h2 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 700 }}>{t('dairyRoutePlannerTitle')}</h2>
        <p style={{ margin: '0.25rem 0 0', color: '#6b7280', fontSize: '0.9rem' }}>
          {t('dairyRoutePlannerSub')}
        </p>
      </div>

      {loading && <div style={{ padding: '2rem', textAlign: 'center', color: '#888' }}>{t('dairyLoading')}</div>}
      {error && (
        <div style={{ padding: '1rem', background: '#fee2e2', color: '#b91c1c', borderRadius: '8px', marginBottom: '1rem' }}>
          {error}
        </div>
      )}

      {!loading && !error && routes.length === 0 && (
        <div style={{ padding: '3rem', textAlign: 'center', background: '#f9fafb', borderRadius: '8px', border: '1px dashed #d1d5db' }}>
          <p style={{ margin: 0, color: '#6b7280', fontSize: '1rem' }}>{t('dairyNoRoutes')}</p>
        </div>
      )}

      {!loading && routes.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: '1.5rem', alignItems: 'start' }}>
          {/* Route selector sidebar */}
          <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: '8px', padding: '1rem' }}>
            <h3 style={{ margin: '0 0 0.75rem', fontSize: '1rem', fontWeight: 600 }}>{t('dairyRouteName')}</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {routes.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => setSelectedRouteId(r.id)}
                  style={{
                    textAlign: 'left',
                    padding: '0.75rem',
                    borderRadius: '6px',
                    border: r.id === activeRoute?.id ? '2px solid #2563eb' : '1px solid #e5e7eb',
                    background: r.id === activeRoute?.id ? '#eff6ff' : '#fff',
                    cursor: 'pointer',
                  }}
                >
                  <div style={{ fontWeight: 600, fontSize: '0.9rem', color: '#1f2937' }}>{r.routeName}</div>
                  <div style={{ fontSize: '0.8rem', color: '#6b7280', marginTop: '0.25rem' }}>
                    {r.assignedAgentName}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: '#0369a1', marginTop: '0.25rem' }}>
                    {r.stops?.length || 0} {t('dairyStopsCount')} · {r.totalEstimatedLiters} L
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Route Details & Text Tour */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            {activeRoute && (
              <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: '8px', padding: '1.25rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
                  <div>
                    <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700 }}>{activeRoute.routeName}</h3>
                    <p style={{ margin: '0.25rem 0 0', color: '#4b5563', fontSize: '0.875rem' }}>
                      {t('dairyAssignedAgent')}: <strong>{activeRoute.assignedAgentName}</strong>
                    </p>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '0.8rem', color: '#6b7280' }}>{t('dairyScheduledDate')}</div>
                    <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{activeRoute.scheduledDate}</div>
                  </div>
                </div>

                {/* AM / PM Ordering Controls */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem', borderTop: '1px solid #f3f4f6', paddingTop: '1rem' }}>
                  <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#374151' }}>{t('dairyShiftSplit')}:</span>
                  <button
                    type="button"
                    onClick={() => setShiftFilter('all')}
                    style={{
                      padding: '0.3rem 0.75rem',
                      borderRadius: '6px',
                      fontSize: '0.8rem',
                      fontWeight: 600,
                      border: '1px solid',
                      borderColor: shiftFilter === 'all' ? '#2563eb' : '#d1d5db',
                      background: shiftFilter === 'all' ? '#2563eb' : '#fff',
                      color: shiftFilter === 'all' ? '#fff' : '#374151',
                      cursor: 'pointer',
                    }}
                  >
                    {t('dairyMonthAll')}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShiftFilter('am')}
                    style={{
                      padding: '0.3rem 0.75rem',
                      borderRadius: '6px',
                      fontSize: '0.8rem',
                      fontWeight: 600,
                      border: '1px solid',
                      borderColor: shiftFilter === 'am' ? '#2563eb' : '#d1d5db',
                      background: shiftFilter === 'am' ? '#2563eb' : '#fff',
                      color: shiftFilter === 'am' ? '#fff' : '#374151',
                      cursor: 'pointer',
                    }}
                  >
                    {t('dairyShiftAm')}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShiftFilter('pm')}
                    style={{
                      padding: '0.3rem 0.75rem',
                      borderRadius: '6px',
                      fontSize: '0.8rem',
                      fontWeight: 600,
                      border: '1px solid',
                      borderColor: shiftFilter === 'pm' ? '#2563eb' : '#d1d5db',
                      background: shiftFilter === 'pm' ? '#2563eb' : '#fff',
                      color: shiftFilter === 'pm' ? '#fff' : '#374151',
                      cursor: 'pointer',
                    }}
                  >
                    {t('dairyShiftPm')}
                  </button>
                </div>

                {/* Region-sorted Text Tour List (Hard constraint G5: text itinerary) */}
                <div>
                  <h4 style={{ margin: '0 0 0.5rem', fontSize: '1rem', fontWeight: 600, color: '#111827' }}>
                    {t('dairyTextTourTitle')}
                  </h4>
                  <p style={{ margin: '0 0 1rem', fontSize: '0.8rem', color: '#6b7280' }}>
                    {t('dairyTextTourDesc')}
                  </p>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    {sortedTour.map((stop, idx) => (
                      <div
                        key={`${stop.farmerId}-${stop.sequence}`}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '0.75rem 1rem',
                          background: '#f9fafb',
                          border: '1px solid #e5e7eb',
                          borderRadius: '6px',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                          <span
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              width: '24px',
                              height: '24px',
                              borderRadius: '50%',
                              background: '#e0e7ff',
                              color: '#3730a3',
                              fontSize: '0.75rem',
                              fontWeight: 700,
                            }}
                          >
                            {idx + 1}
                          </span>
                          <div>
                            <div style={{ fontWeight: 600, fontSize: '0.9rem', color: '#1f2937' }}>
                              {stop.farmerName}
                            </div>
                            <div style={{ fontSize: '0.8rem', color: '#6b7280' }}>
                              📍 {stop.locationPin}
                            </div>
                          </div>
                        </div>

                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontWeight: 600, color: '#16a34a', fontSize: '0.9rem' }}>
                            {stop.expectedLiters} L
                          </div>
                          <div style={{ fontSize: '0.8rem', color: '#6b7280' }}>
                            ⏰ {stop.pickupWindow}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
