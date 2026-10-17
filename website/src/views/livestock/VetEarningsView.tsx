import React, { useEffect, useState } from 'react';
import { IndianRupee, Landmark, Plus, AlertCircle, CheckCircle2, Star } from 'lucide-react';
import { livestock, bankAccounts, readOne, apiErrorMessage } from '../../lib/api';
import { ModalSheet } from '../../components/common/ModalSheet';
import { StatusBadge } from '../../components/common/StatusBadge';
import { StatCard } from '../../components/common/StatCard';
import { formatCurrency } from '../../lib/utils';
import { asRec, boolOf, nameOf, numOf, recArr, strOf, monthStr } from './helpers';

export const VetEarningsView: React.FC = () => {
  const [earnings, setEarnings] = useState<Record<string, unknown> | null>(null);
  const [settlementData, setSettlementData] = useState<Record<string, unknown> | null>(null);
  const [accounts, setAccounts] = useState<Record<string, unknown>[]>([]);
  const [month, setMonth] = useState(monthStr());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [payoutOpen, setPayoutOpen] = useState(false);
  const [payoutForm, setPayoutForm] = useState({ amountPaise: 0, bankAccountId: '', mpin: '' });
  const [saving, setSaving] = useState(false);

  const [acctOpen, setAcctOpen] = useState(false);
  const [acctForm, setAcctForm] = useState({ accountHolder: '', accountNumber: '', ifsc: '', bankName: '' });

  const reload = async () => {
    setLoading(true);
    setError(null);
    try {
      const [e, s, a] = await Promise.all([
        livestock.vet.earnings().catch(() => null),
        livestock.vet.settlements().catch(() => null),
        bankAccounts.list().catch(() => []),
      ]);
      setEarnings(e ? asRec(e) : null);
      setSettlementData(s ? asRec(s) : null);
      setAccounts(recArr(a));
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    reload();
  }, []);

  // earnings endpoint supports ?month=; the lib method takes no params — re-fetch directly
  useEffect(() => {
    (async () => {
      try {
        setEarnings(asRec(await readOne<unknown>('/livestock/vets/me/earnings', { params: { month } })));
      } catch (err) {
        setError(apiErrorMessage(err));
      }
    })();
  }, [month]);

  const settlements = settlementData ? recArr(settlementData.data) : [];
  const pendingPaisa = numOf(settlementData?.pendingPaisa);
  const commissionPct = numOf(settlementData?.commissionPct, 15);

  const requestPayout = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      await livestock.vet.payout({
        amountPaise: Math.round(Number(payoutForm.amountPaise)),
        bankAccountId: payoutForm.bankAccountId,
        mpin: payoutForm.mpin,
      });
      setPayoutOpen(false);
      setNotice('Payout requested — settlement rows will flip to paid on success.');
      await reload();
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const addAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await bankAccounts.add({ ...acctForm });
      setAcctOpen(false);
      setNotice('Bank account added. Verify it to enable payouts.');
      await reload();
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const verifyAccount = async (id: string) => {
    setError(null);
    try {
      await bankAccounts.verify(id);
      setNotice('Bank account verified.');
      await reload();
    } catch (err) {
      setError(apiErrorMessage(err));
    }
  };

  if (loading) return <p className="text-xs text-slate-400">Loading earnings…</p>;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 flex items-center gap-2">
            <IndianRupee className="w-7 h-7 text-emerald-600" />
            Vet Earnings & Payouts
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Consultation fees, platform commission, monthly settlements and bank payouts
          </p>
        </div>
        <div className="flex items-center gap-2 self-start sm:self-auto">
          <input
            type="month"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            className="px-3 py-1.5 text-xs rounded-xl border border-slate-300 bg-white"
          />
          <button
            onClick={() => {
              setPayoutForm({
                amountPaise: pendingPaisa,
                bankAccountId: strOf(accounts.find((a) => a.isPrimary)?.id ?? accounts[0]?.id),
                mpin: '',
              });
              setPayoutOpen(true);
            }}
            disabled={pendingPaisa <= 0}
            className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold text-xs shadow-xs"
          >
            Request Payout
          </button>
        </div>
      </div>

      {error && (
        <div className="p-3 rounded-2xl bg-rose-50 border border-rose-200 text-xs font-bold text-rose-700 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" /> {error}
        </div>
      )}
      {notice && (
        <div className="p-3 rounded-2xl bg-emerald-50 border border-emerald-200 text-xs font-bold text-emerald-700 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" /> {notice}
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatCard
          title="Month Earnings"
          value={formatCurrency(numOf(earnings?.totalEarnings))}
          subtitle={`${numOf(earnings?.completedAppointments)} completed visits`}
          icon={IndianRupee}
          colorScheme="green"
        />
        <StatCard
          title="Pending Settlement"
          value={formatCurrency(pendingPaisa / 100)}
          subtitle={`${commissionPct}% platform commission`}
          icon={Landmark}
          colorScheme="amber"
        />
        <StatCard
          title="Rating"
          value={numOf(earnings?.ratingAverage) > 0 ? numOf(earnings?.ratingAverage).toFixed(1) : '—'}
          subtitle={`${numOf(earnings?.ratingCount)} reviews`}
          icon={Star}
          colorScheme="purple"
        />
        <StatCard title="Settlements" value={settlements.length} icon={Landmark} colorScheme="blue" />
      </div>

      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100">
          <h3 className="font-bold text-sm text-slate-900">Monthly settlements</h3>
        </div>
        {settlements.length === 0 ? (
          <p className="p-6 text-xs text-slate-400">
            No settlements yet — settlements are created automatically from paid consultation fees.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 text-slate-500 font-bold uppercase text-[10px] tracking-wider border-b border-slate-100">
                  <th className="py-3 px-5">Period</th>
                  <th className="py-3 px-3">Appointments</th>
                  <th className="py-3 px-3">Gross</th>
                  <th className="py-3 px-3">Commission</th>
                  <th className="py-3 px-3">Net</th>
                  <th className="py-3 px-3">Paid</th>
                  <th className="py-3 px-3">Status</th>
                  <th className="py-3 px-3">Payout Ref</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {settlements.map((s) => (
                  <tr key={strOf(s.id)} className="hover:bg-slate-50/60">
                    <td className="py-3 px-5 font-bold text-slate-900">{strOf(s.period)}</td>
                    <td className="py-3 px-3 text-slate-600">{numOf(s.appointments)}</td>
                    <td className="py-3 px-3 text-slate-700">{formatCurrency(numOf(s.grossPaisa) / 100)}</td>
                    <td className="py-3 px-3 text-rose-600">-{formatCurrency(numOf(s.commissionPaisa) / 100)}</td>
                    <td className="py-3 px-3 font-bold text-emerald-800">{formatCurrency(numOf(s.netPaisa) / 100)}</td>
                    <td className="py-3 px-3 text-slate-600">{formatCurrency(numOf(s.paidPaisa) / 100)}</td>
                    <td className="py-3 px-3">
                      <StatusBadge status={strOf(s.status, 'pending')} />
                    </td>
                    <td className="py-3 px-3 font-mono text-[10px] text-slate-500">{strOf(s.payoutRef) || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
            <Landmark className="w-4 h-4 text-emerald-600" /> Payout Bank Accounts
          </h3>
          <button
            onClick={() => {
              setAcctForm({ accountHolder: '', accountNumber: '', ifsc: '', bankName: '' });
              setAcctOpen(true);
            }}
            className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-[11px] inline-flex items-center gap-1"
          >
            <Plus className="w-3.5 h-3.5" /> Add Account
          </button>
        </div>
        {accounts.length === 0 ? (
          <p className="text-xs text-slate-400">No bank accounts linked — add one to request payouts.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {accounts.map((a) => {
              const status = strOf(a.status, strOf(a.verificationStatus, 'pending'));
              return (
                <div key={strOf(a.id)} className="p-4 rounded-2xl border border-slate-100 bg-slate-50/60 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-sm text-slate-900">
                      {nameOf(a, strOf(a.bankName, 'Bank account'))}
                    </span>
                    <div className="flex items-center gap-2">
                      {boolOf(a.isPrimary) && (
                        <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 text-[10px] font-bold">
                          Primary
                        </span>
                      )}
                      <StatusBadge status={status} />
                    </div>
                  </div>
                  <p className="text-xs text-slate-500 font-mono">
                    {strOf(a.maskedAccountNumber) || strOf(a.accountNumber) || '—'} • {strOf(a.ifsc)}
                  </p>
                  {status !== 'verified' && (
                    <button
                      onClick={() => verifyAccount(strOf(a.id))}
                      className="text-[11px] font-bold text-emerald-700 hover:text-emerald-800"
                    >
                      Mark verified (test hook)
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Payout modal */}
      <ModalSheet
        isOpen={payoutOpen}
        onClose={() => setPayoutOpen(false)}
        title="Request Payout"
        description={`Pays out pending settlement earnings to your verified bank account. MPIN required.`}
        maxWidth="sm"
      >
        <form onSubmit={requestPayout} className="space-y-3">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Amount (₹) *</label>
            <input
              type="number"
              min="1"
              step="0.01"
              value={payoutForm.amountPaise / 100}
              onChange={(e) => setPayoutForm({ ...payoutForm, amountPaise: Math.round(Number(e.target.value) * 100) })}
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300"
              required
            />
            <p className="text-[10px] text-slate-400 mt-1">
              Pending available: {formatCurrency(pendingPaisa / 100)}
            </p>
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Bank Account *</label>
            <select
              value={payoutForm.bankAccountId}
              onChange={(e) => setPayoutForm({ ...payoutForm, bankAccountId: e.target.value })}
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 bg-white"
              required
            >
              <option value="">Select…</option>
              {accounts.map((a) => (
                <option key={strOf(a.id)} value={strOf(a.id)}>
                  {nameOf(a, strOf(a.bankName, 'Account'))} ({strOf(a.maskedAccountNumber) || strOf(a.accountNumber)})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">MPIN *</label>
            <input
              type="password"
              inputMode="numeric"
              maxLength={6}
              value={payoutForm.mpin}
              onChange={(e) => setPayoutForm({ ...payoutForm, mpin: e.target.value })}
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 tracking-widest"
              required
            />
          </div>
          <button
            type="submit"
            disabled={saving}
            className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white font-bold text-xs shadow-md"
          >
            {saving ? 'Processing…' : 'Confirm Payout'}
          </button>
        </form>
      </ModalSheet>

      {/* Add bank account modal */}
      <ModalSheet
        isOpen={acctOpen}
        onClose={() => setAcctOpen(false)}
        title="Add Bank Account"
        maxWidth="sm"
      >
        <form onSubmit={addAccount} className="space-y-3">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Account Holder *</label>
            <input
              type="text"
              value={acctForm.accountHolder}
              onChange={(e) => setAcctForm({ ...acctForm, accountHolder: e.target.value })}
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300"
              required
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Bank Name</label>
            <input
              type="text"
              value={acctForm.bankName}
              onChange={(e) => setAcctForm({ ...acctForm, bankName: e.target.value })}
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Account Number *</label>
            <input
              type="text"
              value={acctForm.accountNumber}
              onChange={(e) => setAcctForm({ ...acctForm, accountNumber: e.target.value })}
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 font-mono"
              required
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">IFSC *</label>
            <input
              type="text"
              value={acctForm.ifsc}
              onChange={(e) => setAcctForm({ ...acctForm, ifsc: e.target.value })}
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 font-mono"
              required
            />
          </div>
          <button
            type="submit"
            disabled={saving}
            className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white font-bold text-xs shadow-md"
          >
            {saving ? 'Saving…' : 'Add Account'}
          </button>
        </form>
      </ModalSheet>
    </div>
  );
};

export default VetEarningsView;
