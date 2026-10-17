import React, { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { Sparkles, ShieldCheck, Users, DollarSign, Layers, LayoutGrid } from 'lucide-react';
import { StatCard } from '../../components/common/StatCard';
import { formatCurrency } from '../../lib/utils';
import { admin } from '../../lib/api';
import { CONSOLE_NAV, ConsolePanel, KNOWN_PANEL_IDS } from './panels';
import { asRow, asRows, firstVal, useAsync } from './panels/shared';

const normalizePanel = (raw: string | null | undefined): string | null =>
  raw && KNOWN_PANEL_IDS.includes(raw.toLowerCase()) ? raw.toLowerCase() : null;

const metricOf = (d: unknown, ...keys: string[]): string => {
  const r = asRow(d);
  if (!r) return '—';
  const v = firstVal(r, keys);
  if (v === undefined) return '—';
  if (typeof v === 'number') return v.toLocaleString('en-IN');
  return String(v);
};

const currencyOf = (d: unknown, ...keys: string[]): string => {
  const r = asRow(d);
  if (!r) return '—';
  const v = firstVal(r, keys);
  if (typeof v === 'number') return formatCurrency(v);
  return v === undefined ? '—' : String(v);
};

export const SuperadminMasterConsole: React.FC = () => {
  const params = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const [activePanel, setActivePanel] = useState<string>(
    () =>
      normalizePanel(params.panelId) ??
      normalizePanel(params.sopId) ??
      normalizePanel(searchParams.get('p')) ??
      normalizePanel(searchParams.get('sop')) ??
      'home'
  );

  // Keep tab state in sync with external URL changes (back/forward, deep links).
  const urlPanel =
    normalizePanel(params.panelId) ??
    normalizePanel(params.sopId) ??
    normalizePanel(searchParams.get('p')) ??
    normalizePanel(searchParams.get('sop'));
  useEffect(() => {
    if (urlPanel && urlPanel !== activePanel) setActivePanel(urlPanel);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urlPanel]);

  const selectPanel = (id: string) => {
    setActivePanel(id);
    setSearchParams({ p: id }, { replace: true });
  };

  // ----- KPI wall + sidebar queue badges (allSettled so one dead queue can't blank the wall)
  const kpis = useAsync(async () => {
    const [summary, overview, kyc, rates, approvals, disputes] = await Promise.all([
      admin.platform.analyticsSummary().then((d) => d, () => null),
      admin.platform.overview().then((d) => d, () => null),
      admin.kyc.queue().then((d) => d, () => null),
      admin.rates.pending().then((d) => d, () => null),
      admin.moderation.approvals().then((d) => d, () => null),
      admin.disputes.list().then((d) => d, () => null),
    ]);
    return { summary, overview, kyc, rates, approvals, disputes };
  }, []);

  const badges: Record<string, number> = {};
  if (kpis.data) {
    badges['SOP-03'] = asRows(kpis.data.kyc).length;
    badges['SOP-04'] = asRows(kpis.data.rates).length;
    badges['SOP-26'] = asRows(kpis.data.approvals).length;
    badges['SOP-10'] = asRows(kpis.data.disputes).length;
  }

  const activeMeta = CONSOLE_NAV.find((n) => n.id === activePanel);

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 flex items-center gap-2">
            <Sparkles className="w-7 h-7 text-amber-500" />
            Superadmin Master Operations Console (SOP 01–27)
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Platform-wide governance, KYC verification queues, escrow releases, and automated financial settlements
          </p>
        </div>

        <span className="text-xs font-mono font-bold text-emerald-800 bg-emerald-50 px-3 py-1.5 rounded-2xl border border-emerald-200 flex items-center gap-1.5 self-start sm:self-auto">
          <ShieldCheck className="w-4 h-4 text-emerald-600" /> Superadmin Session Live
        </span>
      </div>

      {/* Platform Level Metrics (live from /admin/analytics/summary + /admin/overview) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatCard
          title="Total Registered Users"
          value={metricOf(kpis.data?.summary, 'totalUsers', 'total_users', 'users', 'userCount')}
          subtitle="Across 15 persona profiles"
          icon={Users}
          colorScheme="blue"
        />
        <StatCard
          title="Escrow Balance Locked"
          value={currencyOf(kpis.data?.overview, 'escrowBalance', 'escrowLocked', 'escrow')}
          subtitle="Protected B2B orders"
          icon={DollarSign}
          colorScheme="green"
        />
        <StatCard
          title="Pending KYC Review"
          value={`${badges['SOP-03'] ?? 0} In Queue`}
          subtitle="SOP-03 verification"
          icon={ShieldCheck}
          colorScheme="amber"
        />
        <StatCard
          title="Active B2B Purchases"
          value={metricOf(kpis.data?.overview, 'activePurchases', 'activeDeals', 'b2bActive', 'activeOrders')}
          subtitle="In Transit / Pickup"
          icon={Layers}
          colorScheme="purple"
        />
      </div>

      {/* 2-Column: Console Navigation Drawer + Workspace Detail Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Left: console home + 27 SOP selector list + cross-cutting desks */}
        <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs p-3 space-y-1 lg:sticky lg:top-4 lg:h-fit lg:max-h-[calc(100vh-2rem)] lg:overflow-y-auto">
          {CONSOLE_NAV.map((item, i) => {
            const prev = CONSOLE_NAV[i - 1];
            const showGroupLabel = !prev || prev.group !== item.group;
            return (
              <React.Fragment key={item.id}>
                {showGroupLabel && (
                  <div className="px-3 pt-2 pb-1 text-[10px] font-bold uppercase tracking-wider text-slate-400 first:pt-1">
                    {item.group === 'console'
                      ? 'Console'
                      : item.group === 'sop'
                        ? 'Operational SOP Consoles (27 Sub-Modules)'
                        : 'Cross-Cutting Desks'}
                  </div>
                )}
                <button
                  onClick={() => selectPanel(item.id)}
                  className={`w-full text-left px-3 py-2.5 rounded-xl text-xs font-semibold transition-all flex items-center justify-between gap-2 ${
                    activePanel === item.id
                      ? 'bg-emerald-600 text-white font-bold shadow-xs'
                      : 'text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <span className="flex items-center gap-1.5 min-w-0">
                    {item.id === 'home' && <LayoutGrid className="w-3.5 h-3.5 shrink-0" />}
                    <span className="truncate">{item.label}</span>
                  </span>
                  {badges[item.id] !== undefined && badges[item.id] > 0 && (
                    <span
                      className={`text-[10px] font-extrabold px-1.5 py-0.5 rounded-full shrink-0 ${
                        activePanel === item.id ? 'bg-white/25 text-white' : 'bg-rose-100 text-rose-700'
                      }`}
                    >
                      {badges[item.id]}
                    </span>
                  )}
                </button>
              </React.Fragment>
            );
          })}
        </div>

        {/* Right: Active panel workspace */}
        <div className="lg:col-span-3 space-y-5">
          {activeMeta && activeMeta.id !== 'home' && (
            <p className="text-[11px] font-semibold text-slate-400 -mb-2">
              {activeMeta.label} — every mutation here prompts for an audit reason (sent as X-Audit-Reason) and is
              written to the immutable audit trail.
            </p>
          )}
          <ConsolePanel key={activePanel} panelId={activePanel} />
        </div>
      </div>
    </div>
  );
};
