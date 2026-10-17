import React, { useEffect, useState } from 'react';
import { Users, Plus, Pencil, Trash2, FileText, AlertCircle, CheckCircle2, X } from 'lucide-react';
import { dairy, apiErrorMessage } from '../../lib/api';
import { ModalSheet } from '../../components/common/ModalSheet';
import { StatusBadge } from '../../components/common/StatusBadge';
import { formatCurrency, formatDate } from '../../lib/utils';
import { asRec, nameOf, numOf, recArr, strOf } from './helpers';

const EMPTY_FORM = {
  name: '',
  phone: '',
  village: '',
  memberCode: '',
  farmerUid: '',
  defaultSpecies: 'cow',
  deduction: 0,
  status: 'active',
};

export const DairyMembersPage: React.FC = () => {
  const [members, setMembers] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Record<string, unknown> | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const [statementFor, setStatementFor] = useState<Record<string, unknown> | null>(null);
  const [statement, setStatement] = useState<Record<string, unknown> | null>(null);
  const [statementLoading, setStatementLoading] = useState(false);

  const reload = async () => {
    setLoading(true);
    setError(null);
    try {
      setMembers(recArr(await dairy.manager.members()));
    } catch (e) {
      setError(apiErrorMessage(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    reload();
  }, []);

  const openAdd = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setModalOpen(true);
  };

  const openEdit = (m: Record<string, unknown>) => {
    setEditing(m);
    setForm({
      name: strOf(m.name),
      phone: strOf(m.phone),
      village: strOf(m.village),
      memberCode: strOf(m.memberCode),
      farmerUid: strOf(m.farmerUid),
      defaultSpecies: strOf(m.defaultSpecies, 'cow') || 'cow',
      deduction: numOf(m.deduction),
      status: strOf(m.status, 'active') || 'active',
    });
    setModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      const payload: Record<string, unknown> = { ...form, deduction: Number(form.deduction) };
      if (editing) {
        await dairy.manager.updateMember(strOf(editing.id), payload);
        setNotice(`Member ${form.name} updated.`);
      } else {
        await dairy.manager.addMember(payload);
        setNotice(`Member ${form.name} added to the dairy.`);
      }
      setModalOpen(false);
      await reload();
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const handleRemove = async (m: Record<string, unknown>) => {
    if (!window.confirm(`Remove member ${nameOf(m)}? This cannot be undone.`)) return;
    setError(null);
    try {
      await dairy.manager.removeMember(strOf(m.id));
      setNotice(`Member ${nameOf(m)} removed.`);
      await reload();
    } catch (err) {
      setError(apiErrorMessage(err));
    }
  };

  const openStatement = async (m: Record<string, unknown>) => {
    setStatementFor(m);
    setStatement(null);
    setStatementLoading(true);
    try {
      setStatement(asRec(await dairy.manager.memberStatement(strOf(m.id))));
    } catch (err) {
      setStatement({ __error: apiErrorMessage(err) });
    } finally {
      setStatementLoading(false);
    }
  };

  const ledgerEntries = statement ? recArr(statement.entries ?? statement.ledger ?? statement.collections ?? statement.lines) : [];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 flex items-center gap-2">
            <Users className="w-7 h-7 text-emerald-600" />
            Dairy Member Passbook
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Member registry, linked farmer profiles and passbook statements
          </p>
        </div>
        <button
          onClick={openAdd}
          className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs flex items-center gap-1.5 self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" /> Add Member
        </button>
      </div>

      {error && (
        <div className="p-3 rounded-2xl bg-rose-50 border border-rose-200 text-xs font-bold text-rose-700 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" /> {error}
        </div>
      )}
      {notice && (
        <div className="p-3 rounded-2xl bg-emerald-50 border border-emerald-200 text-xs font-bold text-emerald-700 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" /> {notice}
        </div>
      )}

      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden">
        {loading ? (
          <p className="p-6 text-xs text-slate-400">Loading members…</p>
        ) : members.length === 0 ? (
          <p className="p-6 text-xs text-slate-400">No members yet. Add your first dairy member.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 text-slate-500 font-bold uppercase text-[10px] tracking-wider border-b border-slate-100">
                  <th className="py-3 px-5">Member</th>
                  <th className="py-3 px-3">Code</th>
                  <th className="py-3 px-3">Village</th>
                  <th className="py-3 px-3">Species</th>
                  <th className="py-3 px-3">Deduction/L</th>
                  <th className="py-3 px-3">Status</th>
                  <th className="py-3 px-5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {members.map((m) => (
                  <tr key={strOf(m.id)} className="hover:bg-slate-50/60">
                    <td className="py-3 px-5 font-bold text-slate-900">
                      {nameOf(m)}
                      <span className="text-[10px] text-slate-400 block font-semibold">{strOf(m.phone) || '—'}</span>
                    </td>
                    <td className="py-3 px-3 font-mono text-slate-600">{strOf(m.memberCode) || '—'}</td>
                    <td className="py-3 px-3 text-slate-600">{strOf(m.village) || '—'}</td>
                    <td className="py-3 px-3 capitalize text-slate-600">{strOf(m.defaultSpecies, 'cow')}</td>
                    <td className="py-3 px-3 text-slate-600">₹{numOf(m.deduction).toFixed(2)}</td>
                    <td className="py-3 px-3">
                      <StatusBadge status={strOf(m.status, 'active')} />
                    </td>
                    <td className="py-3 px-5 text-right">
                      <div className="inline-flex gap-1">
                        <button
                          onClick={() => openStatement(m)}
                          className="p-1.5 rounded-lg text-sky-600 hover:bg-sky-50"
                          title="Passbook statement"
                        >
                          <FileText className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => openEdit(m)}
                          className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100"
                          title="Edit"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleRemove(m)}
                          className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-50"
                          title="Remove"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add / Edit modal */}
      <ModalSheet
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? `Edit ${nameOf(editing)}` : 'Add Dairy Member'}
        description="Member details are used on collection slips and payout batches"
        maxWidth="md"
      >
        <form onSubmit={handleSave} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Full Name *</label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Phone</label>
              <input
                type="tel"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300"
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
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Member Code</label>
              <input
                type="text"
                value={form.memberCode}
                onChange={(e) => setForm({ ...form, memberCode: e.target.value })}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Default Species</label>
              <select
                value={form.defaultSpecies}
                onChange={(e) => setForm({ ...form, defaultSpecies: e.target.value })}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 bg-white"
              >
                <option value="cow">Cow</option>
                <option value="buffalo">Buffalo</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Deduction (₹/L)</label>
              <input
                type="number"
                step="0.05"
                min="0"
                value={form.deduction}
                onChange={(e) => setForm({ ...form, deduction: Number(e.target.value) })}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Linked Farmer UID</label>
              <input
                type="text"
                value={form.farmerUid}
                onChange={(e) => setForm({ ...form, farmerUid: e.target.value })}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Status</label>
              <select
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value })}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 bg-white"
              >
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>
          </div>
          <button
            type="submit"
            disabled={saving}
            className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white font-bold text-xs shadow-md"
          >
            {saving ? 'Saving…' : editing ? 'Save Changes' : 'Add Member'}
          </button>
        </form>
      </ModalSheet>

      {/* Statement modal */}
      <ModalSheet
        isOpen={Boolean(statementFor)}
        onClose={() => {
          setStatementFor(null);
          setStatement(null);
        }}
        title={statementFor ? `Passbook — ${nameOf(statementFor)}` : undefined}
        description={statementFor ? `Member code: ${strOf(statementFor.memberCode) || '—'}` : undefined}
        maxWidth="2xl"
      >
        {statementLoading ? (
          <p className="text-xs text-slate-400">Loading statement…</p>
        ) : !statement ? null : statement.__error ? (
          <p className="text-xs font-bold text-rose-600 flex items-center gap-2">
            <X className="w-4 h-4" /> {strOf(statement.__error)}
          </p>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { label: 'Total Liters', value: `${numOf(statement.totalLiters ?? asRec(statement.totals).totalLiters).toFixed(1)} L` },
                { label: 'Gross Amount', value: formatCurrency(numOf(statement.grossAmount ?? asRec(statement.totals).grossAmount)) },
                { label: 'Deductions', value: formatCurrency(numOf(statement.totalDeductions ?? asRec(statement.totals).deductions)) },
                {
                  label: 'Net Payable',
                  value: formatCurrency(numOf(statement.netAmount ?? statement.netPayable ?? asRec(statement.totals).netAmount)),
                },
              ].map((s) => (
                <div key={s.label} className="p-3 bg-slate-50 rounded-2xl border border-slate-100">
                  <p className="text-[10px] uppercase font-bold text-slate-400">{s.label}</p>
                  <p className="text-sm font-black text-slate-900">{s.value}</p>
                </div>
              ))}
            </div>

            {ledgerEntries.length === 0 ? (
              <p className="text-xs text-slate-400">No ledger entries in this statement period.</p>
            ) : (
              <div className="border border-slate-100 rounded-2xl overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="bg-slate-50 text-slate-500 font-bold uppercase text-[10px] border-b border-slate-100">
                      <th className="py-2.5 px-4">Date</th>
                      <th className="py-2.5 px-3">Shift</th>
                      <th className="py-2.5 px-3">Liters</th>
                      <th className="py-2.5 px-3">FAT/SNF</th>
                      <th className="py-2.5 px-3 text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {ledgerEntries.slice(0, 50).map((e, i) => (
                      <tr key={strOf(e.id) || i}>
                        <td className="py-2.5 px-4 text-slate-600">{formatDate(strOf(e.date))}</td>
                        <td className="py-2.5 px-3 capitalize text-slate-600">{strOf(e.shift)}</td>
                        <td className="py-2.5 px-3 font-bold text-slate-800">{numOf(e.liters)} L</td>
                        <td className="py-2.5 px-3 text-slate-600">
                          {numOf(e.fatPercent).toFixed(1)}% / {numOf(e.snfPercent).toFixed(1)}%
                        </td>
                        <td className="py-2.5 px-3 text-right font-bold text-emerald-800">
                          {formatCurrency(numOf(e.totalAmount ?? e.amount))}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </ModalSheet>
    </div>
  );
};

export default DairyMembersPage;
