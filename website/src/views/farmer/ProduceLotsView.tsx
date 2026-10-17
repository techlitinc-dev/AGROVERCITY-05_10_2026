import React, { useState } from 'react';
import {
  Package,
  Plus,
  TrendingUp,
  MapPin,
  Clock,
  ArrowRight,
  CheckCircle2,
  XCircle,
  HelpCircle,
  AlertCircle,
  Check,
  Building2,
  Trash2,
} from 'lucide-react';
import { MOCK_PRODUCE_LOTS, MOCK_TRADE_OFFERS, api } from '../../lib/api';
import { ModalSheet } from '../../components/common/ModalSheet';
import { StatusBadge } from '../../components/common/StatusBadge';
import { formatCurrency, formatWeight } from '../../lib/utils';
import type { ProduceLot, TradeOffer } from '../../types';

export const ProduceLotsView: React.FC = () => {
  const [lots, setLots] = useState<ProduceLot[]>(MOCK_PRODUCE_LOTS);
  const [offers, setOffers] = useState<TradeOffer[]>(MOCK_TRADE_OFFERS);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [selectedOffer, setSelectedOffer] = useState<TradeOffer | null>(null);
  const [counterPrice, setCounterPrice] = useState<number>(4750);
  const [purchaseCreatedAlert, setPurchaseCreatedAlert] = useState<string | null>(null);

  // New lot form state
  const [newCrop, setNewCrop] = useState('Soybean');
  const [newVariety, setNewVariety] = useState('JS 335');
  const [newQuantity, setNewQuantity] = useState(20);
  const [newGrade, setNewGrade] = useState<'A' | 'B' | 'C' | 'Ungraded'>('A');
  const [newPrice, setNewPrice] = useState(4750);
  const [newLocation, setNewLocation] = useState('Pimpalgaon Baswant, Nashik');

  const handleCreateLot = async (e: React.FormEvent) => {
    e.preventDefault();
    const created = await api.createProduceLot({
      crop: newCrop,
      variety: newVariety,
      quantityQuintal: newQuantity,
      grade: newGrade,
      expectedPricePerQuintal: newPrice,
      location: newLocation,
    });
    setLots([created, ...lots]);
    setCreateModalOpen(false);
  };

  const handleWithdrawLot = (id: string) => {
    setLots((prev) => prev.filter((l) => l.id !== id));
  };

  // 1-Round Negotiation: Accept Offer (Auto-creates Purchase)
  const handleAcceptOffer = (offer: TradeOffer) => {
    const finalPrice = offer.counterPrice || offer.pricePerUnit;
    setOffers((prev) =>
      prev.map((o) => (o.id === offer.id ? { ...o, status: 'accepted' } : o))
    );
    setPurchaseCreatedAlert(
      `Purchase order confirmed at ₹${finalPrice}/q with ${offer.receiverName}! Purchase ID: #pur_${Date.now().toString().slice(-4)}`
    );
    setSelectedOffer(null);
  };

  // Counter offer (farmer counters buyer)
  const handleSendCounter = () => {
    if (!selectedOffer) return;
    setOffers((prev) =>
      prev.map((o) =>
        o.id === selectedOffer.id
          ? { ...o, counterPrice, counterRound: 1, status: 'countered' }
          : o
      )
    );
    setSelectedOffer(null);
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
          onClick={() => setCreateModalOpen(true)}
          className="px-4 py-2.5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-bold text-xs shadow-md flex items-center gap-2 self-start sm:self-auto transition-all"
        >
          <Plus className="w-4 h-4" />
          <span>Post New Produce Lot</span>
        </button>
      </div>

      {/* Confirmation Banner */}
      {purchaseCreatedAlert && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center justify-between text-xs text-emerald-900 animate-in fade-in">
          <div className="flex items-center gap-2 font-semibold">
            <CheckCircle2 className="w-5 h-5 text-emerald-600" />
            <span>{purchaseCreatedAlert}</span>
          </div>
          <button
            onClick={() => setPurchaseCreatedAlert(null)}
            className="text-emerald-700 font-bold hover:underline"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Section 1: Active Lots Grid */}
      <div className="space-y-3">
        <h3 className="font-bold text-sm text-slate-900">My Listed Produce Lots ({lots.length})</h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {lots.map((lot) => (
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

              <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-600">
                  {lot.offersCount} Buyer Quotes Received
                </span>
                <button
                  onClick={() => handleWithdrawLot(lot.id)}
                  className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                  title="Withdraw Lot"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Section 2: Received Offers & 1-Round Negotiation Inbox */}
      <div className="space-y-3 pt-4 border-t border-slate-200">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-bold text-sm text-slate-900">
              Received Buyer Offers & Negotiation Desk
            </h3>
            <p className="text-xs text-slate-400">
              Per Agrovercity protocol, negotiation allows <strong>maximum 1 counter round</strong> before final acceptance or decline.
            </p>
          </div>
        </div>

        <div className="space-y-3">
          {offers.map((offer) => (
            <div
              key={offer.id}
              className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4"
            >
              <div className="space-y-1.5 max-w-xl">
                <div className="flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-slate-400" />
                  <span className="font-extrabold text-sm text-slate-900">
                    {offer.receiverName}
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

                {offer.status !== 'accepted' && (
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
                      className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs"
                    >
                      Accept
                    </button>
                  </div>
                )}

                {offer.status === 'accepted' && (
                  <span className="text-xs font-bold text-emerald-700 flex items-center gap-1 bg-emerald-50 px-3 py-1.5 rounded-xl border border-emerald-200">
                    <Check className="w-4 h-4" /> Deal Locked
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Create New Produce Lot Modal */}
      <ModalSheet
        isOpen={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        title="Post New Produce Lot"
        description="List harvested crop for direct B2B buyer discovery"
        maxWidth="lg"
      >
        <form onSubmit={handleCreateLot} className="space-y-4">
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
                onChange={(e) => setNewGrade(e.target.value as any)}
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

          <button
            type="submit"
            className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-bold text-xs shadow-md transition-all mt-2"
          >
            Publish Lot for Buyers
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
              <span className="font-bold text-slate-900">{selectedOffer?.receiverName}</span>
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
            className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md transition-all"
          >
            Send Counter Quote to Buyer
          </button>
        </div>
      </ModalSheet>
    </div>
  );
};
