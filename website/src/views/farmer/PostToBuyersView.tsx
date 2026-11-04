import React, { useCallback, useEffect, useState } from 'react';
import { Store, Plus, Trash2, Clock, BadgeCheck, Megaphone } from 'lucide-react';
import { Link } from 'react-router-dom';
import { lots, users, apiErrorMessage } from '../../lib/api';
import { isKycError } from '../../lib/api/leads';
import { ModalSheet } from '../../components/common/ModalSheet';
import { formatCurrency, formatWeight } from '../../lib/utils';

interface BuyerPost {
  id: string;
  crop: string;
  variety?: string;
  quantityQuintal?: number;
  expectedPricePerQuintal?: number;
  village?: string;
  harvestDate?: string;
  status?: string;
  createdAt?: string;
}

/**
 * Post to Buyers — the farmer → industrial-buyer create-post page. A post here
 * is a produce lot, so it flows everywhere buyers look: the buyer's Farm-gate
 * feed (GET /direct-buyer/farmer-posts), Find Produce, and demand matching.
 */
export const PostToBuyersView: React.FC = () => {
  const [posts, setPosts] = useState<BuyerPost[]>([]);
  const [me, setMe] = useState<{ kycStatus?: string }>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    crop: '',
    variety: '',
    quantityQuintal: 0,
    expectedPricePerQuintal: 0,
    village: '',
    harvestDate: '',
    notes: '',
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const rows = await lots.list();
      setPosts((rows as unknown as BuyerPost[]).filter((p) => p.status !== 'withdrawn'));
    } catch (e) {
      setError(apiErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    users.getMe().then((u) => setMe(u as typeof me)).catch(() => {});
  }, [load]);

  const kycVerified = me.kycStatus === 'verified';

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      await lots.create({
        crop: form.crop.trim(),
        variety: form.variety.trim() || 'Standard',
        quantityQuintal: form.quantityQuintal,
        expectedPricePerQuintal: form.expectedPricePerQuintal,
        village: form.village.trim() || undefined,
        harvestDate: form.harvestDate || undefined,
        ...(form.notes.trim() ? { location: form.notes.trim() } : {}),
        submitForReview: false,
      });
      setNotice('Posted — industrial buyers and vyapari see it in their feeds now.');
      setModalOpen(false);
      setForm({ crop: '', variety: '', quantityQuintal: 0, expectedPricePerQuintal: 0, village: '', harvestDate: '', notes: '' });
      await load();
    } catch (e) {
      if (isKycError(e)) {
        setError('Complete your identity verification (KYC) to post — see Profile.');
        setModalOpen(false);
      } else {
        setError(apiErrorMessage(e));
      }
    } finally {
      setBusy(false);
    }
  };

  const closePost = async (id: string) => {
    if (!window.confirm('Withdraw this post? Buyers will no longer see it.')) return;
    try {
      await lots.remove(id);
      setNotice('Post withdrawn.');
      await load();
    } catch (e) {
      setError(apiErrorMessage(e));
    }
  };

  return (
    <div className="space-y-6">
      <div className="border-b border-slate-200 pb-4 flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 flex items-center gap-2">
            <Store className="w-7 h-7 text-emerald-600" />
            Post to Buyers
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Offer your produce to industrial buyers, processors and exporters. Your post appears in their farm-gate
            feed instantly — they contact you directly, no middleman.
          </p>
        </div>
        <button
          onClick={() => setModalOpen(true)}
          className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs flex items-center gap-1.5"
        >
          <Plus className="w-3.5 h-3.5" /> Create Post
        </button>
      </div>

      {!kycVerified && (
        <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-2xl text-xs font-semibold text-amber-800 flex items-center gap-2">
          Complete identity verification (KYC) to post — see Profile & Verification.
        </div>
      )}
      {error && (
        <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-2xl text-xs font-semibold text-rose-800 flex items-center justify-between">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="font-bold hover:underline">Dismiss</button>
        </div>
      )}
      {notice && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-2xl text-xs font-semibold text-emerald-800 flex items-center justify-between">
          <span>{notice}</span>
          <button onClick={() => setNotice(null)} className="font-bold hover:underline">Dismiss</button>
        </div>
      )}

      {loading ? (
        <div className="py-10 text-center text-xs font-bold text-slate-400 animate-pulse">Loading your posts…</div>
      ) : posts.length === 0 ? (
        <div className="p-12 text-center text-slate-500 bg-white rounded-3xl border border-slate-200 space-y-2">
          <Megaphone className="w-10 h-10 text-slate-300 mx-auto" />
          <p className="text-sm font-bold">No posts yet</p>
          <p className="text-xs text-slate-400">
            Create a post — buyers see it in their feed and contact you directly. You can also{' '}
            <Link to="/farmer/demands" className="font-bold text-emerald-700 hover:underline">apply to buyer requirements</Link>.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {posts.map((p) => (
            <div key={p.id} className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-xs space-y-2.5">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-extrabold text-sm text-slate-900">
                  {p.crop} {p.variety ? `(${p.variety})` : ''}
                </span>
                <span
                  className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full border ${
                    p.status === 'open'
                      ? 'text-emerald-700 bg-emerald-50 border-emerald-200'
                      : 'text-slate-500 bg-slate-100 border-slate-200'
                  }`}
                >
                  {p.status === 'open' ? 'Live — visible to buyers' : (p.status ?? '').replace(/_/g, ' ')}
                </span>
              </div>
              <p className="text-xs text-slate-600 flex items-center gap-1 flex-wrap">
                <Clock className="w-3.5 h-3.5 text-slate-400" />
                {formatWeight(p.quantityQuintal ?? 0)}
                {(p.expectedPricePerQuintal ?? 0) > 0 ? ` · ${formatCurrency(p.expectedPricePerQuintal ?? 0)}/q expected` : ''}
                {p.village ? ` · ${p.village}` : ''}
                {p.harvestDate ? ` · harvest ${p.harvestDate}` : ''}
              </p>
              <p className="text-[10px] text-slate-400 flex items-center gap-1">
                <BadgeCheck className="w-3 h-3 text-emerald-500" /> Buyers contact you directly — Agrovercity never holds the payment.
              </p>
              {p.status === 'open' && (
                <button
                  onClick={() => void closePost(p.id)}
                  className="px-3 py-1.5 rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-100 font-bold text-[10px] flex items-center gap-1"
                >
                  <Trash2 className="w-3 h-3" /> Withdraw
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Create Post modal */}
      <ModalSheet
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Create Post for Buyers"
        description="Industrial buyers, processors and exporters see this post in their farm-gate feed."
        maxWidth="md"
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Crop *</label>
              <input
                type="text"
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300"
                value={form.crop}
                onChange={(e) => setForm({ ...form, crop: e.target.value })}
                placeholder="e.g. Soybean, Cotton"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Variety</label>
              <input
                type="text"
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300"
                value={form.variety}
                onChange={(e) => setForm({ ...form, variety: e.target.value })}
                placeholder="e.g. JS 335"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Quantity (quintals) *</label>
              <input
                type="number"
                min={0}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 font-bold"
                value={form.quantityQuintal || ''}
                onChange={(e) => setForm({ ...form, quantityQuintal: Number(e.target.value) })}
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Expected Price (₹/quintal) *</label>
              <input
                type="number"
                min={0}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 font-bold"
                value={form.expectedPricePerQuintal || ''}
                onChange={(e) => setForm({ ...form, expectedPricePerQuintal: Number(e.target.value) })}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Village / Pickup</label>
              <input
                type="text"
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300"
                value={form.village}
                onChange={(e) => setForm({ ...form, village: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Harvest Date</label>
              <input
                type="date"
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300"
                value={form.harvestDate}
                onChange={(e) => setForm({ ...form, harvestDate: e.target.value })}
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Notes (optional)</label>
            <textarea
              rows={2}
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300"
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              placeholder="Pickup point, moisture, packing…"
            />
          </div>
          <button
            onClick={() => void submit()}
            disabled={busy || !form.crop.trim() || form.quantityQuintal <= 0 || form.expectedPricePerQuintal <= 0}
            className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md transition-all disabled:opacity-50"
          >
            {busy ? 'Posting…' : 'Post to Buyers'}
          </button>
        </div>
      </ModalSheet>
    </div>
  );
};
