import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  AlertCircle,
  Award,
  ChevronLeft,
  Download,
  FileText,
  Handshake,
  Heart,
  MapPin,
  MessageCircle,
  Package,
  ShoppingBasket,
  Star,
  Store,
  UserPlus,
  UserCheck,
} from 'lucide-react';
import { apiErrorMessage, chat, customer } from '../../lib/api';
import { followUser, unfollowUser, getFollows } from '../../lib/api/follows';
import { useCartStore } from '../../stores/cartStore';
import { formatCurrency, formatPaisa } from '../../lib/utils';
import { asRecord, formatDateTime, num, str, type AnyRecord } from './mallMappers';

interface StorefrontLot {
  lotId: string;
  farmerId: string;
  crop: string;
  grade: string;
  qtyAvailable: number;
  pricePaisa: number;
  harvestDate: string;
  freshnessDays: number | null;
}

interface StorefrontReview {
  productName: string;
  stars: number;
  comment: string;
  reviewerName: string;
  createdAt: string;
  reply?: string;
}

interface StorefrontData {
  farmerId: string;
  farmerName: string;
  farmerRating: number | null;
  photoUrl: string;
  location: string;
  credentials: { type: string; verifiedAt?: string }[];
  lots: StorefrontLot[];
  reviews: StorefrontReview[];
}

const firstStr = (r: Record<string, unknown>, keys: string[], fb = ''): string => {
  for (const k of keys) {
    const v = r[k];
    if (typeof v === 'string' && v.trim()) return v;
  }
  return fb;
};

function toStorefront(payload: unknown, farmerId: string): StorefrontData {
  const raw = asRecord(payload);
  const lots = Array.isArray(raw.lots) ? (raw.lots as AnyRecord[]) : [];
  return {
    farmerId: str(raw.farmerId, farmerId),
    farmerName: str(raw.farmerName, 'Krishi Mall Seller'),
    farmerRating: typeof raw.farmerRating === 'number' ? raw.farmerRating : null,
    photoUrl: str(raw.photoUrl),
    location: str(raw.location) || str(raw.district),
    credentials: (Array.isArray(raw.credentials) ? (raw.credentials as AnyRecord[]) : []).map((c) => ({
      type: str(c.type),
      verifiedAt: str(c.verifiedAt),
    })),
    lots: lots.map((lot) => ({
      lotId: str(lot.lotId) || str(lot.id),
      farmerId: str(lot.farmerId, farmerId),
      crop: str(lot.crop, 'Produce'),
      grade: str(lot.grade),
      qtyAvailable: num(lot.qtyAvailable),
      pricePaisa: num(lot.pricePaisa),
      harvestDate: str(lot.harvestDate),
      freshnessDays: typeof lot.freshnessDays === 'number' ? lot.freshnessDays : null,
    })),
    reviews: (Array.isArray(raw.reviews) ? (raw.reviews as AnyRecord[]) : []).map((review) => ({
      productName: str(review.productName, 'Product'),
      stars: num(review.stars),
      comment: str(review.comment),
      reviewerName: str(review.reviewerName, 'Verified buyer'),
      createdAt: str(review.createdAt),
      reply: str(review.reply),
    })),
  };
}

