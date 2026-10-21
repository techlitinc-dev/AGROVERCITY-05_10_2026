import React, { useEffect, useState } from 'react';
import {
  DollarSign,
  CreditCard,
  Download,
  Plus,
  CheckCircle2,
  Clock,
  ArrowUpRight,
  X,
  FileSpreadsheet,
} from 'lucide-react';
import { nursery } from '../../lib/api';

export const NurseryPayoutsView: React.FC = () => {
  const [data, setData] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);

  // Modal
  const [showModal, setShowModal] = useState(false);
  const [amount, setAmount] = useState<number>(1000);
  const [upi, setUpi] = useState('');
  const [notes, setNotes] = useState('');
  const [requesting, setRequesting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const loadPayouts = () => {
    setLoading(true);
    nursery
      .payouts()
      .then((res) => {
        setData((res as Record<string, unknown>) || {});
      })
      .catch(() => setData({}))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadPayouts();
  }, []);

  const handleRequestPayout = async (e: React.FormEvent) => {
    e.preventDefault();
    setRequesting(true);
    try {
      await nursery.requestPayout({
        amount: Number(amount),
        settlementUpi: upi,
        notes,
      });
      setShowModal(false);
      setMessage('Payout withdrawal initiated successfully!');
      setTimeout(() => setMessage(null), 4000);
      loadPayouts();
    } catch (err) {
      alert('Failed to request payout');
    } finally {
      setRequesting(false);
    }
  };

  const handleExportCsv = () => {
    window.open('/v1/nursery/payouts/export', '_blank');
  };

  const gross = Number(data?.grossRevenue || 0);
  const commission = Number(data?.commissionDeducted || 0);
  const net = Number(data?.netEarnings || 0);
  const available = Number(data?.availableBalance || 0);
  const payouts = (data?.payouts as Array<Record<string, unknown>>) || [];

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <DollarSign className="w-6 h-6 text-emerald-700" />
            Earnings & Settlement Payouts
          </h1>
          <p className="text-xs text-slate-500">
            Track gross sales, 5% platform commission deductions, and withdraw net earnings to your bank account or UPI.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleExportCsv}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 text-xs font-bold transition"
          >
            <Download className="w-3.5 h-3.5 text-slate-500" /> Export CSV
          </button>
          <button
            onClick={() => {
              setAmount(available > 0 ? available : 1000);
              setShowModal(true);
            }}
            disabled={available <= 0}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs shadow-md transition disabled:opacity-50"
          >
            <ArrowUpRight className="w-4 h-4" /> Withdraw Earnings
          </button>
        </div>
      </div>

      {message && (
        <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs font-bold flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          {message}
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-sm space-y-2">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">
            Gross Sales
          </span>
          <div className="text-2xl font-black text-slate-900">
            ₹{gross.toLocaleString('en-IN')}
          </div>
          <p className="text-[11px] text-slate-400">Total delivered saplings</p>
        </div>

        <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-sm space-y-2">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">
            Platform Fee (5%)
          </span>
          <div className="text-2xl font-black text-slate-700">
            ₹{commission.toLocaleString('en-IN')}
          </div>
          <p className="text-[11px] text-slate-400">Escrow & payment processing</p>
        </div>

        <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-sm space-y-2">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">
            Net Earnings
          </span>
          <div className="text-2xl font-black text-emerald-800">
            ₹{net.toLocaleString('en-IN')}
          </div>
          <p className="text-[11px] text-emerald-700">95% proceeds credited</p>
        </div>

        <div className="p-5 rounded-2xl bg-emerald-50 border border-emerald-200 shadow-sm space-y-2">
          <span className="text-xs font-bold text-emerald-800 uppercase tracking-wider block">
            Available to Withdraw
          </span>
          <div className="text-2xl font-black text-emerald-950">
            ₹{available.toLocaleString('en-IN')}
          </div>
          <p className="text-[11px] text-emerald-700">Instant UPI settlement</p>
        </div>
      </div>

      {/* Payout History Table */}
      <div className="rounded-3xl bg-white border border-slate-200 overflow-hidden shadow-sm">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <CreditCard className="w-4 h-4 text-emerald-700" />
            Payout & Settlement Ledger ({payouts.length})
          </h3>
        </div>

        {loading ? (
          <div className="py-16 text-center text-xs text-slate-400 font-bold">Loading payouts…</div>
        ) : payouts.length === 0 ? (
          <div className="p-12 text-center space-y-2">
            <DollarSign className="w-8 h-8 text-slate-300 mx-auto" />
            <p className="text-xs text-slate-500 font-bold">No payouts recorded yet.</p>
            <p className="text-[11px] text-slate-400">
              When orders are marked delivered, your earnings become available for payout.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100 text-[11px] font-black uppercase tracking-wider text-slate-500">
                  <th className="py-3 px-4">Payout ID</th>
                  <th className="py-3 px-4">Amount</th>
                  <th className="py-3 px-4">Destination UPI</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Initiated At</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {payouts.map((p) => {
                  const pId = String(p.id || '');
                  const status = String(p.status || 'processed');
                  return (
                    <tr key={pId} className="hover:bg-slate-50/70 transition">
                      <td className="py-3.5 px-4 font-mono font-bold text-slate-900">
                        {pId}
                      </td>
                      <td className="py-3.5 px-4 font-black text-emerald-800 text-sm">
                        ₹{Number(p.amount || 0).toLocaleString('en-IN')}
                      </td>
                      <td className="py-3.5 px-4 font-mono text-slate-600">
                        {String(p.settlementUpi || 'ramesh@upi')}
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-emerald-100 text-emerald-800">
                          {status}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-slate-500">
                        {String(p.createdAt || '').slice(0, 16).replace('T', ' ')}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <ArrowUpRight className="w-4 h-4 text-emerald-700" />
                Withdraw Settlement Earnings
              </h3>
              <button
                onClick={() => setShowModal(false)}
                className="p-1 rounded-full hover:bg-slate-100 text-slate-400"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleRequestPayout} className="space-y-3.5 text-xs">
              <div className="p-3 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-950">
                <span className="text-[11px] block font-bold text-emerald-800">Available Balance:</span>
                <span className="text-lg font-black">₹{available.toLocaleString('en-IN')}</span>
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-700">Withdrawal Amount (₹) *</label>
                <input
                  type="number"
                  min="100"
                  max={available}
                  required
                  value={amount}
                  onChange={(e) => setAmount(Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 focus:ring-2 focus:ring-emerald-500 focus:outline-none text-sm font-bold"
                />
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-700">Settlement UPI ID</label>
                <input
                  type="text"
                  value={upi}
                  onChange={(e) => setUpi(e.target.value)}
                  placeholder="ramesh.nursery@okhdfcbank"
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-700">Settlement Notes</label>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Weekly sapling sales payout"
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={requesting || amount <= 0 || amount > available}
                  className="px-4 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-bold transition disabled:opacity-50"
                >
                  {requesting ? 'Processing…' : 'Confirm Withdrawal'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
