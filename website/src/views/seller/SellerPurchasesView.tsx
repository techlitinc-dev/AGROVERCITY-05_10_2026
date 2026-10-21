import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FileCheck,
  Calendar,
  Clock,
  Truck,
  CheckCircle2,
  AlertTriangle,
  Download,
  Ban,
  RefreshCw,
  MapPin,
  User,
  Star,
  ChevronRight,
  ShieldCheck,
  Package,
  Layers,
  ArrowRight,
  MessageSquare,
  ShieldAlert,
  KeyRound,
  Landmark,
} from 'lucide-react';
import { purchases, pickup, post, apiErrorMessage } from '../../lib/api';
import { StatusBadge } from '../../components/common/StatusBadge';
import { ModalSheet } from '../../components/common/ModalSheet';
import { formatCurrency, formatWeight, formatDateTime } from '../../lib/utils';
import { cardCls, inputCls, labelCls, primaryBtnCls, ghostBtnCls, rec, arr, str, num, type Rec } from './shared';
import type { PurchaseOrder } from '../../types';

const STATUS_TABS = [
  { id: 'all', label: 'All Orders' },
  { id: 'confirmed', label: 'Needs Advance' },
  { id: 'advancePaid', label: 'Ready for Pickup' },
  { id: 'pickupScheduled', label: 'Pickup Scheduled' },
  { id: 'inTransit', label: 'In Transit' },
  { id: 'delivered', label: 'QC & Acceptance' },
  { id: 'completed', label: 'Completed' },
];

const QC_GRADES = ['Grade A', 'Grade B', 'Grade C', 'Rejected'];

