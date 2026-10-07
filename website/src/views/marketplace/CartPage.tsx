import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import EmptyState from '../../components/trade/EmptyState';
import ToolShell from '../../components/trade/ToolShell';
import { toast } from '../../components/toast';
import { isApiError } from '../../lib/api/client';
import {
  MARKETPLACE_ROUTES,
  formatPaisa,
  getCart,
  removeCartItem,
  updateCartItem,
  type Cart,
} from '../../lib/api/marketplace';
import { useT } from '../../lib/i18n';
import '../../theme/trade.css';

/**
 * Cart (phase-05 WS-03 task 3.8). Line edits send Idempotency-Key (via client).
 * The running total is the SERVER total in integer paisa — authoritative at
 * checkout (rule 6).
 */
export default function CartPage() {
  const t = useT();
  const [cart, setCart] = useState<Cart | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      setCart(await getCart());
    } catch {
      setCart({ lines: [], serverTotalPaisa: 0 });
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const mutate = async (action: () => Promise<Cart>, okKey?: string) => {
    setBusy(true);
    try {
      setCart(await action());
      if (okKey) toast(t(okKey));
    } catch (error) {
      toast(isApiError(error) ? error.message : t('marketplaceActionFailed'), { error: true });
    } finally {
      setBusy(false);
    }
  };

  return (
    <ToolShell toolId="marketplace">
      <section className="dash-section">
        <h3>{t('marketplaceCart')}</h3>
        {cart !== null && cart.lines.length === 0 ? (
          <EmptyState
            icon="🛒"
            titleKey="marketplaceCartEmpty"
            bodyKey="marketplaceCartEmptyBody"
            action={
              <Link className="av-btn av-btn-primary" to={MARKETPLACE_ROUTES.catalog}>
                {t('marketplaceContinueShopping')}
              </Link>
            }
          />
        ) : null}

        {cart?.lines.map((line) => (
          <div className="trade-card" key={line.productId} style={{ cursor: 'default' }}>
            <div className="trade-card-row">
              <span className="trade-card-title">{line.product.title}</span>
              <span className="trade-card-amount">{formatPaisa(line.product.discountedPrice * 100)}</span>
            </div>
            <div className="trade-actions-row">
              <button
                type="button"
                className="av-btn av-btn-ghost"
                aria-label={t('marketplaceQtyDecrease')}
                disabled={busy}
                onClick={() => void mutate(() => updateCartItem(line.productId, line.quantity - 1))}
              >
                −
              </button>
              <span className="trade-card-sub">
                {t('marketplaceQuantity')}: {line.quantity}
              </span>
              <button
                type="button"
                className="av-btn av-btn-ghost"
                aria-label={t('marketplaceQtyIncrease')}
                disabled={busy}
                onClick={() => void mutate(() => updateCartItem(line.productId, line.quantity + 1))}
              >
                +
              </button>
              <button
                type="button"
                className="av-btn av-btn-plain"
                disabled={busy}
                onClick={() => void mutate(() => removeCartItem(line.productId), 'marketplaceRemoved')}
              >
                {t('marketplaceRemove')}
              </button>
            </div>
          </div>
        ))}

        {cart !== null && cart.lines.length > 0 ? (
          <>
            <div className="trade-card" style={{ cursor: 'default' }}>
              <div className="trade-card-row">
                <span className="trade-card-title">{t('marketplaceCartTotal')}</span>
                <span className="trade-card-amount">{formatPaisa(cart.serverTotalPaisa)}</span>
              </div>
              <p className="trade-card-sub">{t('marketplaceCartServerNote')}</p>
            </div>
            <div className="trade-actions">
              <Link className="av-btn av-btn-primary" to={MARKETPLACE_ROUTES.checkout}>
                {t('marketplaceProceedCheckout')}
              </Link>
            </div>
          </>
        ) : null}
      </section>
    </ToolShell>
  );
}
