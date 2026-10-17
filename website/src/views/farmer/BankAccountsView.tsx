import React, { useEffect, useState } from 'react';
import {
  Landmark,
  Plus,
  ShieldCheck,
  Star,
  Trash2,
  BadgeCheck,
} from 'lucide-react';
import { bankAccounts, apiErrorMessage } from '../../lib/api';
import { ModalSheet } from '../../components/common/ModalSheet';
import { StatusBadge } from '../../components/common/StatusBadge';

const asRecord = (v: unknown): Record<string, unknown> =>
  v !== null && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
const asStr = (v: unknown, fallback = ''): string => (typeof v === 'string' ? v : fallback);

export const BankAccountsView: React.FC = () => {
  const [accounts, setAccounts] = useState<unknown[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [addModalOpen, setAddModalOpen] = useState(false);

  // Add form
  const [bankName, setBankName] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [ifsc, setIfsc] = useState('');
  const [accountHolder, setAccountHolder] = useState('');
  const [adding, setAdding] = useState(false);

  const reload = async () => {
    const list = await bankAccounts.list();
    setAccounts(list);
  };

  useEffect(() => {
    let active = true;
    setLoading(true);
    reload()
      .catch((e) => active && setError(apiErrorMessage(e)))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, []);

  const withBusy = async (id: string, fn: () => Promise<unknown>, successMessage: string) => {
    setBusyId(id);
    setError(null);
    try {
      await fn();
      await reload();
      setNotice(successMessage);
    } catch (e) {
      setError(apiErrorMessage(e));
    } finally {
      setBusyId(null);
    }
  };

  const handleAdd = async () => {
    setAdding(true);
    setError(null);
    try {
      await bankAccounts.add({
        bankName,
        accountNumber,
        ifsc: ifsc.toUpperCase(),
        accountHolderName: accountHolder,
      });
      await reload();
      setAddModalOpen(false);
      setBankName('');
      setAccountNumber('');
      setIfsc('');
      setAccountHolder('');
      setNotice('Bank account added. Verify it to receive settlements.');
    } catch (e) {
      setError(apiErrorMessage(e));
    } finally {
      setAdding(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 flex items-center gap-2">
            <Landmark className="w-7 h-7 text-emerald-600" />
            Bank Accounts (DBT Settlement Accounts)
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Link and verify bank accounts for purchase settlements, PM-KISAN DBT and loan disbursements
          </p>
        </div>

        <button
          onClick={() => setAddModalOpen(true)}
          className="px-4 py-2.5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md flex items-center gap-2 self-start sm:self-auto transition-all"
        >
          <Plus className="w-4 h-4" />
          <span>Add Bank Account</span>
        </button>
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

      {loading ? (
        <div className="py-10 text-center text-xs font-bold text-slate-400 animate-pulse">
          Loading bank accounts…
        </div>
      ) : accounts.length === 0 ? (
        <div className="py-10 text-center text-xs font-semibold text-slate-400 bg-white rounded-3xl border border-slate-200/80">
          No bank accounts linked yet. Add your DBT account to receive payments.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {accounts.map((acc, i) => {
            const r = asRecord(acc);
            const id = asStr(r.id, String(i));
            const verified = r.verified === true || asStr(r.status) === 'verified';
            const primary = r.isPrimary === true || r.primary === true;
            const masked = asStr(r.maskedAccountNumber ?? r.accountNumber, '••••');
            return (
              <div
                key={id}
                className={`bg-white rounded-3xl p-6 border shadow-xs space-y-4 ${
                  primary ? 'border-emerald-300 ring-2 ring-emerald-100' : 'border-slate-200/80'
                }`}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="p-3 rounded-2xl bg-slate-100 text-slate-700">
                      <Landmark className="w-6 h-6" />
                    </div>
                    <div>
                      <h4 className="font-extrabold text-base text-slate-900">{asStr(r.bankName, 'Bank')}</h4>
                      <p className="text-xs text-slate-400 font-mono">
                        A/c {masked} • IFSC {asStr(r.ifsc, '—')}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {primary && (
                      <span className="text-[10px] font-black text-emerald-800 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full flex items-center gap-1">
                        <Star className="w-3 h-3 fill-emerald-600 text-emerald-600" /> Primary
                      </span>
                    )}
                    {verified ? (
                      <StatusBadge status="verified" />
                    ) : (
                      <StatusBadge status={asStr(r.status, 'pending')} />
                    )}
                  </div>
                </div>

                <div className="text-xs text-slate-500">
                  Holder: <strong className="text-slate-800">{asStr(r.accountHolderName ?? r.holderName, '—')}</strong>
                </div>

                <div className="pt-3 border-t border-slate-100 flex flex-wrap gap-2">
                  {!verified && (
                    <button
                      onClick={() => withBusy(id, () => bankAccounts.verify(id), 'Account verification initiated (₹1 deposit check).')}
                      disabled={busyId === id}
                      className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-1.5 disabled:opacity-50"
                    >
                      <BadgeCheck className="w-3.5 h-3.5" /> Verify Account
                    </button>
                  )}
                  {!primary && (
                    <button
                      onClick={() => withBusy(id, () => bankAccounts.setPrimary(id), 'Primary settlement account updated.')}
                      disabled={busyId === id}
                      className="px-3.5 py-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold text-xs disabled:opacity-50"
                    >
                      Set Primary
                    </button>
                  )}
                  {!primary && (
                    <button
                      onClick={() => withBusy(id, () => bankAccounts.remove(id), 'Bank account removed.')}
                      disabled={busyId === id}
                      className="px-3 py-2 rounded-xl border border-rose-200 text-rose-600 hover:bg-rose-50 font-bold text-xs flex items-center gap-1.5 disabled:opacity-50"
                    >
                      <Trash2 className="w-3.5 h-3.5" /> Remove
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="p-3.5 bg-sky-50 border border-sky-200 rounded-2xl text-xs text-sky-900 flex items-start gap-2">
        <ShieldCheck className="w-4 h-4 text-sky-700 flex-shrink-0 mt-0.5" />
        <span>Account details are encrypted with AES-256. Settlements above ₹50,000 require a verified primary account.</span>
      </div>

      {/* Add account modal */}
      <ModalSheet
        isOpen={addModalOpen}
        onClose={() => setAddModalOpen(false)}
        title="Add Bank Account"
        description="Link a savings/current account for DBT and settlements"
        maxWidth="sm"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Account Holder Name</label>
            <input
              type="text"
              value={accountHolder}
              onChange={(e) => setAccountHolder(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300"
              required
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Bank Name</label>
            <input
              type="text"
              value={bankName}
              onChange={(e) => setBankName(e.target.value)}
              placeholder="e.g. State Bank of India"
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300"
              required
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Account Number</label>
            <input
              type="text"
              value={accountNumber}
              onChange={(e) => setAccountNumber(e.target.value.replace(/\D/g, ''))}
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 font-mono"
              required
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">IFSC</label>
            <input
              type="text"
              value={ifsc}
              onChange={(e) => setIfsc(e.target.value)}
              placeholder="SBIN0001234"
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 font-mono uppercase"
              required
            />
          </div>
          <button
            onClick={handleAdd}
            disabled={adding || !bankName || !accountNumber || !ifsc || !accountHolder}
            className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md disabled:opacity-60"
          >
            {adding ? 'Adding…' : 'Add Account'}
          </button>
        </div>
      </ModalSheet>
    </div>
  );
};
