import React, { useEffect, useState } from 'react';
import {
  ShoppingCart,
  Plus,
  Pencil,
  AlertCircle,
  CheckCircle2,
  Package,
  Users,
  ClipboardList,
  BarChart3,
  ArrowRight,
} from 'lucide-react';
import { apiErrorMessage } from '../../lib/api';
import { ModalSheet } from '../../components/common/ModalSheet';
import { StatusBadge } from '../../components/common/StatusBadge';
import { StatCard } from '../../components/common/StatCard';
import { formatCurrency, formatDate } from '../../lib/utils';
import { dairyExtras } from './managerApi';
import { asRec, nameOf, numOf, recArr, statsOf, strOf, todayStr } from './helpers';

type Tab = 'customers' | 'orders' | 'stock' | 'summary';

const ORDER_FLOW = ['scheduled', 'delivered', 'billed', 'paid'];

export const DairySalesPage: React.FC = () => {
  const [tab, setTab] = useState<Tab>('customers');
  const [customers, setCustomers] = useState<Record<string, unknown>[]>([]);
  const [orders, setOrders] = useState<Record<string, unknown>[]>([]);
  const [stock, setStock] = useState<Record<string, unknown>[]>([]);
  const [summary, setSummary] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // customer modal
  const [custModal, setCustModal] = useState(false);
  const [editingCust, setEditingCust] = useState<Record<string, unknown> | null>(null);
  const [custForm, setCustForm] = useState({
    name: '',
    phone: '',
    type: 'household',
    address: '',
    route: '',
    dailyLitersAM: 0,
    dailyLitersPM: 0,
    ratePerLiter: 55,
    status: 'active',
  });
  const [saving, setSaving] = useState(false);

  // order modal
  const [orderModal, setOrderModal] = useState(false);
  const [orderForm, setOrderForm] = useState({
    customerId: '',
    orderDate: todayStr(),
    shift: 'am',
    liters: 5,
    amount: 0,
  });

  // stock modal
  const [stockModal, setStockModal] = useState(false);
  const [stockForm, setStockForm] = useState({
    name: '',
    category: 'milk',
    unit: 'liter',
    stockQty: 0,
    unitPrice: 0,
    expiryDate: '',
  });
  const [adjustFor, setAdjustFor] = useState<Record<string, unknown> | null>(null);
  const [adjustForm, setAdjustForm] = useState({ delta: 0, reason: '' });

  const reload = async () => {
    setLoading(true);
    setError(null);
    try {
      const [c, o, s, sum] = await Promise.all([
        dairyExtras.salesCustomers().catch(() => []),
        dairyExtras.salesOrders().catch(() => []),
        dairyExtras.stockItems().catch(() => []),
        dairyExtras.salesSummary().catch(() => null),
      ]);
      setCustomers(recArr(c));
      setOrders(recArr(o));
      setStock(recArr(s));
      setSummary(sum ? asRec(sum) : null);
    } catch (e) {
      setError(apiErrorMessage(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    reload();
  }, []);

  const flash = async (msg: string) => {
    setNotice(msg);
    await reload();
  };

  /* ------------------------------ customers ------------------------------ */

  const openAddCust = () => {
    setEditingCust(null);
    setCustForm({
      name: '',
      phone: '',
      type: 'household',
      address: '',
      route: '',
      dailyLitersAM: 0,
      dailyLitersPM: 0,
      ratePerLiter: 55,
      status: 'active',
    });
    setCustModal(true);
  };

  const openEditCust = (c: Record<string, unknown>) => {
    setEditingCust(c);
    setCustForm({
      name: strOf(c.name),
      phone: strOf(c.phone),
      type: strOf(c.type, 'household') || 'household',
      address: strOf(c.address),
      route: strOf(c.route),
      dailyLitersAM: numOf(c.dailyLitersAM),
      dailyLitersPM: numOf(c.dailyLitersPM),
      ratePerLiter: numOf(c.ratePerLiter, 55),
      status: strOf(c.status, 'active') || 'active',
    });
    setCustModal(true);
  };

  const saveCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const payload = {
        ...custForm,
        dailyLitersAM: Number(custForm.dailyLitersAM),
        dailyLitersPM: Number(custForm.dailyLitersPM),
        ratePerLiter: Number(custForm.ratePerLiter),
      };
      if (editingCust) {
        await dairyExtras.updateSalesCustomer(strOf(editingCust.id), payload);
        await flash(`Customer ${custForm.name} updated.`);
      } else {
        await dairyExtras.createSalesCustomer(payload);
        await flash(`Customer ${custForm.name} added.`);
      }
      setCustModal(false);
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  /* -------------------------------- orders ------------------------------- */

  const saveOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await dairyExtras.createSalesOrder({
        customerId: orderForm.customerId,
        orderDate: orderForm.orderDate,
        shift: orderForm.shift,
        liters: Number(orderForm.liters),
        amount: Number(orderForm.amount) || undefined,
      });
      setOrderModal(false);
      await flash('Sale order recorded.');
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const advanceOrder = async (o: Record<string, unknown>) => {
    const current = strOf(o.status, 'scheduled');
    const idx = ORDER_FLOW.indexOf(current);
    const next = ORDER_FLOW[idx + 1];
    if (!next) return;
    setError(null);
    try {
      await dairyExtras.updateSalesOrderStatus(strOf(o.id), next);
      await flash(`Order ${strOf(o.id)} marked as ${next}.`);
    } catch (err) {
      setError(apiErrorMessage(err));
    }
  };

  /* -------------------------------- stock -------------------------------- */

  const saveStockItem = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await dairyExtras.createStockItem({
        ...stockForm,
        stockQty: Number(stockForm.stockQty),
        unitPrice: Number(stockForm.unitPrice),
        expiryDate: stockForm.expiryDate || undefined,
      });
      setStockModal(false);
      await flash(`Stock item ${stockForm.name} added.`);
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const saveAdjust = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adjustFor) return;
    setSaving(true);
    setError(null);
    try {
      await dairyExtras.adjustStockItem(strOf(adjustFor.id), {
        delta: Number(adjustForm.delta),
        reason: adjustForm.reason,
      });
      setAdjustFor(null);
      setAdjustForm({ delta: 0, reason: '' });
      await flash(`Stock adjusted for ${nameOf(adjustFor)}.`);
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const byStatus = statsOf({ stats: summary?.byStatus });
  const stockValue = stock.reduce((acc, s) => acc + numOf(s.stockQty) * numOf(s.unitPrice), 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 flex items-center gap-2">
            <ShoppingCart className="w-7 h-7 text-emerald-600" />
            Milk Sales, Orders & Stock
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Delivery customers, daily sale orders, dairy stock register and sales summary
          </p>
        </div>
        <div className="flex bg-slate-100 p-1 rounded-2xl self-start sm:self-auto overflow-x-auto no-scrollbar">
          {(
            [
              { id: 'customers', label: 'Customers' },
              { id: 'orders', label: 'Orders' },
              { id: 'stock', label: 'Stock' },
              { id: 'summary', label: 'Summary' },
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
          {tab === 'customers' && (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
                  <Users className="w-4 h-4 text-emerald-600" /> Sale Customers ({customers.length})
                </h3>
                <button
                  onClick={openAddCust}
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs flex items-center gap-1.5"
                >
                  <Plus className="w-4 h-4" /> Add Customer
                </button>
              </div>
              {customers.length === 0 ? (
                <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs p-8 text-center text-xs text-slate-400">
                  No sale customers yet — add households, shops or hotels you deliver milk to.
                </div>
              ) : (
                <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="bg-slate-50 text-slate-500 font-bold uppercase text-[10px] tracking-wider border-b border-slate-100">
                          <th className="py-3 px-5">Customer</th>
                          <th className="py-3 px-3">Type</th>
                          <th className="py-3 px-3">Route</th>
                          <th className="py-3 px-3">Daily AM/PM</th>
                          <th className="py-3 px-3">Rate/L</th>
                          <th className="py-3 px-3">Status</th>
                          <th className="py-3 px-5 text-right">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {customers.map((c) => (
                          <tr key={strOf(c.id)} className="hover:bg-slate-50/60">
                            <td className="py-3 px-5 font-bold text-slate-900">
                              {nameOf(c)}
                              <span className="text-[10px] text-slate-400 block font-semibold">{strOf(c.phone) || strOf(c.address)}</span>
                            </td>
                            <td className="py-3 px-3 capitalize text-slate-600">{strOf(c.type, 'household')}</td>
                            <td className="py-3 px-3 text-slate-600">{strOf(c.route) || '—'}</td>
                            <td className="py-3 px-3 text-slate-700">
                              {numOf(c.dailyLitersAM)} / {numOf(c.dailyLitersPM)} L
                            </td>
                            <td className="py-3 px-3 font-bold text-slate-800">₹{numOf(c.ratePerLiter).toFixed(2)}</td>
                            <td className="py-3 px-3">
                              <StatusBadge status={strOf(c.status, 'active')} />
                            </td>
                            <td className="py-3 px-5 text-right">
                              <button
                                onClick={() => openEditCust(c)}
                                className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100"
                                title="Edit"
                              >
                                <Pencil className="w-4 h-4" />
                              </button>
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

          {tab === 'orders' && (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
                  <ClipboardList className="w-4 h-4 text-emerald-600" /> Sale Orders ({orders.length})
                </h3>
                <button
                  onClick={() => {
                    setOrderForm({
                      customerId: strOf(customers[0]?.id),
                      orderDate: todayStr(),
                      shift: 'am',
                      liters: 5,
                      amount: 0,
                    });
                    setOrderModal(true);
                  }}
                  disabled={customers.length === 0}
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold text-xs shadow-xs flex items-center gap-1.5"
                >
                  <Plus className="w-4 h-4" /> New Order
                </button>
              </div>
              {orders.length === 0 ? (
                <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs p-8 text-center text-xs text-slate-400">
                  No sale orders recorded yet.
                </div>
              ) : (
                <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="bg-slate-50 text-slate-500 font-bold uppercase text-[10px] tracking-wider border-b border-slate-100">
                          <th className="py-3 px-5">Order</th>
                          <th className="py-3 px-3">Customer</th>
                          <th className="py-3 px-3">Date • Shift</th>
                          <th className="py-3 px-3">Liters</th>
                          <th className="py-3 px-3">Amount</th>
                          <th className="py-3 px-3">Status</th>
                          <th className="py-3 px-5 text-right">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {orders.map((o) => {
                          const status = strOf(o.status, 'scheduled');
                          const idx = ORDER_FLOW.indexOf(status);
                          return (
                            <tr key={strOf(o.id)} className="hover:bg-slate-50/60">
                              <td className="py-3 px-5 font-mono font-bold text-slate-900">{strOf(o.id)}</td>
                              <td className="py-3 px-3 font-bold text-slate-700">{nameOf(o)}</td>
                              <td className="py-3 px-3 text-slate-600">
                                {formatDate(strOf(o.orderDate))} • {strOf(o.shift, 'am').toUpperCase()}
                              </td>
                              <td className="py-3 px-3 text-slate-700">{numOf(o.liters).toFixed(1)} L</td>
                              <td className="py-3 px-3 font-bold text-slate-800">{formatCurrency(numOf(o.amount))}</td>
                              <td className="py-3 px-3">
                                <StatusBadge status={status} />
                              </td>
                              <td className="py-3 px-5 text-right">
                                {idx >= 0 && idx < ORDER_FLOW.length - 1 ? (
                                  <button
                                    onClick={() => advanceOrder(o)}
                                    className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-emerald-600 hover:text-white text-slate-700 font-bold text-[11px] inline-flex items-center gap-1"
                                  >
                                    Mark {ORDER_FLOW[idx + 1]} <ArrowRight className="w-3 h-3" />
                                  </button>
                                ) : (
                                  <span className="text-[11px] text-slate-300">—</span>
                                )}
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

          {tab === 'stock' && (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
                  <Package className="w-4 h-4 text-emerald-600" /> Dairy Stock Register
                  <span className="text-xs font-semibold text-slate-400">
                    (value {formatCurrency(stockValue)})
                  </span>
                </h3>
                <button
                  onClick={() => {
                    setStockForm({ name: '', category: 'milk', unit: 'liter', stockQty: 0, unitPrice: 0, expiryDate: '' });
                    setStockModal(true);
                  }}
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs flex items-center gap-1.5"
                >
                  <Plus className="w-4 h-4" /> Add Item
                </button>
              </div>
              {stock.length === 0 ? (
                <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs p-8 text-center text-xs text-slate-400">
                  No stock items yet — add milk, curd, ghee or paneer inventory.
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {stock.map((s) => (
                    <div key={strOf(s.id)} className="bg-white rounded-3xl border border-slate-200/80 shadow-xs p-5 space-y-3">
                      <div className="flex items-center justify-between">
                        <h4 className="font-bold text-sm text-slate-900">{nameOf(s)}</h4>
                        <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 text-[10px] font-bold capitalize">
                          {strOf(s.category, 'milk')}
                        </span>
                      </div>
                      <div className="grid grid-cols-3 gap-2 text-center">
                        <div className="p-2 bg-slate-50 rounded-xl">
                          <p className="text-[10px] uppercase font-bold text-slate-400">Stock</p>
                          <p className="text-sm font-black text-slate-900">
                            {numOf(s.stockQty)} {strOf(s.unit, 'liter')}
                          </p>
                        </div>
                        <div className="p-2 bg-slate-50 rounded-xl">
                          <p className="text-[10px] uppercase font-bold text-slate-400">Price</p>
                          <p className="text-sm font-black text-slate-900">₹{numOf(s.unitPrice)}</p>
                        </div>
                        <div className="p-2 bg-slate-50 rounded-xl">
                          <p className="text-[10px] uppercase font-bold text-slate-400">Value</p>
                          <p className="text-sm font-black text-emerald-800">
                            {formatCurrency(numOf(s.stockQty) * numOf(s.unitPrice))}
                          </p>
                        </div>
                      </div>
                      {strOf(s.expiryDate) && (
                        <p className="text-[10px] text-slate-400">Expires {formatDate(strOf(s.expiryDate))}</p>
                      )}
                      <button
                        onClick={() => {
                          setAdjustFor(s);
                          setAdjustForm({ delta: 0, reason: '' });
                        }}
                        className="w-full py-2 rounded-xl bg-slate-100 hover:bg-emerald-600 hover:text-white text-slate-700 font-bold text-xs transition-colors"
                      >
                        Adjust Stock
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {tab === 'summary' && (
            <div className="space-y-4">
              <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-emerald-600" /> Sales Summary
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <StatCard title="Total Orders" value={numOf(summary?.totalOrders)} icon={ClipboardList} colorScheme="blue" />
                <StatCard
                  title="Total Liters"
                  value={`${numOf(summary?.totalLiters).toLocaleString('en-IN')} L`}
                  icon={ShoppingCart}
                  colorScheme="purple"
                />
                <StatCard
                  title="Billed Amount"
                  value={formatCurrency(numOf(summary?.totalAmount))}
                  icon={BarChart3}
                  colorScheme="green"
                />
                <StatCard
                  title="Collected"
                  value={formatCurrency(numOf(summary?.collectedAmount))}
                  subtitle={`${numOf(summary?.collectedAmount) && numOf(summary?.totalAmount) ? Math.round((numOf(summary?.collectedAmount) / numOf(summary?.totalAmount)) * 100) : 0}% recovery`}
                  icon={CheckCircle2}
                  colorScheme="amber"
                />
              </div>
              <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs p-6">
                <h4 className="font-bold text-sm text-slate-900 mb-3">Orders by status</h4>
                {Object.keys(byStatus).length === 0 ? (
                  <p className="text-xs text-slate-400">No orders yet.</p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(byStatus).map(([status, count]) => (
                      <span key={status} className="inline-flex items-center gap-2">
                        <StatusBadge status={status} />
                        <span className="text-xs font-black text-slate-700">{numOf(count)}</span>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </>
      )}

      {/* Customer modal */}
      <ModalSheet
        isOpen={custModal}
        onClose={() => setCustModal(false)}
        title={editingCust ? `Edit ${nameOf(editingCust)}` : 'Add Sale Customer'}
        maxWidth="md"
      >
        <form onSubmit={saveCustomer} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Name *</label>
              <input
                type="text"
                value={custForm.name}
                onChange={(e) => setCustForm({ ...custForm, name: e.target.value })}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Phone</label>
              <input
                type="tel"
                value={custForm.phone}
                onChange={(e) => setCustForm({ ...custForm, phone: e.target.value })}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Type</label>
              <select
                value={custForm.type}
                onChange={(e) => setCustForm({ ...custForm, type: e.target.value })}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 bg-white"
              >
                <option value="household">Household</option>
                <option value="shop">Shop</option>
                <option value="hotel">Hotel</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Delivery Route</label>
              <input
                type="text"
                value={custForm.route}
                onChange={(e) => setCustForm({ ...custForm, route: e.target.value })}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Address</label>
            <input
              type="text"
              value={custForm.address}
              onChange={(e) => setCustForm({ ...custForm, address: e.target.value })}
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300"
            />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">AM Liters</label>
              <input
                type="number"
                step="0.5"
                min="0"
                value={custForm.dailyLitersAM}
                onChange={(e) => setCustForm({ ...custForm, dailyLitersAM: Number(e.target.value) })}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">PM Liters</label>
              <input
                type="number"
                step="0.5"
                min="0"
                value={custForm.dailyLitersPM}
                onChange={(e) => setCustForm({ ...custForm, dailyLitersPM: Number(e.target.value) })}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Rate ₹/L *</label>
              <input
                type="number"
                step="0.5"
                min="0"
                value={custForm.ratePerLiter}
                onChange={(e) => setCustForm({ ...custForm, ratePerLiter: Number(e.target.value) })}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300"
                required
              />
            </div>
          </div>
          <button
            type="submit"
            disabled={saving}
            className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white font-bold text-xs shadow-md"
          >
            {saving ? 'Saving…' : editingCust ? 'Save Changes' : 'Add Customer'}
          </button>
        </form>
      </ModalSheet>

      {/* Order modal */}
      <ModalSheet
        isOpen={orderModal}
        onClose={() => setOrderModal(false)}
        title="New Sale Order"
        description="Record a milk delivery order for a customer"
        maxWidth="md"
      >
        <form onSubmit={saveOrder} className="space-y-3">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Customer *</label>
            <select
              value={orderForm.customerId}
              onChange={(e) => setOrderForm({ ...orderForm, customerId: e.target.value })}
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 bg-white"
              required
            >
              <option value="">Select customer…</option>
              {customers.map((c) => (
                <option key={strOf(c.id)} value={strOf(c.id)}>
                  {nameOf(c)} (₹{numOf(c.ratePerLiter).toFixed(0)}/L)
                </option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Date *</label>
              <input
                type="date"
                value={orderForm.orderDate}
                onChange={(e) => setOrderForm({ ...orderForm, orderDate: e.target.value })}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Shift</label>
              <select
                value={orderForm.shift}
                onChange={(e) => setOrderForm({ ...orderForm, shift: e.target.value })}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 bg-white"
              >
                <option value="am">AM</option>
                <option value="pm">PM</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Liters *</label>
              <input
                type="number"
                step="0.5"
                min="0.5"
                value={orderForm.liters}
                onChange={(e) => setOrderForm({ ...orderForm, liters: Number(e.target.value) })}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300"
                required
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Amount ₹ (optional — auto from customer rate if blank)
            </label>
            <input
              type="number"
              step="0.5"
              min="0"
              value={orderForm.amount}
              onChange={(e) => setOrderForm({ ...orderForm, amount: Number(e.target.value) })}
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300"
            />
          </div>
          <button
            type="submit"
            disabled={saving}
            className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white font-bold text-xs shadow-md"
          >
            {saving ? 'Saving…' : 'Record Order'}
          </button>
        </form>
      </ModalSheet>

      {/* Stock item modal */}
      <ModalSheet
        isOpen={stockModal}
        onClose={() => setStockModal(false)}
        title="Add Stock Item"
        maxWidth="md"
      >
        <form onSubmit={saveStockItem} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Name *</label>
              <input
                type="text"
                value={stockForm.name}
                onChange={(e) => setStockForm({ ...stockForm, name: e.target.value })}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Category</label>
              <select
                value={stockForm.category}
                onChange={(e) => setStockForm({ ...stockForm, category: e.target.value })}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 bg-white"
              >
                <option value="milk">Milk</option>
                <option value="curd">Curd</option>
                <option value="ghee">Ghee</option>
                <option value="paneer">Paneer</option>
                <option value="other">Other</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Opening Qty</label>
              <input
                type="number"
                step="0.5"
                min="0"
                value={stockForm.stockQty}
                onChange={(e) => setStockForm({ ...stockForm, stockQty: Number(e.target.value) })}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Unit</label>
              <input
                type="text"
                value={stockForm.unit}
                onChange={(e) => setStockForm({ ...stockForm, unit: e.target.value })}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Unit Price ₹</label>
              <input
                type="number"
                step="0.5"
                min="0"
                value={stockForm.unitPrice}
                onChange={(e) => setStockForm({ ...stockForm, unitPrice: Number(e.target.value) })}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Expiry Date</label>
            <input
              type="date"
              value={stockForm.expiryDate}
              onChange={(e) => setStockForm({ ...stockForm, expiryDate: e.target.value })}
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300"
            />
          </div>
          <button
            type="submit"
            disabled={saving}
            className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white font-bold text-xs shadow-md"
          >
            {saving ? 'Saving…' : 'Add Item'}
          </button>
        </form>
      </ModalSheet>

      {/* Adjust stock modal */}
      <ModalSheet
        isOpen={Boolean(adjustFor)}
        onClose={() => setAdjustFor(null)}
        title={adjustFor ? `Adjust — ${nameOf(adjustFor)}` : undefined}
        description={
          adjustFor
            ? `Current stock: ${numOf(adjustFor.stockQty)} ${strOf(adjustFor.unit, 'liter')} (use negative delta to reduce)`
            : undefined
        }
        maxWidth="sm"
      >
        <form onSubmit={saveAdjust} className="space-y-3">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Delta *</label>
            <input
              type="number"
              step="0.5"
              value={adjustForm.delta}
              onChange={(e) => setAdjustForm({ ...adjustForm, delta: Number(e.target.value) })}
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300"
              required
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Reason *</label>
            <input
              type="text"
              value={adjustForm.reason}
              onChange={(e) => setAdjustForm({ ...adjustForm, reason: e.target.value })}
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300"
              placeholder="e.g. spoilage, production, correction"
              required
            />
          </div>
          <button
            type="submit"
            disabled={saving}
            className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white font-bold text-xs shadow-md"
          >
            {saving ? 'Saving…' : 'Apply Adjustment'}
          </button>
        </form>
      </ModalSheet>
    </div>
  );
};

export default DairySalesPage;
