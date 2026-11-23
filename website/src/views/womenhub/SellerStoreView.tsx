import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Star, Store } from 'lucide-react';
import { apiErrorMessage, womenHub } from '../../lib/api';

interface BusinessCard {
  id: string;
  name?: string;
  category?: string;
  status?: string;
}

interface ProductRow {
  id: string;
  businessId?: string;
  businessName?: string;
  name?: string;
  pricePaisa?: number;
  stock?: number;
}

interface ReviewRow {
  id: string;
  rating?: number;
  review?: string;
  fromName?: string;
  createdAt?: string;
}

function asRecord(v: unknown): Record<string, unknown> {
  return v && typeof v === 'object' ? (v as Record<string, unknown>) : {};
}

function asArray(v: unknown): unknown[] {
  return Array.isArray(v) ? v : [];
}

export const SellerStoreView: React.FC = () => {
  const [businesses, setBusinesses] = useState<BusinessCard[]>([]);
  const [products, setProducts] = useState<ProductRow[]>([]);
  const [reviews, setReviews] = useState<ReviewRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        const cards = asArray(await womenHub.myBusinesses()).map(asRecord);
        const biz = cards.map((b) => ({
          id: String(b.id ?? ''),
          name: String(b.name ?? ''),
          category: String(b.category ?? ''),
          status: String(b.status ?? 'active'),
        }));
        if (!mounted) return;
        setBusinesses(biz);

        const allProducts: ProductRow[] = [];
        const allReviews: ReviewRow[] = [];
        for (const b of biz) {
          const detail = asRecord(await womenHub.businessDetail(b.id));
          if (!mounted) return;
          for (const p of asArray(detail.products)) {
            const row = asRecord(p);
            allProducts.push({
              id: String(row.id ?? ''),
              businessId: b.id,
              businessName: b.name,
              name: String(row.name ?? ''),
              pricePaisa: Number(row.pricePaisa ?? 0),
              stock: Number(row.stock ?? 0),
            });
          }
          for (const r of asArray(detail.ratings)) {
            const row = asRecord(r);
            allReviews.push({
              id: String(row.id ?? ''),
              rating: Number(row.rating ?? 0),
              review: String(row.review ?? ''),
              fromName: String(row.fromName ?? ''),
              createdAt: String(row.createdAt ?? ''),
            });
          }
        }
        setProducts(allProducts);
        setReviews(allReviews.slice(0, 10));
      } catch (e) {
        if (mounted) setError(apiErrorMessage(e));
      }
    };
    void load();
    return () => {
      mounted = false;
    };
  }, []);

  if (error) return <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl text-xs font-bold text-rose-800">{error}</div>;

  const outOfStock = products.filter((p) => (p.stock ?? 0) <= 0).length;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs p-4">
          <p className="text-lg font-black text-slate-900">{products.length}</p>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Store products</p>
        </div>
        <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs p-4">
          <p className="text-lg font-black text-slate-900">{outOfStock}</p>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Out of stock</p>
        </div>
        <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs p-4">
          <p className="text-lg font-black text-slate-900">{reviews.length}</p>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Recent reviews</p>
        </div>
      </div>

      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs p-5">
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs font-black text-slate-900 flex items-center gap-1.5">
            <Store className="w-4 h-4 text-emerald-600" /> Storefront products (stock &amp; pricing)
          </p>
          <Link to="/womenHub/businesses" className="text-[11px] font-bold text-emerald-700 hover:underline">
            Manage businesses
          </Link>
        </div>
        <div className="space-y-1.5">
          {products.map((p) => (
            <div key={p.id} className="flex items-center justify-between text-[11px] border-b border-slate-100 pb-1.5">
              <span className="font-bold text-slate-800">
                {p.name}
                <span className="ml-2 font-semibold text-slate-400">{p.businessName}</span>
              </span>
              <span className={(p.stock ?? 0) <= 0 ? 'font-bold text-rose-600' : 'text-slate-500'}>
                ₹{((p.pricePaisa ?? 0) / 100).toFixed(0)} · stock {p.stock ?? 0}
              </span>
            </div>
          ))}
          {products.length === 0 && (
            <p className="text-[11px] text-slate-400">
              No products yet — add them inside{' '}
              <Link to="/womenHub/businesses" className="font-bold text-emerald-700">
                My Business &amp; Management
              </Link>
              .
            </p>
          )}
        </div>
      </div>

      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs p-5">
        <p className="text-xs font-black text-slate-900 mb-2">Store ratings</p>
        <div className="space-y-1.5">
          {reviews.map((r) => (
            <div key={r.id} className="text-[11px] border-b border-slate-100 pb-1.5">
              <span className="flex items-center gap-1 text-amber-500">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} className={`w-3 h-3 ${i < (r.rating ?? 0) ? 'fill-amber-400' : 'text-slate-200'}`} />
                ))}
                <span className="ml-1 text-slate-400">{r.fromName}</span>
              </span>
              {r.review && <span className="text-slate-600">{r.review}</span>}
            </div>
          ))}
          {reviews.length === 0 && <p className="text-[11px] text-slate-400">No reviews yet.</p>}
        </div>
      </div>
    </div>
  );
};
