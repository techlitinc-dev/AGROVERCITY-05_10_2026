import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Building2,
  HeartHandshake,
  IndianRupee,
  Wallet,
  ArrowRight,
  AlertCircle,
  RefreshCw,
  PieChart as PieIcon,
} from 'lucide-react';
import { livestock, apiErrorMessage } from '../../lib/api';
import { StatCard } from '../../components/common/StatCard';
import { formatCurrency } from '../../lib/utils';
import { asRec, nameOf, numOf, recArr, strOf } from './helpers';

const MODULE_LINKS = [
  { to: '/gaushalaManager/profile', label: 'Trust Profile', desc: '80G registration, capacity, bank details', icon: Building2 },
  { to: '/gaushalaManager/cattle', label: 'Cattle Inventory', desc: 'Herd register & lifecycle events', icon: PieIcon },
  { to: '/gaushalaManager/adoptions', label: 'Adoptions & Donations', desc: 'Approval queues & payment verify', icon: HeartHandshake },
  { to: '/gaushalaManager/receipts', label: 'Receipts Register', desc: '80G receipts issued to donors', icon: IndianRupee },
  { to: '/gaushalaManager/expenses', label: 'Expenses', desc: 'Fodder, medical, staff & utilities', icon: Wallet },
];

export const GaushalaDashboard: React.FC = () => {
  const [profile, setProfile] = useState<Record<string, unknown> | null>(null);
  const [noProfile, setNoProfile] = useState(false);
  const [dashboard, setDashboard] = useState<Record<string, unknown> | null>(null);
  const [analytics, setAnalytics] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = async () => {
    setLoading(true);
    setError(null);
    setNoProfile(false);
    try {
      const mine = await livestock.gaushala.mine().catch((e) => {
        const msg = apiErrorMessage(e).toLowerCase();
        if (msg.includes('not found') || msg.includes('not_found') || msg.includes('404')) return null;
        throw e;
      });
      if (!mine) {
        setNoProfile(true);
        setProfile(null);
        setDashboard(null);
        setAnalytics(null);
        return;
      }
      setProfile(asRec(mine));
      const [d, a] = await Promise.all([
        livestock.gaushala.dashboard().catch(() => null),
        livestock.gaushala.analytics().catch(() => null),
      ]);
      setDashboard(d ? asRec(d) : null);
      setAnalytics(a ? asRec(a) : null);
    } catch (e) {
      setError(apiErrorMessage(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    reload();
  }, []);

  if (loading) {
    return <p className="text-xs text-slate-400">Loading gaushala workspace…</p>;
  }

  if (noProfile) {
    return (
      <div className="space-y-6">
        <div className="border-b border-slate-200 pb-4">
          <h1 className="text-2xl font-extrabold text-slate-900 flex items-center gap-2">
            <Building2 className="w-7 h-7 text-emerald-600" />
            Gaushala Manager Desk
          </h1>
        </div>
        <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs p-10 text-center space-y-4 max-w-xl mx-auto">
          <Building2 className="w-12 h-12 text-slate-300 mx-auto" />
          <h2 className="text-lg font-bold text-slate-900">No gaushala profile linked yet</h2>
          <p className="text-xs text-slate-500 leading-relaxed">
            Create your gaushala (cow shelter) trust profile to manage cattle inventory, adoptions,
            80G donations and expense transparency.
          </p>
          <Link
            to="/gaushalaManager/profile"
            className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md"
          >
            Create Profile <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    );
  }

  const monthly = recArr(analytics?.monthly);
  const maxMonthly = Math.max(1, ...monthly.map((m) => Math.max(numOf(m.expenses), numOf(m.donations))));
  const expenseByCategory = asRec(analytics?.expenseByCategory);
  const cattleByStatus = asRec(analytics?.cattleByStatus);
  const byCategory = asRec(dashboard?.byCategory);
  const occupancyPercent = numOf(dashboard?.occupancyPercent);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 flex items-center gap-2">
            <Building2 className="w-7 h-7 text-emerald-600" />
            {strOf(profile?.name, 'Gaushala Trust Desk')}
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            {strOf(profile?.trustName) || 'Gaushala transparency workspace'} — herd care, adoptions, 80G donations & expenses
          </p>
        </div>
        <button
          onClick={reload}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold text-xs self-start sm:self-auto"
        >
          <RefreshCw className="w-3.5 h-3.5" /> Refresh
        </button>
      </div>

      {error && (
        <div className="p-3 rounded-2xl bg-rose-50 border border-rose-200 text-xs font-bold text-rose-700 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" /> {error}
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatCard
          title="Cattle Headcount"
          value={numOf(dashboard?.headcount)}
          subtitle={
            occupancyPercent > 0
              ? `${occupancyPercent}% of ${numOf(dashboard?.capacity)} capacity`
              : `Capacity ${numOf(dashboard?.capacity) || '—'}`
          }
          icon={PieIcon}
          colorScheme="green"
        />
        <StatCard
          title="Active Adoptions"
          value={numOf(dashboard?.activeAdoptions)}
          subtitle="Cows adopted out / sponsored"
          icon={HeartHandshake}
          colorScheme="purple"
        />
        <StatCard
          title="Donations (Month)"
          value={formatCurrency(numOf(dashboard?.donationsMonthTotal))}
          icon={IndianRupee}
          colorScheme="blue"
        />
        <StatCard
          title="Expenses (Month)"
          value={formatCurrency(numOf(dashboard?.expensesMonthTotal))}
          icon={Wallet}
          colorScheme="amber"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs p-5">
          <h3 className="font-bold text-sm text-slate-900 mb-3">Herd by category</h3>
          {Object.keys(byCategory).length === 0 ? (
            <p className="text-xs text-slate-400">No cattle registered yet.</p>
          ) : (
            <div className="space-y-2">
              {Object.entries(byCategory).map(([cat, count]) => (
                <div key={cat} className="flex justify-between text-xs border-b border-slate-50 pb-2">
                  <span className="capitalize font-bold text-slate-700">{cat}</span>
                  <span className="font-black text-slate-900">{numOf(count)}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs p-5">
          <h3 className="font-bold text-sm text-slate-900 mb-3">Cattle by status</h3>
          {Object.keys(cattleByStatus).length === 0 ? (
            <p className="text-xs text-slate-400">No data.</p>
          ) : (
            <div className="space-y-2">
              {Object.entries(cattleByStatus).map(([status, count]) => (
                <div key={status} className="flex justify-between text-xs border-b border-slate-50 pb-2">
                  <span className="font-bold text-slate-700 capitalize">{status.replace(/-/g, ' ')}</span>
                  <span className="font-black text-slate-900">{numOf(count)}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs p-5">
          <h3 className="font-bold text-sm text-slate-900 mb-3">Expense split (month)</h3>
          {Object.keys(expenseByCategory).length === 0 ? (
            <p className="text-xs text-slate-400">No expenses this month.</p>
          ) : (
            <div className="space-y-2">
              {Object.entries(expenseByCategory).map(([cat, amount]) => (
                <div key={cat} className="flex justify-between text-xs border-b border-slate-50 pb-2">
                  <span className="capitalize font-bold text-slate-700">{cat}</span>
                  <span className="font-black text-slate-900">{formatCurrency(numOf(amount))}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs p-6">
        <h3 className="font-bold text-sm text-slate-900 mb-4">Last 6 months — donations vs expenses</h3>
        {monthly.length === 0 ? (
          <p className="text-xs text-slate-400">No analytics data yet.</p>
        ) : (
          <div className="space-y-3">
            {monthly.map((m) => (
              <div key={strOf(m.month)} className="space-y-1">
                <div className="flex justify-between text-[11px] font-bold text-slate-500">
                  <span>{strOf(m.month)}</span>
                  <span>
                    {numOf(m.adoptions)} adoptions • {numOf(m.intakes)} intakes
                  </span>
                </div>
                <div className="flex h-3 rounded-full overflow-hidden bg-slate-100 gap-0.5">
                  <div
                    className="bg-emerald-500 rounded-l-full"
                    style={{ width: `${(numOf(m.donations) / maxMonthly) * 100}%` }}
                    title={`Donations ${formatCurrency(numOf(m.donations))}`}
                  />
                  <div
                    className="bg-amber-400 rounded-r-full"
                    style={{ width: `${(numOf(m.expenses) / maxMonthly) * 100}%` }}
                    title={`Expenses ${formatCurrency(numOf(m.expenses))}`}
                  />
                </div>
              </div>
            ))}
            <div className="flex gap-4 text-[10px] text-slate-500 pt-1">
              <span className="inline-flex items-center gap-1">
                <span className="w-3 h-3 rounded-sm bg-emerald-500" /> Donations
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="w-3 h-3 rounded-sm bg-amber-400" /> Expenses
              </span>
            </div>
          </div>
        )}
      </div>

      <div>
        <h3 className="font-bold text-sm text-slate-900 mb-3">Gaushala Modules</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {MODULE_LINKS.map((l) => (
            <Link
              key={l.to}
              to={l.to}
              className="bg-white rounded-3xl border border-slate-200/80 shadow-xs p-5 hover:shadow-md hover:border-emerald-200 transition-all group"
            >
              <div className="flex items-center justify-between">
                <div className="p-2.5 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-100">
                  <l.icon className="w-5 h-5" />
                </div>
                <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-emerald-600 group-hover:translate-x-0.5 transition-all" />
              </div>
              <h4 className="mt-3 font-bold text-sm text-slate-900">{l.label}</h4>
              <p className="text-xs text-slate-500 mt-0.5">{l.desc}</p>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
};

export default GaushalaDashboard;
