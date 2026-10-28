import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  TrendingUp,
  Package,
  Truck,
  BookOpen,
  CloudSun,
  ArrowRight,
  Coins,
  MapPin,
  Bot,
  CalendarCheck,
  CheckCircle2,
  X,
  Bell,
  Stethoscope,
} from 'lucide-react';
import { dashboard, mandi, intelligence, notifications, gamification, apiErrorMessage } from '../../lib/api';
import { useAuthStore } from '../../stores/authStore';
import { formatCurrency } from '../../lib/utils';
import type { AppNotification, MandiPrice } from '../../types';

const asRecord = (v: unknown): Record<string, unknown> =>
  v !== null && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
const asArray = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const asStr = (v: unknown, fallback = ''): string => (typeof v === 'string' ? v : fallback);
const asNum = (v: unknown, fallback = 0): number => (typeof v === 'number' && !Number.isNaN(v) ? v : fallback);

interface TaskItem {
  id: string;
  text: string;
  done: boolean;
  time: string;
}

const taskTitle = (r: Record<string, unknown>): string => {
  const t = r.title;
  if (typeof t === 'string' && t) return t;
  if (t !== null && typeof t === 'object' && !Array.isArray(t)) {
    const localized = t as Record<string, unknown>;
    return asStr(localized.en) || asStr(localized.hi);
  }
  return asStr(r.text, 'Farm task');
};

