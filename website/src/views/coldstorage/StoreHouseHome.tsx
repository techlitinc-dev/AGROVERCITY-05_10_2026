import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import ToolShell from '../../components/trade/ToolShell';
import { fmtINR, getProviderStats, listProviderBookings, type ColdStorageBooking, type ProviderStats } from '../../lib/api/coldStorage';
import { useT } from '../../lib/i18n';
import '../../lib/i18n/locales/en.coldstorage';
import '../../lib/i18n/locales/hi.coldstorage';
import './coldstorage.css';

/**
 * StoreHouse console home — chamber utilization, pending approvals, lots
 * inwarded today, releases due and revenue accrued this month, sourced from
 * `GET /post-harvest/provider/stats` plus the provider bookings list (the
 * stats endpoint has no today/release buckets of its own).
 */

const QUICK_ACTIONS = [
  { to: '/storage/console/facilities', icon: '🏢', labelKey: 'csQaFacilities' },
  { to: '/storage/console/chambers', icon: '🚪', labelKey: 'csQaChambers' },
  { to: '/storage/console/bookings', icon: '📥', labelKey: 'csQaBookings' },
  { to: '/storage/console/inward', icon: '📦', labelKey: 'csQaInward' },
  { to: '/storage/console/release', icon: '🚚', labelKey: 'csQaRelease' },
  { to: '/storage/console/utilization', icon: '📊', labelKey: 'csQaUtilization' },
] as const;

function isToday(iso?: string): boolean {
  if (!iso) return false;
  return iso.slice(0, 10) === new Date().toISOString().slice(0, 10);
}

function isThisMonth(iso?: string): boolean {
  if (!iso) return false;
  return iso.slice(0, 7) === new Date().toISOString().slice(0, 7);
}

export default function StoreHouseHome() {
  const t = useT();
  const [stats, setStats] = useState<ProviderStats | null>(null);
  const [bookings, setBookings] = useState<ColdStorageBooking[]>([]);
  const [failed, setFailed] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    setFailed(false);
    Promise.all([getProviderStats(), listProviderBookings({ pageSize: 100 })])
      .then(([statsData, list]) => {
        setStats(statsData);
        setBookings(list.data);
      })
      .catch(() => setFailed(true))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const lotsInwardToday = bookings.filter((b) => isToday(b.inwardDate)).length;
  const releasesDue = bookings.filter((b) => b.status === 'release_requested').length;
  const revenueThisMonth = bookings
    .filter((b) => isToday(b.outwardDate) || isThisMonth(b.outwardDate))
    .reduce((sum, b) => sum + (b.rentPaid ?? 0), 0);

  return (
    <ToolShell toolId="coldStorageHome" backTo="/dashboard">
      <div className="cs-wrap">
        {loading ? <p className="cs-hint">{t('commonLoading')}</p> : null}

        {failed ? (
          <div className="cs-empty">
            <p>{t('csLoadFailed')}</p>
            <button type="button" className="av-btn av-btn-ghost" onClick={load}>
              ↻ {t('retry')}
            </button>
          </div>
        ) : null}

        {stats ? (
          <>
            <div className="cs-section">
              <span className="cs-section-title">❄️ {t('csHomeTitle')}</span>
              <div className="cs-stats-grid">
                <div className="cs-stat">
                  <div className="cs-stat-label">{t('csStatUtilization')}</div>
                  <div className="cs-stat-value">{stats.occupancyPercent}%</div>
                  <div className="cs-progress">
                    <div
                      className="cs-progress-fill"
                      style={{ width: `${Math.min(100, stats.occupancyPercent)}%` }}
                    />
                  </div>
                  <div className="cs-stat-sub">
                    {t('csOccupancyOf', { occupied: stats.occupiedMT, capacity: stats.totalCapacityMT })}
                  </div>
                </div>
                <div className="cs-stat">
                  <div className="cs-stat-label">{t('csStatPending')}</div>
                  <div className="cs-stat-value">{stats.pendingBookingsCount}</div>
                </div>
                <div className="cs-stat">
                  <div className="cs-stat-label">{t('csStatInwardToday')}</div>
                  <div className="cs-stat-value">{lotsInwardToday}</div>
                </div>
                <div className="cs-stat">
                  <div className="cs-stat-label">{t('csStatReleasesDue')}</div>
                  <div className="cs-stat-value">{releasesDue}</div>
                </div>
                <div className="cs-stat">
                  <div className="cs-stat-label">{t('csStatRevenueMonth')}</div>
                  <div className="cs-stat-value">{fmtINR(revenueThisMonth)}</div>
                  <div className="cs-stat-sub">{fmtINR(stats.totalAccruedRent)} {t('csStatTotalCapacity').toLowerCase()}</div>
                </div>
                <div className="cs-stat">
                  <div className="cs-stat-label">{t('csStatActiveLots')}</div>
                  <div className="cs-stat-value">{stats.activeStoredLotsCount}</div>
                </div>
                <div className="cs-stat">
                  <div className="cs-stat-label">{t('csStatTotalCapacity')}</div>
                  <div className="cs-stat-value">
                    {stats.totalCapacityMT}
                    <small> {t('csUnitMT')}</small>
                  </div>
                  <div className="cs-stat-sub">
                    {stats.availableMT} {t('csStatAvailable').toLowerCase()}
                  </div>
                </div>
                <div className="cs-stat">
                  <div className="cs-stat-label">{t('csStatFarmers')}</div>
                  <div className="cs-stat-value">{stats.totalFarmersCount}</div>
                </div>
              </div>
            </div>

            <div className="cs-section">
              <span className="cs-section-title">{t('csQaTitle')}</span>
              <div className="cs-qa-grid">
                {QUICK_ACTIONS.map((qa) => (
                  <Link key={qa.to} to={qa.to} className="cs-qa">
                    <span className="cs-qa-icon" aria-hidden>
                      {qa.icon}
                    </span>
                    <span>{t(qa.labelKey)}</span>
                  </Link>
                ))}
              </div>
            </div>
          </>
        ) : null}
      </div>
    </ToolShell>
  );
}
