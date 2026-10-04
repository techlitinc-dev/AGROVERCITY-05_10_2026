import { useCallback, useEffect, useState } from 'react';
import EmptyState from '../../components/trade/EmptyState';
import StatusPill from '../../components/trade/StatusPill';
import ToolShell from '../../components/trade/ToolShell';
import { useEnsureProfile } from '../../components/trade/useEnsureProfile';
import { inr } from '../../lib/api/trade';
import { listBulkOrders, type BulkOrder } from '../../lib/api/seller';
import { useT } from '../../lib/i18n';
import '../../theme/trade.css';

const fmtDate = (iso?: string | null): string =>
  iso
    ? new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
    : '—';

/**
 * Incoming bulk orders (S5) — wholesale buyers post bulk requirements to the
 * vyapari; this board lists them with quantity, target price and need-by date.
 */
export default function BulkOrdersPage() {
  const t = useT();
  useEnsureProfile('seller');

  const [orders, setOrders] = useState<BulkOrder[] | null>(null);
  const [openCount, setOpenCount] = useState(0);
  const [failed, setFailed] = useState(false);

  const load = useCallback(() => {
    setFailed(false);
    listBulkOrders()
      .then((res) => {
        setOrders(res.data);
        setOpenCount(res.openCount);
      })
      .catch(() => setFailed(true));
  }, []);

  useEffect(load, [load]);

  return (
    <ToolShell toolId="bulkOrders">
      <p className="trade-section-title">
        {t('bnBulkTitle')}
        {openCount > 0 ? ` (${openCount})` : ''}
      </p>

      {orders === null && !failed ? <p className="trade-hint">{t('commonLoading')}</p> : null}

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

      {orders !== null && orders.length === 0 ? <EmptyState icon="📦" titleKey="bnBulkEmpty" /> : null}

      <div className="trade-list">
        {orders?.map((order) => (
          <div key={order.id} className="trade-card" style={{ cursor: 'default' }}>
            <div className="trade-card-row">
              <span className="trade-card-title">{order.crop}</span>
              <StatusPill status={order.status} />
            </div>
            <div className="trade-card-row">
              <span className="trade-card-sub">
                {order.buyerName} · {order.quantityQuintals} {t('unitQuintal')}
                {order.neededBy ? ` · ${t('bnNeededBy')} ${fmtDate(order.neededBy)}` : ''}
              </span>
              <span className="trade-card-amount">
                {order.targetPricePerQuintal != null
                  ? `${inr(order.targetPricePerQuintal)}${t('perQuintal')}`
                  : '—'}
              </span>
            </div>
            {order.notes ? <p className="trade-hint">{order.notes}</p> : null}
          </div>
        ))}
      </div>
    </ToolShell>
  );
}
