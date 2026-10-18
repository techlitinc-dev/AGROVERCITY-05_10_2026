import React, { useEffect, useMemo, useState } from 'react';
import {
  Milk,
  Plus,
  Pencil,
  Trash2,
  CalendarDays,
  FileText,
  Send,
  IndianRupee,
  AlertCircle,
  CheckCircle2,
  Users,
  ClipboardList,
  BarChart3,
} from 'lucide-react';
import { milkSeller, readOne, apiErrorMessage } from '../../lib/api';
import { ModalSheet } from '../../components/common/ModalSheet';
import { StatusBadge } from '../../components/common/StatusBadge';
import { StatCard } from '../../components/common/StatCard';
import { formatCurrency, formatDate } from '../../lib/utils';
import { asRec, nameOf, numOf, recArr, strOf, todayStr, monthStr } from './helpers';

type Tab = 'clients' | 'deliveries' | 'bills' | 'analytics';

const EMPTY_CLIENT = {
  name: '',
  phone: '',
  address: '',
  deliverySlot: 'Morning',
  milkType: 'Cow',
  defaultQuantityLiters: 1,
  ratePerLiter: 60,
  startDate: '',
  notes: '',
};

export const MilkSellerDesk: React.FC<{ initialTab?: Tab }> = ({ initialTab = 'deliveries' }) => {
  const [tab, setTab] = useState<Tab>(initialTab);
  const [clients, setClients] = useState<Record<string, unknown>[]>([]);
  const [deliveries, setDeliveries] = useState<Record<string, unknown>[]>([]);
  const [bills, setBills] = useState<Record<string, unknown>[]>([]);
  const [analytics, setAnalytics] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // client modal
  const [clientModal, setClientModal] = useState(false);
  const [editingClient, setEditingClient] = useState<Record<string, unknown> | null>(null);
  const [clientForm, setClientForm] = useState(EMPTY_CLIENT);

  // calendar modal
  const [calendarFor, setCalendarFor] = useState<Record<string, unknown> | null>(null);
  const [calMonth, setCalMonth] = useState(monthStr());
  const [calendar, setCalendar] = useState<Record<string, unknown> | null>(null);
  const [calLoading, setCalLoading] = useState(false);

  // delivery modals
  const [delivModal, setDelivModal] = useState(false);
  const [delivForm, setDelivForm] = useState({
    clientId: '',
    date: todayStr(),
    status: 'delivered',
    quantityLiters: 1,
    note: '',
  });
  const [bulkModal, setBulkModal] = useState(false);
  const [bulkDate, setBulkDate] = useState(todayStr());
  const [bulkRows, setBulkRows] = useState<Record<string, unknown>[]>([]);
  const [bulkMissed, setBulkMissed] = useState(false);
  const [delivFrom, setDelivFrom] = useState('');
  const [delivTo, setDelivTo] = useState('');

  // bill modals
  const [billModal, setBillModal] = useState(false);
  const [billForm, setBillForm] = useState({ clientId: '', month: monthStr(), adjustmentsRupees: 0, note: '' });
  const [payFor, setPayFor] = useState<Record<string, unknown> | null>(null);
  const [payForm, setPayForm] = useState({ amount: 0, method: 'cash', note: '' });

  const [anaMonth, setAnaMonth] = useState(monthStr());

  const reload = async () => {
    setLoading(true);
    setError(null);
    try {
      const [c, d, b] = await Promise.all([
        milkSeller.clients(),
        milkSeller.deliveries(delivFrom || delivTo ? { fromDate: delivFrom || undefined, toDate: delivTo || undefined } : undefined),
        milkSeller.bills(),
      ]);
      setClients(recArr(c));
      setDeliveries(recArr(d));
      setBills(recArr(b));
    } catch (e) {
      setError(apiErrorMessage(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [delivFrom, delivTo]);

  useEffect(() => {
    if (tab !== 'analytics') return;
    (async () => {
      try {
        // milkSeller.analytics() takes no params in lib/api; backend supports ?month=
        setAnalytics(asRec(await readOne<unknown>('/milk-seller/analytics', { params: { month: anaMonth } })));
      } catch (e) {
        setError(apiErrorMessage(e));
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, anaMonth]);

  const flash = async (msg: string) => {
    setNotice(msg);
    await reload();
  };

  /* ------------------------------- clients ------------------------------- */

  const openAddClient = () => {
    setEditingClient(null);
    setClientForm({ ...EMPTY_CLIENT, startDate: todayStr() });
    setClientModal(true);
  };

  const openEditClient = (c: Record<string, unknown>) => {
    setEditingClient(c);
    setClientForm({
      name: strOf(c.name),
      phone: strOf(c.phone),
      address: strOf(c.address),
      deliverySlot: strOf(c.deliverySlot, 'Morning') || 'Morning',
      milkType: strOf(c.milkType, 'Cow') || 'Cow',
      defaultQuantityLiters: numOf(c.defaultQuantityLiters, 1),
      ratePerLiter: numOf(c.ratePerLiter, 60),
      startDate: strOf(c.startDate),
      notes: strOf(c.notes),
    });
    setClientModal(true);
  };

  const saveClient = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const payload: Record<string, unknown> = {
        ...clientForm,
        defaultQuantityLiters: Number(clientForm.defaultQuantityLiters),
        ratePerLiter: Number(clientForm.ratePerLiter),
        startDate: clientForm.startDate || undefined,
      };
      if (editingClient) {
        await milkSeller.updateClient(strOf(editingClient.id), payload);
        await flash(`Client ${clientForm.name} updated.`);
      } else {
        await milkSeller.addClient(payload);
        await flash(`Client ${clientForm.name} added.`);
      }
      setClientModal(false);
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const removeClient = async (c: Record<string, unknown>) => {
    if (!window.confirm(`Remove client ${nameOf(c)}?`)) return;
    setError(null);
    try {
      await milkSeller.removeClient(strOf(c.id));
      await flash(`Client ${nameOf(c)} removed.`);
    } catch (err) {
      setError(apiErrorMessage(err));
    }
  };

  const openCalendar = async (c: Record<string, unknown>, month: string) => {
    setCalendarFor(c);
    setCalMonth(month);
    setCalLoading(true);
    setCalendar(null);
    try {
      setCalendar(asRec(await milkSeller.clientCalendar(strOf(c.id))));
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setCalLoading(false);
    }
  };

  /* ----------------------------- deliveries ------------------------------ */

  const saveDelivery = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await milkSeller.recordDelivery({
        clientId: delivForm.clientId,
        date: delivForm.date,
        status: delivForm.status,
        quantityLiters: delivForm.status === 'delivered' ? Number(delivForm.quantityLiters) : undefined,
        note: delivForm.note,
      });
      setDelivModal(false);
      await flash('Delivery recorded.');
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const openBulk = () => {
    setBulkDate(todayStr());
    setBulkMissed(false);
    setBulkRows(
      clients
        .filter((c) => strOf(c.status, 'active') === 'active')
        .map((c) => ({
          clientId: strOf(c.id),
          name: nameOf(c),
          status: 'delivered',
          quantityLiters: numOf(c.defaultQuantityLiters, 0),
          note: '',
        })),
    );
    setBulkModal(true);
  };

  const saveBulk = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await milkSeller.recordBulkDeliveries({
        date: bulkDate,
        markUnlistedMissed: bulkMissed,
        entries: bulkRows.map((r) => ({
          clientId: strOf(r.clientId),
          status: strOf(r.status, 'delivered'),
          quantityLiters: strOf(r.status, 'delivered') === 'delivered' ? Number(r.quantityLiters) : undefined,
          note: strOf(r.note),
        })),
      });
      setBulkModal(false);
      await flash(`Bulk entries saved for ${bulkDate}.`);
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  /* -------------------------------- bills -------------------------------- */

  const saveBill = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await milkSeller.generateBill({
        clientId: billForm.clientId,
        month: billForm.month,
        adjustmentsRupees: Number(billForm.adjustmentsRupees),
        note: billForm.note,
      });
      setBillModal(false);
      await flash(`Bill generated for ${billForm.month}.`);
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const sendBill = async (b: Record<string, unknown>) => {
    setError(null);
    try {
      await milkSeller.sendBill(strOf(b.id));
      await flash(`Bill ${strOf(b.id)} sent to client.`);
    } catch (err) {
      setError(apiErrorMessage(err));
    }
  };

  const savePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!payFor) return;
    setSaving(true);
    setError(null);
    try {
      await milkSeller.recordBillPayment(strOf(payFor.id), {
        amount: Number(payForm.amount),
        method: payForm.method,
        note: payForm.note,
      });
      setPayFor(null);
      await flash(`Payment recorded against ${strOf(payFor.id)}.`);
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const clientName = useMemo(() => {
    const map: Record<string, string> = {};
    clients.forEach((c) => {
      map[strOf(c.id)] = nameOf(c);
    });
    return map;
  }, [clients]);

  const calDays = recArr(calendar?.days);
  const calSummary = asRec(calendar?.summary);
  const monthToDate = asRec(analytics?.monthToDate);
  const money = asRec(analytics?.money);
  const perClient = recArr(analytics?.topClients ?? analytics?.perClient);
  const trend = recArr(analytics?.monthlyTrend ?? analytics?.trend);

  const dayCellColor = (status: string) => {
    if (status === 'delivered') return 'bg-emerald-100 text-emerald-800 border-emerald-200';
    if (status === 'missed') return 'bg-rose-100 text-rose-700 border-rose-200';
    if (status === 'holiday') return 'bg-sky-100 text-sky-700 border-sky-200';
    return 'bg-slate-50 text-slate-400 border-slate-100';
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 flex items-center gap-2">
            <Milk className="w-7 h-7 text-emerald-600" />
            Milk Seller Desk
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Doorstep milk delivery business — clients, daily entries, punch-card calendars, monthly bills & collections
          </p>
        </div>
        <div className="flex bg-slate-100 p-1 rounded-2xl self-start sm:self-auto overflow-x-auto no-scrollbar">
          {(
            [
              { id: 'clients', label: 'Clients' },
              { id: 'deliveries', label: 'Deliveries' },
              { id: 'bills', label: 'Bills' },
              { id: 'analytics', label: 'Analytics' },
            ] as { id: Tab; label: string }[]
          ).map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                tab === t.id ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
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

      {loading ? (
        <p className="text-xs text-slate-400">Loading…</p>
      ) : (
        <>
          {tab === 'clients' && (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
                  <Users className="w-4 h-4 text-emerald-600" /> Delivery Clients ({clients.length})
                </h3>
                <button
                  onClick={openAddClient}
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs flex items-center gap-1.5"
                >
                  <Plus className="w-4 h-4" /> Add Client
                </button>
              </div>
              {clients.length === 0 ? (
                <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs p-8 text-center text-xs text-slate-400">
                  No clients yet — add households you deliver milk to.
                </div>
              ) : (
                <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="bg-slate-50 text-slate-500 font-bold uppercase text-[10px] tracking-wider border-b border-slate-100">
                          <th className="py-3 px-5">Client</th>
                          <th className="py-3 px-3">Slot • Milk</th>
                          <th className="py-3 px-3">Default Qty</th>
                          <th className="py-3 px-3">Rate/L</th>
                          <th className="py-3 px-3">Since</th>
                          <th className="py-3 px-3">Status</th>
                          <th className="py-3 px-5 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {clients.map((c) => (
                          <tr key={strOf(c.id)} className="hover:bg-slate-50/60">
                            <td className="py-3 px-5 font-bold text-slate-900">
                              {nameOf(c)}
                              <span className="text-[10px] text-slate-400 block font-semibold">
                                {strOf(c.phone) || strOf(c.address) || '—'}
                              </span>
                            </td>
                            <td className="py-3 px-3 text-slate-600">
                              {strOf(c.deliverySlot)} • {strOf(c.milkType)}
                            </td>
                            <td className="py-3 px-3 text-slate-700">{numOf(c.defaultQuantityLiters)} L</td>
                            <td className="py-3 px-3 font-bold text-slate-800">₹{numOf(c.ratePerLiter).toFixed(2)}</td>
                            <td className="py-3 px-3 text-slate-600">{formatDate(strOf(c.startDate))}</td>
                            <td className="py-3 px-3">
                              <StatusBadge status={strOf(c.status, 'active')} />
                            </td>
                            <td className="py-3 px-5 text-right">
                              <div className="inline-flex gap-1">
                                <button
                                  onClick={() => openCalendar(c, monthStr())}
                                  className="p-1.5 rounded-lg text-sky-600 hover:bg-sky-50"
                                  title="Punch calendar"
                                >
                                  <CalendarDays className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => openEditClient(c)}
                                  className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100"
                                  title="Edit"
                                >
                                  <Pencil className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => removeClient(c)}
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
                </div>
              )}
            </div>
          )}

          {tab === 'deliveries' && (
            <div className="space-y-4">
              <div className="flex flex-wrap justify-between items-center gap-2">
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
                    <ClipboardList className="w-4 h-4 text-emerald-600" /> Delivery Entries ({deliveries.length})
                  </h3>
                  <input
                    type="date"
                    value={delivFrom}
                    onChange={(e) => setDelivFrom(e.target.value)}
                    className="px-2.5 py-1.5 text-xs rounded-xl border border-slate-300 bg-white"
                    title="From date"
                  />
                  <input
                    type="date"
                    value={delivTo}
                    onChange={(e) => setDelivTo(e.target.value)}
                    className="px-2.5 py-1.5 text-xs rounded-xl border border-slate-300 bg-white"
                    title="To date"
                  />
                  {(delivFrom || delivTo) && (
                    <button
                      onClick={() => {
                        setDelivFrom('');
                        setDelivTo('');
                      }}
                      className="text-xs font-bold text-slate-400 hover:text-rose-600"
                    >
                      Clear
                    </button>
                  )}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={openBulk}
                    disabled={clients.length === 0}
                    className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 disabled:opacity-50 text-slate-700 font-bold text-xs"
                  >
                    Bulk Mark Day
                  </button>
                  <button
                    onClick={() => {
                      setDelivForm({ clientId: strOf(clients[0]?.id), date: todayStr(), status: 'delivered', quantityLiters: 1, note: '' });
                      setDelivModal(true);
                    }}
                    disabled={clients.length === 0}
                    className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold text-xs flex items-center gap-1.5"
                  >
                    <Plus className="w-4 h-4" /> Record Entry
                  </button>
                </div>
              </div>
              {deliveries.length === 0 ? (
                <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs p-8 text-center text-xs text-slate-400">
                  No delivery entries in this range.
                </div>
              ) : (
                <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="bg-slate-50 text-slate-500 font-bold uppercase text-[10px] tracking-wider border-b border-slate-100">
                          <th className="py-3 px-5">Date</th>
                          <th className="py-3 px-3">Client</th>
                          <th className="py-3 px-3">Status</th>
                          <th className="py-3 px-3">Liters</th>
                          <th className="py-3 px-3">Amount</th>
                          <th className="py-3 px-3">Note</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {deliveries.slice(0, 100).map((d) => (
                          <tr key={strOf(d.id)} className="hover:bg-slate-50/60">
                            <td className="py-3 px-5 font-bold text-slate-700">{formatDate(strOf(d.date))}</td>
                            <td className="py-3 px-3 font-bold text-slate-900">{clientName[strOf(d.clientId)] || nameOf(d)}</td>
                            <td className="py-3 px-3">
                              <StatusBadge status={strOf(d.status)} />
                            </td>
                            <td className="py-3 px-3 text-slate-700">{numOf(d.quantityLiters)} L</td>
                            <td className="py-3 px-3 font-bold text-emerald-800">{formatCurrency(numOf(d.amountRupees))}</td>
                            <td className="py-3 px-3 text-slate-500 max-w-[180px] truncate">{strOf(d.note) || '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {tab === 'bills' && (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
                  <FileText className="w-4 h-4 text-emerald-600" /> Monthly Bills ({bills.length})
                </h3>
                <button
                  onClick={() => {
                    setBillForm({ clientId: strOf(clients[0]?.id), month: monthStr(), adjustmentsRupees: 0, note: '' });
                    setBillModal(true);
                  }}
                  disabled={clients.length === 0}
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold text-xs flex items-center gap-1.5"
                >
                  <Plus className="w-4 h-4" /> Generate Bill
                </button>
              </div>
              {bills.length === 0 ? (
                <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs p-8 text-center text-xs text-slate-400">
                  No bills yet — generate a monthly bill per client to start collections.
                </div>
              ) : (
                <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="bg-slate-50 text-slate-500 font-bold uppercase text-[10px] tracking-wider border-b border-slate-100">
                          <th className="py-3 px-5">Bill</th>
                          <th className="py-3 px-3">Client</th>
                          <th className="py-3 px-3">Month</th>
                          <th className="py-3 px-3">Amount</th>
                          <th className="py-3 px-3">Paid</th>
                          <th className="py-3 px-3">Status</th>
                          <th className="py-3 px-5 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {bills.map((b) => {
                          const summary = asRec(b.summary);
                          const total = numOf(summary.totalRupees, numOf(b.totalRupees));
                          const paid = numOf(b.paidAmountRupees);
                          return (
                            <tr key={strOf(b.id)} className="hover:bg-slate-50/60">
                              <td className="py-3 px-5 font-mono font-bold text-slate-900">{strOf(b.id)}</td>
                              <td className="py-3 px-3 font-bold text-slate-900">{clientName[strOf(b.clientId)] || nameOf(b)}</td>
                              <td className="py-3 px-3 text-slate-600">{strOf(b.month)}</td>
                              <td className="py-3 px-3 font-bold text-slate-800">{formatCurrency(total)}</td>
                              <td className="py-3 px-3 text-emerald-700 font-bold">{formatCurrency(paid)}</td>
                              <td className="py-3 px-3">
                                <StatusBadge status={strOf(b.status, 'draft')} />
                              </td>
                              <td className="py-3 px-5 text-right">
                                <div className="inline-flex gap-1">
                                  {['draft', 'sent', 'partial'].includes(strOf(b.status, 'draft')) && (
                                    <>
                                      <button
                                        onClick={() => {
                                          setPayFor(b);
                                          setPayForm({ amount: Math.max(0, Math.round(total - paid)), method: 'cash', note: '' });
                                        }}
                                        className="p-1.5 rounded-lg text-emerald-700 hover:bg-emerald-50"
                                        title="Record payment"
                                      >
                                        <IndianRupee className="w-4 h-4" />
                                      </button>
                                      <button
                                        onClick={() => sendBill(b)}
                                        className="p-1.5 rounded-lg text-sky-600 hover:bg-sky-50"
                                        title="Send bill"
                                      >
                                        <Send className="w-4 h-4" />
                                      </button>
                                    </>
                                  )}
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {tab === 'analytics' && (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
                  <BarChart3 className="w-4 h-4 text-emerald-600" /> Delivery Analytics
                </h3>
                <input
                  type="month"
                  value={anaMonth}
                  onChange={(e) => setAnaMonth(e.target.value)}
                  className="px-3 py-1.5 text-xs rounded-xl border border-slate-300 bg-white"
                />
              </div>
              {!analytics ? (
                <p className="text-xs text-slate-400">Loading analytics…</p>
              ) : (
                <>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    <StatCard
                      title="Month Liters"
                      value={`${numOf(monthToDate.totalLiters).toLocaleString('en-IN')} L`}
                      subtitle={`${numOf(monthToDate.deliveredDays)} delivered days`}
                      icon={Milk}
                      colorScheme="blue"
                    />
                    <StatCard
                      title="Billed"
                      value={formatCurrency(numOf(money.billedRupees))}
                      icon={FileText}
                      colorScheme="purple"
                    />
                    <StatCard
                      title="Collected"
                      value={formatCurrency(numOf(money.collectedRupees))}
                      icon={CheckCircle2}
                      colorScheme="green"
                    />
                    <StatCard
                      title="Outstanding"
                      value={formatCurrency(numOf(money.outstandingRupees))}
                      subtitle={
                        numOf(monthToDate.deliveryRatePercent) > 0
                          ? `${numOf(monthToDate.deliveryRatePercent).toFixed(1)}% delivery rate`
                          : `${numOf(monthToDate.unmarkedDays)} unmarked days`
                      }
                      icon={AlertCircle}
                      colorScheme="amber"
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs p-5">
                      <h4 className="font-bold text-sm text-slate-900 mb-3">Top clients (billed)</h4>
                      {perClient.length === 0 ? (
                        <p className="text-xs text-slate-400">No client activity this month.</p>
                      ) : (
                        <div className="space-y-2">
                          {perClient.slice(0, 6).map((p) => (
                            <div key={strOf(p.clientId)} className="flex justify-between text-xs border-b border-slate-50 pb-2">
                              <span className="font-bold text-slate-700">{nameOf(p)}</span>
                              <span className="text-slate-600">
                                {numOf(p.liters).toFixed(1)} L • {formatCurrency(numOf(p.billedRupees))}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs p-5">
                      <h4 className="font-bold text-sm text-slate-900 mb-3">6-month liters trend</h4>
                      {trend.length === 0 ? (
                        <p className="text-xs text-slate-400">No trend data yet.</p>
                      ) : (
                        <div className="space-y-2">
                          {trend.map((t) => (
                            <div key={strOf(t.month)} className="flex items-center gap-2 text-xs">
                              <span className="w-14 font-bold text-slate-600">{strOf(t.month)}</span>
                              <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                                <div
                                  className="h-full bg-emerald-500 rounded-full"
                                  style={{
                                    width: `${Math.min(
                                      100,
                                      (numOf(t.liters) /
                                        Math.max(1, ...trend.map((x) => numOf(asRec(x).liters)))) *
                                        100,
                                    ).toFixed(1)}%`,
                                  }}
                                />
                              </div>
                              <span className="w-16 text-right font-bold text-slate-700">
                                {numOf(t.liters).toFixed(0)} L
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>
          )}
        </>
      )}

      {/* Client modal */}
      <ModalSheet
        isOpen={clientModal}
        onClose={() => setClientModal(false)}
        title={editingClient ? `Edit ${nameOf(editingClient)}` : 'Add Delivery Client'}
        maxWidth="md"
      >
        <form onSubmit={saveClient} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Name *</label>
              <input
                type="text"
                value={clientForm.name}
                onChange={(e) => setClientForm({ ...clientForm, name: e.target.value })}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Phone</label>
              <input
                type="tel"
                value={clientForm.phone}
                onChange={(e) => setClientForm({ ...clientForm, phone: e.target.value })}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Address</label>
            <input
              type="text"
              value={clientForm.address}
              onChange={(e) => setClientForm({ ...clientForm, address: e.target.value })}
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Delivery Slot</label>
              <select
                value={clientForm.deliverySlot}
                onChange={(e) => setClientForm({ ...clientForm, deliverySlot: e.target.value })}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 bg-white"
              >
                <option value="Morning">Morning</option>
                <option value="Evening">Evening</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Milk Type</label>
              <select
                value={clientForm.milkType}
                onChange={(e) => setClientForm({ ...clientForm, milkType: e.target.value })}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 bg-white"
              >
                <option value="Cow">Cow</option>
                <option value="Buffalo">Buffalo</option>
                <option value="Mixed">Mixed</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Default Qty (L) *</label>
              <input
                type="number"
                step="0.25"
                min="0.25"
                max="100"
                value={clientForm.defaultQuantityLiters}
                onChange={(e) => setClientForm({ ...clientForm, defaultQuantityLiters: Number(e.target.value) })}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Rate ₹/L *</label>
              <input
                type="number"
                step="0.5"
                min="1"
                value={clientForm.ratePerLiter}
                onChange={(e) => setClientForm({ ...clientForm, ratePerLiter: Number(e.target.value) })}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Start Date</label>
              <input
                type="date"
                value={clientForm.startDate}
                onChange={(e) => setClientForm({ ...clientForm, startDate: e.target.value })}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Notes</label>
            <input
              type="text"
              value={clientForm.notes}
              onChange={(e) => setClientForm({ ...clientForm, notes: e.target.value })}
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300"
            />
          </div>
          <button
            type="submit"
            disabled={saving}
            className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white font-bold text-xs shadow-md"
          >
            {saving ? 'Saving…' : editingClient ? 'Save Changes' : 'Add Client'}
          </button>
        </form>
      </ModalSheet>

      {/* Calendar modal */}
      <ModalSheet
        isOpen={Boolean(calendarFor)}
        onClose={() => setCalendarFor(null)}
        title={calendarFor ? `Punch Card — ${nameOf(calendarFor)}` : undefined}
        maxWidth="2xl"
      >
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <input
              type="month"
              value={calMonth}
              onChange={(e) => {
                setCalMonth(e.target.value);
                if (calendarFor) openCalendar(calendarFor, e.target.value);
              }}
              className="px-3 py-1.5 text-xs rounded-xl border border-slate-300 bg-white"
            />
            {calLoading && <span className="text-xs text-slate-400">Loading…</span>}
          </div>
          {calendar && (
            <>
              <div className="flex flex-wrap gap-4 text-xs">
                <span className="font-bold text-emerald-700">
                  {numOf(calSummary.deliveredDays)} delivered
                </span>
                <span className="font-bold text-rose-600">{numOf(calSummary.missedDays)} missed</span>
                <span className="font-bold text-slate-500">{numOf(calSummary.unmarkedDays)} unmarked</span>
                <span className="font-bold text-slate-800 ml-auto">
                  {numOf(calSummary.totalLiters).toFixed(1)} L • {formatCurrency(numOf(calSummary.totalRupees))}
                </span>
              </div>
              <div className="grid grid-cols-7 gap-1.5">
                {calDays.map((d) => (
                  <div
                    key={strOf(d.date)}
                    title={`${strOf(d.date)} — ${strOf(d.status)}${strOf(d.note) ? ` (${strOf(d.note)})` : ''}`}
                    className={`aspect-square rounded-lg border flex flex-col items-center justify-center text-[10px] font-bold ${dayCellColor(
                      strOf(d.status),
                    )}`}
                  >
                    <span>{strOf(d.date).slice(8)}</span>
                    {strOf(d.status) === 'delivered' && (
                      <span className="text-[8px] font-semibold opacity-80">{numOf(d.quantityLiters)}L</span>
                    )}
                  </div>
                ))}
              </div>
              <div className="flex flex-wrap gap-3 text-[10px] text-slate-500">
                <span className="inline-flex items-center gap-1">
                  <span className="w-3 h-3 rounded bg-emerald-100 border border-emerald-200" /> Delivered
                </span>
                <span className="inline-flex items-center gap-1">
                  <span className="w-3 h-3 rounded bg-rose-100 border border-rose-200" /> Missed
                </span>
                <span className="inline-flex items-center gap-1">
                  <span className="w-3 h-3 rounded bg-sky-100 border border-sky-200" /> Holiday
                </span>
                <span className="inline-flex items-center gap-1">
                  <span className="w-3 h-3 rounded bg-slate-50 border border-slate-100" /> Unmarked
                </span>
              </div>
            </>
          )}
        </div>
      </ModalSheet>

      {/* Single delivery modal */}
      <ModalSheet
        isOpen={delivModal}
        onClose={() => setDelivModal(false)}
        title="Record Delivery Entry"
        maxWidth="md"
      >
        <form onSubmit={saveDelivery} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Client *</label>
              <select
                value={delivForm.clientId}
                onChange={(e) => setDelivForm({ ...delivForm, clientId: e.target.value })}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 bg-white"
                required
              >
                <option value="">Select…</option>
                {clients.map((c) => (
                  <option key={strOf(c.id)} value={strOf(c.id)}>
                    {nameOf(c)}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Date *</label>
              <input
                type="date"
                value={delivForm.date}
                onChange={(e) => setDelivForm({ ...delivForm, date: e.target.value })}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300"
                required
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Status</label>
              <select
                value={delivForm.status}
                onChange={(e) => setDelivForm({ ...delivForm, status: e.target.value })}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 bg-white"
              >
                <option value="delivered">Delivered</option>
                <option value="missed">Missed</option>
                <option value="holiday">Holiday</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Liters (blank = default)</label>
              <input
                type="number"
                step="0.25"
                min="0"
                max="100"
                value={delivForm.quantityLiters}
                onChange={(e) => setDelivForm({ ...delivForm, quantityLiters: Number(e.target.value) })}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Note</label>
            <input
              type="text"
              value={delivForm.note}
              onChange={(e) => setDelivForm({ ...delivForm, note: e.target.value })}
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300"
            />
          </div>
          <button
            type="submit"
            disabled={saving}
            className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white font-bold text-xs shadow-md"
          >
            {saving ? 'Saving…' : 'Save Entry'}
          </button>
        </form>
      </ModalSheet>

      {/* Bulk mark modal */}
      <ModalSheet
        isOpen={bulkModal}
        onClose={() => setBulkModal(false)}
        title="Bulk Mark Day"
        description="Mark today's (or any day's) deliveries for all active clients at once"
        maxWidth="2xl"
      >
        <form onSubmit={saveBulk} className="space-y-3">
          <div className="flex items-center gap-3">
            <input
              type="date"
              value={bulkDate}
              onChange={(e) => setBulkDate(e.target.value)}
              className="px-3 py-2 text-xs rounded-xl border border-slate-300 bg-white"
              required
            />
            <label className="flex items-center gap-2 text-xs font-bold text-slate-600">
              <input
                type="checkbox"
                checked={bulkMissed}
                onChange={(e) => setBulkMissed(e.target.checked)}
                className="w-4 h-4 accent-emerald-600"
              />
              Mark unlisted clients as missed
            </label>
          </div>
          <div className="max-h-80 overflow-y-auto border border-slate-100 rounded-2xl divide-y divide-slate-50">
            {bulkRows.map((r, i) => (
              <div key={strOf(r.clientId)} className="px-4 py-2.5 flex items-center gap-3 text-xs">
                <span className="font-bold text-slate-800 w-36 truncate">{nameOf(r)}</span>
                <select
                  value={strOf(r.status)}
                  onChange={(e) => {
                    const next = [...bulkRows];
                    next[i] = { ...r, status: e.target.value };
                    setBulkRows(next);
                  }}
                  className="px-2 py-1.5 rounded-lg border border-slate-300 bg-white"
                >
                  <option value="delivered">Delivered</option>
                  <option value="missed">Missed</option>
                  <option value="holiday">Holiday</option>
                </select>
                <input
                  type="number"
                  step="0.25"
                  min="0"
                  max="100"
                  disabled={strOf(r.status) !== 'delivered'}
                  value={numOf(r.quantityLiters)}
                  onChange={(e) => {
                    const next = [...bulkRows];
                    next[i] = { ...r, quantityLiters: Number(e.target.value) };
                    setBulkRows(next);
                  }}
                  className="w-20 px-2 py-1.5 rounded-lg border border-slate-300 disabled:opacity-40"
                />
                <span className="text-slate-400">L</span>
              </div>
            ))}
          </div>
          <button
            type="submit"
            disabled={saving}
            className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white font-bold text-xs shadow-md"
          >
            {saving ? 'Saving…' : `Save ${bulkRows.length} Entries`}
          </button>
        </form>
      </ModalSheet>

      {/* Bill generate modal */}
      <ModalSheet
        isOpen={billModal}
        onClose={() => setBillModal(false)}
        title="Generate Monthly Bill"
        maxWidth="md"
      >
        <form onSubmit={saveBill} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Client *</label>
              <select
                value={billForm.clientId}
                onChange={(e) => setBillForm({ ...billForm, clientId: e.target.value })}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 bg-white"
                required
              >
                <option value="">Select…</option>
                {clients.map((c) => (
                  <option key={strOf(c.id)} value={strOf(c.id)}>
                    {nameOf(c)}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Month *</label>
              <input
                type="month"
                value={billForm.month}
                onChange={(e) => setBillForm({ ...billForm, month: e.target.value })}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300"
                required
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Adjustment ₹ (+/-)</label>
            <input
              type="number"
              step="0.5"
              value={billForm.adjustmentsRupees}
              onChange={(e) => setBillForm({ ...billForm, adjustmentsRupees: Number(e.target.value) })}
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Note</label>
            <input
              type="text"
              value={billForm.note}
              onChange={(e) => setBillForm({ ...billForm, note: e.target.value })}
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300"
            />
          </div>
          <button
            type="submit"
            disabled={saving}
            className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white font-bold text-xs shadow-md"
          >
            {saving ? 'Generating…' : 'Generate Bill'}
          </button>
        </form>
      </ModalSheet>

      {/* Payment modal */}
      <ModalSheet
        isOpen={Boolean(payFor)}
        onClose={() => setPayFor(null)}
        title={payFor ? `Record Payment — ${strOf(payFor.id)}` : undefined}
        maxWidth="sm"
      >
        <form onSubmit={savePayment} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Amount ₹ *</label>
              <input
                type="number"
                step="0.5"
                min="1"
                value={payForm.amount}
                onChange={(e) => setPayForm({ ...payForm, amount: Number(e.target.value) })}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Method</label>
              <select
                value={payForm.method}
                onChange={(e) => setPayForm({ ...payForm, method: e.target.value })}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 bg-white"
              >
                <option value="cash">Cash</option>
                <option value="upi">UPI</option>
                <option value="bank_transfer">Bank Transfer</option>
                <option value="other">Other</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Note</label>
            <input
              type="text"
              value={payForm.note}
              onChange={(e) => setPayForm({ ...payForm, note: e.target.value })}
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300"
            />
          </div>
          <button
            type="submit"
            disabled={saving}
            className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white font-bold text-xs shadow-md"
          >
            {saving ? 'Saving…' : 'Record Payment'}
          </button>
        </form>
      </ModalSheet>
    </div>
  );
};

export default MilkSellerDesk;
