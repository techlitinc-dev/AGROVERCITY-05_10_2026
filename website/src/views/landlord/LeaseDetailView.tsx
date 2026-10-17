import React, { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  FileText,
  PenLine,
  KeyRound,
  Landmark,
  CalendarClock,
  ShieldAlert,
  Wheat,
  HandCoins,
  Download,
  Check,
  X,
  RefreshCw,
  MessageSquare,
  FileDown,
} from 'lucide-react';
import { land, apiClient, apiErrorMessage } from '../../lib/api';
import { ModalSheet } from '../../components/common/ModalSheet';
import { StatusBadge } from '../../components/common/StatusBadge';
import { formatCurrency } from '../../lib/utils';
import { asArr, asRec, boolVal, downloadBlob, firstNum, firstStr, fmtDate, str, type Rec } from './utils';

type TabId =
  | 'agreement'
  | 'esign'
  | 'handover'
  | 'milestones'
  | 'payments'
  | 'renewals'
  | 'harvest'
  | 'disputes'
  | 'danger';

const TABS: { id: TabId; label: string; icon: React.ElementType }[] = [
  { id: 'agreement', label: 'Agreement', icon: FileText },
  { id: 'esign', label: 'E-Sign', icon: PenLine },
  { id: 'handover', label: 'Handover', icon: KeyRound },
  { id: 'milestones', label: 'Milestones & Escrow', icon: Landmark },
  { id: 'payments', label: 'Payments', icon: HandCoins },
  { id: 'renewals', label: 'Renewals', icon: CalendarClock },
  { id: 'harvest', label: 'Harvest', icon: Wheat },
  { id: 'disputes', label: 'Disputes', icon: ShieldAlert },
  { id: 'danger', label: 'Terminate', icon: ShieldAlert },
];

const CHECKLIST_ITEMS = [
  'Boundary stones demarcated',
  'Water source / borewell motor operational',
  'Electricity meter reading noted',
  'Existing crops / standing crop recorded',
  'Drip lines & fencing intact',
  'Keys / plot access handed over',
];

const HARVEST_SEASONS = ['kharif', 'rabi', 'zaid', 'annual'];

