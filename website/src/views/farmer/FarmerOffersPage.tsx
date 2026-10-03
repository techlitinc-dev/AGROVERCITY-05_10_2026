import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import DealMathCard from '../../components/broker/DealMathCard';
import DealStatusPill from '../../components/broker/DealStatusPill';
import EmptyState from '../../components/trade/EmptyState';
import PriceWithBenchmark from '../../components/trade/PriceWithBenchmark';
import ToolShell from '../../components/trade/ToolShell';
import { useEnsureProfile } from '../../components/trade/useEnsureProfile';
import {
  inr,
  listFarmerDealMessages,
  listFarmerDeals,
  type Deal,
} from '../../lib/api/broker';
import { useT } from '../../lib/i18n';
import '../../theme/trade.css';
import '../../theme/broker.css';

const fmtUpdated = (iso: string): string =>
  new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });

/**
 * Broker Offers (farmer) — incoming dalal offers matched to the farmer's
 * phone (P2). One card, one decision: who, what, qty, rate vs mandi, payout
 * math (plan §2.12). Unread = the latest message is from the broker and the
 * farmer hasn't replied after it (client calc, no backend read-tracking yet).
 */
export default function FarmerOffersPage() {
  const t = useT();
  useEnsureProfile('farmer');

  const [deals, setDeals] = useState<Deal[] | null>(null);
  const [unreadIds, setUnreadIds] = useState<Set<string>>(new Set());
  const [failed, setFailed] = useState(false);

  const load = useCallback(() => {
    setFailed(false);
    listFarmerDeals({ page: 1, pageSize: 50 })
      .then(async (res) => {
        setDeals(res.data);
        const threads = await Promise.all(
          res.data.slice(0, 20).map((d) =>
            listFarmerDealMessages(d.id)
              .then((r) => ({ id: d.id, messages: r.data }))
              .catch(() => ({ id: d.id, messages: [] as never[] }))
          )
        );
        const unread = new Set<string>();
        for (const thread of threads) {
          const latest = thread.messages[thread.messages.length - 1];
          if (latest && latest.senderRole === 'broker') unread.add(thread.id);
        }
        setUnreadIds(unread);
      })
      .catch(() => setFailed(true));
  }, []);

  useEffect(load, [load]);

  return (
    <ToolShell toolId="brokerOffers">
      {deals === null && !failed ? <p className="trade-hint">{t('commonLoading')}</p> : null}

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

      {deals !== null && deals.length === 0 ? (
        <EmptyState icon="🤝" titleKey="foEmpty" bodyKey="foEmptyBody" />
      ) : null}

      <div className="trade-list">
        {(deals ?? []).map((d) => (
          <Link key={d.id} className="trade-card" to={`/dashboard/p/farmer/deals/${d.id}`}>
            <div className="trade-card-row">
              <span className="trade-card-title">
                {unreadIds.has(d.id) ? <span className="broker-unread-dot" aria-hidden /> : null}
                {d.commodity}
                {d.variety ? ` · ${d.variety}` : ''}
                {d.grade ? ` · ${d.grade}` : ''}
              </span>
              <DealStatusPill status={d.status} />
            </div>
            <div className="trade-card-row">
              <span className="trade-card-sub">
                {t('foOfferFrom')}: {d.brokerName ?? t('commonNotAvailable')}
              </span>
              <span className="trade-card-amount">
                {inr(d.agreedRate)}
                {t('perQuintal')}
              </span>
            </div>
            <PriceWithBenchmark
              crop={d.commodity}
              quantityQuintals={d.quantityQuintals}
              price={d.agreedRate}
            />
            <DealMathCard
              quantityQuintals={d.quantityQuintals}
              agreedRate={d.agreedRate}
              pct={d.brokerCommissionPct}
              variant="farmer"
            />
            <div className="trade-card-row">
              <span className="trade-card-sub">
                {d.quantityQuintals} {t('unitQuintalShort')}
                {d.deliveryLocation ? ` · 📍 ${d.deliveryLocation}` : ''}
              </span>
              <span className="trade-card-sub">{fmtUpdated(d.updatedAt)}</span>
            </div>
          </Link>
        ))}
      </div>
    </ToolShell>
  );
}
