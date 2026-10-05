import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import ToolShell from '../../components/trade/ToolShell';
import { toast } from '../../components/toast';
import {
  cancelCustomerOrder,
  fetchCustomerOrders,
  reportFarmerNoShow,
  verifyQrHandover,
  type CustomerOrder,
  type LogisticsMode,
} from '../../lib/api/emarketCustomer';
import { useT } from '../../lib/i18n';
import '../../theme/trade.css';

const ORDER_STATUS_KEYS: Record<string, string> = {
  confirmed: 'emarketStatusConfirmed',
  deposit_pending: 'emarketStatusDepositPending',
  in_fulfillment: 'emarketStatusInFulfillment',
  dispatched: 'emarketStatusDispatched',
  in_transit: 'emarketStatusInTransit',
  delivered: 'emarketStatusDelivered',
  settled: 'emarketStatusDelivered',
  disputed: 'emarketStatusDisputed',
  cancelled: 'emarketStatusCancelled',
  handover: 'emarketQrHandoverDone',
};

const ESCROW_STATUS_KEYS: Record<string, string> = {
  unfunded: 'emarketEscrowUnfunded',
  funded: 'emarketEscrowFunded',
  partial_released: 'emarketEscrowPartialReleased',
  released: 'emarketEscrowReleased',
  frozen: 'emarketEscrowFrozen',
  refunded: 'emarketEscrowRefunded',
};

const LOGISTICS_LABEL_KEYS: Record<LogisticsMode, string> = {
  farmer_delivery: 'emarketLogisticsFarmerDelivery',
  customer_pickup: 'emarketLogisticsCustomerPickup',
  platform_transport: 'emarketLogisticsPlatformTransport',
};

function rupees(paisa: number): string {
  return (paisa / 100).toFixed(2);
}

/**
 * Order tracking (WS-03 task 3.7, spec C6) — GET /v1/customer/orders; parent
 * orders expand into their per-farmer child shipments, each with its own status
 * timeline, logistics mode, QR handover and inspection deep link. This is what
 * the `orderTracking` toolId resolves to.
 */
export default function OrdersPage() {
  const t = useT();
  const [orders, setOrders] = useState<CustomerOrder[] | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    fetchCustomerOrders()
      .then(setOrders)
      .catch(() => {
        setOrders([]);
        toast(t('emarketLoadFailed'), { error: true });
      });
  }, [t]);

  useEffect(() => {
    load();
  }, [load]);

  const handleHandover = async (orderId: string) => {
    try {
      await verifyQrHandover(orderId);
      toast(t('emarketQrHandoverDone'));
      load();
    } catch {
      toast(t('emarketQrHandoverFailed'), { error: true });
    }
  };

  const handleCancel = async (orderId: string) => {
    try {
      await cancelCustomerOrder(orderId);
      toast(t('emarketOrderCancelled'));
      load();
    } catch {
      toast(t('emarketCancelFailed'), { error: true });
    }
  };

  const handleNoShow = async (orderId: string) => {
    try {
      await reportFarmerNoShow(orderId);
      toast(t('emarketNoShowReported'));
      load();
    } catch {
      toast(t('emarketActionFailed'), { error: true });
    }
  };

  const renderShipment = (order: CustomerOrder, child: boolean) => (
    <div
      key={order.id}
      style={{
        padding: 12,
        border: '1px solid #E5E7EB',
        borderRadius: 10,
        display: 'grid',
        gap: 4,
        marginLeft: child ? 16 : 0,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
        <strong>
          {child ? `${t('emarketChildOrder')} · ` : ''}
          {order.crop}
        </strong>
        <span className="av-chip" style={{ fontSize: 12 }}>
          {t(ORDER_STATUS_KEYS[order.status] ?? 'emarketStatusOpen')}
        </span>
      </div>
      <div style={{ fontSize: 13, color: '#6B7280' }}>
        {t('emarketFarmerName')}: {order.farmerName} • {t('emarketFarmerId')}: {order.farmerId}
      </div>
      <div style={{ fontSize: 13 }}>
        {t('emarketOrderValue')}: ₹
        {order.orderValuePaisa !== undefined
          ? rupees(order.orderValuePaisa)
          : order.totalAmountRupees.toFixed(2)}
        {' • '}
        {t('emarketEscrow')}: {t(ESCROW_STATUS_KEYS[order.escrowStatus] ?? 'emarketEscrowUnfunded')}
      </div>
      <div style={{ fontSize: 13, color: '#6B7280' }}>
        {t('emarketLogisticsMode')}:{' '}
        {order.logisticsMode ? t(LOGISTICS_LABEL_KEYS[order.logisticsMode]) : t('commonNotAvailable')}
      </div>

      <div style={{ fontSize: 12, color: '#6B7280', marginTop: 4 }}>{t('emarketTimeline')}</div>
      {order.statusTimeline && order.statusTimeline.length > 0 ? (
        <ol style={{ margin: 0, paddingLeft: 18, fontSize: 13 }}>
          {order.statusTimeline.map((entry) => (
            <li key={`${order.id}-${entry.status}-${entry.at}`}>
              {t(ORDER_STATUS_KEYS[entry.status] ?? 'emarketStatusOpen')} — {entry.at}
            </li>
          ))}
        </ol>
      ) : (
        <p className="dash-empty-line">{t('commonNotAvailable')}</p>
      )}

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 4 }}>
        <button
          type="button"
          className="av-btn"
          disabled={busy || Boolean(order.qrVerifiedAt)}
          onClick={() => {
            setBusy(true);
            handleHandover(order.id).finally(() => setBusy(false));
          }}
        >
          {order.qrVerifiedAt ? t('emarketQrHandoverDone') : t('emarketQrHandover')}
        </button>
        <Link className="av-btn" to={`/dashboard/p/orders/${order.id}/inspect`}>
          {t('emarketInspect')}
        </Link>
        <button
          type="button"
          className="av-btn"
          disabled={busy || order.status === 'cancelled'}
          onClick={() => handleCancel(order.id)}
        >
          {t('emarketCancelOrder')}
        </button>
        <button type="button" className="av-btn" disabled={busy} onClick={() => handleNoShow(order.id)}>
          {t('emarketReportNoShow')}
        </button>
      </div>
    </div>
  );

  return (
    <ToolShell toolId="orderTracking">
      <section className="dash-section">
        <h3>{t('emarketOrders')}</h3>
        {orders === null ? (
          <p className="dash-empty-line">{t('emarketLoading')}</p>
        ) : orders.length === 0 ? (
          <p className="dash-empty-line">📦 {t('emarketNoOrders')}</p>
        ) : (
          <div style={{ display: 'grid', gap: 12 }}>
            {orders.map((order) => {
              if (!order.isParent) return renderShipment(order, false);
              const children = orders.filter((child) => child.parentOrderId === order.id);
              const open = expanded === order.id;
              return (
                <div key={order.id} style={{ display: 'grid', gap: 8 }}>
                  <button
                    type="button"
                    className="av-btn"
                    style={{ justifySelf: 'start' }}
                    onClick={() => setExpanded(open ? null : order.id)}
                  >
                    {order.crop} • {t('emarketOrderValue')}: ₹
                    {order.orderValuePaisa !== undefined
                      ? rupees(order.orderValuePaisa)
                      : order.totalAmountRupees.toFixed(2)}
                    {' • '}
                    {children.length} {t('emarketChildOrder')}
                  </button>
                  {open ? children.map((child) => renderShipment(child, true)) : null}
                </div>
              );
            })}
          </div>
        )}
      </section>
    </ToolShell>
  );
}
