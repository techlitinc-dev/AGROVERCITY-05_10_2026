import React, { useCallback, useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  Landmark,
  ArrowLeft,
  Calculator,
  FileText,
  User,
  Warehouse,
  IndianRupee,
  Check,
  X,
  Info,
  Banknote,
  Download,
  Table2,
  AlertTriangle,
  RefreshCw,
} from 'lucide-react';
import { loans, finance, postHarvest, apiErrorMessage } from '../../lib/api';
import { StatusBadge } from '../../components/common/StatusBadge';
import { ModalSheet } from '../../components/common/ModalSheet';
import { formatCurrency, formatDate } from '../../lib/utils';
import {
  str,
  num,
  arr,
  toPaisa,
  fromPaisa,
  loanId,
  type LoanRow,
  type RepaymentRow,
  type ScheduleRow,
  type Row,
} from './loanTypes';

const REPAYMENT_MODES = ['upi', 'nach', 'cash', 'other'];

const Section: React.FC<{ title: string; icon: React.ReactNode; children: React.ReactNode; action?: React.ReactNode }> = ({
  title,
  icon,
  children,
  action,
}) => (
  <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden">
    <div className="p-4 border-b border-slate-100 flex items-center justify-between">
      <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
        <span className="text-emerald-600">{icon}</span>
        {title}
      </h3>
      {action}
    </div>
    <div className="p-4">{children}</div>
  </div>
);

const Field: React.FC<{ label: string; value: React.ReactNode }> = ({ label, value }) => (
  <div>
    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{label}</span>
    <div className="text-sm font-semibold text-slate-800 mt-0.5">{value || '—'}</div>
  </div>
);

