import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import EmptyState from '../../components/trade/EmptyState';
import ToolShell from '../../components/trade/ToolShell';
import { toast } from '../../components/toast';
import { isApiError } from '../../lib/api/client';
import {
  MARKETPLACE_ROUTES,
  createRazorpayOrder,
  formatPaisa,
  getCart,
  listAddresses,
  placeOrder,
  validateCouponForCart,
  verifyRazorpayPayment,
  type Address,
  type Cart,
  type CouponValidation,
} from '../../lib/api/marketplace';
import { openRazorpayCheckout } from '../../lib/api/razorpayCheckout';
import { useT } from '../../lib/i18n';
import '../../theme/trade.css';

/**
 * Checkout (phase-05 WS-03 task 3.10).
 *
 * Address picker + coupon apply (server math, integer paisa) + Razorpay
 * create/verify through the phase-00 rails. BNPL renders only as the labelled
 * partner placeholder — no fake flow. The purchase flow is never paywalled
 * (rule 5) and checkout carries Idempotency-Key (rule 7).
 */
export default function CheckoutPage() {
  const t = useT();
  const navigate = useNavigate();
  const [cart, setCart] = useState<Cart | null>(null);
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [addressId, setAddressId] = useState('');
  const [couponCode, setCouponCode] = useState('');
  const [coupon, setCoupon] = useState<CouponValidation | null>(null);
  const [paymentMethod, setPaymentMethod] = useState('cod');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const [loadedCart, loadedAddresses] = await Promise.all([getCart(), listAddresses()]);
      setCart(loadedCart);
      setAddresses(loadedAddresses);
      const preferred = loadedAddresses.find((a) => a.isDefault) ?? loadedAddresses[0];
      if (preferred) setAddressId(preferred.id);
    } catch {
      setCart({ lines: [], serverTotalPaisa: 0 });
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const applyCoupon = async () => {
    if (cart === null || !couponCode.trim()) return;
    try {
      const validation = await validateCouponForCart(couponCode.trim(), cart.serverTotalPaisa);
      setCoupon(validation);
      toast(validation.valid ? t('marketplaceCouponApplied') : t('marketplaceCouponInvalid'), {
        error: !validation.valid,
      });
    } catch (error) {
      toast(isApiError(error) ? error.message : t('marketplaceCouponInvalid'), { error: true });
    }
  };

  const submit = async () => {
    if (cart === null || cart.lines.length === 0) {
      toast(t('marketplaceCheckoutEmptyCart'), { error: true });
      return;
    }
    const address = addresses.find((a) => a.id === addressId);
    setBusy(true);
    try {
      const placed = await placeOrder({
        items: cart.lines.map((line) => ({ productId: line.productId, quantity: line.quantity })),
        paymentMethod,
        addressId: addressId || undefined,
        deliveryAddress: address
          ? `${address.line1}, ${address.village}, ${address.district}, ${address.state} - ${address.pincode}`
          : undefined,
        couponCode: coupon?.valid ? couponCode.trim() : undefined,
      });

      if (paymentMethod !== 'online') {
        toast(t('marketplaceOrderPlaced'));
        navigate(MARKETPLACE_ROUTES.orderDetail(placed.orderId));
        return;
      }

      const handle = await createRazorpayOrder(placed.orderId);
      await openRazorpayCheckout({
        orderId: handle.razorpayOrderId,
        amountPaisa: handle.amountPaisa,
        name: t('marketplaceTitle'),
        description: t('marketplaceOrderLabel'),
        onSuccess: (result) => {
          void verifyRazorpayPayment({
            orderId: placed.orderId,
            razorpayOrderId: result.razorpay_order_id,
            razorpayPaymentId: result.razorpay_payment_id,
            razorpaySignature: result.razorpay_signature,
          })
            .then(() => {
              toast(t('marketplacePaymentSuccess'));
              navigate(MARKETPLACE_ROUTES.orderDetail(placed.orderId));
            })
            .catch(() => toast(t('marketplacePaymentFailed'), { error: true }));
        },
        onDismiss: () => toast(t('marketplacePaymentCancelled'), { error: true }),
      });
    } catch (error) {
      toast(isApiError(error) ? error.message : t('marketplaceOrderFailed'), { error: true });
    } finally {
      setBusy(false);
    }
  };

  if (cart !== null && cart.lines.length === 0) {
    return (
      <ToolShell toolId="marketplace">
        <EmptyState
          icon="🛒"
          titleKey="marketplaceCheckoutEmptyCart"
          action={
            <Link className="av-btn av-btn-primary" to={MARKETPLACE_ROUTES.catalog}>
              {t('marketplaceContinueShopping')}
            </Link>
          }
        />
      </ToolShell>
    );
  }

  const discountPaisa = coupon?.valid ? coupon.discountPaisa : 0;
  const payablePaisa = coupon?.valid
    ? coupon.finalTotalPaisa
    : (cart?.serverTotalPaisa ?? 0);

  return (
    <ToolShell toolId="marketplace">
      <section className="dash-section">
        <h3>{t('marketplaceCheckoutAddress')}</h3>
        {addresses.length === 0 ? (
          <p className="trade-hint">
            {t('marketplaceCheckoutNoAddress')}{' '}
            <Link className="av-link" to="/dashboard/p/addressBook">
              {t('marketplaceAddressNew')}
            </Link>
          </p>
        ) : (
          addresses.map((address) => (
            <label className="trade-card" key={address.id} style={{ cursor: 'pointer' }}>
              <input
                type="radio"
                name="checkout-address"
                checked={addressId === address.id}
                onChange={() => setAddressId(address.id)}
              />{' '}
              {address.label} — {address.line1}, {address.village}, {address.district} - {address.pincode}
            </label>
          ))
        )}
      </section>

      <section className="dash-section">
        <h3>{t('marketplaceOrderSummary')}</h3>
        {cart?.lines.map((line) => (
          <p className="trade-card-sub" key={line.productId}>
            {line.product.title} × {line.quantity}
          </p>
        ))}
        <div className="trade-card" style={{ cursor: 'default' }}>
          <div className="trade-card-row">
            <span>{t('marketplaceSubtotal')}</span>
            <span className="trade-card-amount">{formatPaisa(cart?.serverTotalPaisa ?? 0)}</span>
          </div>
          <div className="trade-card-row">
            <span>{t('marketplaceCheckoutDiscount')}</span>
            <span className="trade-card-amount">−{formatPaisa(discountPaisa)}</span>
          </div>
          <div className="trade-card-row">
            <span className="trade-card-title">{t('marketplaceCheckoutPayable')}</span>
            <span className="trade-card-amount">{formatPaisa(payablePaisa)}</span>
          </div>
        </div>

        <div className="trade-actions">
          <input
            value={couponCode}
            placeholder={t('marketplaceCheckoutCoupon')}
            onChange={(e) => setCouponCode(e.target.value)}
          />
          <button type="button" className="av-btn av-btn-ghost" onClick={() => void applyCoupon()}>
            {t('marketplaceCouponApply')}
          </button>
        </div>
      </section>

      <section className="dash-section">
        <h3>{t('marketplaceCheckoutPayment')}</h3>
        <label className="trade-hint">
          <input
            type="radio"
            name="payment"
            checked={paymentMethod === 'cod'}
            onChange={() => setPaymentMethod('cod')}
          />{' '}
          {t('marketplacePayCod')}
        </label>
        <label className="trade-hint">
          <input
            type="radio"
            name="payment"
            checked={paymentMethod === 'online'}
            onChange={() => setPaymentMethod('online')}
          />{' '}
          {t('marketplacePayOnline')}
        </label>
        <p className="trade-hint">
          {t('marketplaceBnplComingPartner')} — {t('marketplaceBnplNote')}
        </p>
        <div className="trade-actions">
          <button
            type="button"
            className="av-btn av-btn-primary"
            disabled={busy || addresses.length === 0}
            onClick={() => void submit()}
          >
            {busy ? t('marketplaceLoading') : t('marketplacePlaceOrder')}
          </button>
        </div>
      </section>
    </ToolShell>
  );
}
