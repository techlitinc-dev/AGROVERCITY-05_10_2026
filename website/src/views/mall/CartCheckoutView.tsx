import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  AlertCircle,
  ArrowRight,
  Check,
  Clock,
  Coins,
  Leaf,
  MapPin,
  Minus,
  Plus,
  ShieldCheck,
  ShoppingCart,
  Sprout,
  Tag,
  Trash2,
} from 'lucide-react';
import { apiErrorMessage, customer, gamification, mall } from '../../lib/api';
import { useCartStore, type ProduceLogisticsMode } from '../../stores/cartStore';
import { useAuthStore } from '../../stores/authStore';
import { formatCurrency, formatPaisa } from '../../lib/utils';
import {
  asRecords,
  num,
  parseCartRows,
  str,
  toMallProduct,
  type ApiCartRow,
} from './mallMappers';

type PaymentMethod = 'upi' | 'cod' | 'bnpl';

interface AddressEntry {
  id: string;
  label: string;
  line1: string;
  village: string;
  district: string;
  state: string;
  pincode: string;
  isDefault?: boolean;
}

interface AppliedCoupon {
  code: string;
  discount: number;
}

interface RazorpayResponse {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
}

interface RazorpayInstance {
  open: () => void;
}

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => RazorpayInstance;
  }
}

const BNPL_INSTALLMENTS = 2;

const DEFAULT_DELIVERY_SLOTS = ['7–10 AM', '10–1 PM', '4–7 PM'];

