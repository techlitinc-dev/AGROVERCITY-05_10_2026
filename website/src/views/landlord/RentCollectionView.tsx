import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Check, Download, FileDown, HandCoins, RefreshCw, X } from 'lucide-react';
import { land, apiClient, apiErrorMessage } from '../../lib/api';
import { StatusBadge } from '../../components/common/StatusBadge';
import { formatCurrency } from '../../lib/utils';
import { asArr, asRec, downloadBlob, firstNum, firstStr, fmtDate, str, type Rec } from './utils';

/** /landlord/rent — dues, record payments, receipts (PDF), ledger export (CSV/PDF). */
export const RentCollectionView: React.FC = () => {
  const [dues, setDues] = useState<Rec[]>([]);
  const [summaryDuePaisa, setSummaryDuePaisa] = useState(0);
  const [leases, setLeases] = useState<Rec[]>([]);
  const [selectedLease, setSelectedLease] = useState('');
  const [payments, setPayments] = useState<Rec[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [payForm, setPayForm] = useState({ amountRupees: 0, month: '', method: 'upi', paidAt: '' });

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [d, l, s] = await Promise.all([
        land.rentDues().catch(() => [] as unknown[]),
        land.leases(),
        land.summary().catch(() => ({})),
      ]);
      setDues(asArr(d).map(asRec));
      setLeases(asArr(l).map(asRec));
      setSummaryDuePaisa(firstNum(asRec(s), ['rentDueThisMonthPaisa'], 0));
    } catch (e) {
      setError(apiErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const flash = (msg: string) => {
    setNotice(msg);
    setTimeout(() => setNotice(null), 4000);
  };

  useEffect(() => {
    if (!selectedLease) {
      setPayments([]);
      return;
    }
    land
      .rentPayments(selectedLease)
      .then((p) => setPayments(asArr(p).map(asRec)))
      .catch(() => setPayments([]));
  }, [selectedLease]);

  const handleRecord = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLease) return;
    try {
      await land.recordRentPayment(selectedLease, { ...payForm });
      flash('Rent payment recorded.');
      await load();
      const p = await land.rentPayments(selectedLease);
      setPayments(asArr(p).map(asRec));
    } catch (err) {
      setError(apiErrorMessage(err));
    }
  };

  /** Receipts and ledgers are file downloads (PDF / CSV), not JSON. */
  const downloadFile = async (url: string, filename: string) => {
    setBusy(true);
    try {
      const res = await apiClient.get(url, { responseType: 'blob' });
      downloadBlob(filename, res.data as Blob);
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const openReceipt = (paymentId: string) =>
    downloadFile(`/land/rent-payments/${paymentId}/receipt`, `rent-receipt-${paymentId}.pdf`);

  const openLedger = (leaseId: string, format: 'csv' | 'pdf') =>
    downloadFile(`/land/leases/${leaseId}/ledger?format=${format}`, `rent-ledger-${leaseId}.${format}`);

  const totalDue = dues.reduce((sum, d) => {
    const paisa = firstNum(d, ['outstandingPaisa'], 0);
    return sum + (paisa > 0 ? paisa / 100 : firstNum(d, ['amount', 'dueAmount', 'amountDue'], 0));
  }, 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <Link to="/landlord" className="text-xs text-slate-400 hover:text-slate-600 flex items-center gap-1 mb-1">
            <ArrowLeft className="w-3.5 h-3.5" /> Landlord Home
          </Link>
          <h1 className="text-2xl font-extrabold text-slate-900 flex items-center gap-2">
            <HandCoins className="w-7 h-7 text-emerald-600" />
            Rent Collection
          </h1>
          <p className="text-xs text-slate-500 mt-1">Track dues, record payments, download receipts, and export lease ledgers</p>
        </div>
        <button
          onClick={load}
          className="p-2.5 rounded-2xl border border-slate-200 text-slate-500 hover:bg-slate-50 self-start sm:self-auto"
          title="Refresh"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
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

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Record payment */}
        <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs space-y-4">
          <h3 className="font-bold text-sm text-slate-900">Record Payment</h3>
          <form onSubmit={handleRecord} className="space-y-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Lease</label>
              <select
                value={selectedLease}
                onChange={(e) => setSelectedLease(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 bg-white"
                required
              >
                <option value="">Select lease…</option>
                {leases.map((l) => (
                  <option key={str(l.id)} value={str(l.id)}>
                    {firstStr(l, ['tenantName', 'farmerName'], 'Tenant')} — {formatCurrency(firstNum(l, ['monthlyRentRupees'], 0))}/mo
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Amount (₹)</label>
              <input
                type="number"
                value={payForm.amountRupees}
                onChange={(e) => setPayForm({ ...payForm, amountRupees: Number(e.target.value) })}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300"
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Month</label>
                <input
                  type="month"
                  value={payForm.month}
                  onChange={(e) => setPayForm({ ...payForm, month: e.target.value })}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Method</label>
                <select
                  value={payForm.method}
                  onChange={(e) => setPayForm({ ...payForm, method: e.target.value })}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 bg-white"
                >
                  <option value="upi">UPI</option>
                  <option value="cash">Cash</option>
                  <option value="bank">Bank Transfer</option>
                </select>
              </div>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Paid on</label>
              <input
                type="date"
                value={payForm.paidAt}
                onChange={(e) => setPayForm({ ...payForm, paidAt: e.target.value })}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300"
                required
              />
            </div>
            <button type="submit" className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md">
              Record Payment
            </button>
          </form>
        </div>

        {/* Dues */}
        <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs space-y-4 lg:col-span-2">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-sm text-slate-900">Outstanding Dues</h3>
            <span className="text-xs font-bold px-3 py-1 bg-rose-50 text-rose-700 rounded-full border border-rose-100">
              This month: {formatCurrency(summaryDuePaisa / 100)}
            </span>
          </div>
          {dues.length === 0 && !loading ? (
            <div className="space-y-2">
              <p className="text-xs text-slate-400 text-center py-4">
                {totalDue > 0 || summaryDuePaisa > 0
                  ? 'No per-lease due rows returned for this profile.'
                  : 'No outstanding dues. All rents are collected.'}
              </p>
              {summaryDuePaisa > 0 && (
                <p className="text-xs font-bold text-amber-800 bg-amber-50 border border-amber-100 rounded-xl p-3 text-center">
                  ₹{formatCurrency(summaryDuePaisa / 100)} rent pending across active leases this month
                </p>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {dues.map((d) => {
                const paisa = firstNum(d, ['outstandingPaisa'], 0);
                const monthsDue = Array.isArray(d.monthsDue) ? (d.monthsDue as unknown[]).join(', ') : '';
                return (
                  <div key={str(d.leaseId ?? d.id) || JSON.stringify(d).slice(0, 24)} className="p-4 bg-slate-50 rounded-2xl border border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                    <div>
                      <p className="font-bold text-slate-800">
                        {firstStr(d, ['plotName', 'tenantName', 'farmerName'], 'Lease')} — {firstStr(d, ['landlordName', 'leaseNumber'], '')}
                      </p>
                      <p className="text-slate-400">
                        {monthsDue ? `Months due: ${monthsDue}` : `Rent ${formatCurrency(firstNum(d, ['monthlyRentRupees'], 0))}/mo`}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-black text-rose-700">
                        {formatCurrency(paisa > 0 ? paisa / 100 : firstNum(d, ['amount', 'dueAmount', 'amountDue'], 0))}
                      </span>
                      <StatusBadge status={str(d.status, 'overdue')} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Payment history per lease */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs space-y-4">
        <h3 className="font-bold text-sm text-slate-900">Payment History</h3>
        {!selectedLease ? (
          <p className="text-xs text-slate-400 text-center py-4">Select a lease above (or in “Record Payment”) to view its payment history.</p>
        ) : payments.length === 0 ? (
          <p className="text-xs text-slate-400 text-center py-4">No payments recorded for this lease.</p>
        ) : (
          <div className="space-y-3">
            {payments.map((p) => {
              const paisa = firstNum(p, ['amountPaisa'], 0);
              const amount = firstNum(p, ['amountRupees', 'amount'], 0) || paisa / 100;
              return (
                <div key={str(p.id) || JSON.stringify(p).slice(0, 24)} className="p-4 bg-slate-50 rounded-2xl border border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                  <div>
                    <p className="font-bold text-slate-800">
                      {formatCurrency(amount)} — {firstStr(p, ['method', 'mode'], '—')}
                      {str(p.month, '') !== '—' ? ` • ${str(p.month)}` : ''}
                    </p>
                    <p className="text-slate-400">{fmtDate(p.paidAt ?? p.date)}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {str(p.id) && (
                      <button
                        onClick={() => openReceipt(str(p.id))}
                        disabled={busy}
                        className="px-3 py-1.5 rounded-xl border border-slate-200 hover:bg-white text-slate-700 font-bold text-xs flex items-center gap-1 disabled:opacity-60"
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
        {selectedLease && (
          <div className="flex flex-wrap justify-end gap-2">
            <button
              onClick={() => openLedger(selectedLease, 'csv')}
              disabled={busy}
              className="px-4 py-2.5 rounded-2xl border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold text-xs flex items-center gap-2 disabled:opacity-60"
            >
              <FileDown className="w-4 h-4" /> Export Ledger (CSV)
            </button>
            <button
              onClick={() => openLedger(selectedLease, 'pdf')}
              disabled={busy}
              className="px-4 py-2.5 rounded-2xl border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold text-xs flex items-center gap-2 disabled:opacity-60"
            >
              <FileDown className="w-4 h-4" /> Export Ledger (PDF)
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
