import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import ConfirmSheet from '../../components/trade/ConfirmSheet';
import EmptyState from '../../components/trade/EmptyState';
import StatusPill from '../../components/trade/StatusPill';
import ToolShell from '../../components/trade/ToolShell';
import { useEnsureProfile } from '../../components/trade/useEnsureProfile';
import { toast } from '../../components/toast';
import { isApiError } from '../../lib/api/client';
import { closeDemand, deleteDemand, listDemands, reopenDemand, type Demand } from '../../lib/api/demands';
import { inr } from '../../lib/api/trade';
import { useT } from '../../lib/i18n';
import '../../theme/trade.css';

/**
 * My demands (buyer, spec V4) — reverse listings manager: status filter chips,
 * edit / close / reopen / delete actions, and the entry to post a new demand.
 */

const STATUS_FILTERS = [
  { value: 'all', labelKey: 'commonAll' },
  { value: 'open', labelKey: 'status_open' },
  { value: 'closed', labelKey: 'status_closed' },
  { value: 'fulfilled', labelKey: 'status_fulfilled' },
] as const;

type StatusFilter = (typeof STATUS_FILTERS)[number]['value'];

const fmtDate = (value: string): string =>
  new Date(value).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

export default function DemandsPage() {
  const t = useT();
  const navigate = useNavigate();
  useEnsureProfile('seller');

  const [demands, setDemands] = useState<Demand[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [filter, setFilter] = useState<StatusFilter>('all');
  const [closing, setClosing] = useState<Demand | null>(null);
  const [deleting, setDeleting] = useState<Demand | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    setFailed(false);
    listDemands({ status: 'all' })
      .then((res) => setDemands(res.data))
      .catch(() => setFailed(true));
  }, []);

  useEffect(load, [load]);

  const visible = (demands ?? []).filter((d) => filter === 'all' || d.status === filter);

  const confirmClose = async () => {
    if (!closing || busy) return;
    setBusy(true);
    try {
      await closeDemand(closing.id);
      toast(t('demandsClose'));
      setClosing(null);
      load();
    } catch {
      toast(t('actionFailed'), { error: true });
    } finally {
      setBusy(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleting || busy) return;
    setBusy(true);
    try {
      await deleteDemand(deleting.id);
      toast(t('demandsDelete'));
      setDeleting(null);
      load();
    } catch (e) {
      setDeleting(null);
      if (isApiError(e) && e.code === 'DEMAND_HAS_OFFERS') {
        toast(t('demandsHasOffers'), { error: true });
      } else {
        toast(t('actionFailed'), { error: true });
      }
    } finally {
      setBusy(false);
    }
  };

  const reopen = async (demand: Demand) => {
    try {
      await reopenDemand(demand.id);
      toast(t('demandsReopen'));
      load();
    } catch {
      toast(t('actionFailed'), { error: true });
    }
  };

  return (
    <ToolShell toolId="demands">
      <div className="trade-actions" style={{ marginTop: 4 }}>
        <button
          type="button"
          className="av-btn av-btn-primary"
          onClick={() => navigate('/dashboard/p/demands/new')}
        >
          ＋ {t('demandsNew')}
        </button>
      </div>

      <div className="trade-filter-row">
        {STATUS_FILTERS.map((f) => (
          <button
            key={f.value}
            type="button"
            className={`av-chip${filter === f.value ? ' selected' : ''}`}
            onClick={() => setFilter(f.value)}
          >
            {t(f.labelKey)}
          </button>
        ))}
      </div>

      {demands === null && !failed ? <p className="trade-hint">{t('commonLoading')}</p> : null}

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

      {demands !== null && visible.length === 0 ? (
        <EmptyState
          icon="📣"
          titleKey="demandsEmpty"
          bodyKey="demandsEmptyBody"
          action={
            <button
              type="button"
              className="av-btn av-btn-primary"
              onClick={() => navigate('/dashboard/p/demands/new')}
            >
              ＋ {t('demandsNew')}
            </button>
          }
        />
      ) : null}

      <div className="trade-list">
        {visible.map((demand) => (
          <div
            key={demand.id}
            className="trade-card"
            role="button"
            tabIndex={0}
            onClick={() => {
              if (demand.status === 'open') navigate(`/dashboard/p/demands/${demand.id}/edit`);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && demand.status === 'open')
                navigate(`/dashboard/p/demands/${demand.id}/edit`);
            }}
          >
            <div className="trade-card-row">
              <span className="trade-card-title">
                {demand.crop} · {demand.quantity} {t('unitQuintal')}
              </span>
              <StatusPill status={demand.status} />
            </div>
            <div className="trade-card-row">
              <span className="trade-card-sub">
                {t('demandsGrade')}: {demand.qualityGrade} · {t(`freq_${demand.frequency}`)}
                {demand.offersCount > 0
                  ? ` · ${t('demandsOffersCount', { count: demand.offersCount })}`
                  : ''}
              </span>
              <span className="trade-card-amount">
                {inr(demand.maxPrice)}
                {t('perQuintal')}
              </span>
            </div>
            <div className="trade-card-row">
              <span className="trade-card-sub">
                {t('demandsNeededBy')}: {demand.neededBy ? fmtDate(demand.neededBy) : t('commonNotAvailable')}
                {demand.deliveryLocation ? ` · ${demand.deliveryLocation}` : ''}
              </span>
            </div>
            {demand.status === 'open' ? (
              <div className="trade-actions-row">
                <button
                  type="button"
                  className="av-btn av-btn-ghost"
                  onClick={(e) => {
                    e.stopPropagation();
                    navigate(`/dashboard/p/demands/${demand.id}/edit`);
                  }}
                >
                  {t('commonEdit')}
                </button>
                <button
                  type="button"
                  className="av-btn av-btn-ghost"
                  onClick={(e) => {
                    e.stopPropagation();
                    setClosing(demand);
                  }}
                >
                  {t('demandsClose')}
                </button>
                <button
                  type="button"
                  className="av-btn av-btn-plain"
                  style={{ background: 'var(--av-error)' }}
                  onClick={(e) => {
                    e.stopPropagation();
                    setDeleting(demand);
                  }}
                >
                  {t('demandsDelete')}
                </button>
              </div>
            ) : null}
            {demand.status === 'closed' ? (
              <div className="trade-actions-row">
                <button
                  type="button"
                  className="av-btn av-btn-ghost"
                  onClick={(e) => {
                    e.stopPropagation();
                    void reopen(demand);
                  }}
                >
                  {t('demandsReopen')}
                </button>
                <button
                  type="button"
                  className="av-btn av-btn-plain"
                  style={{ background: 'var(--av-error)' }}
                  onClick={(e) => {
                    e.stopPropagation();
                    setDeleting(demand);
                  }}
                >
                  {t('demandsDelete')}
                </button>
              </div>
            ) : null}
          </div>
        ))}
      </div>

      <ConfirmSheet
        open={closing !== null}
        title={t('demandsClose')}
        confirmLabel={t('demandsClose')}
        onConfirm={() => void confirmClose()}
        onClose={() => setClosing(null)}
        busy={busy}
      />
      <ConfirmSheet
        open={deleting !== null}
        title={t('demandsDelete')}
        body={t('demandsDeleteConfirm')}
        confirmLabel={t('demandsDelete')}
        onConfirm={() => void confirmDelete()}
        onClose={() => setDeleting(null)}
        busy={busy}
      />
    </ToolShell>
  );
}
