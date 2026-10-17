import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ArrowLeft,
  RefreshCcw,
  ShieldCheck,
  MessageSquare,
  Send,
  Camera,
  FileText,
  Milestone,
  Truck,
  HandCoins,
  Receipt,
  Gavel,
  AlertTriangle,
  Download,
  Swords,
  FileSignature,
} from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import { broker, apiClient, apiErrorMessage } from '../../lib/api';
import { StatusBadge } from '../../components/common/StatusBadge';
import { ModalSheet } from '../../components/common/ModalSheet';
import { formatCurrency, formatWeight, formatDateTime } from '../../lib/utils';
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
  paisaToRupees,
  primaryBtnCls,
  rec,
  str,
  type Rec,
} from './shared';

const STATUS_FLOW = ['negotiating', 'contract_issued', 'accepted', 'in_transit', 'completed'];

const EVIDENCE_KINDS = ['loading', 'weigh_slip', 'quality_report', 'payment_proof', 'other'];

/**
 * Broker deal detail: negotiation thread with structured counters, status
 * flips, photo evidence + typed vault, client-rendered contract card,
 * delivery milestones, vehicle details, payment capture / payout release,
 * receipt, disputes, escalation and the post-acceptance chat room.
 */
export const DealDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [deal, setDeal] = useState<Rec | null>(null);
  const [messages, setMessages] = useState<Rec[]>([]);
  const [milestones, setMilestones] = useState<Rec[]>([]);
  const [disputes, setDisputes] = useState<Rec[]>([]);
  const [vault, setVault] = useState<Rec>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [uploadKind, setUploadKind] = useState('loading');

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const [d, m, ms, dsp, v] = await Promise.all([
        broker.deal(id),
        broker.dealMessages(id).catch(() => [] as unknown[]),
        broker.dealMilestones(id).catch(() => [] as unknown[]),
        broker.dealDisputes(id).catch(() => [] as unknown[]),
        broker.dealVault(id).catch(() => ({})),
      ]);
      setDeal(rec(d));
      setMessages((m as unknown[]).map(rec));
      setMilestones((ms as unknown[]).map(rec));
      setDisputes((dsp as unknown[]).map(rec));
      setVault(rec(v));
    } catch (e) {
      setError(apiErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

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

  // --- negotiation message ---
  const [msgText, setMsgText] = useState('');
  const [msgAmount, setMsgAmount] = useState(0);
  const postMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id || !msgText.trim()) return;
    const payload: Record<string, unknown> = { senderRole: 'broker', text: msgText.trim() };
    if (msgAmount > 0) payload.amountOffer = msgAmount;
    await act(() => broker.postDealMessage(id, payload), 'Message sent');
    setMsgText('');
    setMsgAmount(0);
  };

  // --- status ---
  const setStatus = (status: string) => {
    if (!id) return;
    const labels: Record<string, string> = {
      contract_issued: 'Contract issued to farmer',
      in_transit: 'Vehicle marked in transit — farmer notified',
      completed: 'Deal completed',
    };
    void act(() => broker.updateDeal(id, { status }), labels[status]);
  };

  // --- evidence upload ---
  const uploadEvidence = async (file: File) => {
    if (!id || !file) return;
    setActionError(null);
    try {
      const form = new FormData();
      form.append('file', file);
      form.append('kind', uploadKind);
      await apiClient.post(`/broker/deals/${id}/evidence`, form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setNotice(`${uploadKind.replace(/_/g, ' ')} evidence uploaded`);
      await load();
    } catch (err) {
      setActionError(apiErrorMessage(err));
    } finally {
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  // --- vehicle ---
  const [vehicleModal, setVehicleModal] = useState(false);
  const [vehType, setVehType] = useState('');
  const [vehPlate, setVehPlate] = useState('');
  const [vehDriver, setVehDriver] = useState('');
  const saveVehicle = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id) return;
    await act(
      () => broker.setDealVehicle(id, { vehicleType: vehType, plateNo: vehPlate, driverName: vehDriver }),
      'Vehicle details saved'
    );
    setVehicleModal(false);
  };

  // --- milestone ---
  const [msModal, setMsModal] = useState(false);
  const [msEvent, setMsEvent] = useState('departed');
  const [msNote, setMsNote] = useState('');
  const [msLocation, setMsLocation] = useState('');
  const saveMilestone = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id) return;
    await act(
      () => broker.addDealMilestone(id, { event: msEvent, note: msNote, location: msLocation }),
      'Milestone recorded'
    );
    setMsModal(false);
  };

  // --- payment capture / payout ---
  const [captureModal, setCaptureModal] = useState(false);
  const [captureAmount, setCaptureAmount] = useState(0);
  const [captureMethod, setCaptureMethod] = useState('bank_transfer');
  const [captureRef, setCaptureRef] = useState('');
  const saveCapture = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id) return;
    await act(
      () =>
        broker.capturePayment(id, {
          amount: captureAmount,
          method: captureMethod,
          reference: captureRef,
        }),
      'Buyer payment captured — farmer leg + commission leg booked'
    );
    setCaptureModal(false);
  };

  // --- disputes ---
  const [disputeModal, setDisputeModal] = useState(false);
  const [disputeCategory, setDisputeCategory] = useState('payment');
  const [disputeReason, setDisputeReason] = useState('');
  const saveDispute = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id) return;
    await act(() => broker.openDealDispute(id, { category: disputeCategory, reason: disputeReason }), 'Dispute opened — evidence frozen, 72h SLA');
    setDisputeModal(false);
  };

  // --- escalate ---
  const [escalateModal, setEscalateModal] = useState(false);
  const [escalateReason, setEscalateReason] = useState('');
  const saveEscalate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id) return;
    await act(() => broker.escalateDeal(id, escalateReason), 'Deal escalated to mediator pool');
    setEscalateModal(false);
  };

  // --- documents ---
  const [contract, setContract] = useState<Rec | null>(null);
  const [receipt, setReceipt] = useState<Rec | null>(null);
  const showContract = async () => {
    if (!id) return;
    setActionError(null);
    try {
      setContract(rec(await broker.dealContract(id)));
    } catch (err) {
      setActionError(apiErrorMessage(err));
    }
  };
  const showReceipt = async () => {
    if (!id) return;
    setActionError(null);
    try {
      setReceipt(rec(await broker.dealReceipt(id)));
    } catch (err) {
      setActionError(apiErrorMessage(err));
    }
  };

  const openChatRoom = async () => {
    if (!id) return;
    setActionError(null);
    try {
      const room = rec(await broker.dealChatRoom(id));
      setNotice(`Chat room ready: ${str(room.name ?? room.id, 'deal room')} — continue in Chat`);
    } catch (err) {
      setActionError(apiErrorMessage(err));
    }
  };

  const status = str(deal?.status, 'negotiating');
  const idx = STATUS_FLOW.indexOf(status);
  const gross = num(deal?.grossAmount ?? deal?.grossRupees);
  const commission = num(deal?.commissionAmount ?? deal?.commissionRupees);
  const vaultFiles = arr(vault.files ?? vault.items ?? vault.documents).map(rec);
  const escrow = rec(deal?.escrow);
  const evidenceFrozen = str(deal?.evidenceFrozenAt ?? '') !== '' || disputes.some((d) => !['resolved', 'rejected'].includes(str(d.status)));

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 border-b border-slate-200 pb-4 flex-wrap">
        <Link to="/broker" className={ghostBtnCls}>
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div className="flex-1 min-w-40">
          <h1 className="text-2xl font-extrabold text-slate-900">
            Deal #{id}
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            {deal ? `${str(deal.commodity)} · ${str(deal.variety)} ${str(deal.grade)} · ${formatWeight(num(deal.quantityQuintals))}` : 'Loading deal…'}
          </p>
        </div>
        {deal && <StatusBadge status={status} />}
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
      {evidenceFrozen && (
        <div className="p-3 rounded-2xl bg-amber-50 border border-amber-200 text-amber-800 text-xs font-semibold flex items-center gap-2">
          <AlertTriangle className="w-4 h-4" /> Evidence is frozen — an open dispute locks the vault until resolution
        </div>
      )}

      {loading ? (
        <LoadingBlock />
      ) : !deal ? null : (
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          <div className="lg:col-span-3 space-y-4">
            {/* status flow */}
            <div className={`${cardCls} p-5`}>
              <div className="flex items-center gap-1.5 text-[10px] font-bold overflow-x-auto pb-1">
                {STATUS_FLOW.map((s, i) => (
                  <span
                    key={s}
                    className={`px-2.5 py-1.5 rounded-xl whitespace-nowrap ${
                      i === idx ? 'bg-emerald-600 text-white' : i < idx ? 'text-emerald-700' : 'text-slate-400'
                    }`}
                  >
                    {i + 1}. {s.replace(/_/g, ' ')}
                  </span>
                ))}
                {['cancelled', 'expired'].includes(status) && (
                  <span className="px-2.5 py-1 rounded-xl bg-rose-100 text-rose-700">{status}</span>
                )}
              </div>
              {str(deal.expiresAt) && ['negotiating', 'contract_issued'].includes(status) && (
                <p className="text-[10px] text-amber-700 font-bold mt-2">
                  Farmer offer TTL: expires {formatDateTime(str(deal.expiresAt))}
                </p>
              )}
            </div>

            {/* lifecycle actions */}
            <div className={`${cardCls} p-5 space-y-3`}>
              <h3 className="font-bold text-sm text-slate-900">Deal Actions</h3>
              <div className="flex flex-wrap gap-2">
                {status === 'negotiating' && (
                  <button onClick={() => setStatus('contract_issued')} className={primaryBtnCls}>
                    <FileSignature className="w-3.5 h-3.5 inline mr-1" /> Issue Contract
                  </button>
                )}
                {status === 'contract_issued' && (
                  <span className="text-xs text-slate-500 self-center">Waiting for farmer accept/decline — nudge them via the thread below</span>
                )}
                {status === 'accepted' && (
                  <>
                    <button onClick={() => setStatus('in_transit')} className={primaryBtnCls}>
                      <Truck className="w-3.5 h-3.5 inline mr-1" /> Mark In Transit
                    </button>
                    <button onClick={() => { setCaptureAmount(gross); setCaptureModal(true); }} className={ghostBtnCls}>
                      <HandCoins className="w-3.5 h-3.5 inline mr-1" /> Capture Payment
                    </button>
                  </>
                )}
                {status === 'in_transit' && (
                  <>
                    <button onClick={() => setMsModal(true)} className={ghostBtnCls}>
                      <Milestone className="w-3.5 h-3.5 inline mr-1" /> Add Milestone
                    </button>
                    <button
                      onClick={() => void act(() => broker.releasePayout(str(deal.id)), 'Payout released to farmer')}
                      className={primaryBtnCls}
                    >
                      <HandCoins className="w-3.5 h-3.5 inline mr-1" /> Release Payout
                    </button>
                    <button onClick={() => setStatus('completed')} className={ghostBtnCls}>
                      <ShieldCheck className="w-3.5 h-3.5 inline mr-1" /> Complete Deal
                    </button>
                  </>
                )}
                {['accepted', 'in_transit', 'completed'].includes(status) && (
                  <button onClick={() => setVehicleModal(true)} className={ghostBtnCls}>
                    <Truck className="w-3.5 h-3.5 inline mr-1" /> Vehicle
                  </button>
                )}
                <button onClick={() => void openChatRoom()} className={ghostBtnCls}>
                  <MessageSquare className="w-3.5 h-3.5 inline mr-1" /> Chat Room
                </button>
                <button onClick={() => void showContract()} className={ghostBtnCls}>
                  <FileText className="w-3.5 h-3.5 inline mr-1" /> Contract
                </button>
                <button onClick={() => void showReceipt()} className={ghostBtnCls}>
                  <Receipt className="w-3.5 h-3.5 inline mr-1" /> Receipt
                </button>
                {['negotiating', 'contract_issued', 'accepted'].includes(status) && (
                  <>
                    <button onClick={() => setDisputeModal(true)} className={ghostBtnCls}>
                      <Gavel className="w-3.5 h-3.5 inline mr-1" /> Dispute
                    </button>
                    <button onClick={() => setEscalateModal(true)} className={ghostBtnCls}>
                      <Swords className="w-3.5 h-3.5 inline mr-1" /> Escalate
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* negotiation thread */}
            <div className={`${cardCls} p-5 space-y-3`}>
              <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-emerald-600" />
                Negotiation Thread ({messages.length})
              </h3>
              {messages.length === 0 ? (
                <EmptyState label="No messages yet — send the first offer below" />
              ) : (
                <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
                  {messages.map((m) => {
                    const mine = str(m.senderRole) === 'broker';
                    return (
                      <div key={str(m.id)} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[80%] p-2.5 rounded-2xl text-xs ${
                          mine ? 'bg-emerald-600 text-white rounded-br-sm' : 'bg-slate-100 text-slate-800 rounded-bl-sm'
                        }`}>
                          <span className="text-[9px] font-bold uppercase tracking-wider block opacity-70">
                            {str(m.senderRole, 'party')} · {str(m.createdAt) ? formatDateTime(str(m.createdAt)) : ''}
                          </span>
                          <span className="font-semibold">{str(m.text)}</span>
                          {num(m.amountOffer) > 0 && (
                            <span className={`block font-black mt-0.5 ${mine ? 'text-emerald-100' : 'text-emerald-700'}`}>
                              Offer: {formatCurrency(num(m.amountOffer))}/q
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
              <form onSubmit={(e) => void postMessage(e)} className="flex gap-2 items-end pt-1">
                <div className="flex-1">
                  <input
                    className={inputCls}
                    placeholder="Message (phone numbers & UPI IDs are blocked)…"
                    value={msgText}
                    onChange={(e) => setMsgText(e.target.value)}
                  />
                </div>
                <div className="w-28">
                  <input
                    type="number"
                    className={inputCls}
                    placeholder="₹/q offer"
                    value={msgAmount || ''}
                    onChange={(e) => setMsgAmount(Number(e.target.value))}
                  />
                </div>
                <button type="submit" className={primaryBtnCls} disabled={!msgText.trim()}>
                  <Send className="w-4 h-4" />
                </button>
              </form>
            </div>

            {/* milestones */}
            <div className={`${cardCls} p-5 space-y-2`}>
              <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
                <Milestone className="w-4 h-4 text-emerald-600" />
                Delivery Milestones
              </h3>
              {milestones.length === 0 ? (
                <EmptyState label="No milestones — departed → arrived → loading → in-transit → weighed → delivered" />
              ) : (
                <div className="space-y-1.5">
                  {milestones.map((m) => (
                    <div key={str(m.id ?? m.event)} className="flex items-center gap-2 p-2 bg-slate-50 rounded-xl text-xs">
                      <span className="w-2 h-2 rounded-full bg-emerald-500 flex-shrink-0" />
                      <span className="font-bold text-slate-800 capitalize">{str(m.event, 'event').replace(/_/g, ' ')}</span>
                      {str(m.location) && <span className="text-slate-500">· {str(m.location)}</span>}
                      {str(m.note) && <span className="text-slate-500">— {str(m.note)}</span>}
                      <span className="ml-auto text-[10px] text-slate-400">{str(m.createdAt) ? formatDateTime(str(m.createdAt)) : ''}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* disputes */}
            <div className={`${cardCls} p-5 space-y-2`}>
              <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
                <Gavel className="w-4 h-4 text-emerald-600" />
                Disputes ({disputes.length})
              </h3>
              {disputes.length === 0 ? (
                <EmptyState label="No disputes on this deal" />
              ) : (
                <div className="space-y-1.5">
                  {disputes.map((d) => (
                    <div key={str(d.id)} className="p-2.5 bg-rose-50 border border-rose-100 rounded-xl text-xs">
                      <div className="flex justify-between">
                        <span className="font-bold text-rose-800 capitalize">{str(d.category, 'other')}</span>
                        <StatusBadge status={str(d.status, 'open')} />
                      </div>
                      <p className="text-rose-700 mt-0.5">{str(d.reason)}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="lg:col-span-2 space-y-4">
            {/* parties & terms */}
            <div className={`${cardCls} p-5 space-y-3`}>
              <h3 className="font-bold text-sm text-slate-900">Parties & Terms</h3>
              <div className="text-xs space-y-2">
                <div className="flex justify-between"><span className="text-slate-500">Farmer (seller)</span><span className="font-bold text-slate-800">{str(deal.sellerName)}</span></div>
                <div className="flex justify-between"><span className="text-slate-500">Buyer</span><span className="font-bold text-slate-800">{str(deal.buyerName)}</span></div>
                <div className="flex justify-between"><span className="text-slate-500">Agreed rate</span><span className="font-bold text-slate-800">{formatCurrency(num(deal.agreedRate))}/q</span></div>
                <div className="flex justify-between"><span className="text-slate-500">Gross</span><span className="font-bold text-slate-900">{formatCurrency(gross)}</span></div>
                <div className="flex justify-between"><span className="text-slate-500">My brokerage</span><span className="font-black text-emerald-700">+{formatCurrency(commission)}</span></div>
                <div className="flex justify-between"><span className="text-slate-500">Delivery</span><span className="font-semibold text-slate-700 text-right">{str(deal.deliveryLocation)}</span></div>
                <div className="flex justify-between"><span className="text-slate-500">Payment terms</span><span className="font-semibold text-slate-700 text-right">{str(deal.paymentTerms)}</span></div>
                {num(escrow.farmerLegPaisa) > 0 && (
                  <div className="flex justify-between"><span className="text-slate-500">Farmer leg</span><span className="font-semibold text-slate-700">{formatCurrency(paisaToRupees(escrow.farmerLegPaisa))}</span></div>
                )}
              </div>
              {str(deal.notes) && (
                <p className="text-[11px] text-slate-500 bg-slate-50 rounded-xl p-2.5">{str(deal.notes)}</p>
              )}
            </div>

            {/* evidence vault */}
            <div className={`${cardCls} p-5 space-y-3`}>
              <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
                <Camera className="w-4 h-4 text-emerald-600" />
                Evidence Vault
              </h3>
              <div className="flex gap-2">
                <select className={`${inputCls} flex-1`} value={uploadKind} onChange={(e) => setUploadKind(e.target.value)}>
                  {EVIDENCE_KINDS.map((k) => (
                    <option key={k} value={k}>{k.replace(/_/g, ' ')}</option>
                  ))}
                </select>
                <button
                  onClick={() => fileRef.current?.click()}
                  className={ghostBtnCls}
                  disabled={evidenceFrozen}
                  title={evidenceFrozen ? 'Evidence frozen by dispute' : 'Upload photo'}
                >
                  <Camera className="w-4 h-4" />
                </button>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) void uploadEvidence(f);
                  }}
                />
              </div>
              {vaultFiles.length === 0 ? (
                <p className="text-[11px] text-slate-400">Weigh slips, quality reports, payment proofs — max 5 per kind, 20 total. Vault unlocks once the deal is accepted.</p>
              ) : (
                <div className="space-y-1.5">
                  {vaultFiles.map((f) => (
                    <div key={str(f.id ?? f.url)} className="flex items-center gap-2 p-2 bg-slate-50 rounded-xl text-xs">
                      <FileText className="w-3.5 h-3.5 text-slate-400" />
                      <span className="font-semibold text-slate-700 capitalize">{str(f.kind, 'file').replace(/_/g, ' ')}</span>
                      <span className="ml-auto text-[10px] text-slate-400">{str(f.uploadedBy ?? f.createdAt)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* documents panel */}
            {contract && (
              <div className={`${cardCls} p-5 space-y-2`}>
                <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
                  <FileSignature className="w-4 h-4 text-emerald-600" /> Tripartite Contract
                </h3>
                <div className="text-xs space-y-1.5">
                  <div className="flex justify-between"><span className="text-slate-500">Reference</span><span className="font-mono font-bold">{str(contract.number ?? contract.id ?? '—')}</span></div>
                  <div className="flex justify-between"><span className="text-slate-500">Status</span><StatusBadge status={str(contract.status, status)} /></div>
                  {arr(contract.terms ?? contract.clauses).map((c, i) => (
                    <p key={i} className="text-slate-600 bg-slate-50 rounded-lg p-2">{str(c)}</p>
                  ))}
                  {str(contract.termsText) && <p className="text-slate-600 bg-slate-50 rounded-lg p-2">{str(contract.termsText)}</p>}
                </div>
              </div>
            )}
            {receipt && (
              <div className={`${cardCls} p-5 space-y-2`}>
                <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
                  <Receipt className="w-4 h-4 text-emerald-600" /> Deal Receipt
                </h3>
                <div className="text-xs space-y-1.5">
                  <div className="flex justify-between"><span className="text-slate-500">Receipt No</span><span className="font-mono font-bold">{str(receipt.number ?? receipt.receiptNo ?? '—')}</span></div>
                  <div className="flex justify-between"><span className="text-slate-500">Gross</span><span className="font-bold">{formatCurrency(num(receipt.grossAmount ?? receipt.grossRupees))}</span></div>
                  <div className="flex justify-between"><span className="text-slate-500">Farmer payout</span><span className="font-semibold">{formatCurrency(num(receipt.farmerPayout ?? receipt.farmerLegRupees))}</span></div>
                  <div className="flex justify-between"><span className="text-slate-500">Brokerage</span><span className="font-black text-emerald-700">+{formatCurrency(num(receipt.commissionAmount ?? receipt.commissionRupees))}</span></div>
                  <button
                    onClick={() => {
                      const blob = new Blob([JSON.stringify(receipt, null, 2)], { type: 'application/json' });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement('a');
                      a.href = url;
                      a.download = `receipt-${id}.json`;
                      a.click();
                      URL.revokeObjectURL(url);
                    }}
                    className={ghostBtnCls}
                  >
                    <Download className="w-3.5 h-3.5 inline mr-1" /> Download JSON
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* vehicle modal */}
      <ModalSheet isOpen={vehicleModal} onClose={() => setVehicleModal(false)} title="Vehicle Details" description="Type, masked plate and driver — shared with the farmer on in-transit" maxWidth="sm">
        <form onSubmit={(e) => void saveVehicle(e)} className="space-y-3">
          <div>
            <label className={labelCls}>Vehicle Type</label>
            <select className={inputCls} value={vehType} onChange={(e) => setVehType(e.target.value)}>
              <option value="">Select…</option>
              <option>Tempo</option>
              <option>Mini Truck (1T)</option>
              <option>Truck (10T)</option>
              <option>Tractor Trolley</option>
              <option>Pickup</option>
            </select>
          </div>
          <div>
            <label className={labelCls}>Plate No</label>
            <input className={inputCls} placeholder="MH 12 AB 3456" value={vehPlate} onChange={(e) => setVehPlate(e.target.value)} />
          </div>
          <div>
            <label className={labelCls}>Driver Name</label>
            <input className={inputCls} value={vehDriver} onChange={(e) => setVehDriver(e.target.value)} />
          </div>
          <button type="submit" className={`${primaryBtnCls} w-full py-3`}>Save Vehicle</button>
        </form>
      </ModalSheet>

      {/* milestone modal */}
      <ModalSheet isOpen={msModal} onClose={() => setMsModal(false)} title="Record Milestone" description=" departed → arrived → loading → in-transit → arrived-at-mandi → weighed → delivered" maxWidth="sm">
        <form onSubmit={(e) => void saveMilestone(e)} className="space-y-3">
          <div>
            <label className={labelCls}>Event</label>
            <select className={inputCls} value={msEvent} onChange={(e) => setMsEvent(e.target.value)}>
              {['departed', 'arrived', 'loading', 'in_transit', 'arrived_at_mandi', 'weighed', 'delivered'].map((e2) => (
                <option key={e2} value={e2}>{e2.replace(/_/g, ' ')}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelCls}>Location</label>
            <input className={inputCls} value={msLocation} onChange={(e) => setMsLocation(e.target.value)} />
          </div>
          <div>
            <label className={labelCls}>Note</label>
            <textarea rows={2} className={inputCls} value={msNote} onChange={(e) => setMsNote(e.target.value)} />
          </div>
          <button type="submit" className={`${primaryBtnCls} w-full py-3`}>Record Milestone</button>
        </form>
      </ModalSheet>

      {/* capture modal */}
      <ModalSheet isOpen={captureModal} onClose={() => setCaptureModal(false)} title="Capture Buyer Payment" description="Splits into farmer leg + your commission leg. Requires verified arhtiya licence + GST KYC" maxWidth="sm">
        <form onSubmit={(e) => void saveCapture(e)} className="space-y-3">
          <div>
            <label className={labelCls}>Amount (₹)</label>
            <input type="number" className={inputCls} value={captureAmount} onChange={(e) => setCaptureAmount(Number(e.target.value))} required />
          </div>
          <div>
            <label className={labelCls}>Method</label>
            <select className={inputCls} value={captureMethod} onChange={(e) => setCaptureMethod(e.target.value)}>
              <option value="bank_transfer">Bank Transfer</option>
              <option value="upi">UPI</option>
              <option value="cheque">Cheque</option>
              <option value="cash">Cash</option>
            </select>
          </div>
          <div>
            <label className={labelCls}>Reference / UTR</label>
            <input className={inputCls} value={captureRef} onChange={(e) => setCaptureRef(e.target.value)} />
          </div>
          <button type="submit" className={`${primaryBtnCls} w-full py-3`}>Capture Payment</button>
        </form>
      </ModalSheet>

      {/* dispute modal */}
      <ModalSheet isOpen={disputeModal} onClose={() => setDisputeModal(false)} title="Open Dispute" description="Evidence freezes immediately — 72h admin SLA" maxWidth="sm">
        <form onSubmit={(e) => void saveDispute(e)} className="space-y-3">
          <div>
            <label className={labelCls}>Category</label>
            <select className={inputCls} value={disputeCategory} onChange={(e) => setDisputeCategory(e.target.value)}>
              <option value="payment">Payment</option>
              <option value="quality">Quality</option>
              <option value="delivery">Delivery</option>
              <option value="other">Other</option>
            </select>
          </div>
          <div>
            <label className={labelCls}>Reason</label>
            <textarea rows={3} className={inputCls} value={disputeReason} onChange={(e) => setDisputeReason(e.target.value)} required />
          </div>
          <button type="submit" className={`${primaryBtnCls} w-full py-3`}>Open Dispute</button>
        </form>
      </ModalSheet>

      {/* escalate modal */}
      <ModalSheet isOpen={escalateModal} onClose={() => setEscalateModal(false)} title="Escalate to Mediator" description="Deadlocked counters or stuck deals go to the admin mediator pool" maxWidth="sm">
        <form onSubmit={(e) => void saveEscalate(e)} className="space-y-3">
          <div>
            <label className={labelCls}>Reason</label>
            <textarea rows={3} className={inputCls} value={escalateReason} onChange={(e) => setEscalateReason(e.target.value)} required />
          </div>
          <button type="submit" className={`${primaryBtnCls} w-full py-3`}>Escalate Deal</button>
        </form>
      </ModalSheet>
    </div>
  );
};
