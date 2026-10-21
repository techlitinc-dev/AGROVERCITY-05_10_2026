import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Landmark, RefreshCcw, Wallet, ShieldCheck, CalendarRange, Landmark as BankIcon } from 'lucide-react';
import { seller, bankAccounts, apiErrorMessage } from '../../lib/api';
import { StatusBadge } from '../../components/common/StatusBadge';
import { formatCurrency, formatDate } from '../../lib/utils';
import {
  cardCls,
  EmptyState,
  ErrorBanner,
  ghostBtnCls,
  LoadingBlock,
  num,
  paisaToRupees,
  rec,
  str,
  arr,
  type Rec,
} from './shared';

/**
 * Vyapari weekly settlements (V11): one line per settlement period with
 * gross, platform commission, TDS 194-O, and the net payout status — plus
 * the verified primary bank account payouts land in.
 */
export const SellerSettlementsView: React.FC = () => {
  const [lines, setLines] = useState<Rec[]>([]);
  const [tdsByPeriod, setTdsByPeriod] = useState<Map<string, number>>(new Map());
  const [bank, setBank] = useState<Rec | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [settlementRows, tdsRows, accountRows] = await Promise.all([
        seller.settlements().catch(() => [] as unknown[]),
        seller.tdsStatements().catch(() => [] as unknown[]),
        bankAccounts.list().catch(() => [] as unknown[]),
      ]);
      setLines((settlementRows as unknown[]).map(rec));
      const tdsMap = new Map<string, number>();
      for (const row of tdsRows as unknown[]) {
        const doc = rec(row);
        tdsMap.set(str(doc.period), num(doc.tdsPaisa));
      }
      setTdsByPeriod(tdsMap);
      const accounts = (accountRows as unknown[]).map(rec);
      const verified = accounts.find((a) => str(a.verifyStatus) === 'verified' && Boolean(a.isPrimary))
        || accounts.find((a) => str(a.verifyStatus) === 'verified')
        || null;
      setBank(verified);
    } catch (e) {
      setError(apiErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const tdsFor = (line: Rec): number => {
    const key = `${str(line.periodStart)}..${str(line.periodEnd)}`;
    const paisa = tdsByPeriod.get(key);
    return paisa !== undefined ? paisaToRupees(paisa) : num(line.grossRupees) * 0.01;
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 flex items-center gap-2">
            <Wallet className="w-7 h-7 text-emerald-600" />
            Weekly Settlements
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Marketplace trade gross minus platform commission and TDS 194-O — paid out every Monday
          </p>
        </div>
        <button onClick={() => void load()} className={ghostBtnCls}>
          <RefreshCcw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
        </button>
      </div>

      <ErrorBanner message={error} />
      {loading && <LoadingBlock />}

      {!loading && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Settlement period lines */}
          <div className="lg:col-span-2 space-y-3">
            <h3 className="font-bold text-sm text-slate-900">Settlement Periods ({lines.length})</h3>
            {lines.length === 0 ? (
              <div className={cardCls}>
                <EmptyState label="No settlements yet — they accrue when trades complete and the weekly job runs" />
              </div>
            ) : (
              lines.map((line) => {
                const gross = num(line.grossRupees);
                const commission = num(line.commissionRupees);
                const tds = tdsFor(line);
                const net = num(line.netRupees);
                return (
                  <div key={str(line.id)} className={`${cardCls} p-5 space-y-3`}>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <CalendarRange className="w-4 h-4 text-emerald-600" />
                        <p className="text-xs font-black text-slate-900">
                          {formatDate(str(line.periodStart))} – {formatDate(str(line.periodEnd))}
                        </p>
                        {Boolean(line.held) && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-100 text-rose-700">
                            Held: {str(line.holdReason, 'payout review')}
                          </span>
                        )}
                      </div>
                      <StatusBadge status={str(line.status, 'pending')} />
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                      <div className="p-3 bg-slate-50 rounded-2xl">
                        <span className="text-slate-400 block text-[10px] uppercase font-bold">Gross</span>
                        <span className="font-black text-slate-900 text-sm">{formatCurrency(gross)}</span>
                      </div>
                      <div className="p-3 bg-slate-50 rounded-2xl">
                        <span className="text-slate-400 block text-[10px] uppercase font-bold">Commission</span>
                        <span className="font-bold text-rose-700 text-sm">− {formatCurrency(commission)}</span>
                      </div>
                      <div className="p-3 bg-slate-50 rounded-2xl">
                        <span className="text-slate-400 block text-[10px] uppercase font-bold">TDS 194-O</span>
                        <span className="font-bold text-amber-700 text-sm">− {formatCurrency(tds)}</span>
                      </div>
                      <div className="p-3 bg-emerald-50 rounded-2xl border border-emerald-100">
                        <span className="text-emerald-600 block text-[10px] uppercase font-bold">Net Payout</span>
                        <span className="font-black text-emerald-800 text-sm">{formatCurrency(net)}</span>
                      </div>
                    </div>

                    <p className="text-[11px] text-slate-400">
                      {arr(line.sourceIds).length} source trade(s) · accrued {str(line.createdAt).slice(0, 10) || '—'}
                      {str(line.payoutRef) ? ` · payout ref ${str(line.payoutRef)}` : ''}
                    </p>
                  </div>
                );
              })
            )}
          </div>

          {/* Payout bank account */}
          <div className="space-y-3">
            <h3 className="font-bold text-sm text-slate-900">Payout Account</h3>
            <div className={`${cardCls} p-5 space-y-3`}>
              {bank ? (
                <>
                  <div className="flex items-center justify-between">
                    <span className="p-2 rounded-xl bg-emerald-50 text-emerald-700">
                      <BankIcon className="w-4 h-4" />
                    </span>
                    <StatusBadge status="verified" />
                  </div>
                  <div>
                    <p className="text-sm font-black text-slate-900">{str(bank.bankName, 'Bank account')}</p>
                    <p className="text-[11px] text-slate-500 font-mono">
                      A/C {str(bank.accountNumberMasked, '—')} · IFSC {str(bank.ifsc, '—')}
                    </p>
                  </div>
                  <p className="text-[11px] text-slate-500">
                    Penny-drop verified{Boolean(bank.isPrimary) ? ' · primary account' : ''}. Settlements marked
                    "paid" are transferred here via RazorpayX.
                  </p>
                </>
              ) : (
                <div className="space-y-2">
                  <p className="text-xs text-slate-600">
                    No verified bank account yet — settlements will sit on hold until one is penny-drop verified.
                  </p>
                </div>
              )}
              <Link to="/bank-accounts" className={`${ghostBtnCls} w-full flex items-center justify-center gap-1.5`}>
                <Landmark className="w-3.5 h-3.5" /> Manage Bank Accounts
              </Link>
              <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100 text-[11px] text-slate-500 flex items-start gap-2">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 mt-0.5 shrink-0" />
                Payouts without a verified account are flagged "onHold" in the weekly payout run.
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
