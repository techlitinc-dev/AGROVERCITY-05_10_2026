import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  AlertCircle,
  ArrowLeft,
  CalendarClock,
  Check,
  ChevronRight,
  Clock,
  CreditCard,
  FileText,
  Leaf,
  MapPin,
  Package,
  Phone,
  RotateCcw,
  Star,
  Store,
  Truck,
  XCircle,
} from 'lucide-react';
import { apiErrorMessage, download, mall, post } from '../../lib/api';
import { useCartStore } from '../../stores/cartStore';
import { formatCurrency } from '../../lib/utils';
import { StatusBadge } from '../../components/common/StatusBadge';
import {
  asOrders,
  asRecord,
  formatDateTime,
  num,
  orderNumber,
  orderTotal,
  str,
  toMallProduct,
  PRODUCT_PLACEHOLDER_IMAGE,
  type ApiBnplInstallment,
  type ApiOrder,
  type ApiOrderEvent,
  type ApiProductDoc,
} from './mallMappers';

/** Shared product-id → product doc cache (order docs store only {productId, quantity}). */
function useProductCatalog(): Record<string, ApiProductDoc> {
  const [docs, setDocs] = useState<Record<string, ApiProductDoc>>({});
  useEffect(() => {
    let mounted = true;
    mall
      .products()
      .then((list) => {
        if (!mounted) return;
        const map: Record<string, ApiProductDoc> = {};
        (list as unknown as ApiProductDoc[]).forEach((d) => {
          if (d.id) map[String(d.id)] = d;
        });
        setDocs(map);
      })
      .catch(() => undefined);
    return () => {
      mounted = false;
    };
  }, []);
  return docs;
}

/** Product-id → display name, derived from the catalog hook above. */
function useProductNames(): Record<string, string> {
  const docs = useProductCatalog();
  return useMemo(() => {
    const map: Record<string, string> = {};
    Object.entries(docs).forEach(([id, d]) => {
      map[id] = String(d.title ?? id);
    });
    return map;
  }, [docs]);
}

const CANCELLABLE: string[] = ['placed', 'paid'];
const RETURNABLE: string[] = ['delivered', 'paid'];

// SR 10: customer-friendly fulfilment step labels. Internal statuses are kept
// for all logic; this map only affects display.
const STATUS_DISPLAY: Record<string, string> = {
  placed: 'Confirmed',
  paid: 'Confirmed',
  confirmed: 'Packed',
  shipped: 'Pickup',
  out_for_delivery: 'In transit',
  delivered: 'Delivered',
  closed: 'Delivered',
  cancelled: 'Cancelled',
  returned: 'Returned',
  return_requested: 'Return requested',
};

const displayStatus = (status: string): string =>
  STATUS_DISPLAY[status] ?? status.replace(/_/g, ' ');

// ---------------------------------------------------------------- list view

