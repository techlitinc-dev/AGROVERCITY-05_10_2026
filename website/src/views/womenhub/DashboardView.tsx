import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Bell, CalendarDays, Landmark, Sprout, Store } from 'lucide-react';
import { apiErrorMessage, womenHub } from '../../lib/api';
import { formatCurrency } from '../../lib/utils';

interface CropRecent {
  id: string;
  name: string;
  stage: string;
  season?: string;
  sownOn?: string;
}

interface DashboardPayload {
  garden?: { byStage?: Record<string, number>; recent?: CropRecent[] };
  businesses?: { count: number; activeCount: number };
  enterprise?: { totalMonthlyProfitPaisa: number; lineCount: number };
  notifications?: {
    items: { id: string; title: string; body: string; type: string; read: boolean; createdAt: string }[];
  };
  calendar?: { label: string; sakaYear: number; month: string; day: number };
  reminders?: { cropId: string; cropName: string; type: string; dueDate: string; daysLeft: number }[];
}

const STAGE_ORDER = ['sowing', 'sprout', 'vegetative', 'flowering', 'harvest'];
const STAGE_LABEL: Record<string, string> = {
  sowing: 'Sowing',
  sprout: 'Sprout',
  vegetative: 'Vegetative',
  flowering: 'Flowering',
  harvest: 'Harvest',
};

export const WomanHubDashboardView: React.FC = () => {
  const [data, setData] = useState<DashboardPayload | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    womenHub
      .dashboard()
      .then((payload) => {
        if (mounted) setData(payload as DashboardPayload);
      })
      .catch((e) => mounted && setError(apiErrorMessage(e)));
    return () => {
      mounted = false;
    };
  }, []);

  if (error) {
    return (
      <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl text-xs font-bold text-rose-800">
        {error}
      </div>
    );
  }
  if (!data) {
    return <div className="p-8 text-center text-xs font-bold text-slate-400 animate-pulse">Loading dashboard…</div>;
  }

  const byStage = data.garden?.byStage ?? {};
  const recent = data.garden?.recent ?? [];
  const notifications = data.notifications?.items ?? [];
  const reminders = data.reminders ?? [];

  return (
    <div className="space-y-4">
      {/* Indian calendar + notifications header row */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs p-5 flex items-center gap-4">
          <div className="w-11 h-11 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
            <CalendarDays className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Indian calendar</p>
            <p className="text-sm font-black text-slate-900">{data.calendar?.label ?? '—'}</p>
          </div>
        </div>
        <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs p-5">
          <div className="flex items-center gap-2 mb-2">
            <Bell className="w-4 h-4 text-emerald-600" />
            <p className="text-xs font-bold text-slate-700">Notifications</p>
          </div>
          {notifications.length === 0 ? (
            <p className="text-[11px] text-slate-400">No alerts yet.</p>
          ) : (
            <ul className="space-y-1.5">
              {notifications.slice(0, 4).map((n) => (
                <li key={n.id} className="text-[11px] text-slate-600">
                  <span className="font-bold text-slate-800">{n.title}</span> — {n.body}
                </li>
              ))}
            </ul>
          )}
          <Link to="/notifications" className="text-[11px] font-bold text-emerald-700 hover:underline">
            View all
          </Link>
        </div>
      </div>

      {/* Garden growth stages */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs p-5">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Sprout className="w-4 h-4 text-emerald-600" />
            <p className="text-xs font-bold text-slate-700">Kitchen garden growth stages</p>
          </div>
          <Link to="/womenHub/garden" className="text-[11px] font-bold text-emerald-700 hover:underline">
            Open garden planner
          </Link>
        </div>
        <div className="flex gap-2 flex-wrap mb-3">
          {STAGE_ORDER.map((stage) => (
            <span
              key={stage}
              className="px-3 py-1.5 rounded-2xl text-[11px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-100"
            >
              {STAGE_LABEL[stage]} · {byStage[stage] ?? 0}
            </span>
          ))}
        </div>
        {recent.length === 0 ? (
          <p className="text-[11px] text-slate-400">No crops yet — start with the garden planner.</p>
        ) : (
          <ul className="space-y-1">
            {recent.map((crop) => (
              <li key={crop.id} className="text-[11px] text-slate-600">
                <span className="font-bold text-slate-800">{crop.name}</span>
                {crop.season ? ` (${crop.season})` : ''} — {STAGE_LABEL[crop.stage] ?? crop.stage}
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Total business + enterprise profit */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs p-5">
          <div className="flex items-center gap-2 mb-1">
            <Store className="w-4 h-4 text-purple-600" />
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Total business</p>
          </div>
          <p className="text-2xl font-black text-slate-900">{data.businesses?.count ?? 0}</p>
          <p className="text-[11px] text-slate-500">
            {data.businesses?.activeCount ?? 0} active
            <Link to="/womenHub/businesses" className="ml-2 font-bold text-emerald-700 hover:underline">
              Manage
            </Link>
          </p>
        </div>
        <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs p-5">
          <div className="flex items-center gap-2 mb-1">
            <Landmark className="w-4 h-4 text-emerald-600" />
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Enterprise profit total</p>
          </div>
          <p className="text-2xl font-black text-slate-900">
            {formatCurrency((data.enterprise?.totalMonthlyProfitPaisa ?? 0) / 100)}
          </p>
          <p className="text-[11px] text-slate-500">
            across {data.enterprise?.lineCount ?? 0} product lines
            <Link to="/womenHub/enterprise" className="ml-2 font-bold text-emerald-700 hover:underline">
              Open ledger
            </Link>
          </p>
        </div>
      </div>

      {/* Reminders */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs p-5">
        <p className="text-xs font-bold text-slate-700 mb-3">Reminders (water / fertilizer)</p>
        {reminders.length === 0 ? (
          <p className="text-[11px] text-slate-400">No reminders due in the next 7 days.</p>
        ) : (
          <ul className="space-y-1.5">
            {reminders.map((r, i) => (
              <li key={`${r.cropId}-${i}`} className="text-[11px] text-slate-600 flex items-center justify-between">
                <span>
                  <span className="font-bold text-slate-800">{r.cropName}</span> — {r.type} due {r.dueDate}
                </span>
                <span className="font-bold text-amber-600">{r.daysLeft}d left</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};
