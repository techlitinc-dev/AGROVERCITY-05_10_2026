import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Layers, Building2, MapPin, Calendar, Send, Check, X, RotateCcw, RefreshCcw, Megaphone, Repeat, Clock, History, MessageSquare, ShieldCheck } from 'lucide-react';
import { demands, directBuyer, offers, users, apiErrorMessage } from '../../lib/api';
import { ModalSheet } from '../../components/common/ModalSheet';
import { StatusBadge } from '../../components/common/StatusBadge';
import { formatCurrency, formatWeight } from '../../lib/utils';
import type { BuyerDemand, TradeOffer } from '../../types';
import {
  arr,
  cardCls,
  EmptyState,
  ErrorBanner,
  ghostBtnCls,
  inputCls,
  labelCls,
  LoadingBlock,
  num,
  primaryBtnCls,
  rec,
  str,
  type Rec,
} from './shared';

/** 24h-style expiry countdown label for live offers (static per load). */
const expiryLabel = (expiresAt: unknown): string => {
  const raw = str(expiresAt);
  if (!raw) return '';
  const due = Date.parse(raw);
  if (!Number.isFinite(due)) return '';
  const ms = due - Date.now();
  if (ms <= 0) return 'Expired';
  const hours = Math.floor(ms / 3600000);
  const minutes = Math.floor((ms % 3600000) / 60000);
  return hours > 0 ? `Expires in ${hours}h ${minutes}m` : `Expires in ${minutes}m`;
};

const TRANSPORT_MODES = [
  { id: 'buyerArranges', label: 'I arrange transport' },
  { id: 'farmerDelivers', label: 'Farmer delivers' },
  { id: 'buyerPickup', label: 'Farm-gate pickup' },
];

/**
 * Seller-facing demands desk: browse institutional buyer demands and quote,
 * plus track offers the seller has sent (withdraw) and offers received on
 * their lots (counter / accept / reject).
 */
