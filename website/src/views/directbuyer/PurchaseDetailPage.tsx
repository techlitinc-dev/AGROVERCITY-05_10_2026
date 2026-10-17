import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ArrowLeft,
  RefreshCcw,
  ShieldCheck,
  Truck,
  QrCode,
  Award,
  Scale,
  HandCoins,
  Receipt,
  Star,
  XCircle,
  Gavel,
  MessageSquare,
  Camera,
  Download,
} from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import { purchases, apiClient, apiErrorMessage } from '../../lib/api';
import { StatusBadge } from '../../components/common/StatusBadge';
import { ModalSheet } from '../../components/common/ModalSheet';
import { formatCurrency, formatWeight, formatDateTime } from '../../lib/utils';
import type { PurchaseOrder } from '../../types';
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

const STEPS = ['confirmed', 'advancePaid', 'pickupScheduled', 'inTransit', 'delivered', 'completed'];

/**
 * Purchase detail (buyer side): escrow funding, pickup/dispatch/delivery,
 * handover OTP verification, QC with photo evidence, dispute resolution,
 * balance payment, invoice/receipt documents and counterparty rating.
 */
export const PurchaseDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [po, setPo] = useState<PurchaseOrder | null>(null);
  const [events, setEvents] = useState<Rec[]>([]);
  const [disputes, setDisputes] = useState<Rec[]>([]);
  const [payments, setPayments] = useState<Rec[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const [detail, disputesList] = await Promise.all([
        purchases.get(id),
        purchases.disputes(id).catch(() => [] as unknown[]),
      ]);
      setPo(detail);
      setDisputes((disputesList as unknown[]).map(rec));
    } catch (e) {
      setError(apiErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  // defensive views from the raw purchase payload
  const raw = rec(po);
  const escrow = rec(raw.escrow);
  const handover = rec(raw.handover);
  const qc = rec(raw.qc);
  useEffect(() => {
    setEvents(arr(raw.events).map(rec));
    setPayments(arr(raw.payments).map(rec));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [po]);

  const act = useCallback(
    async (fn: () => Promise<unknown>, successMsg?: string) => {
      setActionError(null);
      setNotice(null);
      try {
        await fn();
        if (successMsg) setNotice(successMsg);
        await load();
      } catch (err) {
        setActionError(apiErrorMessage(err));
      }
    },
    [load]
  );

  // --- modals ---
  const [fundModal, setFundModal] = useState(false);
  const [fundAmt, setFundAmt] = useState(0);
  const [pickupModal, setPickupModal] = useState(false);
  const [pickupDate, setPickupDate] = useState('');
  const [pickupVehicle, setPickupVehicle] = useState('');
  const [pickupAddr, setPickupAddr] = useState('');
  const [verifyModal, setVerifyModal] = useState(false);
  const [verifyOtp, setVerifyOtp] = useState('');
  const [qcModal, setQcModal] = useState(false);
  const [qcGrade, setQcGrade] = useState<'A' | 'B' | 'C'>('A');
  const [qcAccepted, setQcAccepted] = useState(0);
  const [qcRejected, setQcRejected] = useState(0);
  const [qcNote, setQcNote] = useState('');
  const [resolveModal, setResolveModal] = useState(false);
  const [resolution, setResolution] = useState('');
  const [payModal, setPayModal] = useState(false);
  const [payAmt, setPayAmt] = useState(0);
  const [payKind, setPayKind] = useState<'balance' | 'full'>('balance');
  const [rateModal, setRateModal] = useState(false);
  const [rateStars, setRateStars] = useState(5);
  const [rateReview, setRateReview] = useState('');
  const [cancelModal, setCancelModal] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [disputeModal, setDisputeModal] = useState(false);
  const [disputeCategory, setDisputeCategory] = useState('quality');
  const [disputeReason, setDisputeReason] = useState('');
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement | null>(null);

  const download = async (kind: 'invoice' | 'invoicePdf' | 'receipt') => {
    if (!po) return;
    setActionError(null);
    try {
      if (kind === 'invoicePdf') {
        const blob = await purchases.invoicePdf(po.id);
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `invoice-${po.id}.pdf`;
        a.click();
        URL.revokeObjectURL(url);
      } else {
        const doc = rec(await purchases[kind](po.id));
        setNotice(`${kind === 'invoice' ? 'Invoice' : 'Receipt'} ${str(doc.number ?? doc.receiptNo ?? '', '')} issued`);
      }
    } catch (err) {
      setActionError(apiErrorMessage(err));
    }
  };

  const uploadQcPhoto = async (file: File) => {
    if (!po || !file) return;
    setUploading(true);
    setActionError(null);
    try {
      const form = new FormData();
      form.append('file', file);
      await apiClient.post(`/purchases/${po.id}/qc/photos`, form, {
        headers: {
          'Content-Type': 'multipart/form-data',
          'Idempotency-Key': `web-qcphoto-${Date.now()}`,
        },
      });
      setNotice('QC photo uploaded');
      await load();
    } catch (err) {
      setActionError(apiErrorMessage(err));
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const openChatRoom = async () => {
    if (!po) return;
    setActionError(null);
    try {
      const room = rec(await purchases.chatRoom(po.id));
      setNotice(`Chat room ready: ${str(room.name ?? room.id, 'room opened')} — continue in Chat`);
    } catch (err) {
      setActionError(apiErrorMessage(err));
    }
  };

  const status = po?.status ?? 'confirmed';
  const idx = STEPS.indexOf(status);
  const balance = po ? po.totalAmount - (po.advanceAmount || 0) : 0;
  const qcPhotos = arr(qc.photos).map(str);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 border-b border-slate-200 pb-4 flex-wrap">
        <Link to="/directbuyer" className={ghostBtnCls}>
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div className="flex-1 min-w-40">
          <h1 className="text-2xl font-extrabold text-slate-900">
            Purchase #{id}
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            {po ? `${po.crop} · ${formatWeight(po.quantityQuintal)} from ${po.farmerName}` : 'Loading purchase…'}
          </p>
        </div>
        {po && <StatusBadge status={status} />}
        <button onClick={() => void load()} className={ghostBtnCls}>
          <RefreshCcw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
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
      ) : !po ? null : (
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          <div className="lg:col-span-3 space-y-4">
            {/* stepper */}
            <div className={`${cardCls} p-5`}>
              <div className="flex items-center gap-1.5 text-[10px] font-bold overflow-x-auto pb-1">
                {STEPS.map((s, i) => (
                  <span
                    key={s}
                    className={`px-2.5 py-1.5 rounded-xl whitespace-nowrap ${
                      i === idx
                        ? status === 'qcDisputed'
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
                {status === 'qcDisputed' && <span className="px-2.5 py-1 rounded-xl bg-rose-100 text-rose-700">QC Disputed</span>}
              </div>
            </div>

            {/* actions */}
            <div className={`${cardCls} p-5 space-y-3`}>
              <h3 className="font-bold text-sm text-slate-900">Lifecycle Actions</h3>
              <div className="flex flex-wrap gap-2">
                {status === 'confirmed' && (
                  <>
                    <button onClick={() => { setFundAmt(po.totalAmount); setFundModal(true); }} className={primaryBtnCls}>
                      <ShieldCheck className="w-3.5 h-3.5 inline mr-1" /> Fund Escrow
                    </button>
                    <button onClick={() => setDisputeModal(true)} className={ghostBtnCls}>
                      <Gavel className="w-3.5 h-3.5 inline mr-1" /> Dispute
                    </button>
                  </>
                )}
                {status === 'advancePaid' && (
                  <button onClick={() => setPickupModal(true)} className={primaryBtnCls}>
                    <Truck className="w-3.5 h-3.5 inline mr-1" /> Schedule Pickup
                  </button>
                )}
                {status === 'pickupScheduled' && (
                  <button onClick={() => void act(() => purchases.dispatch(po.id), 'Dispatched')} className={primaryBtnCls}>
                    Mark Dispatch
                  </button>
                )}
                {status === 'inTransit' && (
                  <button onClick={() => void act(() => purchases.deliver(po.id), 'Marked delivered')} className={primaryBtnCls}>
                    Mark Delivered
                  </button>
                )}
                {status === 'delivered' && (
                  <>
                    <button onClick={() => { setVerifyOtp(''); setVerifyModal(true); }} className={primaryBtnCls}>
                      <QrCode className="w-3.5 h-3.5 inline mr-1" /> Verify Handover OTP
                    </button>
                    <button
                      onClick={() => {
                        setQcAccepted(po.quantityQuintal);
                        setQcRejected(0);
                        setQcModal(true);
                      }}
                      className={primaryBtnCls}
                    >
                      <Award className="w-3.5 h-3.5 inline mr-1" /> QC Inspection
                    </button>
                    <button onClick={() => setDisputeModal(true)} className={ghostBtnCls}>
                      <Gavel className="w-3.5 h-3.5 inline mr-1" /> Dispute
                    </button>
                  </>
                )}
                {status === 'qcDisputed' && (
                  <button onClick={() => setResolveModal(true)} className={primaryBtnCls}>
                    <Scale className="w-3.5 h-3.5 inline mr-1" /> Resolve Dispute
                  </button>
                )}
                {status === 'completed' && (
                  <>
                    <button onClick={() => { setPayAmt(balance); setPayKind('balance'); setPayModal(true); }} className={primaryBtnCls}>
                      <HandCoins className="w-3.5 h-3.5 inline mr-1" /> Pay Balance
                    </button>
                    <button onClick={() => void download('invoice')} className={ghostBtnCls}>
                      <Receipt className="w-3.5 h-3.5 inline mr-1" /> View Invoice
                    </button>
                    <button onClick={() => void download('invoicePdf')} className={ghostBtnCls}>
                      <Download className="w-3.5 h-3.5 inline mr-1" /> Invoice PDF
                    </button>
                    <button onClick={() => void download('receipt')} className={ghostBtnCls}>
                      Receipt
                    </button>
                    {!po.ratedFarmer && (
                      <button onClick={() => setRateModal(true)} className={ghostBtnCls}>
                        <Star className="w-3.5 h-3.5 inline mr-1" /> Rate Farmer
                      </button>
                    )}
                  </>
                )}
                {['confirmed', 'advancePaid', 'pickupScheduled'].includes(status) && (
                  <button onClick={() => setCancelModal(true)} className={`${ghostBtnCls} text-rose-600 border-rose-200 hover:bg-rose-50`}>
                    <XCircle className="w-3.5 h-3.5 inline mr-1" /> Cancel Purchase
                  </button>
                )}
                <button onClick={() => void openChatRoom()} className={ghostBtnCls}>
                  <MessageSquare className="w-3.5 h-3.5 inline mr-1" /> Chat Room
                </button>
              </div>
            </div>

            {/* QC photos + disputes */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className={`${cardCls} p-5 space-y-3`}>
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-sm text-slate-900">QC Evidence ({qcPhotos.length}/5)</h3>
                  {['delivered', 'qcDisputed'].includes(status) && (
                    <button onClick={() => fileRef.current?.click()} disabled={uploading} className={ghostBtnCls}>
                      <Camera className="w-3.5 h-3.5 inline mr-1" /> {uploading ? 'Uploading…' : 'Add Photo'}
                    </button>
                  )}
                </div>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) void uploadQcPhoto(f);
                  }}
                />
                {qcPhotos.length === 0 ? (
                  <EmptyState label="No QC photos yet" />
                ) : (
                  <div className="space-y-1.5">
                    {qcPhotos.map((p) => (
                      <p key={p} className="text-[10px] font-mono text-slate-500 bg-slate-50 rounded-lg px-2 py-1 truncate">{p}</p>
                    ))}
                  </div>
                )}
                {str(qc.grade) !== '' && (
                  <p className="text-xs text-slate-600">
                    Recorded grade: <strong>{str(qc.grade)}</strong>
                  </p>
                )}
              </div>

              <div className={`${cardCls} p-5 space-y-3`}>
                <h3 className="font-bold text-sm text-slate-900">Disputes ({disputes.length})</h3>
                {disputes.length === 0 ? (
                  <EmptyState label="No disputes on this purchase" />
                ) : (
                  disputes.map((d) => (
                    <div key={str(d.id)} className="p-3 bg-slate-50 rounded-xl text-xs space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-slate-800 capitalize">{str(d.category)}</span>
                        <StatusBadge status={str(d.status, 'open')} />
                      </div>
                      <p className="text-slate-500">{str(d.reason)}</p>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* sidebar */}
          <div className="lg:col-span-2 space-y-4">
            <div className={`${cardCls} p-5 space-y-3`}>
              <h3 className="font-bold text-sm text-slate-900">Order Summary</h3>
              {[
                { label: 'Agreed Rate', value: `${formatCurrency(po.agreedPricePerQuintal)}/q` },
                { label: 'Total', value: formatCurrency(po.totalAmount), strong: true },
                { label: 'Advance', value: po.advancePaid ? formatCurrency(po.advanceAmount) : 'Not funded' },
                { label: 'Balance', value: formatCurrency(balance) },
                { label: 'Escrow', value: str(escrow.status, 'not funded') },
                { label: 'Handover OTP', value: str(handover.verifiedAt) ? `Verified ${formatDateTime(str(handover.verifiedAt))}` : 'Pending' },
                { label: 'Pickup', value: po.pickupDate ? formatDateTime(po.pickupDate) : '—' },
                { label: 'Vehicle', value: po.vehicleNumber || str(rec(raw.pickup).vehicleType) || '—' },
                { label: 'QC Grade', value: po.qcGrade || str(qc.grade) || 'Pending' },
                { label: 'Invoice No.', value: po.invoiceNumber || '—' },
              ].map((r) => (
                <div key={r.label} className="flex justify-between text-xs">
                  <span className="text-slate-400 font-semibold">{r.label}</span>
                  <span className={r.strong ? 'font-black text-emerald-800' : 'font-bold text-slate-800'}>{r.value}</span>
                </div>
              ))}
            </div>

            <div className={`${cardCls} p-5 space-y-3`}>
              <h3 className="font-bold text-sm text-slate-900">Payments ({payments.length})</h3>
              {payments.length === 0 ? (
                <EmptyState label="No payments recorded" />
              ) : (
                payments.map((p) => (
                  <div key={str(p.id)} className="flex justify-between text-xs p-2.5 bg-slate-50 rounded-xl">
                    <div>
                      <p className="font-bold text-slate-800 capitalize">{str(p.kind)}</p>
                      <p className="text-[10px] text-slate-400">{formatDateTime(str(p.at))} {str(p.method) ? `· ${str(p.method)}` : ''}</p>
                    </div>
                    <span className="font-black text-emerald-800">{formatCurrency(num(p.amount))}</span>
                  </div>
                ))
              )}
            </div>

            <div className={`${cardCls} p-5 space-y-3`}>
              <h3 className="font-bold text-sm text-slate-900">Event Log</h3>
              {events.length === 0 ? (
                <EmptyState label="No events yet" />
              ) : (
                <ol className="relative border-l-2 border-slate-100 ml-2 space-y-3 max-h-72 overflow-y-auto">
                  {events.map((ev, i) => (
                    <li key={i} className="ml-4">
                      <span className="absolute -left-[7px] mt-1 w-3 h-3 rounded-full bg-emerald-500 border-2 border-white" />
                      <p className="text-xs font-bold text-slate-900 capitalize">{str(ev.status ?? ev.type, 'Event')}</p>
                      <p className="text-[10px] text-slate-400">
                        {formatDateTime(str(ev.at ?? ev.timestamp))}
                        {ev.note ? ` — ${str(ev.note)}` : ''}
                      </p>
                    </li>
                  ))}
                </ol>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Fund escrow */}
      <ModalSheet isOpen={fundModal} onClose={() => setFundModal(false)} title="Fund Escrow" description="Money is held by the platform until delivery + silent window" maxWidth="sm">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void act(() => purchases.escrowFund(po!.id, { amount: fundAmt, method: 'upi' }), 'Escrow funded — farmer unlocked for handover');
            setFundModal(false);
          }}
          className="space-y-4"
        >
          <div>
            <label className={labelCls}>Amount (₹)</label>
            <input type="number" className={`${inputCls} font-bold text-emerald-800`} value={fundAmt} max={po?.totalAmount} onChange={(e) => setFundAmt(Number(e.target.value))} required />
            <p className="text-[11px] text-slate-400 mt-1">Leave full amount to guarantee the farmer payout.</p>
          </div>
          <button type="submit" className={`${primaryBtnCls} w-full py-3`}>Fund Escrow</button>
        </form>
      </ModalSheet>

      {/* Pickup */}
      <ModalSheet isOpen={pickupModal} onClose={() => setPickupModal(false)} title="Schedule Pickup" maxWidth="sm">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void act(() => purchases.pickup(po!.id, { date: pickupDate, vehicleType: pickupVehicle, address: pickupAddr }), 'Pickup scheduled');
            setPickupModal(false);
          }}
          className="space-y-4"
        >
          <div>
            <label className={labelCls}>Pickup Date</label>
            <input type="date" className={inputCls} value={pickupDate} onChange={(e) => setPickupDate(e.target.value)} required />
          </div>
          <div>
            <label className={labelCls}>Vehicle Type</label>
            <input className={inputCls} value={pickupVehicle} onChange={(e) => setPickupVehicle(e.target.value)} />
          </div>
          <div>
            <label className={labelCls}>Address</label>
            <textarea rows={2} className={inputCls} value={pickupAddr} onChange={(e) => setPickupAddr(e.target.value)} />
          </div>
          <button type="submit" className={`${primaryBtnCls} w-full py-3`}>Schedule</button>
        </form>
      </ModalSheet>

      {/* Verify OTP */}
      <ModalSheet isOpen={verifyModal} onClose={() => setVerifyModal(false)} title="Verify Handover OTP" description="6-digit OTP revealed by the farmer at the gate (15-minute validity)" maxWidth="sm">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void act(() => purchases.handoverVerify(po!.id, verifyOtp), 'Handover verified — escrow release clock started');
            setVerifyModal(false);
          }}
          className="space-y-4"
        >
          <input
            className={`${inputCls} text-center text-2xl font-black tracking-[0.5em] font-mono`}
            maxLength={6}
            value={verifyOtp}
            onChange={(e) => setVerifyOtp(e.target.value.replace(/\D/g, ''))}
            placeholder="••••••"
            required
          />
          <button type="submit" className={`${primaryBtnCls} w-full py-3`}>Verify Handover</button>
        </form>
      </ModalSheet>

      {/* QC */}
      <ModalSheet isOpen={qcModal} onClose={() => setQcModal(false)} title="Quality Inspection" description="Accepted + rejected quantities must equal the booked quantity" maxWidth="md">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (Math.abs(qcAccepted + qcRejected - po!.quantityQuintal) > 0.001) {
              setActionError(`Accepted + rejected must equal ${po!.quantityQuintal} q`);
              return;
            }
            void act(
              () => purchases.qc(po!.id, { grade: qcGrade, acceptedQty: qcAccepted, rejectedQty: qcRejected, note: qcNote }),
              'QC recorded — attach photos as evidence'
            );
            setQcModal(false);
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
              <label className={labelCls}>Accepted (q)</label>
              <input type="number" className={inputCls} value={qcAccepted} onChange={(e) => setQcAccepted(Number(e.target.value))} required />
            </div>
            <div>
              <label className={labelCls}>Rejected (q)</label>
              <input type="number" className={inputCls} value={qcRejected} onChange={(e) => setQcRejected(Number(e.target.value))} />
            </div>
          </div>
          <div>
            <label className={labelCls}>Note</label>
            <textarea rows={2} className={inputCls} value={qcNote} onChange={(e) => setQcNote(e.target.value)} />
          </div>
          <ErrorBanner message={actionError} />
          <button type="submit" className={`${primaryBtnCls} w-full py-3`}>Record QC</button>
        </form>
      </ModalSheet>

      {/* Resolve */}
      <ModalSheet isOpen={resolveModal} onClose={() => setResolveModal(false)} title="Resolve QC Dispute" description="Resolving finalizes the purchase and releases escrow (net of adjustment)" maxWidth="sm">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void act(() => purchases.resolve(po!.id, { resolution }), 'Dispute resolved — purchase completed');
            setResolveModal(false);
          }}
          className="space-y-4"
        >
          <div>
            <label className={labelCls}>Resolution</label>
            <textarea rows={3} className={inputCls} value={resolution} onChange={(e) => setResolution(e.target.value)} placeholder="e.g. 2% price adjustment accepted for moisture" required />
          </div>
          <button type="submit" className={`${primaryBtnCls} w-full py-3`}>Resolve & Complete</button>
        </form>
      </ModalSheet>

      {/* Pay */}
      <ModalSheet isOpen={payModal} onClose={() => setPayModal(false)} title="Pay Farmer" maxWidth="sm">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void act(() => purchases.pay(po!.id, { amount: payAmt, kind: payKind, method: 'bank_transfer' }), 'Payment recorded');
            setPayModal(false);
          }}
          className="space-y-4"
        >
          <div>
            <label className={labelCls}>Kind</label>
            <select className={inputCls} value={payKind} onChange={(e) => setPayKind(e.target.value as 'balance' | 'full')}>
              <option value="balance">Balance</option>
              <option value="full">Full</option>
            </select>
          </div>
          <div>
            <label className={labelCls}>Amount (₹)</label>
            <input type="number" className={`${inputCls} font-bold text-emerald-800`} value={payAmt} onChange={(e) => setPayAmt(Number(e.target.value))} required />
          </div>
          <button type="submit" className={`${primaryBtnCls} w-full py-3`}>Record Payment</button>
        </form>
      </ModalSheet>

      {/* Rate */}
      <ModalSheet isOpen={rateModal} onClose={() => setRateModal(false)} title="Rate Farmer" maxWidth="sm">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void act(() => purchases.rate(po!.id, { rating: rateStars, review: rateReview, target: 'farmer' }), 'Farmer rated');
            setRateModal(false);
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

      {/* Cancel */}
      <ModalSheet isOpen={cancelModal} onClose={() => setCancelModal(false)} title="Cancel Purchase" description="Held escrow is auto-refunded to the buyer" maxWidth="sm">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void act(() => purchases.cancel(po!.id, cancelReason), 'Purchase cancelled');
            setCancelModal(false);
          }}
          className="space-y-4"
        >
          <div>
            <label className={labelCls}>Reason</label>
            <textarea rows={2} className={inputCls} value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} />
          </div>
          <button type="submit" className="w-full py-3 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs">Confirm Cancellation</button>
        </form>
      </ModalSheet>

      {/* Dispute */}
      <ModalSheet isOpen={disputeModal} onClose={() => setDisputeModal(false)} title="Open Dispute" description="Opening a dispute freezes the escrow release clock" maxWidth="sm">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void act(() => purchases.openDispute(po!.id, { category: disputeCategory, reason: disputeReason }), 'Dispute opened');
            setDisputeModal(false);
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
