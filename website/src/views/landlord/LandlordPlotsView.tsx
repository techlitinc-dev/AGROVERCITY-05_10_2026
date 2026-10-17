import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  FileSpreadsheet,
  FileSearch,
  Plus,
  Pencil,
  Trash2,
  MapPin,
  RefreshCw,
  X,
  Check,
  Wallet,
  ArrowLeft,
} from 'lucide-react';
import { land, apiErrorMessage } from '../../lib/api';
import { ModalSheet } from '../../components/common/ModalSheet';
import { StatusBadge } from '../../components/common/StatusBadge';
import { formatCurrency } from '../../lib/utils';
import { asArr, asRec, firstNum, firstStr, fmtDate, str, type Rec } from './utils';

interface PlotForm {
  name: string;
  village: string;
  district: string;
  areaAcres: number;
  gatNumber: string;
  soilType: string;
}

const EMPTY_FORM: PlotForm = {
  name: '',
  village: '',
  district: '',
  areaAcres: 2,
  gatNumber: '',
  soilType: '',
};

const EXPENSE_CATEGORIES = [
  'boundary_maintenance',
  'soil_health',
  'irrigation',
  'fencing',
  'land_preparation',
  'other',
];

/** /landlord/plots — CRUD for registered land plots + per-plot expenses. */
export const LandlordPlotsView: React.FC = () => {
  const [plots, setPlots] = useState<Rec[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Rec | null>(null);
  const [form, setForm] = useState<PlotForm>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const [expensesFor, setExpensesFor] = useState<Rec | null>(null);
  const [expenses, setExpenses] = useState<Rec[]>([]);
  const [expenseForm, setExpenseForm] = useState({ category: 'other', amountRupees: 0, expenseDate: '', note: '' });

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const p = await land.plots();
      setPlots(asArr(p).map(asRec));
    } catch (e) {
      setError(apiErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const flash = (msg: string) => {
    setNotice(msg);
    setTimeout(() => setNotice(null), 4000);
  };

  const openCreate = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setModalOpen(true);
  };

  const openEdit = (p: Rec) => {
    setEditing(p);
    setForm({
      name: firstStr(p, ['name', 'title'], ''),
      village: firstStr(p, ['village'], ''),
      district: firstStr(p, ['district'], ''),
      areaAcres: firstNum(p, ['areaAcres', 'acres', 'area'], 0),
      gatNumber: firstStr(p, ['gatNumber', 'surveyNumber', 'surveyNo'], ''),
      soilType: firstStr(p, ['soilType'], ''),
    });
    setModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      if (editing) {
        await land.updatePlot(str(editing.id), { ...form });
        flash('Plot updated.');
      } else {
        await land.addPlot({ ...form });
        flash('Plot registered.');
      }
      setModalOpen(false);
      await load();
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (p: Rec) => {
    if (!window.confirm(`Delete plot "${firstStr(p, ['title', 'name'], 'this plot')}"?`)) return;
    try {
      await land.removePlot(str(p.id));
      flash('Plot removed.');
      await load();
    } catch (err) {
      setError(apiErrorMessage(err));
    }
  };

  const openExpenses = async (p: Rec) => {
    setExpensesFor(p);
    setExpenses([]);
    try {
      const ex = await land.plotExpenses(str(p.id));
      setExpenses(asArr(ex).map(asRec));
    } catch {
      setExpenses([]);
    }
  };

  const handleAddExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!expensesFor) return;
    try {
      await land.addPlotExpense(str(expensesFor.id), {
        category: expenseForm.category,
        amountRupees: expenseForm.amountRupees,
        expenseDate: expenseForm.expenseDate || undefined,
        note: expenseForm.note || undefined,
      });
      setExpenseForm({ category: 'other', amountRupees: 0, expenseDate: '', note: '' });
      const ex = await land.plotExpenses(str(expensesFor.id));
      setExpenses(asArr(ex).map(asRec));
      flash('Expense recorded.');
    } catch (err) {
      setError(apiErrorMessage(err));
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <Link to="/landlord" className="text-xs text-slate-400 hover:text-slate-600 flex items-center gap-1 mb-1">
            <ArrowLeft className="w-3.5 h-3.5" /> Landlord Home
          </Link>
          <h1 className="text-2xl font-extrabold text-slate-900 flex items-center gap-2">
            <FileSpreadsheet className="w-7 h-7 text-emerald-600" />
            My Land Plots
          </h1>
          <p className="text-xs text-slate-500 mt-1">Register plots, track area/records, and log plot-level expenses</p>
        </div>
        <div className="flex gap-2 self-start sm:self-auto">
          <Link
            to="/farmer/712"
            className="px-4 py-2.5 rounded-2xl border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold text-xs flex items-center gap-2 transition-all"
            title="Search official 7/12 land records and import them into your profile"
          >
            <FileSearch className="w-4 h-4 text-sky-600" />
            <span>Search 7/12 Record</span>
          </Link>
          <button
            onClick={load}
            className="p-2.5 rounded-2xl border border-slate-200 text-slate-500 hover:bg-slate-50"
            title="Refresh"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={openCreate}
            className="px-4 py-2.5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md flex items-center gap-2 transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>Register Plot</span>
          </button>
        </div>
      </div>

      {notice && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl text-xs font-bold text-emerald-900 flex items-center gap-2">
          <Check className="w-5 h-5 text-emerald-600" />
          <span>{notice}</span>
        </div>
      )}
      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl text-xs font-bold text-rose-800 flex items-center justify-between gap-2">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="p-1 hover:bg-rose-100 rounded-full">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {plots.length === 0 && !loading ? (
        <div className="p-10 bg-white rounded-3xl border border-dashed border-slate-300 text-center space-y-2">
          <p className="text-sm font-bold text-slate-700">No plots registered yet</p>
          <p className="text-xs text-slate-500">Register your farm plots to list them for lease and track expenses.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {plots.map((p) => (
            <div key={str(p.id) || JSON.stringify(p).slice(0, 24)} className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs space-y-4">
              <div className="flex items-start justify-between gap-3 border-b border-slate-100 pb-3">
                <div>
                  <h4 className="font-extrabold text-base text-slate-900">{firstStr(p, ['title', 'name'], 'Plot')}</h4>
                  <p className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                    <MapPin className="w-3.5 h-3.5 text-slate-400" />
                    {firstStr(p, ['village'], '—')}, {firstStr(p, ['district'], '—')} ({firstStr(p, ['surveyNumber', 'gatNumber', 'surveyNo'], '—')})
                  </p>
                </div>
                <StatusBadge status={firstStr(p, ['status'], 'active')} />
              </div>

              <div className="grid grid-cols-3 gap-3 text-xs">
                <div className="p-3 bg-slate-50 rounded-2xl">
                  <span className="text-slate-400 text-[10px] uppercase font-bold">Area</span>
                  <p className="font-bold text-slate-900">{firstNum(p, ['areaAcres', 'acres', 'area'], 0)} Acres</p>
                </div>
                <div className="p-3 bg-slate-50 rounded-2xl">
                  <span className="text-slate-400 text-[10px] uppercase font-bold">Soil</span>
                  <p className="font-bold text-slate-900 truncate">{firstStr(p, ['soilType'], '—')}</p>
                </div>
                <div className="p-3 bg-slate-50 rounded-2xl">
                  <span className="text-slate-400 text-[10px] uppercase font-bold">Gat No.</span>
                  <p className="font-bold text-slate-900">{firstStr(p, ['gatNumber', 'surveyNumber'], '—')}</p>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-1">
                <button
                  onClick={() => openExpenses(p)}
                  className="px-3 py-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold text-xs flex items-center gap-1"
                >
                  <Wallet className="w-3.5 h-3.5" /> Expenses
                </button>
                <button
                  onClick={() => openEdit(p)}
                  className="px-3 py-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold text-xs flex items-center gap-1"
                >
                  <Pencil className="w-3.5 h-3.5" /> Edit
                </button>
                <button
                  onClick={() => handleDelete(p)}
                  className="px-3 py-2 rounded-xl border border-rose-200 text-rose-700 hover:bg-rose-50 font-bold text-xs flex items-center gap-1"
                >
                  <Trash2 className="w-3.5 h-3.5" /> Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create / Edit Modal */}
      <ModalSheet
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? 'Edit Plot' : 'Register New Plot'}
        description="Plot details are used for lease listings and record verification"
        maxWidth="md"
      >
        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Plot Name</label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300"
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Gat / Survey No.</label>
              <input
                type="text"
                value={form.gatNumber}
                onChange={(e) => setForm({ ...form, gatNumber: e.target.value })}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Area (Acres)</label>
              <input
                type="number"
                step="0.1"
                value={form.areaAcres}
                onChange={(e) => setForm({ ...form, areaAcres: Number(e.target.value) })}
                className="w-full px-3 py-2 text-sm font-bold rounded-xl border border-slate-300"
                required
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Village</label>
              <input
                type="text"
                value={form.village}
                onChange={(e) => setForm({ ...form, village: e.target.value })}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">District</label>
              <input
                type="text"
                value={form.district}
                onChange={(e) => setForm({ ...form, district: e.target.value })}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300"
                required
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Soil Type</label>
            <input
              type="text"
              value={form.soilType}
              onChange={(e) => setForm({ ...form, soilType: e.target.value })}
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300"
            />
          </div>
          <button
            type="submit"
            disabled={saving}
            className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md disabled:opacity-60"
          >
            {saving ? 'Saving…' : editing ? 'Save Changes' : 'Register Plot'}
          </button>
        </form>
      </ModalSheet>

      {/* Expenses Modal */}
      <ModalSheet
        isOpen={!!expensesFor}
        onClose={() => setExpensesFor(null)}
        title={expensesFor ? `Plot Expenses — ${firstStr(expensesFor, ['title', 'name'], 'Plot')}` : 'Plot Expenses'}
        description="Log maintenance, input, and improvement costs per plot"
        maxWidth="md"
      >
        <div className="space-y-4">
          <form onSubmit={handleAddExpense} className="space-y-3 p-4 bg-slate-50 rounded-2xl border border-slate-100">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Category</label>
                <select
                  value={expenseForm.category}
                  onChange={(e) => setExpenseForm({ ...expenseForm, category: e.target.value })}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 bg-white"
                  required
                >
                  {EXPENSE_CATEGORIES.map((c) => (
                    <option key={c} value={c}>{c.replace(/_/g, ' ')}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Amount (₹)</label>
                <input
                  type="number"
                  value={expenseForm.amountRupees}
                  onChange={(e) => setExpenseForm({ ...expenseForm, amountRupees: Number(e.target.value) })}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 bg-white"
                  required
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Date</label>
              <input
                type="date"
                value={expenseForm.expenseDate}
                onChange={(e) => setExpenseForm({ ...expenseForm, expenseDate: e.target.value })}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 bg-white"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Note</label>
              <input
                type="text"
                value={expenseForm.note}
                onChange={(e) => setExpenseForm({ ...expenseForm, note: e.target.value })}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 bg-white"
              />
            </div>
            <button type="submit" className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs">
              Add Expense
            </button>
          </form>

          <div className="space-y-2">
            {expenses.length === 0 ? (
              <p className="text-xs text-slate-400 text-center py-4">No expenses logged for this plot.</p>
            ) : (
              expenses.map((ex) => (
                <div key={str(ex.id) || JSON.stringify(ex).slice(0, 24)} className="flex items-center justify-between p-3 bg-white rounded-2xl border border-slate-100 text-xs">
                  <div>
                    <p className="font-bold text-slate-800">{firstStr(ex, ['category', 'title'], 'Expense').replace(/_/g, ' ')}</p>
                    <p className="text-slate-400">{fmtDate(ex.expenseDate ?? ex.date ?? ex.createdAt)} {str(ex.note ?? ex.notes, '') !== '—' ? `• ${str(ex.note ?? ex.notes)}` : ''}</p>
                  </div>
                  <span className="font-bold text-rose-700">
                    {formatCurrency(
                      firstNum(ex, ['amountRupees', 'amount'], 0) ||
                        firstNum(ex, ['amountPaisa'], 0) / 100
                    )}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </ModalSheet>
    </div>
  );
};
