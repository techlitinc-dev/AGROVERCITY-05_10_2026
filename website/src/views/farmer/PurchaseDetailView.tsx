import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  FileCheck,
  ArrowLeft,
  Building2,
  CheckCircle2,
  QrCode,
  Truck,
  PackageCheck,
  ShieldAlert,
  Scale,
  Star,
  Ban,
  Download,
  Receipt,
  Gavel,
  MessageSquare,
  Wallet,
  Camera,
  AlertTriangle,
  HandCoins,
} from 'lucide-react';
import { purchases, uploads, apiErrorMessage } from '../../lib/api';
import { StatusBadge } from '../../components/common/StatusBadge';
import { GateOtpModal } from '../../components/common/GateOtpModal';
import { ModalSheet } from '../../components/common/ModalSheet';
import { formatCurrency, formatWeight, formatDateTime } from '../../lib/utils';
import type { PurchaseOrder } from '../../types';

const asRecord = (v: unknown): Record<string, unknown> =>
  v !== null && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
const asArray = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const asStr = (v: unknown, fallback = ''): string => (typeof v === 'string' ? v : fallback);

type ActionKind =
  | 'advance'
  | 'pickup'
  | 'dispatch'
  | 'deliver'
  | 'resolve'
  | 'pay'
  | 'cancel'
  | 'escrow'
  | 'verifyOtp'
  | null;

