import { ZERO } from '../../lib/numDefaults';
import { useEffect, useState, type CSSProperties } from 'react';
import { useNavigate } from 'react-router-dom';
import StatusPill from '../../components/trade/StatusPill';
import { inr } from '../../lib/api/trade';
import {
  transportAnalytics,
  transportBookings,
  type TransportAnalytics,
  type TransportBooking,
} from '../../lib/api/transport';
import { useT } from '../../lib/i18n';
import '../../theme/trade.css';

/**
 * Transporter home board — real metrics rendered at the top of the transport
 * persona dashboard: fleet size, active trips, lifetime earnings, rating,
 * plus the most recent jobs with drill-down into the full tools. Board is an
 * enhancement — any failure renders nothing rather than blocking home.
 */
export default function TransportHomeBoard() {
  const t = useT();
  const navigate = useNavigate();
  const [data, setData] = useState<{
    analytics: TransportAnalytics;
    jobs: TransportBooking[];
  } | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let live = true;
    const load = async () => {
      try {
        const [analytics, bookings] = await Promise.all([
          transportAnalytics().catch(() => null),
          transportBookings().catch(() => ({
            data: [] as TransportBooking[],
            page: 1,
            pageSize: 10,
            total: 0,
          })),
        ]);
        if (!live) return;
        if (!analytics) {
          setFailed(true);
          return;
        }
        const jobs = [...bookings.data]
          .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''))
          .slice(0, 4);
        setData({ analytics, jobs });
      } catch {
        if (live) setFailed(true);
      }
    };
    void load();
    return () => {
      live = false;
    };
  }, []);

  if (failed) return null; // board is an enhancement — never block the home page

  const statButtonStyle: CSSProperties = {
    textAlign: 'left',
    cursor: 'pointer',
    fontFamily: 'inherit',
  };

  return (
    <section className="dash-section" style={{ marginTop: 14 }}>
      <div className="trade-stats-grid">
        <button
          type="button"
          className="trade-stat"
          style={statButtonStyle}
          onClick={() => navigate('/dashboard/p/vehicleManage')}
        >
          <div className="trade-stat-label">{t('trHomeVehicles')}</div>
          <div className="trade-stat-value">{data?.analytics.totalVehicles ?? '…'}</div>
        </button>
        <button
          type="button"
          className="trade-stat"
          style={statButtonStyle}
          onClick={() => navigate('/dashboard/p/bookingInbox')}
        >
          <div className="trade-stat-label">{t('trHomeActive')}</div>
          <div className="trade-stat-value">{data?.analytics.activeTripsCount ?? '…'}</div>
          <div className="trade-hint">{t('trHomeTrips')}</div>
        </button>
        <button
          type="button"
          className="trade-stat"
          style={statButtonStyle}
          onClick={() => navigate('/dashboard/p/settlements')}
        >
          <div className="trade-stat-label">{t('trHomeEarnings')}</div>
          <div className="trade-stat-value">
            {data ? inr(data.analytics.totalGrossRevenue ?? ZERO) : '…'}
          </div>
        </button>
        <button
          type="button"
          className="trade-stat"
          style={statButtonStyle}
          onClick={() => navigate('/dashboard/p/transporterProfile')}
        >
          <div className="trade-stat-label">{t('trHomeRating')}</div>
          <div className="trade-stat-value">
            {data?.analytics.averageRating != null ? `★ ${data.analytics.averageRating}` : '…'}
          </div>
        </button>
      </div>

      <div className="trade-section-title" style={{ marginTop: 6 }}>
        {t('trRecentJobs')}
      </div>
      <div className="trade-list" style={{ marginTop: 0 }}>
        {(data?.jobs ?? []).map((b) => (
          <button
            key={b.id}
            type="button"
            className="trade-card"
            style={{ padding: '10px 12px' }}
            onClick={() => navigate(`/dashboard/p/transport/trips/${b.id}`)}
          >
            <div className="trade-card-row">
              <span className="trade-card-title" style={{ fontSize: 14 }}>
                {b.pickup} → {b.drop}
              </span>
              <StatusPill status={b.status} />
            </div>
            <div className="trade-card-row">
              <span className="trade-card-sub">
                {[b.commodity, b.vehicleType].filter(Boolean).join(' · ') || t('trTripTitle')}
              </span>
              <span className="trade-card-amount" style={{ fontSize: 14 }}>
                {inr(b.fare)}
              </span>
            </div>
          </button>
        ))}
        {data && data.jobs.length === 0 ? <p className="trade-hint">{t('trEmptyJobs')}</p> : null}
      </div>

      <div className="trade-actions-row" style={{ marginTop: 12 }}>
        <button
          type="button"
          className="av-btn av-btn-primary"
          onClick={() => navigate('/dashboard/p/loadBoard')}
        >
          🚛 {t('tool_loadBoard')} →
        </button>
        <button
          type="button"
          className="av-btn av-btn-ghost"
          onClick={() => navigate('/dashboard/p/bookingInbox')}
        >
          📥 {t('tool_bookingInbox')}
        </button>
      </div>
    </section>
  );
}