/** /landlord/leases/:id — full lease lifecycle desk. */
export const LeaseDetailView: React.FC = () => {
  const { id = '' } = useParams();
  const [lease, setLease] = useState<Rec>({});
  const [tab, setTab] = useState<TabId>('agreement');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // sub-resources
  const [milestones, setMilestones] = useState<Rec[]>([]);
  const [payments, setPayments] = useState<Rec[]>([]);
  const [renewals, setRenewals] = useState<Rec[]>([]);
  const [declarations, setDeclarations] = useState<Rec[]>([]);
  const [handover, setHandover] = useState<Rec | null>(null);

  // modals
  const [esignModal, setEsignModal] = useState(false);
  const [esignName, setEsignName] = useState('');
  const [esignConsent, setEsignConsent] = useState(false);
  const [esignMpin, setEsignMpin] = useState('');
  const [payModal, setPayModal] = useState(false);
  const [payForm, setPayForm] = useState({ amountRupees: 0, month: '', method: 'upi', paidAt: '' });
  const [renewModal, setRenewModal] = useState(false);
  const [renewForm, setRenewForm] = useState({ extensionMonths: 11, newRentRupees: 0, note: '' });
  const [respondRenewal, setRespondRenewal] = useState<Rec | null>(null);
  const [respondAction, setRespondAction] = useState<'accept' | 'decline'>('accept');
  const [respondReason, setRespondReason] = useState('');
  const [terminateModal, setTerminateModal] = useState(false);
  const [terminateReason, setTerminateReason] = useState('');
  const [disputeModal, setDisputeModal] = useState(false);
  const [disputeForm, setDisputeForm] = useState({ category: 'payment_default', note: '' });
  const [harvestModal, setHarvestModal] = useState(false);
  const [harvestForm, setHarvestForm] = useState({ crop: '', season: 'kharif', areaAcres: 0, yieldQuintals: 0, saleRatePerQuintal: 0 });
  const [handoverModal, setHandoverModal] = useState(false);
  const [handoverType, setHandoverType] = useState<'move_in' | 'move_out'>('move_in');
  const [handoverNotes, setHandoverNotes] = useState('');
  const [handoverPhotos, setHandoverPhotos] = useState('');
  const [checklist, setChecklist] = useState<Record<string, 'good' | 'fair' | 'damaged' | undefined>>({});

  const loadLease = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      // NOTE: land.ts has no single-lease GET; use list + find (backend has no
      // GET /land/leases/{id} either — list + find mirrors the backend).
      const all = await land.leases();
      const found = asArr(all).map(asRec).find((l) => str(l.id) === id);
      setLease(found ?? {});
      if (!found) setError('Lease not found.');
    } catch (e) {
      setError(apiErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }, [id]);

  const loadTabData = useCallback(async () => {
    if (!id) return;
    try {
      if (tab === 'milestones') {
        // GET returns a milestones doc {leaseId, milestones: [...]}, not a list.
        const doc = await land.leaseMilestones(id);
        setMilestones(asArr(asRec(doc).milestones).map(asRec));
      }
      if (tab === 'payments') setPayments(asArr(await land.rentPayments(id)).map(asRec));
      if (tab === 'renewals') setRenewals(asArr(await land.leaseRenewals(id)).map(asRec));
      if (tab === 'harvest') setDeclarations(asArr(await land.harvestDeclarations(id)).map(asRec));
      if (tab === 'handover') setHandover(asRec(await land.leaseHandoverStatus(id)));
    } catch {
      /* sub-resource failures degrade silently per-tab */
    }
  }, [id, tab]);

  useEffect(() => {
    loadLease();
  }, [loadLease]);

  useEffect(() => {
    loadTabData();
  }, [loadTabData]);

  const flash = (msg: string) => {
    setNotice(msg);
    setTimeout(() => setNotice(null), 4000);
  };

  const run = async (fn: () => Promise<unknown>, msg: string, close?: () => void) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
      flash(msg);
      close?.();
      await Promise.all([loadLease(), loadTabData()]);
    } catch (e) {
      setError(apiErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const downloadFile = async (url: string, filename: string) => {
    setBusy(true);
    setError(null);
    try {
      const res = await apiClient.get(url, { responseType: 'blob' });
      downloadBlob(filename, res.data as Blob);
    } catch (e) {
      setError(apiErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const downloadAgreement = () => downloadFile(`/land/leases/${id}/agreement-pdf`, `lease-agreement-${id}.pdf`);

  const downloadReceipt = (paymentId: string) =>
    downloadFile(`/land/rent-payments/${paymentId}/receipt`, `rent-receipt-${paymentId}.pdf`);

  const downloadLedger = (format: 'csv' | 'pdf') =>
    downloadFile(`/land/leases/${id}/ledger?format=${format}`, `rent-ledger-${id}.${format}`);

  /** Lease disputes require an Idempotency-Key header (400 otherwise). */
  const submitDispute = async (e: React.FormEvent) => {
    e.preventDefault();
    await run(async () => {
      await apiClient.post(
        `/land/leases/${id}/disputes`,
        { category: disputeForm.category, note: disputeForm.note || undefined },
        { headers: { 'Idempotency-Key': `lease-dispute-${id}-${Date.now()}` } }
      );
    }, 'Dispute opened — escrow held pending review.', () => {
      setDisputeModal(false);
      setDisputeForm({ category: 'payment_default', note: '' });
    });
  };

  const openChatRoom = async () => {
    setBusy(true);
    setError(null);
    try {
      const room = asRec(await land.leaseChatRoom(id));
      const link = firstStr(room, ['deepLink', 'deep_link'], '');
      flash(link ? `Chat room ready: ${link}` : 'Chat room created — find it under Chat.');
    } catch (e) {
      setError(apiErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const status = str(lease.status, '—');
  const monthlyRent = firstNum(lease, ['monthlyRentRupees', 'annualRent', 'rent'], 0);
  const landlordSigned = boolVal(lease.landlordSigned ?? lease.landlordEsigned);
  const tenantSigned = boolVal(lease.tenantSigned ?? lease.farmerSigned ?? lease.tenantEsigned);

  if (loading && Object.keys(lease).length === 0) {
    return <div className="p-10 text-center text-xs text-slate-400 bg-white rounded-3xl border border-slate-200">Loading lease…</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <Link to="/landlord" className="text-xs text-slate-400 hover:text-slate-600 flex items-center gap-1 mb-1">
            <ArrowLeft className="w-3.5 h-3.5" /> Landlord Home
          </Link>
          <h1 className="text-2xl font-extrabold text-slate-900 flex items-center gap-2">
            <FileText className="w-7 h-7 text-emerald-600" />
            Lease {firstStr(lease, ['leaseNumber', 'code'], id)}
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Tenant: {firstStr(lease, ['tenantName', 'farmerName'], '—')} • Plot: {firstStr(lease, ['plotTitle', 'plotName', 'listingTitle', 'title'], '—')} • Rent:{' '}
            {formatCurrency(monthlyRent)}/mo • {fmtDate(lease.startDate)} → {fmtDate(lease.endDate)}
            {str(lease.rentModel, '') !== '—' && str(lease.rentModel) !== 'fixed' ? ` • ${str(lease.rentModel)}` : ''}
          </p>
        </div>
        <div className="flex items-center gap-2 self-start sm:self-auto">
          <StatusBadge status={status} />
          <button onClick={() => { loadLease(); loadTabData(); }} className="p-2.5 rounded-2xl border border-slate-200 text-slate-500 hover:bg-slate-50" title="Refresh">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {notice && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl text-xs font-bold text-emerald-900 flex items-center gap-2">
          <Check className="w-5 h-5 text-emerald-600" />
          <span>{notice}</span>
        </div>
      )}
      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl text-xs font-bold text-rose-800 flex items-center justify-between gap-2">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="p-1 hover:bg-rose-100 rounded-full">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Tabs */}
      <div className="flex bg-slate-100 p-1 rounded-2xl overflow-x-auto no-scrollbar gap-1">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all flex items-center gap-1.5 ${
              tab === t.id ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <t.icon className="w-3.5 h-3.5" />
            {t.label}
          </button>
        ))}
      </div>

      {/* Agreement */}
      {tab === 'agreement' && (
        <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs space-y-4">
          <h3 className="font-bold text-sm text-slate-900">Lease Agreement Document</h3>
          <p className="text-xs text-slate-500">
            Download the digitally generated lease agreement PDF with terms, rent schedule, and escrow clauses.
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={downloadAgreement}
              disabled={busy}
              className="px-4 py-2.5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs flex items-center gap-2 disabled:opacity-60"
            >
              <Download className="w-4 h-4" /> Download Agreement PDF
            </button>
            <button
              onClick={() => setTab('esign')}
              className="px-4 py-2.5 rounded-2xl border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold text-xs flex items-center gap-2"
            >
              <PenLine className="w-4 h-4" /> Go to E-Sign
            </button>
            <button
              onClick={openChatRoom}
              disabled={busy}
              className="px-4 py-2.5 rounded-2xl border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold text-xs flex items-center gap-2 disabled:opacity-60"
            >
              <MessageSquare className="w-4 h-4" /> Open Tenant Chat
            </button>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs pt-2">
            <div className="p-3 bg-slate-50 rounded-2xl">
              <span className="text-slate-400 text-[10px] uppercase font-bold">Start</span>
              <p className="font-bold text-slate-900">{fmtDate(lease.startDate)}</p>
            </div>
            <div className="p-3 bg-slate-50 rounded-2xl">
              <span className="text-slate-400 text-[10px] uppercase font-bold">End</span>
              <p className="font-bold text-slate-900">{fmtDate(lease.endDate)}</p>
            </div>
            <div className="p-3 bg-slate-50 rounded-2xl">
              <span className="text-slate-400 text-[10px] uppercase font-bold">Monthly Rent</span>
              <p className="font-bold text-slate-900">{formatCurrency(monthlyRent)}</p>
            </div>
            <div className="p-3 bg-slate-50 rounded-2xl">
              <span className="text-slate-400 text-[10px] uppercase font-bold">Escrow</span>
              <p className="font-bold text-emerald-800">{str(lease.escrowStatus, boolVal(lease.escrowFunded) ? 'Funded' : 'Not funded')}</p>
            </div>
          </div>
        </div>
      )}

      {/* E-sign */}
      {tab === 'esign' && (
        <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs space-y-4">
          <h3 className="font-bold text-sm text-slate-900">E-Signature Status</h3>
          <div className="grid sm:grid-cols-2 gap-3 text-xs">
            <div className={`p-4 rounded-2xl border ${landlordSigned ? 'bg-emerald-50 border-emerald-200' : 'bg-slate-50 border-slate-200'}`}>
              <p className="font-bold text-slate-800">Landlord (You)</p>
              <p className={landlordSigned ? 'text-emerald-700 font-bold' : 'text-slate-500'}>
                {landlordSigned ? '✓ Signed' : 'Awaiting your signature'}
              </p>
            </div>
            <div className={`p-4 rounded-2xl border ${tenantSigned ? 'bg-emerald-50 border-emerald-200' : 'bg-slate-50 border-slate-200'}`}>
              <p className="font-bold text-slate-800">Tenant Farmer</p>
              <p className={tenantSigned ? 'text-emerald-700 font-bold' : 'text-slate-500'}>
                {tenantSigned ? '✓ Signed' : 'Awaiting tenant signature'}
              </p>
            </div>
          </div>
          {!landlordSigned && (
            <button
              onClick={() => {
                setEsignName(firstStr(lease, ['landlordName'], ''));
                setEsignMpin('');
                setEsignConsent(false);
                setEsignModal(true);
              }}
              disabled={busy}
              className="px-5 py-2.5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs disabled:opacity-60"
            >
              Sign as Landlord (MPIN e-Sign)
            </button>
          )}
        </div>
      )}

      {/* Handover */}
      {tab === 'handover' && (
        <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-sm text-slate-900">Plot Handover Checklist</h3>
            {handover && Object.keys(handover).length > 0 && <StatusBadge status={str(handover.type ?? handover.status, 'recorded')} />}
          </div>
          {handover && Object.keys(handover).length > 0 ? (
            <div className="text-xs space-y-2">
              <p className="text-slate-600">
                Handover ({str(handover.type, 'move_in')}) recorded on {fmtDate(handover.completedAt ?? handover.createdAt)}.
              </p>
              {Array.isArray(handover.checklist) && (
                <ul className="space-y-1">
                  {(handover.checklist as unknown[]).map((it, i) => (
                    <li key={i} className="p-2 bg-slate-50 rounded-xl flex items-center justify-between">
                      <span>• {typeof it === 'string' ? it : firstStr(asRec(it), ['label', 'name'], JSON.stringify(it))}</span>
                      {typeof it !== 'string' && <StatusBadge status={str(asRec(it).condition, 'good')} />}
                    </li>
                  ))}
                </ul>
              )}
              {str(handover.notes, '') !== '—' && <p className="italic text-slate-500">"{str(handover.notes)}"</p>}
            </div>
          ) : (
            <p className="text-xs text-slate-500">Handover not yet completed. Verify the checklist jointly with the tenant.</p>
          )}
          <button
            onClick={() => setHandoverModal(true)}
            className="px-4 py-2.5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs"
          >
            {handover && Object.keys(handover).length > 0 ? 'Record Next Handover' : 'Complete Handover'}
          </button>
        </div>
      )}

      {/* Milestones & Escrow */}
      {tab === 'milestones' && (
        <div className="space-y-4">
          <h3 className="font-bold text-sm text-slate-900">Escrow Milestones (30 / 40 / 30 of annual rent)</h3>

          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => run(() => land.fundLeaseEscrow(id), 'Escrow funding initiated.')}
              disabled={busy}
              className="px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-700 text-white font-bold text-xs disabled:opacity-60"
            >
              Fund Escrow
            </button>
          </div>

          {milestones.length === 0 ? (
            <div className="p-6 bg-white rounded-3xl border border-dashed border-slate-300 text-center text-xs text-slate-500">
              No milestones yet — they are seeded on first view (30/40/30 of annual rent).
            </div>
          ) : (
            <div className="space-y-3">
              {milestones.map((m, idx) => {
                const mStatus = str(m.status, 'pending');
                const mIndex = typeof m.index === 'number' ? m.index : idx;
                const released = mStatus === 'released';
                return (
                  <div key={mIndex} className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <p className="font-bold text-sm text-slate-900">
                        {firstStr(m, ['name', 'title', 'label'], `Milestone ${mIndex + 1}`)}
                        <span className="ml-2 text-[10px] font-bold text-slate-400">{firstNum(m, ['percentage'], 0)}%</span>
                      </p>
                      <p className="text-xs text-slate-400">
                        {formatCurrency(firstNum(m, ['amountRupees', 'amount'], 0))} • {firstStr(m, ['targetWindow'], '')}
                        {fmtDate(m.releaseDate) !== '—' ? ` • released ${fmtDate(m.releaseDate)}` : ''}
                      </p>
                      {str(m.notes, '') !== '—' && <p className="text-[11px] text-slate-500 italic">{str(m.notes)}</p>}
                    </div>
                    <div className="flex items-center gap-2">
                      <StatusBadge status={mStatus} />
                      {!released && (
                        <>
                          <button
                            onClick={() => run(() => apiClient.post(`/land/leases/${id}/milestones/${mIndex}/release`, {}), 'Milestone released from escrow.')}
                            disabled={busy}
                            className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs disabled:opacity-60"
                          >
                            Release
                          </button>
                          <button
                            onClick={() =>
                              run(
                                () => land.addLeaseMilestone(id, { milestoneIndex: mIndex, status: 'disputed', notes: 'Disputed by landlord' }),
                                'Milestone marked disputed — escrow held.'
                              )
                            }
                            disabled={busy}
                            className="px-3 py-1.5 rounded-xl border border-rose-200 text-rose-700 hover:bg-rose-50 font-bold text-xs disabled:opacity-60"
                          >
                            Dispute
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Payments */}
      {tab === 'payments' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-sm text-slate-900">Rent Payments</h3>
            <button
              onClick={() => {
                setPayForm({ amountRupees: monthlyRent, month: new Date().toISOString().slice(0, 7), method: 'upi', paidAt: new Date().toISOString().slice(0, 10) });
                setPayModal(true);
              }}
              className="px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-1"
            >
              <HandCoins className="w-3.5 h-3.5" /> Record Payment
            </button>
          </div>
          {payments.length === 0 ? (
            <div className="p-6 bg-white rounded-3xl border border-dashed border-slate-300 text-center text-xs text-slate-500">
              No payments recorded for this lease yet.
            </div>
          ) : (
            <div className="space-y-3">
              {payments.map((p) => {
                const paisa = firstNum(p, ['amountPaisa'], 0);
                const amount = paisa > 0 ? paisa / 100 : firstNum(p, ['amountRupees', 'amount'], 0);
                return (
                  <div key={str(p.id) || JSON.stringify(p).slice(0, 24)} className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <p className="font-bold text-sm text-slate-900">
                        {formatCurrency(amount)}
                        <span className="ml-2 text-xs font-bold text-slate-400">{str(p.month, '') !== '—' ? `for ${str(p.month)}` : ''}</span>
                      </p>
                      <p className="text-xs text-slate-400">
                        {fmtDate(p.paidAt ?? p.date)} • {firstStr(p, ['method', 'mode'], '—')}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {str(p.id, '') && (
                        <button
                          onClick={() => downloadReceipt(str(p.id))}
                          disabled={busy}
                          className="px-3 py-1.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold text-xs flex items-center gap-1 disabled:opacity-60"
                        >
                          <Download className="w-3.5 h-3.5" /> Receipt PDF
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          <div className="flex flex-wrap gap-2 justify-end">
            <button
              onClick={() => downloadLedger('csv')}
              disabled={busy}
              className="px-4 py-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold text-xs flex items-center gap-1.5 disabled:opacity-60"
            >
              <FileDown className="w-3.5 h-3.5" /> Export Ledger (CSV)
            </button>
            <button
              onClick={() => downloadLedger('pdf')}
              disabled={busy}
              className="px-4 py-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold text-xs flex items-center gap-1.5 disabled:opacity-60"
            >
              <FileDown className="w-3.5 h-3.5" /> Export Ledger (PDF)
            </button>
          </div>
        </div>
      )}

      {/* Renewals */}
      {tab === 'renewals' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-sm text-slate-900">Renewal Requests</h3>
            <button
              onClick={() => {
                setRenewForm({ extensionMonths: 11, newRentRupees: monthlyRent, note: '' });
                setRenewModal(true);
              }}
              className="px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs"
            >
              Propose Renewal
            </button>
          </div>
          {renewals.length === 0 ? (
            <div className="p-6 bg-white rounded-3xl border border-dashed border-slate-300 text-center text-xs text-slate-500">
              No renewal proposals yet.
            </div>
          ) : (
            <div className="space-y-3">
              {renewals.map((r) => {
                const rStatus = str(r.status, 'proposed');
                const isPending = ['pending', 'proposed', 'requested'].includes(rStatus);
                const rent = firstNum(r, ['newRentRupees', 'proposedRent', 'annualRent'], 0);
                return (
                  <div key={str(r.id) || JSON.stringify(r).slice(0, 24)} className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <p className="font-bold text-sm text-slate-900">
                        +{firstNum(r, ['extensionMonths', 'years', 'proposedYears'], 0)} months
                        {rent > 0 ? ` @ ${formatCurrency(rent)}/mo` : ''}
                      </p>
                      <p className="text-xs text-slate-400">
                        {fmtDate(r.createdAt)} {str(r.note, '') !== '—' ? `• "${str(r.note)}"` : ''}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <StatusBadge status={rStatus} />
                      {isPending && str(r.id) && (
                        <button
                          onClick={() => {
                            setRespondRenewal(r);
                            setRespondAction('accept');
                            setRespondReason('');
                          }}
                          className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs"
                        >
                          Respond
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Harvest declarations */}
      {tab === 'harvest' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-sm text-slate-900">Harvest Declarations (Revenue Share)</h3>
            <button
              onClick={() => setHarvestModal(true)}
              className="px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-1"
            >
              <Wheat className="w-3.5 h-3.5" /> Add Declaration
            </button>
          </div>
          {declarations.length === 0 ? (
            <div className="p-6 bg-white rounded-3xl border border-dashed border-slate-300 text-center text-xs text-slate-500">
              No harvest declarations recorded.
            </div>
          ) : (
            <div className="space-y-3">
              {declarations.map((d) => {
                const dStatus = str(d.status, 'pending');
                const isPending = ['pending', 'declared'].includes(dStatus);
                const yieldQ = firstNum(d, ['yieldQuintals', 'quantityQuintal', 'quantity'], 0);
                const rate = firstNum(d, ['saleRatePerQuintal'], 0);
                return (
                  <div key={str(d.id) || JSON.stringify(d).slice(0, 24)} className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <p className="font-bold text-sm text-slate-900">
                        {firstStr(d, ['crop'], 'Crop')} — {yieldQ} q ({firstStr(d, ['season'], '—')})
                      </p>
                      <p className="text-xs text-slate-400">
                        {firstNum(d, ['areaAcres'], 0)} acres {rate > 0 ? `• ${formatCurrency(rate)}/q` : ''}
                        {yieldQ > 0 && rate > 0 ? ` • sale ${formatCurrency(yieldQ * rate)}` : ''}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <StatusBadge status={dStatus} />
                      {isPending && str(d.id) && (
                        <button
                          onClick={() => run(() => land.settleHarvestDeclaration(id, str(d.id)), 'Harvest declaration settled.')}
                          disabled={busy}
                          className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs disabled:opacity-60"
                        >
                          Settle
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Disputes */}
      {tab === 'disputes' && (
        <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-sm text-slate-900">Raise a Dispute</h3>
            <button
              onClick={() => setDisputeModal(true)}
              className="px-3 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs flex items-center gap-1"
            >
              <ShieldAlert className="w-3.5 h-3.5" /> Open Dispute
            </button>
          </div>
          <p className="text-xs text-slate-500">
            Disputes are reviewed by platform arbitration (SOP-07). Escrow funds are held until resolution.
            An Idempotency-Key is attached automatically so retries never double-file.
          </p>
        </div>
      )}

      {/* Terminate */}
      {tab === 'danger' && (
        <div className="bg-white rounded-3xl p-6 border border-rose-200 shadow-xs space-y-4">
          <h3 className="font-bold text-sm text-rose-900">Terminate Lease</h3>
          <p className="text-xs text-slate-500">
            Termination triggers the exit checklist, deposit reconciliation, and final settlement. This action is logged for
            dispute review.
          </p>
          <button
            onClick={() => setTerminateModal(true)}
            className="px-4 py-2.5 rounded-2xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs shadow-xs"
          >
            Terminate this Lease…
          </button>
        </div>
      )}

      {/* --- Modals --- */}

      <ModalSheet isOpen={esignModal} onClose={() => setEsignModal(false)} title="E-Sign Lease Agreement" description="MPIN-gated electronic signature with consent audit trail" maxWidth="sm">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            run(
              () =>
                land.esignLease(id, {
                  signatureData: esignName.trim(),
                  consentTimestamp: new Date().toISOString(),
                  mpin: esignMpin,
                }),
              'Lease e-signed.',
              () => setEsignModal(false)
            );
          }}
          className="space-y-3"
        >
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Sign (type your full name)</label>
            <input
              type="text"
              value={esignName}
              onChange={(e) => setEsignName(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300"
              placeholder="Sakharam Bhosale"
              required
            />
          </div>
          <label className="flex items-start gap-2 p-3 bg-slate-50 rounded-2xl cursor-pointer text-xs text-slate-700">
            <input
              type="checkbox"
              checked={esignConsent}
              onChange={(e) => setEsignConsent(e.target.checked)}
              className="w-4 h-4 mt-0.5 accent-emerald-600"
              required
            />
            I have read the lease agreement and consent to e-sign it digitally. My consent timestamp and MPIN verify this
            signature.
          </label>
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">MPIN (4 digits)</label>
            <input
              type="password"
              inputMode="numeric"
              maxLength={4}
              value={esignMpin}
              onChange={(e) => setEsignMpin(e.target.value.replace(/\D/g, '').slice(0, 4))}
              className="w-full px-3 py-2.5 text-center text-lg font-black tracking-[0.5em] rounded-xl border border-slate-300"
              placeholder="••••"
              required
            />
          </div>
          <button type="submit" disabled={busy || esignMpin.length !== 4 || !esignConsent} className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs disabled:opacity-60">
            Sign Agreement
          </button>
        </form>
      </ModalSheet>

      <ModalSheet isOpen={payModal} onClose={() => setPayModal(false)} title="Record Rent Payment" description="Log a rent receipt against this lease (409 on a duplicate month)" maxWidth="sm">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            run(
              () =>
                land.recordRentPayment(id, {
                  amountRupees: payForm.amountRupees,
                  month: payForm.month,
                  method: payForm.method,
                  paidAt: payForm.paidAt,
                }),
              'Payment recorded.',
              () => setPayModal(false)
            );
          }}
          className="space-y-3"
        >
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Amount (₹)</label>
            <input type="number" value={payForm.amountRupees} onChange={(e) => setPayForm({ ...payForm, amountRupees: Number(e.target.value) })} className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300" required />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Month (YYYY-MM)</label>
              <input type="month" value={payForm.month} onChange={(e) => setPayForm({ ...payForm, month: e.target.value })} className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300" required />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Method</label>
              <select value={payForm.method} onChange={(e) => setPayForm({ ...payForm, method: e.target.value })} className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 bg-white">
                <option value="upi">UPI</option>
                <option value="cash">Cash</option>
                <option value="bank">Bank Transfer</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Paid on</label>
            <input type="date" value={payForm.paidAt} onChange={(e) => setPayForm({ ...payForm, paidAt: e.target.value })} className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300" required />
          </div>
          <button type="submit" disabled={busy} className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs disabled:opacity-60">
            Record Payment
          </button>
        </form>
      </ModalSheet>

      <ModalSheet isOpen={renewModal} onClose={() => setRenewModal(false)} title="Propose Renewal" maxWidth="sm">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            run(
              () =>
                land.renewLease(id, {
                  extensionMonths: renewForm.extensionMonths,
                  newRentRupees: renewForm.newRentRupees || undefined,
                  note: renewForm.note || undefined,
                }),
              'Renewal proposal sent.',
              () => setRenewModal(false)
            );
          }}
          className="space-y-3"
        >
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Extension (months)</label>
              <input type="number" min={1} max={120} value={renewForm.extensionMonths} onChange={(e) => setRenewForm({ ...renewForm, extensionMonths: Number(e.target.value) })} className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300" required />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">New Rent (₹/mo)</label>
              <input type="number" value={renewForm.newRentRupees} onChange={(e) => setRenewForm({ ...renewForm, newRentRupees: Number(e.target.value) })} className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300" required />
            </div>
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Note</label>
            <textarea value={renewForm.note} onChange={(e) => setRenewForm({ ...renewForm, note: e.target.value })} rows={2} className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300" />
          </div>
          <button type="submit" disabled={busy} className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs disabled:opacity-60">
            Send Proposal
          </button>
        </form>
      </ModalSheet>

      <ModalSheet isOpen={!!respondRenewal} onClose={() => setRespondRenewal(null)} title="Respond to Renewal" maxWidth="sm">
        <div className="space-y-3">
          <div className="flex gap-2">
            <button
              onClick={() => setRespondAction('accept')}
              className={`flex-1 py-2.5 rounded-xl font-bold text-xs border ${respondAction === 'accept' ? 'bg-emerald-600 text-white border-emerald-600' : 'border-slate-200 text-slate-600'}`}
            >
              Accept
            </button>
            <button
              onClick={() => setRespondAction('decline')}
              className={`flex-1 py-2.5 rounded-xl font-bold text-xs border ${respondAction === 'decline' ? 'bg-rose-600 text-white border-rose-600' : 'border-slate-200 text-slate-600'}`}
            >
              Decline
            </button>
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Reason (optional)</label>
            <input type="text" value={respondReason} onChange={(e) => setRespondReason(e.target.value)} className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300" />
          </div>
          <button
            onClick={() => {
              if (!respondRenewal) return;
              run(
                () => land.respondRenewal(str(respondRenewal.id), { action: respondAction, reason: respondReason || undefined }),
                respondAction === 'accept' ? 'Renewal accepted.' : 'Renewal declined.',
                () => setRespondRenewal(null)
              );
            }}
            disabled={busy}
            className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs disabled:opacity-60"
          >
            Submit Response
          </button>
        </div>
      </ModalSheet>

      <ModalSheet isOpen={terminateModal} onClose={() => setTerminateModal(false)} title="Terminate Lease" description="Provide a reason — this is recorded for arbitration" maxWidth="sm">
        <div className="space-y-3">
          <textarea
            value={terminateReason}
            onChange={(e) => setTerminateReason(e.target.value)}
            rows={3}
            className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300"
            placeholder="Tenant defaulted on rent…"
            required
          />
          <button
            onClick={() => run(() => land.terminateLease(id, terminateReason), 'Lease termination initiated.', () => {
              setTerminateModal(false);
              setTerminateReason('');
            })}
            disabled={busy}
            className="w-full py-3 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs disabled:opacity-60"
          >
            Confirm Termination
          </button>
        </div>
      </ModalSheet>

      <ModalSheet isOpen={disputeModal} onClose={() => setDisputeModal(false)} title="Open Dispute" maxWidth="sm">
        <form onSubmit={submitDispute} className="space-y-3">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Category</label>
            <select value={disputeForm.category} onChange={(e) => setDisputeForm({ ...disputeForm, category: e.target.value })} className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 bg-white">
              <option value="payment_default">Payment default</option>
              <option value="unauthorized_subletting">Unauthorized sub-letting</option>
              <option value="boundary_dispute">Boundary dispute</option>
              <option value="crop_damage">Crop damage</option>
              <option value="early_vacate">Early vacate</option>
              <option value="other">Other</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Note</label>
            <textarea value={disputeForm.note} onChange={(e) => setDisputeForm({ ...disputeForm, note: e.target.value })} rows={3} className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300" required />
          </div>
          <button type="submit" disabled={busy} className="w-full py-3 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs disabled:opacity-60">
            Submit Dispute
          </button>
        </form>
      </ModalSheet>

      <ModalSheet isOpen={harvestModal} onClose={() => setHarvestModal(false)} title="Add Harvest Declaration" maxWidth="sm">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            run(() => land.addHarvestDeclaration(id, { ...harvestForm }), 'Harvest declaration added.', () => {
              setHarvestModal(false);
              setHarvestForm({ crop: '', season: 'kharif', areaAcres: 0, yieldQuintals: 0, saleRatePerQuintal: 0 });
            });
          }}
          className="space-y-3"
        >
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Crop</label>
              <input type="text" value={harvestForm.crop} onChange={(e) => setHarvestForm({ ...harvestForm, crop: e.target.value })} className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300" required />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Season</label>
              <select value={harvestForm.season} onChange={(e) => setHarvestForm({ ...harvestForm, season: e.target.value })} className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 bg-white">
                {HARVEST_SEASONS.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Area (ac)</label>
              <input type="number" step="0.1" value={harvestForm.areaAcres} onChange={(e) => setHarvestForm({ ...harvestForm, areaAcres: Number(e.target.value) })} className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300" required />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Yield (q)</label>
              <input type="number" step="0.5" value={harvestForm.yieldQuintals} onChange={(e) => setHarvestForm({ ...harvestForm, yieldQuintals: Number(e.target.value) })} className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300" required />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Rate (₹/q)</label>
              <input type="number" value={harvestForm.saleRatePerQuintal} onChange={(e) => setHarvestForm({ ...harvestForm, saleRatePerQuintal: Number(e.target.value) })} className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300" required />
            </div>
          </div>
          <button type="submit" disabled={busy} className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs disabled:opacity-60">
            Add Declaration
          </button>
        </form>
      </ModalSheet>

      <ModalSheet isOpen={handoverModal} onClose={() => setHandoverModal(false)} title="Record Handover Checklist" maxWidth="md">
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Handover type</label>
            <select value={handoverType} onChange={(e) => setHandoverType(e.target.value as 'move_in' | 'move_out')} className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 bg-white">
              <option value="move_in">Move-in (lease start)</option>
              <option value="move_out">Move-out (lease end)</option>
            </select>
          </div>
          {CHECKLIST_ITEMS.map((item) => (
            <div key={item} className="flex items-center gap-3 p-3 bg-slate-50 rounded-2xl text-xs">
              <label className="flex items-center gap-2 flex-1 font-bold text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={!!checklist[item]}
                  onChange={(e) =>
                    setChecklist({ ...checklist, [item]: e.target.checked ? 'good' : undefined })
                  }
                  className="w-4 h-4 accent-emerald-600"
                />
                {item}
              </label>
              {checklist[item] && (
                <select
                  value={checklist[item]}
                  onChange={(e) => setChecklist({ ...checklist, [item]: e.target.value as 'good' | 'fair' | 'damaged' })}
                  className="px-2 py-1.5 rounded-lg border border-slate-300 bg-white text-[11px] font-bold"
                >
                  <option value="good">good</option>
                  <option value="fair">fair</option>
                  <option value="damaged">damaged</option>
                </select>
              )}
            </div>
          ))}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Photo URLs (comma separated, max 10)</label>
            <input type="text" value={handoverPhotos} onChange={(e) => setHandoverPhotos(e.target.value)} className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300" placeholder="https://…, https://…" />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Notes</label>
            <textarea value={handoverNotes} onChange={(e) => setHandoverNotes(e.target.value)} rows={2} className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300" />
          </div>
          <button
            onClick={() =>
              run(
                () =>
                  land.leaseHandover(id, {
                    type: handoverType,
                    checklist: Object.entries(checklist)
                      .filter(([, condition]) => !!condition)
                      .map(([label, condition]) => ({ label, condition })),
                    notes: handoverNotes || undefined,
                    photos: handoverPhotos
                      .split(',')
                      .map((u) => u.trim())
                      .filter(Boolean)
                      .slice(0, 10),
                  }),
                'Handover recorded.',
                () => {
                  setHandoverModal(false);
                  setHandoverNotes('');
                  setHandoverPhotos('');
                  setChecklist({});
                }
              )
            }
            disabled={busy}
            className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs disabled:opacity-60"
          >
            Submit Handover
          </button>
        </div>
      </ModalSheet>
    </div>
  );
};
