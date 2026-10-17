import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Milk,
  Plus,
  Award,
  DollarSign,
  Users,
  ArrowRight,
  Gauge,
  ShoppingCart,
  BarChart3,
  FileText,
  CalendarClock,
  AlertCircle,
  CheckCircle2,
  Store,
} from 'lucide-react';
import { dairy, apiErrorMessage } from '../../lib/api';
import { StatCard } from '../../components/common/StatCard';
import { StatusBadge } from '../../components/common/StatusBadge';
import { formatCurrency } from '../../lib/utils';
import { dairyExtras } from './managerApi';
import { asRec, nameOf, numOf, recArr, statsOf, strOf, todayStr } from './helpers';

const PAGE_LINKS = [
  { to: '/dairy/members', label: 'Member Passbook', desc: 'Members, KYC & statements', icon: Users },
  { to: '/dairy/rates', label: 'FAT/SNF Rate Chart', desc: 'Active chart & versions', icon: Award },
  { to: '/dairy/batches', label: 'Payout Batches', desc: '10-day payment cycles', icon: DollarSign },
  { to: '/dairy/market', label: 'Procurement Market', desc: 'Demands, standing orders & bids', icon: Store },
  { to: '/dairy/sales', label: 'Sales, Orders & Stock', desc: 'Customers, orders, stock', icon: ShoppingCart },
  { to: '/dairy/reports', label: 'Reports & Analytics', desc: 'Daily, P&L, forecast', icon: BarChart3 },
  { to: '/milkSeller', label: 'Milk Seller Desk', desc: 'Deliveries, bills, clients', icon: Milk },
];

