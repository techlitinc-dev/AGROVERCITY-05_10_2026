import { useCallback, useEffect, useState } from 'react';
import LabeledTextField from '../../components/LabeledTextField';
import EmptyState from '../../components/trade/EmptyState';
import ToolShell from '../../components/trade/ToolShell';
import { toast } from '../../components/toast';
import { isApiError } from '../../lib/api/client';
import { joinFpoPool, listFpoPools, type FpoPool } from '../../lib/api/fpo';
import { useT } from '../../lib/i18n';
import '../../theme/trade.css';

/**
 * Group-buy pool cards (robust.md §7.11) with live progress bars. Progress is
 * recomputed on every fetch — never cached client-side — so the bar always
 * reflects the server's `bookedUnits` / `targetUnits`.
 */
export default function FpoPoolsPage() {
  const t = useT();
  const [pools, setPools] = useState<FpoPool[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [units, setUnits] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setFailed(false);
    try {
      setPools(await listFpoPools());
    } catch {
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const join = async (pool: FpoPool) => {
    const value = Number(units[pool.id] ?? '');
    if (!Number.isInteger(value) || value < 1) {
      toast(t('commonRequired'), { error: true });
      return;
    }
    setBusyId(pool.id);
    try {
      await joinFpoPool(pool.id, value);
      toast(t('fpoPoolJoined'));
      setUnits((prev) => ({ ...prev, [pool.id]: '' }));
      await load();
    } catch (e) {
      toast(isApiError(e) ? e.message : t('actionFailed'), { error: true });
    } finally {
      setBusyId(null);
    }
  };

  return (
    <ToolShell toolId="fpo" backTo="/dashboard/p/fpo">
      <section className="dash-section">
        <h3>{t('fpoPoolsTitle')}</h3>
        <p className="trade-hint">{t('fpoPoolsHint')}</p>
        {loading ? <p className="trade-hint">{t('commonLoading')}</p> : null}
        {failed ? <p className="trade-hint">{t('fpoPoolsLoadFailed')}</p> : null}
        {!loading && !failed && pools.length === 0 ? (
          <EmptyState icon="👥" titleKey="fpoPoolsEmpty" />
        ) : null}

        {pools.map((pool) => {
          const percent = pool.targetUnits > 0 ? Math.min(100, (pool.bookedUnits / pool.targetUnits) * 100) : 0;
          const full = pool.bookedUnits >= pool.targetUnits;
          return (
            <div className="trade-card" key={pool.id} style={{ cursor: 'default' }}>
              <div className="trade-card-row">
                <span className="trade-card-title">{pool.item}</span>
                <span className="trade-card-amount">
                  {t('fpoPoolProgress', { booked: pool.bookedUnits, target: pool.targetUnits })}
                </span>
              </div>
              <div
                role="progressbar"
                aria-valuenow={Math.round(percent)}
                aria-valuemin={0}
                aria-valuemax={100}
                style={{ height: 8, borderRadius: 4, background: '#E5E7EB', marginTop: 8 }}
              >
                <div
                  style={{
                    width: `${percent}%`,
                    height: '100%',
                    borderRadius: 4,
                    background: '#14B8A6',
                  }}
                />
              </div>
              <p className="trade-card-sub">
                {t('fpoPoolDiscount', { percent: pool.discountPercent })} · {t('fpoPoolDeadline', { date: pool.deadline })}
              </p>
              <p className="trade-card-sub">{pool.fpoName}</p>

              {full ? (
                <p className="trade-card-sub">✅ {t('fpoPoolFull')}</p>
              ) : (
                <div className="trade-actions-row" style={{ alignItems: 'flex-end' }}>
                  <LabeledTextField
                    label={t('fpoPoolUnits')}
                    value={units[pool.id] ?? ''}
                    onChange={(value) => setUnits((prev) => ({ ...prev, [pool.id]: value }))}
                    type="number"
                    inputMode="numeric"
                  />
                  <button
                    type="button"
                    className="av-btn av-btn-primary"
                    disabled={busyId === pool.id}
                    onClick={() => void join(pool)}
                  >
                    {busyId === pool.id ? <span className="av-spinner" aria-hidden /> : t('fpoPoolJoin')}
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </section>
    </ToolShell>
  );
}
