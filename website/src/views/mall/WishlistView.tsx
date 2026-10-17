import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Check, Heart, ShoppingCart, Trash2 } from 'lucide-react';
import { apiErrorMessage, mall } from '../../lib/api';
import { useCartStore } from '../../stores/cartStore';
import { formatCurrency } from '../../lib/utils';
import type { MallProduct } from '../../types';

export const WishlistView: React.FC = () => {
  const [items, setItems] = useState<MallProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [movedId, setMovedId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const { addItem } = useCartStore();

  const load = async () => {
    setLoading(true);
    try {
      setItems(await mall.wishlist());
    } catch (e) {
      setError(apiErrorMessage(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleMoveToCart = async (product: MallProduct) => {
    setBusyId(product.id);
    try {
      await mall.addToCart(product.id, 1);
      await mall.removeFromWishlist(product.id);
      addItem(product, 1);
      setItems((prev) => prev.filter((p) => p.id !== product.id));
      setMovedId(product.id);
      window.setTimeout(() => setMovedId(null), 1800);
    } catch (e) {
      setError(apiErrorMessage(e));
    } finally {
      setBusyId(null);
    }
  };

  const handleRemove = async (product: MallProduct) => {
    setBusyId(product.id);
    try {
      await mall.removeFromWishlist(product.id);
      setItems((prev) => prev.filter((p) => p.id !== product.id));
    } catch (e) {
      setError(apiErrorMessage(e));
    } finally {
      setBusyId(null);
    }
  };

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto space-y-4">
        <div className="h-8 bg-slate-100 rounded w-56 animate-pulse" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-white rounded-3xl border border-slate-200/80 p-4 space-y-3 animate-pulse">
              <div className="h-44 bg-slate-100 rounded-2xl" />
              <div className="h-4 bg-slate-100 rounded w-3/4" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="border-b border-slate-200 pb-4">
        <h1 className="text-2xl font-extrabold text-slate-900 flex items-center gap-2">
          <Heart className="w-7 h-7 text-rose-500" />
          My Wishlist ({items.length})
        </h1>
        <p className="text-xs text-slate-500 mt-1">Saved products — move them to your cart when you are ready to order</p>
      </div>

      {error && (
        <div className="p-3 bg-rose-50 border border-rose-200 rounded-2xl text-xs font-bold text-rose-800">{error}</div>
      )}
      {movedId && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-2xl text-xs font-bold text-emerald-900 flex items-center gap-2">
          <Check className="w-4 h-4 text-emerald-600" />
          Moved to cart! <Link to="/mall/cart" className="underline">View cart</Link>
        </div>
      )}

      {items.length === 0 ? (
        <div className="py-16 text-center space-y-4">
          <div className="w-16 h-16 rounded-2xl bg-rose-50 text-rose-400 flex items-center justify-center mx-auto">
            <Heart className="w-8 h-8" />
          </div>
          <h3 className="font-extrabold text-base text-slate-800">Your wishlist is empty</h3>
          <p className="text-xs text-slate-500">Tap the heart on any product to save it here.</p>
          <Link
            to="/mall"
            className="inline-block px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-xs"
          >
            Browse Krishi Mall
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {items.map((product) => (
            <div
              key={product.id}
              className="bg-white rounded-3xl overflow-hidden border border-slate-200/80 shadow-xs hover:shadow-md transition-all flex flex-col justify-between"
            >
              <Link to={`/mall/product/${product.id}`}>
                <div className="h-44 w-full bg-slate-100 overflow-hidden">
                  <img src={product.imageUrl} alt={product.title} className="w-full h-full object-cover" />
                </div>
                <div className="p-4 space-y-1.5">
                  <h4 className="font-extrabold text-xs text-slate-900 line-clamp-2 leading-tight hover:text-emerald-700">
                    {product.title}
                  </h4>
                  <p className="text-[11px] text-slate-400">{product.brand}</p>
                  <span className="text-base font-black text-slate-900 block pt-1">
                    {formatCurrency(product.price)}
                  </span>
                </div>
              </Link>
              <div className="p-4 pt-0 flex gap-2">
                <button
                  type="button"
                  onClick={() => void handleMoveToCart(product)}
                  disabled={busyId === product.id}
                  className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs transition-all flex items-center justify-center gap-1.5 disabled:opacity-50"
                >
                  <ShoppingCart className="w-3.5 h-3.5" />
                  <span>Move to Cart</span>
                </button>
                <button
                  type="button"
                  onClick={() => void handleRemove(product)}
                  disabled={busyId === product.id}
                  aria-label="Remove from wishlist"
                  className="p-2.5 rounded-xl border border-slate-200 text-slate-400 hover:text-rose-600 hover:border-rose-200 transition-colors disabled:opacity-50"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
