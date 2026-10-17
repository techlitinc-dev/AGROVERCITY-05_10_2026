import React, { useCallback, useEffect, useState } from 'react';
import { Layers, Building2, MapPin, Calendar, Send, Check, X, RotateCcw, RefreshCcw } from 'lucide-react';
import { demands, offers, apiErrorMessage } from '../../lib/api';
import { ModalSheet } from '../../components/common/ModalSheet';
import { StatusBadge } from '../../components/common/StatusBadge';
import { formatCurrency, formatWeight } from '../../lib/utils';
import type { BuyerDemand, TradeOffer } from '../../types';
import {
  cardCls,
  EmptyState,
  ErrorBanner,
  ghostBtnCls,
  inputCls,
  labelCls,
  LoadingBlock,
  primaryBtnCls,
} from './shared';

/**
 * Seller-facing demands desk: browse institutional buyer demands and quote,
 * plus track offers the seller has sent (withdraw) and offers received on
 * their lots (counter / accept / reject).
 */
export const SellerDemandsManager: React.FC = () => {
  const [browseDemands, setBrowseDemands] = useState<BuyerDemand[]>([]);
  const [myOffers, setMyOffers] = useState<TradeOffer[]>([]);
  const [receivedOffers, setReceivedOffers] = useState<TradeOffer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [b, mine, received] = await Promise.all([
        demands.browse().catch(() => [] as BuyerDemand[]),
        offers.mine({ filter: 'sent' }).catch(() => [] as TradeOffer[]),
        offers.mine({ filter: 'received' }).catch(() => [] as TradeOffer[]),
      ]);
      setBrowseDemands(b);
      setMyOffers(mine);
      setReceivedOffers(received);
    } catch (e) {
      setError(apiErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  // --- offer form state ---
  const [selectedDemand, setSelectedDemand] = useState<BuyerDemand | null>(null);
  const [offerPrice, setOfferPrice] = useState(4760);
  const [offerQuantity, setOfferQuantity] = useState(20);
  const [offerMessage, setOfferMessage] = useState('');
  const [saving, setSaving] = useState(false);
  const [counterOffer, setCounterOffer] = useState<TradeOffer | null>(null);
  const [counterPrice, setCounterPrice] = useState(4700);

  const sendOffer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDemand) return;
    setSaving(true);
    setActionError(null);
    try {
      await offers.create({
        targetType: 'demand',
        targetId: selectedDemand.id,
        pricePerUnit: offerPrice,
        quantity: offerQuantity,
        message: offerMessage,
      });
      setSelectedDemand(null);
      await load();
    } catch (err) {
      setActionError(apiErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const act = async (fn: () => Promise<unknown>) => {
    setActionError(null);
    try {
      await fn();
      await load();
    } catch (err) {
      setActionError(apiErrorMessage(err));
    }
  };

  const submitCounter = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!counterOffer) return;
    await act(() => offers.counter(counterOffer.id, { pricePerUnit: counterPrice }));
    setCounterOffer(null);
  };

  const openDemands = browseDemands.filter((d) => d.status === 'open');

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 flex items-center gap-2">
            <Layers className="w-7 h-7 text-emerald-600" />
            Buyer Demand Exchange
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Quote against institutional crop demands and manage offers on your own listings
          </p>
        </div>
        <button onClick={() => void load()} className={ghostBtnCls}>
          <RefreshCcw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
        </button>
      </div>

      <ErrorBanner message={error ?? actionError} />
      {loading && <LoadingBlock />}

      {!loading && (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Open demands to quote */}
            <div className="space-y-3">
              <h3 className="font-bold text-sm text-slate-900">Open Buyer Demands ({openDemands.length})</h3>
              {openDemands.length === 0 ? (
                <div className={cardCls}>
                  <EmptyState label="No open buyer demands right now" />
                </div>
              ) : (
                openDemands.map((demand) => (
                  <div key={demand.id} className={`${cardCls} p-5 space-y-3`}>
                    <div className="flex items-center gap-2">
                      <span className="p-2 rounded-xl bg-slate-100 text-slate-700">
                        <Building2 className="w-4 h-4" />
                      </span>
                      <div className="flex-1">
                        <h4 className="font-extrabold text-sm text-slate-900">{demand.companyName}</h4>
                        <p className="text-[11px] text-slate-400">Buyer: {demand.buyerName}</p>
                      </div>
                      <StatusBadge status={demand.status} />
                    </div>
                    <p className="text-xs text-slate-700">
                      <strong>{demand.crop}</strong> {demand.variety ? `(${demand.variety})` : ''} ·{' '}
                      {formatWeight(demand.requiredQuantityQuintal)} · Max{' '}
                      <strong className="text-emerald-700">{formatCurrency(demand.maxPricePerQuintal)}/q</strong>
                    </p>
                    <p className="text-[11px] text-slate-500 flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5" /> {demand.deliveryLocation}
                      <Calendar className="w-3.5 h-3.5 ml-2" /> Valid until {demand.validUntil}
                    </p>
                    <button
                      onClick={() => {
                        setSelectedDemand(demand);
                        setOfferPrice(demand.maxPricePerQuintal - 100);
                        setOfferQuantity(Math.min(20, demand.requiredQuantityQuintal));
                        setOfferMessage(demand.qualitySpecs || '');
                      }}
                      className={`${primaryBtnCls} w-full flex items-center justify-center gap-1.5`}
                    >
                      <Send className="w-3.5 h-3.5" /> Send Offer Quote
                    </button>
                  </div>
                ))
              )}
            </div>

            <div className="space-y-6">
              {/* Offers I sent */}
              <div className="space-y-3">
                <h3 className="font-bold text-sm text-slate-900">Offers I Sent ({myOffers.length})</h3>
                {myOffers.length === 0 ? (
                  <div className={cardCls}>
                    <EmptyState label="No offers sent yet" />
                  </div>
                ) : (
                  myOffers.map((o) => (
                    <div key={o.id} className={`${cardCls} p-4 flex items-center justify-between gap-3`}>
                      <div>
                        <p className="text-xs font-bold text-slate-900">
                          {o.lotCrop || o.targetType} → {o.receiverName}
                        </p>
                        <p className="text-[11px] text-slate-500">
                          {formatCurrency(o.pricePerUnit)}/unit · Qty {o.quantity}
                          {o.counterPrice ? ` · Countered at ${formatCurrency(o.counterPrice)}` : ''}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <StatusBadge status={o.status} />
                        {(o.status === 'pending' || o.status === 'countered') && (
                          <button onClick={() => void act(() => offers.withdraw(o.id))} className={ghostBtnCls}>
                            <RotateCcw className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Offers received */}
              <div className="space-y-3">
                <h3 className="font-bold text-sm text-slate-900">Offers Received ({receivedOffers.length})</h3>
                {receivedOffers.length === 0 ? (
                  <div className={cardCls}>
                    <EmptyState label="No incoming offers on your listings" />
                  </div>
                ) : (
                  receivedOffers.map((o) => (
                    <div key={o.id} className={`${cardCls} p-4 space-y-2.5`}>
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-xs font-bold text-slate-900">
                          {o.senderName} · {o.lotCrop || o.targetType}
                        </p>
                        <StatusBadge status={o.status} />
                      </div>
                      <p className="text-[11px] text-slate-600">
                        Offers <strong>{formatCurrency(o.pricePerUnit)}</strong> for qty {o.quantity}
                        {o.message ? ` — “${o.message}”` : ''}
                      </p>
                      {o.status === 'pending' && (
                        <div className="flex gap-2">
                          <button onClick={() => void act(() => offers.accept(o.id))} className={`${primaryBtnCls} flex-1`}>
                            <Check className="w-3.5 h-3.5 inline mr-1" /> Accept
                          </button>
                          <button
                            onClick={() => {
                              setCounterOffer(o);
                              setCounterPrice(o.counterPrice || o.pricePerUnit);
                            }}
                            className={`${ghostBtnCls} flex-1`}
                          >
                            Counter
                          </button>
                          <button onClick={() => void act(() => offers.reject(o.id, 'Not acceptable'))} className={`${ghostBtnCls} flex-1`}>
                            <X className="w-3.5 h-3.5 inline mr-1" /> Reject
                          </button>
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </>
      )}

      {/* Send offer modal */}
      <ModalSheet
        isOpen={Boolean(selectedDemand)}
        onClose={() => setSelectedDemand(null)}
        title="Send Offer Quote to Buyer"
        description={selectedDemand ? `Submit your price to ${selectedDemand.companyName}` : undefined}
        maxWidth="md"
      >
        <form onSubmit={(e) => void sendOffer(e)} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Your Price (₹/q)</label>
              <input
                type="number"
                className={`${inputCls} font-bold text-emerald-800`}
                value={offerPrice}
                onChange={(e) => setOfferPrice(Number(e.target.value))}
                required
              />
            </div>
            <div>
              <label className={labelCls}>Quantity Offered (q)</label>
              <input
                type="number"
                className={`${inputCls} font-bold`}
                value={offerQuantity}
                onChange={(e) => setOfferQuantity(Number(e.target.value))}
                required
              />
            </div>
          </div>
          <div>
            <label className={labelCls}>Message & Produce Specs</label>
            <textarea rows={3} className={inputCls} value={offerMessage} onChange={(e) => setOfferMessage(e.target.value)} />
          </div>
          <ErrorBanner message={actionError} />
          <button type="submit" disabled={saving} className={`${primaryBtnCls} w-full py-3`}>
            {saving ? 'Submitting…' : 'Submit Offer Quote'}
          </button>
        </form>
      </ModalSheet>

      {/* Counter modal */}
      <ModalSheet
        isOpen={Boolean(counterOffer)}
        onClose={() => setCounterOffer(null)}
        title="Counter This Offer"
        description={counterOffer ? `One counter round allowed against ${counterOffer.senderName}` : undefined}
        maxWidth="sm"
      >
        <form onSubmit={(e) => void submitCounter(e)} className="space-y-4">
          <div>
            <label className={labelCls}>Counter Price (₹/unit)</label>
            <input
              type="number"
              className={`${inputCls} font-bold text-emerald-800`}
              value={counterPrice}
              onChange={(e) => setCounterPrice(Number(e.target.value))}
              required
            />
          </div>
          <ErrorBanner message={actionError} />
          <button type="submit" className={`${primaryBtnCls} w-full py-3`}>
            Send Counter Offer
          </button>
        </form>
      </ModalSheet>
    </div>
  );
};
