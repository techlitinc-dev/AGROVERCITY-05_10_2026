import React, { useEffect, useState } from 'react';
import { Tag, Plus, Trash2, Calendar, X, Sparkles, CheckCircle2 } from 'lucide-react';
import { nursery } from '../../lib/api';

export const NurseryOffersView: React.FC = () => {
  const [offers, setOffers] = useState<Array<Record<string, unknown>>>([]);
  const [loading, setLoading] = useState(true);

  // Modal
  const [showModal, setShowModal] = useState(false);
  const [code, setCode] = useState('');
  const [title, setTitle] = useState('');
  const [discountPct, setDiscountPct] = useState<number>(15);
  const [minOrderAmount, setMinOrderAmount] = useState<number>(500);
  const [maxDiscountAmount, setMaxDiscountAmount] = useState<number>(200);
  const [validUntil, setValidUntil] = useState(
    new Date(Date.now() + 60 * 24 * 3600 * 1000).toISOString().slice(0, 10)
  );
  const [bannerUrl, setBannerUrl] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const loadOffers = () => {
    setLoading(true);
    nursery
      .offers()
      .then((res) => {
        setOffers(Array.isArray(res) ? (res as Array<Record<string, unknown>>) : []);
      })
      .catch(() => setOffers([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadOffers();
  }, []);

  const openCreateModal = () => {
    setCode(`GREEN${Math.floor(10 + Math.random() * 90)}`);
    setTitle('Seasonal Plantation Discount');
    setDiscountPct(15);
    setMinOrderAmount(500);
    setMaxDiscountAmount(200);
    setBannerUrl('https://images.unsplash.com/photo-1530836369250-ef72a3f5cda8');
    setShowModal(true);
  };

  const handleCreateOffer = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await nursery.createOffer({
        code: code.trim().toUpperCase(),
        title,
        discountPct: Number(discountPct),
        minOrderAmount: Number(minOrderAmount),
        maxDiscountAmount: Number(maxDiscountAmount),
        validUntil,
        bannerUrl,
      });
      setShowModal(false);
      loadOffers();
    } catch (err) {
      alert('Failed to create offer');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteOffer = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this offer?')) return;
    try {
      await nursery.deleteOffer(id);
      loadOffers();
    } catch (err) {
      alert('Failed to delete offer');
    }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <Tag className="w-6 h-6 text-emerald-700" />
            Offers & Seasonal Discounts
          </h1>
          <p className="text-xs text-slate-500">
            Create coupon codes and promotional discounts for farmers buying bulk saplings during peak planting seasons.
          </p>
        </div>

        <button
          onClick={openCreateModal}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs shadow-md transition"
        >
          <Plus className="w-4 h-4" /> Create Seasonal Offer
        </button>
      </div>

      {/* Offers Grid */}
      {loading ? (
        <div className="py-20 text-center text-xs text-slate-400 font-bold">Loading offers…</div>
      ) : offers.length === 0 ? (
        <div className="p-12 text-center rounded-3xl bg-white border border-slate-200 shadow-sm space-y-3">
          <Tag className="w-10 h-10 text-slate-300 mx-auto" />
          <h3 className="text-sm font-bold text-slate-700">No Active Offers</h3>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">
            You have not launched any promotional campaigns yet. Click "Create Seasonal Offer" to boost sales.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {offers.map((off) => {
            const oId = String(off.id || '');
            const active = off.active !== false;

            return (
              <div
                key={oId}
                className="rounded-3xl bg-white border border-slate-200 p-5 shadow-sm hover:shadow-md transition space-y-4 flex flex-col justify-between"
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs font-black px-3 py-1 rounded-full bg-emerald-100 text-emerald-900 border border-emerald-300">
                      {String(off.code)}
                    </span>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        active ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-400'
                      }`}
                    >
                      {active ? 'Active Coupon' : 'Deactivated'}
                    </span>
                  </div>

                  <div>
                    <h3 className="text-sm font-bold text-slate-900">{String(off.title)}</h3>
                    <p className="text-2xl font-black text-emerald-800 pt-1">
                      {Number(off.discountPct)}% OFF
                    </p>
                  </div>

                  <div className="text-[11px] text-slate-500 space-y-1 bg-slate-50 p-3 rounded-2xl border border-slate-100">
                    <p>Min Order: <strong className="text-slate-800">₹{Number(off.minOrderAmount || 0)}</strong></p>
                    <p>Max Discount: <strong className="text-slate-800">₹{Number(off.maxDiscountAmount || 0)}</strong></p>
                    <p className="flex items-center gap-1 text-slate-400">
                      <Calendar className="w-3 h-3" /> Valid until {String(off.validUntil || '').slice(0, 10)}
                    </p>
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                  <span className="text-[10px] text-slate-400">
                    Used: {Number(off.usedCount || 0)} times
                  </span>
                  <button
                    onClick={() => handleDeleteOffer(oId)}
                    className="p-1.5 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition text-xs font-bold flex items-center gap-1"
                  >
                    <Trash2 className="w-3.5 h-3.5" /> Remove
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Tag className="w-4 h-4 text-emerald-700" />
                Create Seasonal Coupon Offer
              </h3>
              <button
                onClick={() => setShowModal(false)}
                className="p-1 rounded-full hover:bg-slate-100 text-slate-400"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateOffer} className="space-y-3.5 text-xs">
              <div className="space-y-1">
                <label className="font-bold text-slate-700">Coupon Code *</label>
                <input
                  type="text"
                  required
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                  placeholder="e.g. MONSOON20"
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 font-mono focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-700">Offer Title *</label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Monsoon Plantation Drive 20% Off"
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div className="space-y-1">
                  <label className="font-bold text-slate-700">Discount %</label>
                  <input
                    type="number"
                    min="1"
                    max="90"
                    required
                    value={discountPct}
                    onChange={(e) => setDiscountPct(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-slate-700">Min Order ₹</label>
                  <input
                    type="number"
                    min="0"
                    required
                    value={minOrderAmount}
                    onChange={(e) => setMinOrderAmount(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-slate-700">Cap Max ₹</label>
                  <input
                    type="number"
                    min="10"
                    required
                    value={maxDiscountAmount}
                    onChange={(e) => setMaxDiscountAmount(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-700">Valid Until Date</label>
                <input
                  type="date"
                  required
                  value={validUntil}
                  onChange={(e) => setValidUntil(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-bold transition disabled:opacity-50"
                >
                  {submitting ? 'Creating…' : 'Launch Offer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