export const FarmerHome: React.FC = () => {
  const { user } = useAuthStore();
  const [weather, setWeather] = useState<Record<string, unknown> | null>(null);
  const [rates, setRates] = useState<MandiPrice[]>([]);
  const [intel, setIntel] = useState<Record<string, unknown> | null>(null);
  const [notifs, setNotifs] = useState<AppNotification[]>([]);
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [urgentTask, setUrgentTask] = useState<Record<string, unknown> | null>(null);
  const [coinBalance, setCoinBalance] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);

    const load = async () => {
      // Coin balance (Kisan Coins card) — best-effort alongside the home load.
      gamification
        .status()
        .then((s) => {
          if (!active) return;
          const coins = asNum(asRecord(s).agriCoins, 0);
          setCoinBalance(coins);
        })
        .catch(() => undefined);

      // Primary: persona-aware home dashboard; fall back to fan-out endpoints.
      try {
        const home = asRecord(await dashboard.home());
        if (!active) return;
        setWeather(asRecord(home.weather) || null);
        const homeRates = asArray(home.vyapariRates ?? home.rates ?? home.mandiRates);
        if (homeRates.length > 0) {
          setRates(homeRates as MandiPrice[]);
        }
        setIntel(asRecord(home.intelligence) || null);
        setNotifs(asArray(home.notifications ?? []) as AppNotification[]);
        setUrgentTask(home.urgentTask ? asRecord(home.urgentTask) : null);
        setTasks(
          asArray(home.tasks ?? []).map((t, i) => {
            const r = asRecord(t);
            return {
              id: asStr(r.id, String(i)),
              text: taskTitle(r),
              done: r.done === true || r.status === 'done',
              time: asStr(r.dueAt ?? r.time, 'Today'),
            };
          })
        );
        return;
      } catch {
        // fall through to fan-out
      }

      try {
        const [w, r, i, n, t] = await Promise.all([
          dashboard.weather().catch(() => null),
          mandi.vyapariRates().catch(() => []),
          intelligence.feed().catch(() => null),
          notifications.list({ pageSize: 5 }).catch(() => []),
          dashboard.tasksToday().catch(() => []),
        ]);
        if (!active) return;
        if (w) setWeather(asRecord(w));
        setRates(r as MandiPrice[]);
        if (i) setIntel(asRecord(i));
        setNotifs(n);
        setTasks(
          asArray(t ?? []).map((task, idx) => {
            const rec = asRecord(task);
            return {
              id: asStr(rec.id, String(idx)),
              text: taskTitle(rec),
              done: rec.done === true || rec.status === 'done',
              time: asStr(rec.dueAt ?? rec.time, 'Today'),
            };
          })
        );
      } catch (e) {
        if (active) setError(apiErrorMessage(e));
      } finally {
        if (active) setLoading(false);
      }
    };

    load();
    return () => {
      active = false;
    };
  }, []);

  const completeTask = async (id: string) => {
    setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, done: true } : t)));
    try {
      await dashboard.completeTask(id);
    } catch {
      /* task already done server-side or offline — UI already updated */
    }
  };

  const dismissTask = async (id: string) => {
    setTasks((prev) => prev.filter((t) => t.id !== id));
    try {
      await dashboard.dismissTask(id);
    } catch {
      /* ignore */
    }
  };

  const tempC = asNum(weather?.tempC ?? weather?.temperature ?? weather?.temp, 0);
  const humidity = asNum(weather?.humidity ?? weather?.humidityPercent, 0);
  const condition = asStr(weather?.condition ?? weather?.summary, 'Sunny');
  const sprayOk = asStr(weather?.sprayWindow ?? weather?.spray, '') || asStr(intel?.sprayWindow ?? '', '');

  const intelText = asStr(
    intel?.advice ?? intel?.tip ?? intel?.summary ?? intel?.headline,
    'Soil moisture is ideal for sowing. Seed treatment with Trichoderma will prevent root rot.'
  );

  const unreadCount = notifs.filter((n) => !n.read).length;

  return (
    <div className="space-y-6">
      {/* Welcome & Weather Cockpit Header */}
      <div className="bg-gradient-to-r from-emerald-800 to-teal-900 rounded-3xl p-6 sm:p-8 text-white shadow-lg relative overflow-hidden">
        <div className="absolute right-0 top-0 -mr-16 -mt-16 w-64 h-64 rounded-full bg-emerald-600/20 blur-2xl" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-xs font-semibold text-emerald-300">
              <MapPin className="w-4 h-4 text-emerald-400" />
              <span>{user?.village || 'Pimpalgaon Baswant'}, {user?.district || 'Nashik'}</span>
              <span className="text-emerald-400/40">•</span>
              <span>Gat 312 ({user?.farmSizeAcres || 4.5} Acres)</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
              Ram Ram, {user?.name.split(' ')[0] || 'Ramesh'} Ji! 🌾
            </h1>
            <p className="text-xs sm:text-sm text-emerald-100/90 max-w-xl">
              {rates.length > 0 ? (
                <>
                  {rates[0].commodity} modal rate is{' '}
                  <strong>{rates[0].trendPercentage >= 0 ? '+' : ''}{rates[0].trendPercentage}%</strong> today at{' '}
                  {rates[0].mandi} APMC.
                </>
              ) : (
                'Welcome back to your farm cockpit.'
              )}
            </p>
          </div>

          {/* Real-time Weather Tile */}
          <div className="bg-white/10 backdrop-blur-md rounded-2xl p-4 border border-white/20 flex items-center gap-4 flex-shrink-0">
            <CloudSun className="w-10 h-10 text-amber-300" />
            <div>
              <div className="text-2xl font-black">{tempC > 0 ? `${tempC}°C` : '—'}</div>
              <p className="text-[11px] text-emerald-200">
                {condition}{humidity > 0 ? ` • Humidity ${humidity}%` : ''}
              </p>
              <div className="text-[10px] text-emerald-300 font-bold mt-0.5 flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3 text-emerald-400" /> Spray Window: {sprayOk ? 'Optimal' : 'Check advisory'}
              </div>
            </div>
          </div>
        </div>
      </div>

      {error && (
        <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-2xl text-xs font-semibold text-rose-800">
          {error}
        </div>
      )}

      {/* Primary KPI Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Link to="/farmer/lots">
          <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-sm hover:shadow-md transition-all cursor-pointer hover:border-slate-300 h-full">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Active Lots</span>
              <div className="p-2.5 rounded-xl border bg-agri-50 text-agri-700 border-agri-100">
                <Package className="w-5 h-5" />
              </div>
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-2xl font-bold tracking-tight text-slate-900">My Lots</span>
            </div>
            <p className="mt-1 text-xs text-slate-500">Post & manage produce listings</p>
          </div>
        </Link>

        <Link to="/farmer/mandi">
          <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-sm hover:shadow-md transition-all cursor-pointer hover:border-slate-300 h-full">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Live Mandi Rates</span>
              <div className="p-2.5 rounded-xl border bg-harvest-50 text-harvest-700 border-harvest-100">
                <TrendingUp className="w-5 h-5" />
              </div>
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-2xl font-bold tracking-tight text-slate-900">
                {rates.length > 0 ? `${rates.length} Commodities` : 'Mandi'}
              </span>
            </div>
            <p className="mt-1 text-xs text-slate-500">Modal prices & forecasts</p>
          </div>
        </Link>

        <Link to="/farmer/transport">
          <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-sm hover:shadow-md transition-all cursor-pointer hover:border-slate-300 h-full">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Booked Transport</span>
              <div className="p-2.5 rounded-xl border bg-sky-50 text-sky-700 border-sky-100">
                <Truck className="w-5 h-5" />
              </div>
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-2xl font-bold tracking-tight text-slate-900">Book a Vehicle</span>
            </div>
            <p className="mt-1 text-xs text-slate-500">Post demand & compare transporter offers</p>
          </div>
        </Link>

        <Link to="/farmer/coins">
          <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-sm hover:shadow-md transition-all cursor-pointer hover:border-slate-300 h-full">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Kisan Coins</span>
              <div className="p-2.5 rounded-xl border bg-purple-50 text-purple-700 border-purple-100">
                <Coins className="w-5 h-5" />
              </div>
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-2xl font-bold tracking-tight text-slate-900">
                {user?.kisanCoins || coinBalance || 350}
              </span>
            </div>
            <p className="mt-1 text-xs text-slate-500">Redeemable on Krishi Mall</p>
          </div>
        </Link>
      </div>

      {/* Quick Launchpad Buttons */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <Link
          to="/farmer/crop-doctor"
          className="p-4 rounded-2xl bg-gradient-to-br from-emerald-50 to-teal-50 border border-emerald-200/90 shadow-xs hover:border-emerald-500 hover:shadow-md transition-all flex items-center gap-3"
        >
          <div className="p-2.5 rounded-xl bg-emerald-600 text-white shadow-xs">
            <Stethoscope className="w-5 h-5" />
          </div>
          <div>
            <h5 className="font-bold text-xs text-slate-900">AI Crop Doctor</h5>
            <p className="text-[10px] text-emerald-700 font-semibold">Scan leaf & disease</p>
          </div>
        </Link>

        <Link
          to="/farmer/lots"
          className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-xs hover:border-emerald-500 hover:shadow-md transition-all flex items-center gap-3"
        >
          <div className="p-2.5 rounded-xl bg-emerald-50 text-emerald-700">
            <Package className="w-5 h-5" />
          </div>
          <div>
            <h5 className="font-bold text-xs text-slate-900">Post Crop Lot</h5>
            <p className="text-[10px] text-slate-400">Sell direct to buyer</p>
          </div>
        </Link>

        <Link
          to="/farmer/transport"
          className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-xs hover:border-sky-500 hover:shadow-md transition-all flex items-center gap-3"
        >
          <div className="p-2.5 rounded-xl bg-sky-50 text-sky-700">
            <Truck className="w-5 h-5" />
          </div>
          <div>
            <h5 className="font-bold text-xs text-slate-900">Book a Vehicle</h5>
            <p className="text-[10px] text-slate-400">Demand & transporter applications</p>
          </div>
        </Link>

        <Link
          to="/farmer/equipment"
          className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-xs hover:border-amber-500 hover:shadow-md transition-all flex items-center gap-3"
        >
          <div className="p-2.5 rounded-xl bg-amber-50 text-amber-700">
            <CalendarCheck className="w-5 h-5" />
          </div>
          <div>
            <h5 className="font-bold text-xs text-slate-900">Rent Yantra</h5>
            <p className="text-[10px] text-slate-400">Tractor & rotavator</p>
          </div>
        </Link>

        <Link
          to="/farmer/diary"
          className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-xs hover:border-indigo-500 hover:shadow-md transition-all flex items-center gap-3"
        >
          <div className="p-2.5 rounded-xl bg-indigo-50 text-indigo-700">
            <BookOpen className="w-5 h-5" />
          </div>
          <div>
            <h5 className="font-bold text-xs text-slate-900">Farm Diary</h5>
            <p className="text-[10px] text-slate-400">P&L & cashbook</p>
          </div>
        </Link>
      </div>

      {/* Two-Column Cockpit: Live Mandi Insights & Daily Tasks */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Mandi Insights Column */}
        <div className="lg:col-span-2 bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-emerald-600" />
              <h3 className="font-bold text-sm text-slate-900">Nearby Mandi Live Rates</h3>
            </div>
            <Link
              to="/farmer/mandi"
              className="text-xs font-bold text-emerald-700 hover:underline flex items-center gap-1"
            >
              Full Analytics <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {loading ? (
            <div className="py-8 text-center text-xs font-bold text-slate-400 animate-pulse">
              Fetching live rates…
            </div>
          ) : rates.length === 0 ? (
            <div className="py-8 text-center text-xs font-semibold text-slate-400">
              Live rates unavailable right now. Try again in a few minutes.
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {rates.slice(0, 3).map((item, i) => (
                <div key={item.id || i} className="py-3 flex items-center justify-between">
                  <div>
                    <h5 className="font-bold text-xs text-slate-900">{item.commodity}</h5>
                    <p className="text-[11px] text-slate-500">{item.mandi} • {item.variety}</p>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-extrabold text-slate-900">
                      {formatCurrency(item.modalPrice)}
                      <span className="text-[10px] font-normal text-slate-500">/q</span>
                    </div>
                    <span
                      className={`text-[10px] font-bold ${
                        item.trendPercentage >= 0 ? 'text-emerald-700' : 'text-rose-600'
                      }`}
                    >
                      {item.trendPercentage >= 0 ? `+${item.trendPercentage}%` : `${item.trendPercentage}%`}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Latest notification banner */}
          {notifs.length > 0 && (
            <div className="p-4 rounded-2xl bg-amber-50/70 border border-amber-200 flex items-center justify-between gap-3">
              <div className="space-y-0.5 min-w-0">
                <h5 className="font-bold text-xs text-amber-950 flex items-center gap-1.5">
                  <Bell className="w-3.5 h-3.5 text-amber-600 flex-shrink-0" /> {notifs[0].title}
                </h5>
                <p className="text-[11px] text-amber-800 truncate">{notifs[0].body}</p>
              </div>
              <span className="text-[10px] font-bold text-amber-700 bg-amber-100 px-2 py-1 rounded-lg whitespace-nowrap">
                {unreadCount} new
              </span>
            </div>
          )}
        </div>

        {/* Daily Tasks & Agronomy Advice */}
        <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <CalendarCheck className="w-5 h-5 text-emerald-600" />
              <h3 className="font-bold text-sm text-slate-900">Today's Farm Action</h3>
            </div>
            <span className="text-[10px] font-bold bg-emerald-50 text-emerald-800 px-2 py-0.5 rounded-full">
              {tasks.filter((t) => t.done).length}/{tasks.length} Done
            </span>
          </div>

          {tasks.length === 0 && !urgentTask ? (
            <p className="text-xs text-slate-400 py-4 text-center">
              No pending tasks. You are all caught up!
            </p>
          ) : (
            <div className="space-y-2.5">
              {urgentTask && (
                <div className="p-3 rounded-2xl border border-rose-200 bg-rose-50 flex items-start gap-3">
                  <span className="mt-0.5 px-1.5 py-0.5 rounded-md bg-rose-600 text-white text-[9px] font-black uppercase tracking-wide flex-shrink-0">
                    {asStr(urgentTask.priority, 'urgent')}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-rose-900">{taskTitle(urgentTask)}</p>
                    {asStr(urgentTask.subtitle) && (
                      <p className="text-[10px] text-rose-700 mt-0.5 truncate">{asStr(urgentTask.subtitle)}</p>
                    )}
                    <span className="text-[10px] text-rose-500 font-semibold mt-0.5 block">
                      Due {asStr(urgentTask.dueAt, 'today')}
                    </span>
                  </div>
                  {asStr(urgentTask.id) && (
                    <button
                      onClick={() => completeTask(asStr(urgentTask.id))}
                      className="p-1 text-rose-400 hover:text-rose-600 rounded-md flex-shrink-0"
                      title="Mark done"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              )}
              {tasks.slice(0, 6).map((task) => (
                <div
                  key={task.id}
                  className={`p-3 rounded-2xl border transition-all flex items-start gap-3 ${
                    task.done
                      ? 'bg-slate-50 border-slate-200 opacity-60'
                      : 'bg-white border-slate-200/90 hover:border-emerald-400 shadow-xs'
                  }`}
                >
                  <button
                    onClick={() => completeTask(task.id)}
                    className={`w-5 h-5 rounded-lg border mt-0.5 flex items-center justify-center transition-colors flex-shrink-0 ${
                      task.done ? 'bg-emerald-600 border-emerald-600 text-white' : 'border-slate-300 hover:border-emerald-500'
                    }`}
                    title="Mark done"
                  >
                    {task.done && <CheckCircle2 className="w-3.5 h-3.5" />}
                  </button>
                  <div className="flex-1 min-w-0">
                    <p className={`text-xs font-semibold ${task.done ? 'line-through text-slate-400' : 'text-slate-800'}`}>
                      {task.text}
                    </p>
                    <span className="text-[10px] text-slate-400 mt-0.5 block">{task.time}</span>
                  </div>
                  {!task.done && (
                    <button
                      onClick={() => dismissTask(task.id)}
                      className="p-1 text-slate-300 hover:text-slate-500 rounded-md flex-shrink-0"
                      title="Dismiss"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* AI Agronomist Tip of the Day */}
          <div className="p-3.5 rounded-2xl bg-teal-50 border border-teal-200/80 text-teal-950 flex items-start gap-3">
            <Bot className="w-5 h-5 text-teal-700 flex-shrink-0 mt-0.5" />
            <div>
              <h5 className="font-bold text-xs">Agronomist Advisory</h5>
              <p className="text-[11px] text-teal-900/80 mt-0.5 leading-relaxed">{intelText}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
