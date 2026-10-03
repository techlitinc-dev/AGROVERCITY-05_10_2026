import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import ConfirmSheet from '../../components/trade/ConfirmSheet';
import EmptyState from '../../components/trade/EmptyState';
import StatusPill from '../../components/trade/StatusPill';
import ToolShell from '../../components/trade/ToolShell';
import { useEnsureProfile } from '../../components/trade/useEnsureProfile';
import { toast } from '../../components/toast';
import { inr, myLots, withdrawLot, type Lot } from '../../lib/api/trade';
import { useT } from '../../lib/i18n';
import '../../theme/trade.css';

/**
 * My lots (farmer) — the produce listing manager: list, status chips,
 * edit / withdraw actions, and the entry to create a new lot.
 */
export default function LotsPage() {
  const t = useT();
  const navigate = useNavigate();
  useEnsureProfile('farmer');

  const [lots, setLots] = useState<Lot[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [withdrawing, setWithdrawing] = useState<Lot | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    setFailed(false);
    myLots()
      .then(setLots)
      .catch(() => setFailed(true));
  }, []);

  useEffect(load, [load]);

  const confirmWithdraw = async () => {
    if (!withdrawing) return;
    setBusy(true);
    try {
      await withdrawLot(withdrawing.id);
      toast(t('lotsWithdraw'));
      setWithdrawing(null);
      load();
    } catch {
      toast(t('actionFailed'), { error: true });
    } finally {
      setBusy(false);
    }
  };

  return (
    <ToolShell toolId="sellProduce">
      <div className="trade-actions" style={{ marginTop: 4 }}>
        <button
          type="button"
          className="av-btn av-btn-primary"
          onClick={() => navigate('/dashboard/p/sellProduce/new')}
        >
          ＋ {t('lotsNew')}
        </button>
      </div>

      {lots === null && !failed ? <p className="trade-hint">{t('commonLoading')}</p> : null}

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

      {lots !== null && lots.length === 0 ? (
        <EmptyState
          icon="🌾"
          titleKey="lotsEmpty"
          bodyKey="lotsEmptyBody"
          action={
            <button
              type="button"
              className="av-btn av-btn-primary"
              onClick={() => navigate('/dashboard/p/sellProduce/new')}
            >
              ＋ {t('lotsNew')}
            </button>
          }
        />
      ) : null}

      <div className="trade-list">
        {lots?.map((lot) => (
          <div key={lot.id} className="trade-card" role="button" tabIndex={0}
            onClick={() => {
              if (lot.status !== 'sold') navigate(`/dashboard/p/sellProduce/${lot.id}/edit`);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && lot.status !== 'sold')
                navigate(`/dashboard/p/sellProduce/${lot.id}/edit`);
            }}
          >
            <div className="trade-card-row">
              <span className="trade-card-title">
                {lot.crop} · {lot.quantityQuintals} {t('unitQuintal')}
              </span>
              <StatusPill status={lot.status} />
            </div>
            <div className="trade-card-row">
              <span className="trade-card-sub">
                {t('lotsHarvestLabel')}: {lot.harvestDate || t('commonNotAvailable')}
                {lot.location?.village ? ` · ${lot.location.village}` : ''}
              </span>
              <span className="trade-card-amount">
                {inr(lot.expectedRate)}
                {t('perQuintal')}
              </span>
            </div>
            {lot.photos?.length ? (
              <div className="trade-card-photos">
                {lot.photos.slice(0, 4).map((url) => (
                  <img key={url} src={url} alt={lot.crop} loading="lazy" />
                ))}
              </div>
            ) : null}
            {lot.status === 'open' ? (
              <div className="trade-actions-row">
                <button
                  type="button"
                  className="av-btn av-btn-ghost"
                  onClick={(e) => {
                    e.stopPropagation();
                    navigate(`/dashboard/p/sellProduce/${lot.id}/edit`);
                  }}
                >
                  {t('commonEdit')}
                </button>
                <button
                  type="button"
                  className="av-btn av-btn-plain"
                  style={{ background: 'var(--av-error)' }}
                  onClick={(e) => {
                    e.stopPropagation();
                    setWithdrawing(lot);
                  }}
                >
                  {t('lotsWithdraw')}
                </button>
              </div>
            ) : null}
          </div>
        ))}
      </div>

      <ConfirmSheet
        open={withdrawing !== null}
        title={t('lotsWithdraw')}
        body={t('lotsWithdrawConfirm')}
        confirmLabel={t('lotsWithdraw')}
        onConfirm={() => void confirmWithdraw()}
        onClose={() => setWithdrawing(null)}
        busy={busy}
      />
    </ToolShell>
  );
}
