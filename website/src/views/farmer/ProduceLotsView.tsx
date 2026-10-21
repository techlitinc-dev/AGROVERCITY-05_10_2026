import React, { useEffect, useState } from 'react';
import {
  Package,
  Plus,
  MapPin,
  CheckCircle2,
  Building2,
  Trash2,
  Pencil,
  Check,
} from 'lucide-react';
import { lots, offers, apiErrorMessage } from '../../lib/api';
import { ModalSheet } from '../../components/common/ModalSheet';
import { StatusBadge } from '../../components/common/StatusBadge';
import { formatCurrency, formatWeight } from '../../lib/utils';
import type { ProduceLot, TradeOffer } from '../../types';

type OfferFilter = 'received' | 'sent';

export const ProduceLotsView: React.FC = () => {
  const [lotsList, setLotsList] = useState<ProduceLot[]>([]);
  const [offersList, setOffersList] = useState<TradeOffer[]>([]);
  const [offerFilter, setOfferFilter] = useState<OfferFilter>('received');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [editingLot, setEditingLot] = useState<ProduceLot | null>(null);
  const [selectedOffer, setSelectedOffer] = useState<TradeOffer | null>(null);
  const [counterPrice, setCounterPrice] = useState<number>(4750);

  // Lot form state
  const [newCrop, setNewCrop] = useState('Soybean');
  const [newVariety, setNewVariety] = useState('JS 335');
  const [newQuantity, setNewQuantity] = useState(20);
  const [newGrade, setNewGrade] = useState<'A' | 'B' | 'C' | 'Ungraded'>('A');
  const [newPrice, setNewPrice] = useState(4750);
  const [newLocation, setNewLocation] = useState('Pimpalgaon Baswant, Nashik');
  const [newVillage, setNewVillage] = useState('Pimplas');
  const [newHarvestDate, setNewHarvestDate] = useState('2026-10-25');
  const [newPhotos, setNewPhotos] = useState('https://images.unsplash.com/photo-1599420186946-7b6fb4e297f0?auto=format&fit=crop&w=600&q=80');
  const [submitForReviewCheck, setSubmitForReviewCheck] = useState(true);

  const reload = async () => {
    const [l, o] = await Promise.all([lots.list(), offers.mine()]);
    setLotsList(l);
    setOffersList(o);
  };

  useEffect(() => {
    let active = true;
    setLoading(true);
    reload()
      .catch((e) => active && setError(apiErrorMessage(e)))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const visibleOffers = offersList.filter((o) =>
    offerFilter === 'received' ? o.senderRole !== 'farmer' : o.senderRole === 'farmer'
  );

  const openEditModal = (lot: ProduceLot) => {
    setEditingLot(lot);
    setNewCrop(lot.crop);
    setNewVariety(lot.variety);
    setNewQuantity(lot.quantityQuintal);
    setNewGrade(lot.grade);
    setNewPrice(lot.expectedPricePerQuintal);
    setNewLocation(lot.location);
    setCreateModalOpen(true);
  };

  const resetForm = () => {
    setEditingLot(null);
    setNewCrop('Soybean');
    setNewVariety('JS 335');
    setNewQuantity(20);
    setNewGrade('A');
    setNewPrice(4750);
    setNewLocation('Pimpalgaon Baswant, Nashik');
  };

  const handleSaveLot = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      const photosArray = newPhotos ? [newPhotos.trim()] : [];
      if (editingLot) {
        const updated = await lots.update(editingLot.id, {
          crop: newCrop,
          variety: newVariety,
          quantityQuintal: newQuantity,
          grade: newGrade,
          expectedPricePerQuintal: newPrice,
          location: newLocation,
          village: newVillage,
          harvestDate: newHarvestDate,
          photos: photosArray,
        });
        setLotsList((prev) => prev.map((l) => (l.id === updated.id ? updated : l)));
        setNotice(`Lot #${updated.id} updated.`);
      } else {
        const created = await lots.create({
          crop: newCrop,
          variety: newVariety,
          quantityQuintal: newQuantity,
          grade: newGrade,
          expectedPricePerQuintal: newPrice,
          location: newLocation,
          village: newVillage,
          harvestDate: newHarvestDate,
          photos: photosArray,
          submitForReview: submitForReviewCheck,
        });
        setLotsList((prev) => [created, ...prev]);
        setNotice(submitForReviewCheck ? 'Produce lot submitted for admin moderation.' : 'Produce lot saved as draft.');
      }
      setCreateModalOpen(false);
      resetForm();
    } catch (err) {
      setError(apiErrorMessage(err));
    }
  };

  const handleSubmitForReview = async (lotId: string) => {
    setError(null);
    setBusyId(lotId);
    try {
      const updated = await lots.submitForReview(lotId);
      setLotsList((prev) => prev.map((l) => (l.id === lotId ? updated : l)));
      setNotice(`Lot #${lotId} submitted for admin verification.`);
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setBusyId(null);
    }
  };

  const handleWithdrawLot = async (id: string) => {
    setError(null);
    setBusyId(id);
    try {
      await lots.remove(id);
      setLotsList((prev) => prev.filter((l) => l.id !== id));
      setNotice('Lot withdrawn from the marketplace.');
    } catch (e) {
      setError(apiErrorMessage(e));
    } finally {
      setBusyId(null);
    }
  };

  const handleAcceptOffer = async (offer: TradeOffer) => {
    setError(null);
    setBusyId(offer.id);
    try {
      await offers.accept(offer.id);
      setOffersList((prev) => prev.map((o) => (o.id === offer.id ? { ...o, status: 'accepted' } : o)));
      const finalPrice = offer.counterPrice || offer.pricePerUnit;
      setNotice(
        `Purchase order confirmed at ₹${finalPrice}/q with ${offer.receiverName || 'the buyer'}!`
      );
      setSelectedOffer(null);
    } catch (e) {
      setError(apiErrorMessage(e));
    } finally {
      setBusyId(null);
    }
  };

  const handleRejectOffer = async (offer: TradeOffer) => {
    setError(null);
    setBusyId(offer.id);
    try {
      await offers.reject(offer.id);
      setOffersList((prev) => prev.map((o) => (o.id === offer.id ? { ...o, status: 'rejected' } : o)));
    } catch (e) {
      setError(apiErrorMessage(e));
    } finally {
      setBusyId(null);
    }
  };

  const handleWithdrawOffer = async (offer: TradeOffer) => {
    setError(null);
    setBusyId(offer.id);
    try {
      await offers.withdraw(offer.id);
      setOffersList((prev) => prev.map((o) => (o.id === offer.id ? { ...o, status: 'withdrawn' } : o)));
    } catch (e) {
      setError(apiErrorMessage(e));
    } finally {
      setBusyId(null);
    }
  };

  const handleSendCounter = async () => {
    if (!selectedOffer) return;
    setError(null);
    setBusyId(selectedOffer.id);
    try {
      const updated = await offers.counter(selectedOffer.id, { pricePerUnit: counterPrice });
      setOffersList((prev) => prev.map((o) => (o.id === selectedOffer.id ? updated : o)));
      setSelectedOffer(null);
      setNotice('Counter quote sent to the buyer.');
    } catch (e) {
      setError(apiErrorMessage(e));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 flex items-center gap-2">
            <Package className="w-7 h-7 text-emerald-600" />
            Produce Lots & Direct B2B Selling
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Post verified produce lots, receive direct quotes from institutional buyers, and negotiate in 1 round
          </p>
        </div>

        <button
          onClick={() => {
            resetForm();
            setCreateModalOpen(true);
          }}
          className="px-4 py-2.5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-bold text-xs shadow-md flex items-center gap-2 self-start sm:self-auto transition-all"
        >
          <Plus className="w-4 h-4" />
          <span>Post New Produce Lot</span>
        </button>
      </div>

      {error && (
        <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-2xl text-xs font-semibold text-rose-800">
          {error}
        </div>
      )}
      {notice && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-2xl text-xs font-semibold text-emerald-800 flex items-center justify-between animate-in fade-in">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>{notice}</span>
          </div>
          <button onClick={() => setNotice(null)} className="font-bold hover:underline">Dismiss</button>
        </div>
      )}

      {/* Section 1: Active Lots Grid */}
      <div className="space-y-3">
        <h3 className="font-bold text-sm text-slate-900">My Listed Produce Lots ({lotsList.length})</h3>

        {loading ? (
          <div className="py-10 text-center text-xs font-bold text-slate-400 animate-pulse">
            Loading your produce lots…
          </div>
        ) : lotsList.length === 0 ? (
          <div className="py-10 text-center text-xs font-semibold text-slate-400 bg-white rounded-3xl border border-slate-200/80">
            No lots listed yet. Post your first produce lot to start receiving buyer quotes.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {lotsList.map((lot) => (
              <div
                key={lot.id}
                className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-xs hover:border-slate-300 transition-all flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                        Grade {lot.grade}
                      </span>
                      <h4 className="text-base font-extrabold text-slate-900 mt-1.5">
                        {lot.crop} ({lot.variety})
                      </h4>
                      <p className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                        <MapPin className="w-3.5 h-3.5 text-slate-400" /> {lot.location}
                      </p>
                    </div>
                    <StatusBadge status={lot.status} />
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-2 p-3 bg-slate-50 rounded-2xl text-xs">
                    <div>
                      <span className="text-slate-400 text-[10px] uppercase font-bold">Quantity</span>
                      <p className="font-bold text-slate-800">{formatWeight(lot.quantityQuintal)}</p>
                    </div>
                    <div>
                      <span className="text-slate-400 text-[10px] uppercase font-bold">Expected Price</span>
                      <p className="font-bold text-emerald-700">
                        {formatCurrency(lot.expectedPricePerQuintal)}
                        <span className="text-[10px] text-slate-500">/q</span>
                      </p>
                    </div>
                  </div>
                </div>

                {/* Moderation notes if present */}
                {(lot as any).moderation && (
                  <div className="mt-2 p-2 bg-emerald-50 rounded-xl border border-emerald-200 text-[10px] text-emerald-800 font-semibold flex items-center justify-between">
                    <span>Moderation: {(lot as any).moderation.action}</span>
                    <span className="text-emerald-700">{(lot as any).moderation.reason}</span>
                  </div>
                )}

                <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-slate-600">
                      {lot.offersCount} Buyer Quotes
                    </span>
                    {(lot.status === 'pending_review' || lot.status === 'rejected') && (
                      <button
                        onClick={() => handleSubmitForReview(lot.id)}
                        disabled={busyId === lot.id}
                        className="px-2.5 py-1 text-[10px] font-black rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 transition-all disabled:opacity-50"
                      >
                        {lot.status === 'pending_review' ? 'In Review' : 'Submit Review'}
                      </button>
                    )}
                  </div>
                  <div className="flex gap-1">
                    <button
                      onClick={() => openEditModal(lot)}
                      className="p-1.5 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                      title="Edit lot"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleWithdrawLot(lot.id)}
                      disabled={busyId === lot.id}
                      className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors disabled:opacity-50"
                      title="Withdraw lot"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Section 2: Offers & 1-Round Negotiation Inbox */}
      <div className="space-y-3 pt-4 border-t border-slate-200">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h3 className="font-bold text-sm text-slate-900">
              Buyer Offers & Negotiation Desk
            </h3>
            <p className="text-xs text-slate-400">
              Per Agrovercity protocol, negotiation allows <strong>maximum 1 counter round</strong> before final acceptance or decline.
            </p>
          </div>
          <div className="flex bg-slate-100 p-1 rounded-2xl self-start">
            {(['received', 'sent'] as OfferFilter[]).map((f) => (
              <button
                key={f}
                onClick={() => setOfferFilter(f)}
                className={`px-4 py-1.5 rounded-xl text-xs font-bold transition-all capitalize ${
                  offerFilter === f ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500'
                }`}
              >
                {f === 'received' ? 'Received Offers' : 'Sent by Me'}
              </button>
            ))}
          </div>
        </div>

        {visibleOffers.length === 0 ? (
          <div className="py-8 text-center text-xs font-semibold text-slate-400 bg-white rounded-3xl border border-slate-200/80">
            {offerFilter === 'received'
              ? 'No buyer offers yet. They will appear here when buyers quote on your lots.'
              : 'You have not sent any offers yet. Browse buyer demands to send one.'}
          </div>
        ) : (
          <div className="space-y-3">
            {visibleOffers.map((offer) => (
              <div
                key={offer.id}
                className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4"
              >
                <div className="space-y-1.5 max-w-xl">
                  <div className="flex items-center gap-2">
                    <Building2 className="w-4 h-4 text-slate-400" />
                    <span className="font-extrabold text-sm text-slate-900">
                      {offerFilter === 'received' ? offer.senderName : offer.receiverName}
                    </span>
                    <StatusBadge status={offer.status} />
                  </div>
                  <p className="text-xs text-slate-600">
                    Target: <strong>{offer.lotCrop} ({offer.quantity} Quintals)</strong>
                  </p>
                  {offer.message && (
                    <p className="text-xs italic text-slate-500 bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                      "{offer.message}"
                    </p>
                  )}
                </div>

                {/* Price & Action Buttons */}
                <div className="flex items-center gap-4 self-end md:self-center">
                  <div className="text-right">
                    <span className="text-xs text-slate-400 block font-semibold">Offered / Counter</span>
                    <span className="text-lg font-black text-emerald-700">
                      {formatCurrency(offer.counterPrice || offer.pricePerUnit)}
                    </span>
                    <span className="text-xs text-slate-500">/q</span>
                  </div>

                  {offerFilter === 'received' && offer.status === 'pending' && (
                    <div className="flex gap-2">
                      <button
                        onClick={() => {
                          setSelectedOffer(offer);
                          setCounterPrice(offer.pricePerUnit + 30);
                        }}
                        className="px-3 py-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold text-xs"
                      >
                        Counter
                      </button>
                      <button
                        onClick={() => handleAcceptOffer(offer)}
                        disabled={busyId === offer.id}
                        className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs disabled:opacity-50"
                      >
                        Accept
                      </button>
                    </div>
                  )}

                  {offerFilter === 'received' && offer.status === 'countered' && (
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleRejectOffer(offer)}
                        disabled={busyId === offer.id}
                        className="px-3 py-2 rounded-xl border border-rose-200 text-rose-600 hover:bg-rose-50 font-bold text-xs disabled:opacity-50"
                      >
                        Reject
                      </button>
                      <button
                        onClick={() => handleAcceptOffer(offer)}
                        disabled={busyId === offer.id}
                        className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs disabled:opacity-50"
                      >
                        Accept Counter
                      </button>
                    </div>
                  )}

                  {offerFilter === 'sent' && offer.status === 'pending' && (
                    <button
                      onClick={() => handleWithdrawOffer(offer)}
                      disabled={busyId === offer.id}
                      className="px-3 py-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-600 font-bold text-xs disabled:opacity-50"
                    >
                      Withdraw
                    </button>
                  )}

                  {(offer.status === 'accepted' || offer.status === 'rejected' || offer.status === 'withdrawn') && (
                    <span
                      className={`text-xs font-bold flex items-center gap-1 px-3 py-1.5 rounded-xl border ${
                        offer.status === 'accepted'
                          ? 'text-emerald-700 bg-emerald-50 border-emerald-200'
                          : 'text-slate-500 bg-slate-50 border-slate-200'
                      }`}
                    >
                      {offer.status === 'accepted' && <Check className="w-4 h-4" />}
                      {offer.status === 'accepted' ? 'Deal Locked' : offer.status === 'withdrawn' ? 'Withdrawn' : 'Closed'}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create / Edit Produce Lot Modal */}
      <ModalSheet
        isOpen={createModalOpen}
        onClose={() => {
          setCreateModalOpen(false);
          resetForm();
        }}
        title={editingLot ? 'Edit Produce Lot' : 'Post New Produce Lot'}
        description={editingLot ? 'Update quantity, grade or expected price' : 'List harvested crop for direct B2B buyer discovery'}
        maxWidth="lg"
      >
        <form onSubmit={handleSaveLot} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Crop</label>
              <select
                value={newCrop}
                onChange={(e) => setNewCrop(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 bg-white"
              >
                <option value="Soybean">Soybean (सोयाबीन)</option>
                <option value="Wheat">Wheat (गेहूं)</option>
                <option value="Cotton">Cotton (कपास)</option>
                <option value="Onion">Onion (प्याज)</option>
                <option value="Tur / Arhar">Tur / Arhar (तुवर दाल)</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Variety</label>
              <input
                type="text"
                value={newVariety}
                onChange={(e) => setNewVariety(e.target.value)}
                placeholder="e.g. JS 335 / Lokwan"
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Quantity (q)</label>
              <input
                type="number"
                value={newQuantity}
                onChange={(e) => setNewQuantity(Number(e.target.value))}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 font-bold"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Quality Grade</label>
              <select
                value={newGrade}
                onChange={(e) => setNewGrade(e.target.value as 'A' | 'B' | 'C' | 'Ungraded')}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 bg-white"
              >
                <option value="A">Grade A (Export/Premium)</option>
                <option value="B">Grade B (Standard)</option>
                <option value="C">Grade C (Commercial)</option>
                <option value="Ungraded">Ungraded (Field run)</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Expected Price (₹/q)</label>
              <input
                type="number"
                value={newPrice}
                onChange={(e) => setNewPrice(Number(e.target.value))}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 font-bold text-emerald-800"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Village / Taluka</label>
              <input
                type="text"
                value={newVillage}
                onChange={(e) => setNewVillage(e.target.value)}
                placeholder="e.g. Khed, Niphad"
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Harvest Date</label>
              <input
                type="date"
                value={newHarvestDate}
                onChange={(e) => setNewHarvestDate(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Pickup Location / Gate</label>
            <input
              type="text"
              value={newLocation}
              onChange={(e) => setNewLocation(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Produce Sample Photo URL</label>
            <input
              type="text"
              value={newPhotos}
              onChange={(e) => setNewPhotos(e.target.value)}
              placeholder="https://..."
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300"
            />
          </div>

          {!editingLot && (
            <div className="flex items-center gap-2 p-3 bg-emerald-50 rounded-xl border border-emerald-200">
              <input
                type="checkbox"
                id="submitReviewCheck"
                checked={submitForReviewCheck}
                onChange={(e) => setSubmitForReviewCheck(e.target.checked)}
                className="w-4 h-4 text-emerald-600 rounded"
              />
              <label htmlFor="submitReviewCheck" className="text-xs font-bold text-emerald-900 cursor-pointer">
                Submit directly for APMC / Admin Moderation Review
              </label>
            </div>
          )}

          <button
            type="submit"
            className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-bold text-xs shadow-md transition-all mt-2"
          >
            {editingLot ? 'Save Lot Changes' : (submitForReviewCheck ? 'Submit for Review' : 'Save as Draft')}
          </button>
        </form>
      </ModalSheet>

      {/* 1-Round Counter Negotiation Sheet */}
      <ModalSheet
        isOpen={Boolean(selectedOffer)}
        onClose={() => setSelectedOffer(null)}
        title="Submit One-Time Counter Offer"
        description="Per B2B rules, counter offers are restricted to exactly 1 round."
        maxWidth="sm"
      >
        <div className="space-y-4">
          <div className="p-3 bg-slate-50 rounded-xl text-xs space-y-1">
            <div className="flex justify-between text-slate-600">
              <span>Buyer:</span>
              <span className="font-bold text-slate-900">{selectedOffer?.senderName}</span>
            </div>
            <div className="flex justify-between text-slate-600">
              <span>Buyer's Offer:</span>
              <span className="font-bold text-slate-900">₹{selectedOffer?.pricePerUnit}/q</span>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Your Counter Price (₹ per Quintal)
            </label>
            <input
              type="number"
              value={counterPrice}
              onChange={(e) => setCounterPrice(Number(e.target.value))}
              className="w-full px-3 py-2.5 text-base font-bold rounded-xl border border-slate-300 text-emerald-800"
            />
            <p className="text-[10px] text-slate-400 mt-1">
              If the buyer accepts this counter, a Purchase Order will be created immediately.
            </p>
          </div>

          <button
            onClick={handleSendCounter}
            disabled={Boolean(selectedOffer) && busyId === selectedOffer?.id}
            className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md transition-all disabled:opacity-50"
          >
            Send Counter Quote to Buyer
          </button>
        </div>
      </ModalSheet>
    </div>
  );
};
