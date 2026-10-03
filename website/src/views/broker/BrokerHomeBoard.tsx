import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import InsightsPanel from '../../components/intelligence/InsightsPanel';
import ToolShell from '../../components/trade/ToolShell';
import { useEnsureProfile } from '../../components/trade/useEnsureProfile';
import { listDealMessages, inr, type Deal } from '../../lib/api/broker';
import { mandiCompare, type MandiCompareItem } from '../../lib/api/mandi';
import { useT } from '../../lib/i18n';
import { useBrokerStore } from '../../stores/broker';
import '../../theme/trade.css';
import '../../theme/broker.css';

interface BoardState {
  deals: Deal[];
  leadsTotal: number;
  totalEarned: number;
  activeCount: number;
  countersAwaiting: number;
  contractsWaiting: number;
  pickups: number;
}

const fmtUpdated = (iso: string): string =>
  new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });

/**
 * Broker home board — LIVE metric cards (Active Deals / Farmer Leads / Total
 * Commission), "today's actions" counters, a mandi benchmark strip for the
 * crops in open deals (hidden entirely if the mandi call fails — never show
 * fabricated numbers), and the 3-taps New Deal CTA (plan §2.8).
 */
export default function BrokerHomeBoard({ embedded }: { embedded?: boolean }) {
  const t = useT();
  const navigate = useNavigate();
  useEnsureProfile('broker');

  const [state, setState] = useState<BoardState | null>(null);
  const [failed, setFailed] = useState(false);
  const [benchmarks, setBenchmarks] = useState<MandiCompareItem[] | null>(null);

  const load = useCallback(() => {
    setFailed(false);
    const store = useBrokerStore.getState();
    Promise.all([
      store.deals === null ? store.refreshDeals() : Promise.resolve(store.deals),
      store.leads === null ? store.refreshLeads() : Promise.resolve(store.leads),
      store.commissions === null
        ? store.refreshCommissions()
        : Promise.resolve(store.commissions),
    ])
      .then(async ([dealList, leadList, summary]) => {
        // Counters awaiting: negotiating deals where the latest message is not from the broker.
        const negotiating = dealList.filter((d) => d.status === 'negotiating');
        const threads = await Promise.all(
          negotiating.slice(0, 10).map((d) => listDealMessages(d.id).catch(() => ({ data: [] })))
        );
        const countersAwaiting = threads.filter((thread) => {
          const latest = thread.data[thread.data.length - 1];
          return latest && latest.senderRole !== 'broker';
        }).length;
        setState({
          deals: dealList,
          leadsTotal: leadList.length,
          totalEarned: summary.totalEarned,
          activeCount: summary.activeDealsCount,
          countersAwaiting,
          contractsWaiting: dealList.filter((d) => d.status === 'contract_issued').length,
          pickups: dealList.filter((d) => d.status === 'accepted').length,
        });
      })
      .catch(() => setFailed(true));
  }, []);

  useEffect(load, [load]);

  const openCrops = useMemo(() => {
    const list = (state?.deals ?? []).filter((d) =>
      ['negotiating', 'contract_issued', 'accepted'].includes(d.status)
    );
    const seen = new Set<string>();
    const crops: Array<{ crop: string; qty: number }> = [];
    for (const d of list) {
      if (!seen.has(d.commodity)) {
        seen.add(d.commodity);
        crops.push({ crop: d.commodity, qty: d.quantityQuintals });
      }
      if (crops.length >= 3) break;
    }
    return crops;
  }, [state]);

  useEffect(() => {
    if (openCrops.length === 0) {
      setBenchmarks(null);
      return;
    }
    let live = true;
    Promise.all(openCrops.map((c) => mandiCompare(c.crop, c.qty).catch(() => null)))
      .then((results) => {
        if (!live) return;
        if (results.some((r) => r === null)) {
          setBenchmarks(null);
          return;
        }
        setBenchmarks(
          results.flatMap((r, i) =>
            (r?.data ?? []).slice(0, 1).map((item) => ({ ...item, crop: openCrops[i].crop }))
          ) as Array<MandiCompareItem & { crop?: string }>
        );
      });
    return () => {
      live = false;
    };
  }, [openCrops]);

  const body = (
    <>
      <div className="trade-actions" style={{ marginTop: 4 }}>
        <button
          type="button"
          className="av-btn av-btn-primary"
          onClick={() => navigate('/dashboard/p/broker/deals/new')}
        >
          ＋ {t('dealsNew')}
        </button>
      </div>

      {state === null && !failed ? <p className="trade-hint">{t('commonLoading')}</p> : null}
      {failed ? (
        <div className="trade-actions-row" style={{ alignItems: 'center', marginTop: 8 }}>
          <p className="trade-hint" style={{ flex: 1, marginTop: 0 }}>
            {t('tradeLoadFailed')}
          </p>
          <button type="button" className="av-btn av-btn-ghost" onClick={load}>
            ↻ {t('retry')}
          </button>
        </div>
      ) : null}

      {state !== null ? (
        <>
          <div className="trade-stats-grid">
            <Link className="trade-stat" to="/dashboard/p/deals">
              <p className="trade-stat-label">{t('bhActiveDeals')}</p>
              <p className="trade-stat-value">{state.activeCount}</p>
            </Link>
            <Link className="trade-stat" to="/dashboard/p/buyers">
              <p className="trade-stat-label">{t('bhFarmerLeads')}</p>
              <p className="trade-stat-value">{state.leadsTotal}</p>
            </Link>
            <Link className="trade-stat" to="/dashboard/p/commissions">
              <p className="trade-stat-label">{t('bhTotalCommission')}</p>
              <p className="trade-stat-value">{inr(state.totalEarned)}</p>
            </Link>
          </div>

          <p className="trade-section-title">{t('bhTodaysActions')}</p>
          <div className="trade-list" style={{ marginTop: 0 }}>
            <Link className="trade-card" to="/dashboard/p/deals">
              <div className="trade-card-row">
                <span className="trade-card-title">{t('bhCountersAwaiting')}</span>
                <span className="trade-card-amount">{state.countersAwaiting}</span>
              </div>
            </Link>
            <Link className="trade-card" to="/dashboard/p/deals">
              <div className="trade-card-row">
                <span className="trade-card-title">{t('bhContractsWaiting')}</span>
                <span className="trade-card-amount">{state.contractsWaiting}</span>
              </div>
            </Link>
            <Link className="trade-card" to="/dashboard/p/deals">
              <div className="trade-card-row">
                <span className="trade-card-title">{t('bhPickupsScheduled')}</span>
                <span className="trade-card-amount">{state.pickups}</span>
              </div>
            </Link>
          </div>

          {benchmarks !== null && benchmarks.length > 0 ? (
            <>
              <p className="trade-section-title">{t('bhBenchmarkTitle')}</p>
              <div className="trade-benchmark av-card">
                {benchmarks.map((b) => (
                  <div key={b.mandiName} className="trade-benchmark-row">
                    <span>
                      {(b as { crop?: string }).crop ?? ''} · {b.mandiName}
                    </span>
                    <span className="trade-benchmark-value">
                      {inr(b.modalPrice)}
                      {t('perQuintal')}
                    </span>
                  </div>
                ))}
              </div>
            </>
          ) : null}

          <p className="trade-section-title">{t('bhRecentDeals')}</p>
          {state.deals.length === 0 ? (
            <p className="trade-hint">{t('dealsEmptyBody')}</p>
          ) : (
            <div className="trade-list" style={{ marginTop: 0 }}>
              {state.deals.slice(0, 5).map((d) => (
                <Link key={d.id} className="trade-card" to={`/dashboard/p/broker/deals/${d.id}`}>
                  <div className="trade-card-row">
                    <span className="trade-card-title">
                      {d.commodity}
                      {d.variety ? ` · ${d.variety}` : ''}
                    </span>
                    <span className="trade-card-amount">
                      {inr(d.agreedRate)}
                      {t('perQuintal')}
                    </span>
                  </div>
                  <div className="trade-card-row">
                    <span className="trade-card-sub">
                      {d.sellerName} → {d.buyerName} · {fmtUpdated(d.updatedAt)}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          )}

          <InsightsPanel />
        </>
      ) : null}
    </>
  );

  if (embedded) return body;
  return <ToolShell toolId="brokerHome">{body}</ToolShell>;
}
