import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  AlertCircle,
  Download,
  HandCoins,
  Pencil,
  Plus,
  Trash2,
  TrendingUp,
} from 'lucide-react';
import { apiErrorMessage, womenHub } from '../../lib/api';
import { formatPaisa } from '../../lib/utils';
import { asRecord, asRecords, pick, pickNum, pickStr, Rec } from '../shared/records';

const firstOfMonth = () => `${new Date().toISOString().slice(0, 7)}-01`;
const todayStr = () => new Date().toISOString().slice(0, 10);

/** "2026-11-24" -> "24 November 2026". */
const fullDateLabel = (ymd: string): string => {
  const [y, m, d] = ymd.split('-').map(Number);
  if (!y || !m || !d) return ymd;
  return new Date(y, m - 1, d).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
};

/**
 * Home Enterprise Income (womenhub 21nov.xlsx Sr 5.0) — pickle/papad/ghee
 * product lines with quantity &amp; price, monthly revenue − cost per product,
 * expense entries, auto-calculated monthly total profit, profit graph and a
 * one-tap ledger export.
 */
export const EnterpriseIncomeView: React.FC = () => {
  const [ledger, setLedger] = useState<Rec | null>(null);
  const [graph, setGraph] = useState<Rec[]>([]);
  const [fromDate, setFromDate] = useState(firstOfMonth());
  const [toDate, setToDate] = useState(todayStr());
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [lineForm, setLineForm] = useState<Rec | null>(null);
  const [entryFor, setEntryFor] = useState<Rec | null>(null);
  const [expenseFor, setExpenseFor] = useState<Rec | null>(null);

  // Monthly figures & expenses are stored per month — use the From month.
  const entryMonth = fromDate.slice(0, 7);
  const loadSeq = useRef(0);

  const load = useCallback(async () => {
    const seq = ++loadSeq.current;
    if (fromDate > toDate) {
      setLedger(null);
      setError('From date must be on or before To date.');
      return;
    }
    try {
      setError(null);
      const [ledgerData, graphData] = await Promise.all([
        womenHub.ledger({ from: fromDate, to: toDate }),
        womenHub.profitGraph(),
      ]);
      if (seq !== loadSeq.current) return; // a newer load superseded this one
      setLedger(asRecord(ledgerData));
      setGraph(asRecords(pick(asRecord(graphData), 'series')));
    } catch (err) {
      if (seq === loadSeq.current) setError(apiErrorMessage(err));
    }
  }, [fromDate, toDate]);

  useEffect(() => {
    void load();
  }, [load]);

  const run = async (fn: () => Promise<unknown>) => {
    if (busy) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await fn();
      await load();
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const saveLine = () => {
    const form = lineForm;
    if (!form) return;
    void run(async () => {
      const price = pickStr(form, 'pricePaisa');
      await womenHub.createEnterpriseLine({
        product: pickStr(form, 'product'),
        monthlyProfitPaisa: Math.round((Number(pickStr(form, 'monthlyProfit')) || 0) * 100),
        quantity: pickStr(form, 'quantity'),
        pricePaisa: price ? Math.round(Number(price) * 100) : undefined,
      });
      setLineForm(null);
      setNotice('Product line added.');
    });
  };

  const saveEntry = () => {
    const form = entryFor;
    if (!form) return;
    void run(async () => {
      await womenHub.upsertMonthEntry(pickStr(form, 'lineId'), {
        month: entryMonth,
        revenuePaisa: Math.round((Number(pickStr(form, 'revenue')) || 0) * 100),
        costPaisa: Math.round((Number(pickStr(form, 'cost')) || 0) * 100),
      });
      setEntryFor(null);
      setNotice('Monthly figures saved — profit = revenue − cost.');
    });
  };

  const saveExpense = () => {
    const form = expenseFor;
    if (!form) return;
    void run(async () => {
      await womenHub.addExpense(pickStr(form, 'lineId'), {
        month: entryMonth,
        note: pickStr(form, 'note'),
        amountPaisa: Math.round((Number(pickStr(form, 'amount')) || 0) * 100),
      });
      setExpenseFor(null);
      setNotice('Expense added.');
    });
  };

  const removeExpense = (expenseId: string) =>
    run(async () => {
      await womenHub.deleteExpense(expenseId);
      setNotice('Expense removed.');
    });

  const exportLedger = async () => {
    setError(null);
    try {
      const blob = await womenHub.exportLedger({ from: fromDate, to: toDate });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `enterprise-ledger-${fromDate}-to-${toDate}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(apiErrorMessage(err));
    }
  };

  const lines = ledger ? asRecords(pick(ledger, 'lines')) : [];
  const maxProfit = Math.max(...graph.map((g) => Math.abs(pickNum(g, 'totalProfitPaisa'))), 1);

  const field =
    'w-full px-3 py-2.5 text-xs rounded-xl border border-slate-300 focus:outline-none focus:border-pink-600';

  return (
    <div className="space-y-6">
      <div className="border-b border-slate-200 pb-4 flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 flex items-center gap-2">
            <HandCoins className="w-7 h-7 text-pink-600" />
            Home Enterprise Income
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Pickle, papad, ghee and more — track each product's monthly revenue, cost and
            profit, log expenses, and export your ledger.
          </p>
        </div>
        <button
          onClick={() => setLineForm({ product: '', quantity: '', pricePaisa: '', monthlyProfit: '' })}
          className="px-4 py-2.5 bg-pink-600 hover:bg-pink-700 text-white font-bold text-xs rounded-xl shadow-xs flex items-center gap-1.5 flex-shrink-0"
        >
          <Plus className="w-3.5 h-3.5" /> Add Product
        </button>
      </div>

      {error && (
        <div className="rounded-2xl border p-3 text-xs flex items-start gap-2 bg-rose-50 border-rose-200 text-rose-800">
          <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}
      {notice && (
        <div className="rounded-2xl border p-3 text-xs bg-emerald-50 border-emerald-200 text-emerald-800">
          {notice}
        </div>
      )}

      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs p-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <label className="text-xs font-bold text-slate-700 flex items-center gap-2">
            From
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="px-3 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:border-pink-600"
            />
          </label>
          <label className="text-xs font-bold text-slate-700 flex items-center gap-2">
            To
            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="px-3 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:border-pink-600"
            />
          </label>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right">
            <p className="text-[10px] text-slate-400 font-bold uppercase">Auto-calculated total profit</p>
            <p className="text-lg font-extrabold text-emerald-700">
              {ledger ? formatPaisa(pickNum(ledger, 'totalProfitPaisa')) : '—'}
            </p>
            <p className="text-[10px] text-slate-400">
              {fullDateLabel(fromDate)} – {fullDateLabel(toDate)}
            </p>
          </div>
          <button
            onClick={() => void exportLedger()}
            className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl flex items-center gap-1.5"
          >
            <Download className="w-3.5 h-3.5" /> Export Ledger
          </button>
        </div>
      </div>

      {/* Profit graph — last 6 months */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs p-5 space-y-3">
        <p className="text-xs font-bold text-slate-900 flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-emerald-600" /> Profit graph (last 6 months)
        </p>
        <div className="flex items-end gap-2 h-28">
          {graph.map((g) => {
            const value = pickNum(g, 'totalProfitPaisa');
            const height = Math.max(Math.round((Math.abs(value) / maxProfit) * 100), 2);
            return (
              <div key={pickStr(g, 'month')} className="flex-1 flex flex-col items-center gap-1">
                <span className="text-[9px] font-bold text-slate-500">
                  {value ? formatPaisa(value) : ''}
                </span>
                <div
                  className={`w-full rounded-t-lg ${value >= 0 ? 'bg-emerald-500' : 'bg-rose-400'}`}
                  style={{ height: `${height}%` }}
                />
                <span className="text-[9px] text-slate-400">{pickStr(g, 'month')?.slice(5)}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Product lines */}
      {lines.length === 0 ? (
        <p className="text-xs text-slate-400 bg-white rounded-3xl border border-slate-200/80 p-8 text-center">
          No product lines yet — add pickle, papad or ghee to start your income ledger.
        </p>
      ) : (
        <div className="space-y-3">
          {lines.map((line) => {
            const expenses = asRecords(pick(line, 'expenses'));
            return (
              <div key={pickStr(line, 'lineId')} className="bg-white rounded-3xl border border-slate-200/80 shadow-xs p-5 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h3 className="font-bold text-sm text-slate-900">{pickStr(line, 'product')}</h3>
                    <p className="text-[11px] text-slate-400">
                      {[pickStr(line, 'quantity'), pickNum(line, 'pricePaisa') ? formatPaisa(pickNum(line, 'pricePaisa')) : '']
                        .filter(Boolean)
                        .join(' · ')}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() =>
                        setEntryFor({
                          lineId: pickStr(line, 'lineId'),
                          product: pickStr(line, 'product'),
                          revenue: pickNum(line, 'revenuePaisa') ? String(pickNum(line, 'revenuePaisa') / 100) : '',
                          cost: pickNum(line, 'costPaisa') ? String(pickNum(line, 'costPaisa') / 100) : '',
                        })
                      }
                      className="px-3 py-1.5 bg-pink-50 border border-pink-200 text-pink-700 text-[11px] font-bold rounded-lg flex items-center gap-1"
                    >
                      <Pencil className="w-3 h-3" /> Monthly figures
                    </button>
                    <button
                      onClick={() => setExpenseFor({ lineId: pickStr(line, 'lineId'), note: '', amount: '' })}
                      className="px-3 py-1.5 bg-amber-50 border border-amber-200 text-amber-700 text-[11px] font-bold rounded-lg flex items-center gap-1"
                    >
                      <Plus className="w-3 h-3" /> Expense
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
                  <div className="rounded-xl bg-slate-50 p-2">
                    <p className="text-[10px] text-slate-400 font-bold">Revenue</p>
                    <p className="text-xs font-extrabold text-slate-900">
                      {pick(line, 'revenuePaisa') !== undefined && pick(line, 'revenuePaisa') !== null
                        ? formatPaisa(pickNum(line, 'revenuePaisa'))
                        : '—'}
                    </p>
                  </div>
                  <div className="rounded-xl bg-slate-50 p-2">
                    <p className="text-[10px] text-slate-400 font-bold">Cost</p>
                    <p className="text-xs font-extrabold text-slate-900">
                      {pick(line, 'costPaisa') !== undefined && pick(line, 'costPaisa') !== null
                        ? formatPaisa(pickNum(line, 'costPaisa'))
                        : '—'}
                    </p>
                  </div>
                  <div className="rounded-xl bg-slate-50 p-2">
                    <p className="text-[10px] text-slate-400 font-bold">Profit (rev − cost)</p>
                    <p className="text-xs font-extrabold text-emerald-700">
                      {pick(line, 'profitPaisa') !== undefined && pick(line, 'profitPaisa') !== null
                        ? formatPaisa(pickNum(line, 'profitPaisa'))
                        : '—'}
                    </p>
                  </div>
                  <div className="rounded-xl bg-slate-50 p-2">
                    <p className="text-[10px] text-slate-400 font-bold">Expenses</p>
                    <p className="text-xs font-extrabold text-amber-700">
                      {formatPaisa(pickNum(line, 'expenseTotalPaisa'))}
                    </p>
                  </div>
                </div>

                {expenses.length > 0 && (
                  <div className="space-y-1">
                    {expenses.map((e) => (
                      <div key={pickStr(e, 'id')} className="flex items-center justify-between text-[11px] text-slate-500">
                        <span>
                          {pickStr(e, 'note') || 'Expense'} — {formatPaisa(pickNum(e, 'amountPaisa'))}
                        </span>
                        <button
                          onClick={() => void removeExpense(pickStr(e, 'id'))}
                          className="p-1 rounded-lg text-slate-400 hover:text-rose-600"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {lineForm && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-xl w-full max-w-md p-5 space-y-3">
            <h2 className="font-bold text-slate-900">Add Product Line</h2>
            <input
              className={field}
              placeholder="Product (pickle, papad, ghee…)"
              value={pickStr(lineForm, 'product')}
              onChange={(e) => setLineForm({ ...lineForm, product: e.target.value })}
            />
            <div className="grid grid-cols-2 gap-2">
              <input
                className={field}
                placeholder="Quantity (20 jars)"
                value={pickStr(lineForm, 'quantity')}
                onChange={(e) => setLineForm({ ...lineForm, quantity: e.target.value })}
              />
              <input
                className={field}
                type="number"
                placeholder="Price (₹)"
                value={pickStr(lineForm, 'pricePaisa')}
                onChange={(e) => setLineForm({ ...lineForm, pricePaisa: e.target.value })}
              />
            </div>
            <input
              className={field}
              type="number"
              placeholder="Monthly profit (₹)"
              value={pickStr(lineForm, 'monthlyProfit')}
              onChange={(e) => setLineForm({ ...lineForm, monthlyProfit: e.target.value })}
            />
            <div className="flex gap-2 pt-1">
              <button
                onClick={() => void saveLine()}
                disabled={busy || !pickStr(lineForm, 'product').trim()}
                className="px-4 py-2.5 bg-pink-600 hover:bg-pink-700 disabled:opacity-40 text-white font-bold text-xs rounded-xl"
              >
                {busy ? 'Saving…' : 'Add Line'}
              </button>
              <button
                onClick={() => setLineForm(null)}
                className="px-4 py-2.5 border border-slate-300 text-slate-600 font-bold text-xs rounded-xl"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {entryFor && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-xl w-full max-w-sm p-5 space-y-3">
            <h2 className="font-bold text-slate-900">
              Monthly figures — {pickStr(entryFor, 'product')} ({entryMonth})
            </h2>
            <input
              className={field}
              type="number"
              placeholder="Revenue (₹)"
              value={pickStr(entryFor, 'revenue')}
              onChange={(e) => setEntryFor({ ...entryFor, revenue: e.target.value })}
            />
            <input
              className={field}
              type="number"
              placeholder="Cost (₹)"
              value={pickStr(entryFor, 'cost')}
              onChange={(e) => setEntryFor({ ...entryFor, cost: e.target.value })}
            />
            <div className="flex gap-2 pt-1">
              <button
                onClick={() => void saveEntry()}
                disabled={busy}
                className="px-4 py-2.5 bg-pink-600 hover:bg-pink-700 disabled:opacity-40 text-white font-bold text-xs rounded-xl"
              >
                {busy ? 'Saving…' : 'Save'}
              </button>
              <button
                onClick={() => setEntryFor(null)}
                className="px-4 py-2.5 border border-slate-300 text-slate-600 font-bold text-xs rounded-xl"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {expenseFor && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-xl w-full max-w-sm p-5 space-y-3">
            <h2 className="font-bold text-slate-900">Add Expense ({entryMonth})</h2>
            <input
              className={field}
              placeholder="Note (jars & labels)"
              value={pickStr(expenseFor, 'note')}
              onChange={(e) => setExpenseFor({ ...expenseFor, note: e.target.value })}
            />
            <input
              className={field}
              type="number"
              placeholder="Amount (₹)"
              value={pickStr(expenseFor, 'amount')}
              onChange={(e) => setExpenseFor({ ...expenseFor, amount: e.target.value })}
            />
            <div className="flex gap-2 pt-1">
              <button
                onClick={() => void saveExpense()}
                disabled={busy || !pickStr(expenseFor, 'amount')}
                className="px-4 py-2.5 bg-pink-600 hover:bg-pink-700 disabled:opacity-40 text-white font-bold text-xs rounded-xl"
              >
                {busy ? 'Saving…' : 'Add Expense'}
              </button>
              <button
                onClick={() => setExpenseFor(null)}
                className="px-4 py-2.5 border border-slate-300 text-slate-600 font-bold text-xs rounded-xl"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