export const CustomerOrdersView: React.FC = () => {
  const [orders, setOrders] = useState<ApiOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const productNames = useProductNames();

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      setLoading(true);
      try {
        const payload = await mall.orders();
        if (mounted) setOrders(asOrders(payload));
      } catch (e) {
        if (mounted) setError(apiErrorMessage(e));
      } finally {
        if (mounted) setLoading(false);
      }
    };
    void load();
    return () => {
      mounted = false;
    };
  }, []);

  return (
    <div className="space-y-6">
      <div className="border-b border-slate-200 pb-4">
        <h1 className="text-2xl font-extrabold text-slate-900 flex items-center gap-2">
          <Package className="w-7 h-7 text-emerald-600" />
          My Orders
        </h1>
        <p className="text-xs text-slate-500 mt-1">Track, cancel, return, and rate your Krishi Mall purchases</p>
      </div>

      {error && (
        <div className="p-3 bg-rose-50 border border-rose-200 rounded-2xl text-xs font-bold text-rose-800 flex items-center gap-2">
          <AlertCircle className="w-4 h-4" />
          {error}
        </div>
      )}

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="bg-white rounded-3xl border border-slate-200/80 p-5 animate-pulse">
              <div className="h-4 bg-slate-100 rounded w-1/3" />
              <div className="h-3 bg-slate-100 rounded w-2/3 mt-2" />
            </div>
          ))}
        </div>
      ) : orders.length === 0 ? (
        <div className="py-16 text-center space-y-4">
          <div className="w-16 h-16 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
            <Package className="w-8 h-8" />
          </div>
          <h3 className="font-extrabold text-base text-slate-800">No orders yet</h3>
          <p className="text-xs text-slate-500">Your placed orders will appear here with live tracking.</p>
          <Link
            to="/mall"
            className="inline-block px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-xs"
          >
            Start Shopping
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {orders.map((order) => (
            <Link
              key={order.id}
              to={`/customer/orders/${order.id}`}
              className="block bg-white rounded-3xl border border-slate-200/80 shadow-xs hover:shadow-md hover:border-emerald-200 transition-all p-5"
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-black text-slate-900">#{orderNumber(order)}</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">Placed {formatDateTime(order.createdAt)}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold text-slate-500 uppercase flex items-center gap-1">
                    <CreditCard className="w-3 h-3" />
                    {order.paymentMethod}
                  </span>
                  <StatusBadge status={order.returnStatus === 'requested' ? 'return_requested' : order.status} />
                </div>
              </div>

              <p className="text-xs text-slate-600 mt-3 line-clamp-1">
                {order.items.map((it) => `${productNames[it.productId] ?? it.productId} × ${it.quantity}`).join(', ')}
              </p>

              <div className="flex items-center justify-between mt-3 pt-3 border-t border-slate-100">
                <span className="text-sm font-black text-emerald-800">{formatCurrency(orderTotal(order))}</span>
                <span className="text-[11px] font-bold text-emerald-700 flex items-center gap-0.5">
                  Track & manage <ChevronRight className="w-3.5 h-3.5" />
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
};

// ---------------------------------------------------------------- detail view

export const CustomerOrderDetailView: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { addItem } = useCartStore();
  const [order, setOrder] = useState<ApiOrder | null>(null);
  const [events, setEvents] = useState<ApiOrderEvent[]>([]);
  const [bnpl, setBnpl] = useState<ApiBnplInstallment[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [showCancel, setShowCancel] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [showReturn, setShowReturn] = useState(false);
  const [returnReason, setReturnReason] = useState('');
  const [ratings, setRatings] = useState<Record<string, number>>({});
  const [ratedProducts, setRatedProducts] = useState<Set<string>>(new Set());
  const [invoiceBusy, setInvoiceBusy] = useState(false);
  const [reorderBusy, setReorderBusy] = useState(false);
  const productNames = useProductNames();
  const productCatalog = useProductCatalog();

  const loadDetail = async () => {
    if (!id) return;
    setLoading(true);
    try {
      const [orderPayload, timelinePayload] = await Promise.all([
        mall.order(id),
        mall.orderTimeline(id).catch(() => [] as unknown[]),
      ]);
      setOrder(orderPayload as ApiOrder);
      const timeline = asRecord(timelinePayload);
      const eventList = Array.isArray(timeline.data)
        ? (timeline.data as ApiOrderEvent[])
        : (timelinePayload as ApiOrderEvent[]);
      setEvents(eventList);
      const o = orderPayload as ApiOrder;
      if (o.paymentMethod === 'bnpl') {
        const sched = await mall.bnplSchedule(id).catch(() => null);
        if (sched) setBnpl((asRecord(sched).bnplSchedule as ApiBnplInstallment[] | undefined) ?? null);
      }
    } catch (e) {
      setError(apiErrorMessage(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadDetail();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const handleCancel = async () => {
    if (!id) return;
    try {
      await mall.cancelOrder(id, cancelReason.trim() || undefined);
      setNotice('Order cancelled. Any payment made will be refunded to the original method.');
      setShowCancel(false);
      await loadDetail();
    } catch (e) {
      setError(apiErrorMessage(e));
    }
  };

  const handleReturn = async () => {
    if (!id) return;
    try {
      await mall.returnOrder(id, { reason: returnReason.trim() });
      setNotice('Return requested — the seller will confirm pickup. Refund starts after QC.');
      setShowReturn(false);
      await loadDetail();
    } catch (e) {
      setError(apiErrorMessage(e));
    }
  };

  const handleRateProduct = async (productId: string) => {
    if (!id) return;
    const stars = ratings[productId];
    if (!stars) return;
    try {
      await mall.reviewProduct(productId, { rating: stars, comment: '' });
      setRatedProducts((prev) => new Set(prev).add(productId));
      setNotice('Thanks for rating! Your feedback helps other farmers.');
    } catch (e) {
      setError(apiErrorMessage(e));
    }
  };

  // SR 9: PDF invoice download.
  const handleInvoice = async () => {
    if (!id || invoiceBusy) return;
    setInvoiceBusy(true);
    setError(null);
    try {
      const blob = await download(`/orders/${id}/invoice.pdf`);
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `invoice-${id}.pdf`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 5000);
    } catch (e) {
      setError(apiErrorMessage(e));
    } finally {
      setInvoiceBusy(false);
    }
  };

  // SR 9: reorder a delivered order — the endpoint is idempotent and returns
  // the item list; we push them into the cart store and re-sync the server cart.
  const handleReorder = async () => {
    if (!id || reorderBusy) return;
    setReorderBusy(true);
    setError(null);
    try {
      const payload = await post<{ items?: Array<{ productId?: string; quantity?: number }> }>(
        `/orders/${id}/reorder`
      );
      const items = Array.isArray(payload?.items) ? payload.items : [];
      for (const item of items) {
        if (!item.productId) continue;
        const doc = productCatalog[item.productId];
        const product = doc
          ? toMallProduct(doc)
          : {
              id: item.productId,
              title: productNames[item.productId] ?? 'Previously ordered item',
              category: 'Organic Produce' as const,
              brand: '',
              price: 0,
              mrp: 0,
              rating: 0,
              ratingCount: 0,
              stockQty: 10,
              unit: '',
              imageUrl: PRODUCT_PLACEHOLDER_IMAGE,
              sellerName: '',
              description: 'Reordered from a previous purchase.',
              specifications: {},
            };
        addItem(product, Math.max(1, item.quantity ?? 1));
        mall.addToCart(item.productId, Math.max(1, item.quantity ?? 1)).catch(() => undefined);
      }
      setNotice(`${items.length} item${items.length === 1 ? '' : 's'} added back to your cart.`);
      navigate('/mall/cart');
    } catch (e) {
      setError(apiErrorMessage(e));
    } finally {
      setReorderBusy(false);
    }
  };

  const cancellable = order ? CANCELLABLE.includes(order.status) && order.status !== 'cancelled' : false;
  const returnable = order ? RETURNABLE.includes(order.status) && order.returnStatus !== 'requested' : false;
  const rateable = order?.status === 'delivered';
  const reorderable = order?.status === 'delivered' || order?.status === 'closed';
  const firstProduct = order?.items?.[0] ? productCatalog[order.items[0].productId] : undefined;
  const sellerId = str(order?.sellerId) || str(firstProduct?.sellerId);
  const sellerName = str(order?.sellerName) || str(firstProduct?.sellerName) || str(firstProduct?.dealerName);
  const sellerPhone = str(order?.sellerPhone);
  const effectiveEvents = useMemo(
    () =>
      events.length > 0
        ? events
        : order
          ? [{ status: order.status, at: order.createdAt, note: '' }]
          : [],
    [events, order]
  );

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto space-y-4 animate-pulse">
        <div className="h-6 bg-slate-100 rounded w-40" />
        <div className="h-40 bg-slate-100 rounded-3xl" />
        <div className="h-64 bg-slate-100 rounded-3xl" />
      </div>
    );
  }

  if (!order) {
    return (
      <div className="max-w-md mx-auto py-16 text-center space-y-4">
        <h3 className="font-extrabold text-base text-slate-800">Order not found</h3>
        <p className="text-xs text-slate-500">{error ?? 'It may belong to another account.'}</p>
        <Link to="/customer/orders" className="inline-block px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl">
          Back to Orders
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <Link to="/customer/orders" className="inline-flex items-center gap-1 text-xs font-bold text-slate-500 hover:text-emerald-700">
        <ArrowLeft className="w-4 h-4" />
        All Orders
      </Link>

      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 flex items-center gap-2">
            <Truck className="w-7 h-7 text-emerald-600" />
            Order #{orderNumber(order)}
          </h1>
          <p className="text-xs text-slate-500 mt-1">Placed {formatDateTime(order.createdAt)}</p>
        </div>
        <StatusBadge status={order.returnStatus === 'requested' ? 'return_requested' : order.status} />
      </div>

      {error && (
        <div className="p-3 bg-rose-50 border border-rose-200 rounded-2xl text-xs font-bold text-rose-800 flex items-center gap-2">
          <AlertCircle className="w-4 h-4" />
          {error}
        </div>
      )}
      {notice && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-2xl text-xs font-bold text-emerald-900 flex items-center gap-2">
          <Check className="w-4 h-4 text-emerald-600" />
          {notice}
        </div>
      )}

      {/* Timeline */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs">
        <h3 className="font-bold text-sm text-slate-900 mb-4">Order Timeline</h3>
        <ol className="relative border-l-2 border-slate-100 ml-2 space-y-4">
          {[...effectiveEvents].reverse().map((event, idx) => (
            <li key={idx} className="ml-4">
              <span
                className={`absolute -left-[7px] mt-1 w-3 h-3 rounded-full border-2 ${
                  idx === 0 ? 'bg-emerald-500 border-emerald-500' : 'bg-white border-slate-300'
                }`}
              />
              <p className="text-xs font-bold text-slate-800">{displayStatus(event.status)}</p>
              {event.note && <p className="text-[11px] text-slate-500">{event.note}</p>}
              <p className="text-[10px] text-slate-400">{formatDateTime(event.at)}</p>
            </li>
          ))}
        </ol>
      </div>

      {/* Items */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs space-y-3">
        <h3 className="font-bold text-sm text-slate-900">Items</h3>
        {order.items.map((item, idx) => (
          <div key={`${item.productId}-${idx}`} className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 last:border-0 pb-3 last:pb-0">
            <div>
              <Link to={`/mall/product/${item.productId}`} className="text-xs font-bold text-slate-800 hover:text-emerald-700">
                {productNames[item.productId] ?? item.productId}
              </Link>
              <p className="text-[11px] text-slate-400">Quantity: {item.quantity}</p>
            </div>
            {rateable &&
              (ratedProducts.has(item.productId) ? (
                <span className="text-[11px] font-bold text-emerald-700 flex items-center gap-1">
                  <Check className="w-3.5 h-3.5" /> Rated
                </span>
              ) : (
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-0.5">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => setRatings((r) => ({ ...r, [item.productId]: i + 1 }))}
                        aria-label={`${i + 1} star`}
                      >
                        <Star
                          className={`w-4 h-4 ${i < (ratings[item.productId] ?? 0) ? 'fill-amber-500 text-amber-500' : 'text-slate-300'}`}
                        />
                      </button>
                    ))}
                  </div>
                  <button
                    type="button"
                    onClick={() => void handleRateProduct(item.productId)}
                    disabled={!ratings[item.productId]}
                    className="px-2.5 py-1.5 rounded-lg bg-slate-900 text-white text-[10px] font-bold disabled:opacity-40"
                  >
                    Rate
                  </button>
                </div>
              ))}
          </div>
        ))}

        <div className="space-y-1.5 text-xs text-slate-600 pt-2 border-t border-slate-100">
          <div className="flex justify-between">
            <span>Subtotal:</span>
            <span className="font-bold text-slate-800">{formatCurrency(num(order.total))}</span>
          </div>
          {num(order.discount) > 0 && (
            <div className="flex justify-between text-emerald-700 font-bold">
              <span>Coupon {order.couponCode}:</span>
              <span>-{formatCurrency(num(order.discount))}</span>
            </div>
          )}
          {num(order.coinsRedeemed) > 0 && (
            <div className="flex justify-between text-amber-700 font-bold">
              <span>Krushi Ratna Coins:</span>
              <span>-{formatCurrency(num(order.coinsRedeemed))}</span>
            </div>
          )}
          <div className="flex justify-between text-sm font-black text-slate-900 pt-1 border-t border-slate-200">
            <span>Total ({order.paymentMethod.toUpperCase()}):</span>
            <span className="text-emerald-800">{formatCurrency(orderTotal(order))}</span>
          </div>
          {order.refundStatus && order.refundStatus !== 'none' && (
            <p className="text-[11px] font-bold text-amber-700 pt-1">Refund status: {order.refundStatus}</p>
          )}
          {str(order.treeAdoptionId) && (
            <p className="text-[11px] font-bold text-emerald-700 pt-1 flex items-center gap-1">
              <Leaf className="w-3.5 h-3.5" />
              A native tree was planted with this order
            </p>
          )}
        </div>
      </div>

      {/* Address + payment meta */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs space-y-3">
        <div className="flex items-start gap-2">
          <MapPin className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" />
          <div>
            <p className="text-xs font-bold text-slate-800">Delivery Address</p>
            <p className="text-[11px] text-slate-500 mt-0.5">{order.deliveryAddress || '—'}</p>
          </div>
        </div>
        {str(order.deliverySlot) && (
          <div className="flex items-start gap-2">
            <Clock className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" />
            <div>
              <p className="text-xs font-bold text-slate-800">Delivery Slot</p>
              <p className="text-[11px] text-slate-500 mt-0.5">{str(order.deliverySlot)}</p>
            </div>
          </div>
        )}
        <div className="flex items-start gap-2">
          <CreditCard className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" />
          <div>
            <p className="text-xs font-bold text-slate-800">Payment</p>
            <p className="text-[11px] text-slate-500 mt-0.5 capitalize">
              Method: {order.paymentMethod}
              {order.razorpayPaymentId ? ' · Paid online via Razorpay' : order.status === 'placed' && order.paymentMethod === 'upi' ? ' · Awaiting payment' : ''}
            </p>
          </div>
        </div>
      </div>

      {/* SR 10: seller / delivery-agent contact */}
      {(sellerName || sellerId || sellerPhone) && (
        <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs space-y-2">
          <h3 className="font-bold text-sm text-slate-900">Seller Contact</h3>
          <div className="flex flex-wrap items-center gap-x-6 gap-y-1 text-[11px] text-slate-500">
            {sellerName && <span className="font-bold text-slate-700">{sellerName}</span>}
            {sellerPhone && (
              <a href={`tel:${sellerPhone}`} className="flex items-center gap-1 font-bold text-emerald-700">
                <Phone className="w-3.5 h-3.5" />
                {sellerPhone}
              </a>
            )}
            {sellerId && (
              <Link to={`/mall/seller/${sellerId}`} className="flex items-center gap-1 font-bold text-emerald-700">
                <Store className="w-3.5 h-3.5" />
                Visit storefront
              </Link>
            )}
          </div>
        </div>
      )}

      {/* BNPL schedule */}
      {order.paymentMethod === 'bnpl' && (
        <div className="bg-indigo-50 border border-indigo-100 rounded-3xl p-6 space-y-3">
          <h3 className="font-bold text-sm text-indigo-900 flex items-center gap-1.5">
            <CalendarClock className="w-4 h-4 text-indigo-600" />
            BNPL Installment Schedule
          </h3>
          {bnpl === null ? (
            <p className="text-xs text-indigo-600">Schedule unavailable.</p>
          ) : (
            <div className="space-y-2">
              {bnpl.map((inst) => (
                <div key={inst.installment} className="flex items-center justify-between bg-white rounded-2xl border border-indigo-100 px-4 py-3">
                  <div>
                    <p className="text-xs font-bold text-slate-800">Installment {inst.installment}</p>
                    <p className="text-[10px] text-slate-400">Due in {inst.dueInDays} days</p>
                  </div>
                  <span className="text-sm font-black text-indigo-800">{formatCurrency(num(inst.amount))}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Actions */}
      {order.status !== 'cancelled' && (
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => void handleInvoice()}
            disabled={invoiceBusy}
            className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 font-bold text-xs flex items-center gap-1.5 disabled:opacity-50"
          >
            <FileText className="w-4 h-4" />
            {invoiceBusy ? 'Downloading…' : 'Invoice PDF'}
          </button>
          {reorderable && (
            <button
              type="button"
              onClick={() => void handleReorder()}
              disabled={reorderBusy}
              className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-1.5 disabled:opacity-50"
            >
              <RotateCcw className="w-4 h-4" />
              {reorderBusy ? 'Adding…' : 'Reorder'}
            </button>
          )}
          {cancellable && (
            <button
              type="button"
              onClick={() => setShowCancel(true)}
              className="px-4 py-2.5 rounded-xl border border-rose-200 text-rose-700 hover:bg-rose-50 font-bold text-xs flex items-center gap-1.5"
            >
              <XCircle className="w-4 h-4" />
              Cancel Order
            </button>
          )}
          {returnable && (
            <button
              type="button"
              onClick={() => setShowReturn(true)}
              className="px-4 py-2.5 rounded-xl border border-amber-200 text-amber-700 hover:bg-amber-50 font-bold text-xs flex items-center gap-1.5"
            >
              <RotateCcw className="w-4 h-4" />
              Request Return
            </button>
          )}
        </div>
      )}

      {/* Cancel dialog */}
      {showCancel && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setShowCancel(false)} />
          <div className="relative w-full max-w-sm bg-white rounded-3xl shadow-2xl border border-slate-200 p-6 space-y-3">
            <h3 className="font-black text-sm text-slate-900">Cancel this order?</h3>
            <p className="text-xs text-slate-500">Stock is released immediately. Paid amounts are refunded to the original method.</p>
            <textarea
              rows={2}
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              placeholder="Reason (optional)"
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:border-emerald-600"
            />
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setShowCancel(false)}
                className="flex-1 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 font-bold text-xs text-slate-700"
              >
                Keep Order
              </button>
              <button
                type="button"
                onClick={() => void handleCancel()}
                className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 font-bold text-xs text-white"
              >
                Confirm Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Return dialog */}
      {showReturn && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setShowReturn(false)} />
          <div className="relative w-full max-w-sm bg-white rounded-3xl shadow-2xl border border-slate-200 p-6 space-y-3">
            <h3 className="font-black text-sm text-slate-900">Request a return</h3>
            <p className="text-xs text-slate-500">Tell us why you are returning this order (min 3 characters).</p>
            <textarea
              rows={3}
              value={returnReason}
              onChange={(e) => setReturnReason(e.target.value)}
              placeholder="e.g. Damaged packaging, wrong item delivered…"
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:border-emerald-600"
            />
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setShowReturn(false)}
                className="flex-1 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 font-bold text-xs text-slate-700"
              >
                Back
              </button>
              <button
                type="button"
                onClick={() => void handleReturn()}
                disabled={returnReason.trim().length < 3}
                className="flex-1 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 font-bold text-xs text-white disabled:opacity-50"
              >
                Submit Return
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
