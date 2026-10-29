import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertCircle, Check, Heart, Home, Search, ShoppingBag, ShoppingCart } from 'lucide-react';
import { apiErrorMessage, gruhUdyog, mall } from '../../lib/api';
import { useCartStore } from '../../stores/cartStore';
import type { MallProduct } from '../../types';
import { MallProductCard } from './MallProductCard';
import { asRecords, str, toMallProduct, type ApiProductDoc } from './mallMappers';

const BASE_CATEGORIES = ['All', 'Seeds', 'Fertilizers', 'Crop Protection', 'Tools & Machinery', 'Organic Produce', 'Cattle Feed'];

export const KrishiMallCatalogView: React.FC = () => {
  const [products, setProducts] = useState<MallProduct[]>([]);
  const [wishlistIds, setWishlistIds] = useState<Set<string>>(new Set());
  const [gruhCategories, setGruhCategories] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [womenLed, setWomenLed] = useState(false);
  const [addedAlert, setAddedAlert] = useState<string | null>(null);
  const [wishlistAlert, setWishlistAlert] = useState<string | null>(null);
  const [addingId, setAddingId] = useState<string | null>(null);

  const { addItem, getTotalItems } = useCartStore();

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const [productDocs, wishlistItems] = await Promise.all([
          // Women-led chip narrows the catalog to gruh-udyog + women-enterprise listings.
          mall.products(
            womenLed ? { source: 'gruh_udyog,women_enterprise' } : undefined
          ),
          mall.wishlist().catch(() => [] as MallProduct[]),
        ]);
        if (!mounted) return;
        setProducts((productDocs as unknown as ApiProductDoc[]).map(toMallProduct));
        setWishlistIds(new Set(wishlistItems.map((p) => p.id)));
      } catch (e) {
        if (mounted) setError(apiErrorMessage(e));
      } finally {
        if (mounted) setLoading(false);
      }
    };
    void load();

    // Gruh-udyog categories ride along best-effort — they never block the catalog.
    gruhUdyog
      .categories()
      .then((cats) => {
        if (!mounted) return;
        setGruhCategories(
          asRecords(cats)
            .map((c) => str(c.category))
            .filter(Boolean)
        );
      })
      .catch(() => undefined);
    return () => {
      mounted = false;
    };
  }, [womenLed]);

  const categories = useMemo(() => {
    const fromData = products.map((p) => p.category).filter((c) => !BASE_CATEGORIES.includes(c));
    return [...BASE_CATEGORIES, ...Array.from(new Set(fromData))];
  }, [products]);

  const filtered = products.filter((p) => {
    const matchesCat = selectedCategory === 'All' || p.category === selectedCategory;
    const q = search.toLowerCase();
    const matchesQuery =
      !q ||
      p.title.toLowerCase().includes(q) ||
      p.brand.toLowerCase().includes(q) ||
      p.sellerName.toLowerCase().includes(q);
    return matchesCat && matchesQuery;
  });

  const flash = (setter: (v: string | null) => void, message: string) => {
    setter(message);
    window.setTimeout(() => setter(null), 1800);
  };

  const handleAddToCart = async (product: MallProduct) => {
    addItem(product, 1);
    flash(setAddedAlert, product.title);
    setAddingId(product.id);
    try {
      await mall.addToCart(product.id, 1);
    } catch {
      // Optimistic store entry stays; server sync retried from the cart page.
    } finally {
      setAddingId(null);
    }
  };

  const handleToggleWishlist = async (product: MallProduct) => {
    const wasSaved = wishlistIds.has(product.id);
    setWishlistIds((prev) => {
      const next = new Set(prev);
      if (wasSaved) next.delete(product.id);
      else next.add(product.id);
      return next;
    });
    try {
      if (wasSaved) {
        await mall.removeFromWishlist(product.id);
        flash(setWishlistAlert, `Removed "${product.title}" from wishlist`);
      } else {
        await mall.addToWishlist(product.id);
        flash(setWishlistAlert, `Saved "${product.title}" to wishlist`);
      }
    } catch (e) {
      setWishlistIds((prev) => {
        const next = new Set(prev);
        if (wasSaved) next.add(product.id);
        else next.delete(product.id);
        return next;
      });
      flash(setWishlistAlert, apiErrorMessage(e));
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 flex items-center gap-2">
            <ShoppingBag className="w-7 h-7 text-emerald-600" />
            Shopping Mall (Direct Agri Inputs)
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Certified seeds, fertilizers, biologicals, and farm tools with doorstep delivery and transparent pricing
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <Link
            to="/mall/wishlist"
            className="px-3.5 py-2.5 rounded-2xl bg-white border border-slate-200 hover:bg-rose-50 hover:border-rose-200 text-slate-600 hover:text-rose-600 font-bold text-xs shadow-xs flex items-center gap-1.5 transition-all"
          >
            <Heart className="w-4 h-4" />
            <span>Wishlist</span>
          </Link>
          <Link
            to="/mall/cart"
            className="px-4 py-2.5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md flex items-center gap-2 transition-all"
          >
            <ShoppingCart className="w-4 h-4" />
            <span>View Cart ({getTotalItems()})</span>
          </Link>
        </div>
      </div>

      {addedAlert && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-2xl text-xs font-bold text-emerald-900 flex items-center gap-2 animate-in fade-in">
          <Check className="w-4 h-4 text-emerald-600" />
          <span>Added "{addedAlert}" to your cart!</span>
        </div>
      )}
      {wishlistAlert && (
        <div className="p-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-bold text-slate-700 flex items-center gap-2 animate-in fade-in">
          <Heart className="w-4 h-4 text-rose-500" />
          <span>{wishlistAlert}</span>
        </div>
      )}
      {error && (
        <div className="p-3 bg-rose-50 border border-rose-200 rounded-2xl text-xs font-bold text-rose-800 flex items-center gap-2">
          <AlertCircle className="w-4 h-4" />
          <span>Catalog failed to load: {error}</span>
        </div>
      )}

      {/* Search & Categories Bar */}
      <div className="flex flex-col gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
          <input
            type="text"
            placeholder="Search by brand, seed variety, or fertilizer..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 text-xs rounded-2xl border border-slate-200 bg-white focus:outline-none focus:border-emerald-600"
          />
        </div>

        <div className="flex gap-1.5 overflow-x-auto no-scrollbar pb-1">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-3.5 py-2 text-xs font-semibold rounded-2xl whitespace-nowrap transition-colors ${
                selectedCategory === cat
                  ? 'bg-emerald-600 text-white font-bold shadow-xs'
                  : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        <div className="flex gap-1.5 overflow-x-auto no-scrollbar pb-1">
          <button
            onClick={() => {
              setWomenLed((v) => !v);
              setSelectedCategory('All');
            }}
            className={`px-3.5 py-2 text-xs font-semibold rounded-2xl whitespace-nowrap transition-colors flex items-center gap-1.5 ${
              womenLed
                ? 'bg-pink-600 text-white font-bold shadow-xs'
                : 'bg-white border border-pink-200 text-pink-700 hover:bg-pink-50'
            }`}
          >
            <Heart className={`w-3.5 h-3.5 ${womenLed ? 'fill-white' : ''}`} />
            Women-led
          </button>
          {womenLed && (
            <span className="self-center text-[10px] text-pink-600 font-bold">
              Showing SHG &amp; gruh udyog products only
            </span>
          )}
        </div>

        {gruhCategories.length > 0 && (
          <div className="flex items-start gap-2">
            <span className="flex items-center gap-1 text-[11px] font-bold text-purple-700 bg-purple-50 border border-purple-100 px-2 py-1.5 rounded-xl whitespace-nowrap">
              <Home className="w-3 h-3" />
              Gruh Udyog
            </span>
            <div className="flex gap-1.5 overflow-x-auto no-scrollbar pb-1">
              {gruhCategories.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-3 py-1.5 text-[11px] font-semibold rounded-2xl whitespace-nowrap transition-colors ${
                    selectedCategory === cat
                      ? 'bg-purple-600 text-white font-bold'
                      : 'bg-white border border-purple-100 text-purple-700 hover:bg-purple-50'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Products Grid */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="bg-white rounded-3xl border border-slate-200/80 p-4 space-y-3 animate-pulse">
              <div className="h-44 bg-slate-100 rounded-2xl" />
              <div className="h-3 bg-slate-100 rounded w-1/3" />
              <div className="h-4 bg-slate-100 rounded w-3/4" />
              <div className="h-8 bg-slate-100 rounded-xl" />
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="py-16 text-center text-xs text-slate-500">
          No products match your search. Try a different category or keyword.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {filtered.map((product) => (
            <MallProductCard
              key={product.id}
              product={product}
              inWishlist={wishlistIds.has(product.id)}
              onToggleWishlist={handleToggleWishlist}
              onAddToCart={handleAddToCart}
              addingToCart={addingId === product.id}
            />
          ))}
        </div>
      )}
    </div>
  );
};
