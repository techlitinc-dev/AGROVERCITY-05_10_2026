import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Check, Landmark, RefreshCw, ShieldAlert, Wallet, X } from 'lucide-react';
import { transport, apiErrorMessage } from '../../lib/api';
import { StatCard } from '../../components/common/StatCard';
import { StatusBadge } from '../../components/common/StatusBadge';
import { formatCurrency } from '../../lib/utils';
import { asArr, asRec, firstNum, firstStr, fmtDate, str, type Rec } from './utils';

/** /transporter/wallet — balance/escrow/earnings, MPIN payouts, settlements, compliance. */
export const TransportWalletView: React.FC = () => {
  const [wallet, setWallet] = useState<Rec>({});
  const [settlements, setSettlements] = useState<Rec[]>([]);
  const [compliance, setCompliance] = useState<Rec>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [payoutForm, setPayoutForm] = useState({ amount: 0, mpin: '' });

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [w, s, c] = await Promise.all([
        transport.wallet(),
        transport.settlements().catch(() => [] as unknown[]),
        transport.compliance().catch(() => ({})),
      ]);
      setWallet(asRec(w));
      setSettlements(asArr(s).map(asRec));
      setCompliance(asRec(c));
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

  /**
   * POST /transport/payouts is MPIN-gated and pays the primary verified bank
   * account over RazorpayX — no method/destination fields exist server-side.
   */
  const handlePayout = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await transport.payout({
        mpin: payoutForm.mpin,
        ...(payoutForm.amount > 0 ? { amountPaisa: Math.round(payoutForm.amount * 100) } : {}),
      });
      setPayoutForm({ amount: 0, mpin: '' });
      flash('Payout processed to your verified bank account.');
      await load();
    } catch (err) {
      setError(apiErrorMessage(err));
    }
  };

  const balancePaisa = firstNum(wallet, ['balancePaisa', 'balance', 'availableBalance'], 0);
  const tds = asRec(wallet.tds);
  const tdsDeductedPaisa = firstNum(tds, ['tdsDeductedPaisa'], 0);
  const tdsRate = firstNum(tds, ['tdsRatePct'], 0);
  const entries = asArr(wallet.entries).map(asRec);
  const strikes = firstNum(compliance, ['strikeCount', 'noShowStrikes', 'activeStrikes', 'strikes'], 0);
  const cooldowns = asRec(compliance.cooldowns);
  const loadBoardSuspended = cooldowns.loadBoardSuspended === true;
  const bookingRestricted = cooldowns.bookingRestricted === true;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <Link to="/transporter" className="text-xs text-slate-400 hover:text-slate-600 flex items-center gap-1 mb-1">
            <ArrowLeft className="w-3.5 h-3.5" /> Transporter Home
          </Link>
          <h1 className="text-2xl font-extrabold text-slate-900 flex items-center gap-2">
            <Wallet className="w-7 h-7 text-emerald-600" />
            Wallet & Payouts
          </h1>
          <p className="text-xs text-slate-500 mt-1">Trip earnings ledger, MPIN-gated payouts to your verified bank, settlements, and compliance</p>
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

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard title="Wallet Balance" value={formatCurrency(balancePaisa / 100)} subtitle="Withdrawable now" icon={Wallet} colorScheme="green" />
        <StatCard title="TDS Deducted" value={formatCurrency(tdsDeductedPaisa / 100)} subtitle={tdsRate > 0 ? `194-O rate ${tdsRate}%` : 'Section 194-O'} icon={Landmark} colorScheme="amber" />
        <StatCard title="Ledger Entries" value={firstNum(wallet, ['entryCount'], entries.length)} subtitle="Credits & debits on the wallet" icon={Check} colorScheme="blue" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Payout request */}
        <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs space-y-4">
          <h3 className="font-bold text-sm text-slate-900">Request Payout</h3>
          <p className="text-[11px] text-slate-400">
            Payouts go to your penny-drop-verified primary bank account. MPIN required (set one under Settings if you
            haven't). Leave the amount empty to withdraw the full balance.
          </p>
          <form onSubmit={handlePayout} className="space-y-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Amount (₹, optional)</label>
              <input
                type="number"
                value={payoutForm.amount}
                onChange={(e) => setPayoutForm({ ...payoutForm, amount: Number(e.target.value) })}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300"
                max={balancePaisa / 100 || undefined}
                placeholder={`Max ${formatCurrency(balancePaisa / 100)}`}
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">MPIN (4 digits)</label>
              <input
                type="password"
                inputMode="numeric"
                maxLength={4}
                value={payoutForm.mpin}
                onChange={(e) => setPayoutForm({ ...payoutForm, mpin: e.target.value.replace(/\D/g, '').slice(0, 4) })}
                className="w-full px-3 py-2.5 text-center text-lg font-black tracking-[0.5em] rounded-xl border border-slate-300"
                placeholder="••••"
                required
              />
            </div>
            <button
              type="submit"
              disabled={payoutForm.mpin.length !== 4 || balancePaisa <= 0}
              className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md disabled:opacity-60"
            >
              Payout to Bank
            </button>
          </form>
        </div>

        {/* Compliance card */}
        <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs space-y-4">
          <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-amber-600" /> Compliance Standing
            <Link to="/transporter/compliance" className="ml-auto text-[11px] text-emerald-700 font-bold hover:underline">Full report →</Link>
          </h3>
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="p-4 bg-slate-50 rounded-2xl">
              <span className="text-slate-400 text-[10px] uppercase font-bold">Strikes on record</span>
              <p className={`font-black text-lg ${strikes > 0 ? 'text-rose-700' : 'text-emerald-700'}`}>{strikes}</p>
            </div>
            <div className="p-4 bg-slate-50 rounded-2xl">
              <span className="text-slate-400 text-[10px] uppercase font-bold">Restrictions</span>
              <p className={`font-bold text-sm ${loadBoardSuspended || bookingRestricted ? 'text-rose-700' : 'text-emerald-700'}`}>
                {loadBoardSuspended ? 'Load board suspended' : bookingRestricted ? 'Bookings restricted' : 'None'}
              </p>
            </div>
          </div>
          {strikes > 0 && (
            <p className="text-[11px] text-amber-800 bg-amber-50 border border-amber-100 rounded-xl p-3">
              Strikes are issued for cancellations inside the pickup window, POD violations, or document expiry. 3
              strikes suspend load-board access.
            </p>
          )}
        </div>
      </div>

      {/* Wallet ledger entries */}
      {entries.length > 0 && (
        <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs space-y-3">
          <h3 className="font-bold text-sm text-slate-900">Wallet Ledger</h3>
          <div className="space-y-2">
            {entries.slice(0, 20).map((en) => {
              const credit = en.kind === 'credit';
              const paisa = firstNum(en, ['amountPaisa'], 0);
              return (
                <div key={str(en.id ?? en.payoutId ?? en.bookingId) || JSON.stringify(en).slice(0, 24)} className="flex items-center justify-between p-3 bg-slate-50 rounded-2xl text-xs">
                  <div>
                    <p className="font-bold text-slate-800">{firstStr(en, ['note', 'label', 'kind'], 'Entry')}</p>
                    <p className="text-slate-400">{fmtDate(en.at ?? en.createdAt)} {str(en.bookingId ?? en.payoutId, '') !== '—' ? `• ${str(en.bookingId ?? en.payoutId)}` : ''}</p>
                  </div>
                  <span className={`font-black ${credit ? 'text-emerald-700' : 'text-rose-700'}`}>
                    {credit ? '+' : '-'}{formatCurrency(paisa / 100)}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Settlements list */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs space-y-4">
        <h3 className="font-bold text-sm text-slate-900">Settlement History</h3>
        {settlements.length === 0 && !loading ? (
          <p className="text-xs text-slate-400 text-center py-6">No settlements yet. Settlements are created after each completed trip.</p>
        ) : (
          <div className="space-y-3">
            {settlements.map((s) => {
              const gross = firstNum(s, ['grossRupees', 'gross', 'grossAmount', 'fare'], 0);
              const fee = firstNum(s, ['commissionRupees', 'commission', 'platformFee', 'fee'], 0);
              const net = firstNum(s, ['netRupees', 'net', 'netAmount', 'payout'], gross - fee);
              const sourceIds = Array.isArray(s.sourceIds) ? (s.sourceIds as unknown[]).length : 0;
              return (
                <div key={str(s.id) || JSON.stringify(s).slice(0, 24)} className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-4 bg-slate-50 rounded-2xl text-xs">
                  <div>
                    <p className="font-bold text-slate-800">
                      {firstStr(s, ['periodStart', 'reference', 'label'], 'Settlement')}
                      {sourceIds > 0 ? ` • ${sourceIds} trip(s)` : ''}
                    </p>
                    <p className="text-slate-400">
                      Gross {formatCurrency(gross)} • Fee -{formatCurrency(fee)} • TDS included
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-black text-emerald-700">{formatCurrency(net)}</span>
                    <StatusBadge status={str(s.status, 'pending')} />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
