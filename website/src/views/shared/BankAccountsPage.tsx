import React, { useEffect, useState } from 'react';
import { Landmark, Plus, ShieldCheck, Star, Trash2, AlertCircle, CheckCircle2 } from 'lucide-react';
import { apiErrorMessage, bankAccounts } from '../../lib/api';
import { StatusBadge } from '../../components/common/StatusBadge';
import { cn } from '../../lib/utils';
import { asRecords, bool, pickStr } from './records';

export const BankAccountsPage: React.FC = () => {
  const [accounts, setAccounts] = useState<Record<string, unknown>[]>([]);
  const [holder, setHolder] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [ifsc, setIfsc] = useState('');
  const [bankName, setBankName] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);

  const load = async () => {
    const rows = await bankAccounts.list().catch(() => []);
    setAccounts(asRecords(rows));
  };

  useEffect(() => {
    void load();
  }, []);

  const flash = (kind: 'ok' | 'err', text: string) => {
    setNotice({ kind, text });
    window.setTimeout(() => setNotice(null), 5000);
  };

  const add = async () => {
    if (busy) return;
    setBusy('add');
    try {
      await bankAccounts.add({
        holderName: holder.trim(),
        accountNumber: accountNumber.trim(),
        ifsc: ifsc.trim().toUpperCase(),
        bankName: bankName.trim() || undefined,
      });
      flash('ok', 'Bank account added. Run penny-drop verification to start receiving settlements.');
      setHolder('');
      setAccountNumber('');
      setIfsc('');
      setBankName('');
      await load();
    } catch (err) {
      flash('err', apiErrorMessage(err));
    } finally {
      setBusy(null);
    }
  };

  const verify = async (id: string) => {
    if (busy) return;
    setBusy(id);
    try {
      await bankAccounts.verify(id);
      flash('ok', 'Penny-drop verification initiated — status updates within minutes.');
      await load();
    } catch (err) {
      flash('err', apiErrorMessage(err));
    } finally {
      setBusy(null);
    }
  };

  const setPrimary = async (id: string) => {
    if (busy) return;
    setBusy(id);
    try {
      await bankAccounts.setPrimary(id);
      flash('ok', 'Primary account updated — all settlements route here.');
      await load();
    } catch (err) {
      flash('err', apiErrorMessage(err));
    } finally {
      setBusy(null);
    }
  };

  const remove = async (id: string) => {
    if (busy) return;
    setBusy(id);
    try {
      await bankAccounts.remove(id);
      flash('ok', 'Bank account removed.');
      await load();
    } catch (err) {
      flash('err', apiErrorMessage(err));
    } finally {
      setBusy(null);
    }
  };

  const canAdd = holder.trim() && accountNumber.trim().length >= 9 && ifsc.trim().length === 11;

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="border-b border-slate-200 pb-4">
        <h1 className="text-2xl font-extrabold text-slate-900 flex items-center gap-2">
          <Landmark className="w-7 h-7 text-emerald-600" />
          Bank Accounts
        </h1>
        <p className="text-xs text-slate-500 mt-1">
          Linked accounts receive crop sale settlements, loan disbursements, and subsidy DBT credits
        </p>
      </div>

      {notice && (
        <div
          className={cn(
            'rounded-2xl border p-3 text-xs flex items-start gap-2',
            notice.kind === 'ok'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-rose-50 border-rose-200 text-rose-800'
          )}
        >
          {notice.kind === 'ok' ? (
            <CheckCircle2 className="w-4 h-4 flex-shrink-0 mt-0.5" />
          ) : (
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          )}
          <span>{notice.text}</span>
        </div>
      )}

      {/* Add form */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs p-5 space-y-4">
        <h3 className="font-bold text-sm text-slate-900 flex items-center gap-1.5">
          <Plus className="w-4 h-4 text-emerald-600" /> Add a Bank Account
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <input
            type="text"
            value={holder}
            onChange={(e) => setHolder(e.target.value)}
            placeholder="Account holder name"
            className="px-3 py-2.5 text-xs rounded-xl border border-slate-300 focus:outline-none focus:border-emerald-600"
          />
          <input
            type="text"
            value={accountNumber}
            onChange={(e) => setAccountNumber(e.target.value.replace(/\D/g, '').slice(0, 18))}
            placeholder="Account number"
            className="px-3 py-2.5 text-xs rounded-xl border border-slate-300 focus:outline-none focus:border-emerald-600"
          />
          <input
            type="text"
            value={ifsc}
            onChange={(e) => setIfsc(e.target.value.toUpperCase().slice(0, 11))}
            placeholder="IFSC (e.g. SBIN0061234)"
            className="px-3 py-2.5 text-xs rounded-xl border border-slate-300 focus:outline-none focus:border-emerald-600"
          />
          <input
            type="text"
            value={bankName}
            onChange={(e) => setBankName(e.target.value)}
            placeholder="Bank name (optional)"
            className="px-3 py-2.5 text-xs rounded-xl border border-slate-300 focus:outline-none focus:border-emerald-600"
          />
        </div>
        <button
          onClick={() => void add()}
          disabled={!canAdd || busy === 'add'}
          className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white font-bold text-xs rounded-xl shadow-xs"
        >
          {busy === 'add' ? 'Adding…' : 'Add Account'}
        </button>
      </div>

      {/* List */}
      <div className="space-y-3">
        {accounts.length === 0 ? (
          <p className="text-xs text-slate-400 bg-white rounded-3xl border border-slate-200/80 p-6 text-center">
            No bank accounts linked yet — add one above to receive payments.
          </p>
        ) : (
          accounts.map((a, i) => {
            const id = pickStr(a, 'id', 'accountId') || String(i);
            const primary = bool(a['isPrimary']);
            const status = pickStr(a, 'status', 'verificationStatus') || 'pending';
            return (
              <div key={id} className="bg-white rounded-3xl border border-slate-200/80 shadow-xs p-5 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-extrabold text-sm text-slate-900 flex items-center gap-2">
                      {pickStr(a, 'bankName', 'bank') || 'Bank account'}
                      {primary && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200 flex items-center gap-1">
                          <Star className="w-3 h-3 fill-current" /> PRIMARY
                        </span>
                      )}
                    </p>
                    <p className="text-[11px] text-slate-400 font-mono mt-0.5">
                      {pickStr(a, 'maskedAccountNumber', 'accountNumberMasked') ||
                        `•••• ${pickStr(a, 'accountNumber').slice(-4)}`}{' '}
                      · IFSC {pickStr(a, 'ifsc') || '—'}
                    </p>
                    <p className="text-[11px] text-slate-400">{pickStr(a, 'holderName') || ''}</p>
                  </div>
                  <StatusBadge status={status} />
                </div>
                <div className="flex flex-wrap gap-2">
                  {status !== 'verified' && (
                    <button
                      onClick={() => void verify(id)}
                      disabled={busy !== null}
                      className="px-3 py-1.5 bg-sky-600 hover:bg-sky-700 disabled:opacity-40 text-white text-[11px] font-bold rounded-xl flex items-center gap-1"
                    >
                      <ShieldCheck className="w-3.5 h-3.5" /> Verify
                    </button>
                  )}
                  {!primary && (
                    <button
                      onClick={() => void setPrimary(id)}
                      disabled={busy !== null}
                      className="px-3 py-1.5 bg-amber-50 border border-amber-200 text-amber-800 text-[11px] font-bold rounded-xl disabled:opacity-40"
                    >
                      Set primary
                    </button>
                  )}
                  <button
                    onClick={() => void remove(id)}
                    disabled={busy !== null}
                    className="px-3 py-1.5 bg-rose-50 border border-rose-200 text-rose-700 text-[11px] font-bold rounded-xl disabled:opacity-40 flex items-center gap-1"
                  >
                    <Trash2 className="w-3.5 h-3.5" /> Remove
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