export const SellerDemandsManager: React.FC = () => {
  const navigate = useNavigate();
  const [browseDemands, setBrowseDemands] = useState<BuyerDemand[]>([]);
  const [myOffers, setMyOffers] = useState<TradeOffer[]>([]);
  const [receivedOffers, setReceivedOffers] = useState<TradeOffer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [myUid, setMyUid] = useState<string | null>(null);
  // Mutual deal agreement: deal summary + terms, then both parties confirm.
  const [dealOffer, setDealOffer] = useState<TradeOffer | null>(null);
  const [dealSide, setDealSide] = useState<'sent' | 'received'>('sent');
  const [dealTermsAccepted, setDealTermsAccepted] = useState(false);

  useEffect(() => {
    users
      .getMe()
      .then((me) => setMyUid((me as { id?: string })?.id ?? null))
      .catch(() => {});
  }, []);

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
      // Backend offers use from*/to* fields; normalize for display.
      const norm = (rows: TradeOffer[]): TradeOffer[] =>
        rows.map((o) => {
          const raw = o as TradeOffer & {
            fromId?: string;
            fromName?: string;
            toId?: string;
            toName?: string;
            counter?: { pricePerUnit?: number } | null;
            rounds?: number;
          };
          return {
            ...o,
            senderId: o.senderId ?? raw.fromId ?? '',
            senderName: o.senderName ?? raw.fromName ?? '',
            receiverId: o.receiverId ?? raw.toId ?? '',
            receiverName: o.receiverName ?? raw.toName ?? '',
            counterPrice: o.counterPrice ?? raw.counter?.pricePerUnit,
            counterRound: o.counterRound ?? raw.rounds ?? 0,
          };
        });
      setMyOffers(norm(mine));
      setReceivedOffers(norm(received));
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
  const [offerPickupDate, setOfferPickupDate] = useState('');
  const [offerPaymentDays, setOfferPaymentDays] = useState(0);
  const [offerTransportMode, setOfferTransportMode] = useState('buyerArranges');
  const [saving, setSaving] = useState(false);
  const [counterOffer, setCounterOffer] = useState<TradeOffer | null>(null);
  const [counterPrice, setCounterPrice] = useState(4700);

  // --- post demand / standing order modals ---
  const [demandModal, setDemandModal] = useState(false);
  const [dmCrop, setDmCrop] = useState('Soybean');
  const [dmVariety, setDmVariety] = useState('');
  const [dmQuantity, setDmQuantity] = useState(20);
  const [dmUnit, setDmUnit] = useState('quintal');
  const [dmGrade, setDmGrade] = useState('A');
  const [dmMaxPrice, setDmMaxPrice] = useState(4800);
  const [dmLocation, setDmLocation] = useState('');
  const [dmNeededBy, setDmNeededBy] = useState('');
  const [dmFrequency, setDmFrequency] = useState('oneTime');
  const [dmNotes, setDmNotes] = useState('');
  const [standingModal, setStandingModal] = useState(false);
  const [soCrop, setSoCrop] = useState('Soybean');
  const [soMinPrice, setSoMinPrice] = useState(4400);
  const [soMaxPrice, setSoMaxPrice] = useState(4800);
  const [soQtyPerSlot, setSoQtyPerSlot] = useState(10);
  const [soFrequency, setSoFrequency] = useState('weekly');
  const [soStart, setSoStart] = useState('');
  const [soEnd, setSoEnd] = useState('');
  const [posting, setPosting] = useState(false);

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
        pickupDate: offerPickupDate || undefined,
        paymentTermsDays: offerPaymentDays,
        transportMode: offerTransportMode,
      } as Partial<TradeOffer>);
      setSelectedDemand(null);
      await load();
    } catch (err) {
      setActionError(apiErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const postDemand = async (e: React.FormEvent) => {
    e.preventDefault();
    setPosting(true);
    setActionError(null);
    try {
      await demands.create({
        crop: dmCrop.trim(),
        variety: dmVariety.trim(),
        quantity: dmQuantity,
        unit: dmUnit,
        qualityGrade: dmGrade,
        maxPrice: dmMaxPrice,
        deliveryLocation: dmLocation.trim(),
        neededBy: dmNeededBy,
        frequency: dmFrequency,
        notes: dmNotes.trim(),
      } as Partial<BuyerDemand>);
      setDemandModal(false);
      setNotice('Demand posted — farmers can now offer against it.');
      await load();
    } catch (err) {
      setActionError(apiErrorMessage(err));
    } finally {
      setPosting(false);
    }
  };

  const postStandingOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    setPosting(true);
    setActionError(null);
    try {
      await directBuyer.createStandingOrder({
        crop: soCrop.trim(),
        variety: '',
        minPrice: soMinPrice,
        maxPrice: soMaxPrice,
        quantityPerSlot: soQtyPerSlot,
        unit: 'quintal',
        frequency: soFrequency,
        startDate: soStart,
        endDate: soEnd,
        serviceArea: {},
        deliveryLocation: '',
        qualityGrade: 'A',
        notes: '',
      });
      setStandingModal(false);
      setNotice('Standing order posted — recurring supply window is open.');
      await load();
    } catch (err) {
      setActionError(apiErrorMessage(err));
    } finally {
      setPosting(false);
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

  const openDealModal = (offer: TradeOffer, side: 'sent' | 'received') => {
    setActionError(null);
    setDealTermsAccepted(false);
    setDealSide(side);
    setDealOffer(offer);
  };

  const confirmDeal = async () => {
    if (!dealOffer) return;
    setActionError(null);
    try {
      const { offer: updated, purchase } = await offers.accept(dealOffer.id);
      const patch = (list: TradeOffer[]) => list.map((o) => (o.id === updated.id ? updated : o));
      setMyOffers((prev) => patch(prev));
      setReceivedOffers((prev) => patch(prev));
      const finalPrice =
        (updated as TradeOffer & { counter?: { pricePerUnit?: number } }).counter?.pricePerUnit ||
        updated.counterPrice ||
        updated.pricePerUnit;
      setNotice(
        purchase
          ? `Deal locked by both parties — purchase order confirmed at ₹${finalPrice}/q!`
          : 'You agreed to the deal — waiting for the other party to confirm.'
      );
      setDealOffer(null);
    } catch (err) {
      setActionError(apiErrorMessage(err));
    }
  };

  /** Shared "I agreed / they agreed" action row for agreement_pending offers. */
  const agreementActions = (o: TradeOffer) => {
    const iAgreed = (o.agreement?.confirmedBy ?? []).includes(myUid ?? '');
    return (
      <div className="flex items-center gap-2">
        {iAgreed ? (
          <>
            <span className="text-[11px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-xl">
              Awaiting their confirmation
            </span>
            <button
              onClick={() => void act(() => offers.cancelAgreement(o.id))}
              className={ghostBtnCls}
            >
              <RotateCcw className="w-3.5 h-3.5" /> Cancel
            </button>
          </>
        ) : (
          <button onClick={() => openDealModal(o, 'sent')} className={`${primaryBtnCls} flex-1`}>
            <Check className="w-3.5 h-3.5 inline mr-1" /> Confirm Deal
          </button>
        )}
        <button
          onClick={() => navigate(`/chat?room=${encodeURIComponent(o.id)}`)}
          title="Chat"
          className={ghostBtnCls}
        >
          <MessageSquare className="w-3.5 h-3.5" />
        </button>
      </div>
    );
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
        <div className="flex flex-wrap gap-2 self-start sm:self-auto">
          <button
            onClick={() => {
              setNotice(null);
              setDemandModal(true);
            }}
            className={`${ghostBtnCls} flex items-center gap-1.5`}
          >
            <Megaphone className="w-3.5 h-3.5" /> Post Demand
          </button>
          <button
            onClick={() => {
              setNotice(null);
              setStandingModal(true);
            }}
            className={`${ghostBtnCls} flex items-center gap-1.5`}
          >
            <Repeat className="w-3.5 h-3.5" /> Post Standing Order
          </button>
          <button onClick={() => void load()} className={ghostBtnCls}>
            <RefreshCcw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </button>
        </div>
      </div>

      <ErrorBanner message={error ?? actionError} />
      {notice && (
        <div className="p-3 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold">
          {notice}
        </div>
      )}
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
                        setOfferPickupDate(new Date(Date.now() + 86400000).toISOString().split('T')[0]);
                        setOfferPaymentDays(0);
                        setOfferTransportMode('buyerArranges');
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
                  myOffers.map((o) => {
                    const raw = rec(o as unknown as Rec);
                    const log = arr(raw.negotiationLog).map(rec);
                    const expiresIn = ['pending', 'countered'].includes(o.status)
                      ? expiryLabel(raw.expiresAt)
                      : '';
                    return (
                      <div key={o.id} className={`${cardCls} p-4 space-y-2`}>
                        <div className="flex items-center justify-between gap-3">
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

                        {expiresIn && (
                          <p
                            className={`text-[11px] font-bold flex items-center gap-1.5 ${
                              expiresIn === 'Expired' ? 'text-rose-600' : 'text-amber-700'
                            }`}
                          >
                            <Clock className="w-3.5 h-3.5" /> {expiresIn}
                          </p>
                        )}

                        {log.length > 0 && (
                          <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-100 space-y-1">
                            <p className="text-[10px] uppercase font-bold text-slate-400 flex items-center gap-1">
                              <History className="w-3 h-3" /> Negotiation log ({num(raw.rounds, log.length)}/3 rounds)
                            </p>
                            {log.map((entry, i) => (
                              <p key={i} className="text-[11px] text-slate-600">
                                Round {num(entry.round, i + 1)}: {formatCurrency(num(entry.pricePerUnit))}
                                {str(entry.note) ? ` — “${str(entry.note)}”` : ''}
                              </p>
                            ))}
                          </div>
                        )}

                        {o.status === 'agreement_pending' ? (
                          agreementActions(o)
                        ) : (
                          <div className="flex items-center gap-2">
                            {(o.status === 'pending' || o.status === 'countered') && (
                              <button onClick={() => void act(() => offers.withdraw(o.id))} className={ghostBtnCls}>
                                <RotateCcw className="w-3.5 h-3.5" /> Withdraw
                              </button>
                            )}
                            {['pending', 'countered', 'accepted'].includes(o.status) && (
                              <button
                                onClick={() => navigate(`/chat?room=${encodeURIComponent(o.id)}`)}
                                title="Chat with other party"
                                className={ghostBtnCls}
                              >
                                <MessageSquare className="w-3.5 h-3.5" /> Chat
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })
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
                  receivedOffers.map((o) => {
                    const raw = rec(o as unknown as Rec);
                    const log = arr(raw.negotiationLog).map(rec);
                    const expiresIn = ['pending', 'countered'].includes(o.status)
                      ? expiryLabel(raw.expiresAt)
                      : '';
                    return (
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

                        {expiresIn && (
                          <p
                            className={`text-[11px] font-bold flex items-center gap-1.5 ${
                              expiresIn === 'Expired' ? 'text-rose-600' : 'text-amber-700'
                            }`}
                          >
                            <Clock className="w-3.5 h-3.5" /> {expiresIn}
                          </p>
                        )}

                        {log.length > 0 && (
                          <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-100 space-y-1">
                            <p className="text-[10px] uppercase font-bold text-slate-400 flex items-center gap-1">
                              <History className="w-3 h-3" /> Negotiation log ({num(raw.rounds, log.length)}/3 rounds)
                            </p>
                            {log.map((entry, i) => (
                              <p key={i} className="text-[11px] text-slate-600">
                                Round {num(entry.round, i + 1)}: {formatCurrency(num(entry.pricePerUnit))}
                                {str(entry.note) ? ` — “${str(entry.note)}”` : ''}
                              </p>
                            ))}
                          </div>
                        )}

                        {o.status === 'pending' && (
                          <div className="flex gap-2">
                            <button onClick={() => openDealModal(o, 'received')} className={`${primaryBtnCls} flex-1`}>
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
                            <button
                              onClick={() => navigate(`/chat?room=${encodeURIComponent(o.id)}`)}
                              title="Chat"
                              className={ghostBtnCls}
                            >
                              <MessageSquare className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}

                        {o.status === 'agreement_pending' && agreementActions(o)}
                      </div>
                    );
                  })
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

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Pickup Date</label>
              <input
                type="date"
                className={inputCls}
                value={offerPickupDate}
                onChange={(e) => setOfferPickupDate(e.target.value)}
              />
            </div>
            <div>
              <label className={labelCls}>Payment Terms (days)</label>
              <input
                type="number"
                min={0}
                max={120}
                className={inputCls}
                value={offerPaymentDays}
                onChange={(e) => setOfferPaymentDays(Number(e.target.value))}
              />
            </div>
          </div>

          <div>
            <label className={labelCls}>Transport Mode</label>
            <select
              className={inputCls}
              value={offerTransportMode}
              onChange={(e) => setOfferTransportMode(e.target.value)}
            >
              {TRANSPORT_MODES.map((m) => (
                <option key={m.id} value={m.id}>{m.label}</option>
              ))}
            </select>
          </div>

          <ErrorBanner message={actionError} />
          <button type="submit" disabled={saving} className={`${primaryBtnCls} w-full py-3`}>
            {saving ? 'Submitting…' : 'Submit Offer Quote'}
          </button>
        </form>
      </ModalSheet>

      {/* Post Demand modal (POST /demands — seller role allowed) */}
      <ModalSheet
        isOpen={demandModal}
        onClose={() => setDemandModal(false)}
        title="Post Crop Demand"
        description="Publish a buying requirement to the farmer network"
        maxWidth="md"
      >
        <form onSubmit={(e) => void postDemand(e)} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Crop *</label>
              <input className={inputCls} value={dmCrop} onChange={(e) => setDmCrop(e.target.value)} required />
            </div>
            <div>
              <label className={labelCls}>Variety</label>
              <input className={inputCls} value={dmVariety} onChange={(e) => setDmVariety(e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className={labelCls}>Quantity *</label>
              <input type="number" className={inputCls} value={dmQuantity} onChange={(e) => setDmQuantity(Number(e.target.value))} required />
            </div>
            <div>
              <label className={labelCls}>Unit</label>
              <select className={inputCls} value={dmUnit} onChange={(e) => setDmUnit(e.target.value)}>
                <option value="quintal">Quintal</option>
                <option value="kg">KG</option>
                <option value="tonne">Tonne</option>
                <option value="litre">Litre</option>
              </select>
            </div>
            <div>
              <label className={labelCls}>Quality Grade</label>
              <select className={inputCls} value={dmGrade} onChange={(e) => setDmGrade(e.target.value)}>
                <option value="A">A</option>
                <option value="B">B</option>
                <option value="C">C</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Max Price (₹/unit) *</label>
              <input type="number" className={`${inputCls} font-bold text-emerald-800`} value={dmMaxPrice} onChange={(e) => setDmMaxPrice(Number(e.target.value))} required />
            </div>
            <div>
              <label className={labelCls}>Frequency</label>
              <select className={inputCls} value={dmFrequency} onChange={(e) => setDmFrequency(e.target.value)}>
                <option value="oneTime">One Time</option>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Delivery Location</label>
              <input className={inputCls} value={dmLocation} onChange={(e) => setDmLocation(e.target.value)} placeholder="Nashik APMC" />
            </div>
            <div>
              <label className={labelCls}>Needed By</label>
              <input type="date" className={inputCls} value={dmNeededBy} onChange={(e) => setDmNeededBy(e.target.value)} />
            </div>
          </div>
          <div>
            <label className={labelCls}>Notes</label>
            <textarea rows={2} className={inputCls} value={dmNotes} onChange={(e) => setDmNotes(e.target.value)} />
          </div>
          <ErrorBanner message={actionError} />
          <button type="submit" disabled={posting} className={`${primaryBtnCls} w-full py-3`}>
            {posting ? 'Posting…' : 'Publish Demand'}
          </button>
        </form>
      </ModalSheet>

      {/* Post Standing Order modal (POST /direct-buyer/standing-orders — seller allowed) */}
      <ModalSheet
        isOpen={standingModal}
        onClose={() => setStandingModal(false)}
        title="Post Standing (Recurring) Order"
        description="A recurring supply window with a price band — farmers see it until the end date"
        maxWidth="md"
      >
        <form onSubmit={(e) => void postStandingOrder(e)} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Crop *</label>
              <input className={inputCls} value={soCrop} onChange={(e) => setSoCrop(e.target.value)} required />
            </div>
            <div>
              <label className={labelCls}>Qty per slot (q) *</label>
              <input type="number" className={inputCls} value={soQtyPerSlot} onChange={(e) => setSoQtyPerSlot(Number(e.target.value))} required />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Min Price (₹/q) *</label>
              <input type="number" className={inputCls} value={soMinPrice} onChange={(e) => setSoMinPrice(Number(e.target.value))} required />
            </div>
            <div>
              <label className={labelCls}>Max Price (₹/q) *</label>
              <input type="number" className={`${inputCls} font-bold text-emerald-800`} value={soMaxPrice} onChange={(e) => setSoMaxPrice(Number(e.target.value))} required />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className={labelCls}>Frequency</label>
              <select className={inputCls} value={soFrequency} onChange={(e) => setSoFrequency(e.target.value)}>
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
              </select>
            </div>
            <div>
              <label className={labelCls}>Start Date *</label>
              <input type="date" className={inputCls} value={soStart} onChange={(e) => setSoStart(e.target.value)} required />
            </div>
            <div>
              <label className={labelCls}>End Date *</label>
              <input type="date" className={inputCls} value={soEnd} onChange={(e) => setSoEnd(e.target.value)} required />
            </div>
          </div>
          <ErrorBanner message={actionError} />
          <button type="submit" disabled={posting} className={`${primaryBtnCls} w-full py-3`}>
            {posting ? 'Posting…' : 'Publish Standing Order'}
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

      {/* Mutual Deal Agreement — terms + explicit confirm from both parties */}
      <ModalSheet
        isOpen={Boolean(dealOffer)}
        onClose={() => setDealOffer(null)}
        title="Confirm Deal — Mutual Agreement"
        description="Review the deal terms. The deal locks only when both parties confirm."
        maxWidth="sm"
      >
        {dealOffer && (
          <div className="space-y-4">
            <div className="p-3 bg-slate-50 rounded-xl text-xs space-y-1.5">
              <div className="flex justify-between text-slate-600">
                <span>Party:</span>
                <span className="font-bold text-slate-900">
                  {dealSide === 'received' ? dealOffer.senderName : dealOffer.receiverName}
                </span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Agreed rate:</span>
                <span className="font-bold text-slate-900">
                  ₹
                  {(dealOffer as TradeOffer & { counter?: { pricePerUnit?: number } }).counter
                    ?.pricePerUnit ||
                    dealOffer.counterPrice ||
                    dealOffer.pricePerUnit}
                  /q
                </span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Quantity:</span>
                <span className="font-bold text-slate-900">{dealOffer.quantity} q</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Total value:</span>
                <span className="font-bold text-emerald-700">
                  ₹
                  {(
                    ((dealOffer as TradeOffer & { counter?: { pricePerUnit?: number } }).counter
                      ?.pricePerUnit ||
                      dealOffer.counterPrice ||
                      dealOffer.pricePerUnit) * dealOffer.quantity
                  ).toLocaleString('en-IN')}
                </span>
              </div>
            </div>

            <div className="p-3 bg-sky-50 rounded-xl border border-sky-200 text-[11px] text-sky-900 space-y-1">
              <p className="font-bold flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5" /> Deal terms & conditions
              </p>
              <ul className="list-disc pl-4 space-y-0.5">
                <li>The deal is binding once both parties confirm on Agrovercity.</li>
                <li>Pickup and payment follow the terms shown above.</li>
                <li>Payment must be recorded on the platform.</li>
                <li>Disputes are resolved via Agrovercity support.</li>
              </ul>
            </div>

            <label className="flex items-start gap-2 text-xs font-semibold text-slate-700 cursor-pointer">
              <input
                type="checkbox"
                checked={dealTermsAccepted}
                onChange={(e) => setDealTermsAccepted(e.target.checked)}
                className="mt-0.5 accent-emerald-600"
              />
              I have reviewed the deal terms and agree to the terms & conditions.
            </label>

            <button
              onClick={() => void confirmDeal()}
              disabled={!dealTermsAccepted}
              className={`${primaryBtnCls} w-full py-3 disabled:opacity-50`}
            >
              {dealSide === 'received' ? 'I Agree — Propose Deal' : 'I Agree — Confirm Deal'}
            </button>
            <p className="text-[10px] text-slate-400 text-center">
              {dealSide === 'received'
                ? 'The other party will be asked to review and confirm the same terms.'
                : 'Once both parties agree, the purchase order is created automatically.'}
            </p>
          </div>
        )}
      </ModalSheet>
    </div>
  );
};