export const LoanUnderwritingView: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [loan, setLoan] = useState<LoanRow | null>(null);
  const [farmer360, setFarmer360] = useState<Row | null>(null);
  const [schedule, setSchedule] = useState<ScheduleRow[]>([]);
  const [repayments, setRepayments] = useState<RepaymentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // Modals
  const [approveOpen, setApproveOpen] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [infoOpen, setInfoOpen] = useState(false);
  const [disburseOpen, setDisburseOpen] = useState(false);

  // Form state
  const [sanctionedAmount, setSanctionedAmount] = useState('');
  const [interestRate, setInterestRate] = useState('7');
  const [tenureMonths, setTenureMonths] = useState('');
  const [approveNote, setApproveNote] = useState('');
  const [rejectReason, setRejectReason] = useState('');
  const [infoMessage, setInfoMessage] = useState('');
  const [disbursementRef, setDisbursementRef] = useState('');
  const [disbursedAmount, setDisbursedAmount] = useState('');
  const [busy, setBusy] = useState(false);

  // EMI calculator
  const [calcAmount, setCalcAmount] = useState('');
  const [calcRate, setCalcRate] = useState('7');
  const [calcTenure, setCalcTenure] = useState('12');
  const [calcResult, setCalcResult] = useState<Row | null>(null);
  const [calcError, setCalcError] = useState<string | null>(null);

  // e-NWR collateral lookup
  const [receiptNumber, setReceiptNumber] = useState('');
  const [receipt, setReceipt] = useState<Row | null>(null);
  const [receiptError, setReceiptError] = useState<string | null>(null);

  // Repayment entry
  const [repAmount, setRepAmount] = useState('');
  const [repMode, setRepMode] = useState('upi');
  const [repEmiIndex, setRepEmiIndex] = useState('');
  const [repNote, setRepNote] = useState('');

  const loadAll = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const [loanRow, scheduleRes, repaymentRows] = await Promise.all([
        loans.get(id) as Promise<unknown>,
        loans.schedule(id) as Promise<unknown>,
        loans.repayments(id) as Promise<unknown>,
      ]);
      const l = loanRow as LoanRow;
      setLoan(l);
      setSanctionedAmount(String(num(l.amount)));
      setTenureMonths(String(num(l.tenureMonths, 12)));
      setCalcAmount(String(num(l.amount)));
      setCalcTenure(String(num(l.tenureMonths, 12)));
      const sched = (scheduleRes as { data?: unknown })?.data ?? scheduleRes;
      setSchedule(arr(sched) as ScheduleRow[]);
      setRepayments(arr(repaymentRows) as RepaymentRow[]);
      try {
        setFarmer360((await loans.farmer360(id)) as Row);
      } catch {
        setFarmer360(null); // 360 is advisory, not blocking
      }
    } catch (e) {
      setError(apiErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const runMutation = async (fn: () => Promise<unknown>, success: string) => {
    if (!id) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await fn();
      setNotice(success);
      await loadAll();
    } catch (e) {
      setError(apiErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const handleReview = () => runMutation(() => loans.review(id!), 'Application moved to under review.');
  const handleApprove = () =>
    runMutation(
      () =>
        loans.approve(id!, {
          sanctionedAmount: Number(sanctionedAmount),
          interestRate: Number(interestRate),
          tenureMonths: Number(tenureMonths),
          note: approveNote || undefined,
        }),
      'Loan approved — sanction letter sent to farmer.'
    ).then(() => setApproveOpen(false));
  const handleReject = () =>
    runMutation(() => loans.reject(id!, rejectReason), 'Application rejected.').then(() => {
      setRejectOpen(false);
      setRejectReason('');
    });
  const handleInfoRequest = () =>
    runMutation(() => loans.requestInfo(id!, infoMessage), 'Information request sent to the farmer.').then(() => {
      setInfoOpen(false);
      setInfoMessage('');
    });
  const handleDisburse = () =>
    runMutation(
      () =>
        loans.disburse(id!, {
          disbursementRef: disbursementRef || `DBT${Date.now()}`,
          disbursedAmount: disbursedAmount ? Number(disbursedAmount) : undefined,
        }),
      'Funds disbursed via DBT.'
    ).then(() => setDisburseOpen(false));

  const runCalculator = async (e: React.FormEvent) => {
    e.preventDefault();
    setCalcError(null);
    try {
      setCalcResult((await finance.loanCalculator({
        amount: Number(calcAmount),
        interestRate: Number(calcRate),
        tenureMonths: Number(calcTenure),
      })) as Row);
    } catch (err) {
      setCalcError(apiErrorMessage(err));
    }
  };

  const lookupReceipt = async (e: React.FormEvent) => {
    e.preventDefault();
    setReceipt(null);
    setReceiptError(null);
    try {
      setReceipt((await postHarvest.receipt(receiptNumber.trim())) as Row);
    } catch (err) {
      setReceiptError(apiErrorMessage(err));
    }
  };

  const addRepayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id) return;
    setBusy(true);
    setError(null);
    try {
      await loans.addRepayment(id, {
        amountPaise: toPaisa(Number(repAmount)),
        mode: repMode,
        emiIndex: repEmiIndex ? Number(repEmiIndex) : undefined,
        note: repNote || undefined,
      });
      setNotice('Repayment recorded.');
      setRepAmount('');
      setRepEmiIndex('');
      setRepNote('');
      const rows = (await loans.repayments(id)) as unknown;
      setRepayments(arr(rows) as RepaymentRow[]);
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const downloadDoc = async (doc: Row) => {
    if (!id) return;
    try {
      const res = (await loans.downloadDocument(id, str(doc.documentId ?? doc.id))) as unknown;
      const url = str((res as Row)?.url);
      if (url) {
        window.open(url, '_blank', 'noopener');
      } else {
        setError('Download did not return a URL.');
      }
    } catch (e) {
      setError(apiErrorMessage(e));
    }
  };

  if (loading && !loan) {
    return (
      <div className="min-h-[40vh] flex items-center justify-center">
        <RefreshCw className="w-6 h-6 text-emerald-600 animate-spin" />
      </div>
    );
  }

  if (!loan) {
    return (
      <div className="space-y-4">
        <button onClick={() => navigate('/bank')} className="inline-flex items-center gap-1 text-xs font-bold text-slate-500 hover:text-emerald-600">
          <ArrowLeft className="w-4 h-4" /> Back to desk
        </button>
        <div className="bg-rose-50 border border-rose-200 text-rose-700 text-sm font-semibold rounded-2xl px-4 py-3">
          {error ?? 'Loan application not found.'}
        </div>
      </div>
    );
  }

  const lid = loanId(loan);
  const status = str(loan.status, 'submitted');
  const documents = arr(loan.documents);
  const timeline = arr(loan.timeline);
  const fProfile = (farmer360?.profile ?? {}) as Row;
  const fCredit = (farmer360?.credit ?? {}) as Row;
  const fKcc = (farmer360?.kcc ?? null) as Row | null;
  const fLandCrop = (farmer360?.landCrop ?? {}) as Row;
  const fHistory = arr(farmer360?.repaymentHistory);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <Link to="/bank" className="inline-flex items-center gap-1 text-xs font-bold text-slate-500 hover:text-emerald-600 mb-2">
            <ArrowLeft className="w-4 h-4" /> Back to desk
          </Link>
          <h1 className="text-2xl font-extrabold text-slate-900 flex items-center gap-3 flex-wrap">
            <Landmark className="w-7 h-7 text-emerald-600" />
            {str(loan.applicationNumber, lid)}
            <StatusBadge status={status} />
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            {str(loan.farmerName, 'Unknown farmer')}
            {loan.farmerPhone ? ` · ${str(loan.farmerPhone)}` : ''}
            {loan.district ? ` · ${str(loan.district)}` : ''} · applied {formatDate(str(loan.createdAt))}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {status === 'submitted' && (
            <button
              onClick={handleReview}
              disabled={busy}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white font-bold text-xs rounded-xl shadow-xs"
            >
              Start Review
            </button>
          )}
          {status === 'underReview' && (
            <>
              <button
                onClick={() => setApproveOpen(true)}
                className="inline-flex items-center gap-1 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-xs"
              >
                <Check className="w-4 h-4" /> Approve
              </button>
              <button
                onClick={() => setInfoOpen(true)}
                className="inline-flex items-center gap-1 px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs rounded-xl shadow-xs"
              >
                <Info className="w-4 h-4" /> Request Info
              </button>
              <button
                onClick={() => setRejectOpen(true)}
                className="inline-flex items-center gap-1 px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-xl shadow-xs"
              >
                <X className="w-4 h-4" /> Reject
              </button>
            </>
          )}
          {status === 'approved' && (
            <button
              onClick={() => {
                setDisbursementRef(`DBT${new Date().toISOString().slice(0, 10).replace(/-/g, '')}${lid.slice(-4).toUpperCase()}`);
                setDisburseOpen(true);
              }}
              className="inline-flex items-center gap-1 px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white font-bold text-xs rounded-xl shadow-xs"
            >
              <Banknote className="w-4 h-4" /> Disburse DBT
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold rounded-2xl px-4 py-3">{error}</div>
      )}
      {notice && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-semibold rounded-2xl px-4 py-3">{notice}</div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Section title="Application Detail" icon={<FileText className="w-4 h-4" />}>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Amount Requested" value={formatCurrency(num(loan.amount))} />
            <Field label="Tenure" value={`${num(loan.tenureMonths)} months`} />
            <Field label="Purpose" value={str(loan.purpose, '—')} />
            <Field label="Credit Score" value={loan.farmerCreditScore ? `${num(loan.farmerCreditScore)} (${str(loan.farmerCreditTier, '—')})` : '—'} />
            <Field label="Bank Account" value={loan.bankAccountLast4 ? `•••• ${str(loan.bankAccountLast4)}${loan.bankIfsc ? ` · IFSC ${str(loan.bankIfsc)}` : ''}` : '—'} />
            <Field label="Assigned Officer" value={str(loan.assignedOfficerName, '—')} />
            {status === 'approved' || status === 'disbursed' ? (
              <>
                <Field label="Sanctioned" value={formatCurrency(num(loan.sanctionedAmount))} />
                <Field label="Rate / Tenure" value={`${num(loan.interestRate, 7)}% · ${num(loan.tenureMonths)}m`} />
              </>
            ) : null}
            {status === 'disbursed' && (
              <>
                <Field label="Disbursed On" value={formatDate(str(loan.disbursedAt))} />
                <Field label="DBT Ref" value={str(loan.disbursementRef, '—')} />
              </>
            )}
            {status === 'rejected' && <Field label="Rejection Reason" value={str(loan.rejectionReason, '—')} />}
          </div>
          {timeline.length > 0 && (
            <div className="mt-4 border-t border-slate-100 pt-3">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Timeline</span>
              <div className="mt-2 space-y-2">
                {timeline.map((t, i) => (
                  <div key={i} className="flex items-start gap-2 text-xs">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mt-1.5 shrink-0" />
                    <div>
                      <span className="font-bold text-slate-800">{str(t.status)}</span>
                      <span className="text-slate-400 ml-2">{formatDate(str(t.at ?? t.timestamp))}</span>
                      {str(t.note) && <p className="text-slate-500">{str(t.note)}</p>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </Section>

        <Section title="Farmer 360°" icon={<User className="w-4 h-4" />}>
          {farmer360 ? (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <Field label="Name" value={str(fProfile.name)} />
                <Field label="Phone" value={str(fProfile.phone)} />
                <Field label="Village" value={str(fProfile.village)} />
                <Field label="District" value={str(fProfile.district)} />
                <Field label="Kisan Score" value={fCredit.kisanCreditScore ? `${num(fCredit.kisanCreditScore)} (${str(fCredit.creditTier, '—')})` : '—'} />
                <Field label="Land / Crops" value={`${num(fLandCrop.landAreaAcres ?? fLandCrop.totalAreaHa)} ha`} />
              </div>
              {fKcc && (
                <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-3 text-xs">
                  <span className="font-bold text-emerald-800">KCC · {str(fKcc.bankName, '—')}</span>
                  <span className="block text-emerald-700 font-mono">{str(fKcc.cardNumberMasked)}</span>
                  <span className="block text-emerald-700">Limit {formatCurrency(num(fKcc.kccLimit))} · available {formatCurrency(num(fKcc.availableLimit))}</span>
                </div>
              )}
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Repayment History ({fHistory.length})</span>
                <div className="mt-1.5 space-y-1.5 max-h-40 overflow-y-auto pr-1">
                  {fHistory.length === 0 && <p className="text-xs text-slate-400">No prior loan applications.</p>}
                  {fHistory.map((h) => {
                    const hr = h as Row;
                    return (
                      <div key={str(hr.applicationId ?? hr.id)} className="flex items-center justify-between text-xs bg-slate-50 rounded-xl px-3 py-2">
                        <span className="font-mono text-slate-500">{str(hr.applicationNumber, '—')}</span>
                        <span className="font-bold text-slate-800">{formatCurrency(num(hr.amount ?? hr.sanctionedAmount))}</span>
                        <StatusBadge status={str(hr.status)} />
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          ) : (
            <p className="text-xs text-slate-400">Farmer 360° profile unavailable for this applicant.</p>
          )}
        </Section>

        <Section title="EMI Calculator" icon={<Calculator className="w-4 h-4" />}>
          <form onSubmit={runCalculator} className="space-y-2.5">
            <div className="grid grid-cols-3 gap-2">
              <label className="text-[10px] font-bold text-slate-500 uppercase">
                Amount ₹
                <input value={calcAmount} onChange={(e) => setCalcAmount(e.target.value)} type="number" min={5000} max={50000}
                  className="mt-1 w-full px-2.5 py-1.5 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-200" />
              </label>
              <label className="text-[10px] font-bold text-slate-500 uppercase">
                Rate %
                <input value={calcRate} onChange={(e) => setCalcRate(e.target.value)} type="number" step="0.1"
                  className="mt-1 w-full px-2.5 py-1.5 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-200" />
              </label>
              <label className="text-[10px] font-bold text-slate-500 uppercase">
                Months
                <input value={calcTenure} onChange={(e) => setCalcTenure(e.target.value)} type="number" min={3} max={12}
                  className="mt-1 w-full px-2.5 py-1.5 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-200" />
              </label>
            </div>
            <button type="submit" className="w-full py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl">
              Calculate EMI
            </button>
          </form>
          {calcError && <p className="mt-2 text-[11px] font-semibold text-rose-600">{calcError}</p>}
          {calcResult && (
            <div className="mt-3 grid grid-cols-3 gap-2 text-center">
              <div className="bg-emerald-50 rounded-xl p-2.5">
                <span className="text-[9px] font-bold uppercase text-emerald-600">EMI</span>
                <div className="text-sm font-black text-emerald-800">{formatCurrency(num(calcResult.emi))}</div>
              </div>
              <div className="bg-slate-50 rounded-xl p-2.5">
                <span className="text-[9px] font-bold uppercase text-slate-500">Interest</span>
                <div className="text-sm font-black text-slate-800">{formatCurrency(num(calcResult.totalInterest))}</div>
              </div>
              <div className="bg-slate-50 rounded-xl p-2.5">
                <span className="text-[9px] font-bold uppercase text-slate-500">Payable</span>
                <div className="text-sm font-black text-slate-800">{formatCurrency(num(calcResult.totalPayable))}</div>
              </div>
            </div>
          )}
        </Section>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Section title={`Documents (${documents.length})`} icon={<FileText className="w-4 h-4" />}>
          {documents.length === 0 ? (
            <p className="text-xs text-slate-400">No documents uploaded yet.</p>
          ) : (
            <div className="space-y-2">
              {documents.map((doc) => (
                <div key={str(doc.documentId ?? doc.id)} className="flex items-center justify-between bg-slate-50 rounded-xl px-3 py-2.5">
                  <div>
                    <span className="text-xs font-bold text-slate-800 block">{str(doc.name ?? doc.docType ?? doc.type, 'Document')}</span>
                    <span className="text-[10px] text-slate-400">
                      {str(doc.docType ?? doc.type)} · {formatDate(str(doc.uploadedAt ?? doc.createdAt))}
                      {doc.verificationStatus ? ` · ${str(doc.verificationStatus)}` : ''}
                    </span>
                  </div>
                  <button
                    onClick={() => downloadDoc(doc)}
                    className="inline-flex items-center gap-1 px-3 py-1.5 bg-white border border-slate-200 hover:border-emerald-300 text-slate-700 font-bold text-[11px] rounded-xl"
                  >
                    <Download className="w-3.5 h-3.5 text-emerald-600" /> Download
                  </button>
                </div>
              ))}
            </div>
          )}
          {status === 'infoRequested' && (
            <div className="mt-3 bg-amber-50 border border-amber-200 rounded-2xl p-3 text-[11px] font-semibold text-amber-800 flex gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              Information requested from the farmer — new uploads land here; the timeline above records their responses.
            </div>
          )}
        </Section>

        <Section title="e-NWR Collateral Lookup" icon={<Warehouse className="w-4 h-4" />}>
          <form onSubmit={lookupReceipt} className="flex items-center gap-2">
            <input
              value={receiptNumber}
              onChange={(e) => setReceiptNumber(e.target.value)}
              placeholder="e.g. NWR-2026-CS1-A1B2C3"
              className="flex-1 px-3 py-2 text-xs font-mono border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-200"
            />
            <button type="submit" className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl">
              Verify
            </button>
          </form>
          {receiptError && <p className="mt-2 text-[11px] font-semibold text-rose-600">{receiptError}</p>}
          {receipt && (
            <div className="mt-3 bg-emerald-50 border border-emerald-100 rounded-2xl p-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-mono text-xs font-bold text-emerald-800">{str(receipt.receiptNumber)}</span>
                <StatusBadge status={str(receipt.status, 'active')} />
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs text-emerald-900">
                <span>Depositor: <b>{str(receipt.depositorName)}</b></span>
                <span>Commodity: <b>{str(receipt.cropName)}</b></span>
                <span>Net: <b>{num(receipt.netQuintals)} q</b> · {num(receipt.bagsCount)} bags</span>
                <span>Grade: <b>{str(receipt.qcGrade)}</b></span>
                <span>Valuation: <b>{formatCurrency(num(receipt.valuationRupees))}</b></span>
                <span>WDRA: <b>{str(receipt.wdraRegNo, '—')}</b></span>
              </div>
              <div className="flex items-center justify-between pt-1 border-t border-emerald-100">
                <span className={`text-[11px] font-bold ${receipt.pledgeFinancingEligible ? 'text-emerald-700' : 'text-rose-600'}`}>
                  {receipt.pledgeFinancingEligible ? '✓ Pledge-financing eligible' : '✗ Not pledge eligible'}
                </span>
                <Link to={`/coldStorageProvider/receipts/${encodeURIComponent(str(receipt.receiptNumber))}`} className="text-[11px] font-bold text-emerald-700 hover:underline">
                  View e-NWR →
                </Link>
              </div>
            </div>
          )}
        </Section>
      </div>

      <Section
        title={`Repayment Schedule (${schedule.length} installments)`}
        icon={<Table2 className="w-4 h-4" />}
      >
        {schedule.length === 0 ? (
          <p className="text-xs text-slate-400">Schedule is generated once the loan is approved.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 text-slate-500 font-bold uppercase text-[10px] tracking-wider border-b border-slate-100">
                  <th className="py-2.5 px-4">#</th>
                  <th className="py-2.5 px-4">Due Date</th>
                  <th className="py-2.5 px-4">EMI</th>
                  <th className="py-2.5 px-4">Principal</th>
                  <th className="py-2.5 px-4">Interest</th>
                  <th className="py-2.5 px-4">Outstanding</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {schedule.map((s) => (
                  <tr key={num(s.installmentNo)} className="hover:bg-slate-50/60">
                    <td className="py-2.5 px-4 font-bold text-slate-500">{num(s.installmentNo)}</td>
                    <td className="py-2.5 px-4 font-semibold text-slate-800">{formatDate(str(s.dueDate))}</td>
                    <td className="py-2.5 px-4 font-black text-slate-900">{formatCurrency(num(s.emi))}</td>
                    <td className="py-2.5 px-4 text-slate-600">{formatCurrency(num(s.principal))}</td>
                    <td className="py-2.5 px-4 text-slate-600">{formatCurrency(num(s.interest))}</td>
                    <td className="py-2.5 px-4 font-semibold text-slate-700">{formatCurrency(num(s.outstanding))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      <Section
        title={`Repayments Ledger (${repayments.length})`}
        icon={<IndianRupee className="w-4 h-4" />}
      >
        {(status === 'disbursed' || status === 'approved') && (
          <form onSubmit={addRepayment} className="mb-4 bg-slate-50 rounded-2xl p-3 grid grid-cols-2 md:grid-cols-5 gap-2 items-end">
            <label className="text-[10px] font-bold text-slate-500 uppercase">
              Amount ₹
              <input value={repAmount} onChange={(e) => setRepAmount(e.target.value)} type="number" min="1" required
                className="mt-1 w-full px-2.5 py-1.5 text-xs border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-emerald-200" />
            </label>
            <label className="text-[10px] font-bold text-slate-500 uppercase">
              Mode
              <select value={repMode} onChange={(e) => setRepMode(e.target.value)}
                className="mt-1 w-full px-2.5 py-1.5 text-xs border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-emerald-200">
                {REPAYMENT_MODES.map((m) => <option key={m} value={m}>{m.toUpperCase()}</option>)}
              </select>
            </label>
            <label className="text-[10px] font-bold text-slate-500 uppercase">
              EMI #
              <input value={repEmiIndex} onChange={(e) => setRepEmiIndex(e.target.value)} type="number" min="1"
                placeholder="optional"
                className="mt-1 w-full px-2.5 py-1.5 text-xs border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-emerald-200" />
            </label>
            <label className="text-[10px] font-bold text-slate-500 uppercase">
              Note
              <input value={repNote} onChange={(e) => setRepNote(e.target.value)}
                className="mt-1 w-full px-2.5 py-1.5 text-xs border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-emerald-200" />
            </label>
            <button type="submit" disabled={busy}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white font-bold text-xs rounded-xl">
              Record
            </button>
          </form>
        )}
        {repayments.length === 0 ? (
          <p className="text-xs text-slate-400">No repayments recorded yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 text-slate-500 font-bold uppercase text-[10px] tracking-wider border-b border-slate-100">
                  <th className="py-2.5 px-4">Paid At</th>
                  <th className="py-2.5 px-4">Amount</th>
                  <th className="py-2.5 px-4">Mode</th>
                  <th className="py-2.5 px-4">EMI #</th>
                  <th className="py-2.5 px-4">Cumulative</th>
                  <th className="py-2.5 px-4">Note</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {repayments.map((r) => (
                  <tr key={str(r.repaymentId)} className="hover:bg-slate-50/60">
                    <td className="py-2.5 px-4 font-semibold text-slate-800">{formatDate(str(r.paidAt ?? r.recordedAt))}</td>
                    <td className="py-2.5 px-4 font-black text-slate-900">{formatCurrency(fromPaisa(num(r.amountPaise)))}</td>
                    <td className="py-2.5 px-4 uppercase font-bold text-slate-500">{str(r.mode, '—')}</td>
                    <td className="py-2.5 px-4">{r.emiIndex ? num(r.emiIndex) : '—'}</td>
                    <td className="py-2.5 px-4 font-semibold text-emerald-700">{formatCurrency(fromPaisa(num(r.runningPaidPaisa)))}</td>
                    <td className="py-2.5 px-4 text-slate-500">{str(r.note, '—')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      {/* Approve modal */}
      <ModalSheet isOpen={approveOpen} onClose={() => setApproveOpen(false)} title="Approve Loan" description="Sanction terms are notified to the farmer instantly." maxWidth="md">
        <div className="space-y-3">
          <label className="block text-[10px] font-bold text-slate-500 uppercase">
            Sanctioned Amount ₹
            <input value={sanctionedAmount} onChange={(e) => setSanctionedAmount(e.target.value)} type="number" min="1"
              className="mt-1 w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-200" />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block text-[10px] font-bold text-slate-500 uppercase">
              Interest Rate % p.a.
              <input value={interestRate} onChange={(e) => setInterestRate(e.target.value)} type="number" step="0.1"
                className="mt-1 w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-200" />
            </label>
            <label className="block text-[10px] font-bold text-slate-500 uppercase">
              Tenure (months)
              <input value={tenureMonths} onChange={(e) => setTenureMonths(e.target.value)} type="number" min="1"
                className="mt-1 w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-200" />
            </label>
          </div>
          <label className="block text-[10px] font-bold text-slate-500 uppercase">
            Sanction Note
            <textarea value={approveNote} onChange={(e) => setApproveNote(e.target.value)} rows={2}
              className="mt-1 w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-200" />
          </label>
          <button onClick={handleApprove} disabled={busy}
            className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white font-bold text-sm rounded-xl">
            {busy ? 'Approving…' : 'Approve & Sanction'}
          </button>
        </div>
      </ModalSheet>

      {/* Reject modal */}
      <ModalSheet isOpen={rejectOpen} onClose={() => setRejectOpen(false)} title="Reject Application" description="The farmer is notified with the reason." maxWidth="sm">
        <div className="space-y-3">
          <textarea value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} rows={3} required placeholder="Rejection reason…"
            className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-200" />
          <button onClick={handleReject} disabled={busy || !rejectReason.trim()}
            className="w-full py-2.5 bg-rose-600 hover:bg-rose-700 disabled:opacity-60 text-white font-bold text-sm rounded-xl">
            Reject Application
          </button>
        </div>
      </ModalSheet>

      {/* Info request modal */}
      <ModalSheet isOpen={infoOpen} onClose={() => setInfoOpen(false)} title="Request Information" description="Creates a task for the farmer to upload documents / respond." maxWidth="sm">
        <div className="space-y-3">
          <textarea value={infoMessage} onChange={(e) => setInfoMessage(e.target.value)} rows={3} required placeholder="e.g. Upload latest 7/12 extract and bank statement…"
            className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-200" />
          <button onClick={handleInfoRequest} disabled={busy || !infoMessage.trim()}
            className="w-full py-2.5 bg-amber-500 hover:bg-amber-600 disabled:opacity-60 text-white font-bold text-sm rounded-xl">
            Send Request
          </button>
        </div>
      </ModalSheet>

      {/* Disburse modal */}
      <ModalSheet isOpen={disburseOpen} onClose={() => setDisburseOpen(false)} title="Disburse via DBT" description="Marks the sanctioned amount as transferred to the farmer's account." maxWidth="md">
        <div className="space-y-3">
          <label className="block text-[10px] font-bold text-slate-500 uppercase">
            DBT Reference
            <input value={disbursementRef} onChange={(e) => setDisbursementRef(e.target.value)}
              className="mt-1 w-full px-3 py-2 text-sm font-mono border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-200" />
          </label>
          <label className="block text-[10px] font-bold text-slate-500 uppercase">
            Disbursed Amount ₹ (defaults to sanctioned)
            <input value={disbursedAmount} onChange={(e) => setDisbursedAmount(e.target.value)} type="number" min="1"
              placeholder={String(num(loan.sanctionedAmount))}
              className="mt-1 w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-200" />
          </label>
          <button onClick={handleDisburse} disabled={busy}
            className="w-full py-2.5 bg-sky-600 hover:bg-sky-700 disabled:opacity-60 text-white font-bold text-sm rounded-xl">
            {busy ? 'Disbursing…' : `Disburse ${formatCurrency(num(loan.sanctionedAmount))}`}
          </button>
        </div>
      </ModalSheet>
    </div>
  );
};
