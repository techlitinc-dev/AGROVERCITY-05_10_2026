import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { CalendarDays, HandCoins, Landmark, Sprout, Store, Users, Wallet } from 'lucide-react';
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
  customers?: {
    count: number;
    totalSalesPaisa: number;
    totalCostPaisa: number;
    totalProfitPaisa: number;
    totalCashReceivedPaisa: number;
    totalRemainingPaisa: number;
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
  const reminders = data.reminders ?? [];
  const khata = data.customers;

  return (
    <div className="space-y-4">
      {/* Indian calendar header */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs p-5 flex items-center gap-4">
        <div className="w-11 h-11 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
          <CalendarDays className="w-5 h-5" />
        </div>
        <div>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Indian calendar</p>
          <p className="text-sm font-black text-slate-900">{data.calendar?.label ?? '—'}</p>
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

      {/* Customer khata — revenue, profit, cash received, pending payments */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs p-5">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-pink-600" />
            <p className="text-xs font-bold text-slate-700">
              Customer khata{khata ? ` (${khata.count} customers)` : ''}
            </p>
          </div>
          <Link to="/womenHub/businesses" className="text-[11px] font-bold text-emerald-700 hover:underline">
            Manage customers
          </Link>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="rounded-2xl bg-slate-50 p-3">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Total revenue</p>
            <p className="text-lg font-black text-slate-900">
              {formatCurrency((khata?.totalSalesPaisa ?? 0) / 100)}
            </p>
            <p className="text-[10px] text-slate-400">all customer sales</p>
          </div>
          <div className="rounded-2xl bg-slate-50 p-3">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Total profit</p>
            <p
              className={`text-lg font-black ${
                (khata?.totalProfitPaisa ?? 0) >= 0 ? 'text-emerald-700' : 'text-rose-600'
              }`}
            >
              {formatCurrency((khata?.totalProfitPaisa ?? 0) / 100)}
            </p>
            <p className="text-[10px] text-slate-400">sales − cost</p>
          </div>
          <div className="rounded-2xl bg-slate-50 p-3">
            <div className="flex items-center gap-1">
              <Wallet className="w-3 h-3 text-emerald-600" />
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Cash received</p>
            </div>
            <p className="text-lg font-black text-emerald-700">
              {formatCurrency((khata?.totalCashReceivedPaisa ?? 0) / 100)}
            </p>
            <p className="text-[10px] text-slate-400">cash payments collected</p>
          </div>
          <div className="rounded-2xl bg-slate-50 p-3">
            <div className="flex items-center gap-1">
              <HandCoins className="w-3 h-3 text-amber-600" />
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Remaining payment</p>
            </div>
            <p
              className={`text-lg font-black ${
                (khata?.totalRemainingPaisa ?? 0) > 0 ? 'text-amber-700' : 'text-slate-900'
              }`}
            >
              {formatCurrency((khata?.totalRemainingPaisa ?? 0) / 100)}
            </p>
            <p className="text-[10px] text-slate-400">pending from customers</p>
          </div>
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
