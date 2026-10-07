import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import EmptyState from '../../components/trade/EmptyState';
import ToolShell from '../../components/trade/ToolShell';
import {
  MARKETPLACE_ROUTES,
  formatPaisa,
  listOrders,
  type MarketplaceOrder,
} from '../../lib/api/marketplace';
import { useT } from '../../lib/i18n';
import '../../theme/trade.css';

/** Orders list (phase-05 WS-03 task 3.11) — cursor-paginated buyer orders. */
export default function OrdersPage() {
  const t = useT();
  const [orders, setOrders] = useState<MarketplaceOrder[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async (cursor: string | null, append: boolean) => {
    setBusy(true);
    try {
      const page = await listOrders({ cursor, pageSize: 10 });
      setOrders((current) => (append ? [...current, ...page.data] : page.data));
      setNextCursor(page.nextCursor);
    } catch {
      if (!append) setOrders([]);
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    void load(null, false);
  }, [load]);

  return (
    <ToolShell toolId="marketplace">
      <section className="dash-section">
        <h3>{t('marketplaceOrders')}</h3>
        {orders.length === 0 ? (
          <EmptyState
            icon="📦"
            titleKey="marketplaceOrdersEmpty"
            bodyKey="marketplaceOrdersEmptyBody"
            action={
              <Link className="av-btn av-btn-primary" to={MARKETPLACE_ROUTES.catalog}>
                {t('marketplaceContinueShopping')}
              </Link>
            }
          />
        ) : (
          orders.map((order) => (
            <div className="trade-card" key={order.id} style={{ cursor: 'default' }}>
              <div className="trade-card-row">
                <span className="trade-card-title">
                  {t('marketplaceOrderLabel')} {order.id.slice(0, 8)}
                </span>
                <span className="trade-pill">{t(`marketplaceOrderStatus_${order.status}`)}</span>
              </div>
              <p className="trade-card-sub">
                {t('marketplaceOrderPlacedOn', { date: order.createdAt })}
              </p>
              <div className="trade-card-row">
                <span className="trade-card-sub">
                  {t('marketplaceOrderTotal')}: {formatPaisa(order.finalTotalPaisa)}
                </span>
                <Link className="av-btn av-btn-ghost" to={MARKETPLACE_ROUTES.orderDetail(order.id)}>
                  {t('marketplaceOrderView')}
                </Link>
              </div>
            </div>
          ))
        )}
        {nextCursor !== null ? (
          <button
            type="button"
            className="av-btn av-btn-ghost"
            disabled={busy}
            onClick={() => void load(nextCursor, true)}
          >
            {busy ? t('marketplaceLoading') : t('marketplaceLoadMore')}
          </button>
        ) : null}
      </section>
    </ToolShell>
  );
}
