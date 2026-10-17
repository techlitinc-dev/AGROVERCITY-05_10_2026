import React, { useEffect, useState } from 'react';
import { CreditCard, Crown, FileText, AlertCircle, CheckCircle2, Zap } from 'lucide-react';
import { apiErrorMessage, billing } from '../../lib/api';
import { StatusBadge } from '../../components/common/StatusBadge';
import { cn, formatCurrency, formatDateTime } from '../../lib/utils';
import { asRecord, asRecords, pickNum, pickStr } from './records';

export const BillingPage: React.FC = () => {
  const [plans, setPlans] = useState<Record<string, unknown>[]>([]);
  const [subscription, setSubscription] = useState<Record<string, unknown>>({});
  const [invoices, setInvoices] = useState<Record<string, unknown>[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      const [p, s, i] = await Promise.all([
        billing.plans().catch(() => []),
        billing.subscription().catch(() => ({})),
        billing.invoices().catch(() => []),
      ]);
      if (!alive) return;
      setPlans(asRecords(p));
      setSubscription(asRecord(s));
      setInvoices(asRecords(i));
    };
    void load();
    return () => {
      alive = false;
    };
  }, []);

  const flash = (kind: 'ok' | 'err', text: string) => {
    setNotice({ kind, text });
    window.setTimeout(() => setNotice(null), 5000);
  };

  const subscribe = async (planId: string, planName: string) => {
    if (busyId) return;
    setBusyId(planId);
    try {
      await billing.subscribe({ planId });
      flash('ok', `Subscribed to ${planName}. Payment confirmation appears in the invoices list.`);
      const s = await billing.subscription().catch(() => ({}));
      const i = await billing.invoices().catch(() => []);
      setSubscription(asRecord(s));
      setInvoices(asRecords(i));
    } catch (err) {
      flash('err', apiErrorMessage(err));
    } finally {
      setBusyId(null);
    }
  };

  const currentPlanId = pickStr(subscription, 'planId', 'plan');

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="border-b border-slate-200 pb-4">
        <h1 className="text-2xl font-extrabold text-slate-900 flex items-center gap-2">
          <CreditCard className="w-7 h-7 text-emerald-600" />
          Billing & Subscription Plans
        </h1>
        <p className="text-xs text-slate-500 mt-1">
          Agrovercity Pro unlocks AI intelligence packs, priority logistics, and zero-commission limits
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

      {/* Current subscription */}
      {Object.keys(subscription).length > 0 && (
        <div className="bg-gradient-to-r from-slate-900 to-emerald-950 rounded-3xl p-6 text-white shadow-md flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-300">
              Current Subscription
            </span>
            <h3 className="font-extrabold text-lg mt-0.5">
              {pickStr(subscription, 'planName', 'planId') || 'Free plan'}
            </h3>
            <p className="text-xs text-emerald-200 mt-1 capitalize">
              {pickStr(subscription, 'status') || 'active'} · Renews{' '}
              {formatDateTime(pickStr(subscription, 'renewsAt', 'currentPeriodEnd', 'validUntil')) || '—'}
            </p>
          </div>
          <StatusBadge
            status={pickStr(subscription, 'status') || 'active'}
            className="bg-white/10 text-white border-white/20"
          />
        </div>
      )}

      {/* Plans */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {plans.length === 0 && (
          <p className="text-xs text-slate-400 bg-white rounded-3xl border border-slate-200/80 p-6 text-center sm:col-span-3">
            Plans load from the billing service — check your connection.
          </p>
        )}
        {plans.map((p, i) => {
          const id = pickStr(p, 'id', 'planId') || String(i);
          const price = pickNum(p, 'priceRupees', 'price', 'monthlyPrice');
          const current = currentPlanId === id;
          return (
            <div
              key={id}
              className={cn(
                'bg-white rounded-3xl p-6 border shadow-xs flex flex-col justify-between gap-4',
                current ? 'border-emerald-500 ring-2 ring-emerald-500/20' : 'border-slate-200/80'
              )}
            >
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="font-extrabold text-sm text-slate-900 flex items-center gap-1.5">
                    <Crown className="w-4 h-4 text-amber-500" />
                    {pickStr(p, 'name', 'title') || 'Plan'}
                  </h4>
                  {current && (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                      CURRENT
                    </span>
                  )}
                </div>
                <p className="text-2xl font-black text-slate-900">
                  {price > 0 ? formatCurrency(price) : 'Free'}
                  <span className="text-xs font-bold text-slate-400"> /month</span>
                </p>
                <ul className="text-[11px] text-slate-600 space-y-1">
                  {(Array.isArray(p['features']) ? (p['features'] as unknown[]) : [])
                    .slice(0, 5)
                    .map((f, j) => (
                      <li key={j} className="flex items-start gap-1.5">
                        <Zap className="w-3 h-3 text-amber-500 mt-0.5 flex-shrink-0" />
                        {String(f)}
                      </li>
                    ))}
                </ul>
              </div>
              <button
                onClick={() => void subscribe(id, pickStr(p, 'name', 'title') || 'plan')}
                disabled={busyId === id || current}
                className={cn(
                  'w-full px-4 py-2.5 font-bold text-xs rounded-xl shadow-xs transition-colors disabled:opacity-50',
                  current
                    ? 'bg-emerald-50 border border-emerald-200 text-emerald-700'
                    : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                )}
              >
                {current ? 'Active plan' : busyId === id ? 'Subscribing…' : price > 0 ? 'Subscribe' : 'Switch to Free'}
              </button>
            </div>
          );
        })}
      </div>

      {/* Invoices */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs p-5 space-y-3">
        <h3 className="font-bold text-sm text-slate-900 flex items-center gap-1.5">
          <FileText className="w-4 h-4 text-slate-400" /> Invoices
        </h3>
        {invoices.length === 0 ? (
          <p className="text-xs text-slate-400">No invoices yet — subscriptions and commissions appear here.</p>
        ) : (
          <div className="divide-y divide-slate-100">
            {invoices.slice(0, 15).map((inv, i) => (
              <div key={pickStr(inv, 'id', 'invoiceNumber') || i} className="py-3 flex items-center justify-between gap-3 text-xs">
                <div>
                  <p className="font-bold text-slate-800">
                    {pickStr(inv, 'invoiceNumber', 'number') || `Invoice ${i + 1}`}
                  </p>
                  <p className="text-[11px] text-slate-400">
                    {pickStr(inv, 'description') || pickStr(inv, 'planName') || 'Billing'} ·{' '}
                    {formatDateTime(pickStr(inv, 'issuedAt', 'createdAt', 'date')) || '—'}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-black text-slate-900">
                    {formatCurrency(pickNum(inv, 'amountRupees', 'amount', 'total'))}
                  </span>
                  <StatusBadge status={pickStr(inv, 'status') || 'paid'} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
