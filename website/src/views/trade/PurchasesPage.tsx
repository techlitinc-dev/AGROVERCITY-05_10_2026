import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import EmptyState from '../../components/trade/EmptyState';
import StatusPill from '../../components/trade/StatusPill';
import ToolShell from '../../components/trade/ToolShell';
import { amountDue, myPurchases, paidSoFar, type Purchase } from '../../lib/api/purchases';
import { inr } from '../../lib/api/trade';
import { useT } from '../../lib/i18n';
import '../../theme/trade.css';

const fmtDate = (iso: string): string =>
  new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

const unitLabel = (t: (key: string) => string, unit: string): string =>
  unit === 'kg' ? t('unitKg') : t('unitQuintal');

/**
 * Purchases — the booking ledger for both sides of the deal. Selling / Buying
 * tabs (farmer vs buyer role), one card per booking with paid / due summary;
 * the booking state machine lives on the detail page.
 */
export default function PurchasesPage() {
  const t = useT();
  const navigate = useNavigate();

  const [tab, setTab] = useState<'farmer' | 'buyer'>('farmer');
  const [purchases, setPurchases] = useState<Purchase[] | null>(null);
  const [failed, setFailed] = useState(false);

  const load = useCallback(() => {
    setFailed(false);
    setPurchases(null);
    myPurchases(tab)
      .then((res) => setPurchases(res.data))
      .catch(() => setFailed(true));
  }, [tab]);

  useEffect(load, [load]);

  return (
    <ToolShell toolId="purchases">
      <div className="trade-filter-row">
        <button
          type="button"
          className={`av-chip${tab === 'farmer' ? ' selected' : ''}`}
          onClick={() => setTab('farmer')}
        >
          {t('purchasesAsFarmer')}
        </button>
        <button
          type="button"
          className={`av-chip${tab === 'buyer' ? ' selected' : ''}`}
          onClick={() => setTab('buyer')}
        >
          {t('purchasesAsBuyer')}
        </button>
      </div>

      {purchases === null && !failed ? <p className="trade-hint">{t('commonLoading')}</p> : null}

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

      {purchases !== null && purchases.length === 0 ? (
        <EmptyState icon="📦" titleKey="purchasesEmpty" bodyKey="purchasesEmptyBody" />
      ) : null}

      <div className="trade-list">
        {purchases?.map((purchase) => {
          const counterparty = tab === 'farmer' ? purchase.buyerName : purchase.farmerName;
          const counterpartyLabel = tab === 'farmer' ? t('purchaseBuyer') : t('purchaseFarmer');
          return (
            <div
              key={purchase.id}
              className="trade-card"
              role="button"
              tabIndex={0}
              onClick={() => navigate(`/dashboard/p/purchases/${purchase.id}`)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') navigate(`/dashboard/p/purchases/${purchase.id}`);
              }}
            >
              <div className="trade-card-row">
                <span className="trade-card-title">
                  {purchase.crop} · {purchase.quantity} {unitLabel(t, purchase.unit)}
                </span>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                  {purchase.status !== 'completed' && purchase.status !== 'cancelled' ? (
                    <button
                      type="button"
                      className="av-chip"
                      aria-label={t('chatOpenCta')}
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate(`/dashboard/p/purchases/${purchase.id}/chat`);
                      }}
                    >
                      💬 {t('chatTitle')}
                    </button>
                  ) : null}
                  <StatusPill status={purchase.status} />
                </span>
              </div>
              <div className="trade-card-row">
                <span className="trade-card-sub">
                  {counterpartyLabel}: {counterparty} · {fmtDate(purchase.createdAt)}
                </span>
                <span className="trade-card-amount">{inr(purchase.totalAmount)}</span>
              </div>
              <div className="trade-card-row">
                <span className="trade-card-sub">
                  {t('purchasePaid')} {inr(paidSoFar(purchase))} · {t('purchaseDue')}{' '}
                  {inr(amountDue(purchase))}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </ToolShell>
  );
}