export const PurchaseDetailView: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [po, setPo] = useState<PurchaseOrder | null>(null);
  const [disputes, setDisputes] = useState<unknown[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [chatRoomId, setChatRoomId] = useState<string | null>(null);

  // Modals
  const [otpModalOpen, setOtpModalOpen] = useState(false);
  const [gateOtp, setGateOtp] = useState<string>('');
  const [actionModal, setActionModal] = useState<ActionKind>(null);
  const [qcModalOpen, setQcModalOpen] = useState(false);
  const [disputeModalOpen, setDisputeModalOpen] = useState(false);
  const [rateModalOpen, setRateModalOpen] = useState(false);

  // Form states
  const [pickupDate, setPickupDate] = useState('');
  const [pickupAddress, setPickupAddress] = useState('');
  const [resolveNote, setResolveNote] = useState('');
  const [cancelReason, setCancelReason] = useState('');
  const [escrowAmount, setEscrowAmount] = useState<number>(0);
  const [advanceAmount, setAdvanceAmount] = useState<number>(0);
  const [advanceReason, setAdvanceReason] = useState('');
  const [verifyOtpInput, setVerifyOtpInput] = useState('');
  const [disputeReason, setDisputeReason] = useState('');
  const [disputeAmount, setDisputeAmount] = useState<number>(0);
  const [ratingScore, setRatingScore] = useState(5);
  const [ratingReview, setRatingReview] = useState('');
  const [qcGrade, setQcGrade] = useState<'A' | 'B' | 'C' | 'Rejected'>('A');
  const [qcNotes, setQcNotes] = useState('');
  const [qcPhotoUrls, setQcPhotoUrls] = useState<string[]>([]);
  const [qcBusy, setQcBusy] = useState(false);
  const qcFileRef = useRef<HTMLInputElement | null>(null);

  const reload = useCallback(async () => {
    if (!id) return;
    const [detail, disputeList] = await Promise.all([
      purchases.get(id),
      purchases.disputes(id).catch(() => []),
    ]);
    setPo(detail);
    setDisputes(disputeList);
    if (detail.advanceAmount && escrowAmount === 0) setEscrowAmount(detail.advanceAmount);
    if (detail.advanceAmount && advanceAmount === 0) setAdvanceAmount(detail.advanceAmount);
    if (detail.pickupAddress && !pickupAddress) setPickupAddress(detail.pickupAddress);
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    let active = true;
    setLoading(true);
    reload()
      .catch((e) => active && setError(apiErrorMessage(e)))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [reload]);

  const run = async (fn: () => Promise<unknown>, successMessage: string) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
      await reload();
      setNotice(successMessage);
      setActionModal(null);
    } catch (e) {
      setError(apiErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  if (!id) return null;

  const showHandoverOtp = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await purchases.handoverOtp(id);
      setGateOtp(asStr(asRecord(res).otp, ''));
      setOtpModalOpen(true);
    } catch (e) {
      setError(apiErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const handleInvoicePdf = async () => {
    setError(null);
    try {
      const blob = await purchases.invoicePdf(id);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `invoice-${po?.invoiceNumber ?? id}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError(apiErrorMessage(e));
    }
  };

  const handleQcPhoto = async (file: File | undefined) => {
    if (!file) return;
    setQcBusy(true);
    setError(null);
    try {
      const uploaded = (await uploads.upload(file, { folder: 'qc', purpose: 'purchase-qc' })) as {
        url?: string;
        fileUrl?: string;
      };
      const url = uploaded?.url ?? uploaded?.fileUrl ?? '';
      if (url) setQcPhotoUrls((prev) => [...prev, url]);
    } catch (e) {
      setError(apiErrorMessage(e));
    } finally {
      setQcBusy(false);
      if (qcFileRef.current) qcFileRef.current.value = '';
    }
  };

  const handleSubmitQc = async () => {
    setQcBusy(true);
    setError(null);
    try {
      await purchases.qc(id, { grade: qcGrade, notes: qcNotes, photos: qcPhotoUrls });
      if (qcPhotoUrls.length > 0) {
        await purchases.qcPhotos(id, { photoUrls: qcPhotoUrls });
      }
      await reload();
      setQcModalOpen(false);
      setQcPhotoUrls([]);
      setNotice('QC inspection submitted.');
    } catch (e) {
      setError(apiErrorMessage(e));
    } finally {
      setQcBusy(false);
    }
  };

  const handleRaiseDispute = async () => {
    setBusy(true);
    setError(null);
    try {
      await purchases.openDispute(id, {
        reason: disputeReason,
        amount: disputeAmount > 0 ? disputeAmount : undefined,
      });
      const list = await purchases.disputes(id).catch(() => []);
      setDisputes(list);
      setDisputeModalOpen(false);
      setDisputeReason('');
      setNotice('Dispute raised. The settlement desk will review within 24 hours.');
    } catch (e) {
      setError(apiErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const handleOpenChat = async () => {
    setError(null);
    try {
      const room = asRecord(await purchases.chatRoom(id));
      const roomId = asStr(room.roomId ?? room.id);
      setChatRoomId(roomId);
      navigate(`/chat?room=${encodeURIComponent(roomId)}`);
    } catch (e) {
      setError(apiErrorMessage(e));
    }
  };

  const handleRate = async () => {
    setBusy(true);
    setError(null);
    try {
      await purchases.rate(id, { rating: ratingScore, review: ratingReview, target: 'buyer' });
      await reload();
      setRateModalOpen(false);
      setNotice('Thanks for rating the buyer.');
    } catch (e) {
      setError(apiErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const status = po?.status;
  const openStatuses = ['confirmed', 'advancePaid', 'pickupScheduled', 'inTransit', 'delivered', 'qcDisputed'];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/farmer/purchases')}
            className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 transition-colors"
            title="Back to purchases"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <h1 className="text-2xl font-extrabold text-slate-900 flex items-center gap-2">
              <FileCheck className="w-7 h-7 text-emerald-600" />
              Purchase Order #{id}
            </h1>
            <p className="text-xs text-slate-500 mt-1">
              Full lifecycle: escrow, pickup, gate handover OTP, QC, settlement & disputes
            </p>
          </div>
        </div>
        {po && <StatusBadge status={po.status} />}
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

      {loading || !po ? (
        <div className="py-10 text-center text-xs font-bold text-slate-400 animate-pulse">
          Loading purchase order…
        </div>
      ) : (
        <>
          {/* Order summary */}
          <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs space-y-5">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-2xl bg-emerald-50 text-emerald-700">
                <Building2 className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-bold text-base text-slate-900">{po.crop} Procurement</h3>
                <p className="text-xs text-slate-500">Buyer: <strong>{po.buyerName}</strong> • Farmer: {po.farmerName}</p>
                {po.invoiceNumber && (
                  <p className="text-[11px] font-mono text-slate-400">Invoice {po.invoiceNumber}</p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div className="p-3 bg-slate-50/70 rounded-2xl border border-slate-100">
                <span className="text-slate-400 text-[10px] uppercase font-bold">Quantity</span>
                <p className="font-bold text-slate-900 mt-0.5">{formatWeight(po.quantityQuintal)}</p>
              </div>
              <div className="p-3 bg-slate-50/70 rounded-2xl border border-slate-100">
                <span className="text-slate-400 text-[10px] uppercase font-bold">Agreed Rate</span>
                <p className="font-bold text-slate-900 mt-0.5">{formatCurrency(po.agreedPricePerQuintal)} /q</p>
              </div>
              <div className="p-3 bg-slate-50/70 rounded-2xl border border-slate-100">
                <span className="text-slate-400 text-[10px] uppercase font-bold">Total Value</span>
                <p className="font-black text-emerald-700 mt-0.5">{formatCurrency(po.totalAmount)}</p>
              </div>
              <div className="p-3 bg-slate-50/70 rounded-2xl border border-slate-100">
                <span className="text-slate-400 text-[10px] uppercase font-bold">Advance Escrow</span>
                <p className="font-bold text-slate-900 mt-0.5 flex items-center gap-1">
                  {formatCurrency(po.advanceAmount)}
                  {po.advancePaid && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />}
                </p>
              </div>
            </div>

            {po.pickupDate && (
              <div className="p-3 bg-sky-50 border border-sky-200 rounded-2xl text-xs text-sky-900 flex items-center gap-2">
                <Truck className="w-4 h-4 text-sky-600" />
                <span>
                  Pickup scheduled <strong>{formatDateTime(po.pickupDate)}</strong>
                  {po.pickupAddress ? ` — ${po.pickupAddress}` : ''}
                  {po.vehicleNumber ? ` • Vehicle ${po.vehicleNumber}` : ''}
                </span>
              </div>
            )}

            {po.qcGrade && (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-2xl text-xs text-amber-900 flex items-center gap-2">
                <Scale className="w-4 h-4 text-amber-600" />
                <span>
                  QC Grade: <strong>{po.qcGrade}</strong>
                  {po.qcDisputeReason ? ` — Dispute: ${po.qcDisputeReason}` : ''}
                </span>
              </div>
            )}
          </div>

          {/* Lifecycle actions */}
          {status && openStatuses.includes(status) && (
            <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs space-y-4">
              <h3 className="font-bold text-sm text-slate-900">Order Actions</h3>
              <div className="flex flex-wrap gap-2">
                {status === 'confirmed' && (
                  <>
                    <ActionButton
                      icon={HandCoins}
                      label="Request Advance"
                      onClick={() => setActionModal('advance')}
                      busy={busy}
                    />
                    <ActionButton
                      icon={Wallet}
                      label="Pay Advance (Escrow)"
                      onClick={() => setActionModal('escrow')}
                      busy={busy}
                    />
                    <ActionButton
                      icon={Truck}
                      label="Schedule Pickup"
                      onClick={() => setActionModal('pickup')}
                      busy={busy}
                    />
                  </>
                )}
                {status === 'advancePaid' && (
                  <ActionButton
                    icon={Truck}
                    label="Schedule Pickup"
                    onClick={() => setActionModal('pickup')}
                    busy={busy}
                  />
                )}
                {status === 'pickupScheduled' && (
                  <>
                    <ActionButton
                      icon={QrCode}
                      label="Show Handover OTP"
                      onClick={showHandoverOtp}
                      busy={busy}
                    />
                    <ActionButton
                      icon={CheckCircle2}
                      label="Verify Handover OTP"
                      onClick={() => setActionModal('verifyOtp')}
                      busy={busy}
                    />
                    <ActionButton
                      icon={PackageCheck}
                      label="Dispatch Produce"
                      onClick={() => run(() => purchases.dispatch(id), 'Produce dispatched.')}
                      busy={busy}
                    />
                  </>
                )}
                {status === 'inTransit' && (
                  <ActionButton
                    icon={PackageCheck}
                    label="Mark Delivered"
                    onClick={() => run(() => purchases.deliver(id), 'Delivery recorded at buyer gate.')}
                    busy={busy}
                  />
                )}
                {['delivered', 'qcDisputed'].includes(status) && (
                  <>
                    <ActionButton
                      icon={Scale}
                      label="Submit QC Inspection"
                      onClick={() => setQcModalOpen(true)}
                      busy={busy}
                    />
                    <ActionButton
                      icon={CheckCircle2}
                      label="Resolve / Accept Settlement"
                      onClick={() => setActionModal('resolve')}
                      busy={busy}
                    />
                  </>
                )}
                {status === 'delivered' && !po.advancePaid && (
                  <ActionButton
                    icon={Wallet}
                    label="Fund Escrow"
                    onClick={() => setActionModal('escrow')}
                    busy={busy}
                  />
                )}
                {status === 'delivered' && (
                  <ActionButton
                    icon={Receipt}
                    label="Record Payment"
                    onClick={() => setActionModal('pay')}
                    busy={busy}
                  />
                )}
                {status === 'completed' && !po.ratedBuyer && (
                  <ActionButton
                    icon={Star}
                    label="Rate Buyer"
                    onClick={() => setRateModalOpen(true)}
                    busy={busy}
                  />
                )}
                <ActionButton
                  icon={Ban}
                  label="Cancel Order"
                  danger
                  onClick={() => setActionModal('cancel')}
                  busy={busy}
                />
              </div>

              {/* Secondary row: documents, disputes, chat */}
              <div className="pt-3 border-t border-slate-100 flex flex-wrap gap-2">
                <button
                  onClick={handleInvoicePdf}
                  className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs flex items-center gap-1.5"
                >
                  <Download className="w-3.5 h-3.5" /> GST Invoice (PDF)
                </button>
                <Link
                  to={`/farmer/purchases/${id}`}
                  onClick={(e) => {
                    e.preventDefault();
                    purchases
                      .receipt(id)
                      .then((r) => {
                        const blob = new Blob([JSON.stringify(r, null, 2)], { type: 'application/json' });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = `receipt-${id}.json`;
                        a.click();
                        URL.revokeObjectURL(url);
                      })
                      .catch((e2) => setError(apiErrorMessage(e2)));
                  }}
                  className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs flex items-center gap-1.5"
                >
                  <Receipt className="w-3.5 h-3.5" /> Payment Receipt
                </Link>
                <button
                  onClick={() => setDisputeModalOpen(true)}
                  className="px-3.5 py-2 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-800 font-bold text-xs flex items-center gap-1.5 border border-amber-200"
                >
                  <Gavel className="w-3.5 h-3.5" /> Raise Dispute
                </button>
                <button
                  onClick={handleOpenChat}
                  className="px-3.5 py-2 rounded-xl bg-sky-50 hover:bg-sky-100 text-sky-800 font-bold text-xs flex items-center gap-1.5 border border-sky-200"
                >
                  <MessageSquare className="w-3.5 h-3.5" /> Chat with Buyer
                  {chatRoomId ? ' (Room open)' : ''}
                </button>
              </div>
            </div>
          )}

          {/* Disputes */}
          <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs space-y-3">
            <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-amber-600" /> Disputes ({disputes.length})
            </h3>
            {disputes.length === 0 ? (
              <p className="text-xs text-slate-400">No disputes on this order.</p>
            ) : (
              <div className="space-y-2">
                {disputes.map((d, i) => {
                  const r = asRecord(d);
                  return (
                    <div key={asStr(r.id, String(i))} className="p-3.5 bg-slate-50 rounded-2xl border border-slate-100 text-xs flex items-center justify-between gap-3">
                      <div>
                        <p className="font-bold text-slate-900">{asStr(r.reason ?? r.title, 'Dispute')}</p>
                        <p className="text-[10px] text-slate-400">
                          {asStr(r.createdAt ?? r.openedAt, '') && formatDateTime(asStr(r.createdAt ?? r.openedAt))}
                        </p>
                      </div>
                      <StatusBadge status={asStr(r.status, 'open')} />
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </>
      )}

      {/* Handover OTP modal */}
      <GateOtpModal
        isOpen={otpModalOpen}
        onClose={() => setOtpModalOpen(false)}
        orderId={id}
        cropName={po?.crop ?? ''}
        quantityQuintal={po?.quantityQuintal ?? 0}
        otpCode={gateOtp || po?.handoverOtp || '••••'}
      />

      {/* Pickup modal */}
      <ModalSheet
        isOpen={actionModal === 'pickup'}
        onClose={() => setActionModal(null)}
        title="Schedule Pickup"
        description="Set the pickup slot and gate address for the transporter"
        maxWidth="sm"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Pickup Date & Time</label>
            <input
              type="datetime-local"
              value={pickupDate}
              onChange={(e) => setPickupDate(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Pickup Address / Gate</label>
            <input
              type="text"
              value={pickupAddress}
              onChange={(e) => setPickupAddress(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300"
            />
          </div>
          <button
            onClick={() =>
              run(
                () => purchases.pickup(id, { pickupDate, pickupAddress }),
                'Pickup scheduled with the transporter.'
              )
            }
            disabled={busy}
            className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md disabled:opacity-60"
          >
            {busy ? 'Saving…' : 'Confirm Pickup Slot'}
          </button>
        </div>
      </ModalSheet>

      {/* Escrow fund modal */}
      <ModalSheet
        isOpen={actionModal === 'escrow'}
        onClose={() => setActionModal(null)}
        title="Fund Escrow"
        description="Lock the advance in Agrovercity secure escrow"
        maxWidth="sm"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Escrow Amount (₹)</label>
            <input
              type="number"
              value={escrowAmount}
              onChange={(e) => setEscrowAmount(Number(e.target.value))}
              className="w-full px-3 py-2 text-sm font-bold rounded-xl border border-slate-300"
            />
          </div>
          <button
            onClick={() =>
              run(
                () => purchases.escrowFund(id, { amount: escrowAmount }),
                'Escrow funded. Advance is locked until delivery.'
              )
            }
            disabled={busy}
            className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md disabled:opacity-60"
          >
            {busy ? 'Funding…' : 'Fund Escrow Securely'}
          </button>
        </div>
      </ModalSheet>

      {/* Advance request modal */}
      <ModalSheet
        isOpen={actionModal === 'advance'}
        onClose={() => setActionModal(null)}
        title="Request Advance Payment"
        description="Ask the buyer to release an advance against this order — released via escrow after they approve"
        maxWidth="sm"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Advance Amount (₹)</label>
            <input
              type="number"
              value={advanceAmount}
              onChange={(e) => setAdvanceAmount(Number(e.target.value))}
              className="w-full px-3 py-2 text-sm font-bold rounded-xl border border-slate-300"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Purpose (optional)</label>
            <input
              type="text"
              value={advanceReason}
              onChange={(e) => setAdvanceReason(e.target.value)}
              placeholder="e.g. Harvest labour and packing costs"
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300"
            />
          </div>
          <button
            onClick={() =>
              run(
                () => purchases.advance(id, { amount: advanceAmount, reason: advanceReason }),
                'Advance request sent to the buyer.'
              )
            }
            disabled={busy || advanceAmount <= 0}
            className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md disabled:opacity-60"
          >
            {busy ? 'Requesting…' : 'Send Advance Request'}
          </button>
        </div>
      </ModalSheet>

      {/* Resolve modal */}
      <ModalSheet
        isOpen={actionModal === 'resolve'}
        onClose={() => setActionModal(null)}
        title="Resolve / Accept Settlement"
        description="Accept the QC outcome and release settlement"
        maxWidth="sm"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Resolution Note</label>
            <textarea
              rows={3}
              value={resolveNote}
              onChange={(e) => setResolveNote(e.target.value)}
              placeholder="e.g. Accepted QC grade A, release full payment"
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300"
            />
          </div>
          <button
            onClick={() =>
              run(
                () => purchases.resolve(id, { note: resolveNote, accept: true }),
                'Order resolved. Settlement released to your bank account.'
              )
            }
            disabled={busy}
            className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md disabled:opacity-60"
          >
            {busy ? 'Resolving…' : 'Confirm Resolution'}
          </button>
        </div>
      </ModalSheet>

      {/* Cancel modal */}
      <ModalSheet
        isOpen={actionModal === 'cancel'}
        onClose={() => setActionModal(null)}
        title="Cancel Purchase Order"
        description="The buyer will be notified and any held escrow refunded"
        maxWidth="sm"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Reason</label>
            <input
              type="text"
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              placeholder="e.g. Buyer requested later harvest date"
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300"
            />
          </div>
          <button
            onClick={() => run(() => purchases.cancel(id, cancelReason), 'Purchase order cancelled.')}
            disabled={busy}
            className="w-full py-3 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs shadow-md disabled:opacity-60"
          >
            {busy ? 'Cancelling…' : 'Cancel Order'}
          </button>
        </div>
      </ModalSheet>

      {/* Verify handover OTP modal */}
      <ModalSheet
        isOpen={actionModal === 'verifyOtp'}
        onClose={() => setActionModal(null)}
        title="Verify Handover OTP"
        description="Enter the 6-digit OTP shown to the transporter at the gate"
        maxWidth="sm"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">OTP</label>
            <input
              type="text"
              inputMode="numeric"
              maxLength={6}
              value={verifyOtpInput}
              onChange={(e) => setVerifyOtpInput(e.target.value.replace(/\D/g, ''))}
              placeholder="6-digit OTP"
              className="w-full px-3 py-2.5 text-center text-lg font-black tracking-[0.5em] rounded-xl border border-slate-300 font-mono"
            />
          </div>
          <button
            onClick={() =>
              run(
                () => purchases.handoverVerify(id, verifyOtpInput),
                'Handover OTP verified. Produce released to the transporter.'
              )
            }
            disabled={busy || verifyOtpInput.length < 4}
            className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md disabled:opacity-60"
          >
            {busy ? 'Verifying…' : 'Verify OTP'}
          </button>
        </div>
      </ModalSheet>

      {/* Record payment modal */}
      <ModalSheet
        isOpen={actionModal === 'pay'}
        onClose={() => setActionModal(null)}
        title="Record Payment"
        description="Confirm the final settlement payment for this order"
        maxWidth="sm"
      >
        <div className="space-y-4">
          <div className="p-3 bg-slate-50 rounded-xl text-xs space-y-1">
            <div className="flex justify-between text-slate-600">
              <span>Order Total:</span>
              <span className="font-bold text-slate-900">{formatCurrency(po?.totalAmount ?? 0)}</span>
            </div>
            <div className="flex justify-between text-slate-600">
              <span>Advance (Escrow):</span>
              <span className="font-bold text-slate-900">{formatCurrency(po?.advanceAmount ?? 0)}</span>
            </div>
            <div className="flex justify-between text-slate-600">
              <span>Balance Due:</span>
              <span className="font-bold text-emerald-800">
                {formatCurrency(Math.max(0, (po?.totalAmount ?? 0) - (po?.advanceAmount ?? 0)))}
              </span>
            </div>
          </div>
          <button
            onClick={() => run(() => purchases.pay(id), 'Payment recorded. Settlement will be transferred to your bank.')}
            disabled={busy}
            className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md disabled:opacity-60"
          >
            {busy ? 'Recording…' : 'Confirm Payment'}
          </button>
        </div>
      </ModalSheet>

      {/* QC modal */}
      <ModalSheet
        isOpen={qcModalOpen}
        onClose={() => setQcModalOpen(false)}
        title="QC Inspection"
        description="Record the quality check result with photo evidence"
        maxWidth="md"
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Grade</label>
              <select
                value={qcGrade}
                onChange={(e) => setQcGrade(e.target.value as 'A' | 'B' | 'C' | 'Rejected')}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 bg-white"
              >
                <option value="A">Grade A</option>
                <option value="B">Grade B</option>
                <option value="C">Grade C</option>
                <option value="Rejected">Rejected</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Photos ({qcPhotoUrls.length})</label>
              <input
                ref={qcFileRef}
                type="file"
                accept="image/*"
                onChange={(e) => handleQcPhoto(e.target.files?.[0])}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => qcFileRef.current?.click()}
                disabled={qcBusy}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-bold text-slate-600 hover:bg-slate-50 flex items-center justify-center gap-1.5 disabled:opacity-60"
              >
                <Camera className="w-3.5 h-3.5" /> {qcBusy ? 'Uploading…' : 'Add Photo'}
              </button>
            </div>
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">QC Notes</label>
            <textarea
              rows={3}
              value={qcNotes}
              onChange={(e) => setQcNotes(e.target.value)}
              placeholder="Moisture %, foreign matter, weight check…"
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300"
            />
          </div>
          <button
            onClick={handleSubmitQc}
            disabled={qcBusy}
            className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md disabled:opacity-60"
          >
            {qcBusy ? 'Submitting…' : 'Submit QC Result'}
          </button>
        </div>
      </ModalSheet>

      {/* Dispute modal */}
      <ModalSheet
        isOpen={disputeModalOpen}
        onClose={() => setDisputeModalOpen(false)}
        title="Raise Dispute"
        description="Escrow is held until the settlement desk resolves the dispute"
        maxWidth="sm"
      >
        <div className="space-y-4">
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
            <span>Raising a dispute freezes escrow release. Keep photo/video evidence ready.</span>
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Dispute Reason</label>
            <textarea
              rows={3}
              value={disputeReason}
              onChange={(e) => setDisputeReason(e.target.value)}
              placeholder="e.g. Weight short by 120kg at buyer weighbridge"
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Claimed Amount (₹, optional)</label>
            <input
              type="number"
              value={disputeAmount}
              onChange={(e) => setDisputeAmount(Number(e.target.value))}
              className="w-full px-3 py-2 text-sm font-bold rounded-xl border border-slate-300"
            />
          </div>
          <button
            onClick={handleRaiseDispute}
            disabled={busy || !disputeReason.trim()}
            className="w-full py-3 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs shadow-md disabled:opacity-60"
          >
            {busy ? 'Submitting…' : 'Raise Dispute'}
          </button>
        </div>
      </ModalSheet>

      {/* Rate modal */}
      <ModalSheet
        isOpen={rateModalOpen}
        onClose={() => setRateModalOpen(false)}
        title="Rate Buyer Partner"
        description="Payment timeliness, QC fairness, and communication"
        maxWidth="sm"
      >
        <div className="space-y-4 text-center">
          <div className="flex justify-center gap-2 py-2">
            {[1, 2, 3, 4, 5].map((star) => (
              <button key={star} type="button" onClick={() => setRatingScore(star)} className="p-1 hover:scale-110 transition-transform">
                <Star className={`w-8 h-8 ${star <= ratingScore ? 'fill-amber-400 text-amber-400' : 'text-slate-300'}`} />
              </button>
            ))}
          </div>
          <textarea
            rows={2}
            value={ratingReview}
            onChange={(e) => setRatingReview(e.target.value)}
            placeholder="Short review (optional)"
            className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300"
          />
          <button
            onClick={handleRate}
            disabled={busy}
            className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md disabled:opacity-60"
          >
            {busy ? 'Submitting…' : 'Submit Rating'}
          </button>
        </div>
      </ModalSheet>
    </div>
  );
};

const ActionButton: React.FC<{
  icon: React.ElementType;
  label: string;
  onClick: () => void;
  busy?: boolean;
  danger?: boolean;
}> = ({ icon: Icon, label, onClick, busy, danger }) => (
  <button
    onClick={onClick}
    disabled={busy}
    className={`px-4 py-2.5 rounded-2xl font-bold text-xs shadow-xs flex items-center gap-2 transition-all disabled:opacity-50 ${
      danger
        ? 'border border-rose-200 text-rose-600 hover:bg-rose-50'
        : 'bg-emerald-600 hover:bg-emerald-700 text-white'
    }`}
  >
    <Icon className="w-4 h-4" />
    <span>{label}</span>
  </button>
);
