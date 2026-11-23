import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  CalendarCheck,
  ClipboardList,
  FileText,
  Milk,
  TrendingUp,
  Users,
} from 'lucide-react';
import { milkVendor } from '../../lib/api';
import { EmptyState, ErrorBanner, SectionCard, btnGhost, rec, recArr, str, num, todayStr, fmtMl, fmtPaisa } from './vendor/shared';

const QUICK_LINKS = [
  { to: '/milkSeller/vendor', label: 'Todays Schedule', icon: CalendarCheck },
  { to: '/milkSeller/vendor/clients', label: 'Clients', icon: Users },
  { to: '/milkSeller/vendor/bills', label: 'Bills & Payments', icon: FileText },
  { to: '/milkSeller/vendor/rates', label: 'Milk and Rates', icon: Milk },
  { to: '/milkSeller', label: 'Punch Sheet', icon: ClipboardList },
  { to: '/milkSeller/analytics', label: 'Delivery Analytics', icon: TrendingUp },
];

interface SectionState {
  loading: boolean;
  error: string | null;
}

/**
 * Milk Vendor (Doodhwala) dashboard — one-screen overview of the day and the
 * money: today's schedule summary, active clients, open bills, outstanding
 * balance and month billing. Read-only; every card links to the desk tab
 * that manages it. Sections fail independently so one bad API never blanks
 * the page.
 */
export const MilkVendorDashboard: React.FC = () => {
  const [profile, setProfile] = useState<Record<string, unknown> | null>(null);
  const [today, setToday] = useState<Record<string, unknown> | null>(null);
  const [clients, setClients] = useState<Record<string, unknown>[]>([]);
  const [bills, setBills] = useState<Record<string, unknown>[]>([]);
  const [state, setState] = useState<SectionState>({ loading: true, error: null });

  const load = useCallback(async () => {
    setState({ loading: true, error: null });
    try {
      const p = await milkVendor.profile();
      setProfile(p);
      const shift = str(p.defaultShift, 'morning') || 'morning';
      const [t, c, b] = await Promise.all([
        milkVendor.today({ date: todayStr(), shift }).catch(() => null),
        milkVendor.clients({ status: 'all' }).catch(() => []),
        milkVendor.bills().catch(() => []),
      ]);
      setToday(t);
      setClients(c);
      setBills(b);
    } catch (e) {
      setState({ loading: false, error: e instanceof Error ? e.message : 'Could not load the dashboard' });
      return;
    }
    setState({ loading: false, error: null });
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const summary = rec(today?.summary);
  const todayRows = recArr(today?.rows);
  const pendingRows = todayRows.filter((r) => !str(r.entryId) && str(r.status) !== 'skipped');

  const activeClients = useMemo(
    () => clients.filter((c) => str(c.status, 'active') === 'active').length,
    [clients],
  );

  const monthPrefix = todayStr().slice(0, 7);
  const openBills = useMemo(
    () => bills.filter((b) => str(b.status) !== 'cancelled' && num(b.balancePaisa) > 0),
    [bills],
  );
  const outstandingPaisa = openBills.reduce((acc, b) => acc + num(b.balancePaisa), 0);
  const monthBilledPaisa = bills
    .filter((b) => str(b.status) !== 'cancelled' && str(b.periodEnd).startsWith(monthPrefix))
    .reduce((acc, b) => acc + num(b.grossTotalPaisa), 0);

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      <header>
        <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
          <Milk className="h-5 w-5 text-emerald-600" />
          {str(profile?.businessName) || 'Milk Vendor'}
        </h1>
        <p className="text-sm text-slate-500">
          Dashboard — your day and your money at a glance · {todayStr()}
        </p>
      </header>

      {profile && !profile.kycVerified && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700">
          Vendor KYC is not verified yet — billing and payments unlock once verification completes.
        </div>
      )}

      <ErrorBanner message={state.error} />
      {state.loading && !today && !clients.length && !bills.length ? (
        <EmptyState message="Loading your dashboard…" />
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <StatCard label="Scheduled today" value={String(num(summary.requiredCount))} />
            <StatCard label="Delivered" value={String(num(summary.deliveredCount))} />
            <StatCard label="Milk delivered" value={fmtMl(num(summary.totalQuantityMilliLitres))} />
            <StatCard label="Collection value" value={fmtPaisa(num(summary.collectionValuePaisa))} accent />
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <StatCard label="Active clients" value={String(activeClients)} />
            <StatCard label="Open bills" value={String(openBills.length)} />
            <StatCard label="Outstanding" value={fmtPaisa(outstandingPaisa)} />
            <StatCard label="Billed this month" value={fmtPaisa(monthBilledPaisa)} />
          </div>

          <SectionCard
            title="Due today"
            action={
              <Link to="/milkSeller/vendor" className="text-xs font-semibold text-emerald-700 hover:underline">
                Open Todays Schedule →
              </Link>
            }
          >
            {!today ? (
              <p className="text-xs text-slate-400">Today's schedule could not be loaded.</p>
            ) : pendingRows.length === 0 ? (
              <p className="text-xs text-slate-500">
                {todayRows.length === 0
                  ? 'No clients scheduled for today’s default shift yet.'
                  : 'All scheduled deliveries for today are marked.'}
              </p>
            ) : (
              <ul className="divide-y divide-slate-100 text-sm">
                {pendingRows.slice(0, 6).map((r) => (
                  <li key={str(r.clientId)} className="py-1.5 flex justify-between gap-2">
                    <span className="text-slate-700 truncate">{str(r.name)}</span>
                    <span className="text-slate-500 shrink-0">
                      {str(r.productName) || 'Milk'} · {fmtMl(num(r.defaultQuantityMilliLitres))}
                    </span>
                  </li>
                ))}
                {pendingRows.length > 6 && (
                  <li className="py-1.5 text-xs text-slate-400">
                    +{pendingRows.length - 6} more in Todays Schedule
                  </li>
                )}
              </ul>
            )}
          </SectionCard>

          <SectionCard title="Go to">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {QUICK_LINKS.map((ql) => (
                <Link
                  key={ql.to}
                  to={ql.to}
                  className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-xs font-semibold text-slate-700 hover:border-emerald-300 hover:text-emerald-700 transition-colors"
                >
                  <ql.icon className="h-4 w-4 text-emerald-600 shrink-0" />
                  <span className="truncate">{ql.label}</span>
                </Link>
              ))}
            </div>
          </SectionCard>
        </>
      )}

      {state.error && (
        <button onClick={load} className={btnGhost}>
          Retry
        </button>
      )}
    </div>
  );
};

const StatCard: React.FC<{ label: string; value: string; accent?: boolean }> = ({ label, value, accent }) => (
  <div
    className={`rounded-2xl border p-3 ${
      accent ? 'bg-emerald-600 border-emerald-600 text-white' : 'bg-white border-slate-200'
    }`}
  >
    <div className={`text-[11px] uppercase tracking-wide ${accent ? 'text-emerald-100' : 'text-slate-500'}`}>
      {label}
    </div>
    <div className="text-lg font-semibold">{value}</div>
  </div>
);
