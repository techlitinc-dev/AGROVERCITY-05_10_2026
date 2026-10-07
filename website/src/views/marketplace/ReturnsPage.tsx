import { useCallback, useEffect, useState } from 'react';
import EmptyState from '../../components/trade/EmptyState';
import ToolShell from '../../components/trade/ToolShell';
import { toast } from '../../components/toast';
import { isApiError } from '../../lib/api/client';
import {
  formatPaisa,
  listOrders,
  requestReturn,
  type MarketplaceOrder,
} from '../../lib/api/marketplace';
import { useT } from '../../lib/i18n';
import '../../theme/trade.css';

/** Returnable statuses (backend rule: returned requests start from delivered/paid). */
const RETURNABLE: MarketplaceOrder['status'][] = ['delivered', 'paid'];

/** Returns (phase-05 WS-03 task 3.12) — request a return and track its status. */
export default function ReturnsPage() {
  const t = useT();
  const [orders, setOrders] = useState<MarketplaceOrder[]>([]);
  const [reasons, setReasons] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const page = await listOrders({ pageSize: 50 });
      setOrders(page.data);
    } catch {
      setOrders([]);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const submit = async (order: MarketplaceOrder) => {
    const reason = (reasons[order.id] ?? '').trim();
    if (reason.length < 3) {
      toast(t('marketplaceReturnReasonTooShort'), { error: true });
      return;
    }
    setBusy(true);
    try {
      await requestReturn(order.id, reason);
      toast(t('marketplaceReturnSubmitted'));
      setReasons((current) => ({ ...current, [order.id]: '' }));
      await load();
    } catch (error) {
      toast(isApiError(error) ? error.message : t('marketplaceActionFailed'), { error: true });
    } finally {
      setBusy(false);
    }
  };

  const returnable = orders.filter((order) => RETURNABLE.includes(order.status));
  const existing = orders.filter((order) => order.returnStatus != null);

  return (
    <ToolShell toolId="marketplace">
      <section className="dash-section">
        <h3>{t('marketplaceReturns')}</h3>
        {returnable.length === 0 ? (
          <EmptyState icon="↩️" titleKey="marketplaceReturnsEmpty" bodyKey="marketplaceReturnsEmptyBody" />
        ) : (
          returnable.map((order) => (
            <div className="trade-card" key={order.id} style={{ cursor: 'default' }}>
              <div className="trade-card-row">
                <span className="trade-card-title">
                  {t('marketplaceOrderLabel')} {order.id.slice(0, 8)}
                </span>
                <span className="trade-card-amount">{formatPaisa(order.finalTotalPaisa)}</span>
              </div>
              <div className="trade-actions">
                <input
                  value={reasons[order.id] ?? ''}
                  placeholder={t('marketplaceReturnReasonPlaceholder')}
                  onChange={(e) => setReasons((current) => ({ ...current, [order.id]: e.target.value }))}
                />
                <button
                  type="button"
                  className="av-btn av-btn-primary"
                  disabled={busy || order.returnStatus != null}
                  onClick={() => void submit(order)}
                >
                  {t('marketplaceReturnSubmit')}
                </button>
              </div>
            </div>
          ))
        )}
      </section>

      <section className="dash-section">
        <h3>{t('marketplaceReturnExisting')}</h3>
        {existing.length === 0 ? (
          <p className="trade-hint">{t('marketplaceReturnNone')}</p>
        ) : (
          existing.map((order) => (
            <div className="trade-card" key={order.id} style={{ cursor: 'default' }}>
              <div className="trade-card-row">
                <span className="trade-card-title">
                  {t('marketplaceOrderLabel')} {order.id.slice(0, 8)}
                </span>
                <span className="trade-pill">
                  {t(`marketplaceReturn_${order.returnStatus}`)}
                </span>
              </div>
              <p className="trade-card-sub">{order.returnReason}</p>
            </div>
          ))
        )}
      </section>
    </ToolShell>
  );
}
