import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeft,
  ScrollText,
  RefreshCw,
  BadgeIndianRupee,
  CheckCircle2,
  ShieldCheck,
} from 'lucide-react';
import { postHarvest, apiErrorMessage } from '../../../lib/api';
import { StatusBadge } from '../../../components/common/StatusBadge';
import { ModalSheet } from '../../../components/common/ModalSheet';
import { formatCurrency, formatDate } from '../../../lib/utils';
import { str, num, arr, fromPaisa, type Row } from './types';

interface FeeRow extends Row {
  id?: string;
  kind?: string;
  bookingId?: string;
  gatePassNumber?: string;
  feePaisa?: number;
  amountPaisa?: number;
  status?: string;
  createdAt?: string;
  razorpayOrderId?: string;
}

/** Platform fees + rent ledger — rent accrual/collection per inwarded booking, plus per-booking ₹50 SaaS fees payable via Razorpay order + verify. */
export const RentFeesView: React.FC = () => {
  const [rows, setRows] = useState<FeeRow[]>([]);
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [rent, setRent] = useState<Row | null>(null);
  const [rentError, setRentError] = useState<string | null>(null);
  const [rentStatus, setRentStatus] = useState('');

  const [order, setOrder] = useState<Row | null>(null);
  const [verifyOpen, setVerifyOpen] = useState(false);
  const [paymentId, setPaymentId] = useState('');
  const [signature, setSignature] = useState('');

  // lib's `fees()` takes no params — the status filter is applied client-side.
  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = (await postHarvest.provider.fees()) as unknown;
      setRows(arr((res as Row)?.data ?? res) as FeeRow[]);
    } catch (e) {
      setError(apiErrorMessage(e));
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadRent = useCallback(async () => {
    setRentError(null);
    try {
      setRent((await postHarvest.provider.rentLedger()) as unknown as Row);
    } catch (e) {
      setRent(null);
      setRentError(apiErrorMessage(e));
    }
  }, []);

  useEffect(() => {
    load();
    loadRent();
  }, [load, loadRent]);

  const rentEntries = arr(rent?.entries);
  const visibleRent = rentStatus ? rentEntries.filter((r) => str(r.status) === rentStatus) : rentEntries;
  const rentSummary = (rent?.summary ?? {}) as Row;

  const visibleRows = status ? rows.filter((r) => str(r.status) === status) : rows;

  const pendingTotal = rows
    .filter((r) => str(r.status) === 'pending')
    .reduce((s, r) => s + num(r.feePaisa ?? r.amountPaisa), 0);

  const pay = async (fee: FeeRow) => {
    const id = str(fee.id);
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const res = (await postHarvest.provider.payFee(id, {})) as Row;
      if (res.alreadySettled) {
        setNotice('This fee is already settled.');
        await load();
      } else {
        setOrder(res);
        setVerifyOpen(true);
      }
    } catch (e) {
      setError(apiErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const verify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!order) return;
    setBusy(true);
    setError(null);
    try {
      await postHarvest.provider.verifyFeePayment(str(order.feeId), {
        razorpayOrderId: str(order.razorpayOrderId),
        razorpayPaymentId: paymentId.trim(),
        signature: signature.trim(),
      });
      setNotice('Fee payment verified and settled.');
      setVerifyOpen(false);
      setOrder(null);
      setPaymentId('');
      setSignature('');
      await load();
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="border-b border-slate-200 pb-4">
        <Link to="/coldStorageProvider" className="inline-flex items-center gap-1 text-xs font-bold text-slate-500 hover:text-emerald-600 mb-2">
          <ArrowLeft className="w-4 h-4" /> Back to console
        </Link>
        <h1 className="text-2xl font-extrabold text-slate-900 flex items-center gap-2">
          <ScrollText className="w-7 h-7 text-emerald-600" />
          Rent & Platform Fees
        </h1>
        <p className="text-xs text-slate-500 mt-1">
          Rent accrued on inwarded lots (collected at the gate) and per-booking SaaS fees (₹50) payable via Razorpay
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl border border-slate-200/80 p-5">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Rent Outstanding</span>
          <div className="text-2xl font-bold text-amber-600 mt-2">{formatCurrency(num(rentSummary.totalOutstandingRupees))}</div>
          <p className="mt-1 text-xs text-slate-500">
            {formatCurrency(num(rentSummary.totalCollectedRupees))} collected of {formatCurrency(num(rentSummary.totalAccruedRupees))} accrued
          </p>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200/80 p-5">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Platform Fees Pending</span>
          <div className="text-2xl font-bold text-slate-900 mt-2">{formatCurrency(fromPaisa(pendingTotal))}</div>
          <p className="mt-1 text-xs text-slate-500">{rows.filter((r) => str(r.status) === 'pending').length} unsettled fees</p>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200/80 p-5">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Fee Flow</span>
          <div className="text-sm font-bold text-slate-900 mt-2 flex items-center gap-1.5">
            <BadgeIndianRupee className="w-4 h-4 text-emerald-600" /> order → pay → verify
          </div>
          <p className="mt-1 text-xs text-slate-500">Idempotent per fee — open orders are reused</p>
        </div>
      </div>

      {error && (
        <div className="bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold rounded-2xl px-4 py-3">{error}</div>
      )}
      {notice && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-semibold rounded-2xl px-4 py-3">{notice}</div>
      )}

      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between gap-3 flex-wrap">
          <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
            <ScrollText className="w-4 h-4 text-emerald-600" />
            Rent Ledger <span className="text-[10px] font-bold text-slate-400">({visibleRent.length})</span>
          </h3>
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-1.5 flex-wrap">
              {[
                { value: '', label: 'All' },
                { value: 'paid', label: 'Paid' },
                { value: 'due', label: 'Due' },
                { value: 'overdue', label: 'Overdue' },
                { value: 'accrued', label: 'Accrued' },
              ].map((f) => (
                <button
                  key={f.value}
                  onClick={() => setRentStatus(f.value)}
                  className={`px-3 py-1 rounded-full text-[11px] font-bold border transition-colors ${
                    rentStatus === f.value ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white text-slate-500 border-slate-200 hover:border-emerald-300'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
            <button onClick={loadRent} className="p-1.5 text-slate-400 hover:text-emerald-600 rounded-xl hover:bg-slate-100" title="Refresh rent ledger">
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>
        {rentError && (
          <div className="m-4 bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold rounded-2xl px-4 py-3">{rentError}</div>
        )}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50 text-slate-500 font-bold uppercase text-[10px] tracking-wider border-b border-slate-100">
                <th className="py-3 px-4">Farmer & Commodity</th>
                <th className="py-3 px-4">Facility</th>
                <th className="py-3 px-4">Inward Date</th>
                <th className="py-3 px-4">Accrued</th>
                <th className="py-3 px-4">Collected</th>
                <th className="py-3 px-4">Balance</th>
                <th className="py-3 px-4">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {visibleRent.map((r) => (
                <tr key={str(r.bookingId)} className="hover:bg-slate-50/60">
                  <td className="py-3.5 px-4 font-bold text-slate-900">
                    {str(r.farmerName, 'Farmer')}
                    <span className="text-[10px] text-slate-400 block font-normal">
                      {str(r.commodity)}{r.receiptNumber ? ` · ${str(r.receiptNumber)}` : ''}
                    </span>
                  </td>
                  <td className="py-3.5 px-4 font-medium text-slate-600">{str(r.storageLocation, '—')}</td>
                  <td className="py-3.5 px-4 font-medium text-slate-600">{formatDate(str(r.inwardDate))}</td>
                  <td className="py-3.5 px-4 font-black text-slate-900">{formatCurrency(num(r.accruedRentRupees))}</td>
                  <td className="py-3.5 px-4 font-semibold text-emerald-700">{formatCurrency(num(r.paidRentRupees))}</td>
                  <td className="py-3.5 px-4 font-semibold text-amber-700">{formatCurrency(num(r.balanceDueRupees))}</td>
                  <td className="py-3.5 px-4">
                    <StatusBadge status={str(r.status, 'accrued')} />
                  </td>
                </tr>
              ))}
              {visibleRent.length === 0 && !rentError && (
                <tr>
                  <td colSpan={7} className="py-10 text-center text-slate-400 font-semibold">
                    {rent ? 'No rent entries match this filter.' : 'Rent ledger unavailable.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="p-3 border-t border-slate-100 text-[10px] text-slate-400">
          Rent is settled at the gate on release — record collections in the release dialog on the booking file. The ledger refreshes from inwarded bookings.
        </div>
      </div>

      <h3 className="font-bold text-sm text-slate-900 pt-2">Platform Fees Ledger</h3>

      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-1.5 flex-wrap">
            <h3 className="font-bold text-sm text-slate-900 mr-2">
              Per-Booking Fees <span className="text-[10px] font-bold text-slate-400">({visibleRows.length})</span>
            </h3>
            {[
              { value: '', label: 'All' },
              { value: 'pending', label: 'Pending' },
              { value: 'settled', label: 'Settled' },
            ].map((f) => (
              <button
                key={f.value}
                onClick={() => setStatus(f.value)}
                className={`px-3 py-1 rounded-full text-[11px] font-bold border transition-colors ${
                  status === f.value ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white text-slate-500 border-slate-200 hover:border-emerald-300'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
          <button onClick={() => load()} className="p-1.5 text-slate-400 hover:text-emerald-600 rounded-xl hover:bg-slate-100" title="Refresh">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50 text-slate-500 font-bold uppercase text-[10px] tracking-wider border-b border-slate-100">
                <th className="py-3 px-4">Fee</th>
                <th className="py-3 px-4">Booking / Gate Pass</th>
                <th className="py-3 px-4">Amount</th>
                <th className="py-3 px-4">Created</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-6 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {visibleRows.map((fee) => {
                const id = str(fee.id);
                const settled = str(fee.status) === 'settled';
                return (
                  <tr key={id} className="hover:bg-slate-50/60">
                    <td className="py-3.5 px-4 font-mono text-[11px] font-bold text-slate-700">{id}</td>
                    <td className="py-3.5 px-4 font-medium text-slate-600">
                      {str(fee.bookingId, '—')}
                      {fee.gatePassNumber && <span className="block font-mono text-[10px] text-slate-400">{str(fee.gatePassNumber)}</span>}
                    </td>
                    <td className="py-3.5 px-4 font-black text-slate-900">{formatCurrency(fromPaisa(num(fee.feePaisa ?? fee.amountPaisa)))}</td>
                    <td className="py-3.5 px-4 font-medium text-slate-600">{formatDate(str(fee.createdAt))}</td>
                    <td className="py-3.5 px-4">
                      {settled ? (
                        <span className="inline-flex items-center gap-1 text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-full text-[11px] font-bold">
                          <CheckCircle2 className="w-3 h-3" /> Settled
                        </span>
                      ) : (
                        <StatusBadge status="pending" />
                      )}
                    </td>
                    <td className="py-3.5 px-6 text-right">
                      {!settled && (
                        <button onClick={() => pay(fee)} disabled={busy}
                          className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white font-bold text-xs rounded-xl">
                          Pay Now
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
              {visibleRows.length === 0 && !loading && (
                <tr>
                  <td colSpan={6} className="py-10 text-center text-slate-400 font-semibold">
                    No platform fees yet — they appear on the first gate release.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Payment verification modal */}
      <ModalSheet isOpen={verifyOpen} onClose={() => setVerifyOpen(false)} title="Verify Fee Payment" maxWidth="md">
        {order && (
          <form onSubmit={verify} className="space-y-3">
            <div className="bg-slate-50 rounded-2xl p-3 space-y-1 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-slate-500 font-bold">Razorpay Order</span>
                <span className="font-mono font-bold text-slate-800">{str(order.razorpayOrderId)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500 font-bold">Amount</span>
                <span className="font-black text-slate-900">{formatCurrency(fromPaisa(num(order.amountPaisa)))}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500 font-bold">Key ID</span>
                <span className="font-mono text-slate-600">{str(order.keyId, '—')}</span>
              </div>
            </div>
            <p className="text-[11px] text-slate-500">
              In production the Razorpay checkout opens for this order; paste the payment id and signature returned on success to settle the fee.
            </p>
            <label className="block text-[10px] font-bold text-slate-500 uppercase">
              Razorpay Payment ID
              <input value={paymentId} onChange={(e) => setPaymentId(e.target.value)} required placeholder="pay_…"
                className="mt-1 w-full px-3 py-2 text-sm font-mono border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-200" />
            </label>
            <label className="block text-[10px] font-bold text-slate-500 uppercase">
              Signature
              <input value={signature} onChange={(e) => setSignature(e.target.value)} required
                className="mt-1 w-full px-3 py-2 text-sm font-mono border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-200" />
            </label>
            <button type="submit" disabled={busy}
              className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white font-bold text-sm rounded-xl flex items-center justify-center gap-1.5">
              <ShieldCheck className="w-4 h-4" /> {busy ? 'Verifying…' : 'Verify & Settle'}
            </button>
          </form>
        )}
      </ModalSheet>
    </div>
  );
};
