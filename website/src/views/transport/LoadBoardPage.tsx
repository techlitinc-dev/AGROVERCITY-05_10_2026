import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import EmptyState from '../../components/trade/EmptyState';
import StatusPill from '../../components/trade/StatusPill';
import ToolShell from '../../components/trade/ToolShell';
import ChipSelect from '../../components/ChipSelect';
import { inr } from '../../lib/api/trade';
import { openLoads, type OpenLoad } from '../../lib/api/transport';
import { useT } from '../../lib/i18n';
import { useSessionStore } from '../../stores/session';
import '../../theme/trade.css';

const fmtDate = (iso: string): string =>
  new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

/**
 * Load board — open transport loads for everyone (plan §4.2). Farmers post
 * loads and track their own; transporters browse and bid. Shared page: no
 * profile ensure on mount, role self-heal happens on the action pages.
 */
export default function LoadBoardPage() {
  const t = useT();
  const navigate = useNavigate();
  const uid = useSessionStore((s) => s.user?.id ?? s.user?.uid);

  const [loads, setLoads] = useState<OpenLoad[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [tab, setTab] = useState<'open' | 'mine'>('open');
  const [cropFilter, setCropFilter] = useState('');

  const load = useCallback(() => {
    setFailed(false);
    openLoads()
      .then((res) => setLoads(res.data))
      .catch(() => setFailed(true));
  }, []);

  useEffect(load, [load]);

  const mine = (loads ?? []).filter((l) => l.userId === uid);
  const open = (loads ?? []).filter((l) => l.status === 'open' && l.userId !== uid);
  const shown = (tab === 'open' ? open : mine).filter(
    (l) => !cropFilter.trim() || l.crop.toLowerCase().includes(cropFilter.trim().toLowerCase())
  );

  return (
    <ToolShell toolId="loadBoard">
      <div className="trade-actions" style={{ marginTop: 4 }}>
        <button
          type="button"
          className="av-btn av-btn-primary"
          onClick={() => navigate('/dashboard/p/loadBoard/new')}
        >
          ＋ {t('trPostLoad')}
        </button>
      </div>

      <div className="av-field">
        <div className="trade-filter-row">
          <ChipSelect
            options={[t('trLoadBoard'), t('trMyLoads')]}
            selected={[tab === 'open' ? t('trLoadBoard') : t('trMyLoads')]}
            onToggle={(label) => setTab(label === t('trMyLoads') ? 'mine' : 'open')}
            single
          />
        </div>
        <input
          className="av-input"
          value={cropFilter}
          onChange={(e) => setCropFilter(e.target.value)}
          placeholder={t('trCommodity')}
          aria-label={t('trCommodity')}
        />
      </div>

      {loads === null && !failed ? <p className="trade-hint">{t('commonLoading')}</p> : null}

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

      {loads !== null && shown.length === 0 ? (
        <EmptyState
          icon="🚛"
          titleKey={tab === 'mine' ? 'trEmptyTrips' : 'trEmptyLoads'}
          bodyKey={tab === 'mine' ? 'trEmptyTripsBody' : 'trEmptyLoadsBody'}
          action={
            tab === 'open' ? (
              <button
                type="button"
                className="av-btn av-btn-primary"
                onClick={() => navigate('/dashboard/p/loadBoard/new')}
              >
                ＋ {t('trPostLoad')}
              </button>
            ) : undefined
          }
        />
      ) : null}

      <div className="trade-list">
        {shown.map((l) => (
          <div
            key={l.id}
            className="trade-card"
            role="button"
            tabIndex={0}
            onClick={() => navigate(`/dashboard/p/loadBoard/${l.id}`)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') navigate(`/dashboard/p/loadBoard/${l.id}`);
            }}
          >
            <div className="trade-card-row">
              <span className="trade-card-title">
                {l.crop} · {l.quantityQuintals} {t('unitQuintal')}
              </span>
              <StatusPill status={l.status} />
            </div>
            <div className="trade-card-row">
              <span className="trade-card-sub">
                {l.pickupLocation} → {l.dropLocation}
              </span>
              <span className="trade-card-amount">{inr(l.targetFare)}</span>
            </div>
            <div className="trade-card-row">
              <span className="trade-card-sub">
                {t('trPickupDate')}: {fmtDate(l.pickupDate)}
                {l.distanceKm ? ` · ${l.distanceKm} ${t('trKm')}` : ''}
              </span>
              {l.bidsCount ? (
                <span className="trade-card-sub">{t('trBidsCount', { count: l.bidsCount })}</span>
              ) : null}
            </div>
          </div>
        ))}
      </div>
    </ToolShell>
  );
}
