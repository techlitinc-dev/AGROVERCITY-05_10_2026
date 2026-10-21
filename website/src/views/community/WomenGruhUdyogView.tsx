import React, { useEffect, useState } from 'react';
import {
  Heart,
  Sprout,
  Home,
  Egg,
  Users,
  AlertCircle,
  CheckCircle2,
  Plus,
  Package,
  IndianRupee,
  Award,
  ClipboardList,
  BadgePercent,
  Syringe,
} from 'lucide-react';
import { apiErrorMessage, gruhUdyog, uploads, women, ApiError } from '../../lib/api';
import { useAuthStore } from '../../stores/authStore';
import { StatusBadge } from '../../components/common/StatusBadge';
import { cn, formatCurrency, formatDate, formatDateTime, formatNumber, formatPaisa } from '../../lib/utils';
import { asRecord, asRecords, bool, pick, pickNum, pickStr } from '../shared/records';
import { DashboardPanel } from './women/DashboardPanel';
import { InsightsPanel } from './women/InsightsPanel';
import { JoinRequestsSection } from './women/JoinRequestsSection';
import { ShgLoansSection } from './women/ShgLoansSection';
import { currentMonth, type WomenTab } from './women/types';

type Tab = WomenTab;

const TABS: { id: Tab; label: string }[] = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'shg', label: 'My SHG' },
  { id: 'garden', label: 'Kitchen Garden' },
  { id: 'livestock', label: 'Backyard Livestock' },
  { id: 'gruh', label: 'Gruh Udyog Studio' },
  { id: 'insights', label: 'AI Insights' },
];

export const WomenGruhUdyogView: React.FC = () => {
  const [tab, setTab] = useState<Tab>('dashboard');
  const [notice, setNotice] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);
  const flash = (kind: 'ok' | 'err', text: string) => {
    setNotice({ kind, text });
    window.setTimeout(() => setNotice(null), 4000);
  };

  return (
    <div className="space-y-6">
      <div className="border-b border-slate-200 pb-4">
        <h1 className="text-2xl font-extrabold text-slate-900 flex items-center gap-2">
          <Heart className="w-7 h-7 text-pink-600" />
          Mahila Gruh Udyog & SHG Enterprise Hub
        </h1>
        <p className="text-xs text-slate-500 mt-1">
          Empowering rural women self-help groups (SHG) with savings circles, kitchen gardens, backyard livestock, and zero-brokerage home enterprises
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

      <div className="flex gap-2 overflow-x-auto no-scrollbar">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={cn(
              'whitespace-nowrap px-4 py-2 rounded-2xl text-xs font-bold border transition-colors',
              tab === t.id
                ? 'bg-pink-600 text-white border-pink-600 shadow-xs'
                : 'bg-white text-slate-600 border-slate-200 hover:border-pink-300'
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'dashboard' && <DashboardPanel goTo={setTab} />}
      {tab === 'shg' && <ShgPanel flash={flash} />}
      {tab === 'garden' && <GardenPanel flash={flash} />}
      {tab === 'livestock' && <LivestockPanel />}
      {tab === 'gruh' && <GruhPanel flash={flash} />}
      {tab === 'insights' && <InsightsPanel />}
    </div>
  );
};

/* ------------------------------------------------------------------ SHG */

