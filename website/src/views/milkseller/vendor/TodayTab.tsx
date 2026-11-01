import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { CheckCircle2, CircleMinus, Milk, Plus, SkipForward } from 'lucide-react';
import { milkVendor } from '../../../lib/api';
import { litresToMl } from '../../../lib/api/milkVendor';
import { SectionCard, EmptyState, ErrorBanner, inputCls, btnPrimary, btnGhost, rec, recArr, str, num, bool, todayStr, fmtMl, fmtPaisa, shiftLabel } from './shared';

interface Props {
  profile: Record<string, unknown>;
  refreshKey: number;
  notify: (message: string) => void;
}

export const TodayTab: React.FC<Props> = ({ profile, refreshKey, notify }) => {
  const [date, setDate] = useState(todayStr());
  const [shift, setShift] = useState(str(profile.defaultShift, 'morning') || 'morning');
  const [data, setData] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [qty, setQty] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<Record<string, boolean>>({});
  const [extraFor, setExtraFor] = useState<string | null>(null);
  const [extraQty, setExtraQty] = useState('1');
  const [bulkSaving, setBulkSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await milkVendor.today({ date, shift });
      setData(res);
      const defaults: Record<string, string> = {};
      for (const row of recArr(res.rows)) {
        defaults[str(row.clientId)] = String((num(row.quantityMilliLitres) || num(row.defaultQuantityMilliLitres)) / 1000);
      }
      setQty((prev) => ({ ...defaults, ...prev }));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load today’s list');
    } finally {
      setLoading(false);
    }
  }, [date, shift]);

  useEffect(() => {
    load();
  }, [load, refreshKey]);

  const rows = useMemo(() => recArr(data?.rows), [data]);
  const summary = rec(data?.summary);
  const savedRows = rows.filter((r) => str(r.entryId));
  const pendingRows = rows.filter((r) => !str(r.entryId));

  const rowKey = (row: Record<string, unknown>, extra = false) => `${str(row.clientId)}:${extra ? 'x' : 'n'}`;

  const saveRow = async (row: Record<string, unknown>, status: 'delivered' | 'skipped') => {
    const clientId = str(row.clientId);
    setSaving((s) => ({ ...s, [rowKey(row)]: true }));
    try {
      const payload: Record<string, unknown> = {
        clientId,
        deliveryDate: date,
        shift,
        status,
        productId: str(row.productId) || undefined,
        notes: '',
      };
      if (status === 'delivered') {
        const ml = litresToMl(qty[clientId] ?? '1');
        if (!Number.isFinite(ml) || ml <= 0) throw new Error('Quantity must be more than zero');
        payload.quantityMilliLitres = ml;
      }
      if (str(row.entryId)) {
        await milkVendor.correctDelivery(str(row.entryId), { ...payload, correctionReason: 'same-day update from Today' });
      } else {
        await milkVendor.recordDelivery(payload);
      }
      notify(status === 'delivered' ? `${str(row.name)} marked delivered` : `${str(row.name)} skipped`);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving((s) => ({ ...s, [rowKey(row)]: false }));
    }
  };

  const saveExtra = async (row: Record<string, unknown>) => {
    const ml = litresToMl(extraQty);
    if (!Number.isFinite(ml) || ml <= 0) {
      setError('Extra quantity must be more than zero');
      return;
    }
    setSaving((s) => ({ ...s, [rowKey(row, true)]: true }));
    try {
      await milkVendor.recordDelivery({
        clientId: str(row.clientId),
        deliveryDate: date,
        shift,
        status: 'delivered',
        quantityMilliLitres: ml,
        productId: str(row.productId) || undefined,
        extra: true,
      });
      setExtraFor(null);
      notify(`Extra delivery recorded for ${str(row.name)}`);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save extra delivery');
    } finally {
      setSaving((s) => ({ ...s, [rowKey(row, true)]: false }));
    }
  };

  const saveAll = async () => {
    if (!pendingRows.length) return;
    setBulkSaving(true);
    setError(null);
    try {
      const entries = pendingRows.map((row) => {
        const ml = litresToMl(qty[str(row.clientId)] ?? '1');
        return {
          clientId: str(row.clientId),
          status: 'delivered' as const,
          productId: str(row.productId) || undefined,
          quantityMilliLitres: Number.isFinite(ml) && ml > 0 ? ml : num(row.defaultQuantityMilliLitres),
        };
      });
      await milkVendor.recordBulk(
        { deliveryDate: date, shift, entries },
        `today-${date}-${shift}-${Date.now()}`,
      );
      notify(`Saved ${entries.length} deliveries`);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Bulk save failed');
    } finally {
      setBulkSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={`${inputCls} w-auto`} />
        <select value={shift} onChange={(e) => setShift(e.target.value)} className={`${inputCls} w-auto`}>
          <option value="morning">Morning</option>
          <option value="evening">Evening</option>
        </select>
        <button onClick={load} className={btnGhost} disabled={loading}>
          Refresh
        </button>
        {pendingRows.length > 0 && (
          <button onClick={saveAll} className={btnPrimary} disabled={bulkSaving}>
            {bulkSaving ? 'Saving…' : `Save all (${pendingRows.length})`}
          </button>
        )}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <Stat label="Scheduled" value={String(num(summary.requiredCount))} />
        <Stat label="Delivered" value={String(num(summary.deliveredCount))} />
        <Stat label="Milk delivered" value={fmtMl(num(summary.totalQuantityMilliLitres))} />
        <Stat label="Collection value" value={fmtPaisa(num(summary.collectionValuePaisa))} accent />
      </div>

      <ErrorBanner message={error} />

      {loading ? (
        <EmptyState message="Loading today’s deliveries…" />
      ) : rows.length === 0 ? (
        <EmptyState message="No clients scheduled for this date & shift. Add clients from the Clients tab." />
      ) : (
        <div className="space-y-2">
          {rows.map((row) => {
            const clientId = str(row.clientId);
            const entryId = str(row.entryId);
            const status = str(row.status);
            const savingRow = saving[rowKey(row)];
            return (
              <div
                key={clientId}
                className={`rounded-2xl border bg-white p-3 sm:p-4 shadow-sm ${
                  status === 'delivered'
                    ? 'border-emerald-300'
                    : status === 'skipped'
                      ? 'border-slate-200 opacity-75'
                      : bool(row.paused)
                        ? 'border-amber-200'
                        : 'border-slate-200'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <Milk className="h-4 w-4 text-emerald-600 shrink-0" />
                      <span className="font-medium text-slate-800 truncate">{str(row.name)}</span>
                      {bool(row.paused) && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-700">PAUSED</span>
                      )}
                      {status === 'delivered' && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700">SAVED</span>
                      )}
                      {status === 'skipped' && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-200 text-slate-600">SKIPPED</span>
                      )}
                    </div>
                    <div className="text-xs text-slate-500 mt-0.5">
                      {str(row.productName) || 'Milk'} · default {fmtMl(num(row.defaultQuantityMilliLitres))}
                      {num(row.resolvedRatePaisaPerUnit)
                        ? ` · ${fmtPaisa(num(row.resolvedRatePaisaPerUnit))}/L`
                        : ' · no rate set'}
                    </div>
                  </div>
                  {status === 'delivered' && <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />}
                </div>

                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <label className="flex items-center gap-1 text-xs text-slate-500">
                    Qty (L)
                    <input
                      type="number"
                      min="0.05"
                      step="0.25"
                      value={qty[clientId] ?? '1'}
                      onChange={(e) => setQty((prev) => ({ ...prev, [clientId]: e.target.value }))}
                      className={`${inputCls} w-20 py-1.5`}
                      disabled={status === 'skipped'}
                    />
                  </label>
                  <button
                    onClick={() => saveRow(row, 'delivered')}
                    disabled={savingRow || status === 'skipped'}
                    className={btnPrimary}
                  >
                    {savingRow ? '…' : entryId ? 'Update' : 'Delivered'}
                  </button>
                  <button
                    onClick={() => saveRow(row, 'skipped')}
                    disabled={savingRow || status === 'skipped'}
                    className={btnGhost}
                  >
                    <SkipForward className="h-4 w-4" /> Skip
                  </button>
                  <button
                    onClick={() => {
                      setExtraFor(extraFor === clientId ? null : clientId);
                      setExtraQty(String(num(row.defaultQuantityMilliLitres) / 1000 || '1'));
                    }}
                    className={btnGhost}
                    title="Record an extra delivery for today"
                  >
                    <Plus className="h-4 w-4" /> Extra
                  </button>
                </div>

                {extraFor === clientId && (
                  <div className="mt-2 flex flex-wrap items-center gap-2 rounded-xl bg-emerald-50 border border-emerald-200 p-2">
                    <span className="text-xs text-emerald-800 font-medium">Extra delivery qty (L)</span>
                    <input
                      type="number"
                      min="0.05"
                      step="0.25"
                      value={extraQty}
                      onChange={(e) => setExtraQty(e.target.value)}
                      className={`${inputCls} w-20 py-1.5`}
                    />
                    <button onClick={() => saveExtra(row)} disabled={saving[rowKey(row, true)]} className={btnPrimary}>
                      {saving[rowKey(row, true)] ? '…' : 'Save extra'}
                    </button>
                    <button onClick={() => setExtraFor(null)} className={btnGhost}>
                      <CircleMinus className="h-4 w-4" /> Cancel
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {savedRows.length > 0 && (
        <SectionCard title="Recently saved">
          <ul className="divide-y divide-slate-100 text-sm">
            {savedRows.slice(0, 5).map((row) => (
              <li key={str(row.clientId)} className="py-1.5 flex justify-between gap-2">
                <span className="text-slate-700">{str(row.name)}</span>
                <span className="text-slate-500">
                  {str(row.status) === 'delivered'
                    ? `${fmtMl(num(row.quantityMilliLitres))} · ${fmtPaisa(num(row.amountPaisa))}`
                    : shiftLabel(str(row.status))}
                </span>
              </li>
            ))}
          </ul>
        </SectionCard>
      )}
    </div>
  );
};

const Stat: React.FC<{ label: string; value: string; accent?: boolean }> = ({ label, value, accent }) => (
  <div className={`rounded-2xl border p-3 ${accent ? 'bg-emerald-600 border-emerald-600 text-white' : 'bg-white border-slate-200'}`}>
    <div className={`text-[11px] uppercase tracking-wide ${accent ? 'text-emerald-100' : 'text-slate-500'}`}>{label}</div>
    <div className="text-lg font-semibold">{value}</div>
  </div>
);
