import { useCallback, useEffect, useState } from 'react';
import ToolShell from '../../components/trade/ToolShell';
import {
  fmtQty,
  getProviderStats,
  listProviderFacilities,
  type ColdStorageFacility,
  type ProviderStats,
} from '../../lib/api/coldStorage';
import { useT } from '../../lib/i18n';
import '../../lib/i18n/locales/en.coldstorage';
import '../../lib/i18n/locales/hi.coldstorage';
import './coldstorage.css';

/**
 * Utilization analytics — per-chamber capacity vs occupancy for every facility
 * (from `GET /provider/facilities`), plus the portfolio totals from
 * `GET /provider/stats`. The occupancy summary list doubles as the at-a-glance
 * trend view (the router exposes no historical series).
 */
export default function UtilizationPage() {
  const t = useT();
  const [facilities, setFacilities] = useState<ColdStorageFacility[]>([]);
  const [stats, setStats] = useState<ProviderStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    setFailed(false);
    Promise.all([listProviderFacilities(), getProviderStats()])
      .then(([rows, statsData]) => {
        setFacilities(rows);
        setStats(statsData);
      })
      .catch(() => setFailed(true))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const totalChambers = facilities.reduce((sum, f) => sum + f.chambers.length, 0);

  return (
    <ToolShell toolId="coldStorageHome" backTo="/dashboard">
      <div className="cs-wrap">
        <div className="cs-section">
          <span className="cs-section-title">📊 {t('csUtilTitle')}</span>
          {loading ? <p className="cs-hint">{t('commonLoading')}</p> : null}
          {failed ? <p className="cs-hint">{t('csLoadFailed')}</p> : null}
          {stats ? (
            <div className="cs-stats-grid">
              <div className="cs-stat">
                <div className="cs-stat-label">{t('csStatUtilization')}</div>
                <div className="cs-stat-value">{stats.occupancyPercent}%</div>
                <div className="cs-progress">
                  <div className="cs-progress-fill" style={{ width: `${Math.min(100, stats.occupancyPercent)}%` }} />
                </div>
              </div>
              <div className="cs-stat">
                <div className="cs-stat-label">{t('csStatTotalCapacity')}</div>
                <div className="cs-stat-value">
                  {stats.totalCapacityMT}
                  <small> {t('csUnitMT')}</small>
                </div>
              </div>
              <div className="cs-stat">
                <div className="cs-stat-label">{t('csStatOccupied')}</div>
                <div className="cs-stat-value">
                  {stats.occupiedMT}
                  <small> {t('csUnitMT')}</small>
                </div>
              </div>
              <div className="cs-stat">
                <div className="cs-stat-label">{t('csStatAvailable')}</div>
                <div className="cs-stat-value">
                  {stats.availableMT}
                  <small> {t('csUnitMT')}</small>
                </div>
              </div>
              <div className="cs-stat">
                <div className="cs-stat-label">{t('csChambersTitle')}</div>
                <div className="cs-stat-value">{totalChambers}</div>
              </div>
            </div>
          ) : null}
        </div>

        <div className="cs-section">
          <span className="cs-section-title">{t('csUtilPerChamber')}</span>
          {!loading && !failed && totalChambers === 0 ? (
            <p className="cs-empty">📊 {t('csUtilEmpty')}</p>
          ) : null}
          {facilities
            .filter((f) => f.chambers.length > 0)
            .map((f) => (
              <div key={f.id} style={{ marginBottom: 12 }}>
                <div className="cs-hint" style={{ fontWeight: 600 }}>
                  {f.name}
                </div>
                <table className="cs-table">
                  <thead>
                    <tr>
                      <th>{t('csUtilChamber')}</th>
                      <th>{t('csUtilCapacity')}</th>
                      <th>{t('csUtilOccupied')}</th>
                      <th>{t('csUtilPercent')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {f.chambers.map((c) => {
                      const percent =
                        c.capacityMT > 0 ? Math.round((c.currentOccupancyMT / c.capacityMT) * 1000) / 10 : 0;
                      return (
                        <tr key={c.id}>
                          <td>{c.name}</td>
                          <td>{fmtQty(c.capacityMT)}</td>
                          <td>{fmtQty(c.currentOccupancyMT)}</td>
                          <td>
                            {percent}%
                            <div className="cs-progress">
                              <div className="cs-progress-fill" style={{ width: `${Math.min(100, percent)}%` }} />
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ))}
        </div>
      </div>
    </ToolShell>
  );
}
