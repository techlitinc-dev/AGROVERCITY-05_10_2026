import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Landmark,
  ArrowLeft,
  CalendarClock,
  FileUp,
  Ban,
  CheckCircle2,
  MessageSquareReply,
  Download,
  UploadCloud,
} from 'lucide-react';
import { loans, uploads, apiErrorMessage } from '../../lib/api';
import { ModalSheet } from '../../components/common/ModalSheet';
import { StatusBadge } from '../../components/common/StatusBadge';
import { formatCurrency, formatDate } from '../../lib/utils';
import type { LoanApplication } from '../../types';

const asRecord = (v: unknown): Record<string, unknown> =>
  v !== null && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
const asArray = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const asStr = (v: unknown, fallback = ''): string => (typeof v === 'string' ? v : fallback);
const asNum = (v: unknown, fallback = 0): number => (typeof v === 'number' && !Number.isNaN(v) ? v : fallback);

const STATUS_FLOW = ['under_review', 'document_verification', 'appraisal', 'approved', 'disbursed'];

export const LoanDetailView: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [loan, setLoan] = useState<LoanApplication | null>(null);
  const [schedule, setSchedule] = useState<Record<string, unknown> | null>(null);
  const [documents, setDocuments] = useState<unknown[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [respondModalOpen, setRespondModalOpen] = useState(false);
  const [responseMessage, setResponseMessage] = useState('');
  const [cancelModalOpen, setCancelModalOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [uploadBusy, setUploadBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement | null>(null);

  const reload = useCallback(async () => {
    if (!id) return;
    const [l, s, docs] = await Promise.all([
      loans.get(id),
      loans.schedule(id).catch(() => null),
      Promise.resolve([] as unknown[]),
    ]);
    setLoan(l);
    if (s) setSchedule(asRecord(s));
    setDocuments(asArray((l as unknown as Record<string, unknown>).documents));
  }, [id]);

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

  const handleRespond = async () => {
    if (!id) return;
    setBusy(true);
    setError(null);
    try {
      await loans.respond(id, { message: responseMessage });
      const updated = await loans.get(id);
      setLoan(updated);
      setRespondModalOpen(false);
      setResponseMessage('');
      setNotice('Response sent to the bank manager.');
    } catch (e) {
      setError(apiErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const handleCancel = async () => {
    if (!id) return;
    setBusy(true);
    setError(null);
    try {
      const updated = await loans.cancel(id, cancelReason || 'Withdrawn by farmer');
      setLoan((prev) => (prev ? { ...prev, ...updated } : updated));
      setCancelModalOpen(false);
      setNotice('Loan application cancelled.');
    } catch (e) {
      setError(apiErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const handleUploadDocument = async (file: File | undefined) => {
    if (!file || !id) return;
    setUploadBusy(true);
    setError(null);
    try {
      const uploaded = (await uploads.upload(file, { folder: 'loans', purpose: 'loan-document' })) as {
        url?: string;
        fileUrl?: string;
        name?: string;
      };
      const url = uploaded?.url ?? uploaded?.fileUrl ?? '';
      await loans.addDocument(id, {
        name: file.name,
        url,
        type: file.type,
      });
      const updated = await loans.get(id);
      setLoan(updated);
      setDocuments(asArray((updated as unknown as Record<string, unknown>).documents));
      setNotice(`Document "${file.name}" uploaded for review.`);
    } catch (e) {
      setError(apiErrorMessage(e));
    } finally {
      setUploadBusy(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const handleDownloadDocument = async (docId: string, name: string) => {
    if (!id) return;
    setError(null);
    try {
      const blob = await loans.downloadDocument(id, docId);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = name || `document-${docId}`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError(apiErrorMessage(e));
    }
  };

  const statusIndex = loan ? STATUS_FLOW.indexOf(loan.status) : -1;
  const installments = asArray(schedule?.installments ?? schedule?.schedule ?? schedule?.emiSchedule).map((i) =>
    asRecord(i)
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/farmer/loans')}
            className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 transition-colors"
            title="Back to loans"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <h1 className="text-2xl font-extrabold text-slate-900 flex items-center gap-2">
              <Landmark className="w-7 h-7 text-emerald-600" />
              Loan Application #{id}
            </h1>
            <p className="text-xs text-slate-500 mt-1">Timeline, repayment schedule, documents & responses</p>
          </div>
        </div>
        {loan && <StatusBadge status={loan.status} />}
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

      {loading || !loan ? (
        <div className="py-10 text-center text-xs font-bold text-slate-400 animate-pulse">
          Loading loan application…
        </div>
      ) : (
        <>
          {/* Summary */}
          <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs space-y-5">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-100">
                <span className="text-slate-400 text-[10px] uppercase font-bold">Scheme</span>
                <p className="font-extrabold text-slate-900 mt-0.5">{loan.loanType}</p>
              </div>
              <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-100">
                <span className="text-slate-400 text-[10px] uppercase font-bold">Amount</span>
                <p className="font-extrabold text-emerald-700 mt-0.5">{formatCurrency(loan.amountRequested)}</p>
              </div>
              <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-100">
                <span className="text-slate-400 text-[10px] uppercase font-bold">Tenure</span>
                <p className="font-extrabold text-slate-900 mt-0.5">{loan.tenureMonths} Months</p>
              </div>
              <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-100">
                <span className="text-slate-400 text-[10px] uppercase font-bold">Applied On</span>
                <p className="font-extrabold text-slate-900 mt-0.5">{formatDate(loan.appliedDate)}</p>
              </div>
            </div>

            {loan.rejectionReason && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-2xl text-xs font-semibold text-rose-800">
                Rejection reason: {loan.rejectionReason}
              </div>
            )}

            {/* Timeline */}
            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
              <h4 className="font-bold text-xs text-slate-900 mb-3 flex items-center gap-1.5">
                <CalendarClock className="w-4 h-4 text-sky-600" /> Application Timeline
              </h4>
              <div className="flex items-center justify-between text-[10px] font-bold text-slate-500 overflow-x-auto pb-1 gap-2">
                {STATUS_FLOW.map((step, idx) => {
                  const reached = statusIndex >= idx;
                  const isCurrent = statusIndex === idx;
                  return (
                    <div
                      key={step}
                      className={`flex items-center gap-1.5 whitespace-nowrap px-2.5 py-1 rounded-xl ${
                        isCurrent ? 'bg-emerald-600 text-white font-black shadow-xs' : reached ? 'text-emerald-700' : 'text-slate-400'
                      }`}
                    >
                      {reached && !isCurrent && <CheckCircle2 className="w-3 h-3" />}
                      <span className="capitalize">{step.replace(/_/g, ' ')}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Actions */}
            {!['rejected', 'disbursed'].includes(loan.status) && (
              <div className="flex flex-wrap gap-2 pt-2">
                <button
                  onClick={() => setRespondModalOpen(true)}
                  className="px-4 py-2.5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs flex items-center gap-2"
                >
                  <MessageSquareReply className="w-4 h-4" />
                  <span>Respond to Bank</span>
                </button>
                <button
                  onClick={() => setCancelModalOpen(true)}
                  className="px-4 py-2.5 rounded-2xl border border-rose-200 text-rose-600 hover:bg-rose-50 font-bold text-xs flex items-center gap-2"
                >
                  <Ban className="w-4 h-4" />
                  <span>Cancel Application</span>
                </button>
              </div>
            )}
          </div>

          {/* Repayment schedule */}
          <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs space-y-3">
            <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
              <CalendarClock className="w-4 h-4 text-sky-600" /> Repayment Schedule
            </h3>
            {installments.length === 0 ? (
              <p className="text-xs text-slate-400">
                Schedule is generated once the loan is approved{schedule ? '' : ' (not available yet).'}.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-50 text-slate-500 uppercase font-bold text-[10px] tracking-wider border-b border-slate-100">
                      <th className="py-2.5 px-4">#</th>
                      <th className="py-2.5 px-4">Due Date</th>
                      <th className="py-2.5 px-4 text-right">EMI</th>
                      <th className="py-2.5 px-4 text-right">Principal</th>
                      <th className="py-2.5 px-4 text-right">Interest</th>
                      <th className="py-2.5 px-4 text-right">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {installments.map((inst, i) => (
                      <tr key={i} className="hover:bg-slate-50/60">
                        <td className="py-2.5 px-4 font-mono text-slate-500">{asNum(inst.installmentNo ?? inst.no, i + 1)}</td>
                        <td className="py-2.5 px-4 font-medium text-slate-700">{formatDate(asStr(inst.dueDate))}</td>
                        <td className="py-2.5 px-4 text-right font-bold">{formatCurrency(asNum(inst.emi ?? inst.amount, 0))}</td>
                        <td className="py-2.5 px-4 text-right text-slate-600">{formatCurrency(asNum(inst.principal, 0))}</td>
                        <td className="py-2.5 px-4 text-right text-slate-600">{formatCurrency(asNum(inst.interest, 0))}</td>
                        <td className="py-2.5 px-4 text-right">
                          <StatusBadge status={asStr(inst.status, 'upcoming')} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Documents */}
          <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
                <FileUp className="w-4 h-4 text-emerald-600" /> Documents ({documents.length})
              </h3>
              <input
                ref={fileRef}
                type="file"
                onChange={(e) => handleUploadDocument(e.target.files?.[0])}
                className="hidden"
              />
              <button
                onClick={() => fileRef.current?.click()}
                disabled={uploadBusy}
                className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-1.5 disabled:opacity-60"
              >
                <UploadCloud className="w-3.5 h-3.5" />
                {uploadBusy ? 'Uploading…' : 'Upload Document'}
              </button>
            </div>
            {documents.length === 0 ? (
              <p className="text-xs text-slate-400">
                No documents uploaded. The bank may request your 7/12, passbook copy, or quotations.
              </p>
            ) : (
              <div className="space-y-2">
                {documents.map((d, i) => {
                  const r = asRecord(d);
                  const docId = asStr(r.id ?? r.docId, String(i));
                  return (
                    <div key={docId} className="p-3.5 bg-slate-50 rounded-2xl border border-slate-100 flex items-center justify-between gap-3 text-xs">
                      <div>
                        <p className="font-bold text-slate-900">{asStr(r.name ?? r.fileName, `Document ${i + 1}`)}</p>
                        <p className="text-[10px] text-slate-400 capitalize">
                          {asStr(r.type ?? r.category, 'General')}
                          {asStr(r.uploadedAt) ? ` • ${formatDate(asStr(r.uploadedAt))}` : ''}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <StatusBadge status={asStr(r.status, 'submitted')} />
                        <button
                          onClick={() => handleDownloadDocument(docId, asStr(r.name ?? r.fileName, ''))}
                          className="p-1.5 text-slate-400 hover:text-sky-600 hover:bg-sky-50 rounded-lg transition-colors"
                          title="Download"
                        >
                          <Download className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </>
      )}

      {/* Respond modal */}
      <ModalSheet
        isOpen={respondModalOpen}
        onClose={() => setRespondModalOpen(false)}
        title="Respond to Bank"
        description="Reply to the bank manager's query or info request"
        maxWidth="sm"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Your Message</label>
            <textarea
              rows={4}
              value={responseMessage}
              onChange={(e) => setResponseMessage(e.target.value)}
              placeholder="e.g. Uploaded the corrected 7/12 copy, please re-verify"
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300"
            />
          </div>
          <button
            onClick={handleRespond}
            disabled={busy || !responseMessage.trim()}
            className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md disabled:opacity-60"
          >
            {busy ? 'Sending…' : 'Send Response'}
          </button>
        </div>
      </ModalSheet>

      {/* Cancel modal */}
      <ModalSheet
        isOpen={cancelModalOpen}
        onClose={() => setCancelModalOpen(false)}
        title="Cancel Loan Application"
        description="This will withdraw your application from the bank queue"
        maxWidth="sm"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Reason (optional)</label>
            <input
              type="text"
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              placeholder="e.g. Arranged funds from FPO"
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300"
            />
          </div>
          <button
            onClick={handleCancel}
            disabled={busy}
            className="w-full py-3 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs shadow-md disabled:opacity-60"
          >
            {busy ? 'Cancelling…' : 'Confirm Cancellation'}
          </button>
        </div>
      </ModalSheet>
    </div>
  );
};
