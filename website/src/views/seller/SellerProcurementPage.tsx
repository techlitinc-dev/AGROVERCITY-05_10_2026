import React, { useCallback, useEffect, useState } from 'react';
import {
  FileSpreadsheet,
  Search,
  Send,
  ShoppingCart,
  Truck,
  Award,
  Receipt,
  Star,
  RefreshCcw,
  ShieldCheck,
} from 'lucide-react';
import { lots, offers, purchases, apiErrorMessage } from '../../lib/api';
import { ModalSheet } from '../../components/common/ModalSheet';
import { StatusBadge } from '../../components/common/StatusBadge';
import { formatCurrency, formatWeight, formatDate } from '../../lib/utils';
import type { ProduceLot, PurchaseOrder } from '../../types';
import {
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

const STEPS = ['confirmed', 'advancePaid', 'pickupScheduled', 'inTransit', 'delivered', 'completed'];

const stepIndex = (status: string): number => {
  const i = STEPS.indexOf(status);
  return i === -1 ? (status === 'qcDisputed' ? 4 : -1) : i;
};

/**
 * Seller crop-procurement desk: browse open farmer lots, quote via offers or
 * book outright, then run the escrow → pickup → handover OTP → QC → invoice →
 * rate lifecycle as the buying party.
 */
export const SellerProcurementPage: React.FC = () => {
  const [openLots, setOpenLots] = useState<ProduceLot[]>([]);
  const [mine, setMine] = useState<PurchaseOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [b, m] = await Promise.all([
        lots.browse({ status: 'open' }).catch(() => [] as ProduceLot[]),
        purchases.mine({ role: 'buyer' }).catch(() => [] as PurchaseOrder[]),
      ]);
      setOpenLots(b);
      setMine(m);
    } catch (e) {
      setError(apiErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const act = useCallback(async (fn: () => Promise<unknown>, successMsg?: string) => {
    setActionError(null);
    setNotice(null);
    try {
      await fn();
      if (successMsg) setNotice(successMsg);
      await load();
    } catch (err) {
      setActionError(apiErrorMessage(err));
    }
  }, [load]);

  // --- lot offer / book ---
  const [offerLot, setOfferLot] = useState<ProduceLot | null>(null);
  const [offerPrice, setOfferPrice] = useState(4600);
  const [offerQty, setOfferQty] = useState(10);
  const [bookLot, setBookLot] = useState<ProduceLot | null>(null);
  const [bookQty, setBookQty] = useState(10);
  const [cropFilter, setCropFilter] = useState('');

  const sendLotOffer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!offerLot) return;
    await act(
      () => offers.create({ targetType: 'lot', targetId: offerLot.id, pricePerUnit: offerPrice, quantity: offerQty }),
      'Offer sent to farmer'
    );
    setOfferLot(null);
  };

  const bookNow = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bookLot) return;
    await act(() => purchases.create({ lotId: bookLot.id, quantity: bookQty }), 'Purchase booked — advance pending');
    setBookLot(null);
  };

  // --- purchase lifecycle modals ---
  const [advancePo, setAdvancePo] = useState<PurchaseOrder | null>(null);
  const [advanceAmt, setAdvanceAmt] = useState(10000);
  const [pickupPo, setPickupPo] = useState<PurchaseOrder | null>(null);
  const [pickupDate, setPickupDate] = useState('');
  const [pickupVehicle, setPickupVehicle] = useState('');
  const [pickupAddr, setPickupAddr] = useState('');
  const [verifyPo, setVerifyPo] = useState<PurchaseOrder | null>(null);
  const [verifyOtp, setVerifyOtp] = useState('');
  const [qcPo, setQcPo] = useState<PurchaseOrder | null>(null);
  const [qcGrade, setQcGrade] = useState<'A' | 'B' | 'C'>('A');
  const [qcAccepted, setQcAccepted] = useState(0);
  const [qcRejected, setQcRejected] = useState(0);
  const [qcNote, setQcNote] = useState('');
  const [payPo, setPayPo] = useState<PurchaseOrder | null>(null);
  const [payAmt, setPayAmt] = useState(0);
  const [ratePo, setRatePo] = useState<PurchaseOrder | null>(null);
  const [rateStars, setRateStars] = useState(5);
  const [rateReview, setRateReview] = useState('');
  const [disputePo, setDisputePo] = useState<PurchaseOrder | null>(null);
  const [disputeCategory, setDisputeCategory] = useState('quality');
  const [disputeReason, setDisputeReason] = useState('');

  const downloadInvoice = async (po: PurchaseOrder) => {
    setActionError(null);
    try {
      const blob = await purchases.invoicePdf(po.id);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `invoice-${po.id}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setActionError(apiErrorMessage(err));
    }
  };

  const filteredLots = openLots.filter((l) => !cropFilter || l.crop.toLowerCase().includes(cropFilter.toLowerCase()));

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 flex items-center gap-2">
            <FileSpreadsheet className="w-7 h-7 text-emerald-600" />
            Farmer Produce Procurement Desk
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Browse farmer lots, negotiate by offer or book outright, then run escrow, pickup, handover OTP and QC
          </p>
        </div>
        <button onClick={() => void load()} className={ghostBtnCls}>
          <RefreshCcw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
        </button>
      </div>

      <ErrorBanner message={error ?? actionError} />
      {notice && (
        <div className="p-3 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center gap-2">
          <ShieldCheck className="w-4 h-4" /> {notice}
        </div>
      )}

      {loading ? (
        <LoadingBlock />
      ) : (
        <>
          {/* Browse lots */}
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h3 className="font-bold text-sm text-slate-900">Open Farmer Lots ({filteredLots.length})</h3>
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  className={`${inputCls} pl-8 w-56`}
                  placeholder="Filter by crop…"
                  value={cropFilter}
                  onChange={(e) => setCropFilter(e.target.value)}
                />
              </div>
            </div>
            {filteredLots.length === 0 ? (
              <div className={cardCls}>
                <EmptyState label="No open lots matching your filter" />
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
                {filteredLots.map((lot) => (
                  <div key={lot.id} className={`${cardCls} p-5 space-y-3`}>
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h4 className="font-bold text-sm text-slate-900">{lot.crop}</h4>
                        <p className="text-[11px] text-slate-400">
                          {lot.variety || 'Standard'} · Grade {lot.grade} · {lot.district}, {lot.state}
                        </p>
                      </div>
                      <StatusBadge status={lot.status} />
                    </div>
                    <div className="flex items-baseline justify-between">
                      <span className="text-lg font-black text-emerald-800">{formatCurrency(lot.expectedPricePerQuintal)}<span className="text-xs font-semibold text-slate-500">/q</span></span>
                      <span className="text-xs font-bold text-slate-600">{formatWeight(lot.quantityQuintal)}</span>
                    </div>
                    <p className="text-[11px] text-slate-500">Farmer: {lot.farmerName} · {lot.offersCount} offer(s)</p>
                    <div className="flex gap-2">
                      <button
                        onClick={() => {
                          setOfferLot(lot);
                          setOfferPrice(lot.expectedPricePerQuintal);
                          setOfferQty(Math.min(10, lot.quantityQuintal));
                        }}
                        className={`${ghostBtnCls} flex-1 flex items-center justify-center gap-1.5`}
                      >
                        <Send className="w-3.5 h-3.5" /> Offer
                      </button>
                      <button
                        onClick={() => {
                          setBookLot(lot);
                          setBookQty(lot.quantityQuintal);
                        }}
                        className={`${primaryBtnCls} flex-1 flex items-center justify-center gap-1.5`}
                      >
                        <ShoppingCart className="w-3.5 h-3.5" /> Book Now
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* My purchases pipeline */}
          <div className="space-y-3">
            <h3 className="font-bold text-sm text-slate-900">My Procurement Pipeline ({mine.length})</h3>
            {mine.length === 0 ? (
              <div className={cardCls}>
                <EmptyState label="No produce purchases yet — book a lot above" />
              </div>
            ) : (
              mine.map((po) => {
                const idx = stepIndex(po.status);
                const balance = po.totalAmount - (po.advanceAmount || 0);
                return (
                  <div key={po.id} className={`${cardCls} p-6 space-y-4`}>
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="font-bold text-base text-slate-900">
                            {po.crop} ({formatWeight(po.quantityQuintal)}) from {po.farmerName}
                          </h4>
                          <StatusBadge status={po.status} />
                          {po.invoiceNumber && (
                            <span className="text-[11px] font-mono bg-slate-100 text-slate-700 px-2 py-0.5 rounded-lg font-bold">
                              {po.invoiceNumber}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-400">
                          Order #{po.id} · Agreed {formatCurrency(po.agreedPricePerQuintal)}/q · Booked {formatDate(po.createdAt)}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {po.status === 'confirmed' && (
                          <button onClick={() => { setAdvancePo(po); setAdvanceAmt(Math.min(10000, po.totalAmount)); }} className={primaryBtnCls}>
                            Pay Advance (Escrow)
                          </button>
                        )}
                        {po.status === 'confirmed' && (
                          <button onClick={() => { setDisputePo(po); }} className={ghostBtnCls}>Dispute</button>
                        )}
                        {po.status === 'advancePaid' && (
                          <button onClick={() => { setPickupPo(po); setPickupAddr(po.pickupAddress || ''); }} className={primaryBtnCls}>
                            <Truck className="w-3.5 h-3.5 inline mr-1" /> Schedule Pickup
                          </button>
                        )}
                        {po.status === 'pickupScheduled' && (
                          <button onClick={() => void act(() => purchases.dispatch(po.id), 'Dispatched')} className={primaryBtnCls}>
                            Mark Dispatch
                          </button>
                        )}
                        {po.status === 'inTransit' && (
                          <button onClick={() => void act(() => purchases.deliver(po.id), 'Marked delivered')} className={primaryBtnCls}>
                            Mark Delivered
                          </button>
                        )}
                        {po.status === 'delivered' && (
                          <>
                            <button onClick={() => { setVerifyPo(po); setVerifyOtp(''); }} className={primaryBtnCls}>
                              Verify Handover OTP
                            </button>
                            <button
                              onClick={() => {
                                setQcPo(po);
                                setQcAccepted(po.quantityQuintal);
                                setQcRejected(0);
                              }}
                              className={primaryBtnCls}
                            >
                              <Award className="w-3.5 h-3.5 inline mr-1" /> QC Inspection
                            </button>
                          </>
                        )}
                        {po.status === 'completed' && (
                          <>
                            <button onClick={() => { setPayPo(po); setPayAmt(balance); }} className={primaryBtnCls}>
                              Pay Balance {formatCurrency(balance)}
                            </button>
                            <button onClick={() => void downloadInvoice(po)} className={ghostBtnCls}>
                              <Receipt className="w-3.5 h-3.5 inline mr-1" /> Invoice PDF
                            </button>
                            {!po.ratedFarmer && (
                              <button onClick={() => { setRatePo(po); }} className={ghostBtnCls}>
                                <Star className="w-3.5 h-3.5 inline mr-1" /> Rate Farmer
                              </button>
                            )}
                          </>
                        )}
                        {['confirmed', 'advancePaid', 'pickupScheduled'].includes(po.status) && (
                          <button onClick={() => void act(() => purchases.cancel(po.id, 'Cancelled by buyer'), 'Purchase cancelled')} className={ghostBtnCls}>
                            Cancel
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Stepper */}
                    <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100 overflow-x-auto">
                      <div className="flex items-center gap-1.5 text-[10px] font-bold min-w-max">
                        {STEPS.map((s, i) => (
                          <span
                            key={s}
                            className={`px-2.5 py-1 rounded-xl whitespace-nowrap ${
                              i === idx
                                ? po.status === 'qcDisputed'
                                  ? 'bg-rose-600 text-white'
                                  : 'bg-emerald-600 text-white'
                                : i < idx
                                  ? 'text-emerald-700'
                                  : 'text-slate-400'
                            }`}
                          >
                            {i + 1}. {s.replace(/([A-Z])/g, ' $1')}
                          </span>
                        ))}
                        {po.status === 'qcDisputed' && <span className="px-2.5 py-1 rounded-xl bg-rose-100 text-rose-700">QC Disputed</span>}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                      <div className="p-3 bg-slate-50 rounded-2xl">
                        <span className="text-slate-400 block text-[10px] uppercase font-bold">Total Value</span>
                        <span className="font-black text-emerald-800 text-sm">{formatCurrency(po.totalAmount)}</span>
                      </div>
                      <div className="p-3 bg-slate-50 rounded-2xl">
                        <span className="text-slate-400 block text-[10px] uppercase font-bold">Advance Funded</span>
                        <span className="font-bold text-slate-800 text-sm">
                          {po.advancePaid ? formatCurrency(po.advanceAmount) : 'Not yet'}
                        </span>
                      </div>
                      <div className="p-3 bg-slate-50 rounded-2xl">
                        <span className="text-slate-400 block text-[10px] uppercase font-bold">Pickup</span>
                        <span className="font-bold text-slate-800 text-sm">{po.pickupDate ? formatDate(po.pickupDate) : '—'}</span>
                      </div>
                      <div className="p-3 bg-slate-50 rounded-2xl">
                        <span className="text-slate-400 block text-[10px] uppercase font-bold">QC Grade</span>
                        <span className="font-bold text-slate-800 text-sm">{po.qcGrade || 'Pending'}</span>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </>
      )}

      {/* Offer modal */}
      <ModalSheet isOpen={Boolean(offerLot)} onClose={() => setOfferLot(null)} title="Make Offer on Lot" description={offerLot ? `${offerLot.crop} from ${offerLot.farmerName}` : undefined} maxWidth="sm">
        <form onSubmit={(e) => void sendLotOffer(e)} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Price (₹/q)</label>
              <input type="number" className={`${inputCls} font-bold text-emerald-800`} value={offerPrice} onChange={(e) => setOfferPrice(Number(e.target.value))} required />
            </div>
            <div>
              <label className={labelCls}>Quantity (q)</label>
              <input type="number" className={`${inputCls} font-bold`} value={offerQty} onChange={(e) => setOfferQty(Number(e.target.value))} required />
            </div>
          </div>
          <button type="submit" className={`${primaryBtnCls} w-full py-3`}>Send Offer</button>
        </form>
      </ModalSheet>

      {/* Book modal */}
      <ModalSheet isOpen={Boolean(bookLot)} onClose={() => setBookLot(null)} title="Book Lot Now" description={bookLot ? `Books ${bookLot.crop} at ${formatCurrency(bookLot.expectedPricePerQuintal)}/q` : undefined} maxWidth="sm">
        <form onSubmit={(e) => void bookNow(e)} className="space-y-4">
          <div>
            <label className={labelCls}>Quantity (q) — lot has {bookLot ? formatWeight(bookLot.quantityQuintal) : ''}</label>
            <input type="number" className={`${inputCls} font-bold`} value={bookQty} onChange={(e) => setBookQty(Number(e.target.value))} required />
          </div>
          <div className="p-3 bg-slate-50 rounded-xl text-xs text-slate-600">
            Order value: <strong className="text-emerald-800">{bookLot ? formatCurrency(bookQty * bookLot.expectedPricePerQuintal) : ''}</strong>
          </div>
          <button type="submit" className={`${primaryBtnCls} w-full py-3`}>Confirm Booking</button>
        </form>
      </ModalSheet>

      {/* Advance modal */}
      <ModalSheet isOpen={Boolean(advancePo)} onClose={() => setAdvancePo(null)} title="Pay Advance into Escrow" maxWidth="sm">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!advancePo) return;
            void act(() => purchases.advance(advancePo.id, { amount: advanceAmt, method: 'upi' }), 'Advance paid into escrow');
            setAdvancePo(null);
          }}
          className="space-y-4"
        >
          <div>
            <label className={labelCls}>Advance Amount (₹)</label>
            <input type="number" className={`${inputCls} font-bold text-emerald-800`} value={advanceAmt} max={advancePo?.totalAmount} onChange={(e) => setAdvanceAmt(Number(e.target.value))} required />
            <p className="text-[11px] text-slate-400 mt-1">Max {advancePo ? formatCurrency(advancePo.totalAmount) : ''} — held in platform escrow until delivery.</p>
          </div>
          <button type="submit" className={`${primaryBtnCls} w-full py-3`}>Pay Advance</button>
        </form>
      </ModalSheet>

      {/* Pickup modal */}
      <ModalSheet isOpen={Boolean(pickupPo)} onClose={() => setPickupPo(null)} title="Schedule Pickup" maxWidth="sm">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!pickupPo) return;
            void act(
              () => purchases.pickup(pickupPo.id, { date: pickupDate, vehicleType: pickupVehicle, address: pickupAddr }),
              'Pickup scheduled'
            );
            setPickupPo(null);
          }}
          className="space-y-4"
        >
          <div>
            <label className={labelCls}>Pickup Date</label>
            <input type="date" className={inputCls} value={pickupDate} onChange={(e) => setPickupDate(e.target.value)} required />
          </div>
          <div>
            <label className={labelCls}>Vehicle Type</label>
            <input className={inputCls} value={pickupVehicle} onChange={(e) => setPickupVehicle(e.target.value)} placeholder="Eicher 14ft (4T)" />
          </div>
          <div>
            <label className={labelCls}>Pickup Address</label>
            <textarea rows={2} className={inputCls} value={pickupAddr} onChange={(e) => setPickupAddr(e.target.value)} />
          </div>
          <button type="submit" className={`${primaryBtnCls} w-full py-3`}>Schedule Pickup</button>
        </form>
      </ModalSheet>

      {/* Handover verify */}
      <ModalSheet isOpen={Boolean(verifyPo)} onClose={() => setVerifyPo(null)} title="Verify Handover OTP" description="Enter the 6-digit OTP the farmer reveals at the gate (valid 15 minutes)" maxWidth="sm">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!verifyPo) return;
            void act(() => purchases.handoverVerify(verifyPo.id, verifyOtp), 'Handover verified');
            setVerifyPo(null);
          }}
          className="space-y-4"
        >
          <input
            className={`${inputCls} text-center text-2xl font-black tracking-[0.5em] font-mono`}
            maxLength={6}
            value={verifyOtp}
            onChange={(e) => setVerifyOtp(e.target.value.replace(/\D/g, ''))}
            placeholder="••••"
            required
          />
          <button type="submit" className={`${primaryBtnCls} w-full py-3`}>Verify & Accept Handover</button>
        </form>
      </ModalSheet>

      {/* QC modal */}
      <ModalSheet isOpen={Boolean(qcPo)} onClose={() => setQcPo(null)} title="Produce QC Inspection" description="Grade the received lot; accepted + rejected must equal the booked quantity" maxWidth="md">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!qcPo) return;
            if (Math.abs(qcAccepted + qcRejected - qcPo.quantityQuintal) > 0.001) {
              setActionError(`Accepted + rejected must equal ${qcPo.quantityQuintal} q`);
              return;
            }
            void act(
              () => purchases.qc(qcPo.id, { grade: qcGrade, acceptedQty: qcAccepted, rejectedQty: qcRejected, note: qcNote }),
              'QC recorded'
            );
            setQcPo(null);
          }}
          className="space-y-4"
        >
          <div>
            <label className={labelCls}>Grade</label>
            <div className="grid grid-cols-3 gap-2">
              {(['A', 'B', 'C'] as const).map((g) => (
                <button key={g} type="button" onClick={() => setQcGrade(g)} className={`p-2.5 rounded-xl border text-xs font-bold ${qcGrade === g ? 'bg-emerald-50 border-emerald-600 text-emerald-900' : 'border-slate-200 text-slate-700'}`}>
                  Grade {g}
                </button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Accepted Qty (q)</label>
              <input type="number" className={inputCls} value={qcAccepted} onChange={(e) => setQcAccepted(Number(e.target.value))} required />
            </div>
            <div>
              <label className={labelCls}>Rejected Qty (q)</label>
              <input
                type="number"
                className={inputCls}
                value={qcRejected}
                onChange={(e) => setQcRejected(Number(e.target.value))}
                onFocus={() => qcPo && setQcRejected(Math.max(0, qcPo.quantityQuintal - qcAccepted))}
              />
            </div>
          </div>
          <div>
            <label className={labelCls}>Inspection Note</label>
            <textarea rows={2} className={inputCls} value={qcNote} onChange={(e) => setQcNote(e.target.value)} />
          </div>
          <ErrorBanner message={actionError} />
          <button type="submit" className={`${primaryBtnCls} w-full py-3`}>Record QC</button>
        </form>
      </ModalSheet>

      {/* Pay balance */}
      <ModalSheet isOpen={Boolean(payPo)} onClose={() => setPayPo(null)} title="Pay Balance" maxWidth="sm">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!payPo) return;
            void act(() => purchases.pay(payPo.id, { amount: payAmt, kind: 'balance', method: 'bank_transfer' }), 'Balance paid');
            setPayPo(null);
          }}
          className="space-y-4"
        >
          <div>
            <label className={labelCls}>Amount (₹)</label>
            <input type="number" className={`${inputCls} font-bold text-emerald-800`} value={payAmt} onChange={(e) => setPayAmt(Number(e.target.value))} required />
          </div>
          <button type="submit" className={`${primaryBtnCls} w-full py-3`}>Pay Balance</button>
        </form>
      </ModalSheet>

      {/* Rate farmer */}
      <ModalSheet isOpen={Boolean(ratePo)} onClose={() => setRatePo(null)} title="Rate Farmer Partner" maxWidth="sm">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!ratePo) return;
            void act(() => purchases.rate(ratePo.id, { rating: rateStars, review: rateReview, target: 'farmer' }), 'Farmer rated');
            setRatePo(null);
          }}
          className="space-y-4"
        >
          <div className="flex justify-center gap-1.5">
            {[1, 2, 3, 4, 5].map((s) => (
              <button key={s} type="button" onClick={() => setRateStars(s)}>
                <Star className={`w-8 h-8 ${s <= rateStars ? 'fill-amber-400 text-amber-400' : 'text-slate-300'}`} />
              </button>
            ))}
          </div>
          <textarea rows={2} className={inputCls} value={rateReview} onChange={(e) => setRateReview(e.target.value)} placeholder="Review (optional)" />
          <button type="submit" className={`${primaryBtnCls} w-full py-3`}>Submit Rating</button>
        </form>
      </ModalSheet>

      {/* Dispute */}
      <ModalSheet isOpen={Boolean(disputePo)} onClose={() => setDisputePo(null)} title="Open Purchase Dispute" maxWidth="sm">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!disputePo) return;
            void act(
              () => purchases.openDispute(disputePo.id, { category: disputeCategory, reason: disputeReason }),
              'Dispute opened — escrow frozen pending review'
            );
            setDisputePo(null);
          }}
          className="space-y-4"
        >
          <div>
            <label className={labelCls}>Category</label>
            <select className={inputCls} value={disputeCategory} onChange={(e) => setDisputeCategory(e.target.value)}>
              <option value="quality">Quality</option>
              <option value="payment">Payment</option>
              <option value="delivery">Delivery</option>
              <option value="quantity">Quantity</option>
              <option value="other">Other</option>
            </select>
          </div>
          <div>
            <label className={labelCls}>Reason</label>
            <textarea rows={3} className={inputCls} value={disputeReason} onChange={(e) => setDisputeReason(e.target.value)} required />
          </div>
          <button type="submit" className={`${primaryBtnCls} w-full py-3 bg-rose-600 hover:bg-rose-700`}>Open Dispute</button>
        </form>
      </ModalSheet>
    </div>
  );
};
