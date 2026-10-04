import { useCallback, useEffect, useState } from 'react';
import EmptyState from '../../components/trade/EmptyState';
import { useEnsureProfile } from '../../components/trade/useEnsureProfile';
import { fetchMyEquipment, type EquipmentItem } from '../../lib/api/equipmentOwner';
import { useT } from '../../lib/i18n';
import '../../theme/saas_personas.css';
import '../../theme/trade.css';

/**
 * Maintenance (equipment owner) — per-machine maintenance shell. Backend
 * maintenance-log endpoints land in task 4.11; until then this lists the
 * fleet with an honest note that service scheduling arrives with the
 * maintenance log (no dead actions).
 */
export default function MaintenancePage() {
  const t = useT();
  useEnsureProfile('equipmentRental');

  const [fleet, setFleet] = useState<EquipmentItem[] | null>(null);
  const [failed, setFailed] = useState(false);

  const load = useCallback(() => {
    setFailed(false);
    fetchMyEquipment()
      .then(setFleet)
      .catch(() => setFailed(true));
  }, []);

  useEffect(load, [load]);

  return (
    <>
      <div className="saas-container" style={{ padding: 0 }}>
        <div className="saas-compliance-callout">
          🛠️ {t('eqServiceDueHint')}
        </div>

        <div className="saas-panel">
          <div className="saas-panel-title">
            <span>{t('eqMaintenanceTitle')}</span>
          </div>

          {fleet === null && !failed ? <p className="trade-hint">{t('commonLoading')}</p> : null}

          {failed ? (
            <EmptyState
              icon="📡"
              titleKey="tradeLoadFailed"
              action={
                <button type="button" className="saas-btn-secondary" onClick={load}>
                  ↻ {t('retry')}
                </button>
              }
            />
          ) : null}

          {fleet !== null && fleet.length === 0 ? (
            <EmptyState icon="🔧" titleKey="eqEmptyFleet" bodyKey="eqEmptyFleetBody" />
          ) : null}

          {fleet !== null && fleet.length > 0 ? (
            <div className="saas-table-container">
              <table className="saas-table">
                <thead>
                  <tr>
                    <th>{t('eqMachineName')}</th>
                    <th>{t('eqBookedHoursWeek')}</th>
                    <th>{t('eqWeeklyIncome')}</th>
                    <th>{t('eqStatus')}</th>
                  </tr>
                </thead>
                <tbody>
                  {fleet.map((item) => (
                    <tr key={item.equipmentId}>
                      <td style={{ fontWeight: 600 }}>{item.name}</td>
                      <td>{item.bookedHoursThisWeek}</td>
                      <td style={{ fontWeight: 600 }}>₹{item.weeklyIncome.toLocaleString('en-IN')}</td>
                      <td>
                        <span className={`saas-badge ${item.status === 'active' ? 'saas-badge-success' : 'saas-badge-warning'}`}>
                          {item.status === 'active' ? t('eqActive') : t('eqInService')}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </div>
      </div>
    </>
  );
}