export const SellerPurchasesView: React.FC = () => {
  const [purchaseList, setPurchaseList] = useState<PurchaseOrder[]>([]);
  const [activeTab, setActiveTab] = useState('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // Advance Modal
  const [advancePo, setAdvancePo] = useState<PurchaseOrder | null>(null);
  const [advanceAmount, setAdvanceAmount] = useState<number>(15000);
  const [advanceMethod, setAdvanceMethod] = useState('upi');
  const [advanceRef, setAdvanceRef] = useState('');
  const [advanceBusy, setAdvanceBusy] = useState(false);

  // Pickup Scheduling Modal
  const [pickupPo, setPickupPo] = useState<PurchaseOrder | null>(null);
  const [pickupAgents, setPickupAgents] = useState<Rec[]>([]);
  const [selectedAgentId, setSelectedAgentId] = useState('');
  const [pickupDate, setPickupDate] = useState('');
  const [pickupSlot, setPickupSlot] = useState('07:00-08:00');
  const [vehicleNumber, setVehicleNumber] = useState('MH-12-AB-1234');
  const [vehicleType, setVehicleType] = useState('Bolero Pickup');
  const [graceMinutes, setGraceMinutes] = useState(60);
  const [pickupAddress, setPickupAddress] = useState('');
  const [pickupBusy, setPickupBusy] = useState(false);

  // Digital QC Modal
  const [qcPo, setQcPo] = useState<PurchaseOrder | null>(null);
  const [qcGrade, setQcGrade] = useState('Grade A');
  const [qcAcceptedQty, setQcAcceptedQty] = useState<number>(0);
  const [qcRejectedQty, setQcRejectedQty] = useState<number>(0);
  const [qcNotes, setQcNotes] = useState('');
  const [qcBusy, setQcBusy] = useState(false);

  // Cancel Modal
  const [cancelPo, setCancelPo] = useState<PurchaseOrder | null>(null);
  const [cancelReason, setCancelReason] = useState('Crop failed moisture / foreign matter inspection threshold.');
  const [cancelBusy, setCancelBusy] = useState(false);

  // Full-Escrow Funding Modal (escrow/fund mirror of the advance)
  const [fundPo, setFundPo] = useState<PurchaseOrder | null>(null);
  const [fundAmount, setFundAmount] = useState(0);
  const [fundBusy, setFundBusy] = useState(false);

  // Handover OTP Verification Modal
  const [verifyPo, setVerifyPo] = useState<PurchaseOrder | null>(null);
  const [verifyOtp, setVerifyOtp] = useState('');
  const [verifyBusy, setVerifyBusy] = useState(false);

  // Balance Payment Modal
  const [payPo, setPayPo] = useState<PurchaseOrder | null>(null);
  const [payAmount, setPayAmount] = useState(0);
  const [payBusy, setPayBusy] = useState(false);

  // Dispute Modal
  const [disputePo, setDisputePo] = useState<PurchaseOrder | null>(null);
  const [disputeCategory, setDisputeCategory] = useState('quality');
  const [disputeReason, setDisputeReason] = useState('');
  const [disputeBusy, setDisputeBusy] = useState(false);

  const navigate = useNavigate();

  // Rating Modal
  const [ratingPo, setRatingPo] = useState<PurchaseOrder | null>(null);
  const [ratingStars, setRatingStars] = useState(5);
  const [ratingComment, setRatingComment] = useState('Honest weight and on-time farmgate handover.');
  const [ratingTags, setRatingTags] = useState<string[]>(['fair_price', 'on_time', 'honest_weight']);
  const [ratingBusy, setRatingBusy] = useState(false);

  const loadPurchases = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [list, ags] = await Promise.all([
        purchases.list().catch(() => []),
        pickup.agents().catch(() => []),
      ]);
      setPurchaseList(list);
      setPickupAgents(ags.map(rec));
    } catch (e) {
      setError(apiErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadPurchases();
  }, [loadPurchases]);

  const filtered = purchaseList.filter((p) => {
    if (activeTab === 'all') return true;
    return p.status === activeTab;
  });

  // Action: Advance Payment
  const handlePayAdvance = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!advancePo) return;
    setAdvanceBusy(true);
    setError(null);
    try {
      await purchases.advance(advancePo.id, {
        amount: advanceAmount,
        method: advanceMethod,
        reference: advanceRef || `upi_${Date.now()}`,
      });
      setNotice(`Advance escrow of ${formatCurrency(advanceAmount)} deposited for Purchase #${advancePo.id}!`);
      setAdvancePo(null);
      await loadPurchases();
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setAdvanceBusy(false);
    }
  };

  // Action: Pickup Scheduling
  const handleSchedulePickup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pickupPo) return;
    setPickupBusy(true);
    setError(null);
    try {
      const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];
      await purchases.pickup(pickupPo.id, {
        date: pickupDate || tomorrow,
        slot: pickupSlot,
        mode: 'buyerPicksup',
        agentId: selectedAgentId || (pickupAgents[0]?.id as string) || 'pa_sham',
        vehicleNumber: vehicleNumber || 'MH-12-AB-1234',
        vehicleType: vehicleType || 'Bolero Pickup',
        graceMinutes: Number(graceMinutes) || 60,
        address: pickupAddress || pickupPo.pickupAddress || 'Farmgate, Pune',
      });
      setNotice(`Pickup scheduled with agent on ${pickupDate || tomorrow} (${pickupSlot})! 24h & 2h FCM alerts active.`);
      setPickupPo(null);
      await loadPurchases();
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setPickupBusy(false);
    }
  };

  // Action: Digital QC
  const handleDigitalQc = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!qcPo) return;
    setQcBusy(true);
    setError(null);
    try {
      await purchases.qc(qcPo.id, {
        grade: qcGrade,
        acceptedQty: qcAcceptedQty,
        rejectedQty: qcRejectedQty,
        notes: qcNotes,
      });
      setNotice(`Digital QC recorded for Order #${qcPo.id}: ${qcGrade} (${qcAcceptedQty} Qt accepted).`);
      setQcPo(null);
      await loadPurchases();
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setQcBusy(false);
    }
  };

  // Action: Cancel
  const handleCancelBooking = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cancelPo) return;
    setCancelBusy(true);
    setError(null);
    try {
      await purchases.cancel(cancelPo.id, cancelReason);
      setNotice(`Purchase #${cancelPo.id} cancelled per trade policy. Escrow funds refunded.`);
      setCancelPo(null);
      await loadPurchases();
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setCancelBusy(false);
    }
  };

  // Action: Full escrow funding (escrow/fund — the advance endpoint now also
  // holds escrow, this funds the full booking total in one go)
  const handleFundEscrow = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fundPo) return;
    setFundBusy(true);
    setError(null);
    try {
      await purchases.escrowFund(fundPo.id, {
        amount: fundAmount,
        method: 'upi',
        reference: `upi_${Date.now()}`,
      });
      setNotice(`Full escrow of ${formatCurrency(fundAmount)} funded for Purchase #${fundPo.id} — handover OTP unlocked.`);
      setFundPo(null);
      await loadPurchases();
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setFundBusy(false);
    }
  };

  // Action: Verify farmer's handover OTP at physical handover
  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!verifyPo) return;
    setVerifyBusy(true);
    setError(null);
    try {
      await purchases.handoverVerify(verifyPo.id, verifyOtp);
      setNotice(`Handover OTP verified for Purchase #${verifyPo.id} — inspection (QC) is now unlocked.`);
      setVerifyPo(null);
      setVerifyOtp('');
      await loadPurchases();
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setVerifyBusy(false);
    }
  };

  // Action: Balance payment against the purchase
  const handlePayBalance = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!payPo) return;
    setPayBusy(true);
    setError(null);
    try {
      await purchases.pay(payPo.id, {
        amount: payAmount,
        kind: 'balance',
        method: 'bank_transfer',
        reference: `utr_${Date.now()}`,
      });
      setNotice(`Balance of ${formatCurrency(payAmount)} recorded for Purchase #${payPo.id}.`);
      setPayPo(null);
      await loadPurchases();
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setPayBusy(false);
    }
  };

  // Action: Open a purchase-scoped dispute (freezes the escrow clock)
  const handleOpenDispute = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!disputePo) return;
    setDisputeBusy(true);
    setError(null);
    try {
      await purchases.openDispute(disputePo.id, {
        category: disputeCategory,
        reason: disputeReason,
      });
      setNotice(`Dispute opened on Purchase #${disputePo.id} — escrow release is paused pending admin review.`);
      setDisputePo(null);
      setDisputeReason('');
      await loadPurchases();
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setDisputeBusy(false);
    }
  };

  // Quick lifecycle actions (dispatch / deliver) — direct with a notice
  const runAction = async (fn: () => Promise<unknown>, successMsg: string) => {
    setError(null);
    try {
      await fn();
      setNotice(successMsg);
      await loadPurchases();
    } catch (err) {
      setError(apiErrorMessage(err));
    }
  };

  // Trade-chat deep link: the purchase chat room opens post-acceptance
  const openTradeChat = async (po: PurchaseOrder) => {
    setError(null);
    try {
      const room = rec(await purchases.chatRoom(po.id));
      const roomId = str(room.roomId) || str(rec(room.room).id);
      if (roomId) navigate(`/chat?room=${encodeURIComponent(roomId)}`);
    } catch (err) {
      setError(apiErrorMessage(err));
    }
  };

  const paidTotal = (po: PurchaseOrder): number =>
    arr(rec(po as unknown as Rec).payments).reduce<number>(
      (sum, p) => sum + num(rec(p).amount),
      0
    );

  // Action: Rate Farmer
  const handleRateFarmer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ratingPo) return;
    setRatingBusy(true);
    setError(null);
    try {
      await post('/ratings', {
        bookingKind: 'purchase',
        bookingId: ratingPo.id,
        stars: ratingStars,
        comment: ratingComment,
        tags: ratingTags,
      });
      setNotice(`Rating and review submitted for Order #${ratingPo.id}!`);
      setRatingPo(null);
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setRatingBusy(false);
    }
  };

  const handleDownloadInvoice = async (poId: string) => {
    try {
      const blob = await purchases.invoicePdf(poId);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Invoice_${poId}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch (err) {
      setError(apiErrorMessage(err));
    }
  };

  const toggleRatingTag = (tag: string) => {
    setRatingTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <h1 className="text-2xl font-black text-slate-900 flex items-center gap-2.5">
            <FileCheck className="w-7 h-7 text-emerald-600" />
            My Produce Bookings & Procurement Lifecycle
          </h1>
          <p className="text-xs text-slate-500 mt-1 font-medium">
            Manage purchase lifecycle from advance escrow deposit, pickup scheduling with agents, digital QC, to invoice settlement.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void loadPurchases()}
          className={`${ghostBtnCls} flex items-center gap-1.5 text-xs font-bold`}
        >
          <RefreshCw className="w-3.5 h-3.5" /> Refresh Orders
        </button>
      </div>

      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl text-xs font-semibold text-rose-800 flex items-center justify-between">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="text-rose-600 hover:underline">Dismiss</button>
        </div>
      )}

      {notice && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl text-xs font-semibold text-emerald-800 flex items-center justify-between">
          <span className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            {notice}
          </span>
          <button onClick={() => setNotice(null)} className="font-bold hover:underline">Dismiss</button>
        </div>
      )}

      {/* Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 border-b border-slate-200 text-xs font-bold">
        {STATUS_TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setActiveTab(t.id)}
            className={`px-3.5 py-2 rounded-xl whitespace-nowrap transition-all ${
              activeTab === t.id
                ? 'bg-emerald-600 text-white shadow-sm shadow-emerald-600/20'
                : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Bookings List */}
      {loading ? (
        <div className="py-20 text-center text-xs font-bold text-slate-400 animate-pulse">
          Loading procurement orders…
        </div>
      ) : filtered.length === 0 ? (
        <div className={`${cardCls} py-16 text-center space-y-3`}>
          <Package className="w-10 h-10 text-slate-300 mx-auto" />
          <h3 className="text-sm font-bold text-slate-800">No Orders in this Status</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            Book produce lots from the discovery catalog or check other lifecycle filters.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filtered.map((po) => {
            const poRec = po as unknown as Rec;
            const pickupDetails = rec(poRec.pickup);
            const qcDetails = rec(poRec.qc);
            const escrowHeld = str(rec(poRec.escrow).status) === 'held';
            const handoverVerified = Boolean(str(rec(poRec.handover).verifiedAt));
            const balanceDue = Math.max(0, po.totalAmount - paidTotal(po));

            return (
              <div key={po.id} className={`${cardCls} space-y-4 hover:border-slate-300 transition-all`}>
                {/* Header row */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-xs font-black text-slate-800 bg-slate-100 px-2.5 py-1 rounded-xl">
                      #{po.id}
                    </span>
                    <div>
                      <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
                        {po.crop}
                        <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">
                          {str(poRec.variety) || 'Standard'}
                        </span>
                      </h3>
                      <p className="text-[11px] text-slate-400">Created {po.createdAt ? formatDateTime(po.createdAt) : 'Recently'}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <div className="text-sm font-black text-slate-900">{formatCurrency(po.totalAmount)}</div>
                      <div className="text-[10px] text-slate-400 font-semibold">
                        {po.quantityQuintal} Qt @ {formatCurrency(po.agreedPricePerQuintal)}/q
                      </div>
                    </div>
                    <StatusBadge status={po.status} />
                  </div>
                </div>

                {/* Lifecycle Stepper */}
                <div className="py-2">
                  <div className="grid grid-cols-5 text-center text-[10px] font-bold text-slate-400 gap-1 relative">
                    <div className={`p-2 rounded-xl border ${['confirmed', 'advancePaid', 'pickupScheduled', 'inTransit', 'delivered', 'completed'].includes(po.status) ? 'bg-emerald-50 text-emerald-800 border-emerald-200' : 'bg-slate-50 border-slate-200'}`}>
                      1. Confirmed
                    </div>
                    <div className={`p-2 rounded-xl border ${['advancePaid', 'pickupScheduled', 'inTransit', 'delivered', 'completed'].includes(po.status) ? 'bg-emerald-50 text-emerald-800 border-emerald-200' : 'bg-slate-50 border-slate-200'}`}>
                      2. Advance Paid
                    </div>
                    <div className={`p-2 rounded-xl border ${['pickupScheduled', 'inTransit', 'delivered', 'completed'].includes(po.status) ? 'bg-emerald-50 text-emerald-800 border-emerald-200' : 'bg-slate-50 border-slate-200'}`}>
                      3. Pickup Set
                    </div>
                    <div className={`p-2 rounded-xl border ${['inTransit', 'delivered', 'completed'].includes(po.status) ? 'bg-emerald-50 text-emerald-800 border-emerald-200' : 'bg-slate-50 border-slate-200'}`}>
                      4. Dispatched
                    </div>
                    <div className={`p-2 rounded-xl border ${['delivered', 'completed'].includes(po.status) ? 'bg-emerald-50 text-emerald-800 border-emerald-200' : 'bg-slate-50 border-slate-200'}`}>
                      5. QC & Settled
                    </div>
                  </div>
                </div>

                {/* Pickup details badge if scheduled */}
                {Boolean(pickupDetails.slot) && (
                  <div className="p-3 bg-amber-50 rounded-2xl border border-amber-200 flex flex-wrap items-center justify-between gap-2 text-xs text-amber-900">
                    <div className="flex items-center gap-2">
                      <Truck className="w-4 h-4 text-amber-700" />
                      <span>
                        <strong>Pickup Scheduled:</strong> {str(pickupDetails.date)} ({str(pickupDetails.slot)}) with Agent #{str(pickupDetails.agentId)}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-[11px] font-bold text-amber-800">
                      <span>Vehicle: {str(pickupDetails.vehicleNumber)}</span>
                      <span>Grace: {num(pickupDetails.graceMinutes)} mins</span>
                      <span className="bg-amber-200 text-amber-900 px-2 py-0.5 rounded-full text-[10px]">FCM 24h/2h Armed</span>
                    </div>
                  </div>
                )}

                {/* QC details badge if inspected */}
                {Boolean(qcDetails.grade) && (
                  <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200 flex items-center justify-between text-xs text-slate-800">
                    <span className="flex items-center gap-2">
                      <ShieldCheck className="w-4 h-4 text-emerald-600" />
                      <strong>Digital QC Passed:</strong> {str(qcDetails.grade)} — {num(qcDetails.acceptedQty)} Quintals accepted
                    </span>
                    <span className="text-[11px] text-slate-500 font-semibold">{str(qcDetails.notes)}</span>
                  </div>
                )}

                {/* Escrow status badge */}
                {str(rec(poRec.escrow).status) !== '' && str(rec(poRec.escrow).status) !== 'unfunded' && (
                  <div className={`p-3 rounded-2xl border flex flex-wrap items-center justify-between gap-2 text-xs ${
                    escrowHeld
                      ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                      : 'bg-slate-50 border-slate-200 text-slate-700'
                  }`}>
                    <span className="flex items-center gap-2">
                      <Landmark className={`w-4 h-4 ${escrowHeld ? 'text-emerald-700' : 'text-slate-500'}`} />
                      <strong>Escrow {str(rec(poRec.escrow).status)}:</strong>{' '}
                      {formatCurrency(num(rec(poRec.escrow).amount))}
                      {escrowHeld && !handoverVerified && po.status !== 'cancelled' && ' · awaiting handover OTP'}
                      {escrowHeld && handoverVerified && ' · handover OTP verified'}
                    </span>
                    {balanceDue > 0 && !['completed', 'cancelled'].includes(po.status) && (
                      <span className="text-[11px] font-bold">Balance due: {formatCurrency(balanceDue)}</span>
                    )}
                  </div>
                )}

                {/* Bottom Action Buttons */}
                <div className="flex flex-wrap items-center justify-end gap-2 pt-2 border-t border-slate-100">
                  {po.status === 'confirmed' && (
                    <button
                      type="button"
                      onClick={() => {
                        setAdvancePo(po);
                        setAdvanceAmount(Math.round(po.totalAmount * 0.15));
                      }}
                      className={`${primaryBtnCls} text-xs font-black px-4 py-2`}
                    >
                      Deposit Advance Escrow
                    </button>
                  )}

                  {po.status === 'confirmed' && (
                    <button
                      type="button"
                      onClick={() => {
                        setFundPo(po);
                        setFundAmount(po.totalAmount);
                      }}
                      className={`${ghostBtnCls} text-xs font-bold px-3 py-2 flex items-center gap-1.5 text-emerald-700 border-emerald-200 hover:bg-emerald-50`}
                    >
                      <Landmark className="w-3.5 h-3.5" /> Fund Full Escrow
                    </button>
                  )}

                  {po.status === 'advancePaid' && (
                    <button
                      type="button"
                      onClick={() => {
                        setPickupPo(po);
                        const tmrw = new Date(Date.now() + 86400000).toISOString().split('T')[0];
                        setPickupDate(tmrw);
                      }}
                      className={`${primaryBtnCls} text-xs font-black px-4 py-2 flex items-center gap-1.5`}
                    >
                      <Truck className="w-3.5 h-3.5" /> Schedule Pickup Slot & Agent
                    </button>
                  )}

                  {po.status === 'pickupScheduled' && (
                    <button
                      type="button"
                      onClick={() => void runAction(() => purchases.dispatch(po.id), `Purchase #${po.id} marked dispatched — vehicle is in transit.`)}
                      className={`${primaryBtnCls} text-xs font-black px-4 py-2 flex items-center gap-1.5`}
                    >
                      <Truck className="w-3.5 h-3.5" /> Mark Dispatch
                    </button>
                  )}

                  {po.status === 'inTransit' && (
                    <button
                      type="button"
                      onClick={() => void runAction(() => purchases.deliver(po.id), `Purchase #${po.id} marked delivered — ask the farmer for the handover OTP.`)}
                      className={`${primaryBtnCls} text-xs font-black px-4 py-2 flex items-center gap-1.5`}
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" /> Mark Delivered
                    </button>
                  )}

                  {po.status === 'delivered' && escrowHeld && !handoverVerified && (
                    <button
                      type="button"
                      onClick={() => {
                        setVerifyPo(po);
                        setVerifyOtp('');
                      }}
                      className={`${primaryBtnCls} text-xs font-black px-4 py-2 flex items-center gap-1.5`}
                    >
                      <KeyRound className="w-3.5 h-3.5" /> Verify Handover OTP
                    </button>
                  )}

                  {po.status === 'delivered' && !(escrowHeld && !handoverVerified) && (
                    <button
                      type="button"
                      onClick={() => {
                        setQcPo(po);
                        setQcAcceptedQty(po.quantityQuintal);
                        setQcRejectedQty(0);
                      }}
                      className={`${primaryBtnCls} text-xs font-black px-4 py-2`}
                    >
                      Conduct Digital QC Inspection
                    </button>
                  )}

                  {['completed', 'delivered'].includes(po.status) && (
                    <button
                      type="button"
                      onClick={() => handleDownloadInvoice(po.id)}
                      className={`${ghostBtnCls} text-xs font-bold px-3 py-2 flex items-center gap-1.5`}
                    >
                      <Download className="w-3.5 h-3.5" /> Invoice (PDF)
                    </button>
                  )}

                  {po.status === 'completed' && balanceDue > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        setPayPo(po);
                        setPayAmount(balanceDue);
                      }}
                      className={`${primaryBtnCls} text-xs font-black px-4 py-2 flex items-center gap-1.5`}
                    >
                      <Landmark className="w-3.5 h-3.5" /> Pay Balance {formatCurrency(balanceDue)}
                    </button>
                  )}

                  {po.status === 'completed' && (
                    <button
                      type="button"
                      onClick={() => setRatingPo(po)}
                      className={`${ghostBtnCls} text-xs font-bold px-3 py-2 flex items-center gap-1.5 text-amber-600`}
                    >
                      <Star className="w-3.5 h-3.5 fill-amber-500" /> Rate Farmer
                    </button>
                  )}

                  {!['completed', 'cancelled'].includes(po.status) && (
                    <button
                      type="button"
                      onClick={() => {
                        setDisputePo(po);
                        setDisputeReason('');
                      }}
                      className="px-3 py-2 text-xs font-bold text-amber-700 hover:bg-amber-50 rounded-xl transition-all flex items-center gap-1.5"
                    >
                      <ShieldAlert className="w-3.5 h-3.5" /> Dispute
                    </button>
                  )}

                  {['confirmed', 'advancePaid', 'pickupScheduled'].includes(po.status) && (
                    <button
                      type="button"
                      onClick={() => setCancelPo(po)}
                      className="px-3 py-2 text-xs font-bold text-rose-600 hover:bg-rose-50 rounded-xl transition-all"
                    >
                      Cancel Per Policy
                    </button>
                  )}

                  {po.status !== 'cancelled' && (
                    <button
                      type="button"
                      onClick={() => void openTradeChat(po)}
                      className={`${ghostBtnCls} text-xs font-bold px-3 py-2 flex items-center gap-1.5`}
                    >
                      <MessageSquare className="w-3.5 h-3.5" /> Chat
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Advance Modal */}
      {advancePo && (
        <ModalSheet title={`Pay Advance Escrow — Order #${advancePo.id}`} isOpen={!!advancePo} onClose={() => setAdvancePo(null)}>
          <form onSubmit={handlePayAdvance} className="space-y-4">
            <p className="text-xs text-slate-500">
              Total Order: <strong>{formatCurrency(advancePo.totalAmount)}</strong> for {advancePo.quantityQuintal} Qt of {advancePo.crop}.
              Advance escrow secures the lot and alerts the farmer to pack produce.
            </p>

            <div>
              <label className={labelCls}>Advance Amount (₹) *</label>
              <input
                type="number"
                required
                min={100}
                max={advancePo.totalAmount}
                value={advanceAmount}
                onChange={(e) => setAdvanceAmount(Number(e.target.value))}
                className={inputCls}
              />
            </div>

            <div>
              <label className={labelCls}>Payment Channel</label>
              <select
                value={advanceMethod}
                onChange={(e) => setAdvanceMethod(e.target.value)}
                className={inputCls}
              >
                <option value="upi">UPI Escrow (Instant)</option>
                <option value="netbanking">NEFT / RTGS Bank Transfer</option>
                <option value="wallet">Kisan Setu Escrow Wallet</option>
              </select>
            </div>

            <div>
              <label className={labelCls}>Transaction / UPI UTR Reference</label>
              <input
                type="text"
                placeholder="UPI-1234567890"
                value={advanceRef}
                onChange={(e) => setAdvanceRef(e.target.value)}
                className={inputCls}
              />
            </div>

            <div className="flex justify-end gap-2 pt-3">
              <button
                type="button"
                onClick={() => setAdvancePo(null)}
                className={`${ghostBtnCls} text-xs font-bold`}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={advanceBusy}
                className={`${primaryBtnCls} text-xs font-black px-5`}
              >
                {advanceBusy ? 'Processing Escrow…' : 'Deposit Escrow Funds'}
              </button>
            </div>
          </form>
        </ModalSheet>
      )}

      {/* Pickup Scheduling Modal */}
      {pickupPo && (
        <ModalSheet title={`Schedule Pickup & Logistics — Order #${pickupPo.id}`} isOpen={!!pickupPo} onClose={() => setPickupPo(null)}>
          <form onSubmit={handleSchedulePickup} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className={labelCls}>Pickup Date *</label>
                <input
                  type="date"
                  required
                  value={pickupDate}
                  onChange={(e) => setPickupDate(e.target.value)}
                  className={inputCls}
                />
              </div>

              <div>
                <label className={labelCls}>Time Slot *</label>
                <select
                  value={pickupSlot}
                  onChange={(e) => setPickupSlot(e.target.value)}
                  className={inputCls}
                >
                  <option value="06:00-07:00">Early Morning (06:00 - 07:00 AM)</option>
                  <option value="07:00-08:00">Morning Shift (07:00 - 08:00 AM)</option>
                  <option value="09:00-11:00">Mid-Morning (09:00 - 11:00 AM)</option>
                  <option value="14:00-16:00">Afternoon (02:00 - 04:00 PM)</option>
                  <option value="17:00-19:00">Evening Shift (05:00 - 07:00 PM)</option>
                </select>
              </div>

              <div>
                <label className={labelCls}>Assign Certified Pickup Agent</label>
                <select
                  value={selectedAgentId}
                  onChange={(e) => setSelectedAgentId(e.target.value)}
                  className={inputCls}
                >
                  {pickupAgents.map((ag) => (
                    <option key={str(ag.id)} value={str(ag.id)}>
                      {str(ag.name)} ({str(ag.vehicleType)} - {str(ag.vehicleNumber)})
                    </option>
                  ))}
                  <option value="pa_sham">Sham (Bolero Pickup - MH-12-AB-1234)</option>
                  <option value="pa_suresh">Suresh Patil (Tata Ace - MH-15-CD-5678)</option>
                </select>
              </div>

              <div>
                <label className={labelCls}>Grace Window (Minutes)</label>
                <select
                  value={graceMinutes}
                  onChange={(e) => setGraceMinutes(Number(e.target.value))}
                  className={inputCls}
                >
                  <option value={30}>30 Minutes</option>
                  <option value={60}>60 Minutes (Standard)</option>
                  <option value={120}>120 Minutes (Long Radius)</option>
                </select>
              </div>

              <div>
                <label className={labelCls}>Vehicle Number</label>
                <input
                  type="text"
                  value={vehicleNumber}
                  onChange={(e) => setVehicleNumber(e.target.value.toUpperCase())}
                  className={inputCls}
                />
              </div>

              <div>
                <label className={labelCls}>Vehicle Type</label>
                <input
                  type="text"
                  value={vehicleType}
                  onChange={(e) => setVehicleType(e.target.value)}
                  className={inputCls}
                />
              </div>
            </div>

            <div>
              <label className={labelCls}>Pickup Farmgate Address</label>
              <input
                type="text"
                value={pickupAddress}
                onChange={(e) => setPickupAddress(e.target.value)}
                placeholder="Farmgate, Khed, Pune"
                className={inputCls}
              />
            </div>

            <div className="p-3 bg-emerald-50 rounded-2xl border border-emerald-200 text-xs text-emerald-900">
              ✓ Automated 24-hour and 2-hour departure FCM notifications will be triggered deterministically for both farmer and pickup agent.
            </div>

            <div className="flex justify-end gap-2 pt-3">
              <button
                type="button"
                onClick={() => setPickupPo(null)}
                className={`${ghostBtnCls} text-xs font-bold`}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={pickupBusy}
                className={`${primaryBtnCls} text-xs font-black px-5`}
              >
                {pickupBusy ? 'Dispatching Schedule…' : 'Confirm Pickup Slot'}
              </button>
            </div>
          </form>
        </ModalSheet>
      )}

      {/* Digital QC Inspection Modal */}
      {qcPo && (
        <ModalSheet title={`Digital QC Inspection — Order #${qcPo.id}`} isOpen={!!qcPo} onClose={() => setQcPo(null)}>
          <form onSubmit={handleDigitalQc} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className={labelCls}>Assigned QC Grade</label>
                <select
                  value={qcGrade}
                  onChange={(e) => setQcGrade(e.target.value)}
                  className={inputCls}
                >
                  {QC_GRADES.map((g) => (
                    <option key={g} value={g}>{g}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className={labelCls}>Accepted Qty (Quintals) *</label>
                <input
                  type="number"
                  step="0.1"
                  required
                  value={qcAcceptedQty}
                  onChange={(e) => setQcAcceptedQty(Number(e.target.value))}
                  className={inputCls}
                />
              </div>

              <div>
                <label className={labelCls}>Rejected Qty (Quintals)</label>
                <input
                  type="number"
                  step="0.1"
                  value={qcRejectedQty}
                  onChange={(e) => setQcRejectedQty(Number(e.target.value))}
                  className={inputCls}
                />
              </div>
            </div>

            <div>
              <label className={labelCls}>Inspection Notes & Defect Observation</label>
              <textarea
                rows={3}
                value={qcNotes}
                onChange={(e) => setQcNotes(e.target.value)}
                placeholder="Moisture 11%, zero fungal damage, grain lustre compliant with Grade A APMC standards."
                className={inputCls}
              />
            </div>

            <div className="flex justify-end gap-2 pt-3">
              <button
                type="button"
                onClick={() => setQcPo(null)}
                className={`${ghostBtnCls} text-xs font-bold`}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={qcBusy}
                className={`${primaryBtnCls} text-xs font-black px-5`}
              >
                {qcBusy ? 'Submitting QC…' : 'Approve & Release Settlement'}
              </button>
            </div>
          </form>
        </ModalSheet>
      )}

      {/* Cancel Order Modal */}
      {cancelPo && (
        <ModalSheet title={`Cancel Purchase Order #${cancelPo.id}`} isOpen={!!cancelPo} onClose={() => setCancelPo(null)}>
          <form onSubmit={handleCancelBooking} className="space-y-4">
            <p className="text-xs text-rose-700 bg-rose-50 p-3 rounded-2xl border border-rose-200">
              Orders can be cancelled prior to vehicle pickup dispatch without penal escrow forfeiture.
            </p>

            <div>
              <label className={labelCls}>Cancellation Reason</label>
              <textarea
                rows={3}
                required
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                className={inputCls}
              />
            </div>

            <div className="flex justify-end gap-2 pt-3">
              <button
                type="button"
                onClick={() => setCancelPo(null)}
                className={`${ghostBtnCls} text-xs font-bold`}
              >
                Go Back
              </button>
              <button
                type="submit"
                disabled={cancelBusy}
                className="px-4 py-2 text-xs font-black rounded-xl bg-rose-600 text-white hover:bg-rose-700 transition-all"
              >
                {cancelBusy ? 'Cancelling…' : 'Confirm Cancellation'}
              </button>
            </div>
          </form>
        </ModalSheet>
      )}

      {/* Full Escrow Funding Modal */}
      {fundPo && (
        <ModalSheet title={`Fund Full Escrow — Order #${fundPo.id}`} isOpen={!!fundPo} onClose={() => setFundPo(null)}>
          <form onSubmit={handleFundEscrow} className="space-y-4">
            <p className="text-xs text-slate-500">
              Funds the entire <strong>{formatCurrency(fundPo.totalAmount)}</strong> into platform escrow for {fundPo.crop}.
              Held escrow unlocks the farmer's handover OTP — the QC gate then applies.
            </p>

            <div>
              <label className={labelCls}>Escrow Amount (₹) *</label>
              <input
                type="number"
                required
                min={1}
                max={fundPo.totalAmount}
                value={fundAmount}
                onChange={(e) => setFundAmount(Number(e.target.value))}
                className={inputCls}
              />
            </div>

            <div className="flex justify-end gap-2 pt-3">
              <button
                type="button"
                onClick={() => setFundPo(null)}
                className={`${ghostBtnCls} text-xs font-bold`}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={fundBusy}
                className={`${primaryBtnCls} text-xs font-black px-5`}
              >
                {fundBusy ? 'Holding Funds…' : 'Confirm & Hold in Escrow'}
              </button>
            </div>
          </form>
        </ModalSheet>
      )}

      {/* Handover OTP Verification Modal */}
      {verifyPo && (
        <ModalSheet title={`Verify Handover OTP — Order #${verifyPo.id}`} isOpen={!!verifyPo} onClose={() => setVerifyPo(null)}>
          <form onSubmit={handleVerifyOtp} className="space-y-4">
            <p className="text-xs text-slate-500">
              Enter the 6-digit OTP the farmer reveals at the farmgate (valid 15 minutes, single use).
              Verification starts the escrow release clock and unlocks digital QC.
            </p>

            <div>
              <label className={labelCls}>Handover OTP *</label>
              <input
                type="text"
                inputMode="numeric"
                maxLength={6}
                required
                value={verifyOtp}
                onChange={(e) => setVerifyOtp(e.target.value.replace(/\D/g, ''))}
                placeholder="••••••"
                className={`${inputCls} text-center text-2xl font-black tracking-[0.5em] font-mono`}
              />
            </div>

            <div className="flex justify-end gap-2 pt-3">
              <button
                type="button"
                onClick={() => setVerifyPo(null)}
                className={`${ghostBtnCls} text-xs font-bold`}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={verifyBusy || verifyOtp.length !== 6}
                className={`${primaryBtnCls} text-xs font-black px-5`}
              >
                {verifyBusy ? 'Verifying…' : 'Verify Handover'}
              </button>
            </div>
          </form>
        </ModalSheet>
      )}

      {/* Balance Payment Modal */}
      {payPo && (
        <ModalSheet title={`Pay Balance — Order #${payPo.id}`} isOpen={!!payPo} onClose={() => setPayPo(null)}>
          <form onSubmit={handlePayBalance} className="space-y-4">
            <p className="text-xs text-slate-500">
              Records the remaining balance for {payPo.crop} via bank transfer (UTR reference auto-generated).
            </p>

            <div>
              <label className={labelCls}>Amount (₹) *</label>
              <input
                type="number"
                required
                min={1}
                max={Math.max(0, payPo.totalAmount - paidTotal(payPo))}
                value={payAmount}
                onChange={(e) => setPayAmount(Number(e.target.value))}
                className={inputCls}
              />
              <p className="text-[10px] text-slate-400 mt-1">
                Outstanding balance: {formatCurrency(Math.max(0, payPo.totalAmount - paidTotal(payPo)))}
              </p>
            </div>

            <div className="flex justify-end gap-2 pt-3">
              <button
                type="button"
                onClick={() => setPayPo(null)}
                className={`${ghostBtnCls} text-xs font-bold`}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={payBusy}
                className={`${primaryBtnCls} text-xs font-black px-5`}
              >
                {payBusy ? 'Recording Payment…' : 'Confirm Balance Payment'}
              </button>
            </div>
          </form>
        </ModalSheet>
      )}

      {/* Dispute Modal */}
      {disputePo && (
        <ModalSheet title={`Open Dispute — Order #${disputePo.id}`} isOpen={!!disputePo} onClose={() => setDisputePo(null)}>
          <form onSubmit={handleOpenDispute} className="space-y-4">
            <p className="text-xs text-amber-800 bg-amber-50 p-3 rounded-2xl border border-amber-200">
              A dispute freezes the escrow release clock and lands in the admin triage queue. Either trade party can add photo evidence afterwards.
            </p>

            <div>
              <label className={labelCls}>Dispute Category</label>
              <select
                value={disputeCategory}
                onChange={(e) => setDisputeCategory(e.target.value)}
                className={inputCls}
              >
                <option value="quality">Quality</option>
                <option value="payment">Payment</option>
                <option value="delivery">Delivery</option>
                <option value="quantity">Quantity</option>
                <option value="other">Other</option>
              </select>
            </div>

            <div>
              <label className={labelCls}>Reason *</label>
              <textarea
                rows={3}
                required
                value={disputeReason}
                onChange={(e) => setDisputeReason(e.target.value)}
                placeholder="Describe the issue — e.g. 2 quintals rejected for moisture above 14%."
                className={inputCls}
              />
            </div>

            <div className="flex justify-end gap-2 pt-3">
              <button
                type="button"
                onClick={() => setDisputePo(null)}
                className={`${ghostBtnCls} text-xs font-bold`}
              >
                Go Back
              </button>
              <button
                type="submit"
                disabled={disputeBusy}
                className="px-4 py-2 text-xs font-black rounded-xl bg-amber-600 text-white hover:bg-amber-700 transition-all"
              >
                {disputeBusy ? 'Opening…' : 'Open Dispute & Freeze Escrow'}
              </button>
            </div>
          </form>
        </ModalSheet>
      )}

      {/* Rate Farmer Modal */}
      {ratingPo && (
        <ModalSheet title={`Rate Farmer for Order #${ratingPo.id}`} isOpen={!!ratingPo} onClose={() => setRatingPo(null)}>
          <form onSubmit={handleRateFarmer} className="space-y-4">
            <div>
              <label className={labelCls}>Star Rating (1 to 5 Stars)</label>
              <div className="flex items-center gap-2 mt-2">
                {[1, 2, 3, 4, 5].map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setRatingStars(s)}
                    className="p-1 hover:scale-110 transition-transform"
                  >
                    <Star
                      className={`w-6 h-6 ${
                        s <= ratingStars ? 'text-amber-500 fill-amber-500' : 'text-slate-300'
                      }`}
                    />
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className={labelCls}>Review Tags</label>
              <div className="flex flex-wrap gap-2 mt-2">
                {[
                  { id: 'fair_price', label: 'Fair Price' },
                  { id: 'on_time', label: 'On-Time Handover' },
                  { id: 'honest_weight', label: 'Honest Weight' },
                  { id: 'quality_produce', label: 'Quality Produce' },
                  { id: 'proper_packing', label: 'Proper Gunny Packing' },
                ].map((t) => {
                  const active = ratingTags.includes(t.id);
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => toggleRatingTag(t.id)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all ${
                        active
                          ? 'bg-amber-500 text-white border-amber-500 shadow-sm'
                          : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      {active ? '✓ ' : '+ '}
                      {t.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <label className={labelCls}>Review Comment</label>
              <textarea
                rows={3}
                value={ratingComment}
                onChange={(e) => setRatingComment(e.target.value)}
                className={inputCls}
              />
            </div>

            <div className="flex justify-end gap-2 pt-3">
              <button
                type="button"
                onClick={() => setRatingPo(null)}
                className={`${ghostBtnCls} text-xs font-bold`}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={ratingBusy}
                className={`${primaryBtnCls} text-xs font-black px-5`}
              >
                {ratingBusy ? 'Submitting…' : 'Submit Review'}
              </button>
            </div>
          </form>
        </ModalSheet>
      )}
    </div>
  );
};