const newIdempotencyKey = (): string =>
  typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `idem-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;

export const CartCheckoutView: React.FC = () => {
  const { items, updateQty, removeItem, clearCart, getSubtotal, produceLines, updateProduceQty, updateProduceLogistics, removeProduceLine, clearProduceCart, getProduceSubtotalPaisa } = useCartStore();
  const user = useAuthStore((s) => s.user);

  const [rows, setRows] = useState<ApiCartRow[]>([]);
  const [loadingCart, setLoadingCart] = useState(true);
  const [cartError, setCartError] = useState<string | null>(null);

  const [addresses, setAddresses] = useState<AddressEntry[]>([]);
  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(null);
  const [showAddressForm, setShowAddressForm] = useState(false);
  const [newAddress, setNewAddress] = useState({ label: 'Home', line1: '', village: '', district: '', state: 'Maharashtra', pincode: '' });
  const [savingAddress, setSavingAddress] = useState(false);

  const [coupons, setCoupons] = useState<Array<Record<string, unknown>>>([]);
  const [couponInput, setCouponInput] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState<AppliedCoupon | null>(null);
  const [couponMessage, setCouponMessage] = useState<string | null>(null);

  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('upi');
  const [placing, setPlacing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // SR 8/SR 19: delivery slot, Krushi Ratna coin redemption, plant-a-tree.
  const [deliverySlot, setDeliverySlot] = useState('');
  const [coinBalance, setCoinBalance] = useState(0);
  const [coinInput, setCoinInput] = useState('');
  const [coinsApplied, setCoinsApplied] = useState(false);
  const [plantTree, setPlantTree] = useState(false);
  const [orderResult, setOrderResult] = useState<{
    orderId: string;
    total: number;
    discount: number;
    paymentNote: string | null;
  } | null>(null);

  // FarmGate produce cart (multi-farmer /customer/cart/checkout).
  const [produceCheckout, setProduceCheckout] = useState<{
    parentOrderId: string;
    orders: Array<Record<string, unknown>>;
  } | null>(null);
  const [produceBusy, setProduceBusy] = useState(false);

  const navigate = useNavigate();

  const handleProduceCheckout = async () => {
    if (produceBusy || produceLines.length === 0) return;
    setProduceBusy(true);
    setError(null);
    try {
      const res = (await customer.checkout({
        lines: produceLines.map((l) => ({
          farmerId: l.farmerId,
          lotId: l.lotId,
          qty: l.qtyQuintals,
          logisticsMode: l.logisticsMode,
        })),
      })) as { parentOrderId?: string; orders?: Array<Record<string, unknown>> };
      clearProduceCart();
      setProduceCheckout({
        parentOrderId: str(res.parentOrderId),
        orders: Array.isArray(res.orders) ? res.orders : [],
      });
    } catch (e) {
      setError(apiErrorMessage(e));
    } finally {
      setProduceBusy(false);
    }
  };

  // --- cart: server is the source of truth; store stays as the optimistic mirror ---
  useEffect(() => {
    let mounted = true;
    const load = async () => {
      setLoadingCart(true);
      try {
        const cart = await mall.cart();
        if (!mounted) return;
        const serverRows = parseCartRows(cart);
        if (serverRows.length > 0) {
          setRows(serverRows);
        } else {
          // Seed the server cart from the local store (items added pre-login / offline).
          const local = useCartStore.getState().items;
          let synced: ApiCartRow[] = [];
          for (const item of local) {
            try {
              const updated = await mall.addToCart(item.product.id, item.quantity);
              synced = parseCartRows(updated);
            } catch {
              // leave the optimistic entry in place; it will sync on the next visit
            }
          }
          if (mounted) setRows(synced);
        }
      } catch (e) {
        if (mounted) setCartError(apiErrorMessage(e));
      } finally {
        if (mounted) setLoadingCart(false);
      }
    };
    void load();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    let mounted = true;
    Promise.all([
      mall.addresses().catch(() => [] as unknown[]),
      mall.coupons().catch(() => [] as unknown[]),
    ]).then(([addrPayload, couponPayload]) => {
      if (!mounted) return;
      const addrList = asRecords(addrPayload).map((a) => ({
        id: str(a.id),
        label: str(a.label, 'Address'),
        line1: str(a.line1),
        village: str(a.village),
        district: str(a.district),
        state: str(a.state),
        pincode: str(a.pincode),
        isDefault: Boolean(a.isDefault),
      }));
      setAddresses(addrList);
      if (addrList.length > 0) {
        setSelectedAddressId((addrList.find((a) => a.isDefault) ?? addrList[0]).id);
      }
      setCoupons(asRecords(couponPayload));
    });
    return () => {
      mounted = false;
    };
  }, []);

  // Krushi Ratna wallet balance for the coin-redemption control.
  useEffect(() => {
    let mounted = true;
    gamification
      .status()
      .then((payload) => {
        if (!mounted) return;
        const record = payload as Record<string, unknown>;
        setCoinBalance(Number(record.agriCoins ?? 0) || 0);
      })
      .catch(() => undefined);
    return () => {
      mounted = false;
    };
  }, []);

  // Delivery slots: the union of the cart items' product-level slots, else the
  // platform defaults.
  const slotOptions = useMemo(() => {
    const fromProducts = rows.flatMap((row) => {
      const slots = (row.product as Record<string, unknown> | undefined)?.deliverySlots;
      return Array.isArray(slots) ? slots.map(String) : [];
    });
    const unique = [...new Set(fromProducts)];
    return unique.length > 0 ? unique : DEFAULT_DELIVERY_SLOTS;
  }, [rows]);

  useEffect(() => {
    if (slotOptions.length > 0 && !slotOptions.includes(deliverySlot)) {
      setDeliverySlot(slotOptions[0]);
    }
  }, [slotOptions, deliverySlot]);

  const serverTotal = useMemo(
    () => rows.reduce((sum, r) => sum + num(toMallProduct(r.product).price) * r.quantity, 0),
    [rows]
  );
  const subtotal = rows.length > 0 ? serverTotal : getSubtotal();
  const discount = appliedCoupon?.discount ?? 0;
  // Coins are 1:1 rupees, capped at the merchandise total (after coupon).
  const coinMax = Math.max(0, Math.min(coinBalance, subtotal - discount));
  const requestedCoins = coinsApplied ? Math.min(Math.max(0, parseInt(coinInput, 10) || 0), coinMax) : 0;
  const coinDiscount = requestedCoins;
  const deliveryFee = subtotal - discount > 1500 || subtotal === 0 ? 0 : 99;
  const grandTotal = Math.max(0, subtotal - discount - coinDiscount + deliveryFee);
  const cartCount = rows.length > 0 ? rows.reduce((n, r) => n + r.quantity, 0) : items.reduce((n, i) => n + i.quantity, 0);

  const syncRowQty = async (row: ApiCartRow, quantity: number) => {
    const product = toMallProduct(row.product);
    if (quantity <= 0) {
      removeItem(row.productId);
      setRows((prev) => prev.filter((r) => r.productId !== row.productId));
      try {
        await mall.removeFromCart(row.productId);
      } catch {
        setCartError('Could not remove the item on the server — please retry.');
      }
      return;
    }
    updateQty(row.productId, quantity);
    setRows((prev) => prev.map((r) => (r.productId === row.productId ? { ...r, quantity } : r)));
    try {
      await mall.updateCartItem(row.productId, quantity);
    } catch {
      setCartError('Could not update the quantity on the server — please retry.');
    }
  };

  const handleApplyCoupon = async () => {
    const code = couponInput.trim();
    if (!code) return;
    setCouponMessage(null);
    try {
      const res = (await mall.validateCoupon(code, { cartTotal: Math.round(subtotal) })) as {
        valid?: boolean;
        discount?: number;
        message?: string;
      };
      if (res.valid) {
        setAppliedCoupon({ code, discount: num(res.discount) });
        setCouponMessage(`Coupon ${code} applied — you save ${formatCurrency(num(res.discount))}.`);
      } else {
        setAppliedCoupon(null);
        setCouponMessage(res.message ?? 'This coupon cannot be applied to your cart.');
      }
    } catch (e) {
      setCouponMessage(apiErrorMessage(e));
    }
  };

  const handleSaveAddress = async () => {
    setSavingAddress(true);
    try {
      const created = await mall.addAddress({
        label: newAddress.label,
        line1: newAddress.line1,
        village: newAddress.village,
        district: newAddress.district,
        state: newAddress.state,
        pincode: newAddress.pincode,
      });
      const entry: AddressEntry = {
        id: str((created as Record<string, unknown>).id),
        label: newAddress.label,
        line1: newAddress.line1,
        village: newAddress.village,
        district: newAddress.district,
        state: newAddress.state,
        pincode: newAddress.pincode,
      };
      setAddresses((prev) => [...prev, entry]);
      setSelectedAddressId(entry.id);
      setShowAddressForm(false);
    } catch (e) {
      setError(apiErrorMessage(e));
    } finally {
      setSavingAddress(false);
    }
  };

  const startRazorpay = (orderId: string): Promise<boolean> =>
    new Promise((resolve) => {
      mall
        .createPaymentOrder({ orderId })
        .then((res) => {
          const rzpRes = res as {
            razorpayOrderId?: string;
            amount?: number;
            currency?: string;
            keyId?: string;
          };
          if (!window.Razorpay || !rzpRes.keyId || !rzpRes.razorpayOrderId) {
            resolve(false);
            return;
          }
          const rzp = new window.Razorpay({
            key: rzpRes.keyId,
            order_id: rzpRes.razorpayOrderId,
            amount: rzpRes.amount,
            currency: rzpRes.currency ?? 'INR',
            name: 'Agrovercity Krishi Mall',
            description: `Order ${orderId}`,
            theme: { color: '#059669' },
            prefill: {
              name: user?.name ?? '',
              contact: (user as unknown as Record<string, unknown> | null)?.phone ?? '',
            },
            handler: (resp: RazorpayResponse) => {
              mall
                .verifyPayment({
                  orderId,
                  razorpayOrderId: resp.razorpay_order_id,
                  razorpayPaymentId: resp.razorpay_payment_id,
                  razorpaySignature: resp.razorpay_signature,
                })
                .then(() => resolve(true))
                .catch(() => resolve(false));
            },
            modal: { ondismiss: () => resolve(false) },
          });
          rzp.open();
        })
        .catch(() => resolve(false));
    });

  const handlePlaceOrder = async () => {
    setError(null);
    const selected = addresses.find((a) => a.id === selectedAddressId);
    if (rows.length === 0 && items.length === 0) {
      setError('Your cart is empty.');
      return;
    }
    if (!selected && !newAddress.line1.trim()) {
      setError('Please choose or add a delivery address.');
      return;
    }
    setPlacing(true);
    try {
      const payload: Record<string, unknown> = {
        items: rows.map((r) => ({ productId: r.productId, quantity: r.quantity })),
        paymentMethod,
        idempotencyKey: newIdempotencyKey(),
      };
      if (selected) payload.addressId = selected.id;
      else payload.deliveryAddress = `${newAddress.line1}, ${newAddress.village}, ${newAddress.district}, ${newAddress.state} - ${newAddress.pincode}`;
      if (appliedCoupon) payload.couponCode = appliedCoupon.code;
      if (deliverySlot) payload.deliverySlot = deliverySlot;
      if (coinDiscount > 0) payload.coinsToRedeem = coinDiscount;
      if (plantTree) payload.plantTree = true;
      // Doorstep delivery fee (Rs 99 unless the free-delivery threshold hit) is
      // charged by the backend as part of the payable — send it explicitly so
      // coupon/coin math and the Razorpay amount include it.
      payload.deliveryFeePaisa = Math.round(deliveryFee * 100);

      const res = (await mall.placeOrder(payload)) as { orderId?: string; total?: number; discount?: number };
      const orderId = str(res.orderId);
      if (!orderId) throw new Error('Order created but no order id was returned.');

      clearCart();
      setRows([]);

      let paymentNote: string | null = null;
      if (paymentMethod === 'upi') {
        const paid = await startRazorpay(orderId);
        paymentNote = paid
          ? null
          : 'UPI payment was not completed online — your order is placed and you can retry payment from the Orders page.';
      } else if (paymentMethod === 'bnpl') {
        paymentNote = `BNPL approved: pay in ${BNPL_INSTALLMENTS} installments over 60 days (see the schedule on the Orders page).`;
      }

      setOrderResult({ orderId, total: num(res.total, grandTotal), discount: num(res.discount, discount), paymentNote });
    } catch (e) {
      setError(apiErrorMessage(e));
    } finally {
      setPlacing(false);
    }
  };

  if (orderResult) {
    return (
      <div className="max-w-md mx-auto py-12 text-center space-y-4">
        <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center mx-auto shadow-md">
          <Check className="w-8 h-8" />
        </div>
        <h2 className="text-2xl font-black text-slate-900">Order Placed Successfully!</h2>
        <p className="text-xs text-slate-500">
          Your order <strong>#{orderResult.orderId.replace(/^ord_/, '').toUpperCase()}</strong> has been confirmed
          {orderResult.discount > 0 && (
            <> — you saved {formatCurrency(orderResult.discount)} with coupon {appliedCoupon?.code}</>
          )}.
        </p>
        {orderResult.paymentNote && (
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-2xl text-xs font-semibold text-amber-900">
            {orderResult.paymentNote}
          </div>
        )}
        <div className="pt-4 flex justify-center gap-3">
          <Link
            to={`/customer/orders/${orderResult.orderId}`}
            className="px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs shadow-xs flex items-center gap-1.5"
          >
            <ShieldCheck className="w-4 h-4" />
            Track Order Timeline
          </Link>
          <Link
            to="/mall"
            className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs"
          >
            Continue Shopping
          </Link>
        </div>
      </div>
    );
  }

  const empty = !loadingCart && rows.length === 0 && items.length === 0 && produceLines.length === 0;

  if (produceCheckout) {
    return (
      <div className="max-w-md mx-auto py-12 text-center space-y-4">
        <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center mx-auto shadow-md">
          <Sprout className="w-8 h-8" />
        </div>
        <h2 className="text-2xl font-black text-slate-900">Procurement Placed!</h2>
        <p className="text-xs text-slate-500">
          <strong>{produceCheckout.orders.length}</strong> farmer order
          {produceCheckout.orders.length === 1 ? '' : 's'} confirmed under consolidation{' '}
          <strong>#{produceCheckout.parentOrderId.replace(/^ord_/, '').toUpperCase()}</strong>. Deposits and
          inspection windows are tracked on the procurements page.
        </p>
        <div className="pt-4 flex justify-center gap-3">
          <Link
            to="/customer/procurements"
            className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs"
          >
            Track Procurements
          </Link>
          <Link
            to="/customer/produce"
            className="px-5 py-2.5 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold text-xs"
          >
            Browse More Produce
          </Link>
        </div>
      </div>
    );
  }

  if (empty) {
    return (
      <div className="max-w-md mx-auto py-16 text-center space-y-4">
        <div className="w-16 h-16 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
          <ShoppingCart className="w-8 h-8" />
        </div>
        <h3 className="font-extrabold text-base text-slate-800">Your Cart is Empty</h3>
        <p className="text-xs text-slate-500">Explore seeds, fertilizers, and farm equipment on Krishi Mall.</p>
        <button
          onClick={() => navigate('/mall')}
          className="inline-block px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-xs"
        >
          Browse Krishi Mall
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="border-b border-slate-200 pb-4">
        <h1 className="text-2xl font-extrabold text-slate-900 flex items-center gap-2">
          <ShoppingCart className="w-7 h-7 text-emerald-600" />
          Shopping Cart & Checkout
        </h1>
        <p className="text-xs text-slate-500 mt-1">Review items, delivery address, and payment options</p>
      </div>

      {(cartError || error) && (
        <div className="p-3 bg-rose-50 border border-rose-200 rounded-2xl text-xs font-bold text-rose-800 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{cartError ?? error}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Cart Items & Address */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs space-y-4">
            <h3 className="font-bold text-sm text-slate-900">Items in Your Cart ({cartCount})</h3>

            {loadingCart ? (
              <div className="space-y-3 animate-pulse">
                <div className="h-16 bg-slate-100 rounded-2xl" />
                <div className="h-16 bg-slate-100 rounded-2xl" />
              </div>
            ) : rows.length > 0 ? (
              <div className="divide-y divide-slate-100">
                {rows.map((row) => {
                  const product = toMallProduct(row.product);
                  return (
                    <div key={row.productId} className="py-4 flex items-center justify-between gap-4">
                      <Link to={`/mall/product/${product.id}`} className="flex items-center gap-3 min-w-0">
                        <img
                          src={product.imageUrl}
                          alt={product.title}
                          className="w-14 h-14 rounded-2xl object-cover bg-slate-100 shrink-0"
                        />
                        <div className="min-w-0">
                          <h4 className="font-bold text-xs text-slate-900 leading-tight line-clamp-1">{product.title}</h4>
                          <p className="text-[11px] text-slate-400">{product.brand}</p>
                          <span className="font-extrabold text-xs text-emerald-800 mt-1 block">
                            {formatCurrency(product.price)}
                          </span>
                        </div>
                      </Link>

                      <div className="flex items-center gap-3 shrink-0">
                        <div className="flex items-center border border-slate-200 rounded-xl bg-slate-50 p-1">
                          <button
                            onClick={() => void syncRowQty(row, row.quantity - 1)}
                            className="p-1 text-slate-500 hover:text-slate-800"
                            aria-label="Decrease quantity"
                          >
                            <Minus className="w-3.5 h-3.5" />
                          </button>
                          <span className="px-2 text-xs font-bold text-slate-800">{row.quantity}</span>
                          <button
                            onClick={() => void syncRowQty(row, row.quantity + 1)}
                            className="p-1 text-slate-500 hover:text-slate-800"
                            aria-label="Increase quantity"
                          >
                            <Plus className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        <button
                          onClick={() => void syncRowQty(row, 0)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg transition-colors"
                          aria-label="Remove item"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              // Local-store items only (server cart seeding is still in flight or failed).
              <div className="divide-y divide-slate-100">
                {items.map((item) => (
                  <div key={item.product.id} className="py-4 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <img
                        src={item.product.imageUrl}
                        alt={item.product.title}
                        className="w-14 h-14 rounded-2xl object-cover bg-slate-100"
                      />
                      <div>
                        <h4 className="font-bold text-xs text-slate-900 leading-tight">{item.product.title}</h4>
                        <p className="text-[11px] text-slate-400">{item.product.brand}</p>
                        <span className="font-extrabold text-xs text-emerald-800 mt-1 block">
                          {formatCurrency(item.product.price)}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="flex items-center border border-slate-200 rounded-xl bg-slate-50 p-1">
                        <button
                          onClick={() => updateQty(item.product.id, item.quantity - 1)}
                          className="p-1 text-slate-500 hover:text-slate-800"
                          aria-label="Decrease quantity"
                        >
                          <Minus className="w-3.5 h-3.5" />
                        </button>
                        <span className="px-2 text-xs font-bold text-slate-800">{item.quantity}</span>
                        <button
                          onClick={() => updateQty(item.product.id, item.quantity + 1)}
                          className="p-1 text-slate-500 hover:text-slate-800"
                          aria-label="Increase quantity"
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <button
                        onClick={() => removeItem(item.product.id)}
                        className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg transition-colors"
                        aria-label="Remove item"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
                <p className="pt-3 text-[11px] text-slate-400">
                  These items are saved on this device and will sync to your account cart shortly.
                </p>
              </div>
            )}
          </div>

          {/* FarmGate produce cart (multi-farmer checkout) */}
          {produceLines.length > 0 && (
            <div className="bg-gradient-to-br from-emerald-50 to-teal-50 rounded-3xl p-6 border border-emerald-200/80 shadow-xs space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="font-bold text-sm text-emerald-900 flex items-center gap-1.5">
                  <Sprout className="w-4 h-4 text-emerald-600" />
                  Produce Cart ({produceLines.length} lot{produceLines.length === 1 ? '' : 's'})
                </h3>
                <Link to="/customer/produce" className="text-[11px] font-bold text-emerald-700 hover:text-emerald-800">
                  + Add more lots
                </Link>
              </div>

              <div className="divide-y divide-emerald-100">
                {produceLines.map((line) => (
                  <div key={line.lotId} className="py-3 space-y-2">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-bold text-xs text-slate-900 leading-tight">
                          {line.crop}
                          {line.grade ? ` · ${line.grade}` : ''}
                        </p>
                        <p className="text-[11px] text-slate-500 mt-0.5">
                          {line.farmerName || 'Farmer'} · {formatPaisa(line.pricePaisa)}/quintal
                          {line.harvestDate ? ` · harvested ${line.harvestDate.slice(0, 10)}` : ''}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeProduceLine(line.lotId)}
                        className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg transition-colors shrink-0"
                        aria-label="Remove lot"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                    <div className="flex flex-wrap items-center gap-3">
                      <div className="flex items-center border border-emerald-200 rounded-xl bg-white p-1">
                        <button
                          type="button"
                          onClick={() => updateProduceQty(line.lotId, Math.round((line.qtyQuintals - 0.5) * 2) / 2)}
                          className="p-1 text-slate-500 hover:text-slate-800"
                          aria-label="Decrease quintals"
                        >
                          <Minus className="w-3.5 h-3.5" />
                        </button>
                        <span className="px-2 text-xs font-bold text-slate-800">{line.qtyQuintals} q</span>
                        <button
                          type="button"
                          onClick={() => updateProduceQty(line.lotId, Math.round((line.qtyQuintals + 0.5) * 2) / 2)}
                          className="p-1 text-slate-500 hover:text-slate-800"
                          aria-label="Increase quintals"
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <select
                        value={line.logisticsMode}
                        onChange={(e) =>
                          updateProduceLogistics(line.lotId, e.target.value as ProduceLogisticsMode)
                        }
                        className="px-2.5 py-1.5 rounded-xl bg-white border border-emerald-200 text-[11px] font-bold text-slate-700 focus:outline-none"
                      >
                        <option value="customer_pickup">I pick up</option>
                        <option value="farmer_delivery">Farmer delivers</option>
                        <option value="platform_transport">Platform transport</option>
                      </select>
                      <span className="ml-auto text-xs font-black text-emerald-800">
                        {formatPaisa(Math.round(line.pricePaisa * line.qtyQuintals))}
                      </span>
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-emerald-200">
                <div>
                  <p className="text-[11px] text-emerald-700 font-semibold">
                    Total · {produceLines.length} farmer{produceLines.length === 1 ? '' : 's'}
                  </p>
                  <p className="text-lg font-black text-emerald-900">{formatPaisa(getProduceSubtotalPaisa())}</p>
                </div>
                <button
                  type="button"
                  onClick={() => void handleProduceCheckout()}
                  disabled={produceBusy}
                  className="px-5 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md flex items-center gap-1.5 disabled:opacity-60"
                >
                  <Sprout className="w-4 h-4" />
                  {produceBusy ? 'Placing procurement…' : 'Checkout Produce'}
                </button>
              </div>
            </div>
          )}

          {/* Delivery Address */}
          <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-sm text-slate-900 flex items-center gap-1.5">
                <MapPin className="w-4 h-4 text-emerald-600" />
                Delivery Address
              </h3>
              <button
                onClick={() => setShowAddressForm((v) => !v)}
                className="text-xs font-bold text-emerald-700 hover:text-emerald-800"
              >
                {showAddressForm ? 'Cancel' : '+ Add New'}
              </button>
            </div>

            {addresses.length > 0 && !showAddressForm && (
              <div className="space-y-2">
                {addresses.map((addr) => (
                  <button
                    key={addr.id}
                    type="button"
                    onClick={() => setSelectedAddressId(addr.id)}
                    className={`w-full text-left p-3 rounded-2xl border text-xs transition-all ${
                      selectedAddressId === addr.id
                        ? 'border-emerald-600 bg-emerald-50'
                        : 'border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <span className="font-bold text-slate-800">{addr.label}</span>
                    <span className="block text-slate-500 mt-0.5">
                      {addr.line1}, {addr.village}, {addr.district}, {addr.state} - {addr.pincode}
                    </span>
                  </button>
                ))}
              </div>
            )}

            {(showAddressForm || addresses.length === 0) && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <input
                  type="text"
                  placeholder="Label (Home / Farm / Shop)"
                  value={newAddress.label}
                  onChange={(e) => setNewAddress((a) => ({ ...a, label: e.target.value }))}
                  className="px-3 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:border-emerald-600"
                />
                <input
                  type="text"
                  placeholder="Flat / House / Gat No."
                  value={newAddress.line1}
                  onChange={(e) => setNewAddress((a) => ({ ...a, line1: e.target.value }))}
                  className="px-3 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:border-emerald-600"
                />
                <input
                  type="text"
                  placeholder="Village"
                  value={newAddress.village}
                  onChange={(e) => setNewAddress((a) => ({ ...a, village: e.target.value }))}
                  className="px-3 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:border-emerald-600"
                />
                <input
                  type="text"
                  placeholder="District"
                  value={newAddress.district}
                  onChange={(e) => setNewAddress((a) => ({ ...a, district: e.target.value }))}
                  className="px-3 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:border-emerald-600"
                />
                <input
                  type="text"
                  placeholder="State"
                  value={newAddress.state}
                  onChange={(e) => setNewAddress((a) => ({ ...a, state: e.target.value }))}
                  className="px-3 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:border-emerald-600"
                />
                <input
                  type="text"
                  placeholder="Pincode (6 digits)"
                  maxLength={6}
                  value={newAddress.pincode}
                  onChange={(e) => setNewAddress((a) => ({ ...a, pincode: e.target.value.replace(/\D/g, '') }))}
                  className="px-3 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:border-emerald-600"
                />
                <button
                  type="button"
                  onClick={() => void handleSaveAddress()}
                  disabled={savingAddress || !newAddress.line1.trim() || !newAddress.village.trim() || newAddress.pincode.length !== 6}
                  className="sm:col-span-2 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs disabled:opacity-50"
                >
                  {savingAddress ? 'Saving…' : 'Save Address'}
                </button>
              </div>
            )}
          </div>

          {/* Delivery slot (SR 8) */}
          <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs space-y-3">
            <h3 className="font-bold text-sm text-slate-900 flex items-center gap-1.5">
              <Clock className="w-4 h-4 text-emerald-600" />
              Delivery Slot
            </h3>
            <div className="grid grid-cols-3 gap-2 text-[11px]">
              {slotOptions.map((slot) => (
                <button
                  key={slot}
                  type="button"
                  onClick={() => setDeliverySlot(slot)}
                  className={`p-2.5 rounded-xl border font-bold text-center transition-all ${
                    deliverySlot === slot ? 'border-emerald-600 bg-emerald-50 text-emerald-900' : 'border-slate-200'
                  }`}
                >
                  {slot}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Right: Order Summary & Payment */}
        <div className="space-y-4">
          <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs space-y-4">
            <h3 className="font-bold text-sm text-slate-900">Payment Summary</h3>

            {/* Coupon input */}
            <div className="space-y-2">
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Tag className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    value={couponInput}
                    onChange={(e) => {
                      setCouponInput(e.target.value.toUpperCase());
                      setAppliedCoupon(null);
                    }}
                    placeholder="Coupon Code"
                    className="w-full pl-8 pr-3 py-2 text-xs rounded-xl border border-slate-300 font-mono focus:outline-none focus:border-emerald-600"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => void handleApplyCoupon()}
                  className="px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-xs font-bold text-slate-700"
                >
                  Apply
                </button>
              </div>
              {couponMessage && <p className="text-[11px] text-slate-500">{couponMessage}</p>}
              {coupons.length > 0 && !appliedCoupon && (
                <div className="flex flex-wrap gap-1.5">
                  {coupons.slice(0, 4).map((c) => (
                    <button
                      key={str(c.code)}
                      type="button"
                      onClick={() => {
                        setCouponInput(str(c.code));
                        setCouponMessage(null);
                      }}
                      className="px-2 py-1 text-[10px] font-bold rounded-lg border border-dashed border-emerald-300 bg-emerald-50 text-emerald-800 hover:bg-emerald-100"
                    >
                      {str(c.code)}
                      {num(c.minOrder) > 0 && <span className="font-normal text-emerald-600"> (min {formatCurrency(num(c.minOrder))})</span>}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Krushi Ratna coin redemption (SR 8) */}
            <div className="space-y-2">
              <label className="block text-xs font-bold text-slate-700 flex items-center gap-1.5">
                <Coins className="w-3.5 h-3.5 text-amber-500" />
                Krushi Ratna Coins
                <span className="font-normal text-slate-400">(balance: {coinBalance})</span>
              </label>
              <div className="flex gap-2">
                <input
                  type="number"
                  min="0"
                  max={coinMax}
                  value={coinInput}
                  onChange={(e) => {
                    setCoinInput(e.target.value);
                    setCoinsApplied(false);
                  }}
                  placeholder={`Redeem up to ${coinMax} coins`}
                  className="flex-1 px-3 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:border-emerald-600"
                />
                <button
                  type="button"
                  onClick={() => {
                    if ((parseInt(coinInput, 10) || 0) > 0) setCoinsApplied(true);
                  }}
                  disabled={coinMax <= 0 || (parseInt(coinInput, 10) || 0) <= 0}
                  className="px-3 py-2 rounded-xl bg-amber-50 border border-amber-200 hover:bg-amber-100 text-xs font-bold text-amber-800 disabled:opacity-50"
                >
                  {coinsApplied ? 'Applied' : 'Apply'}
                </button>
              </div>
              <p className="text-[10px] text-slate-400">1 coin = ₹1 off, capped at your order total.</p>
            </div>

            <div className="space-y-2 text-xs text-slate-600 border-t border-slate-100 pt-3">
              <div className="flex justify-between">
                <span>Subtotal:</span>
                <span className="font-bold text-slate-800">{formatCurrency(subtotal)}</span>
              </div>
              {discount > 0 && (
                <div className="flex justify-between text-emerald-700 font-bold">
                  <span>Coupon Discount ({appliedCoupon?.code}):</span>
                  <span>-{formatCurrency(discount)}</span>
                </div>
              )}
              {coinDiscount > 0 && (
                <div className="flex justify-between text-amber-700 font-bold">
                  <span>Krushi Ratna Coins:</span>
                  <span>-{formatCurrency(coinDiscount)}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span>Doorstep Delivery:</span>
                <span className="font-bold text-slate-800">
                  {deliveryFee === 0 ? 'FREE' : formatCurrency(deliveryFee)}
                </span>
              </div>
              <div className="flex justify-between text-sm font-black text-slate-900 border-t border-slate-200 pt-2">
                <span>Total Amount:</span>
                <span className="text-emerald-800 text-base">{formatCurrency(grandTotal)}</span>
              </div>
            </div>

            {/* Plant a tree (SR 19) */}
            <label className="flex items-start gap-2.5 p-3 rounded-2xl border border-emerald-200 bg-emerald-50/60 cursor-pointer">
              <input
                type="checkbox"
                checked={plantTree}
                onChange={(e) => setPlantTree(e.target.checked)}
                className="mt-0.5 accent-emerald-600"
              />
              <span className="text-xs font-bold text-emerald-900 flex items-center gap-1.5">
                <Leaf className="w-4 h-4 text-emerald-600" />
                Plant a tree with this order (₹0)
              </span>
            </label>

            {/* Payment Method */}
            <div className="pt-2 space-y-2">
              <label className="block text-xs font-bold text-slate-700">Payment Option</label>
              <div className="grid grid-cols-3 gap-2 text-[11px]">
                {(
                  [
                    { id: 'upi', label: 'Instant UPI', hint: 'Razorpay' },
                    { id: 'cod', label: 'Cash on Delivery', hint: 'Pay at door' },
                    { id: 'bnpl', label: 'Buy Now Pay Later', hint: '2 × 30 days' },
                  ] as const
                ).map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setPaymentMethod(opt.id)}
                    className={`p-2.5 rounded-xl border font-bold text-center transition-all ${
                      paymentMethod === opt.id ? 'border-emerald-600 bg-emerald-50 text-emerald-900' : 'border-slate-200'
                    }`}
                  >
                    <span className="block">{opt.label}</span>
                    <span className={`block mt-0.5 font-normal ${paymentMethod === opt.id ? 'text-emerald-700' : 'text-slate-400'}`}>
                      {opt.hint}
                    </span>
                  </button>
                ))}
              </div>
              {paymentMethod === 'bnpl' && (
                <p className="text-[10px] text-slate-400">
                  Two equal installments — 50% now, 50% after 30 days. Schedule is generated with your order.
                </p>
              )}
            </div>

            <button
              type="button"
              onClick={() => void handlePlaceOrder()}
              disabled={placing || loadingCart}
              className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-md transition-all flex items-center justify-center gap-2 disabled:opacity-60"
            >
              <span>{placing ? 'Placing Order…' : `Place Order (${formatCurrency(grandTotal)})`}</span>
              {!placing && <ArrowRight className="w-4 h-4" />}
            </button>

            <p className="text-[10px] text-slate-400 flex items-center gap-1 justify-center">
              <ShieldCheck className="w-3 h-3 text-emerald-600" />
              Secured checkout · coupon & stock validated server-side
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