const ShgPanel: React.FC<{ flash: (k: 'ok' | 'err', t: string) => void }> = ({ flash }) => {
  const myUid = useAuthStore((s) => s.user?.id);
  const [shg, setShg] = useState<Record<string, unknown> | null>(null);
  const [deposits, setDeposits] = useState<Record<string, unknown>[]>([]);
  const [checked, setChecked] = useState(false);
  const [meetings, setMeetings] = useState<Record<string, unknown>[]>([]);
  const [groupName, setGroupName] = useState('');
  const [contribution, setContribution] = useState('500');
  const [village, setVillage] = useState('');
  const [district, setDistrict] = useState('');
  const [depositAmount, setDepositAmount] = useState('500');
  const [busy, setBusy] = useState(false);

  const load = async () => {
    try {
      const res = asRecord(await women.shg());
      // GET /women/shg → {group, deposits, meetings}; tolerate a bare group doc too.
      const group = asRecord(pick(res, 'group'));
      setShg(Object.keys(group).length > 0 ? group : null);
      setDeposits(asRecords(pick(res, 'deposits')));
    } catch {
      setShg(null);
    } finally {
      setChecked(true);
    }
    women
      .meetings()
      .then((rows) => setMeetings(asRecords(rows)))
      .catch(() => undefined);
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const createGroup = async () => {
    if (!groupName.trim() || busy) return;
    setBusy(true);
    try {
      await women.createShg({
        name: groupName.trim(),
        monthlyDepositPaisa: Math.round((Number(contribution) || 0) * 100),
        memberCount: 1,
        village: village.trim() || undefined,
        district: district.trim() || undefined,
      });
      flash('ok', `SHG "${groupName.trim()}" created — invite members from your village to join.`);
      await load();
    } catch (err) {
      flash('err', apiErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const deposit = async () => {
    const rupees = Number(depositAmount);
    if (!rupees || rupees <= 0 || busy) return;
    setBusy(true);
    try {
      await women.deposit({ amountPaisa: Math.round(rupees * 100), month: currentMonth() });
      flash('ok', `${formatCurrency(rupees)} deposited for ${currentMonth()} — corpus updated.`);
      await load();
    } catch (err) {
      // One deposit per calendar month — 409 DUPLICATE_DEPOSIT_MONTH is a friendly state, not a failure.
      if (err instanceof ApiError && (err.status === 409 || err.code === 'DUPLICATE_DEPOSIT_MONTH')) {
        flash('ok', 'You have already paid this month’s deposit — one deposit per month.');
        await load();
      } else {
        flash('err', apiErrorMessage(err));
      }
    } finally {
      setBusy(false);
    }
  };

  if (!checked) {
    return <p className="text-xs text-slate-400">Loading your SHG…</p>;
  }

  if (!shg) {
    return (
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs p-6 max-w-xl space-y-4">
        <h3 className="font-bold text-sm text-slate-900 flex items-center gap-1.5">
          <Users className="w-4 h-4 text-pink-600" /> Start a Self-Help Group
        </h3>
        <p className="text-xs text-slate-500">
          A Bachat Gat pools monthly contributions for micro-loans, bulk input buying, and emergency support.
          Prefer to join an existing group?{' '}
          <a href="/women/directory" className="font-bold text-pink-700 underline">
            Browse the directory
          </a>
          .
        </p>
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Group name</label>
            <input
              type="text"
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              placeholder="e.g. Laxmi Mahila Bachat Gat"
              className="w-full px-3 py-2.5 text-xs rounded-xl border border-slate-300 focus:outline-none focus:border-pink-600"
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Monthly contribution (₹)</label>
              <input
                type="number"
                min={50}
                value={contribution}
                onChange={(e) => setContribution(e.target.value)}
                className="w-full px-3 py-2.5 text-xs rounded-xl border border-slate-300 focus:outline-none focus:border-pink-600"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Village</label>
              <input
                type="text"
                value={village}
                onChange={(e) => setVillage(e.target.value)}
                placeholder="e.g. Koregaon"
                className="w-full px-3 py-2.5 text-xs rounded-xl border border-slate-300 focus:outline-none focus:border-pink-600"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">District</label>
              <input
                type="text"
                value={district}
                onChange={(e) => setDistrict(e.target.value)}
                placeholder="e.g. Satara"
                className="w-full px-3 py-2.5 text-xs rounded-xl border border-slate-300 focus:outline-none focus:border-pink-600"
              />
            </div>
          </div>
          <button
            onClick={() => void createGroup()}
            disabled={!groupName.trim() || busy}
            className="px-4 py-2.5 bg-pink-600 hover:bg-pink-700 disabled:opacity-40 text-white font-bold text-xs rounded-xl shadow-xs"
          >
            {busy ? 'Creating…' : 'Create SHG'}
          </button>
        </div>
      </div>
    );
  }

  const month = currentMonth();
  const memberCount = pickNum(shg, 'memberCount', 'members');
  const monthDeposits = deposits.filter((d) => (pickStr(d, 'month') || '').startsWith(month));
  const myPaidThisMonth = monthDeposits.some((d) => {
    const by = pickStr(d, 'uid', 'memberUid', 'depositedBy');
    return !by || !myUid || by === myUid;
  });
  const members = asRecords(pick(shg, 'members'));
  const isAdmin = bool(pick(shg, 'isAdmin'));

  return (
    <div className="space-y-4">
      <div className="bg-gradient-to-r from-pink-700 to-rose-800 rounded-3xl p-6 text-white shadow-md flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <span className="text-[10px] font-bold uppercase tracking-wider text-pink-200">My Self-Help Group</span>
          <h3 className="font-extrabold text-lg mt-0.5">{pickStr(shg, 'name') || 'SHG'}</h3>
          <p className="text-xs text-pink-200 mt-1">
            {formatNumber(memberCount)} members · Formed {pickStr(shg, 'formedAt', 'createdAt') || '—'}
            {pickStr(shg, 'village') ? ` · ${pickStr(shg, 'village')}` : ''}
            {isAdmin && ' · You are the group admin'}
          </p>
        </div>
        <div className="flex gap-6 sm:text-right">
          <div>
            <p className="text-2xl font-black">{formatPaisa(pickNum(shg, 'corpusPaisa', 'corpus', 'balance', 'totalSavings'))}</p>
            <p className="text-[10px] uppercase font-bold text-pink-200">Group Corpus</p>
          </div>
          <div>
            <p className="text-2xl font-black">{formatPaisa(pickNum(shg, 'loanFundPaisa', 'loanFund'))}</p>
            <p className="text-[10px] uppercase font-bold text-pink-200">Loan Fund</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="font-bold text-xs text-slate-900">Make a Savings Deposit</h4>
            <span
              className={cn(
                'text-[10px] font-bold uppercase px-2 py-0.5 rounded-full border',
                myPaidThisMonth
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  : 'bg-rose-50 text-rose-700 border-rose-200'
              )}
            >
              {myPaidThisMonth ? `${month} paid` : `${month} due`}
            </span>
          </div>
          <p className="text-[11px] text-slate-400">
            This month: {formatNumber(monthDeposits.length)}/{formatNumber(memberCount)} members have paid · one
            deposit per member per month.
          </p>
          <div className="flex gap-2">
            <input
              type="number"
              min={10}
              value={depositAmount}
              onChange={(e) => setDepositAmount(e.target.value)}
              className="flex-1 px-3 py-2.5 text-xs rounded-xl border border-slate-300 focus:outline-none focus:border-pink-600"
            />
            <button
              onClick={() => void deposit()}
              disabled={busy || myPaidThisMonth || !(Number(depositAmount) > 0)}
              className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white font-bold text-xs rounded-xl shadow-xs"
            >
              {myPaidThisMonth ? 'Paid' : 'Deposit'}
            </button>
          </div>
        </div>

        <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs p-5 space-y-3">
          <h4 className="font-bold text-xs text-slate-900 flex items-center gap-1.5">
            <Users className="w-4 h-4 text-pink-600" /> Members
          </h4>
          {members.length === 0 ? (
            <p className="text-xs text-slate-400">
              {formatNumber(memberCount)} member{memberCount === 1 ? '' : 's'} — detailed member list appears here as
              women join.
            </p>
          ) : (
            <div className="divide-y divide-slate-100">
              {members.map((m, i) => {
                const memberUid = pickStr(m, 'memberUid', 'uid', 'id') || String(i);
                return (
                  <div key={memberUid} className="py-2 flex items-center justify-between gap-3 text-xs">
                    <div>
                      <p className="font-bold text-slate-800">{pickStr(m, 'name') || 'Member'}</p>
                      <p className="text-[10px] text-slate-400 font-mono">
                        {memberUid.length > 12 ? `${memberUid.slice(0, 12)}…` : memberUid}
                      </p>
                    </div>
                    <span className="text-[10px] font-bold uppercase text-slate-400">
                      {pickStr(m, 'role') || 'member'}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <ShgLoansSection group={shg} />
      {isAdmin && <JoinRequestsSection />}

      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs p-5 space-y-3">
        <h4 className="font-bold text-xs text-slate-900">Meetings</h4>
        {meetings.length === 0 ? (
          <p className="text-xs text-slate-400">No meetings recorded yet.</p>
        ) : (
          <div className="divide-y divide-slate-100">
            {meetings.slice(0, 10).map((m, i) => (
              <div key={pickStr(m, 'id') || i} className="py-2.5 flex items-center justify-between gap-3 text-xs">
                <div>
                  <p className="font-bold text-slate-800">{pickStr(m, 'agenda', 'title') || 'SHG Meeting'}</p>
                  <p className="text-[11px] text-slate-400">
                    {formatDateTime(pickStr(m, 'date', 'heldAt', 'createdAt')) || '—'} ·{' '}
                    {formatNumber(pickNum(m, 'attendance', 'attendees'))} attended
                  </p>
                </div>
                {pick(m, 'collections') !== undefined && (
                  <span className="font-bold text-emerald-700">
                    {formatPaisa(pickNum(m, 'collections'))} collected
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

/* --------------------------------------------------------------- Garden */

const GROWTH_STAGES = ['Sowing', 'Sprout', 'Vegetative', 'Flowering', 'Harvest'] as const;

/** Map a plan status onto the 5-step growth tracker index. */
const growthStageIndex = (status: string): number => {
  const s = status.toLowerCase();
  if (['harvest', 'harvesting', 'harvested', 'ready'].includes(s)) return 4;
  if (['flowering', 'budding', 'fruiting'].includes(s)) return 3;
  if (['vegetative', 'growing', 'growth', 'established'].includes(s)) return 2;
  if (['sprout', 'sprouted', 'germinated', 'germination', 'seedling'].includes(s)) return 1;
  return 0; // planned / sowing / planted / unknown
};

const GrowthStepper: React.FC<{ status: string }> = ({ status }) => {
  const current = growthStageIndex(status);
  return (
    <div className="pt-1">
      <div className="flex items-center">
        {GROWTH_STAGES.map((stage, idx) => {
          const reached = idx <= current;
          const active = idx === current;
          return (
            <React.Fragment key={stage}>
              {idx > 0 && (
                <span
                  className={cn(
                    'flex-1 h-0.5 -mx-1 z-0',
                    idx <= current ? 'bg-emerald-500' : 'bg-slate-200'
                  )}
                />
              )}
              <div className="flex flex-col items-center gap-1 z-10">
                <span
                  className={cn(
                    'w-5 h-5 rounded-full border-2 flex items-center justify-center text-[9px] font-black',
                    reached
                      ? 'bg-emerald-500 border-emerald-500 text-white'
                      : 'bg-white border-slate-300 text-slate-400',
                    active && 'ring-4 ring-emerald-100'
                  )}
                >
                  {idx < current ? '✓' : idx + 1}
                </span>
                <span
                  className={cn(
                    'text-[8px] font-bold uppercase tracking-wide whitespace-nowrap',
                    active ? 'text-emerald-700' : reached ? 'text-emerald-600/70' : 'text-slate-400'
                  )}
                >
                  {stage}
                </span>
              </div>
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
};

const CUSTOM_CATEGORY = 'Custom';

const GardenPanel: React.FC<{ flash: (k: 'ok' | 'err', t: string) => void }> = ({ flash }) => {
  const [plans, setPlans] = useState<Record<string, unknown>[]>([]);
  const [templates, setTemplates] = useState<Record<string, unknown>[]>([]);
  const [category, setCategory] = useState('');
  const [selected, setSelected] = useState<Record<string, Record<string, unknown>>>({});
  const [customItem, setCustomItem] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    women
      .gardenPlans()
      .then((rows) => setPlans(asRecords(rows)))
      .catch(() => undefined);
    women
      .gardenTemplates()
      .then((rows) => setTemplates(asRecords(rows)))
      .catch(() => undefined);
  }, []);

  const templateCategories = templates.map((t) => pickStr(t, 'category')).filter(Boolean);
  const activeCategory = category || templateCategories[0] || CUSTOM_CATEGORY;
  const activeTemplate = templates.find((t) => pickStr(t, 'category') === activeCategory);
  const isCustom = !activeTemplate;
  const suggestions = asRecords(pick(activeTemplate ?? {}, 'items'));
  const selectedItems = Object.values(selected);

  const pickCategory = (c: string) => {
    setCategory(c);
    setSelected({});
  };

  const toggleItem = (item: Record<string, unknown>) => {
    const name = pickStr(item, 'name');
    if (!name) return;
    setSelected((prev) => {
      const next = { ...prev };
      if (next[name]) {
        delete next[name];
      } else {
        next[name] = {
          name,
          vernacularName: pickStr(item, 'vernacularName'),
          nutrition: pickStr(item, 'nutrition'),
          companion: pickStr(item, 'companion'),
          daysToHarvest: pickNum(item, 'daysToHarvest'),
        };
      }
      return next;
    });
  };

  const addCustomItem = () => {
    const name = customItem.trim();
    if (!name) return;
    setSelected((prev) => ({ ...prev, [name]: { name, daysToHarvest: 0 } }));
    setCustomItem('');
  };

  const create = async () => {
    if (busy || !activeCategory.trim()) return;
    if (selectedItems.length === 0) {
      flash('err', 'Select at least one crop suggestion (or add a custom item).');
      return;
    }
    setBusy(true);
    try {
      await women.createGardenPlan({
        category: activeCategory.trim(),
        items: selectedItems.map((it) => ({
          name: it.name,
          vernacularName: it.vernacularName || '',
          nutrition: it.nutrition || '',
          companion: it.companion || '',
          daysToHarvest: typeof it.daysToHarvest === 'number' ? it.daysToHarvest : 0,
        })),
      });
      flash('ok', `Garden plan "${activeCategory.trim()}" created with ${selectedItems.length} crops.`);
      setSelected({});
      setCustomItem('');
      const rows = await women.gardenPlans().catch(() => []);
      setPlans(asRecords(rows));
    } catch (err) {
      flash('err', apiErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs p-5 space-y-4 max-w-3xl">
        <div>
          <h3 className="font-bold text-sm text-slate-900 flex items-center gap-1.5">
            <Sprout className="w-4 h-4 text-emerald-600" /> New Kitchen Garden Plan
          </h3>
          <p className="text-[11px] text-slate-400 mt-0.5">
            Pick a category, select crops from the nutrition-smart suggestions, then save the plan.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {[...templateCategories, CUSTOM_CATEGORY].map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => pickCategory(c)}
              className={cn(
                'px-3 py-1.5 rounded-full text-[11px] font-bold border transition-colors',
                activeCategory === c
                  ? 'bg-emerald-600 text-white border-emerald-600'
                  : 'bg-white text-slate-600 border-slate-200 hover:border-emerald-400'
              )}
            >
              {c}
            </button>
          ))}
        </div>

        {!isCustom && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {suggestions.map((item, idx) => {
              const name = pickStr(item, 'name');
              const isSelected = Boolean(selected[name]);
              return (
                <button
                  key={name || idx}
                  type="button"
                  onClick={() => toggleItem(item)}
                  className={cn(
                    'text-left p-3 rounded-2xl border transition-all',
                    isSelected
                      ? 'border-emerald-500 bg-emerald-50/70 ring-2 ring-emerald-500/20'
                      : 'border-slate-200 bg-white hover:border-emerald-300'
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-bold text-slate-900">
                      {name}
                      {pickStr(item, 'vernacularName') && (
                        <span className="text-slate-400 font-semibold"> · {pickStr(item, 'vernacularName')}</span>
                      )}
                    </span>
                    {pickNum(item, 'daysToHarvest') > 0 && (
                      <span className="flex-shrink-0 px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-sky-50 text-sky-700 border border-sky-200">
                        ~{pickNum(item, 'daysToHarvest')} days
                      </span>
                    )}
                  </div>
                  {pickStr(item, 'nutrition') && (
                    <p className="text-[10px] text-slate-500 mt-1">Nutrition: {pickStr(item, 'nutrition')}</p>
                  )}
                  {pickStr(item, 'companion') && (
                    <p className="text-[10px] text-emerald-700/80 mt-1 font-semibold">
                      Companion: {pickStr(item, 'companion')}
                    </p>
                  )}
                </button>
              );
            })}
          </div>
        )}

        {isCustom && (
          <div className="flex gap-2">
            <input
              type="text"
              value={customItem}
              onChange={(e) => setCustomItem(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  addCustomItem();
                }
              }}
              placeholder="Crop name (e.g. Methi)"
              className="flex-1 px-3 py-2.5 text-xs rounded-xl border border-slate-300 focus:outline-none focus:border-emerald-600"
            />
            <button
              type="button"
              onClick={addCustomItem}
              disabled={!customItem.trim()}
              className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 disabled:opacity-40 text-slate-700 text-xs font-bold rounded-xl transition-colors"
            >
              Add
            </button>
          </div>
        )}

        {selectedItems.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {selectedItems.map((it) => (
              <span
                key={String(it.name)}
                className="px-2 py-1 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 flex items-center gap-1"
              >
                {String(it.name)}
                <button
                  type="button"
                  onClick={() => toggleItem(it)}
                  className="text-emerald-700 hover:text-emerald-900 font-black"
                  title="Remove"
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        )}

        <button
          onClick={() => void create()}
          disabled={busy || selectedItems.length === 0}
          className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white font-bold text-xs rounded-xl shadow-xs"
        >
          {busy ? 'Saving…' : `Create Plan${selectedItems.length > 0 ? ` (${selectedItems.length} crops)` : ''}`}
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {plans.length === 0 && (
          <p className="text-xs text-slate-400 bg-white rounded-3xl border border-slate-200/80 p-6 text-center sm:col-span-2">
            No garden plans yet — plan your first patch above.
          </p>
        )}
        {plans.map((p, i) => {
          const items = asRecords(pick(p, 'items'));
          return (
            <div key={pickStr(p, 'id') || i} className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-xs space-y-2">
              <div className="flex items-center justify-between">
                <h4 className="font-bold text-sm text-slate-900">
                  {pickStr(p, 'category') || pickStr(p, 'title') || 'Garden plan'}
                </h4>
                <StatusBadge status={pickStr(p, 'status', 'season') || 'planned'} />
              </div>
              <GrowthStepper status={pickStr(p, 'status', 'season') || 'planned'} />
              {items.length > 0 ? (
                <ul className="space-y-1.5 pt-1">
                  {items.map((it, j) => (
                    <li key={pickStr(it, 'name') || j} className="text-[11px] text-slate-600 leading-relaxed">
                      <span className="font-bold text-slate-800">
                        {pickStr(it, 'name')}
                        {pickStr(it, 'vernacularName') && (
                          <span className="text-slate-400 font-semibold"> · {pickStr(it, 'vernacularName')}</span>
                        )}
                      </span>
                      {pickNum(it, 'daysToHarvest') > 0 && (
                        <span className="ml-1.5 px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-sky-50 text-sky-700 border border-sky-200">
                          ~{pickNum(it, 'daysToHarvest')} days
                        </span>
                      )}
                      {pickStr(it, 'nutrition') && <div className="text-slate-500">Nutrition: {pickStr(it, 'nutrition')}</div>}
                      {pickStr(it, 'companion') && (
                        <div className="text-emerald-700/80 font-semibold">Companion: {pickStr(it, 'companion')}</div>
                      )}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs text-slate-500">
                  {pickStr(p, 'crop') || pickStr(p, 'cropName') || 'Mixed vegetables'} · {pickNum(p, 'areaSqm', 'area')} sq m
                </p>
              )}
              {pickStr(p, 'notes', 'tips') && (
                <p className="text-[11px] text-slate-400 leading-relaxed">{pickStr(p, 'notes', 'tips')}</p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

/* ------------------------------------------------------------ Livestock */

const LivestockPanel: React.FC = () => {
  const [animals, setAnimals] = useState<Record<string, unknown>[]>([]);

  useEffect(() => {
    women
      .backyardLivestock()
      .then((rows) => setAnimals(asRecords(rows)))
      .catch(() => undefined);
  }, []);

  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(
    today.getDate()
  ).padStart(2, '0')}`;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {animals.length === 0 && (
        <p className="text-xs text-slate-400 bg-white rounded-3xl border border-slate-200/80 p-6 text-center sm:col-span-2 lg:col-span-3">
          No backyard livestock registered — poultry, goats, and cattle tracked here earn extra women-mode rewards.
        </p>
      )}
      {animals.map((a, i) => {
        const dueRaw = pickStr(a, 'vaccineDue', 'nextVaccineDue');
        const overdue = !!dueRaw && dueRaw.slice(0, 10) < todayStr;
        return (
          <div key={pickStr(a, 'id') || i} className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-xs space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="font-bold text-sm text-slate-900 flex items-center gap-1.5">
                <Egg className="w-4 h-4 text-amber-500" /> {pickStr(a, 'type', 'species', 'animal') || 'Livestock'}
              </h4>
              <span className="text-xs font-black text-slate-700">× {pickNum(a, 'count', 'quantity') || 1}</span>
            </div>
            <p className="text-xs text-slate-500">
              {pickStr(a, 'breed') || pickStr(a, 'vernacularName') || '—'} · {pickStr(a, 'purpose') || pickStr(a, 'category') || 'Backyard rearing'}
            </p>
            {pickNum(a, 'dailyYield') > 0 && (
              <p className="text-[11px] text-emerald-700 font-bold">
                ≈ {pickNum(a, 'dailyYield')} {pickStr(a, 'yieldUnit') || 'eggs/litres'} per day
              </p>
            )}
            {dueRaw && (
              <div
                className={cn(
                  'flex items-center gap-2 text-[11px] font-bold p-2 rounded-xl border',
                  overdue
                    ? 'bg-rose-50 border-rose-200 text-rose-800'
                    : 'bg-amber-50 border-amber-200 text-amber-800'
                )}
              >
                <Syringe className={cn('w-3.5 h-3.5 flex-shrink-0', overdue ? 'text-rose-500' : 'text-amber-500')} />
                <span>
                  {pickStr(a, 'vaccine') || 'Vaccination'} due {formatDate(dueRaw) || dueRaw}
                  {overdue && <span className="block text-[9px] uppercase tracking-wide">Overdue — vaccinate today</span>}
                </span>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

/* ---------------------------------------------------------------- Gruh */

const GRUH_CATEGORIES = [
  'Papad & Fryums',
  'Pickles & Chutneys',
  'Spices & Masala',
  'Dairy & Sweets',
  'Grains & Flours',
  'Handicrafts',
  'Textiles & Apparel',
  'Bamboo & Cane',
  'Candles & Diyas',
  'Herbal & Cosmetics',
  'Other',
];

const BATCH_STATUSES = ['sold_out', 'expired'];

const GruhPanel: React.FC<{ flash: (k: 'ok' | 'err', t: string) => void }> = ({ flash }) => {
  const [units, setUnits] = useState<Record<string, unknown>[]>([]);
  const [unitId, setUnitId] = useState<string | null>(null);
  const [unitDetail, setUnitDetail] = useState<Record<string, unknown>>({});
  const [dashboard, setDashboard] = useState<Record<string, unknown>>({});
  const [enterprise, setEnterprise] = useState<Record<string, unknown>>({});
  const [products, setProducts] = useState<Record<string, unknown>[]>([]);
  const [orders, setOrders] = useState<Record<string, unknown>[]>([]);
  const [offers, setOffers] = useState<Record<string, unknown>[]>([]);
  const [certs, setCerts] = useState<Record<string, unknown>[]>([]);
  const [newUnitName, setNewUnitName] = useState('');
  const [profileOpen, setProfileOpen] = useState(false);
  const [uName, setUName] = useState('');
  const [uDesc, setUDesc] = useState('');
  const [uVillage, setUVillage] = useState('');
  const [uDistrict, setUDistrict] = useState('');
  const [uState, setUState] = useState('');
  const [showAddProduct, setShowAddProduct] = useState(false);
  const [prodName, setProdName] = useState('');
  const [prodCategory, setProdCategory] = useState(GRUH_CATEGORIES[0]);
  const [prodMrp, setProdMrp] = useState('');
  const [prodPrice, setProdPrice] = useState('');
  const [prodStock, setProdStock] = useState('10');
  const [prodVernacular, setProdVernacular] = useState('');
  const [prodDescription, setProdDescription] = useState('');
  const [prodUnit, setProdUnit] = useState('');
  const [prodShelfLife, setProdShelfLife] = useState('');
  const [prodIsVeg, setProdIsVeg] = useState(true);
  const [prodImages, setProdImages] = useState<string[]>([]);
  const [prodUploading, setProdUploading] = useState(false);
  const [certFormOpen, setCertFormOpen] = useState(false);
  const [certType, setCertType] = useState('fssai');
  const [certNumber, setCertNumber] = useState('');
  const [certAuthority, setCertAuthority] = useState('');
  const [certValidUntil, setCertValidUntil] = useState('');
  const [certDoc, setCertDoc] = useState<File | null>(null);
  const [certUploading, setCertUploading] = useState(false);
  const [earnings, setEarnings] = useState<Record<string, unknown>>({});
  const [payoutAmount, setPayoutAmount] = useState('');
  const [payoutMpin, setPayoutMpin] = useState('');
  const [payoutBusy, setPayoutBusy] = useState(false);
  const [batchFor, setBatchFor] = useState<string | null>(null);
  const [batchNo, setBatchNo] = useState('');
  const [batchQty, setBatchQty] = useState('10');
  const [batchProduced, setBatchProduced] = useState('');
  const [batchExpiry, setBatchExpiry] = useState('');
  const [batchDetail, setBatchDetail] = useState<Record<string, unknown>>({});
  const [offerFor, setOfferFor] = useState<string | null>(null);
  const [offerTitle, setOfferTitle] = useState('');
  const [offerPct, setOfferPct] = useState('10');
  const [offerFrom, setOfferFrom] = useState('');
  const [offerUntil, setOfferUntil] = useState('');
  const [busy, setBusy] = useState<string | null>(null);

  const activeUnit = units.find((u) => pickStr(u, 'id') === unitId) ?? unitDetail;
  const unitStatus = pickStr(activeUnit, 'status') || 'active';

  const loadUnits = async () => {
    const rows = await gruhUdyog.myUnits().catch(() => []);
    const list = asRecords(rows);
    setUnits(list);
    if (list.length > 0 && !unitId) {
      setUnitId(pickStr(list[0], 'id'));
    }
  };

  useEffect(() => {
    void loadUnits();
    // Home-enterprise income lines (independent of gruh udyog units).
    women
      .homeEnterprise()
      .then((res) => setEnterprise(asRecord(res)))
      .catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!unitId) return;
    let alive = true;
    const load = async () => {
      const [u, d, p, o, off, c, e] = await Promise.all([
        gruhUdyog.unit(unitId).catch(() => ({})),
        gruhUdyog.unitDashboard(unitId).catch(() => ({})),
        gruhUdyog.products(unitId).catch(() => []),
        gruhUdyog.unitOrders(unitId).catch(() => []),
        gruhUdyog.offers(unitId).catch(() => []),
        gruhUdyog.certifications(unitId).catch(() => []),
        gruhUdyog.settlements(unitId).catch(() => ({})),
      ]);
      if (!alive) return;
      setUnitDetail(asRecord(u));
      setDashboard(asRecord(d));
      setProducts(asRecords(p));
      setOrders(asRecords(o));
      setOffers(asRecords(off));
      setCerts(asRecords(c));
      setEarnings(asRecord(e));
    };
    void load();
    return () => {
      alive = false;
    };
  }, [unitId]);

  const openProfile = () => {
    setUName(pickStr(activeUnit, 'name'));
    setUDesc(pickStr(activeUnit, 'description'));
    setUVillage(pickStr(activeUnit, 'village'));
    setUDistrict(pickStr(activeUnit, 'district'));
    setUState(pickStr(activeUnit, 'state'));
    setProfileOpen((o) => !o);
  };

  const saveProfile = async () => {
    if (!unitId || busy) return;
    setBusy('profile');
    try {
      const updated = await gruhUdyog.updateUnit(unitId, {
        name: uName.trim() || undefined,
        description: uDesc.trim() || undefined,
        village: uVillage.trim() || undefined,
        district: uDistrict.trim() || undefined,
        state: uState.trim() || undefined,
      });
      setUnitDetail(asRecord(updated));
      flash('ok', 'Unit profile updated.');
      setProfileOpen(false);
      await loadUnits();
    } catch (err) {
      flash('err', apiErrorMessage(err));
    } finally {
      setBusy(null);
    }
  };

  const toggleUnitStatus = async () => {
    if (!unitId || busy) return;
    const pausing = unitStatus !== 'paused';
    setBusy('unit-status');
    try {
      const updated = pausing
        ? await gruhUdyog.pauseUnit(unitId)
        : await gruhUdyog.resumeUnit(unitId);
      setUnitDetail(asRecord(updated));
      flash('ok', pausing ? 'Unit paused — products are hidden from the mall.' : 'Unit resumed — you can publish and sell again.');
      await loadUnits();
    } catch (err) {
      flash('err', apiErrorMessage(err));
    } finally {
      setBusy(null);
    }
  };

  const openBatches = async (productId: string) => {
    if (batchFor === productId) {
      setBatchFor(null);
      return;
    }
    setBatchFor(productId);
    setOfferFor(null);
    try {
      const res = await gruhUdyog.product(productId);
      setBatchDetail(asRecord(res));
    } catch {
      setBatchDetail({});
    }
  };

  const refreshBatches = async (productId: string) => {
    try {
      const res = await gruhUdyog.product(productId);
      setBatchDetail(asRecord(res));
    } catch {
      setBatchDetail({});
    }
  };

  const addBatch = async (productId: string) => {
    if (!batchQty.trim() || !batchProduced || busy) return;
    setBusy('batch');
    try {
      await gruhUdyog.addBatch(productId, {
        batchNo: batchNo.trim() || undefined,
        quantity: Number(batchQty) || 0,
        productionDate: batchProduced,
        expiryDate: batchExpiry || undefined,
      });
      flash('ok', `Batch ${batchNo.trim() || 'added'} recorded for traceability.`);
      setBatchNo('');
      setBatchQty('10');
      setBatchProduced('');
      setBatchExpiry('');
      await refreshBatches(productId);
    } catch (err) {
      flash('err', apiErrorMessage(err));
    } finally {
      setBusy(null);
    }
  };

  const setBatchStatus = async (batchId: string, productId: string, status: string) => {
    if (busy) return;
    setBusy(batchId);
    try {
      await gruhUdyog.updateBatchStatus(batchId, status);
      flash('ok', `Batch marked ${status.replace('_', ' ')}.`);
      await refreshBatches(productId);
    } catch (err) {
      flash('err', apiErrorMessage(err));
    } finally {
      setBusy(null);
    }
  };

  const openOffer = (productId: string) => {
    setOfferFor((cur) => (cur === productId ? null : productId));
    setBatchFor(null);
  };

  const addOffer = async (productId: string) => {
    if (!offerTitle.trim() || !offerFrom || !offerUntil || busy) return;
    setBusy('offer');
    try {
      await gruhUdyog.addOffer(productId, {
        title: offerTitle.trim(),
        discountPercent: Number(offerPct) || 10,
        validFrom: offerFrom,
        validUntil: offerUntil,
      });
      flash('ok', `Offer "${offerTitle.trim()}" is live — the mall price updates automatically.`);
      setOfferTitle('');
      setOfferPct('10');
      setOfferFrom('');
      setOfferUntil('');
      setOfferFor(null);
      const off = await gruhUdyog.offers(unitId ?? '').catch(() => []);
      setOffers(asRecords(off));
    } catch (err) {
      flash('err', apiErrorMessage(err));
    } finally {
      setBusy(null);
    }
  };

  const removeOffer = async (offerId: string) => {
    if (busy) return;
    setBusy(offerId);
    try {
      await gruhUdyog.removeOffer(offerId);
      flash('ok', 'Offer removed — mall price reverts to the regular selling price.');
      setOffers((prev) => prev.filter((o) => pickStr(o, 'id', 'offerId') !== offerId));
    } catch (err) {
      flash('err', apiErrorMessage(err));
    } finally {
      setBusy(null);
    }
  };

  const run = async (key: string, fn: () => Promise<unknown>, okMsg: string, reload = true) => {
    if (busy) return;
    setBusy(key);
    try {
      await fn();
      if (okMsg) flash('ok', okMsg);
      if (reload && unitId) {
        const [p, o] = await Promise.all([
          gruhUdyog.products(unitId).catch(() => []),
          gruhUdyog.unitOrders(unitId).catch(() => []),
        ]);
        setProducts(asRecords(p));
        setOrders(asRecords(o));
      }
    } catch (err) {
      flash('err', apiErrorMessage(err));
    } finally {
      setBusy(null);
    }
  };

  const createUnit = async () => {
    if (!newUnitName.trim() || busy) return;
    setBusy('unit');
    try {
      const res = await gruhUdyog.createUnit({ name: newUnitName.trim(), category: 'Other' });
      flash('ok', `Gruh Udyog unit "${newUnitName.trim()}" registered.`);
      setNewUnitName('');
      const rec = asRecord(res);
      const id = pickStr(rec, 'id') || pickStr(asRecord(pick(rec, 'unit')), 'id');
      await loadUnits();
      if (id) setUnitId(id);
    } catch (err) {
      flash('err', apiErrorMessage(err));
    } finally {
      setBusy(null);
    }
  };

  const addProduct = async () => {
    if (!unitId || !prodName.trim() || busy) return;
    setBusy('product');
    try {
      const mrp = Number(prodMrp) || Number(prodPrice) || 0;
      const price = Number(prodPrice) || mrp;
      await gruhUdyog.addProduct(unitId, {
        title: prodName.trim(),
        vernacularTitle: prodVernacular.trim() || undefined,
        category: prodCategory,
        description: prodDescription.trim() || undefined,
        mrp,
        price,
        stock: Number(prodStock) || 0,
        unit: prodUnit.trim() || undefined,
        shelfLifeDays: Number(prodShelfLife) || 0,
        isVeg: prodIsVeg,
        imageUrls: prodImages,
      });
      flash('ok', `"${prodName.trim()}" added to your catalogue. Publish it to list on the Krishi Mall.`);
      setProdName('');
      setProdMrp('');
      setProdPrice('');
      setProdStock('10');
      setProdVernacular('');
      setProdDescription('');
      setProdUnit('');
      setProdShelfLife('');
      setProdIsVeg(true);
      setProdImages([]);
      setShowAddProduct(false);
      const p = await gruhUdyog.products(unitId).catch(() => []);
      setProducts(asRecords(p));
    } catch (err) {
      flash('err', apiErrorMessage(err));
    } finally {
      setBusy(null);
    }
  };

  const addProductImage = async (file: File | null) => {
    if (!file || prodUploading) return;
    setProdUploading(true);
    try {
      const uploaded = (await uploads.upload(file, { folder: 'gruh', purpose: 'product-image' })) as {
        url?: string;
        fileUrl?: string;
      };
      const url = uploaded?.url ?? uploaded?.fileUrl ?? '';
      if (url) setProdImages((prev) => [...prev, url]);
    } catch (err) {
      flash('err', apiErrorMessage(err));
    } finally {
      setProdUploading(false);
    }
  };

  const submitCertification = async () => {
    if (!unitId || !certNumber.trim() || busy) return;
    setBusy('cert');
    setCertUploading(true);
    try {
      let documentUrl = '';
      if (certDoc) {
        const uploaded = (await uploads.upload(certDoc, {
          folder: 'gruh',
          purpose: 'certification-document',
        })) as { url?: string; fileUrl?: string };
        documentUrl = uploaded?.url ?? uploaded?.fileUrl ?? '';
      }
      await gruhUdyog.addCertification(unitId, {
        type: certType,
        number: certNumber.trim(),
        issuingAuthority: certAuthority.trim() || undefined,
        validUntil: certValidUntil || undefined,
        documentUrl: documentUrl || undefined,
      });
      flash(
        'ok',
        'Certification submitted — verification pending. You can publish food products with a visible pending badge.'
      );
      setCertNumber('');
      setCertAuthority('');
      setCertValidUntil('');
      setCertDoc(null);
      setCertFormOpen(false);
      const c = await gruhUdyog.certifications(unitId).catch(() => []);
      setCerts(asRecords(c));
    } catch (err) {
      flash('err', apiErrorMessage(err));
    } finally {
      setBusy(null);
      setCertUploading(false);
    }
  };

  const requestPayout = async () => {
    const rupees = Number(payoutAmount);
    if (!unitId || !rupees || rupees <= 0 || payoutMpin.length !== 4 || payoutBusy) return;
    setPayoutBusy(true);
    try {
      const payout = asRecord(
        await gruhUdyog.requestPayout({
          unitId,
          amountPaisa: Math.round(rupees * 100),
          mpin: payoutMpin,
        })
      );
      flash(
        'ok',
        payout.status === 'processed'
          ? `Payout of ${formatCurrency(rupees)} processed to your bank.`
          : 'Payout request received — it will be processed after review.'
      );
      setPayoutAmount('');
      setPayoutMpin('');
      const e = await gruhUdyog.settlements(unitId).catch(() => ({}));
      setEarnings(asRecord(e));
    } catch (err) {
      flash('err', apiErrorMessage(err));
    } finally {
      setPayoutBusy(false);
    }
  };

  if (units.length === 0) {
    return (
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs p-6 max-w-xl space-y-4">
        <h3 className="font-bold text-sm text-slate-900 flex items-center gap-1.5">
          <Home className="w-4 h-4 text-pink-600" /> Register Your Home Enterprise
        </h3>
        <p className="text-xs text-slate-500">
          A Gruh Udyog unit lets SHG women list papad, masala, ghee, pickles and handicrafts directly on the Krishi Mall — zero brokerage.
        </p>
        <div className="flex gap-2">
          <input
            type="text"
            value={newUnitName}
            onChange={(e) => setNewUnitName(e.target.value)}
            placeholder="Unit name (e.g. Laxmi Papad Udyog)"
            className="flex-1 px-3 py-2.5 text-xs rounded-xl border border-slate-300 focus:outline-none focus:border-pink-600"
          />
          <button
            onClick={() => void createUnit()}
            disabled={!newUnitName.trim() || busy === 'unit'}
            className="px-4 py-2.5 bg-pink-600 hover:bg-pink-700 disabled:opacity-40 text-white font-bold text-xs rounded-xl shadow-xs"
          >
            {busy === 'unit' ? 'Registering…' : 'Register'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Unit switcher + dashboard */}
      <div className="flex flex-wrap items-center gap-2">
        {units.map((u) => {
          const id = pickStr(u, 'id');
          return (
            <button
              key={id}
              onClick={() => setUnitId(id)}
              className={cn(
                'px-4 py-2 rounded-2xl text-xs font-bold border transition-colors',
                unitId === id
                  ? 'bg-pink-600 text-white border-pink-600'
                  : 'bg-white text-slate-600 border-slate-200 hover:border-pink-300'
              )}
            >
              {pickStr(u, 'name') || 'Unit'}
            </button>
          );
        })}
      </div>

      {/* Unit profile */}
      {Object.keys(activeUnit).length > 0 && (
        <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs p-5 space-y-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className="font-extrabold text-sm text-slate-900 flex items-center gap-2">
                {pickStr(activeUnit, 'name') || 'Unit'}
                <StatusBadge status={unitStatus} />
              </h3>
              <p className="text-[11px] text-slate-400 capitalize">
                {pickStr(activeUnit, 'category') || 'Home enterprise'}
                {pickStr(activeUnit, 'shgName') ? ` · ${pickStr(activeUnit, 'shgName')} SHG` : ''}
              </p>
              {pickStr(activeUnit, 'description') && (
                <p className="text-xs text-slate-600 mt-1">{pickStr(activeUnit, 'description')}</p>
              )}
              <p className="text-[11px] text-slate-400 mt-0.5">
                {[pickStr(activeUnit, 'village'), pickStr(activeUnit, 'district'), pickStr(activeUnit, 'state')]
                  .filter(Boolean)
                  .join(', ') || 'Location not set'}
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={openProfile}
                className="px-3 py-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-[11px] font-bold rounded-xl"
              >
                Edit Profile
              </button>
              <button
                onClick={() => void toggleUnitStatus()}
                disabled={busy === 'unit-status'}
                className={cn(
                  'px-3 py-1.5 text-[11px] font-bold rounded-xl disabled:opacity-40',
                  unitStatus === 'paused'
                    ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                    : 'bg-amber-50 border border-amber-200 text-amber-700'
                )}
              >
                {unitStatus === 'paused' ? 'Resume Unit' : 'Pause Unit'}
              </button>
            </div>
          </div>

          {profileOpen && (
            <div className="p-3 rounded-2xl border border-pink-100 bg-pink-50/50 grid grid-cols-1 sm:grid-cols-2 gap-2">
              <input
                type="text"
                value={uName}
                onChange={(e) => setUName(e.target.value)}
                placeholder="Unit name"
                className="px-3 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:border-pink-600"
              />
              <input
                type="text"
                value={uVillage}
                onChange={(e) => setUVillage(e.target.value)}
                placeholder="Village"
                className="px-3 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:border-pink-600"
              />
              <input
                type="text"
                value={uDistrict}
                onChange={(e) => setUDistrict(e.target.value)}
                placeholder="District"
                className="px-3 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:border-pink-600"
              />
              <input
                type="text"
                value={uState}
                onChange={(e) => setUState(e.target.value)}
                placeholder="State"
                className="px-3 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:border-pink-600"
              />
              <textarea
                value={uDesc}
                onChange={(e) => setUDesc(e.target.value)}
                rows={2}
                placeholder="What does your unit make? (shows on the mall)"
                className="sm:col-span-2 px-3 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:border-pink-600"
              />
              <button
                onClick={() => void saveProfile()}
                disabled={busy === 'profile' || !uName.trim()}
                className="sm:col-span-2 px-3 py-2 bg-pink-600 hover:bg-pink-700 disabled:opacity-40 text-white text-[11px] font-bold rounded-xl"
              >
                {busy === 'profile' ? 'Saving…' : 'Save Profile'}
              </button>
            </div>
          )}
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Total Sales', value: formatCurrency(pickNum(dashboard, 'totalSales', 'revenue')), icon: IndianRupee },
          { label: 'Orders', value: formatNumber(pickNum(dashboard, 'orders', 'orderCount')), icon: ClipboardList },
          { label: 'Products Live', value: formatNumber(products.length), icon: Package },
          { label: 'Live Offers', value: formatNumber(offers.length), icon: BadgePercent },
        ].map((s) => (
          <div key={s.label} className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-xs">
            <s.icon className="w-4 h-4 text-pink-600 mb-1.5" />
            <p className="text-lg font-black text-slate-900">{s.value}</p>
            <p className="text-[10px] uppercase font-bold text-slate-400">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Earnings & payouts — delivered-order settlements minus commission */}
      {(() => {
        const balance = asRecord(pick(earnings, 'balance'));
        const lines = asRecords(pick(earnings, 'lines'));
        const payouts = asRecords(pick(earnings, 'payouts'));
        const available = pickNum(balance, 'availablePaisa');
        return (
          <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs p-5 space-y-3">
            <h4 className="font-bold text-xs text-slate-900 flex items-center gap-1.5">
              <IndianRupee className="w-4 h-4 text-emerald-600" /> Earnings &amp; Payouts
            </h4>
            <div className="flex flex-wrap items-end gap-6">
              <div>
                <p className="text-2xl font-black text-emerald-700">{formatPaisa(available)}</p>
                <p className="text-[10px] uppercase font-bold text-slate-400">Available balance</p>
              </div>
              <div>
                <p className="text-sm font-black text-slate-800">{formatPaisa(pickNum(balance, 'revenuePaisa'))}</p>
                <p className="text-[10px] uppercase font-bold text-slate-400">Delivered revenue</p>
              </div>
              <div>
                <p className="text-sm font-black text-slate-800">{formatPaisa(pickNum(balance, 'commissionPaisa'))}</p>
                <p className="text-[10px] uppercase font-bold text-slate-400">Platform commission</p>
              </div>
              <div>
                <p className="text-sm font-black text-slate-800">{formatPaisa(pickNum(balance, 'paidOutPaisa'))}</p>
                <p className="text-[10px] uppercase font-bold text-slate-400">Paid out</p>
              </div>
            </div>

            {lines.length === 0 ? (
              <p className="text-xs text-slate-400">
                No earnings yet — settlements appear here when an order is marked delivered.
              </p>
            ) : (
              <div className="divide-y divide-slate-100">
                {lines.slice(0, 10).map((line, i) => (
                  <div key={pickStr(line, 'id') || i} className="py-2 flex items-center justify-between gap-3 text-xs">
                    <div>
                      <p className="font-bold text-slate-800">
                        Order {String(pickStr(line, 'orderId') || '').slice(0, 14) || `#${i + 1}`}
                      </p>
                      <p className="text-[11px] text-slate-400">
                        {pickStr(line, 'period') || ''} · commission {pickNum(line, 'commissionPct')}%
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-emerald-700">+{formatPaisa(pickNum(line, 'netPaisa'))}</p>
                      <p className="text-[10px] text-slate-400">
                        gross {formatPaisa(pickNum(line, 'revenuePaisa'))} − {formatPaisa(pickNum(line, 'commissionPaisa'))}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="flex flex-wrap items-center gap-2 pt-1">
              <input
                type="number"
                min={1}
                value={payoutAmount}
                onChange={(e) => setPayoutAmount(e.target.value)}
                placeholder="Payout amount (₹)"
                className="px-3 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:border-pink-600 w-40"
              />
              <input
                type="password"
                inputMode="numeric"
                maxLength={4}
                value={payoutMpin}
                onChange={(e) => setPayoutMpin(e.target.value.replace(/\D/g, '').slice(0, 4))}
                placeholder="MPIN (4 digits)"
                className="px-3 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:border-pink-600 w-32"
              />
              <button
                onClick={() => void requestPayout()}
                disabled={
                  payoutBusy ||
                  !(Number(payoutAmount) > 0) ||
                  payoutMpin.length !== 4 ||
                  Math.round((Number(payoutAmount) || 0) * 100) > available
                }
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white text-[11px] font-bold rounded-xl"
              >
                {payoutBusy ? 'Requesting…' : 'Request Payout'}
              </button>
            </div>
            <p className="text-[10px] text-slate-400">
              Payouts move the available balance to your bank and are confirmed with your 4-digit MPIN.
            </p>

            {payouts.length > 0 && (
              <div className="divide-y divide-slate-100">
                {payouts.slice(0, 5).map((p, i) => (
                  <div key={pickStr(p, 'id') || i} className="py-2 flex items-center justify-between gap-3 text-xs">
                    <div>
                      <p className="font-bold text-slate-800">{formatPaisa(pickNum(p, 'amountPaisa'))}</p>
                      <p className="text-[11px] text-slate-400">
                        requested {formatDateTime(pickStr(p, 'requestedAt')) || '—'}
                      </p>
                    </div>
                    <StatusBadge status={pickStr(p, 'status') || 'pending'} />
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })()}

      {/* Home enterprise monthly profit */}
      {(() => {
        const lines = asRecords(pick(enterprise, 'lines'));
        const totalPaisa = pickNum(enterprise, 'totalMonthlyProfitPaisa');
        if (lines.length === 0 && totalPaisa <= 0) return null;
        return (
          <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs p-5 space-y-3">
            <h4 className="font-bold text-xs text-slate-900 flex items-center gap-1.5">
              <IndianRupee className="w-4 h-4 text-emerald-600" /> Home Enterprise — Monthly Profit
            </h4>
            <p className="text-xl font-black text-emerald-700">{formatPaisa(totalPaisa)}</p>
            <div className="divide-y divide-slate-100">
              {lines.map((line, i) => {
                const revenuePaisa = pickNum(line, 'revenuePaisa', 'revenue');
                const costPaisa = pickNum(line, 'costPaisa', 'cost');
                const profitPaisa = pickNum(line, 'monthlyProfitPaisa', 'profitPaisa');
                return (
                  <div key={pickStr(line, 'id') || i} className="py-2 flex items-center justify-between gap-3 text-xs">
                    <div>
                      <p className="font-bold text-slate-800">{pickStr(line, 'product', 'name', 'title') || 'Income line'}</p>
                      <p className="text-[11px] text-slate-400">
                        {pickStr(line, 'month') || formatDate(pickStr(line, 'createdAt')) || '—'}
                        {revenuePaisa > 0 && ` · ${formatPaisa(revenuePaisa)} − ${formatPaisa(costPaisa)}`}
                      </p>
                    </div>
                    <span className="font-bold text-emerald-700">+{formatPaisa(profitPaisa)}</span>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })()}

      {/* Orders */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs p-5 space-y-3">
        <h4 className="font-bold text-xs text-slate-900">Orders</h4>
        {orders.length === 0 ? (
          <p className="text-xs text-slate-400">No orders yet — share your catalogue in the village WhatsApp groups.</p>
        ) : (
          <div className="space-y-2">
            {orders.map((o, i) => {
              const id = pickStr(o, 'orderId', 'id') || String(i);
              const fulfillment = asRecord(pick(o, 'fulfillment'));
              const status = pickStr(fulfillment, 'status') || 'placed';
              const items = asRecords(pick(o, 'items'));
              const quantity = items.reduce((sum, item) => sum + (pickNum(item, 'quantity') || 0), 0);
              return (
                <div key={id} className="p-3 rounded-2xl border border-slate-100 bg-slate-50/60 space-y-2">
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <div>
                      <p className="font-bold text-slate-800">
                        Order {id.length > 14 ? `${id.slice(0, 14)}…` : id}
                        {quantity > 0 ? ` · ${formatNumber(quantity)} item${quantity === 1 ? '' : 's'}` : ''}
                      </p>
                      <p className="text-[11px] text-slate-400">
                        {pickStr(o, 'buyerName', 'customer') || 'Krishi Mall customer'} ·{' '}
                        {formatDateTime(pickStr(o, 'createdAt')) || '—'}
                      </p>
                    </div>
                    <StatusBadge status={status} />
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {status === 'placed' && (
                      <>
                        <button
                          onClick={() =>
                            void run(`a-${id}`, () => gruhUdyog.acceptOrder(id), 'Order accepted — buyer has been notified.')
                          }
                          disabled={busy !== null}
                          className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white text-[11px] font-bold rounded-xl"
                        >
                          Accept
                        </button>
                        <button
                          onClick={() => {
                            const reason = window.prompt('Why are you rejecting this order? (shared with the buyer)') || '';
                            if (!reason.trim()) return;
                            void run(`r-${id}`, () => gruhUdyog.rejectOrder(id, reason.trim()), 'Order rejected — the buyer has been told.');
                          }}
                          disabled={busy !== null}
                          className="px-3 py-1.5 bg-rose-50 border border-rose-200 text-rose-700 text-[11px] font-bold rounded-xl"
                        >
                          Reject
                        </button>
                      </>
                    )}
                    {status === 'accepted' && (
                      <>
                        <button
                          onClick={() =>
                            void run(`p-${id}`, () => gruhUdyog.updateOrderStatus(id, 'packed'), 'Order marked as packed.')
                          }
                          disabled={busy !== null}
                          className="px-3 py-1.5 bg-sky-600 hover:bg-sky-700 disabled:opacity-40 text-white text-[11px] font-bold rounded-xl"
                        >
                          Mark Packed
                        </button>
                        <button
                          onClick={() => {
                            const reason = window.prompt('Cancel this order before packing? Reason (optional):') || '';
                            void run(`c-${id}`, () => gruhUdyog.cancelOrder(id, reason.trim()), 'Order cancelled — stock restored.');
                          }}
                          disabled={busy !== null}
                          className="px-3 py-1.5 bg-rose-50 border border-rose-200 text-rose-700 text-[11px] font-bold rounded-xl"
                        >
                          Cancel
                        </button>
                      </>
                    )}
                    {status === 'packed' && (
                      <button
                        onClick={() =>
                          void run(`s-${id}`, () => gruhUdyog.updateOrderStatus(id, 'shipped'), 'Order marked as shipped.')
                        }
                        disabled={busy !== null}
                        className="px-3 py-1.5 bg-sky-600 hover:bg-sky-700 disabled:opacity-40 text-white text-[11px] font-bold rounded-xl"
                      >
                        Mark Shipped
                      </button>
                    )}
                    {status === 'shipped' && (
                      <button
                        onClick={() =>
                          void run(`d-${id}`, () => gruhUdyog.updateOrderStatus(id, 'delivered'), 'Order marked as delivered.')
                        }
                        disabled={busy !== null}
                        className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white text-[11px] font-bold rounded-xl"
                      >
                        Mark Delivered
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Products */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs p-5 space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="font-bold text-xs text-slate-900">Products</h4>
          <button
            onClick={() => setShowAddProduct((s) => !s)}
            className="px-3 py-1.5 bg-pink-600 hover:bg-pink-700 text-white text-[11px] font-bold rounded-xl flex items-center gap-1"
          >
            <Plus className="w-3.5 h-3.5" /> Add Product
          </button>
        </div>

        {showAddProduct && (
          <div className="p-3 rounded-2xl border border-pink-100 bg-pink-50/50 grid grid-cols-1 sm:grid-cols-2 gap-2">
            <input
              type="text"
              value={prodName}
              onChange={(e) => setProdName(e.target.value)}
              placeholder="Product name (e.g. Methi Papad 200g)"
              className="px-3 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:border-pink-600"
            />
            <input
              type="text"
              value={prodVernacular}
              onChange={(e) => setProdVernacular(e.target.value)}
              placeholder="Vernacular title (मराठी / हिंदी)"
              className="px-3 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:border-pink-600"
            />
            <select
              value={prodCategory}
              onChange={(e) => setProdCategory(e.target.value)}
              className="px-3 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:border-pink-600 bg-white"
            >
              {GRUH_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
            <input
              type="text"
              value={prodUnit}
              onChange={(e) => setProdUnit(e.target.value)}
              placeholder="Pack unit (e.g. 200g pack, 500ml jar)"
              className="px-3 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:border-pink-600"
            />
            <input
              type="number"
              min={0}
              value={prodMrp}
              onChange={(e) => setProdMrp(e.target.value)}
              placeholder="MRP (₹)"
              className="px-3 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:border-pink-600"
            />
            <input
              type="number"
              min={0}
              value={prodPrice}
              onChange={(e) => setProdPrice(e.target.value)}
              placeholder="Selling price (₹)"
              className="px-3 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:border-pink-600"
            />
            <input
              type="number"
              min={0}
              value={prodStock}
              onChange={(e) => setProdStock(e.target.value)}
              placeholder="Stock"
              className="px-3 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:border-pink-600"
            />
            <input
              type="number"
              min={0}
              value={prodShelfLife}
              onChange={(e) => setProdShelfLife(e.target.value)}
              placeholder="Shelf life (days)"
              className="px-3 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:border-pink-600"
            />
            <label className="flex items-center gap-2 px-3 py-2 text-xs font-bold text-slate-700 bg-white rounded-xl border border-slate-300">
              <input
                type="checkbox"
                checked={prodIsVeg}
                onChange={(e) => setProdIsVeg(e.target.checked)}
                className="accent-pink-600"
              />
              Vegetarian product
            </label>
            <div className="sm:col-span-2">
              <textarea
                value={prodDescription}
                onChange={(e) => setProdDescription(e.target.value)}
                rows={2}
                placeholder="Description — what makes it special (shows on the mall)"
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:border-pink-600"
              />
            </div>
            <div className="sm:col-span-2 flex flex-wrap items-center gap-2">
              <label className="px-3 py-1.5 bg-white border border-slate-200 text-slate-700 text-[11px] font-bold rounded-xl cursor-pointer">
                {prodUploading ? 'Uploading…' : 'Add photo'}
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  disabled={prodUploading}
                  onChange={(e) => {
                    void addProductImage(e.target.files?.[0] ?? null);
                    e.target.value = '';
                  }}
                />
              </label>
              {prodImages.map((url, idx) => (
                <span
                  key={url || idx}
                  className="px-2 py-1 rounded-full text-[10px] font-bold bg-pink-100 text-pink-800 flex items-center gap-1"
                >
                  Photo {idx + 1}
                  <button
                    type="button"
                    onClick={() => setProdImages((prev) => prev.filter((_, j) => j !== idx))}
                    className="text-pink-700 hover:text-pink-900 font-black"
                    title="Remove photo"
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
            <button
              onClick={() => void addProduct()}
              disabled={!prodName.trim() || busy === 'product'}
              className="px-3 py-2 bg-pink-600 hover:bg-pink-700 disabled:opacity-40 text-white text-[11px] font-bold rounded-xl"
            >
              {busy === 'product' ? 'Saving…' : 'Save'}
            </button>
          </div>
        )}

        {products.length === 0 ? (
          <p className="text-xs text-slate-400">No products yet — add your first item above.</p>
        ) : (
          <div className="space-y-2">
            {products.map((p, i) => {
              const id = pickStr(p, 'id', 'productId') || String(i);
              const productStatus = pickStr(p, 'status') || 'draft';
              const published = productStatus === 'live';
              const stock = pickNum(p, 'stock', 'stockQty');
              const batches =
                batchFor === id ? asRecords(pick(batchDetail, 'batches')) : [];
              const activeOffer =
                batchFor === id ? asRecord(pick(batchDetail, 'activeOffer')) : {};
              return (
                <div key={id} className="p-3 rounded-2xl border border-slate-100 bg-slate-50/60 space-y-2">
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <div>
                      <p className="font-bold text-slate-800">
                        {pickStr(p, 'title', 'name') || 'Product'}{' '}
                        <span className="text-slate-400 font-semibold">
                          · {formatCurrency(pickNum(p, 'price', 'priceRupees'))}
                          {pickNum(p, 'mrp') > pickNum(p, 'price')
                            ? ` (MRP ${formatCurrency(pickNum(p, 'mrp'))})`
                            : ''}
                        </span>
                      </p>
                      <p className="text-[11px] text-slate-400">
                        {pickStr(p, 'category') || '—'} · Stock: {formatNumber(stock)}
                      </p>
                    </div>
                    <StatusBadge status={published ? 'active' : productStatus} />
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => {
                        const next = stock + 5;
                        void run(
                          `st-${id}`,
                          () => gruhUdyog.updateStock(id, next),
                          '',
                        ).then(() => {
                          setProducts((prev) =>
                            prev.map((row) =>
                              (pickStr(row, 'id', 'productId') || '') === id
                                ? { ...row, stock: next }
                                : row
                            )
                          );
                          return undefined;
                        });
                      }}
                      disabled={busy !== null}
                      className="px-3 py-1.5 bg-white border border-slate-200 text-slate-700 text-[11px] font-bold rounded-xl"
                    >
                      +5 Stock
                    </button>
                    <button
                      onClick={() => void openBatches(id)}
                      disabled={busy !== null}
                      className={cn(
                        'px-3 py-1.5 text-[11px] font-bold rounded-xl disabled:opacity-40',
                        batchFor === id
                          ? 'bg-pink-600 text-white'
                          : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
                      )}
                    >
                      Batches
                    </button>
                    <button
                      onClick={() => openOffer(id)}
                      disabled={busy !== null}
                      className={cn(
                        'px-3 py-1.5 text-[11px] font-bold rounded-xl disabled:opacity-40',
                        offerFor === id
                          ? 'bg-pink-600 text-white'
                          : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
                      )}
                    >
                      Offer
                    </button>
                    {published ? (
                      <button
                        onClick={() =>
                          void run(`u-${id}`, () => gruhUdyog.unpublishProduct(id), 'Product unpublished — hidden from the mall.')
                        }
                        disabled={busy !== null}
                        className="px-3 py-1.5 bg-amber-50 border border-amber-200 text-amber-700 text-[11px] font-bold rounded-xl"
                      >
                        Unpublish
                      </button>
                    ) : (
                      <button
                        onClick={() =>
                          void run(`p-${id}`, () => gruhUdyog.publishProduct(id), 'Product is now live on the Krishi Mall!')
                        }
                        disabled={busy !== null}
                        className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold rounded-xl"
                      >
                        Publish
                      </button>
                    )}
                    <button
                      onClick={() =>
                        void run(
                          `del-${id}`,
                          async () => {
                            await gruhUdyog.removeProduct(id);
                          },
                          'Product deleted.'
                        )
                      }
                      disabled={busy !== null}
                      className="px-3 py-1.5 bg-rose-50 border border-rose-200 text-rose-700 text-[11px] font-bold rounded-xl"
                    >
                      Delete
                    </button>
                  </div>

                  {/* Batches panel */}
                  {batchFor === id && (
                    <div className="p-3 rounded-2xl border border-pink-100 bg-white space-y-2">
                      <div className="flex items-center justify-between">
                        <p className="text-[11px] font-bold text-slate-700">Production Batches</p>
                        {Object.keys(activeOffer).length > 0 && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                            Offer: {pickStr(activeOffer, 'title')} (−{pickNum(activeOffer, 'discountPercent')}%)
                          </span>
                        )}
                      </div>
                      {batches.length === 0 ? (
                        <p className="text-[11px] text-slate-400">
                          No batches recorded — add one for FSSAI traceability.
                        </p>
                      ) : (
                        <div className="space-y-1.5">
                          {batches.map((b, j) => {
                            const batchId = pickStr(b, 'id') || String(j);
                            const bStatus = pickStr(b, 'status') || 'active';
                            return (
                              <div
                                key={batchId}
                                className="flex flex-wrap items-center justify-between gap-2 text-[11px] p-2 rounded-xl bg-slate-50 border border-slate-100"
                              >
                                <div>
                                  <span className="font-bold text-slate-800">
                                    {pickStr(b, 'batchNo') || `Batch ${j + 1}`}
                                  </span>{' '}
                                  · {formatNumber(pickNum(b, 'quantity'))} pcs
                                  <span className="text-slate-400">
                                    {' '}
                                    · made {pickStr(b, 'productionDate') || '—'}
                                    {pickStr(b, 'expiryDate') ? ` · expires ${pickStr(b, 'expiryDate')}` : ''}
                                  </span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <StatusBadge status={bStatus} />
                                  {bStatus !== 'sold_out' && bStatus !== 'expired' && (
                                    <select
                                      value=""
                                      onChange={(e) => {
                                        if (e.target.value) {
                                          void setBatchStatus(batchId, id, e.target.value);
                                        }
                                      }}
                                      disabled={busy === batchId}
                                      className="px-2 py-1 rounded-lg border border-slate-200 text-[10px] font-bold bg-white"
                                    >
                                      <option value="">Mark…</option>
                                      {BATCH_STATUSES.map((s) => (
                                        <option key={s} value={s}>
                                          {s === 'sold_out' ? 'Sold out' : 'Expired'}
                                        </option>
                                      ))}
                                    </select>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 pt-1">
                        <input
                          type="text"
                          value={batchNo}
                          onChange={(e) => setBatchNo(e.target.value)}
                          placeholder="Batch no (auto)"
                          className="px-2.5 py-1.5 text-[11px] rounded-xl border border-slate-300 focus:outline-none focus:border-pink-600"
                        />
                        <input
                          type="number"
                          min={1}
                          value={batchQty}
                          onChange={(e) => setBatchQty(e.target.value)}
                          placeholder="Qty"
                          className="px-2.5 py-1.5 text-[11px] rounded-xl border border-slate-300 focus:outline-none focus:border-pink-600"
                        />
                        <input
                          type="date"
                          value={batchProduced}
                          onChange={(e) => setBatchProduced(e.target.value)}
                          title="Production date"
                          className="px-2.5 py-1.5 text-[11px] rounded-xl border border-slate-300 focus:outline-none focus:border-pink-600"
                        />
                        <input
                          type="date"
                          value={batchExpiry}
                          onChange={(e) => setBatchExpiry(e.target.value)}
                          title="Expiry date (optional)"
                          className="px-2.5 py-1.5 text-[11px] rounded-xl border border-slate-300 focus:outline-none focus:border-pink-600"
                        />
                        <button
                          onClick={() => void addBatch(id)}
                          disabled={busy === 'batch' || !batchQty.trim() || !batchProduced}
                          className="px-3 py-1.5 bg-pink-600 hover:bg-pink-700 disabled:opacity-40 text-white text-[11px] font-bold rounded-xl"
                        >
                          {busy === 'batch' ? 'Adding…' : 'Add Batch'}
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Offer panel */}
                  {offerFor === id && (
                    <div className="p-3 rounded-2xl border border-pink-100 bg-white space-y-2">
                      <p className="text-[11px] font-bold text-slate-700">Time-boxed Discount Offer</p>
                      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                        <input
                          type="text"
                          value={offerTitle}
                          onChange={(e) => setOfferTitle(e.target.value)}
                          placeholder="Offer title"
                          className="col-span-2 px-2.5 py-1.5 text-[11px] rounded-xl border border-slate-300 focus:outline-none focus:border-pink-600"
                        />
                        <input
                          type="number"
                          min={1}
                          max={90}
                          value={offerPct}
                          onChange={(e) => setOfferPct(e.target.value)}
                          placeholder="% off"
                          className="px-2.5 py-1.5 text-[11px] rounded-xl border border-slate-300 focus:outline-none focus:border-pink-600"
                        />
                        <input
                          type="date"
                          value={offerFrom}
                          onChange={(e) => setOfferFrom(e.target.value)}
                          title="Valid from"
                          className="px-2.5 py-1.5 text-[11px] rounded-xl border border-slate-300 focus:outline-none focus:border-pink-600"
                        />
                        <input
                          type="date"
                          value={offerUntil}
                          onChange={(e) => setOfferUntil(e.target.value)}
                          title="Valid until"
                          className="px-2.5 py-1.5 text-[11px] rounded-xl border border-slate-300 focus:outline-none focus:border-pink-600"
                        />
                      </div>
                      <button
                        onClick={() => void addOffer(id)}
                        disabled={busy === 'offer' || !offerTitle.trim() || !offerFrom || !offerUntil}
                        className="px-3 py-1.5 bg-pink-600 hover:bg-pink-700 disabled:opacity-40 text-white text-[11px] font-bold rounded-xl"
                      >
                        {busy === 'offer' ? 'Activating…' : 'Activate Offer'}
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Offers */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs p-5 space-y-3">
        <h4 className="font-bold text-xs text-slate-900 flex items-center gap-1.5">
          <BadgePercent className="w-4 h-4 text-pink-600" /> Offers
        </h4>
        {offers.length === 0 ? (
          <p className="text-xs text-slate-400">
            No offers yet — open a product above and tap "Offer" to run a time-boxed discount on the mall.
          </p>
        ) : (
          <div className="space-y-2">
            {offers.map((o, i) => {
              const offerId = pickStr(o, 'id', 'offerId') || String(i);
              const productName = pickStr(o, 'productTitle', 'productName');
              return (
                <div
                  key={offerId}
                  className="flex flex-wrap items-center justify-between gap-2 text-xs p-2.5 rounded-xl bg-slate-50 border border-slate-100"
                >
                  <div>
                    <span className="font-bold text-slate-800">{pickStr(o, 'title') || 'Offer'}</span>
                    <span className="text-pink-700 font-black"> −{pickNum(o, 'discountPercent')}%</span>
                    <p className="text-[11px] text-slate-400">
                      {productName ? `${productName} · ` : ''}₹{formatNumber(pickNum(o, 'offerPrice'))} offer price ·{' '}
                      {pickStr(o, 'validFrom') || '—'} → {pickStr(o, 'validUntil') || '—'}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <StatusBadge status={pickStr(o, 'status') || 'active'} />
                    <button
                      onClick={() => void removeOffer(offerId)}
                      disabled={busy === offerId}
                      className="px-2.5 py-1 bg-rose-50 border border-rose-200 text-rose-700 text-[10px] font-bold rounded-lg disabled:opacity-40"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Certifications */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs p-5 space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="font-bold text-xs text-slate-900 flex items-center gap-1.5">
            <Award className="w-4 h-4 text-amber-500" /> Certifications
          </h4>
          <button
            onClick={() => setCertFormOpen((s) => !s)}
            disabled={busy !== null}
            className="px-3 py-1.5 bg-pink-600 hover:bg-pink-700 disabled:opacity-40 text-white text-[11px] font-bold rounded-xl flex items-center gap-1"
          >
            <Plus className="w-3.5 h-3.5" /> Add Certification
          </button>
        </div>
        <p className="text-[11px] text-slate-400">
          FSSAI registration is needed for food products. While verification is pending you can still
          publish — the listing carries a visible pending badge until the certificate is verified.
        </p>

        {certFormOpen && (
          <div className="p-3 rounded-2xl border border-amber-100 bg-amber-50/50 grid grid-cols-1 sm:grid-cols-2 gap-2">
            <select
              value={certType}
              onChange={(e) => setCertType(e.target.value)}
              className="px-3 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:border-pink-600 bg-white"
            >
              <option value="fssai">FSSAI (food licence)</option>
              <option value="agmark">AGMARK</option>
              <option value="udyam">Udyam (enterprise)</option>
              <option value="shg">SHG registration</option>
              <option value="handicraft_mark">Handicraft mark</option>
              <option value="other">Other</option>
            </select>
            <input
              type="text"
              value={certNumber}
              onChange={(e) => setCertNumber(e.target.value)}
              placeholder="Certificate number"
              className="px-3 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:border-pink-600"
            />
            <input
              type="text"
              value={certAuthority}
              onChange={(e) => setCertAuthority(e.target.value)}
              placeholder="Issuing authority (e.g. FSSAI Pune)"
              className="px-3 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:border-pink-600"
            />
            <input
              type="date"
              value={certValidUntil}
              onChange={(e) => setCertValidUntil(e.target.value)}
              title="Valid until"
              className="px-3 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:border-pink-600"
            />
            <label className="sm:col-span-2 px-3 py-2 bg-white border border-slate-200 text-slate-700 text-[11px] font-bold rounded-xl cursor-pointer">
              {certDoc ? `Document: ${certDoc.name}` : certUploading ? 'Uploading document…' : 'Attach certificate document (PDF/photo)'}
              <input
                type="file"
                accept="image/*,application/pdf"
                className="hidden"
                disabled={certUploading}
                onChange={(e) => setCertDoc(e.target.files?.[0] ?? null)}
              />
            </label>
            <button
              onClick={() => void submitCertification()}
              disabled={busy === 'cert' || !certNumber.trim()}
              className="sm:col-span-2 px-3 py-2 bg-pink-600 hover:bg-pink-700 disabled:opacity-40 text-white text-[11px] font-bold rounded-xl"
            >
              {busy === 'cert' ? 'Submitting…' : 'Submit for Verification'}
            </button>
          </div>
        )}

        {certs.length === 0 ? (
          <p className="text-xs text-slate-400">
            No certifications yet — add your FSSAI/AGMARK certificate so food products can go live on the mall.
          </p>
        ) : (
          <div className="space-y-2">
            {certs.map((c, i) => {
              const certStatus = pickStr(c, 'status') || 'pending';
              return (
                <div
                  key={pickStr(c, 'id') || i}
                  className="flex flex-wrap items-center justify-between gap-2 text-xs p-2.5 rounded-xl bg-slate-50 border border-slate-100"
                >
                  <div>
                    <span className="font-bold text-slate-800 uppercase">{pickStr(c, 'type') || 'Certification'}</span>
                    <span className="text-slate-500 font-mono"> · {pickStr(c, 'number') || '—'}</span>
                    <p className="text-[11px] text-slate-400">
                      {pickStr(c, 'issuingAuthority') || 'Authority not recorded'}
                      {pickStr(c, 'validUntil') ? ` · valid until ${pickStr(c, 'validUntil')}` : ''}
                    </p>
                    {certStatus === 'pending' && (
                      <p className="text-[10px] text-amber-700 font-bold mt-0.5">
                        Verification pending — you can publish with a visible pending badge.
                      </p>
                    )}
                    {certStatus === 'verified' && (
                      <p className="text-[10px] text-emerald-700 font-bold mt-0.5">Verified — your badge shows verified on the mall.</p>
                    )}
                  </div>
                  <StatusBadge status={certStatus} />
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
