import React, { useEffect, useState } from 'react';
import {
  LineChart as LineChartIcon,
  TrendingUp,
  HandCoins,
  Sprout,
  Egg,
  Home,
  Sparkles,
  Trophy,
} from 'lucide-react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts';
import { women } from '../../../lib/api';
import { cn, formatDate, formatNumber, formatPaisa } from '../../../lib/utils';
import { asRecord, asRecords, num, pick, pickNum, pickStr } from '../../shared/records';

/**
 * AI Insights tab — savings trend, loan-fund health, garden/livestock summary
 * and a best-seller + suggestion card (GET /women/insights).
 */
export const InsightsPanel: React.FC = () => {
  const [data, setData] = useState<Record<string, unknown> | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let alive = true;
    women
      .insights()
      .then((res) => {
        if (alive) setData(asRecord(res));
      })
      .catch(() => {
        if (alive) setFailed(true);
      });
    return () => {
      alive = false;
    };
  }, []);

  if (failed) {
    return (
      <p className="text-xs text-slate-400 bg-white rounded-3xl border border-slate-200/80 p-6 text-center">
        Insights could not be loaded right now — try again in a moment.
      </p>
    );
  }
  if (!data) {
    return <p className="text-xs text-slate-400">Preparing your insights…</p>;
  }

  const trend = asRecords(pick(data, 'savingsTrend')).map((t) => ({
    month: pickStr(t, 'month'),
    depositsPaisa: pickNum(t, 'depositsPaisa'),
    count: pickNum(t, 'count'),
  }));
  const loanHealth = asRecord(pick(data, 'loanHealth'));
  const garden = asRecord(pick(data, 'garden'));
  const livestock = asRecord(pick(data, 'livestock'));
  const enterprise = asRecord(pick(data, 'enterprise'));
  const bestSeller = asRecord(pick(enterprise, 'bestSeller'));
  const hasBestSeller = Object.keys(bestSeller).length > 0;
  const suggestion = pickStr(enterprise, 'suggestion');
  const byStatus = asRecord(pick(garden, 'byStatus'));
  const dueVaccinations = asRecords(pick(livestock, 'dueVaccinations'));

  const isAllEmpty =
    trend.every((t) => t.depositsPaisa === 0) &&
    !loanHealth.requested &&
    !loanHealth.active &&
    !loanHealth.repaid &&
    !loanHealth.overdue &&
    !garden.activePlans &&
    !garden.harvested &&
    !livestock.animalCount &&
    !enterprise.totalMonthlyProfitPaisa &&
    !hasBestSeller;

  if (isAllEmpty) {
    return (
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs p-8 text-center space-y-2">
        <Sparkles className="w-8 h-8 text-pink-300 mx-auto" />
        <h3 className="font-bold text-sm text-slate-900">Not enough activity yet</h3>
        <p className="text-xs text-slate-400 max-w-md mx-auto">
          Make a monthly deposit, register livestock, start a garden plan or add a home-enterprise
          income line — your savings trend, loan health and best-seller insights will appear here.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Savings trend */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs p-5 space-y-3">
        <h4 className="font-bold text-xs text-slate-900 flex items-center gap-1.5">
          <TrendingUp className="w-4 h-4 text-emerald-600" /> Savings trend (last 6 months)
        </h4>
        {trend.length === 0 ? (
          <p className="text-xs text-slate-400">No deposits recorded yet.</p>
        ) : (
          <div className="h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trend} margin={{ top: 10, right: 10, left: -14, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis
                  dataKey="month"
                  tick={{ fontSize: 11, fill: '#64748b' }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  domain={['auto', 'auto']}
                  tick={{ fontSize: 11, fill: '#64748b' }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v: number) => `₹${formatNumber(Math.round(v / 100))}`}
                />
                <Tooltip
                  formatter={(val: number, name: string) =>
                    name === 'Deposits'
                      ? [formatPaisa(val), 'Total deposits']
                      : [formatNumber(val), 'Deposits count']
                  }
                  contentStyle={{
                    borderRadius: '1rem',
                    border: '1px solid #e2e8f0',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="depositsPaisa"
                  name="Deposits"
                  stroke="#db2777"
                  strokeWidth={3}
                  dot={{ r: 3, fill: '#db2777' }}
                />
                <Line
                  type="monotone"
                  dataKey="count"
                  name="Count"
                  stroke="#0d9488"
                  strokeWidth={2}
                  dot={{ r: 2, fill: '#0d9488' }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: 'Requested', value: pickNum(loanHealth, 'requested'), icon: HandCoins, tone: 'text-amber-600' },
          { label: 'Active', value: pickNum(loanHealth, 'active'), icon: HandCoins, tone: 'text-sky-600' },
          { label: 'Repaid', value: pickNum(loanHealth, 'repaid'), icon: HandCoins, tone: 'text-emerald-600' },
          { label: 'Overdue', value: pickNum(loanHealth, 'overdue'), icon: HandCoins, tone: 'text-rose-600' },
        ].map((s) => (
          <div key={s.label} className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-xs">
            <s.icon className={cn('w-4 h-4 mb-1.5', s.tone)} />
            <p className="text-xl font-black text-slate-900">{formatNumber(s.value)}</p>
            <p className="text-[10px] uppercase font-bold text-slate-400">
              Loans {s.label} · fund {formatPaisa(pickNum(loanHealth, 'fundPaisa'))}
            </p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Garden */}
        <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs p-5 space-y-2">
          <h4 className="font-bold text-xs text-slate-900 flex items-center gap-1.5">
            <Sprout className="w-4 h-4 text-emerald-600" /> Garden
          </h4>
          <p className="text-lg font-black text-slate-900">
            {formatNumber(pickNum(garden, 'activePlans'))}
            <span className="text-xs font-bold text-slate-400"> active plans · </span>
            {formatNumber(pickNum(garden, 'harvested'))}
            <span className="text-xs font-bold text-slate-400"> harvested</span>
          </p>
          {Object.keys(byStatus).length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {Object.entries(byStatus).map(([status, count]) => (
                <span
                  key={status}
                  className="px-2 py-0.5 rounded-full bg-emerald-50 border border-emerald-100 text-[10px] font-bold text-emerald-700"
                >
                  {status} · {formatNumber(num(count, 0))}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Livestock */}
        <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs p-5 space-y-2">
          <h4 className="font-bold text-xs text-slate-900 flex items-center gap-1.5">
            <Egg className="w-4 h-4 text-amber-500" /> Livestock
          </h4>
          <p className="text-lg font-black text-slate-900">
            {formatNumber(pickNum(livestock, 'animalCount'))}
            <span className="text-xs font-bold text-slate-400"> animals registered</span>
          </p>
          <p
            className={cn(
              'text-[11px] font-bold',
              dueVaccinations.length > 0 ? 'text-amber-700' : 'text-emerald-700'
            )}
          >
            {dueVaccinations.length > 0
              ? `${dueVaccinations.length} vaccination${dueVaccinations.length > 1 ? 's' : ''} due soon`
              : 'All vaccinations up to date'}
          </p>
        </div>

        {/* Enterprise */}
        <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs p-5 space-y-2">
          <h4 className="font-bold text-xs text-slate-900 flex items-center gap-1.5">
            <Home className="w-4 h-4 text-pink-600" /> Home enterprise
          </h4>
          <p className="text-lg font-black text-slate-900">
            {formatPaisa(pickNum(enterprise, 'totalMonthlyProfitPaisa'))}
            <span className="text-xs font-bold text-slate-400"> / month</span>
          </p>
          {hasBestSeller ? (
            <p className="text-[11px] text-slate-500 flex items-center gap-1">
              <Trophy className="w-3.5 h-3.5 text-amber-500" />
              Best seller: <span className="font-bold text-slate-800">{pickStr(bestSeller, 'name')}</span> (
              {formatPaisa(pickNum(bestSeller, 'profitPaisa'))} profit on {formatPaisa(pickNum(bestSeller, 'revenuePaisa'))})
            </p>
          ) : (
            <p className="text-[11px] text-slate-400">Add income lines to discover your best seller.</p>
          )}
        </div>
      </div>

      {/* Suggestion */}
      {suggestion && (
        <div className="bg-pink-50 rounded-3xl border border-pink-200 shadow-xs p-5 space-y-1.5">
          <h4 className="font-bold text-xs text-pink-900 flex items-center gap-1.5">
            <Sparkles className="w-4 h-4 text-pink-600" /> Suggestion
          </h4>
          <p className="text-xs text-pink-900 leading-relaxed">{suggestion}</p>
        </div>
      )}
      {dueVaccinations.length > 0 && (
        <div className="bg-amber-50 rounded-3xl border border-amber-200 shadow-xs p-5 space-y-2">
          <h4 className="font-bold text-xs text-amber-900">Upcoming vaccinations</h4>
          {dueVaccinations.map((v, i) => (
            <div key={pickStr(v, 'animalId') || i} className="flex items-center justify-between text-xs text-amber-900">
              <span className="font-bold">
                {pickStr(v, 'vaccine') || 'Vaccine'} — {pickStr(v, 'label') || 'Livestock'}
              </span>
              <span>
                {formatDate(pickStr(v, 'dueDate')) || '—'}
                {num(pick(v, 'daysLeft'), 0) >= 0 ? ` (${num(pick(v, 'daysLeft'), 0)}d left)` : ''}
              </span>
            </div>
          ))}
        </div>
      )}
      <p className="text-[10px] text-slate-300 flex items-center gap-1 justify-center">
        <LineChartIcon className="w-3 h-3" /> Insights refresh as your SHG records grow.
      </p>
    </div>
  );
};
