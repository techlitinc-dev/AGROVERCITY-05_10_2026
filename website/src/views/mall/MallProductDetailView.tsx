import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  Award,
  Check,
  ChevronLeft,
  Heart,
  Home,
  Minus,
  Plus,
  QrCode,
  ShieldCheck,
  ShoppingCart,
  Star,
} from 'lucide-react';
import { apiErrorMessage, gruhUdyog, mall } from '../../lib/api';
import { useCartStore } from '../../stores/cartStore';
import { formatCurrency } from '../../lib/utils';
import type { MallProduct } from '../../types';
import { asRecords, asRecord, formatDateTime, num, str, toMallProduct, type ApiProductDoc } from './mallMappers';

interface ReviewItem {
  id?: string;
  userName?: string;
  rating?: number;
  comment?: string;
  createdAt?: string;
}

interface UnitInfo {
  name?: string;
  category?: string;
  village?: string;
  district?: string;
  state?: string;
  shgName?: string;
  description?: string;
}

export const MallProductDetailView: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [raw, setRaw] = useState<ApiProductDoc | null>(null);
  const [product, setProduct] = useState<MallProduct | null>(null);
  const [reviews, setReviews] = useState<ReviewItem[]>([]);
  const [unit, setUnit] = useState<UnitInfo | null>(null);
  const [certificate, setCertificate] = useState<Record<string, unknown> | null>(null);
  const [certError, setCertError] = useState<string | null>(null);
  const [inWishlist, setInWishlist] = useState(false);
  const [qty, setQty] = useState(1);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [added, setAdded] = useState(false);
  const [adding, setAdding] = useState(false);
  const [userRating, setUserRating] = useState(0);
  const [userComment, setUserComment] = useState('');
  const [reviewMessage, setReviewMessage] = useState<string | null>(null);

  const { addItem } = useCartStore();

  useEffect(() => {
    if (!id) return;
    let mounted = true;
    const load = async () => {
      setLoading(true);
      try {
        const doc = (await mall.product(id)) as unknown as ApiProductDoc;
        if (!mounted) return;
        setRaw(doc);
        setProduct(toMallProduct(doc));
      } catch (e) {
        if (mounted) {
          setNotFound(true);
          setError(apiErrorMessage(e));
        }
      } finally {
        if (mounted) setLoading(false);
      }
    };
    void load();

    mall
      .productReviews(id)
      .then((payload) => {
        if (mounted) setReviews(asRecords(payload) as ReviewItem[]);
      })
      .catch(() => undefined);

    mall
      .wishlist()
      .then((list) => {
        if (mounted) setInWishlist(list.some((p) => p.id === id));
      })
      .catch(() => undefined);
    return () => {
      mounted = false;
    };
  }, [id]);

  // Gruh-udyog brand card — only for home-enterprise sourced listings.
  const unitId = str(raw?.unitId);
  const isGruhUdyog = str(raw?.source) === 'gruh_udyog' && unitId.length > 0;
  useEffect(() => {
    if (!isGruhUdyog) return;
    let mounted = true;
    gruhUdyog
      .unit(unitId)
      .then((payload) => {
        if (mounted) setUnit(asRecord(payload) as UnitInfo);
      })
      .catch(() => undefined);
    return () => {
      mounted = false;
    };
  }, [isGruhUdyog, unitId]);

  const loadCertificate = async () => {
    if (!id) return;
    setCertError(null);
    try {
      const cert = await mall.productCertificate(id);
      setCertificate(asRecord(cert));
    } catch (e) {
      setCertificate(null);
      setCertError(apiErrorMessage(e));
    }
  };

  const handleAddToCart = async () => {
    if (!product) return;
    addItem(product, qty);
    setAdded(true);
    window.setTimeout(() => setAdded(false), 1800);
    setAdding(true);
    try {
      await mall.addToCart(product.id, qty);
    } catch {
      // optimistic store entry stays; the cart page re-syncs with the server
    } finally {
      setAdding(false);
    }
  };

  const handleToggleWishlist = async () => {
    if (!product) return;
    const wasSaved = inWishlist;
    setInWishlist(!wasSaved);
    try {
      if (wasSaved) await mall.removeFromWishlist(product.id);
      else await mall.addToWishlist(product.id);
    } catch (e) {
      setInWishlist(wasSaved);
      setError(apiErrorMessage(e));
    }
  };

  const handleSubmitReview = async () => {
    if (!id || userRating === 0) {
      setReviewMessage('Please pick a star rating first.');
      return;
    }
    try {
      await mall.reviewProduct(id, { rating: userRating, comment: userComment });
      setReviewMessage('Thank you! Your review has been posted.');
      setUserRating(0);
      setUserComment('');
      const updated = await mall.productReviews(id).catch(() => []);
      setReviews(asRecords(updated) as ReviewItem[]);
    } catch (e) {
      setReviewMessage(apiErrorMessage(e));
    }
  };

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto space-y-4 animate-pulse">
        <div className="h-6 bg-slate-100 rounded w-40" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="h-80 bg-slate-100 rounded-3xl" />
          <div className="space-y-3">
            <div className="h-6 bg-slate-100 rounded w-3/4" />
            <div className="h-4 bg-slate-100 rounded w-1/2" />
            <div className="h-10 bg-slate-100 rounded-xl" />
          </div>
        </div>
      </div>
    );
  }

  if (notFound || !product) {
    return (
      <div className="max-w-md mx-auto py-16 text-center space-y-4">
        <h3 className="font-extrabold text-base text-slate-800">Product not found</h3>
        <p className="text-xs text-slate-500">{error ?? 'This listing may have been removed from Krishi Mall.'}</p>
        <Link to="/mall" className="inline-block px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-xs">
          Back to Catalog
        </Link>
      </div>
    );
  }

  const specs = Object.entries(product.specifications ?? {});
  const outOfStock = product.stockQty <= 0 || raw?.inStock === false;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <Link to="/mall" className="inline-flex items-center gap-1 text-xs font-bold text-slate-500 hover:text-emerald-700">
        <ChevronLeft className="w-4 h-4" />
        Back to Krishi Mall
      </Link>

      {error && (
        <div className="p-3 bg-rose-50 border border-rose-200 rounded-2xl text-xs font-bold text-rose-800">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Image */}
        <div className="bg-white rounded-3xl overflow-hidden border border-slate-200/80 shadow-xs">
          <img src={product.imageUrl} alt={product.title} className="w-full h-80 object-cover" />
          {isGruhUdyog && (
            <div className="px-4 py-2 bg-purple-50 border-t border-purple-100 text-[11px] font-bold text-purple-700 flex items-center gap-1.5">
              <Home className="w-3.5 h-3.5" />
              Home Enterprise (Gruh Udyog) product
            </div>
          )}
        </div>

        {/* Info */}
        <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[11px] font-bold text-emerald-700 uppercase tracking-wide">
                {product.brand || product.category}
              </p>
              <h1 className="text-xl font-black text-slate-900 leading-tight mt-1">{product.title}</h1>
              <p className="text-[11px] text-slate-400 mt-1">Sold by {product.sellerName}</p>
            </div>
            <button
              onClick={() => void handleToggleWishlist()}
              aria-label={inWishlist ? 'Remove from wishlist' : 'Add to wishlist'}
              className={`p-2 rounded-full transition-colors ${
                inWishlist ? 'text-rose-600 bg-rose-50' : 'text-slate-300 hover:text-rose-500 hover:bg-rose-50'
              }`}
            >
              <Heart className={`w-5 h-5 ${inWishlist ? 'fill-rose-500 text-rose-500' : ''}`} />
            </button>
          </div>

          <div className="flex items-center gap-1.5 text-xs font-bold text-amber-600">
            <Star className="w-4 h-4 fill-amber-500 text-amber-500" />
            <span>{product.rating > 0 ? product.rating.toFixed(1) : 'New listing'}</span>
            {product.ratingCount > 0 && <span className="text-slate-400 font-normal">· {product.ratingCount} reviews</span>}
            {str(raw?.batchNo) && <span className="text-slate-400 font-normal">· Batch {str(raw?.batchNo)}</span>}
          </div>

          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-black text-slate-900">{formatCurrency(product.price)}</span>
            {product.mrp > product.price && (
              <>
                <span className="text-sm text-slate-400 line-through">{formatCurrency(product.mrp)}</span>
                <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded">
                  Save {Math.round(((product.mrp - product.price) / product.mrp) * 100)}%
                </span>
              </>
            )}
            {product.unit && <span className="text-[11px] text-slate-400">/ {product.unit}</span>}
          </div>

          {raw?.bnplAvailable === true && (
            <p className="text-[11px] font-bold text-indigo-700 bg-indigo-50 border border-indigo-100 rounded-xl px-3 py-2">
              BNPL available — split this purchase into 2 installments at checkout.
            </p>
          )}

          <p className="text-xs text-slate-600 leading-relaxed">{product.description || 'Quality-checked agricultural input with doorstep delivery.'}</p>

          {/* Certificate */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => void loadCertificate()}
              className="px-3 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 hover:border-emerald-600 hover:text-emerald-700 flex items-center gap-1.5 transition-colors"
            >
              <QrCode className="w-4 h-4" />
              View QR Certificate
            </button>
            {str(raw?.batchNo) && (
              <span className="text-[10px] text-slate-400 font-mono">batch {str(raw?.batchNo)}</span>
            )}
          </div>

          {/* Qty + Add to cart */}
          <div className="flex items-center gap-3 pt-1">
            <div className="flex items-center border border-slate-200 rounded-xl bg-slate-50 p-1">
              <button
                onClick={() => setQty((q) => Math.max(1, q - 1))}
                className="p-1.5 text-slate-500 hover:text-slate-800"
                aria-label="Decrease quantity"
              >
                <Minus className="w-3.5 h-3.5" />
              </button>
              <span className="px-3 text-sm font-bold text-slate-800">{qty}</span>
              <button
                onClick={() => setQty((q) => Math.min(Math.max(1, product.stockQty), q + 1))}
                className="p-1.5 text-slate-500 hover:text-slate-800"
                aria-label="Increase quantity"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>
            <button
              type="button"
              onClick={() => void handleAddToCart()}
              disabled={outOfStock || adding}
              className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-md transition-all flex items-center justify-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ShoppingCart className="w-4 h-4" />
              <span>{adding ? 'Adding…' : outOfStock ? 'Out of Stock' : `Add to Cart · ${formatCurrency(product.price * qty)}`}</span>
            </button>
          </div>
          {added && (
            <p className="text-[11px] font-bold text-emerald-700 flex items-center gap-1">
              <Check className="w-3.5 h-3.5" /> Added to cart
              <Link to="/mall/cart" className="underline">view cart</Link>
            </p>
          )}
        </div>
      </div>

      {/* Gruh Udyog unit brand card */}
      {isGruhUdyog && (
        <div className="bg-purple-50 border border-purple-100 rounded-3xl p-5 flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-purple-600 text-white flex items-center justify-center shrink-0">
            <Home className="w-6 h-6" />
          </div>
          <div className="flex-1">
            <p className="text-[10px] font-bold text-purple-500 uppercase tracking-wide">Gruh Udyog Unit</p>
            <h3 className="font-black text-sm text-slate-900">{unit?.name ?? 'Verified home enterprise'}</h3>
            <p className="text-[11px] text-slate-500 mt-0.5">
              {[unit?.category, [unit?.village, unit?.district].filter(Boolean).join(', ')].filter(Boolean).join(' · ')}
              {unit?.shgName ? ` · SHG: ${unit.shgName}` : ''}
            </p>
            {unit?.description && <p className="text-[11px] text-slate-600 mt-1">{unit.description}</p>}
          </div>
          <span className="px-3 py-1.5 rounded-full bg-white border border-purple-100 text-[10px] font-bold text-purple-700 flex items-center gap-1 shrink-0">
            <Award className="w-3 h-3" />
            Women-led enterprise
          </span>
        </div>
      )}

      {/* Specifications */}
      {specs.length > 0 && (
        <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs">
          <h3 className="font-bold text-sm text-slate-900 mb-3">Specifications</h3>
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2">
            {specs.map(([key, value]) => (
              <div key={key} className="flex justify-between gap-4 text-xs border-b border-slate-100 pb-2">
                <dt className="text-slate-500">{key}</dt>
                <dd className="font-bold text-slate-800 text-right">{value}</dd>
              </div>
            ))}
          </dl>
        </div>
      )}

      {/* Reviews */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs space-y-4">
        <h3 className="font-bold text-sm text-slate-900">Reviews ({reviews.length})</h3>

        {reviews.length === 0 ? (
          <p className="text-xs text-slate-400">No reviews yet — be the first to rate this product.</p>
        ) : (
          <div className="space-y-3">
            {reviews.map((review, idx) => (
              <div key={review.id ?? idx} className="border border-slate-100 rounded-2xl p-3 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-800">{review.userName || 'Verified buyer'}</span>
                  <span className="flex items-center gap-0.5">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Star
                        key={i}
                        className={`w-3 h-3 ${i < num(review.rating) ? 'fill-amber-500 text-amber-500' : 'text-slate-200'}`}
                      />
                    ))}
                  </span>
                </div>
                {review.comment && <p className="text-xs text-slate-600">{review.comment}</p>}
                <p className="text-[10px] text-slate-400">{formatDateTime(review.createdAt)}</p>
              </div>
            ))}
          </div>
        )}

        {/* Write a review */}
        <div className="border-t border-slate-100 pt-4 space-y-2">
          <p className="text-xs font-bold text-slate-700">Rate this product</p>
          <div className="flex items-center gap-1">
            {Array.from({ length: 5 }).map((_, i) => (
              <button
                key={i}
                type="button"
                onClick={() => setUserRating(i + 1)}
                aria-label={`${i + 1} star`}
                className="p-0.5"
              >
                <Star
                  className={`w-5 h-5 ${i < userRating ? 'fill-amber-500 text-amber-500' : 'text-slate-300 hover:text-amber-400'}`}
                />
              </button>
            ))}
          </div>
          <textarea
            rows={2}
            value={userComment}
            onChange={(e) => setUserComment(e.target.value)}
            placeholder="Share your experience (optional, max 500 characters)"
            maxLength={500}
            className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:border-emerald-600"
          />
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => void handleSubmitReview()}
              className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs"
            >
              Submit Review
            </button>
            {reviewMessage && <span className="text-[11px] text-slate-500">{reviewMessage}</span>}
          </div>
        </div>
      </div>

      {/* Certificate modal */}
      {certificate !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setCertificate(null)} />
          <div className="relative w-full max-w-sm bg-white rounded-3xl shadow-2xl border border-slate-200 p-6 space-y-3">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-emerald-600" />
              <h3 className="font-black text-sm text-slate-900">Quality Certificate</h3>
            </div>
            <dl className="space-y-2 text-xs">
              {Object.entries(certificate).map(([key, value]) => (
                <div key={key} className="flex justify-between gap-4 border-b border-slate-100 pb-2">
                  <dt className="text-slate-500 capitalize">{key.replace(/([A-Z])/g, ' $1')}</dt>
                  <dd className="font-bold text-slate-800 text-right">
                    {typeof value === 'boolean' ? (value ? 'Yes ✓' : 'No') : String(value)}
                  </dd>
                </div>
              ))}
            </dl>
            <button
              type="button"
              onClick={() => setCertificate(null)}
              className="w-full py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 font-bold text-xs text-slate-700"
            >
              Close
            </button>
          </div>
        </div>
      )}
      {certificate === null && certError !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setCertError(null)} />
          <div className="relative w-full max-w-sm bg-white rounded-3xl shadow-2xl border border-slate-200 p-6 space-y-3">
            <h3 className="font-black text-sm text-slate-900">Certificate unavailable</h3>
            <p className="text-xs text-slate-500">{certError}</p>
            <button
              type="button"
              onClick={() => setCertError(null)}
              className="w-full py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 font-bold text-xs text-slate-700"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
