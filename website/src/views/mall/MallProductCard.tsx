import React from 'react';
import { Link } from 'react-router-dom';
import { Heart, ShoppingCart, Star } from 'lucide-react';
import { formatCurrency } from '../../lib/utils';
import type { MallProduct } from '../../types';

interface MallProductCardProps {
  product: MallProduct;
  inWishlist: boolean;
  onToggleWishlist: (product: MallProduct) => void;
  onAddToCart: (product: MallProduct) => void;
  addingToCart?: boolean;
}

/** Shared catalog card used by the mall catalog, wishlist and home "recommended" rows. */
export const MallProductCard: React.FC<MallProductCardProps> = ({
  product,
  inWishlist,
  onToggleWishlist,
  onAddToCart,
  addingToCart,
}) => {
  const outOfStock = product.stockQty <= 0;

  return (
    <div className="bg-white rounded-3xl overflow-hidden border border-slate-200/80 shadow-xs hover:shadow-md transition-all flex flex-col justify-between">
      <div>
        <Link to={`/mall/product/${product.id}`} className="block">
          <div className="h-44 w-full bg-slate-100 overflow-hidden relative">
            <img src={product.imageUrl} alt={product.title} className="w-full h-full object-cover" />
            <span className="absolute top-2.5 left-2.5 bg-slate-900/70 backdrop-blur-sm text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
              {product.brand || product.category}
            </span>
            {outOfStock && (
              <span className="absolute inset-0 bg-slate-900/50 flex items-center justify-center text-white text-xs font-black uppercase tracking-wider">
                Out of Stock
              </span>
            )}
          </div>
        </Link>

        <div className="p-4 space-y-1.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1 text-[11px] font-bold text-amber-600">
              <Star className="w-3.5 h-3.5 fill-amber-500 text-amber-500" />
              <span>{product.rating > 0 ? product.rating.toFixed(1) : 'New'}</span>
              {product.ratingCount > 0 && (
                <span className="text-slate-400 font-normal">({product.ratingCount})</span>
              )}
            </div>
            <button
              onClick={() => onToggleWishlist(product)}
              aria-label={inWishlist ? 'Remove from wishlist' : 'Add to wishlist'}
              className={`p-1.5 rounded-full transition-colors ${
                inWishlist
                  ? 'text-rose-600 bg-rose-50 hover:bg-rose-100'
                  : 'text-slate-300 hover:text-rose-500 hover:bg-rose-50'
              }`}
            >
              <Heart className={`w-4 h-4 ${inWishlist ? 'fill-rose-500 text-rose-500' : ''}`} />
            </button>
          </div>

          <Link to={`/mall/product/${product.id}`}>
            <h4 className="font-extrabold text-xs text-slate-900 line-clamp-2 leading-tight hover:text-emerald-700">
              {product.title}
            </h4>
          </Link>
          <p className="text-[11px] text-slate-400">Sold by {product.sellerName}</p>

          <div className="pt-2 flex items-baseline gap-2 flex-wrap">
            <span className="text-base font-black text-slate-900">{formatCurrency(product.price)}</span>
            {product.mrp > product.price && (
              <>
                <span className="text-xs text-slate-400 line-through">{formatCurrency(product.mrp)}</span>
                <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded">
                  Save {Math.round(((product.mrp - product.price) / product.mrp) * 100)}%
                </span>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="p-4 pt-0">
        <button
          onClick={() => onAddToCart(product)}
          disabled={outOfStock || addingToCart}
          className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-bold text-xs shadow-xs transition-all flex items-center justify-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <ShoppingCart className="w-3.5 h-3.5" />
          <span>{addingToCart ? 'Adding…' : outOfStock ? 'Out of Stock' : 'Add to Cart'}</span>
        </button>
      </div>
    </div>
  );
};
