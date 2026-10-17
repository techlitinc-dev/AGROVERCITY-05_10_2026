import React, { useEffect, useState } from 'react';
import {
  Layers,
  Building2,
  MapPin,
  Calendar,
  Send,
  Check,
  ShieldCheck,
} from 'lucide-react';
import { demands, offers, apiErrorMessage } from '../../lib/api';
import { ModalSheet } from '../../components/common/ModalSheet';
import { StatusBadge } from '../../components/common/StatusBadge';
import { formatCurrency, formatWeight } from '../../lib/utils';
import type { BuyerDemand, TradeOffer } from '../../types';

export const BuyerDemandsView: React.FC = () => {
  const [demandsList, setDemandsList] = useState<BuyerDemand[]>([]);
  const [myOffers, setMyOffers] = useState<TradeOffer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [selectedDemand, setSelectedDemand] = useState<BuyerDemand | null>(null);
  const [offerPrice, setOfferPrice] = useState<number>(4760);
  const [offerQuantity, setOfferQuantity] = useState<number>(20);
  const [offerMessage, setOfferMessage] = useState<string>('Grade A cleaned soybean, ready in 50kg gunny bags.');
  const [sending, setSending] = useState<boolean>(false);
  const [offerSentAlert, setOfferSentAlert] = useState<boolean>(false);

  useEffect(() => {
    let active = true;
    setLoading(true);
    Promise.all([demands.browse({ status: 'open' }), offers.mine()])
      .then(([d, o]) => {
        if (!active) return;
        setDemandsList(d);
        setMyOffers(o.filter((x) => x.targetType === 'demand'));
      })
      .catch((e) => active && setError(apiErrorMessage(e)))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, []);

  const myOfferFor = (demandId: string): TradeOffer | undefined =>
    myOffers.find((o) => o.targetId === demandId);

  const handleSendOffer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDemand) return;
    setSending(true);
    setError(null);
    try {
      const created = await offers.create({
        targetType: 'demand',
        targetId: selectedDemand.id,
        pricePerUnit: offerPrice,
        quantity: offerQuantity,
        message: offerMessage,
      });
      setMyOffers((prev) => [...prev.filter((o) => o.targetId !== selectedDemand.id), created]);
      setOfferSentAlert(true);
      setTimeout(() => {
        setOfferSentAlert(false);
        setSelectedDemand(null);
      }, 900);
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="border-b border-slate-200 pb-4">
        <h1 className="text-2xl font-extrabold text-slate-900 flex items-center gap-2">
          <Layers className="w-7 h-7 text-emerald-600" />
          Institutional Buyer Demands (Reverse Marketplace)
        </h1>
        <p className="text-xs text-slate-500 mt-1">
          Browse procurement demands posted by food processors, exporters, and large traders. Send your offer directly.
        </p>
      </div>

      {error && (
        <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-2xl text-xs font-semibold text-rose-800">
          {error}
        </div>
      )}
      {notice && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-2xl text-xs font-semibold text-emerald-800 flex items-center justify-between">
          <span>{notice}</span>
          <button onClick={() => setNotice(null)} className="font-bold hover:underline">Dismiss</button>
        </div>
      )}

      {/* Demands List */}
      <div className="space-y-4">
        {loading ? (
          <div className="py-10 text-center text-xs font-bold text-slate-400 animate-pulse">
            Loading open buyer demands…
          </div>
        ) : demandsList.length === 0 ? (
          <div className="py-10 text-center text-xs font-semibold text-slate-400 bg-white rounded-3xl border border-slate-200/80">
            No open demands right now. Check back soon — new procurement demands are posted daily.
          </div>
        ) : (
          demandsList.map((demand) => {
            const existing = myOfferFor(demand.id);
            return (
              <div
                key={demand.id}
                className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs hover:border-slate-300 transition-all flex flex-col lg:flex-row lg:items-center justify-between gap-6"
              >
                <div className="space-y-2 max-w-2xl">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="p-2 rounded-xl bg-slate-100 text-slate-700">
                      <Building2 className="w-4 h-4" />
                    </span>
                    <div>
                      <h4 className="font-extrabold text-base text-slate-900">{demand.companyName}</h4>
                      <p className="text-[11px] text-slate-400">Buyer: {demand.buyerName}</p>
                    </div>
                    <StatusBadge status={demand.status} />
                    {existing && (
                      <span className="text-[10px] font-bold text-sky-700 bg-sky-50 border border-sky-200 px-2 py-0.5 rounded-full flex items-center gap-1">
                        <ShieldCheck className="w-3 h-3" /> Offer {existing.status}
                      </span>
                    )}
                  </div>

                  <div className="text-xs text-slate-700 font-medium">
                    Crop Needed:{' '}
                    <strong className="text-slate-900">
                      {demand.crop} {demand.variety && `(${demand.variety})`}
                    </strong>
                  </div>

                  <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100 text-xs text-slate-600 space-y-1">
                    <p>
                      <strong>Quality Specs:</strong> {demand.qualitySpecs}
                    </p>
                    <div className="flex flex-wrap gap-4 pt-1 text-[11px] text-slate-500">
                      <span className="flex items-center gap-1">
                        <MapPin className="w-3.5 h-3.5 text-slate-400" /> Delivery: {demand.deliveryLocation}
                      </span>
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5 text-slate-400" /> Valid Until: {demand.validUntil}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Demand Metrics & Action */}
                <div className="flex flex-col sm:flex-row lg:flex-col items-start sm:items-end justify-between gap-3 flex-shrink-0">
                  <div className="text-left sm:text-right">
                    <span className="text-[10px] uppercase font-bold text-slate-400 block">Required Volume</span>
                    <span className="text-sm font-bold text-slate-800">{formatWeight(demand.requiredQuantityQuintal)}</span>
                    <div className="mt-1">
                      <span className="text-[10px] uppercase font-bold text-slate-400 block">Max Budget Price</span>
                      <span className="text-xl font-black text-emerald-700">
                        {formatCurrency(demand.maxPricePerQuintal)}
                      </span>
                      <span className="text-xs text-slate-500"> /q</span>
                    </div>
                  </div>

                  <button
                    onClick={() => {
                      setSelectedDemand(demand);
                      setOfferPrice(existing?.pricePerUnit ?? demand.maxPricePerQuintal - 140);
                      setOfferQuantity(existing?.quantity ?? Math.min(20, demand.requiredQuantityQuintal));
                      if (existing?.message) setOfferMessage(existing.message);
                    }}
                    className="w-full sm:w-auto px-5 py-2.5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-bold text-xs shadow-md transition-all flex items-center justify-center gap-2"
                  >
                    <span>{existing ? 'Update Offer Quote' : 'Send Offer Quote'}</span>
                    <Send className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Send Offer Quote Modal */}
      <ModalSheet
        isOpen={Boolean(selectedDemand)}
        onClose={() => setSelectedDemand(null)}
        title="Send Offer Quote to Buyer"
        description={`Submit your price and available quantity to ${selectedDemand?.companyName}`}
        maxWidth="md"
      >
        <form onSubmit={handleSendOffer} className="space-y-4">
          <div className="p-3 bg-slate-50 rounded-xl text-xs space-y-1">
            <div className="flex justify-between text-slate-600">
              <span>Required Crop:</span>
              <span className="font-bold text-slate-900">{selectedDemand?.crop}</span>
            </div>
            <div className="flex justify-between text-slate-600">
              <span>Buyer Max Cap:</span>
              <span className="font-bold text-emerald-800">
                {selectedDemand && formatCurrency(selectedDemand.maxPricePerQuintal)}/q
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Your Price (₹/q)</label>
              <input
                type="number"
                value={offerPrice}
                onChange={(e) => setOfferPrice(Number(e.target.value))}
                className="w-full px-3 py-2 text-sm font-bold rounded-xl border border-slate-300 text-emerald-800"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Quantity Offered (q)</label>
              <input
                type="number"
                value={offerQuantity}
                onChange={(e) => setOfferQuantity(Number(e.target.value))}
                className="w-full px-3 py-2 text-sm font-bold rounded-xl border border-slate-300"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Offer Message & Produce Specs</label>
            <textarea
              rows={3}
              value={offerMessage}
              onChange={(e) => setOfferMessage(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300"
            />
          </div>

          <button
            type="submit"
            disabled={sending || offerSentAlert}
            className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md transition-all flex items-center justify-center gap-1.5 disabled:opacity-60"
          >
            {offerSentAlert ? (
              <>
                <Check className="w-4 h-4 text-emerald-200" /> Offer Submitted to Buyer!
              </>
            ) : sending ? (
              'Submitting…'
            ) : (
              <>
                <Send className="w-4 h-4" /> Submit Offer Quote
              </>
            )}
          </button>
        </form>
      </ModalSheet>
    </div>
  );
};
