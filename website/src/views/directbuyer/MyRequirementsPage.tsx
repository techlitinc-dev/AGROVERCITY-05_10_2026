import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ClipboardList,
  Copy,
  Pause,
  Play,
  CheckCheck,
  XCircle,
  Pencil,
  Plus,
  RefreshCcw,
  Repeat,
} from 'lucide-react';
import { demands, apiErrorMessage } from '../../lib/api';
import { ModalSheet } from '../../components/common/ModalSheet';
import { formatCurrency, formatWeight, formatDate } from '../../lib/utils';
import { FREQUENCY_LABEL, REQUIREMENT_STATUS_LABEL } from '../trade/directConnect';
import { RequirementForm, emptyRequirementForm, formFromDemand, toDemandPayload } from './RequirementForm';
import type { BuyerDemand } from '../../types';

type StatusFilter = 'all' | 'open' | 'applicationsReceived' | 'paused' | 'draft' | 'closed' | 'fulfilled';

const TABS: { key: StatusFilter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'open', label: 'Open' },
  { key: 'applicationsReceived', label: 'Applications received' },
  { key: 'paused', label: 'Paused' },
  { key: 'draft', label: 'Drafts' },
  { key: 'closed', label: 'Closed' },
  { key: 'fulfilled', label: 'Fulfilled' },
];

