import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { ShoppingBag, Search, Star, ShoppingCart, Check, Filter } from 'lucide-react';
import { MOCK_MALL_PRODUCTS } from '../../lib/api';
import { useCartStore } from '../../stores/cartStore';
import { formatCurrency } from '../../lib/utils';
import type { MallProduct } from '../../types';

export const KrishiMallCatalogView: React.FC = () => {
  const [products, setProducts] = useState<MallProduct[]>(MOCK_MALL_PRODUCTS);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [addedAlert, setAddedAlert] = useState<string | null>(null);

  const { addItem, getTotalItems } = useCartStore();

  const categories = ['All', 'Seeds', 'Fertilizers', 'Crop Protection', 'Tools & Machinery'];

  const filtered = products.filter((p) => {
    const matchesCat = selectedCategory === 'All' || p.category === selectedCategory;
    const matchesQuery = p.title.toLowerCase().includes(search.toLowerCase()) || p.brand.toLowerCase().includes(search.toLowerCase());
    return matchesCat && matchesQuery;
  });

  const handleAddToCart = (product: MallProduct) => {
    addItem(product, 1);
    setAddedAlert(product.title);
    setTimeout(() => setAddedAlert(null), 1500);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 flex items-center gap-2">
            <ShoppingBag className="w-7 h-7 text-emerald-600" />
            Krishi Shopping Mall (Direct Agri Inputs)
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Certified seeds, fertilizers, biologicals, and farm tools with doorstep delivery and transparent pricing
          </p>
        </div>

        <Link
          to="/mall/cart"
          className="px-4 py-2.5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md flex items-center gap-2 self-start sm:self-auto transition-all"
        >
          <ShoppingCart className="w-4 h-4" />
          <span>View Cart ({getTotalItems()})</span>
        </Link>
      </div>

      {addedAlert && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-2xl text-xs font-bold text-emerald-900 flex items-center gap-2 animate-in fade-in">
          <Check className="w-4 h-4 text-emerald-600" />
          <span>Added "{addedAlert}" to your cart!</span>
        </div>
      )}

      {/* Search & Categories Bar */}
      <div className="flex flex-col sm:flex-row gap-3">
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
      </div>

      {/* Products Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {filtered.map((product) => (
          <div
            key={product.id}
            className="bg-white rounded-3xl overflow-hidden border border-slate-200/80 shadow-xs hover:shadow-md transition-all flex flex-col justify-between"
          >
            <div>
              <div className="h-44 w-full bg-slate-100 overflow-hidden relative">
                <img src={product.imageUrl} alt={product.title} className="w-full h-full object-cover" />
                <span className="absolute top-2.5 left-2.5 bg-slate-900/70 backdrop-blur-sm text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                  {product.brand}
                </span>
              </div>

              <div className="p-4 space-y-1.5">
                <div className="flex items-center gap-1 text-[11px] font-bold text-amber-600">
                  <Star className="w-3.5 h-3.5 fill-amber-500 text-amber-500" />
                  <span>{product.rating}</span>
                  <span className="text-slate-400 font-normal">({product.ratingCount})</span>
                </div>

                <h4 className="font-extrabold text-xs text-slate-900 line-clamp-2 leading-tight">
                  {product.title}
                </h4>
                <p className="text-[11px] text-slate-400">Sold by {product.sellerName}</p>

                <div className="pt-2 flex items-baseline gap-2">
                  <span className="text-base font-black text-slate-900">{formatCurrency(product.price)}</span>
                  <span className="text-xs text-slate-400 line-through">{formatCurrency(product.mrp)}</span>
                  <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded">
                    Save {Math.round(((product.mrp - product.price) / product.mrp) * 100)}%
                  </span>
                </div>
              </div>
            </div>

            <div className="p-4 pt-0">
              <button
                onClick={() => handleAddToCart(product)}
                className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-bold text-xs shadow-xs transition-all flex items-center justify-center gap-1.5"
              >
                <ShoppingCart className="w-3.5 h-3.5" />
                <span>Add to Cart</span>
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
