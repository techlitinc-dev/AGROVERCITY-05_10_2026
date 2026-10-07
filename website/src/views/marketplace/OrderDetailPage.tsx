import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import EmptyState from '../../components/trade/EmptyState';
import ToolShell from '../../components/trade/ToolShell';
import { toast } from '../../components/toast';
import { isApiError } from '../../lib/api/client';
import {
  MARKETPLACE_ROUTES,
  cancelOrder,
  formatPaisa,
  getOrder,
  getOrderTimeline,
  requestReturn,
  type MarketplaceOrder,
  type OrderEvent,
} from '../../lib/api/marketplace';
import { useT } from '../../lib/i18n';
import '../../theme/trade.css';

/**
 * Order detail + tracking timeline (phase-05 WS-03 task 3.11) — consumes
 * `/orders/{id}/timeline`. Cancel and return act on the order status machine.
 */
export default function OrderDetailPage() {
  const t = useT();
  const { orderId = '' } = useParams();
  const [order, setOrder] = useState<MarketplaceOrder | null>(null);
  const [timeline, setTimeline] = useState<OrderEvent[]>([]);
  const [reason, setReason] = useState('');
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const [loadedOrder, events] = await Promise.all([
        getOrder(orderId),
        getOrderTimeline(orderId).catch(() => [] as OrderEvent[]),
      ]);
      setOrder(loadedOrder);
      setTimeline(events.length > 0 ? events : loadedOrder.events);
    } catch {
      setFailed(true);
    }
  }, [orderId]);

  useEffect(() => {
    void load();
  }, [load]);

  const cancel = async () => {
    setBusy(true);
    try {
      await cancelOrder(orderId);
      toast(t('marketplaceOrderCancelled'));
      await load();
    } catch (error) {
      toast(isApiError(error) ? error.message : t('marketplaceActionFailed'), { error: true });
    } finally {
      setBusy(false);
    }
  };

  const doReturn = async () => {
    if (reason.trim().length < 3) {
      toast(t('marketplaceReturnReasonTooShort'), { error: true });
      return;
    }
    setBusy(true);
    try {
      await requestReturn(orderId, reason.trim());
      toast(t('marketplaceReturnSubmitted'));
      setReason('');
      await load();
    } catch (error) {
      toast(isApiError(error) ? error.message : t('marketplaceActionFailed'), { error: true });
    } finally {
      setBusy(false);
    }
  };

  if (failed) {
    return (
      <ToolShell toolId="marketplace">
        <EmptyState icon="📦" titleKey="marketplaceOrderNotFound" />
      </ToolShell>
    );
  }

  if (order === null) {
    return (
      <ToolShell toolId="marketplace">
        <p className="trade-hint">{t('marketplaceLoading')}</p>
      </ToolShell>
    );
  }

  return (
    <ToolShell toolId="marketplace">
      <section className="dash-section">
        <div className="trade-card" style={{ cursor: 'default' }}>
          <div className="trade-card-row">
            <span className="trade-card-title">
              {t('marketplaceOrderLabel')} {order.id.slice(0, 8)}
            </span>
            <span className="trade-pill">{t(`marketplaceOrderStatus_${order.status}`)}</span>
          </div>
          <p className="trade-card-sub">{t('marketplaceOrderPlacedOn', { date: order.createdAt })}</p>
          <p className="trade-card-sub">
            {t('marketplaceOrderPayment')}: {order.paymentMethod}
          </p>
          <p className="trade-card-sub">
            {t('marketplaceOrderRefund')}: {t(`marketplaceRefund_${order.refundStatus}`)}
          </p>
          {order.deliveryAddress ? (
            <p className="trade-card-sub">{order.deliveryAddress}</p>
          ) : null}
          <div className="trade-card-row">
            <span className="trade-card-title">{t('marketplaceOrderTotal')}</span>
            <span className="trade-card-amount">{formatPaisa(order.finalTotalPaisa)}</span>
          </div>
        </div>
      </section>

      <section className="dash-section">
        <h3>{t('marketplaceOrderTimeline')}</h3>
        {timeline.length === 0 ? (
          <p className="trade-hint">{t('marketplaceTimelineEmpty')}</p>
        ) : (
          timeline.map((event, index) => (
            <div className="trade-card" key={`${event.status}-${index}`} style={{ cursor: 'default' }}>
              <span className="trade-card-title">{event.status}</span>
              <span className="trade-card-sub">
                {event.at}
                {event.note ? ` · ${event.note}` : ''}
              </span>
            </div>
          ))
        )}
      </section>

      <section className="dash-section">
        <div className="trade-actions">
          {order.status === 'placed' || order.status === 'paid' ? (
            <button type="button" className="av-btn av-btn-plain" disabled={busy} onClick={() => void cancel()}>
              {t('marketplaceCancelOrder')}
            </button>
          ) : null}
          <Link className="av-btn av-btn-ghost" to={MARKETPLACE_ROUTES.returns}>
            {t('marketplaceRequestReturn')}
          </Link>
        </div>
        <div className="trade-actions">
          <input
            value={reason}
            placeholder={t('marketplaceReturnReasonPlaceholder')}
            onChange={(e) => setReason(e.target.value)}
          />
          <button type="button" className="av-btn av-btn-ghost" disabled={busy} onClick={() => void doReturn()}>
            {t('marketplaceReturnSubmit')}
          </button>
        </div>
      </section>
    </ToolShell>
  );
}
