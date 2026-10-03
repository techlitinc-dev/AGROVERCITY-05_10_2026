import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import ToolShell from '../../../components/trade/ToolShell';
import { useEnsureProfile } from '../../../components/trade/useEnsureProfile';
import { toast } from '../../../components/toast';
import { isApiError } from '../../../lib/api/client';
import {
  advanceOrderStatus,
  fmtINR,
  fmtL,
  listOrders,
  type MilkSaleOrder,
  type SaleOrderStatus,
} from '../../../lib/api/dairy';
import { useT } from '../../../lib/i18n';
import '../../../lib/i18n/locales/en.dairy-sales';
import '../../../lib/i18n/locales/hi.dairy-sales';
import '../../../theme/dairy-sales.css';
import EmptyState from '../components/EmptyState';
import StatusChip from '../components/StatusChip';
import { fmtDate } from '../components/SlipCard';

const NEXT_STATUS: Record<SaleOrderStatus, 'delivered' | 'billed' | 'paid' | null> = {
  scheduled: 'delivered',
  delivered: 'billed',
  billed: 'paid',
  paid: null,
};

const NEXT_LABEL: Record<'delivered' | 'billed' | 'paid', string> = {
  delivered: 'dairyOrderMarkDelivered',
  billed: 'dairyOrderMarkBilled',
  paid: 'dairyOrderMarkPaid',
};

/**
 * Sale order detail (P6) — one card + the §5.5 status-advance button
 * (scheduled→delivered→billed→paid). 409 INVALID_TRANSITION refetches and
 * disables the stale button by re-rendering from the fresh order.
 */
export default function OrderDetailPage() {
  const t = useT();
  const navigate = useNavigate();
  const { orderId } = useParams<{ orderId: string }>();
  useEnsureProfile('dairyManager');

  const [order, setOrder] = useState<MilkSaleOrder | null>(null);
  const [failed, setFailed] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    if (!orderId) return;
    setFailed(false);
    listOrders({ pageSize: 500 })
      .then((res) => {
        const found = res.data.find((o) => o.id === orderId);
        if (!found) {
          setNotFound(true);
          return;
        }
        setOrder(found);
      })
      .catch(() => setFailed(true));
  }, [orderId]);

  useEffect(load, [load]);

  const advance = async (next: 'delivered' | 'billed' | 'paid') => {
    if (!order || busy) return;
    setBusy(true);
    try {
      await advanceOrderStatus(order.id, next);
      toast(t('dairyOrderUpdated'));
      load();
    } catch (e) {
      if (isApiError(e) && (e.code === 'INVALID_TRANSITION' || e.status === 409)) {
        toast(t('dairyOrderTransitionFailed'), { error: true });
      } else if (isApiError(e) && e.status === 404) {
        setNotFound(true);
      } else {
        toast(t('actionFailed'), { error: true });
      }
      load();
    } finally {
      setBusy(false);
    }
  };

  if (notFound) {
    return (
      <ToolShell toolId="dairyConsole" backTo="/dairy/console/sales/orders">
        <EmptyState
          icon="🔍"
          titleKey="dairyOrderNotFound"
          action={
            <button
              type="button"
              className="av-btn av-btn-ghost"
              onClick={() => navigate('/dairy/console/sales/orders')}
            >
              ← {t('dairyQaOrders')}
            </button>
          }
        />
      </ToolShell>
    );
  }

  const next = order ? NEXT_STATUS[order.status] : null;

  return (
    <ToolShell toolId="dairyConsole" backTo="/dairy/console/sales/orders">
      <div className="dairy-wrap">
        {!order && !failed ? <p className="dairy-hint">{t('commonLoading')}</p> : null}

        {failed ? (
          <EmptyState
            icon="📡"
            titleKey="dairyLoadFailed"
            action={
              <button type="button" className="av-btn av-btn-ghost" onClick={load}>
                ↻ {t('retry')}
              </button>
            }
          />
        ) : null}

        {order ? (
          <>
            <div className="dairy-card" style={{ marginTop: 12 }}>
              <div className="dairy-card-row">
                <span className="dairy-card-title">{order.customerName}</span>
                <StatusChip status={order.status} />
              </div>
              <div className="dairy-slip-grid">
                <div>
                  <div className="dairy-slip-cell-label">{t('dairyDate')}</div>
                  <div className="dairy-slip-cell-value">{fmtDate(order.orderDate)}</div>
                </div>
                <div>
                  <div className="dairy-slip-cell-label">{t('dairyFormShift')}</div>
                  <div className="dairy-slip-cell-value">{t(`dairyShift_${order.shift}`)}</div>
                </div>
                <div>
                  <div className="dairy-slip-cell-label">{t('dairyFormLiters')}</div>
                  <div className="dairy-slip-cell-value">{fmtL(order.liters)} L</div>
                </div>
                <div>
                  <div className="dairy-slip-cell-label">{t('dairyAmount')}</div>
                  <div className="dairy-slip-amount">{fmtINR(order.amount)}</div>
                </div>
              </div>
              {order.deliveredAt ? (
                <span className="dairy-card-sub">
                  {t('dairy_status_delivered')}: {fmtDate(order.deliveredAt)}
                </span>
              ) : null}
            </div>

            {next ? (
              <div className="dairy-actions">
                <button
                  type="button"
                  className="av-btn av-btn-primary"
                  onClick={() => void advance(next)}
                  disabled={busy}
                >
                  {busy ? <span className="av-spinner" aria-hidden /> : `✓ ${t(NEXT_LABEL[next])}`}
                </button>
              </div>
            ) : (
              <p className="dairy-hint">{t('dairyOrderPaidNote')}</p>
            )}
          </>
        ) : null}
      </div>
    </ToolShell>
  );
}