export const SellerStorefrontView: React.FC = () => {
  const { farmerId } = useParams<{ farmerId: string }>();
  const navigate = useNavigate();
  const [store, setStore] = useState<StorefrontData | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [following, setFollowing] = useState(false);
  const [followBusy, setFollowBusy] = useState(false);
  const [chatBusy, setChatBusy] = useState(false);

  // FarmGate: request-quote dialog (spec — quote first, chat only post-confirmation).
  const [quoteLotId, setQuoteLotId] = useState('');
  const [quoteQty, setQuoteQty] = useState('1');
  const [quotePrice, setQuotePrice] = useState('');
  const [quoteNotes, setQuoteNotes] = useState('');
  const [showQuote, setShowQuote] = useState(false);
  const [quoteBusy, setQuoteBusy] = useState(false);

  // Favorite supplier toggle + consolidated GST invoice.
  const [favoriteId, setFavoriteId] = useState<string | null>(null);
  const [favoriteBusy, setFavoriteBusy] = useState(false);
  const [invoicePeriod, setInvoicePeriod] = useState(() => new Date().toISOString().slice(0, 7));
  const [invoiceBusy, setInvoiceBusy] = useState(false);

  // Produce cart + confirmed-order chat unlock.
  const addProduceLine = useCartStore((s) => s.addProduceLine);
  const [addedLots, setAddedLots] = useState<Set<string>>(new Set());
  const [confirmedLotId, setConfirmedLotId] = useState('');

  useEffect(() => {
    if (!farmerId) return;
    let mounted = true;
    const load = async () => {
      setLoading(true);
      setNotFound(false);
      setError(null);
      try {
        const payload = await customer.storefront(farmerId);
        if (!mounted) return;
        setStore(toStorefront(payload, farmerId));
      } catch (e) {
        if (!mounted) return;
        setNotFound(true);
        setError(apiErrorMessage(e));
      } finally {
        if (mounted) setLoading(false);
      }
    };
    void load();

    getFollows()
      .then((list) => {
        if (mounted) setFollowing(list.some((f) => f.userId === farmerId));
      })
      .catch(() => undefined);

    // Favorites + confirmed orders power the favorite toggle and the
    // post-confirmation chat unlock (spec G1).
    Promise.all([
      customer.favoriteSuppliers().catch(() => [] as unknown[]),
      customer.orders().catch(() => [] as unknown[]),
    ]).then(([favsPayload, ordersPayload]) => {
      if (!mounted) return;
      const favs = Array.isArray(favsPayload) ? (favsPayload as AnyRecord[]) : [];
      const match = favs.find((f) => str(f.farmerId) === farmerId);
      setFavoriteId(match ? str(match.id) : null);
      const orders = Array.isArray(ordersPayload) ? (ordersPayload as AnyRecord[]) : [];
      const confirmed = orders.find(
        (o) =>
          str(o.farmerId) === farmerId &&
          ['confirmed', 'deposit_pending', 'in_fulfillment', 'dispatched', 'delivered', 'settled'].includes(
            str(o.status)
          )
      );
      if (confirmed) {
        const lotIds = Array.isArray(confirmed.lotIds) ? (confirmed.lotIds as unknown[]) : [];
        setConfirmedLotId(str(lotIds[0]) || str(confirmed.lotId));
      }
    });
    return () => {
      mounted = false;
    };
  }, [farmerId]);

  const handleToggleFollow = async () => {
    if (!farmerId || followBusy) return;
    const wasFollowing = following;
    setFollowing(!wasFollowing);
    setFollowBusy(true);
    try {
      if (wasFollowing) await unfollowUser(farmerId);
      else await followUser(farmerId);
    } catch (e) {
      setFollowing(wasFollowing);
      setError(apiErrorMessage(e));
    } finally {
      setFollowBusy(false);
    }
  };

  const openQuoteDialog = (lotId?: string) => {
    const target = lotId ?? store?.lots.find((l) => l.lotId)?.lotId ?? '';
    setQuoteLotId(target);
    const lot = store?.lots.find((l) => l.lotId === target);
    setQuotePrice(lot ? String(lot.pricePaisa / 100) : '');
    setQuoteQty(lot ? String(Math.min(1, lot.qtyAvailable) || 1) : '1');
    setQuoteNotes('');
    setShowQuote(true);
  };

  const handleRequestQuote = async () => {
    const lot = store?.lots.find((l) => l.lotId === quoteLotId);
    const qty = parseFloat(quoteQty);
    const price = parseFloat(quotePrice);
    if (!lot || !farmerId || quoteBusy) return;
    if (!Number.isFinite(qty) || qty <= 0 || !Number.isFinite(price) || price <= 0) {
      setError('Enter a valid quantity (quintals) and price per quintal.');
      return;
    }
    setQuoteBusy(true);
    setError(null);
    try {
      await customer.createQuote({
        lotId: lot.lotId,
        farmerId,
        farmerName: store?.farmerName,
        crop: lot.crop,
        offeredPricePerQuintal: price,
        quantityQuintals: qty,
        deliveryMode: 'pickup',
        notes: quoteNotes,
      });
      setShowQuote(false);
      setNotice(`Quote request sent for ${lot.crop} — track it in your quote inbox.`);
    } catch (e) {
      setError(apiErrorMessage(e));
    } finally {
      setQuoteBusy(false);
    }
  };

  const handleToggleFavorite = async () => {
    if (!farmerId || favoriteBusy) return;
    setFavoriteBusy(true);
    setError(null);
    try {
      if (favoriteId) {
        await customer.removeFavoriteSupplier(favoriteId);
        setFavoriteId(null);
        setNotice('Removed from favorite suppliers.');
      } else {
        const crops = [...new Set((store?.lots ?? []).map((l) => l.crop).filter(Boolean))].slice(0, 4);
        const created = asRecord(
          await customer.addFavoriteSupplier({
            farmerId,
            farmerName: store?.farmerName ?? 'Farmer',
            primaryCrops: crops,
            location: store?.location ?? '',
          })
        );
        setFavoriteId(str(created.id) || null);
        setNotice('Added to favorite suppliers.');
      }
    } catch (e) {
      setError(apiErrorMessage(e));
    } finally {
      setFavoriteBusy(false);
    }
  };

  // Consolidated GST invoice for this period (plan-gated on the backend).
  const handleInvoiceDownload = async () => {
    if (!invoicePeriod || invoiceBusy) return;
    setInvoiceBusy(true);
    setError(null);
    try {
      const doc = asRecord(await customer.consolidatedInvoices(invoicePeriod));
      const blob = new Blob([JSON.stringify(doc, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `consolidated-invoice-${invoicePeriod}.json`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 5000);
      setNotice(
        `Consolidated invoice ${invoicePeriod}: ${formatPaisa(num(doc.totalPaisa))} + ${formatPaisa(num(doc.gstPaisa))} GST across ${num(doc.lineItemCount)} order(s).`
      );
    } catch (e) {
      setError(apiErrorMessage(e));
    } finally {
      setInvoiceBusy(false);
    }
  };

  const handleAddLotToCart = (lot: StorefrontLot) => {
    if (!farmerId) return;
    addProduceLine(
      {
        lotId: lot.lotId,
        farmerId,
        farmerName: store?.farmerName ?? '',
        crop: lot.crop,
        grade: lot.grade,
        qtyQuintals: Math.min(1, lot.qtyAvailable),
        availableQuintals: lot.qtyAvailable,
        pricePaisa: lot.pricePaisa,
        logisticsMode: 'customer_pickup',
        harvestDate: lot.harvestDate,
      },
      Math.min(1, lot.qtyAvailable)
    );
    setAddedLots((prev) => new Set(prev).add(lot.lotId));
  };

  // The direct-room contract needs a live context id; a confirmed-order lot is
  // the anchor — chat stays locked until then (spec G1).
  const firstLotId = store?.lots.find((l) => l.lotId)?.lotId ?? '';

  const handleChat = async () => {
    const anchorLot = confirmedLotId || firstLotId;
    if (!anchorLot || chatBusy) return;
    setChatBusy(true);
    setError(null);
    try {
      const room = asRecord(await chat.openDirect({ lotId: anchorLot }));
      const roomId = firstStr(room, ['id', 'roomId']);
      if (roomId) navigate(`/chat?room=${encodeURIComponent(roomId)}`);
      else setError('Chat room could not be opened. Please try again.');
    } catch (e) {
      setError(apiErrorMessage(e));
    } finally {
      setChatBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto space-y-4 animate-pulse">
        <div className="h-6 bg-slate-100 rounded w-40" />
        <div className="bg-white rounded-3xl border border-slate-200/80 p-6 flex items-center gap-4">
          <div className="w-16 h-16 bg-slate-100 rounded-full" />
          <div className="space-y-2 flex-1">
            <div className="h-5 bg-slate-100 rounded w-1/3" />
            <div className="h-3 bg-slate-100 rounded w-1/2" />
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-52 bg-slate-100 rounded-3xl" />
          ))}
        </div>
      </div>
    );
  }

  if (notFound || !store) {
    return (
      <div className="max-w-md mx-auto py-16 text-center space-y-4">
        <div className="w-14 h-14 mx-auto rounded-full bg-slate-100 flex items-center justify-center">
          <Store className="w-7 h-7 text-slate-400" />
        </div>
        <h3 className="font-extrabold text-base text-slate-800">Shop not found</h3>
        <p className="text-xs text-slate-500">
          {error ?? 'This seller does not have a storefront on Krishi Mall yet.'}
        </p>
        <Link
          to="/mall"
          className="inline-block px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-xs"
        >
          Back to Krishi Mall
        </Link>
      </div>
    );
  }

  const initials = store.farmerName
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join('');

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <Link to="/mall" className="inline-flex items-center gap-1 text-xs font-bold text-slate-500 hover:text-emerald-700">
        <ChevronLeft className="w-4 h-4" />
        Back to Krishi Mall
      </Link>

      {error && (
        <div className="p-3 bg-rose-50 border border-rose-200 rounded-2xl text-xs font-bold text-rose-800 flex items-center gap-2">
          <AlertCircle className="w-4 h-4" />
          <span>{error}</span>
        </div>
      )}
      {notice && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-2xl text-xs font-bold text-emerald-900 flex items-center gap-2">
          <Handshake className="w-4 h-4 text-emerald-600" />
          <span>{notice}</span>
        </div>
      )}

      {/* Seller header */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          {store.photoUrl ? (
            <img src={store.photoUrl} alt={store.farmerName} className="w-16 h-16 rounded-full object-cover border border-slate-200" />
          ) : (
            <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center text-lg font-black border border-emerald-200">
              {initials || <Store className="w-7 h-7" />}
            </div>
          )}
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-black text-slate-900 leading-tight">{store.farmerName}</h1>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 text-[11px] text-slate-500">
              {store.farmerRating !== null && (
                <span className="flex items-center gap-1 font-bold text-amber-600">
                  <Star className="w-3.5 h-3.5 fill-amber-500 text-amber-500" />
                  {store.farmerRating.toFixed(1)}
                </span>
              )}
              <span className="flex items-center gap-1">
                <Package className="w-3.5 h-3.5" />
                {store.lots.length} product{store.lots.length === 1 ? '' : 's'} listed
              </span>
              {store.location && (
                <span className="flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5" />
                  {store.location}
                </span>
              )}
            </div>
            {store.credentials.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {store.credentials.map((c) => (
                  <span
                    key={c.type}
                    className="px-2 py-0.5 rounded-full bg-emerald-50 border border-emerald-100 text-[10px] font-bold text-emerald-700 flex items-center gap-1"
                  >
                    <Award className="w-3 h-3" />
                    {c.type.replace(/_/g, ' ')} verified
                  </span>
                ))}
              </div>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => void handleToggleFollow()}
              disabled={followBusy}
              className={`px-4 py-2.5 rounded-2xl font-bold text-xs shadow-xs flex items-center gap-1.5 transition-all disabled:opacity-50 ${
                following
                  ? 'bg-emerald-50 border border-emerald-200 text-emerald-700 hover:bg-emerald-100'
                  : 'bg-white border border-slate-200 text-slate-700 hover:border-emerald-600 hover:text-emerald-700'
              }`}
            >
              {following ? <UserCheck className="w-4 h-4" /> : <UserPlus className="w-4 h-4" />}
              <span>{followBusy ? '…' : following ? 'Following' : 'Follow'}</span>
            </button>
            <button
              type="button"
              onClick={() => void handleToggleFavorite()}
              disabled={favoriteBusy}
              className={`px-4 py-2.5 rounded-2xl font-bold text-xs shadow-xs flex items-center gap-1.5 transition-all disabled:opacity-50 ${
                favoriteId
                  ? 'bg-rose-50 border border-rose-200 text-rose-700 hover:bg-rose-100'
                  : 'bg-white border border-slate-200 text-slate-700 hover:border-rose-300 hover:text-rose-600'
              }`}
            >
              <Heart className={`w-4 h-4 ${favoriteId ? 'fill-rose-500 text-rose-500' : ''}`} />
              <span>{favoriteId ? 'Favorited' : 'Favorite'}</span>
            </button>
            {firstLotId ? (
              <button
                type="button"
                onClick={() => openQuoteDialog()}
                className="px-4 py-2.5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md flex items-center gap-1.5 transition-all"
              >
                <Handshake className="w-4 h-4" />
                <span>Request Quote</span>
              </button>
            ) : (
              <span className="text-[10px] text-slate-400 font-semibold px-2">
                Quote requests unlock once the seller lists a lot
              </span>
            )}
            {confirmedLotId ? (
              <button
                type="button"
                onClick={() => void handleChat()}
                disabled={chatBusy}
                className="px-4 py-2.5 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs flex items-center gap-1.5 transition-all disabled:opacity-50"
              >
                <MessageCircle className="w-4 h-4" />
                <span>{chatBusy ? 'Opening…' : 'Chat with seller'}</span>
              </button>
            ) : (
              <span
                className="text-[10px] text-slate-400 font-semibold px-2"
                title="Chat unlocks after an order with this seller is confirmed"
              >
                Chat unlocks post-confirmation
              </span>
            )}
          </div>
        </div>
        {/* Consolidated GST invoice download (C9, plan-gated). */}
        <div className="flex flex-wrap items-center gap-2 mt-4 pt-4 border-t border-slate-100">
          <FileText className="w-4 h-4 text-slate-400" />
          <span className="text-[11px] font-bold text-slate-600">Consolidated GST invoice</span>
          <input
            type="month"
            value={invoicePeriod}
            onChange={(e) => setInvoicePeriod(e.target.value)}
            className="px-2.5 py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-[11px] font-bold text-slate-700 focus:outline-none"
          />
          <button
            type="button"
            onClick={() => void handleInvoiceDownload()}
            disabled={invoiceBusy || !invoicePeriod}
            className="px-3 py-1.5 rounded-xl bg-white border border-slate-200 hover:border-emerald-600 hover:text-emerald-700 text-slate-700 text-[11px] font-bold flex items-center gap-1.5 transition-colors disabled:opacity-50"
          >
            <Download className="w-3.5 h-3.5" />
            {invoiceBusy ? 'Fetching…' : 'Download'}
          </button>
        </div>
      </div>

      {/* Products */}
      <div>
        <h2 className="font-bold text-sm text-slate-900 mb-3">Fresh listings</h2>
        {store.lots.length === 0 ? (
          <div className="bg-white rounded-3xl border border-slate-200/80 py-14 text-center">
            <Package className="w-8 h-8 text-slate-300 mx-auto mb-2" />
            <p className="text-xs text-slate-500">
              {store.farmerName} has no open listings right now. Check back after the next harvest.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {store.lots.map((lot) => (
              <Link
                key={lot.lotId}
                to={`/mall/product/${lot.lotId}`}
                className="bg-white rounded-3xl border border-slate-200/80 shadow-xs p-4 space-y-2 hover:border-emerald-300 transition-colors block"
              >
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-emerald-700 uppercase tracking-wide">
                    {lot.grade ? `Grade ${lot.grade}` : 'Produce'}
                  </span>
                  {lot.freshnessDays !== null && (
                    <span className="text-[10px] text-slate-400">{lot.freshnessDays}d fresh</span>
                  )}
                </div>
                <h3 className="font-bold text-sm text-slate-900 leading-tight">{lot.crop}</h3>
                <p className="text-lg font-black text-slate-900">
                  {formatCurrency(lot.pricePaisa / 100)}
                  <span className="text-[10px] font-semibold text-slate-400"> / quintal</span>
                </p>
                <p className="text-[11px] text-slate-500">
                  {lot.qtyAvailable > 0 ? `${lot.qtyAvailable} quintals available` : 'Sold out'}
                  {lot.harvestDate ? ` · harvested ${lot.harvestDate.slice(0, 10)}` : ''}
                </p>
                <div className="flex items-center gap-1.5 pt-1">
                  <button
                    type="button"
                    onClick={() => handleAddLotToCart(lot)}
                    disabled={lot.qtyAvailable <= 0}
                    className={`flex-1 px-2.5 py-1.5 rounded-lg text-[10px] font-extrabold flex items-center justify-center gap-1 transition-colors disabled:opacity-40 ${
                      addedLots.has(lot.lotId)
                        ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                        : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                    }`}
                  >
                    <ShoppingBasket className="w-3 h-3" />
                    {addedLots.has(lot.lotId) ? 'In cart ✓' : 'Add to produce cart'}
                  </button>
                  <button
                    type="button"
                    onClick={() => openQuoteDialog(lot.lotId)}
                    className="flex-1 px-2.5 py-1.5 rounded-lg bg-white border border-slate-200 hover:border-emerald-600 hover:text-emerald-700 text-slate-600 text-[10px] font-extrabold flex items-center justify-center gap-1 transition-colors"
                  >
                    <Handshake className="w-3 h-3" />
                    Quote this lot
                  </button>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* SR 5: written product reviews */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs space-y-4">
        <h2 className="font-bold text-sm text-slate-900 flex items-center gap-1.5">
          <Star className="w-4 h-4 text-amber-500 fill-amber-500" />
          Ratings & Reviews ({store.reviews.length})
        </h2>
        {store.reviews.length === 0 ? (
          <p className="text-xs text-slate-400">No written reviews yet — reviews from Krishi Mall purchases appear here.</p>
        ) : (
          <div className="space-y-3">
            {store.reviews.map((review, idx) => (
              <div key={`${review.productName}-${idx}`} className="border border-slate-100 rounded-2xl p-3 space-y-1.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-[11px] font-bold text-emerald-700 uppercase tracking-wide">
                    {review.productName}
                  </span>
                  <span className="flex items-center gap-0.5">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Star
                        key={i}
                        className={`w-3 h-3 ${i < review.stars ? 'fill-amber-500 text-amber-500' : 'text-slate-200'}`}
                      />
                    ))}
                  </span>
                </div>
                <p className="text-xs font-bold text-slate-800">{review.reviewerName}</p>
                {review.comment && <p className="text-xs text-slate-600">{review.comment}</p>}
                {review.reply && (
                  <p className="text-[11px] text-slate-500 bg-slate-50 border border-slate-100 rounded-xl px-3 py-2">
                    <span className="font-bold">Seller reply:</span> {review.reply}
                  </p>
                )}
                <p className="text-[10px] text-slate-400">{formatDateTime(review.createdAt)}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Request Quote dialog — binds the chosen lot (spec: quote first). */}
      {showQuote && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setShowQuote(false)} />
          <div className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl border border-slate-200 p-6 space-y-3">
            <h3 className="font-black text-sm text-slate-900 flex items-center gap-1.5">
              <Handshake className="w-4 h-4 text-emerald-600" />
              Request a binding quote
            </h3>
            <p className="text-[11px] text-slate-500">
              The farmer gets 24h to respond; the quoted price locks for 30 minutes per counter round (max 3
              rounds). Accepting creates an escrow-protected order.
            </p>
            <label className="block text-[11px] font-bold text-slate-600">
              Lot
              <select
                value={quoteLotId}
                onChange={(e) => {
                  setQuoteLotId(e.target.value);
                  const lot = store?.lots.find((l) => l.lotId === e.target.value);
                  if (lot) {
                    setQuotePrice(String(lot.pricePaisa / 100));
                    setQuoteQty(String(Math.min(1, lot.qtyAvailable) || 1));
                  }
                }}
                className="mt-1 w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:border-emerald-600"
              >
                {(store?.lots ?? []).map((lot) => (
                  <option key={lot.lotId} value={lot.lotId}>
                    {lot.crop} — {formatPaisa(lot.pricePaisa)}/q ({lot.qtyAvailable} q available)
                  </option>
                ))}
              </select>
            </label>
            <div className="grid grid-cols-2 gap-2">
              <label className="block text-[11px] font-bold text-slate-600">
                Quantity (quintals)
                <input
                  type="number"
                  min="0.5"
                  step="0.5"
                  value={quoteQty}
                  onChange={(e) => setQuoteQty(e.target.value)}
                  className="mt-1 w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:border-emerald-600"
                />
              </label>
              <label className="block text-[11px] font-bold text-slate-600">
                Price (Rs / quintal)
                <input
                  type="number"
                  min="1"
                  value={quotePrice}
                  onChange={(e) => setQuotePrice(e.target.value)}
                  className="mt-1 w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:border-emerald-600"
                />
              </label>
            </div>
            <textarea
              rows={2}
              value={quoteNotes}
              onChange={(e) => setQuoteNotes(e.target.value)}
              placeholder="Notes for the farmer (grade, moisture, delivery…)"
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:border-emerald-600"
            />
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setShowQuote(false)}
                className="flex-1 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 font-bold text-xs text-slate-700"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void handleRequestQuote()}
                disabled={quoteBusy}
                className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 font-bold text-xs text-white disabled:opacity-50"
              >
                {quoteBusy ? 'Sending…' : 'Send quote request'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
