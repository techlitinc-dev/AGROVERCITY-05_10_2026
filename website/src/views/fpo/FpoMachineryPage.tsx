import { useCallback, useEffect, useState } from 'react';
import EmptyState from '../../components/trade/EmptyState';
import ToolShell from '../../components/trade/ToolShell';
import { getFpoMachinery, type FpoMachinery } from '../../lib/api/fpo';
import { useT } from '../../lib/i18n';
import '../../theme/trade.css';

/**
 * Shared-machinery calendar (robust.md §7.11). Consumes `/fpo/machinery`, which
 * joins the equipment module's slot data for `ownerType=fpo` machines over a
 * Monday-starting week — no slot logic is duplicated here.
 */
export default function FpoMachineryPage() {
  const t = useT();
  const [machines, setMachines] = useState<FpoMachinery[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setFailed(false);
    try {
      setMachines(await getFpoMachinery());
    } catch {
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const week = machines[0] ? Object.keys(machines[0].days)[0] : null;

  return (
    <ToolShell toolId="fpo" backTo="/dashboard/p/fpo">
      <section className="dash-section">
        <h3>{t('fpoMachineryTitle')}</h3>
        <p className="trade-hint">{t('fpoMachineryHint')}</p>
        {week ? <p className="trade-hint">{t('fpoMachineryWeek', { date: week })}</p> : null}
        {loading ? <p className="trade-hint">{t('commonLoading')}</p> : null}
        {failed ? <p className="trade-hint">{t('fpoMachineryLoadFailed')}</p> : null}
        {!loading && !failed && machines.length === 0 ? (
          <EmptyState icon="🚜" titleKey="fpoMachineryEmpty" />
        ) : null}

        {machines.map((machine) => (
          <div className="trade-card" key={machine.equipmentId} style={{ cursor: 'default' }}>
            <span className="trade-card-title">{machine.name}</span>
            {Object.entries(machine.days).map(([date, slots]) => (
              <div key={date} style={{ marginTop: 8 }}>
                <p className="trade-card-sub">{date}</p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {slots.map((slot) => (
                    <span
                      key={slot.id}
                      className="trade-card-sub"
                      style={{
                        padding: '2px 8px',
                        borderRadius: 12,
                        background: slot.status === 'available' ? '#DCFCE7' : '#F3F4F6',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {slot.slotName} ·{' '}
                      {slot.status === 'available' ? t('fpoSlotAvailable') : t('fpoSlotBooked')} ·{' '}
                      {t('fpoSlotPrice', { price: slot.priceRupees })}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ))}
      </section>
    </ToolShell>
  );
}
