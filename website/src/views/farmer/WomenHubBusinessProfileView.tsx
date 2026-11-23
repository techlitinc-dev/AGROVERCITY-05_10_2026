import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  AlertCircle,
  CalendarDays,
  Handshake,
  MapPin,
  MessageSquare,
  ShoppingBag,
  Star,
} from 'lucide-react';
import { apiErrorMessage, chat, womenHub } from '../../lib/api';
import { formatPaisa } from '../../lib/utils';
import { asRecord, asRecords, pick, pickNum, pickStr, Rec } from '../shared/records';

/**
 * Women Hub Business Profile / Store (womenhub 21nov.xlsx Part B Sr 2.0, NEW)
 * — what the business does, products with photos/price/stock, ratings &
 * reviews, working days/time. Buttons: Enquire, Order, Chat (in-app only,
 * no phone number is ever shown).
 */
export const WomenHubBusinessProfileView: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [data, setData] = useState<Rec | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [orderFor, setOrderFor] = useState<Rec | null>(null);
  const [quantity, setQuantity] = useState('1');
  const [enquiryOpen, setEnquiryOpen] = useState(false);
  const [enquiry, setEnquiry] = useState<Rec>({ productId: '', quantity: '', message: '' });
  const [rateOpen, setRateOpen] = useState(false);
  const [rating, setRating] = useState(5);
  const [review, setReview] = useState('');
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!id) return;
    try {
      setData(asRecord(await womenHub.businessProfile(id)));
    } catch (err) {
      setError(apiErrorMessage(err));
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  const business = data ? asRecord(pick(data, 'business')) : null;
  const products = data ? asRecords(pick(data, 'products')) : [];
  const reviews = data ? asRecords(pick(data, 'reviews')) : [];

  const run = async (fn: () => Promise<unknown>, done?: () => void) => {
    if (busy) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await fn();
      done?.();
      await load();
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const placeOrder = () => {
    const product = orderFor;
    if (!product) return;
    void run(
      async () => {
        await womenHub.placeOrder(id as string, {
          productId: pickStr(product, 'id'),
          quantity: Math.round(Number(quantity)) || 1,
        });
      },
      () => {
        setOrderFor(null);
        setQuantity('1');
        setNotice('Order placed — track it under My Orders.');
      }
    );
  };

  const submitEnquiry = () =>
    run(
      async () => {
        await womenHub.postEnquiry(id as string, {
          productId: pickStr(enquiry, 'productId') || undefined,
          productName: pickStr(enquiry, 'productName'),
          quantity: pickStr(enquiry, 'quantity'),
          message: pickStr(enquiry, 'message'),
        });
      },
      () => {
        setEnquiryOpen(false);
        setEnquiry({ productId: '', quantity: '', message: '' });
        setNotice('Requirement sent — the business will respond soon.');
      }
    );

  const submitRating = () =>
    run(
      async () => {
        await womenHub.rateBusiness(id as string, { rating, review: review.trim() });
      },
      () => {
        setRateOpen(false);
        setReview('');
        setNotice('Thanks for rating!');
      }
    );

  const openChat = () =>
    run(async () => {
      const sellerUid = business ? pickStr(business, 'sellerUid') : '';
      if (!sellerUid) throw new Error('Chat is unavailable for this business.');
      const room = asRecord(await chat.openDirect({ userId: sellerUid }));
      const roomId = pickStr(room, 'id') || pickStr(room, 'roomId');
      if (roomId) navigate(`/chat?room=${encodeURIComponent(roomId)}`);
    });

  const field =
    'w-full px-3 py-2.5 text-xs rounded-xl border border-slate-300 focus:outline-none focus:border-pink-600';

  if (error && !data) {
    return (
      <div className="space-y-4">
        <div className="rounded-2xl border p-3 text-xs flex items-start gap-2 bg-rose-50 border-rose-200 text-rose-800">
          <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <button
        onClick={() => navigate('/farmer/women-hub')}
        className="text-xs font-bold text-pink-700 hover:underline"
      >
        ← Back to Women Hub businesses
      </button>

      {error && (
        <div className="rounded-2xl border p-3 text-xs flex items-start gap-2 bg-rose-50 border-rose-200 text-rose-800">
          <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}
      {notice && (
        <div className="rounded-2xl border p-3 text-xs bg-emerald-50 border-emerald-200 text-emerald-800">
          {notice}
        </div>
      )}

      {business && (
        <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs p-5 space-y-4">
          <div className="flex items-start gap-4">
            {pickStr(business, 'photo') ? (
              <img
                src={pickStr(business, 'photo')}
                alt={pickStr(business, 'name')}
                className="w-20 h-20 rounded-2xl object-cover border border-slate-200"
              />
            ) : (
              <div className="w-20 h-20 rounded-2xl bg-pink-50 border border-pink-100 flex items-center justify-center">
                <Handshake className="w-8 h-8 text-pink-400" />
              </div>
            )}
            <div className="flex-1">
              <h1 className="text-xl font-extrabold text-slate-900">{pickStr(business, 'name')}</h1>
              <p className="text-xs text-slate-500">{pickStr(business, 'category')}</p>
              <p className="text-[11px] text-slate-400 mt-1">{pickStr(business, 'description')}</p>
              <div className="flex flex-wrap items-center gap-3 mt-2 text-[11px] text-slate-500">
                <span className="flex items-center gap-1">
                  <Star className="w-3.5 h-3.5 text-amber-500" />
                  <b className="text-slate-700">{pickNum(business, 'ratingAvg').toFixed(1)}</b> (
                  {pickNum(business, 'ratingCount')} ratings)
                </span>
                <span className="flex items-center gap-1">
                  <MapPin className="w-3 h-3" /> {pickStr(business, 'location') || '—'}
                </span>
                <span className="flex items-center gap-1">
                  <CalendarDays className="w-3 h-3" /> {pickStr(business, 'workingDays')}{' '}
                  {pickStr(business, 'workingTime')}
                </span>
              </div>
              <p className="text-[11px] text-slate-400 mt-1">Run by {pickStr(business, 'ownerName')}</p>
            </div>
          </div>

          {/* xlsx Sr 2.0 buttons: Enquire, Order (per product), Chat */}
          <div className="flex gap-2">
            <button
              onClick={() => setEnquiryOpen(true)}
              className="px-4 py-2.5 bg-white border border-pink-300 text-pink-700 font-bold text-xs rounded-xl flex items-center gap-1.5"
            >
              <MessageSquare className="w-3.5 h-3.5" /> Enquire
            </button>
            <button
              onClick={() => void openChat()}
              disabled={busy}
              className="px-4 py-2.5 bg-white border border-slate-300 text-slate-700 font-bold text-xs rounded-xl flex items-center gap-1.5 disabled:opacity-40"
            >
              <MessageSquare className="w-3.5 h-3.5" /> Chat
            </button>
            <button
              onClick={() => setRateOpen(true)}
              className="px-4 py-2.5 bg-white border border-amber-300 text-amber-700 font-bold text-xs rounded-xl flex items-center gap-1.5"
            >
              <Star className="w-3.5 h-3.5" /> Rate
            </button>
          </div>
        </div>
      )}

      <div>
        <h2 className="text-sm font-extrabold text-slate-900 mb-3">Products &amp; Services</h2>
        {products.length === 0 ? (
          <p className="text-xs text-slate-400 bg-white rounded-3xl border border-slate-200/80 p-8 text-center">
            No products in stock right now.
          </p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {products.map((p) => (
              <div
                key={pickStr(p, 'id')}
                className="bg-white rounded-3xl border border-slate-200/80 shadow-xs p-4 space-y-2"
              >
                {pickStr(p, 'photo') ? (
                  <img
                    src={pickStr(p, 'photo')}
                    alt={pickStr(p, 'name')}
                    className="w-full h-24 rounded-2xl object-cover border border-slate-200"
                  />
                ) : (
                  <div className="w-full h-24 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-center">
                    <ShoppingBag className="w-6 h-6 text-slate-300" />
                  </div>
                )}
                <p className="text-xs font-bold text-slate-900">{pickStr(p, 'name')}</p>
                <p className="text-[11px] text-slate-500">
                  {formatPaisa(pickNum(p, 'pricePaisa'))} · {pickNum(p, 'stock')} in stock
                </p>
                <button
                  onClick={() => setOrderFor(p)}
                  className="w-full px-3 py-2 bg-pink-600 hover:bg-pink-700 text-white text-[11px] font-bold rounded-xl"
                >
                  Order
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div>
        <h2 className="text-sm font-extrabold text-slate-900 mb-3">Ratings &amp; Reviews</h2>
        {reviews.length === 0 ? (
          <p className="text-xs text-slate-400">No reviews yet.</p>
        ) : (
          <div className="space-y-2">
            {reviews.map((r) => (
              <div key={pickStr(r, 'id')} className="bg-white rounded-2xl border border-slate-200/80 p-3">
                <p className="text-xs font-bold text-slate-900 flex items-center gap-1">
                  <Star className="w-3.5 h-3.5 text-amber-500" /> {pickNum(r, 'rating')} ·{' '}
                  {pickStr(r, 'fromName') || 'Customer'}
                </p>
                {pickStr(r, 'review') && (
                  <p className="text-[11px] text-slate-500 mt-0.5">{pickStr(r, 'review')}</p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {orderFor && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-xl w-full max-w-sm p-5 space-y-3">
            <h2 className="font-bold text-slate-900">Order — {pickStr(orderFor, 'name')}</h2>
            <p className="text-[11px] text-slate-500">
              {formatPaisa(pickNum(orderFor, 'pricePaisa'))} each · {pickNum(orderFor, 'stock')} in stock
            </p>
            <input
              className={field}
              type="number"
              min={1}
              max={pickNum(orderFor, 'stock')}
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              placeholder="Quantity"
            />
            <p className="text-xs font-bold text-emerald-700">
              Total: {formatPaisa(pickNum(orderFor, 'pricePaisa') * (Math.round(Number(quantity)) || 0))}
            </p>
            <div className="flex gap-2 pt-1">
              <button
                onClick={() => void placeOrder()}
                disabled={busy || !(Math.round(Number(quantity)) > 0)}
                className="px-4 py-2.5 bg-pink-600 hover:bg-pink-700 disabled:opacity-40 text-white font-bold text-xs rounded-xl"
              >
                {busy ? 'Placing…' : 'Place Order'}
              </button>
              <button
                onClick={() => setOrderFor(null)}
                className="px-4 py-2.5 border border-slate-300 text-slate-600 font-bold text-xs rounded-xl"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {enquiryOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-xl w-full max-w-md p-5 space-y-3">
            <h2 className="font-bold text-slate-900">Send Requirement</h2>
            <select
              className={field}
              value={pickStr(enquiry, 'productId')}
              onChange={(e) => {
                const product = products.find((p) => pickStr(p, 'id') === e.target.value);
                setEnquiry({
                  ...enquiry,
                  productId: e.target.value,
                  productName: product ? pickStr(product, 'name') : '',
                });
              }}
            >
              <option value="">General enquiry (any product/service)</option>
              {products.map((p) => (
                <option key={pickStr(p, 'id')} value={pickStr(p, 'id')}>
                  {pickStr(p, 'name')}
                </option>
              ))}
            </select>
            <input
              className={field}
              placeholder="Quantity (e.g. 20 kg)"
              value={pickStr(enquiry, 'quantity')}
              onChange={(e) => setEnquiry({ ...enquiry, quantity: e.target.value })}
            />
            <textarea
              className={field}
              rows={3}
              placeholder="Message"
              value={pickStr(enquiry, 'message')}
              onChange={(e) => setEnquiry({ ...enquiry, message: e.target.value })}
            />
            <div className="flex gap-2 pt-1">
              <button
                onClick={() => void submitEnquiry()}
                disabled={busy || !pickStr(enquiry, 'message').trim()}
                className="px-4 py-2.5 bg-pink-600 hover:bg-pink-700 disabled:opacity-40 text-white font-bold text-xs rounded-xl"
              >
                {busy ? 'Sending…' : 'Send'}
              </button>
              <button
                onClick={() => setEnquiryOpen(false)}
                className="px-4 py-2.5 border border-slate-300 text-slate-600 font-bold text-xs rounded-xl"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {rateOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-xl w-full max-w-sm p-5 space-y-3">
            <h2 className="font-bold text-slate-900">Rate this business</h2>
            <div className="flex gap-1">
              {[1, 2, 3, 4, 5].map((value) => (
                <button
                  key={value}
                  onClick={() => setRating(value)}
                  className="p-1"
                  title={`${value} stars`}
                >
                  <Star
                    className={`w-6 h-6 ${
                      value <= rating ? 'text-amber-500 fill-amber-500' : 'text-slate-300'
                    }`}
                  />
                </button>
              ))}
            </div>
            <textarea
              className={field}
              rows={3}
              placeholder="Write a review (optional)"
              value={review}
              onChange={(e) => setReview(e.target.value)}
            />
            <div className="flex gap-2 pt-1">
              <button
                onClick={() => void submitRating()}
                disabled={busy}
                className="px-4 py-2.5 bg-amber-500 hover:bg-amber-600 disabled:opacity-40 text-white font-bold text-xs rounded-xl"
              >
                {busy ? 'Saving…' : 'Submit'}
              </button>
              <button
                onClick={() => setRateOpen(false)}
                className="px-4 py-2.5 border border-slate-300 text-slate-600 font-bold text-xs rounded-xl"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
