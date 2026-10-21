import React, { useEffect, useState } from 'react';
import {
  HandCoins,
  Users,
  PiggyBank,
  CalendarCheck,
  Sprout,
  Home,
  AlertTriangle,
  ArrowRight,
  Syringe,
  Landmark,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { women } from '../../../lib/api';
import { StatusBadge } from '../../../components/common/StatusBadge';
import { StatCard } from '../../../components/common/StatCard';
import { cn, formatDate, formatNumber, formatPaisa } from '../../../lib/utils';
import { asRecord, asRecords, bool, num, pick, pickNum, pickStr } from '../../shared/records';
import type { WomenContentTab } from './types';

/**
 * Hub landing tab — one screen summary of the woman's SHG, garden, livestock
 * and home enterprise (GET /women/dashboard).
 */
export const DashboardPanel: React.FC<{ goTo: (tab: WomenContentTab) => void }> = ({ goTo }) => {
  const [data, setData] = useState<Record<string, unknown> | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let alive = true;
    women
      .dashboard()
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
        Dashboard could not be loaded right now — try again in a moment.
      </p>
    );
  }
  if (!data) {
    return <p className="text-xs text-slate-400">Loading your dashboard…</p>;
  }

  const groupRec = asRecord(pick(data, 'group'));
  const group = Object.keys(groupRec).length > 0 ? groupRec : null;
  const deposits = asRecord(pick(data, 'deposits'));
  const garden = asRecord(pick(data, 'garden'));
  const livestock = asRecord(pick(data, 'livestock'));
  const enterprise = asRecord(pick(data, 'enterprise'));
  const loans = asRecord(pick(data, 'loans'));
  const joinRequests = asRecord(pick(data, 'joinRequests'));

  const memberCount = pickNum(deposits, 'memberCount') || pickNum(group ?? {}, 'memberCount');
  const paidCount = pickNum(deposits, 'paidCount');
  const myPaid = bool(pick(deposits, 'myPaid'));
  const dueVaccinations = asRecords(pick(livestock, 'dueVaccinations'));
  const recentPlans = asRecords(pick(garden, 'recent'));
  const byStatus = asRecord(pick(garden, 'byStatus'));
  const myActive = asRecord(pick(loans, 'myActive'));
  const hasMyLoan = Object.keys(myActive).length > 0;
  const pendingLoans = pickNum(loans, 'pendingCount');
  const pendingJoin = pickNum(joinRequests, 'pendingCount');
  const isAdmin = bool(pick(group ?? {}, 'isAdmin'));

  return (
    <div className="space-y-4">
      {/* No-group empty state — garden/livestock/enterprise still render below. */}
      {!group && (
        <div className="bg-gradient-to-r from-pink-700 to-rose-800 rounded-3xl p-6 text-white shadow-md space-y-3">
          <h3 className="font-extrabold text-lg flex items-center gap-2">
            <Users className="w-5 h-5" /> Join a Bachat Gat to start saving together
          </h3>
          <p className="text-xs text-pink-100 max-w-xl">
            You are not part of a Self-Help Group yet. Create your own group or request to join a
            verified one nearby — pooled monthly deposits unlock the group's zero-interest loan fund.
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => goTo('shg')}
              className="px-4 py-2 bg-white text-pink-700 font-bold text-xs rounded-xl shadow-xs flex items-center gap-1.5"
            >
              Create / view My SHG <ArrowRight className="w-3.5 h-3.5" />
            </button>
            <Link
              to="/women/directory"
              className="px-4 py-2 bg-pink-600/40 border border-pink-300/50 text-white font-bold text-xs rounded-xl flex items-center gap-1.5"
            >
              Browse Bachat Gat directory <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      )}

      {/* Stat row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {group ? (
          <>
            <StatCard
              title="Group Corpus"
              value={formatPaisa(pickNum(group, 'corpusPaisa', 'corpus'))}
              icon={PiggyBank}
              colorScheme="purple"
              onClick={() => goTo('shg')}
            />
            <StatCard
              title="Loan Fund"
              value={formatPaisa(pickNum(group, 'loanFundPaisa', 'loanFund'))}
              subtitle={`Monthly deposit ${formatPaisa(pickNum(group, 'monthlyDepositPaisa'))}`}
              icon={HandCoins}
              colorScheme="amber"
              onClick={() => goTo('shg')}
            />
            <StatCard
              title="Members"
              value={formatNumber(pickNum(group, 'memberCount', 'members'))}
              subtitle={pickStr(group, 'village') || 'Your SHG'}
              icon={Users}
              colorScheme="blue"
              onClick={() => goTo('shg')}
            />
          </>
        ) : (
          <div className="col-span-2 lg:col-span-3 bg-white rounded-2xl border border-slate-200/80 p-4 shadow-xs flex items-center gap-3">
            <Landmark className="w-5 h-5 text-slate-300" />
            <p className="text-xs text-slate-400">
              Group savings, loan fund and member counts appear here once you join a Bachat Gat.
            </p>
          </div>
        )}

        {/* This-month deposits card with progress + pay action */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
              This-month deposits
            </span>
            <CalendarCheck
              className={cn('w-4 h-4', !myPaid && group ? 'text-rose-500' : 'text-emerald-600')}
            />
          </div>
          <p className="text-lg font-black text-slate-900">
            {formatNumber(paidCount)}
            <span className="text-slate-400 font-bold">/{formatNumber(memberCount)}</span>{' '}
            <span className="text-[10px] uppercase font-bold text-slate-400">paid</span>
          </p>
          <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
            <div
              className={cn(
                'h-full rounded-full transition-all',
                paidCount >= memberCount && memberCount > 0 ? 'bg-emerald-500' : 'bg-pink-500'
              )}
              style={{ width: `${memberCount > 0 ? Math.min(100, (paidCount / memberCount) * 100) : 0}%` }}
            />
          </div>
          {group && !myPaid && (
            <div className="flex items-center gap-2 pt-0.5">
              <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200">
                Due
              </span>
              <button
                onClick={() => goTo('shg')}
                className="text-[11px] font-bold text-pink-700 hover:text-pink-800 flex items-center gap-1"
              >
                Pay deposit <ArrowRight className="w-3 h-3" />
              </button>
            </div>
          )}
          {group && myPaid && (
            <p className="text-[11px] font-bold text-emerald-700">Your deposit is paid this month.</p>
          )}
          {!group && <p className="text-[11px] text-slate-400">Join a group to start depositing.</p>}
        </div>
      </div>

      {/* My active loan */}
      {hasMyLoan && (
        <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="font-bold text-xs text-slate-900 flex items-center gap-1.5">
              <HandCoins className="w-4 h-4 text-amber-600" /> My Active Loan
            </h4>
            <button
              onClick={() => goTo('shg')}
              className="text-[11px] font-bold text-pink-700 flex items-center gap-1"
            >
              Manage <ArrowRight className="w-3 h-3" />
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
            <div>
              <p className="text-[10px] uppercase font-bold text-slate-400">Borrowed</p>
              <p className="font-black text-slate-900">{formatPaisa(pickNum(myActive, 'amountPaisa'))}</p>
            </div>
            <div>
              <p className="text-[10px] uppercase font-bold text-slate-400">Repaid</p>
              <p className="font-black text-emerald-700">{formatPaisa(pickNum(myActive, 'repaidPaisa'))}</p>
            </div>
            <div>
              <p className="text-[10px] uppercase font-bold text-slate-400">Next due</p>
              <p className="font-black text-slate-900">
                {formatPaisa(pickNum(myActive, 'nextDuePaisa'))}
                <span className="text-slate-400 font-semibold"> by {formatDate(pickStr(myActive, 'nextDueDate')) || '—'}</span>
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Vaccination alerts */}
        <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="font-bold text-xs text-slate-900 flex items-center gap-1.5">
              <Syringe className="w-4 h-4 text-amber-600" /> Vaccination Alerts
            </h4>
            <span className="text-[11px] text-slate-400">
              {formatNumber(pickNum(livestock, 'animalCount'))} animals
            </span>
          </div>
          {dueVaccinations.length === 0 ? (
            <p className="text-xs text-slate-400">No vaccinations due — your backyard herd is up to date.</p>
          ) : (
            <div className="space-y-2">
              {dueVaccinations.map((v, i) => {
                const daysLeft = num(pick(v, 'daysLeft'), 0);
                const urgent = daysLeft <= 7;
                const overdue = daysLeft < 0;
                return (
                  <div
                    key={pickStr(v, 'animalId') || i}
                    className={cn(
                      'flex items-center justify-between gap-2 text-xs p-2.5 rounded-xl border',
                      overdue
                        ? 'bg-rose-50 border-rose-200 text-rose-800'
                        : urgent
                          ? 'bg-amber-50 border-amber-200 text-amber-800'
                          : 'bg-slate-50 border-slate-100 text-slate-700'
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <AlertTriangle className={cn('w-3.5 h-3.5 flex-shrink-0', overdue ? 'text-rose-500' : 'text-amber-500')} />
                      <div>
                        <p className="font-bold">{pickStr(v, 'vaccine') || 'Vaccination'}</p>
                        <p className="text-[11px] opacity-80">{pickStr(v, 'label') || 'Livestock'}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-bold">{formatDate(pickStr(v, 'dueDate')) || '—'}</p>
                      <p className="text-[10px] font-bold uppercase">
                        {overdue ? `${Math.abs(daysLeft)}d overdue` : `${daysLeft}d left`}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          <button
            onClick={() => goTo('livestock')}
            className="text-[11px] font-bold text-pink-700 flex items-center gap-1"
          >
            Open livestock <ArrowRight className="w-3 h-3" />
          </button>
        </div>

        {/* Garden snapshot */}
        <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="font-bold text-xs text-slate-900 flex items-center gap-1.5">
              <Sprout className="w-4 h-4 text-emerald-600" /> Kitchen Garden
            </h4>
            <span className="text-[11px] text-slate-400">
              {formatNumber(pickNum(garden, 'activePlans'))} active plans
            </span>
          </div>
          {Object.keys(byStatus).length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {Object.entries(byStatus).map(([status, count]) => (
                <span
                  key={status}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-50 border border-slate-200 text-[10px] font-bold text-slate-600"
                >
                  {status} · {formatNumber(num(count, 0))}
                </span>
              ))}
            </div>
          )}
          {recentPlans.length === 0 ? (
            <p className="text-xs text-slate-400">No garden plans yet — plan your first patch.</p>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {recentPlans.map((p, i) => (
                <span
                  key={pickStr(p, 'id') || i}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 border border-emerald-100 text-[11px] font-bold text-emerald-800"
                >
                  {pickStr(p, 'title') || 'Plan'}
                  {pickStr(p, 'cropName') ? ` · ${pickStr(p, 'cropName')}` : ''}
                  <StatusBadge status={pickStr(p, 'status') || 'planned'} className="text-[9px] px-1.5" />
                </span>
              ))}
            </div>
          )}
          <button
            onClick={() => goTo('garden')}
            className="text-[11px] font-bold text-pink-700 flex items-center gap-1"
          >
            Open garden <ArrowRight className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* Enterprise + admin strip */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs p-5 space-y-2">
          <div className="flex items-center justify-between">
            <h4 className="font-bold text-xs text-slate-900 flex items-center gap-1.5">
              <Home className="w-4 h-4 text-pink-600" /> Home Enterprise
            </h4>
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-300">Gruh Udyog</span>
          </div>
          <p className="text-xl font-black text-slate-900">
            {formatPaisa(pickNum(enterprise, 'totalMonthlyProfitPaisa'))}
            <span className="text-xs font-bold text-slate-400"> / month profit</span>
          </p>
          <p className="text-[11px] text-slate-400">
            {formatNumber(pickNum(enterprise, 'lineCount'))} income lines tracked
          </p>
          <button
            onClick={() => goTo('gruh')}
            className="text-[11px] font-bold text-pink-700 flex items-center gap-1"
          >
            Open Gruh Udyog studio <ArrowRight className="w-3 h-3" />
          </button>
        </div>

        {isAdmin && (pendingJoin > 0 || pendingLoans > 0) && (
          <div className="bg-amber-50 rounded-3xl border border-amber-200 shadow-xs p-5 space-y-3">
            <h4 className="font-bold text-xs text-amber-900 flex items-center gap-1.5">
              <AlertTriangle className="w-4 h-4 text-amber-600" /> Group admin — action needed
            </h4>
            <div className="space-y-1.5 text-xs">
              {pendingJoin > 0 && (
                <button
                  onClick={() => goTo('shg')}
                  className="w-full flex items-center justify-between p-2.5 rounded-xl bg-white border border-amber-200 font-bold text-amber-900"
                >
                  <span>Pending join requests</span>
                  <span className="px-2 py-0.5 rounded-full bg-amber-500 text-white text-[10px]">
                    {formatNumber(pendingJoin)}
                  </span>
                </button>
              )}
              {pendingLoans > 0 && (
                <button
                  onClick={() => goTo('shg')}
                  className="w-full flex items-center justify-between p-2.5 rounded-xl bg-white border border-amber-200 font-bold text-amber-900"
                >
                  <span>Loans awaiting approval</span>
                  <span className="px-2 py-0.5 rounded-full bg-amber-500 text-white text-[10px]">
                    {formatNumber(pendingLoans)}
                  </span>
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