export const DairyHome: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'collection'>('dashboard');
  const [dashboard, setDashboard] = useState<Record<string, unknown> | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const d = asRec(await dairy.dashboard());
        if (alive) setDashboard(d);
      } catch (e) {
        if (alive) setLoadError(apiErrorMessage(e));
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const stats = statsOf(dashboard);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 flex items-center gap-2">
            <Milk className="w-7 h-7 text-emerald-600" />
            Dudh Dairy Manager Console
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Automated FAT/SNF chart pricing, member passbook payouts, sales & stock, and dairy analytics
          </p>
        </div>

        <div className="flex bg-slate-100 p-1 rounded-2xl self-start sm:self-auto overflow-x-auto no-scrollbar">
          {[
            { id: 'dashboard', label: 'Dashboard' },
            { id: 'collection', label: 'Milk Collection Desk' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as 'dashboard' | 'collection')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                activeTab === tab.id ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {loadError && (
        <div className="p-3 rounded-2xl bg-rose-50 border border-rose-200 text-xs font-bold text-rose-700 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" /> {loadError}
        </div>
      )}

      {activeTab === 'dashboard' && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <StatCard
              title="Today's Collection"
              value={`${numOf(stats.todayLitersCollected).toLocaleString('en-IN')} L`}
              subtitle="Liters collected today"
              icon={Milk}
              colorScheme="blue"
            />
            <StatCard
              title="Active Demands"
              value={numOf(stats.activeDemands)}
              subtitle="Open procurement demands"
              icon={FileText}
              colorScheme="green"
            />
            <StatCard
              title="Live Bids"
              value={numOf(stats.liveBids)}
              subtitle="Pending / countered bids"
              icon={Gauge}
              colorScheme="amber"
            />
            <StatCard
              title="Unread Alerts"
              value={numOf(stats.unreadNotifications)}
              subtitle="Notifications pending"
              icon={CalendarClock}
              colorScheme="purple"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs p-5 space-y-3">
              <h3 className="font-bold text-sm text-slate-900">Today's Live Demands</h3>
              {recArr(dashboard?.todaysLiveDemands).length === 0 ? (
                <p className="text-xs text-slate-400">No demands created today yet.</p>
              ) : (
                <ul className="space-y-2">
                  {recArr(dashboard?.todaysLiveDemands).slice(0, 5).map((d) => (
                    <li key={strOf(d.id)} className="flex items-center justify-between text-xs border-b border-slate-50 pb-2">
                      <span className="font-bold text-slate-800">{strOf(d.product) || nameOf(d)}</span>
                      <span className="text-slate-500">
                        {numOf(d.quantityLiters)} L @ {formatCurrency(numOf(d.ratePerLiter))}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs p-5 space-y-3">
              <h3 className="font-bold text-sm text-slate-900">Open Standing Orders</h3>
              {recArr(asRec(dashboard?.standingOrders).data).length === 0 ? (
                <p className="text-xs text-slate-400">No active standing orders.</p>
              ) : (
                <ul className="space-y-2">
                  {recArr(asRec(dashboard?.standingOrders).data).slice(0, 5).map((s) => (
                    <li key={strOf(s.id)} className="flex items-center justify-between text-xs border-b border-slate-50 pb-2">
                      <span className="font-bold text-slate-800">{nameOf(s)}</span>
                      <StatusBadge status={strOf(s.status, 'open')} />
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          <div>
            <h3 className="font-bold text-sm text-slate-900 mb-3">Dairy Modules</h3>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {PAGE_LINKS.map((l) => (
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
        </>
      )}

      {activeTab === 'collection' && <CollectionDesk />}
    </div>
  );
};

/* ------------------------------------------------------------------ */
/* Collection Desk tab — rate-calc preview + create/list + day summary */
/* ------------------------------------------------------------------ */

const CollectionDesk: React.FC = () => {
  const today = todayStr();
  const [members, setMembers] = useState<Record<string, unknown>[]>([]);
  const [collections, setCollections] = useState<Record<string, unknown>[]>([]);
  const [summary, setSummary] = useState<Record<string, unknown> | null>(null);
  const [charts, setCharts] = useState<Record<string, Record<string, unknown> | null>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // form state
  const [memberId, setMemberId] = useState('');
  const [farmerName, setFarmerName] = useState('');
  const [farmerCode, setFarmerCode] = useState('');
  const [shift, setShift] = useState<'morning' | 'evening'>('morning');
  const [milkType, setMilkType] = useState<'cow' | 'buffalo'>('cow');
  const [liters, setLiters] = useState(10);
  const [fat, setFat] = useState(4.2);
  const [snf, setSnf] = useState(8.7);
  const [clr, setClr] = useState(28);
  const [preview, setPreview] = useState<Record<string, unknown> | null>(null);

  const reload = async () => {
    setLoading(true);
    setError(null);
    try {
      const [m, c, s] = await Promise.all([
        dairy.manager.members(),
        dairyExtras.collections({ date: today }),
        dairyExtras.procurementSummary(today),
      ]);
      setMembers(recArr(m));
      setCollections(recArr(c));
      setSummary(asRec(s));
    } catch (e) {
      setError(apiErrorMessage(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    reload();
    // live active FAT/SNF charts (cow + buffalo) — /livestock/dairy/rate-chart
    (async () => {
      const [cow, buffalo] = await Promise.all([
        dairyExtras.activeRateChart('cow').catch(() => null),
        dairyExtras.activeRateChart('buffalo').catch(() => null),
      ]);
      setCharts({ cow: cow ? asRec(cow) : null, buffalo: buffalo ? asRec(buffalo) : null });
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // live rate preview against the active chart
  useEffect(() => {
    const t = window.setTimeout(async () => {
      try {
        const p = asRec(
          await dairyExtras.calcRate({ milkType, fatPercent: fat, snfPercent: snf, liters }),
        );
        setPreview(p);
      } catch {
        setPreview(null);
      }
    }, 350);
    return () => window.clearTimeout(t);
  }, [milkType, fat, snf, liters]);

  const pickMember = (id: string) => {
    setMemberId(id);
    const m = members.find((x) => strOf(x.id) === id);
    if (m) {
      if (strOf(m.name)) setFarmerName(strOf(m.name));
      if (strOf(m.memberCode)) setFarmerCode(strOf(m.memberCode));
      const species = strOf(m.defaultSpecies);
      if (species === 'cow' || species === 'buffalo') setMilkType(species);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      const saved = asRec(
        await dairyExtras.createCollection({
          farmerName,
          farmerCode,
          memberId: memberId || undefined,
          date: today,
          shift,
          milkType,
          liters,
          fatPercent: fat,
          snfPercent: snf,
          clr,
        }),
      );
      setNotice(
        `Collection slip ${strOf(saved.slipNo) || strOf(saved.id)} saved — ${formatCurrency(numOf(saved.totalAmount))} @ ₹${numOf(saved.ratePerLiter)}/L`,
      );
      await reload();
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const totalToday = useMemo(
    () => collections.reduce((acc, c) => acc + numOf(c.totalAmount), 0),
    [collections],
  );

  return (
    <div className="space-y-4">
      {/* Live active FAT/SNF rate charts */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {(['buffalo', 'cow'] as const).map((species) => {
          const chart = charts[species];
          return (
            <div
              key={species}
              className="bg-white rounded-3xl border border-slate-200/80 shadow-xs p-4 flex items-center justify-between gap-3"
            >
              <div>
                <p className="text-[10px] uppercase font-bold text-slate-400 capitalize">{species} chart</p>
                {chart ? (
                  <>
                    <p className="text-lg font-black text-emerald-800">
                      ₹{numOf(chart.baseRate).toFixed(2)} <span className="text-xs font-bold text-slate-500">/L base</span>
                    </p>
                    <p className="text-[10px] text-slate-400">
                      FAT base {numOf(chart.fatBase).toFixed(1)}% • SNF base {numOf(chart.snfBase).toFixed(1)}%
                      {numOf(chart.fatStep) > 0 && ` • step ₹${numOf(chart.fatStep).toFixed(2)}`}
                    </p>
                  </>
                ) : (
                  <p className="text-xs text-slate-400">No active {species} chart — publish one from Rate Charts.</p>
                )}
              </div>
              <Link
                to="/dairy/rates"
                className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold text-[11px] shrink-0"
              >
                Manage
              </Link>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatCard
          title="Morning Shift"
          value={`${numOf(summary?.totalMorningLiters).toLocaleString('en-IN')} L`}
          subtitle={`${collections.filter((c) => strOf(c.shift) === 'morning').length} entries`}
          icon={Milk}
          colorScheme="blue"
        />
        <StatCard
          title="Evening Shift"
          value={`${numOf(summary?.totalEveningLiters).toLocaleString('en-IN')} L`}
          subtitle={`${collections.filter((c) => strOf(c.shift) === 'evening').length} entries`}
          icon={Milk}
          colorScheme="purple"
        />
        <StatCard
          title="Avg FAT / SNF"
          value={`${numOf(summary?.avgFat).toFixed(2)}% / ${numOf(summary?.avgSnf).toFixed(2)}%`}
          subtitle={`${numOf(summary?.collectionsCount)} collections`}
          icon={Award}
          colorScheme="green"
        />
        <StatCard
          title="Expected Payout"
          value={formatCurrency(numOf(summary?.totalPayoutAmount, totalToday))}
          subtitle={`for ${today}`}
          icon={DollarSign}
          colorScheme="amber"
        />
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

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Record collection form */}
        <form onSubmit={handleSave} className="bg-white rounded-3xl border border-slate-200/80 shadow-xs p-5 space-y-3">
          <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
            <Plus className="w-4 h-4 text-emerald-600" /> Record Milk Entry
          </h3>

          {members.length > 0 && (
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Linked Member (optional)</label>
              <select
                value={memberId}
                onChange={(e) => pickMember(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 bg-white"
              >
                <option value="">— manual entry —</option>
                {members.map((m) => (
                  <option key={strOf(m.id)} value={strOf(m.id)}>
                    {nameOf(m)} {strOf(m.memberCode) ? `(${strOf(m.memberCode)})` : ''}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Farmer Name</label>
              <input
                type="text"
                value={farmerName}
                onChange={(e) => setFarmerName(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Farmer Code</label>
              <input
                type="text"
                value={farmerCode}
                onChange={(e) => setFarmerCode(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Shift</label>
              <select
                value={shift}
                onChange={(e) => setShift(e.target.value as 'morning' | 'evening')}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 bg-white"
              >
                <option value="morning">Morning (सकाळ)</option>
                <option value="evening">Evening (संध्याकाळ)</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Milk Type</label>
              <select
                value={milkType}
                onChange={(e) => setMilkType(e.target.value as 'cow' | 'buffalo')}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 bg-white"
              >
                <option value="cow">Cow (गाय)</option>
                <option value="buffalo">Buffalo (म्हैस)</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-4 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Liters</label>
              <input
                type="number"
                step="0.5"
                min="0.5"
                value={liters}
                onChange={(e) => setLiters(Number(e.target.value))}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">FAT %</label>
              <input
                type="number"
                step="0.1"
                min="2"
                max="14"
                value={fat}
                onChange={(e) => setFat(Number(e.target.value))}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 text-emerald-800 font-bold"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">SNF %</label>
              <input
                type="number"
                step="0.1"
                min="6"
                max="14"
                value={snf}
                onChange={(e) => setSnf(Number(e.target.value))}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 text-emerald-800 font-bold"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">CLR</label>
              <input
                type="number"
                step="0.5"
                min="15"
                max="40"
                value={clr}
                onChange={(e) => setClr(Number(e.target.value))}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300"
              />
            </div>
          </div>

          <div className="p-3 bg-emerald-50 rounded-2xl border border-emerald-200 space-y-1">
            <div className="flex justify-between items-center text-xs">
              <span className="text-slate-500">Chart rate:</span>
              <span className="font-extrabold text-emerald-800">₹{numOf(preview?.ratePerLiter).toFixed(2)} / L</span>
            </div>
            <div className="flex justify-between items-center text-xs">
              <span className="text-slate-500">Total payout:</span>
              <span className="font-black text-emerald-900 text-sm">{formatCurrency(numOf(preview?.totalAmount))}</span>
            </div>
            {strOf(preview?.formula) && (
              <p className="text-[10px] text-emerald-700/80 pt-1 border-t border-emerald-100">{strOf(preview?.formula)}</p>
            )}
          </div>

          <button
            type="submit"
            disabled={saving}
            className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white font-bold text-xs shadow-md"
          >
            {saving ? 'Saving…' : 'Save Collection Slip'}
          </button>
        </form>

        {/* Today's slips */}
        <div className="lg:col-span-2 bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
            <h3 className="font-bold text-sm text-slate-900">Today's Collection Slips ({today})</h3>
            <button
              onClick={reload}
              className="text-xs font-bold text-emerald-700 hover:text-emerald-800"
            >
              Refresh
            </button>
          </div>
          {loading ? (
            <p className="p-6 text-xs text-slate-400">Loading…</p>
          ) : collections.length === 0 ? (
            <p className="p-6 text-xs text-slate-400">No collections recorded today yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 text-slate-500 font-bold uppercase text-[10px] tracking-wider border-b border-slate-100">
                    <th className="py-3 px-4">Slip / Farmer</th>
                    <th className="py-3 px-3">Shift • Type</th>
                    <th className="py-3 px-3">Liters</th>
                    <th className="py-3 px-3">FAT / SNF</th>
                    <th className="py-3 px-3">Rate</th>
                    <th className="py-3 px-4 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {collections.map((c) => (
                    <tr key={strOf(c.id)} className="hover:bg-slate-50/60">
                      <td className="py-3 px-4 font-bold text-slate-900">
                        {strOf(c.slipNo) || strOf(c.id)}
                        <span className="text-[10px] text-slate-400 block font-semibold">{nameOf(c)}</span>
                      </td>
                      <td className="py-3 px-3 font-semibold text-slate-600 capitalize">
                        {strOf(c.shift)} • {strOf(c.milkType)}
                      </td>
                      <td className="py-3 px-3 font-bold text-slate-800">{numOf(c.liters)} L</td>
                      <td className="py-3 px-3 font-mono text-emerald-800 font-bold">
                        {numOf(c.fatPercent).toFixed(1)}% / {numOf(c.snfPercent).toFixed(1)}%
                      </td>
                      <td className="py-3 px-3 font-bold text-slate-900">₹{numOf(c.ratePerLiter).toFixed(2)}/L</td>
                      <td className="py-3 px-4 text-right font-black text-emerald-800">
                        {formatCurrency(numOf(c.totalAmount))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default DairyHome;
