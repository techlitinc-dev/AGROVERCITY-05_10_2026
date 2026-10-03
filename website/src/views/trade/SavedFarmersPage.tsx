import { useCallback, useEffect, useState } from 'react';
import ConfirmSheet from '../../components/trade/ConfirmSheet';
import EmptyState from '../../components/trade/EmptyState';
import ToolShell from '../../components/trade/ToolShell';
import { toast } from '../../components/toast';
import { listSavedFarmers, unsaveFarmer, type SavedFarmer } from '../../lib/api/discovery';
import { useT } from '../../lib/i18n';
import '../../theme/trade.css';

/**
 * Saved farmers (buyer network) — the vyapari's starred supply network built
 * from lot pages: list, rating badge, and remove via confirmation sheet.
 */
export default function SavedFarmersPage() {
  const t = useT();

  const [farmers, setFarmers] = useState<SavedFarmer[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [removing, setRemoving] = useState<SavedFarmer | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    setFailed(false);
    listSavedFarmers()
      .then((res) => setFarmers(res.data))
      .catch(() => setFailed(true));
  }, []);

  useEffect(load, [load]);

  const confirmRemove = async () => {
    if (!removing) return;
    setBusy(true);
    try {
      await unsaveFarmer(removing.farmerId);
      toast(t('savedRemoved'));
      setRemoving(null);
      load();
    } catch {
      toast(t('actionFailed'), { error: true });
    } finally {
      setBusy(false);
    }
  };

  return (
    <ToolShell toolId="savedFarmers">
      {farmers === null && !failed ? <p className="trade-hint">{t('commonLoading')}</p> : null}

      {failed ? (
        <EmptyState
          icon="📡"
          titleKey="tradeLoadFailed"
          action={
            <button type="button" className="av-btn av-btn-ghost" onClick={load}>
              ↻ {t('retry')}
            </button>
          }
        />
      ) : null}

      {farmers !== null && farmers.length === 0 ? (
        <EmptyState icon="⭐" titleKey="savedEmpty" bodyKey="savedEmptyBody" />
      ) : null}

      <div className="trade-list">
        {farmers?.map((f) => (
          <div key={f.farmerId} className="trade-card" style={{ cursor: 'default' }}>
            <div className="trade-card-row">
              <span className="trade-card-title">{f.farmerName}</span>
              {f.rating !== null ? (
                <span
                  className="trade-card-amount"
                  style={{ color: 'var(--av-gold-text)' }}
                >
                  ★ {f.rating}
                </span>
              ) : null}
            </div>
            <div className="trade-card-row">
              <span className="trade-card-sub">
                {[f.village, f.district].filter(Boolean).join(' · ') || t('commonNotAvailable')}
              </span>
            </div>
            <div className="trade-actions-row">
              <button
                type="button"
                className="av-btn av-btn-plain"
                style={{ background: 'var(--av-error)' }}
                onClick={() => setRemoving(f)}
              >
                {t('savedRemove')}
              </button>
            </div>
          </div>
        ))}
      </div>

      <ConfirmSheet
        open={removing !== null}
        title={t('savedRemove')}
        confirmLabel={t('savedRemove')}
        onConfirm={() => void confirmRemove()}
        onClose={() => setRemoving(null)}
        busy={busy}
      />
    </ToolShell>
  );
}