/** Buyer destination #3 — My Requirements (spec §4). */
export const MyRequirementsPage: React.FC = () => {
  const [list, setList] = useState<BuyerDemand[]>([]);
  const [filter, setFilter] = useState<StatusFilter>('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [editing, setEditing] = useState<BuyerDemand | null>(null);
  const [form, setForm] = useState(emptyRequirementForm());
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setList(await demands.list({ status: 'all' }));
    } catch (e) {
      setError(apiErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const act = async (fn: () => Promise<unknown>, msg: string) => {
    setError(null);
    setNotice(null);
    try {
      await fn();
      setNotice(msg);
      await load();
    } catch (e) {
      setError(apiErrorMessage(e));
    }
  };

  const openEdit = (d: BuyerDemand) => {
    setEditing(d);
    setForm(formFromDemand(d));
  };

  const saveEdit = async () => {
    if (!editing) return;
    setSaving(true);
    setError(null);
    try {
      await demands.update(editing.id, toDemandPayload(form) as Partial<BuyerDemand>);
      setEditing(null);
      setNotice('Requirement updated.');
      await load();
    } catch (e) {
      setError(apiErrorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  const visible = filter === 'all' ? list : list.filter((d) => d.status === filter);
  const openish = (d: BuyerDemand) => ['open', 'applicationsReceived', 'paused'].includes(d.status);

  return (
    <div className="space-y-6">
      <div className="border-b border-slate-200 pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 flex items-center gap-2">
            <ClipboardList className="w-7 h-7 text-emerald-600" />
            My Requirements
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Open, pause, fulfil or duplicate your sourcing requirements. Applications appear on the Applications
            Received page.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => void load()}
            className="px-3 py-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-600"
          >
            <RefreshCcw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <Link
            to="/directbuyer/requirements/new"
            className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md transition-all flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4" /> Post requirement
          </Link>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setFilter(t.key)}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold border transition-all ${
              filter === t.key
                ? 'bg-emerald-600 border-emerald-600 text-white'
                : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
            }`}
          >
            {t.label} ({t.key === 'all' ? list.length : list.filter((d) => d.status === t.key).length})
          </button>
        ))}
      </div>

      {error && (
        <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-2xl text-xs font-semibold text-rose-800">
          {error}
        </div>
      )}
      {notice && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-2xl text-xs font-semibold text-emerald-800 flex items-center justify-between gap-4">
          <span>{notice}</span>
          <button onClick={() => setNotice(null)} className="font-bold hover:underline shrink-0">
            Dismiss
          </button>
        </div>
      )}

      {loading ? (
        <div className="py-10 text-center text-xs font-bold text-slate-400 animate-pulse">Loading requirements…</div>
      ) : visible.length === 0 ? (
        <div className="py-12 text-center bg-white rounded-3xl border border-slate-200/80">
          <p className="text-xs font-semibold text-slate-400">No requirements here yet.</p>
          <Link
            to="/directbuyer/requirements/new"
            className="inline-block mt-3 px-4 py-2 rounded-xl bg-emerald-600 text-white font-bold text-xs"
          >
            Post your first requirement
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {visible.map((d) => {
            const recurring = d.supplyType === 'recurring' || (d.frequency ?? 'oneTime') !== 'oneTime';
            return (
              <div
                key={d.id}
                className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-xs flex flex-col lg:flex-row lg:items-center justify-between gap-4"
              >
                <div className="space-y-1.5 max-w-2xl">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-extrabold text-sm text-slate-900">
                      {d.crop} {d.variety ? `(${d.variety})` : ''}
                    </span>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                        ['open', 'applicationsReceived'].includes(d.status)
                          ? 'text-emerald-700 bg-emerald-50 border-emerald-200'
                          : d.status === 'paused'
                            ? 'text-amber-700 bg-amber-50 border-amber-200'
                            : d.status === 'fulfilled'
                              ? 'text-sky-700 bg-sky-50 border-sky-200'
                              : 'text-slate-500 bg-slate-100 border-slate-200'
                      }`}
                    >
                      {REQUIREMENT_STATUS_LABEL[d.status] ?? d.status}
                    </span>
                    {recurring && (
                      <span className="text-[10px] font-bold text-violet-700 bg-violet-50 border border-violet-200 px-2 py-0.5 rounded-full flex items-center gap-1">
                        <Repeat className="w-3 h-3" /> {FREQUENCY_LABEL[d.frequency ?? 'weekly']}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-600">
                    <strong>{formatWeight(d.quantity ?? d.requiredQuantityQuintal ?? 0)}</strong>
                    {recurring
                      ? ` · ${d.quantityPerDelivery ?? '—'} ${d.unit || 'q'} per delivery · ${d.startDate || 'flexible'} → ${d.endDate || 'ongoing'}`
                      : d.neededBy || d.validUntil
                        ? ` · needed by ${formatDate(d.neededBy || d.validUntil || '')}`
                        : ''}
                    {' · '}
                    {d.deliveryLocation}
                    {(d.targetPrice ?? d.maxPrice ?? d.maxPricePerQuintal ?? 0) > 0 && (
                      <span className="text-emerald-800 font-bold">
                        {' '}
                        · target {formatCurrency(d.targetPrice ?? d.maxPrice ?? d.maxPricePerQuintal ?? 0)}/
                        {d.targetUnit || d.unit || 'q'}
                      </span>
                    )}
                  </p>
                  <p className="text-[10px] text-slate-400">
                    {d.applicationsCount ?? 0} application{(d.applicationsCount ?? 0) === 1 ? '' : 's'} · posted{' '}
                    {formatDate(d.createdAt)}
                  </p>
                </div>
                <div className="flex items-center gap-1.5 flex-wrap">
                  {['open', 'applicationsReceived', 'paused'].includes(d.status) && (
                    <>
                      <button
                        onClick={() => openEdit(d)}
                        className="px-3 py-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold text-xs flex items-center gap-1"
                      >
                        <Pencil className="w-3.5 h-3.5" /> Edit
                      </button>
                      {d.status === 'paused' ? (
                        <button
                          onClick={() => void act(() => demands.resume(d.id), 'Requirement resumed.')}
                          className="px-3 py-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold text-xs flex items-center gap-1"
                        >
                          <Play className="w-3.5 h-3.5" /> Resume
                        </button>
                      ) : (
                        <button
                          onClick={() => void act(() => demands.pause(d.id), 'Requirement paused.')}
                          className="px-3 py-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold text-xs flex items-center gap-1"
                        >
                          <Pause className="w-3.5 h-3.5" /> Pause
                        </button>
                      )}
                      <button
                        onClick={() => void act(() => demands.close(d.id), 'Requirement closed.')}
                        className="px-3 py-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold text-xs flex items-center gap-1"
                      >
                        <XCircle className="w-3.5 h-3.5" /> Close
                      </button>
                      <button
                        onClick={() => void act(() => demands.fulfil(d.id), 'Requirement marked fulfilled.')}
                        className="px-3 py-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold text-xs flex items-center gap-1"
                      >
                        <CheckCheck className="w-3.5 h-3.5" /> Fulfil
                      </button>
                    </>
                  )}
                  {d.status === 'draft' && (
                    <button
                      onClick={() => openEdit(d)}
                      className="px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-1"
                    >
                      <Pencil className="w-3.5 h-3.5" /> Edit & publish
                    </button>
                  )}
                  {d.status === 'closed' && (
                    <button
                      onClick={() => void act(() => demands.reopen(d.id), 'Requirement reopened.')}
                      className="px-3 py-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold text-xs flex items-center gap-1"
                    >
                      <Play className="w-3.5 h-3.5" /> Reopen
                    </button>
                  )}
                  {openish(d) && (
                    <button
                      onClick={() => void act(() => demands.duplicate(d.id), 'Duplicated into a new draft.')}
                      className="px-3 py-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold text-xs flex items-center gap-1"
                    >
                      <Copy className="w-3.5 h-3.5" /> Duplicate
                    </button>
                  )}
                  <Link
                    to="/directbuyer/applications"
                    className="px-3 py-2 rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-700 font-bold text-xs hover:bg-emerald-100 transition-all"
                  >
                    Applications ({d.applicationsCount ?? 0})
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <ModalSheet
        isOpen={Boolean(editing)}
        onClose={() => setEditing(null)}
        title={editing?.status === 'draft' ? 'Edit draft & publish' : 'Edit requirement'}
        maxWidth="md"
      >
        <div className="space-y-4">
          <RequirementForm value={form} onChange={setForm} />
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs font-semibold text-rose-800">
              {error}
            </div>
          )}
          <div className="flex gap-2">
            <button
              onClick={() => void saveEdit()}
              disabled={saving}
              className="flex-1 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md transition-all disabled:opacity-50"
            >
              {saving ? 'Saving…' : 'Save'}
            </button>
            {editing?.status === 'draft' && (
              <button
                onClick={async () => {
                  if (!editing) return;
                  setSaving(true);
                  try {
                    await demands.update(editing.id, { ...(toDemandPayload(form) as Partial<BuyerDemand>), status: 'open' });
                    setEditing(null);
                    setNotice('Draft published.');
                    await load();
                  } catch (e) {
                    setError(apiErrorMessage(e));
                  } finally {
                    setSaving(false);
                  }
                }}
                disabled={saving}
                className="flex-1 py-3 rounded-xl bg-sky-600 hover:bg-sky-700 text-white font-bold text-xs shadow-md transition-all disabled:opacity-50"
              >
                Publish now
              </button>
            )}
          </div>
        </div>
      </ModalSheet>
    </div>
  );
};
