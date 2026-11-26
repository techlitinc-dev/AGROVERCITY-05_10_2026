import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  AlertCircle,
  BadgeCheck,
  Briefcase,
  ImagePlus,
  Pencil,
  Play,
  Plus,
  Search,
  Star,
  Trash2,
} from 'lucide-react';
import { apiErrorMessage, uploads, womenHub } from '../../lib/api';
import { mobileError, nameError } from '../../lib/validation';
import { formatPaisa } from '../../lib/utils';
import { asRecord, asRecords, pick, pickNum, pickStr, Rec } from '../shared/records';

const EMPTY_FORM = {
  name: '',
  category: '',
  description: '',
  photo: '',
  serviceArea: '',
  workingDays: '',
  workingTime: '',
};

/**
 * My Business & Management (womenhub 21nov.xlsx Sr 2.0) — create multiple
 * businesses, search her own list, edit/pause/delete, and manage per-business
 * products and customers (with dated record ledger).
 */
export const MyBusinessesView: React.FC = () => {
  const [items, setItems] = useState<Rec[] | null>(null);
  const [q, setQ] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState<Rec | null>(null); // create/edit payload
  const [editingId, setEditingId] = useState<string | null>(null);
  const [detail, setDetail] = useState<Rec | null>(null);
  const [tab, setTab] = useState<'products' | 'customers'>('products');
  const [productForm, setProductForm] = useState<Rec | null>(null);
  const [customers, setCustomers] = useState<Rec[]>([]);
  const [customerTotals, setCustomerTotals] = useState<Rec | null>(null);
  const [customerForm, setCustomerForm] = useState<Rec | null>(null);
  const [recordForm, setRecordForm] = useState<Rec | null>(null);
  const [customerQuery, setCustomerQuery] = useState('');
  const [customerFilter, setCustomerFilter] = useState<'all' | 'pending' | 'settled'>('all');
  const [photoBusy, setPhotoBusy] = useState(false);

  const loadedFor = useRef<string | null>(null);
  const load = useCallback(async (search = '') => {
    const key = search.trim();
    try {
      setItems(asRecords(await womenHub.myBusinesses(key)));
      loadedFor.current = key;
    } catch (err) {
      setError(apiErrorMessage(err));
      setItems([]);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  // Live search: reload once the query settles. Skip when an explicit
  // Enter / Search-button load already covered this exact term.
  useEffect(() => {
    const t = setTimeout(() => {
      if (loadedFor.current !== q.trim()) void load(q);
    }, 350);
    return () => clearTimeout(t);
  }, [q, load]);

  const openDetail = async (id: string) => {
    setError(null);
    try {
      setDetail(asRecord(await womenHub.businessDetail(id)));
      setTab('products');
      setCustomerQuery('');
      setCustomerFilter('all');
      await loadCustomers(id);
    } catch (err) {
      setError(apiErrorMessage(err));
    }
  };

  const loadCustomers = async (businessId: string) => {
    try {
      const data = asRecord(await womenHub.customers(businessId));
      setCustomers(asRecords(pick(data, 'items')));
      setCustomerTotals(asRecord(pick(data, 'totals')));
    } catch (err) {
      setError(apiErrorMessage(err));
    }
  };

  const run = async (fn: () => Promise<unknown>) => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await fn();
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  /** POST /uploads — pick a photo from the device and store its signed URL
   * in the form's `photo` field (same value the old URL box produced). */
  const pickPhoto = (file: File | undefined, apply: (url: string) => void) => {
    if (!file || photoBusy) return;
    setPhotoBusy(true);
    setError(null);
    void (async () => {
      try {
        const uploaded = asRecord(await uploads.upload(file, { folder: 'women-hub', purpose: 'business-photo' }));
        const url = pickStr(uploaded, 'url');
        if (url) apply(url);
      } catch (err) {
        setError(apiErrorMessage(err));
      } finally {
        setPhotoBusy(false);
      }
    })();
  };

  const saveBusiness = async () => {
    if (!form || busy) return;
    setBusy(true);
    setError(null);
    try {
      const payload = { ...form, photo: pickStr(form, 'photo') || undefined };
      if (editingId) {
        await womenHub.updateBusiness(editingId, payload);
      } else {
        await womenHub.createBusiness(payload);
      }
      setForm(null);
      setEditingId(null);
      await load(q);
      if (editingId) await openDetail(editingId);
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const togglePause = async (b: Rec) => {
    setError(null);
    try {
      const id = pickStr(b, 'id');
      if (pickStr(b, 'status') === 'paused') await womenHub.resumeBusiness(id);
      else await womenHub.pauseBusiness(id);
      await load(q);
    } catch (err) {
      setError(apiErrorMessage(err));
    }
  };

  const removeBusiness = async (b: Rec) => {
    if (!window.confirm(`Delete "${pickStr(b, 'name')}" permanently?`)) return;
    setError(null);
    try {
      await womenHub.deleteBusiness(pickStr(b, 'id'));
      setDetail(null);
      await load(q);
    } catch (err) {
      setError(apiErrorMessage(err));
    }
  };

  const saveProduct = async () => {
    if (!productForm || !detail || busy) return;
    const businessId = pickStr(asRecord(pick(detail, 'business')), 'id');
    const pid = pickStr(productForm, 'id');
    setBusy(true);
    setError(null);
    try {
      const payload = {
        name: pickStr(productForm, 'name'),
        photo: pickStr(productForm, 'photo') || undefined,
        pricePaisa: Math.round(pickNum(productForm, 'pricePaisa')) || 0,
        stock: Math.round(pickNum(productForm, 'stock')) || 0,
      };
      if (pid) await womenHub.updateProduct(businessId, pid, payload);
      else await womenHub.addProduct(businessId, payload);
      setProductForm(null);
      await openDetail(businessId);
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const removeProduct = async (pid: string) => {
    if (!detail) return;
    const businessId = pickStr(asRecord(pick(detail, 'business')), 'id');
    setError(null);
    try {
      await womenHub.deleteProduct(businessId, pid);
      await openDetail(businessId);
    } catch (err) {
      setError(apiErrorMessage(err));
    }
  };

  const saveCustomer = () => {
    if (!customerForm || !detail || busy) return;
    if (nameError(pickStr(customerForm, 'name'), true, 'Customer name') || mobileError(pickStr(customerForm, 'phone'), false)) return;
    const businessId = pickStr(asRecord(pick(detail, 'business')), 'id');
    const cid = pickStr(customerForm, 'id');
    void run(async () => {
      const payload = {
        name: pickStr(customerForm, 'name'),
        phone: pickStr(customerForm, 'phone'),
        area: pickStr(customerForm, 'area'),
        note: pickStr(customerForm, 'note'),
      };
      if (cid) await womenHub.updateCustomer(businessId, cid, payload);
      else await womenHub.addCustomer(businessId, payload);
      setCustomerForm(null);
      await loadCustomers(businessId);
    });
  };

  const removeCustomer = (c: Rec) => {
    if (!detail) return;
    const businessId = pickStr(asRecord(pick(detail, 'business')), 'id');
    if (!window.confirm(`Delete customer "${pickStr(c, 'name')}" and all their records?`)) return;
    void run(async () => {
      await womenHub.deleteCustomer(businessId, pickStr(c, 'id'));
      await loadCustomers(businessId);
    });
  };

  const saveRecord = () => {
    if (!recordForm || !detail || busy) return;
    const businessId = pickStr(asRecord(pick(detail, 'business')), 'id');
    const customerId = pickStr(recordForm, 'customerId');
    const rid = pickStr(recordForm, 'recordId');
    void run(async () => {
      const type = pickStr(recordForm, 'type') || 'sale';
      const payload = {
        date: pickStr(recordForm, 'date'),
        note: pickStr(recordForm, 'note'),
        amountPaisa: Math.round((Number(pickStr(recordForm, 'amount')) || 0) * 100),
        type,
        costPaisa:
          type === 'sale' ? Math.round((Number(pickStr(recordForm, 'cost')) || 0) * 100) : 0,
      };
      if (rid) await womenHub.updateCustomerRecord(businessId, customerId, rid, payload);
      else await womenHub.addCustomerRecord(businessId, customerId, payload);
      setRecordForm(null);
      await loadCustomers(businessId);
    });
  };

  const removeRecord = (customerId: string, recordId: string) => {
    if (!detail) return;
    const businessId = pickStr(asRecord(pick(detail, 'business')), 'id');
    void run(async () => {
      await womenHub.deleteCustomerRecord(businessId, customerId, recordId);
      await loadCustomers(businessId);
    });
  };

  const startEdit = (b: Rec) => {
    setEditingId(pickStr(b, 'id'));
    setForm({
      name: pickStr(b, 'name'),
      category: pickStr(b, 'category'),
      description: pickStr(b, 'description'),
      photo: pickStr(b, 'photo'),
      serviceArea: pickStr(b, 'serviceArea'),
      workingDays: pickStr(b, 'workingDays'),
      workingTime: pickStr(b, 'workingTime'),
    });
  };

  const business = detail ? asRecord(pick(detail, 'business')) : null;
  const products = detail ? asRecords(pick(detail, 'products')) : [];

  const needle = customerQuery.trim().toLowerCase();
  const filteredCustomers = customers.filter((c) => {
    if (needle) {
      const hay = `${pickStr(c, 'name')} ${pickStr(c, 'phone')} ${pickStr(c, 'area')}`.toLowerCase();
      if (!hay.includes(needle)) return false;
    }
    const remaining = pickNum(asRecord(pick(c, 'summary')), 'remainingPaisa');
    if (customerFilter === 'pending') return remaining > 0;
    if (customerFilter === 'settled') return remaining <= 0;
    return true;
  });

  const field =
    'w-full px-3 py-2.5 text-xs rounded-xl border border-slate-300 focus:outline-none focus:border-pink-600';

  return (
    <div className="space-y-6">
      <div className="border-b border-slate-200 pb-4 flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 flex items-center gap-2">
            <Briefcase className="w-7 h-7 text-pink-600" />
            My Business &amp; Management
          </h1>
        </div>
        <button
          onClick={() => {
            setEditingId(null);
            setForm({ ...EMPTY_FORM });
          }}
          className="px-4 py-2.5 bg-pink-600 hover:bg-pink-700 text-white font-bold text-xs rounded-xl shadow-xs flex items-center gap-1.5 flex-shrink-0"
        >
          <Plus className="w-3.5 h-3.5" /> Create Business
        </button>
      </div>

      {error && (
        <div className="rounded-2xl border p-3 text-xs flex items-start gap-2 bg-rose-50 border-rose-200 text-rose-800">
          <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {detail && business ? (
        <div className="space-y-4">
          <button onClick={() => setDetail(null)} className="text-xs font-bold text-pink-700 hover:underline">
            ← Back to my businesses
          </button>
          <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs p-5 space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                {pickStr(business, 'photo') ? (
                  <img
                    src={pickStr(business, 'photo')}
                    alt={pickStr(business, 'name')}
                    className="w-14 h-14 rounded-2xl object-cover border border-slate-200"
                  />
                ) : (
                  <div className="w-14 h-14 rounded-2xl bg-pink-50 border border-pink-200 flex items-center justify-center">
                    <Briefcase className="w-6 h-6 text-pink-500" />
                  </div>
                )}
                <div>
                  <h2 className="font-bold text-slate-900 flex items-center gap-2">
                    {pickStr(business, 'name')}
                    {pickStr(business, 'status') === 'paused' && (
                      <span className="px-2 py-0.5 rounded-full bg-amber-50 border border-amber-200 text-[10px] font-bold text-amber-700">
                        Paused
                      </span>
                    )}
                  </h2>
                  <p className="text-[11px] text-slate-500">{pickStr(business, 'category')}</p>
                  <p className="text-[11px] text-slate-400 mt-1">{pickStr(business, 'description')}</p>
                  <p className="text-[11px] text-slate-400">
                    {pickStr(business, 'serviceArea')} · {pickStr(business, 'workingDays')}{' '}
                    {pickStr(business, 'workingTime')}
                  </p>
                </div>
              </div>
              <div className="flex gap-2 flex-shrink-0">
                <button
                  onClick={() => startEdit(business)}
                  className="p-2 rounded-xl border border-slate-200 text-slate-500 hover:text-pink-600 hover:border-pink-300"
                  title="Edit"
                >
                  <Pencil className="w-4 h-4" />
                </button>
                <button
                  onClick={() => togglePause(business)}
                  className="p-2 rounded-xl border border-slate-200 text-slate-500 hover:text-amber-600 hover:border-amber-300"
                  title={pickStr(business, 'status') === 'paused' ? 'Resume' : 'Pause'}
                >
                  <Play className="w-4 h-4" />
                </button>
                <button
                  onClick={() => removeBusiness(business)}
                  className="p-2 rounded-xl border border-slate-200 text-slate-500 hover:text-rose-600 hover:border-rose-300"
                  title="Delete"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="flex gap-2 border-b border-slate-100 pb-2 text-xs font-bold">
              {(
                [
                  ['products', `Products (${products.length})`],
                  ['customers', `Customers (${customers.length})`],
                ] as const
              ).map(([key, label]) => (
                <button
                  key={key}
                  onClick={() => setTab(key)}
                  className={`px-3 py-1.5 rounded-lg ${
                    tab === key ? 'bg-pink-600 text-white' : 'text-slate-500 hover:bg-slate-50'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            {tab === 'products' && (
              <div className="space-y-3">
                <button
                  onClick={() => setProductForm({ name: '', photo: '', pricePaisa: '', stock: '' })}
                  className="px-3 py-2 bg-pink-50 border border-pink-200 text-pink-700 font-bold text-[11px] rounded-xl flex items-center gap-1.5"
                >
                  <Plus className="w-3.5 h-3.5" /> Add Product
                </button>
                {products.length === 0 ? (
                  <p className="text-xs text-slate-400">No products yet — add your first product.</p>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {products.map((p) => (
                      <div
                        key={pickStr(p, 'id')}
                        className="border border-slate-200 rounded-2xl p-3 flex items-start justify-between gap-2"
                      >
                        <div>
                          <p className="text-xs font-bold text-slate-900">{pickStr(p, 'name')}</p>
                          <p className="text-[11px] text-slate-500">
                            {formatPaisa(pickNum(p, 'pricePaisa'))} · stock {pickNum(p, 'stock')}
                          </p>
                        </div>
                        <div className="flex gap-1">
                          <button
                            onClick={() =>
                              setProductForm({
                                id: pickStr(p, 'id'),
                                name: pickStr(p, 'name'),
                                photo: pickStr(p, 'photo'),
                                pricePaisa: String(pickNum(p, 'pricePaisa') / 100),
                                stock: String(pickNum(p, 'stock')),
                              })
                            }
                            className="p-1.5 rounded-lg text-slate-400 hover:text-pink-600"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => removeProduct(pickStr(p, 'id'))}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {tab === 'customers' && (
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <button
                    onClick={() => setCustomerForm({ id: '', name: '', phone: '', area: '', note: '' })}
                    className="px-3 py-2 bg-pink-50 border border-pink-200 text-pink-700 font-bold text-[11px] rounded-xl flex items-center gap-1.5"
                  >
                    <Plus className="w-3.5 h-3.5" /> Add Customer
                  </button>
                  {customerTotals && customers.length > 0 && (
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">
                      Business khata · sales {formatPaisa(pickNum(customerTotals, 'salesPaisa'))} · profit{' '}
                      {formatPaisa(pickNum(customerTotals, 'profitPaisa'))} · cash received{' '}
                      {formatPaisa(pickNum(customerTotals, 'paidPaisa'))} · remaining{' '}
                      {formatPaisa(pickNum(customerTotals, 'remainingPaisa'))}
                    </p>
                  )}
                </div>
                {customers.length === 0 ? (
                  <p className="text-xs text-slate-400">
                    No customers yet — add your regular buyers to keep their records here.
                  </p>
                ) : (
                  <>
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="relative flex-1 min-w-[180px]">
                        <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                        <input
                          value={customerQuery}
                          onChange={(e) => setCustomerQuery(e.target.value)}
                          placeholder="Search customer by name, phone or area…"
                          className="w-full pl-8 pr-3 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:border-pink-600"
                        />
                      </div>
                      {(
                        [
                          ['all', 'All'],
                          ['pending', 'Pending payment'],
                          ['settled', 'Settled'],
                        ] as const
                      ).map(([key, label]) => (
                        <button
                          key={key}
                          onClick={() => setCustomerFilter(key)}
                          className={`px-3 py-2 rounded-xl text-[11px] font-bold border ${
                            customerFilter === key
                              ? 'bg-pink-600 border-pink-600 text-white'
                              : 'border-slate-300 text-slate-500 hover:border-pink-300 hover:text-pink-700'
                          }`}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                    {filteredCustomers.length === 0 && (
                      <p className="text-[11px] text-slate-400">
                        No customers match{needle ? ` “${customerQuery.trim()}”` : ''}
                        {customerFilter !== 'all'
                          ? ` with filter “${customerFilter === 'pending' ? 'Pending payment' : 'Settled'}”`
                          : ''}
                        .
                      </p>
                    )}
                  </>
                )}
                {filteredCustomers.map((c) => {
                    const records = asRecords(pick(c, 'records'));
                    const summary = asRecord(pick(c, 'summary'));
                    const remaining = pickNum(summary, 'remainingPaisa');
                    return (
                      <div key={pickStr(c, 'id')} className="border border-slate-200 rounded-2xl p-3 space-y-2">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="text-xs font-bold text-slate-900">{pickStr(c, 'name')}</p>
                            <p className="text-[11px] text-slate-500">
                              {[pickStr(c, 'phone'), pickStr(c, 'area')].filter(Boolean).join(' · ')}
                            </p>
                            {pickStr(c, 'note') && (
                              <p className="text-[11px] text-slate-400 mt-0.5">{pickStr(c, 'note')}</p>
                            )}
                          </div>
                          <div className="flex gap-1 flex-shrink-0">
                            <button
                              onClick={() =>
                                setCustomerForm({
                                  id: pickStr(c, 'id'),
                                  name: pickStr(c, 'name'),
                                  phone: pickStr(c, 'phone'),
                                  area: pickStr(c, 'area'),
                                  note: pickStr(c, 'note'),
                                })
                              }
                              className="p-1.5 rounded-lg text-slate-400 hover:text-pink-600"
                              title="Edit customer"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => removeCustomer(c)}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600"
                              title="Delete customer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        {/* Khata summary — sales / profit / cash received / remaining */}
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
                          <div className="rounded-xl bg-slate-50 p-2">
                            <p className="text-[10px] text-slate-400 font-bold">Sales</p>
                            <p className="text-xs font-extrabold text-slate-900">
                              {formatPaisa(pickNum(summary, 'salesPaisa'))}
                            </p>
                          </div>
                          <div className="rounded-xl bg-slate-50 p-2">
                            <p className="text-[10px] text-slate-400 font-bold">Profit</p>
                            <p
                              className={`text-xs font-extrabold ${
                                pickNum(summary, 'profitPaisa') >= 0 ? 'text-emerald-700' : 'text-rose-600'
                              }`}
                            >
                              {formatPaisa(pickNum(summary, 'profitPaisa'))}
                            </p>
                          </div>
                          <div className="rounded-xl bg-slate-50 p-2">
                            <p className="text-[10px] text-slate-400 font-bold">Cash received</p>
                            <p className="text-xs font-extrabold text-emerald-700">
                              {formatPaisa(pickNum(summary, 'paidPaisa'))}
                            </p>
                          </div>
                          <div className="rounded-xl bg-slate-50 p-2">
                            <p className="text-[10px] text-slate-400 font-bold">Remaining</p>
                            <p
                              className={`text-xs font-extrabold ${
                                remaining > 0 ? 'text-amber-700' : 'text-slate-900'
                              }`}
                            >
                              {formatPaisa(remaining)}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center justify-between">
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">
                            Records ({records.length})
                          </p>
                          <button
                            onClick={() =>
                              setRecordForm({
                                customerId: pickStr(c, 'id'),
                                recordId: '',
                                type: 'sale',
                                date: new Date().toISOString().slice(0, 10),
                                note: '',
                                amount: '',
                                cost: '',
                              })
                            }
                            className="px-2.5 py-1 rounded-lg bg-pink-50 border border-pink-200 text-pink-700 text-[10px] font-bold flex items-center gap-1"
                          >
                            <Plus className="w-3 h-3" /> Add record
                          </button>
                        </div>
                        {records.length === 0 ? (
                          <p className="text-[11px] text-slate-400">No records yet.</p>
                        ) : (
                          records.map((r) => {
                            const isPayment = pickStr(r, 'type') === 'payment';
                            return (
                              <div key={pickStr(r, 'id')} className="flex items-start justify-between gap-2 text-[11px] border-t border-slate-100 pt-1.5">
                                <div className="min-w-0">
                                  <p className="font-bold text-slate-700">
                                    <span
                                      className={`mr-2 px-1.5 py-0.5 rounded-full text-[9px] font-bold ${
                                        isPayment
                                          ? 'bg-emerald-50 border border-emerald-200 text-emerald-700'
                                          : 'bg-purple-50 border border-purple-200 text-purple-700'
                                      }`}
                                    >
                                      {isPayment ? 'Cash payment' : 'Sale'}
                                    </span>
                                    {pickStr(r, 'date')}
                                    {pickNum(r, 'amountPaisa') > 0 && (
                                      <span className={`ml-2 ${isPayment ? 'text-emerald-700' : 'text-slate-900'}`}>
                                        {formatPaisa(pickNum(r, 'amountPaisa'))}
                                      </span>
                                    )}
                                    {!isPayment && pickNum(r, 'costPaisa') > 0 && (
                                      <span className="ml-2 font-normal text-slate-400">
                                        cost {formatPaisa(pickNum(r, 'costPaisa'))}
                                      </span>
                                    )}
                                  </p>
                                  {pickStr(r, 'note') && <p className="text-slate-500">{pickStr(r, 'note')}</p>}
                                </div>
                                <div className="flex gap-1 flex-shrink-0">
                                  <button
                                    onClick={() =>
                                      setRecordForm({
                                        customerId: pickStr(c, 'id'),
                                        recordId: pickStr(r, 'id'),
                                        type: isPayment ? 'payment' : 'sale',
                                        date: pickStr(r, 'date'),
                                        note: pickStr(r, 'note'),
                                        amount: pickNum(r, 'amountPaisa')
                                          ? String(pickNum(r, 'amountPaisa') / 100)
                                          : '',
                                        cost: pickNum(r, 'costPaisa')
                                          ? String(pickNum(r, 'costPaisa') / 100)
                                          : '',
                                      })
                                    }
                                    className="p-1 rounded-lg text-slate-400 hover:text-pink-600"
                                    title="Edit record"
                                  >
                                    <Pencil className="w-3 h-3" />
                                  </button>
                                  <button
                                    onClick={() => removeRecord(pickStr(c, 'id'), pickStr(r, 'id'))}
                                    className="p-1 rounded-lg text-slate-400 hover:text-rose-600"
                                    title="Delete record"
                                  >
                                    <Trash2 className="w-3 h-3" />
                                  </button>
                                </div>
                              </div>
                            );
                          })
                        )}
                      </div>
                    );
                  })}
              </div>
            )}
          </div>
        </div>
      ) : (
        <>
          <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs p-5">
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
              <input
                type="text"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && void load(q)}
                placeholder="Search my businesses…"
                className="px-3 py-2.5 text-xs rounded-xl border border-slate-300 focus:outline-none focus:border-pink-600 sm:col-span-3"
              />
              <button
                onClick={() => void load(q)}
                className="px-4 py-2.5 bg-pink-600 hover:bg-pink-700 text-white font-bold text-xs rounded-xl shadow-xs flex items-center justify-center gap-1.5"
              >
                <Search className="w-3.5 h-3.5" /> Search
              </button>
            </div>
          </div>

          {items === null ? (
            <p className="text-xs text-slate-400">Loading businesses…</p>
          ) : items.length === 0 ? (
            q.trim() ? (
              <div className="bg-white rounded-3xl border border-slate-200/80 p-8 text-center space-y-3">
                <p className="text-xs text-slate-500">
                  No businesses match{' '}
                  <span className="font-bold text-slate-700">&ldquo;{q.trim()}&rdquo;</span>.
                </p>
                <button
                  onClick={() => setQ('')}
                  className="px-3 py-1.5 border border-slate-300 text-slate-600 font-bold text-[11px] rounded-lg hover:border-pink-300 hover:text-pink-700"
                >
                  Clear search
                </button>
              </div>
            ) : (
              <p className="text-xs text-slate-400 bg-white rounded-3xl border border-slate-200/80 p-8 text-center">
                No businesses yet — tap &quot;Create Business&quot; to add your tiffin service,
                tailoring or pickle-papad unit.
              </p>
            )
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {items.map((b) => (
                <button
                  key={pickStr(b, 'id')}
                  onClick={() => void openDetail(pickStr(b, 'id'))}
                  className="text-left bg-white rounded-3xl border border-slate-200/80 shadow-xs p-5 space-y-2 hover:border-pink-300 transition-colors"
                >
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-bold text-sm text-slate-900">{pickStr(b, 'name')}</h3>
                    {pickStr(b, 'status') === 'paused' ? (
                      <span className="px-2 py-0.5 rounded-full bg-amber-50 border border-amber-200 text-[10px] font-bold text-amber-700">
                        Paused
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-[10px] font-bold text-emerald-700">
                        <BadgeCheck className="w-3 h-3" /> Active
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-500">{pickStr(b, 'category')}</p>
                  <p className="text-[11px] text-slate-400">{pickStr(b, 'description')}</p>
                  <p className="text-[11px] text-slate-700 font-bold flex items-center gap-1">
                    <Star className="w-3.5 h-3.5 text-amber-500" />
                    {pickNum(b, 'ratingAvg').toFixed(1)} ({pickNum(b, 'ratingCount')})
                  </p>
                </button>
              ))}
            </div>
          )}
        </>
      )}

      {form && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-xl w-full max-w-lg p-5 space-y-3 max-h-[90vh] overflow-y-auto">
            <h2 className="font-bold text-slate-900">
              {editingId ? 'Edit Business' : 'Create Business'}
            </h2>
            <input
              className={field}
              placeholder="Business name"
              value={pickStr(form, 'name')}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
            <input
              className={field}
              placeholder="Category (e.g. tiffin/dabba service, tailoring, pickle-papad)"
              value={pickStr(form, 'category')}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
            />
            <textarea
              className={field}
              rows={3}
              placeholder="What the business does"
              value={pickStr(form, 'description')}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1">Photo</p>
              <div className="flex items-center gap-3">
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  id="wh-biz-photo-input"
                  onChange={(e) => {
                    pickPhoto(e.target.files?.[0], (url) => setForm((f) => (f ? { ...f, photo: url } : f)));
                    e.target.value = '';
                  }}
                />
                <label
                  htmlFor="wh-biz-photo-input"
                  className="px-3 py-2 rounded-xl border border-slate-300 hover:bg-slate-50 text-slate-700 font-bold text-xs cursor-pointer flex items-center gap-1.5"
                >
                  <ImagePlus className="w-3.5 h-3.5" />
                  {photoBusy ? 'Uploading…' : pickStr(form, 'photo') ? 'Change Photo' : 'Upload Photo'}
                </label>
                {pickStr(form, 'photo') && (
                  <>
                    <img
                      src={pickStr(form, 'photo')}
                      alt="Business"
                      className="h-12 w-12 rounded-xl object-cover border border-slate-200"
                    />
                    <button
                      type="button"
                      onClick={() => setForm({ ...form, photo: '' })}
                      className="text-[11px] font-bold text-rose-600 hover:underline"
                    >
                      Remove
                    </button>
                  </>
                )}
              </div>
            </div>
            <input
              className={field}
              placeholder="Service area"
              value={pickStr(form, 'serviceArea')}
              onChange={(e) => setForm({ ...form, serviceArea: e.target.value })}
            />
            <div className="grid grid-cols-2 gap-2">
              <input
                className={field}
                placeholder="Working days (e.g. Mon-Sat)"
                value={pickStr(form, 'workingDays')}
                onChange={(e) => setForm({ ...form, workingDays: e.target.value })}
              />
              <input
                className={field}
                placeholder="Working time (e.g. 8:00-18:00)"
                value={pickStr(form, 'workingTime')}
                onChange={(e) => setForm({ ...form, workingTime: e.target.value })}
              />
            </div>
            <div className="flex gap-2 pt-1">
              <button
                onClick={() => void saveBusiness()}
                disabled={
                  busy ||
                  pickStr(form, 'name').trim().length < 2 ||
                  pickStr(form, 'category').trim().length < 2
                }
                className="px-4 py-2.5 bg-pink-600 hover:bg-pink-700 disabled:opacity-40 text-white font-bold text-xs rounded-xl"
              >
                {busy ? 'Saving…' : editingId ? 'Save Changes' : 'Create Business'}
              </button>
              <button
                onClick={() => {
                  setForm(null);
                  setEditingId(null);
                }}
                className="px-4 py-2.5 border border-slate-300 text-slate-600 font-bold text-xs rounded-xl"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {productForm && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-xl w-full max-w-md p-5 space-y-3">
            <h2 className="font-bold text-slate-900">
              {pickStr(productForm, 'id') ? 'Edit Product' : 'Add Product'}
            </h2>
            <input
              className={field}
              placeholder="Product name"
              value={pickStr(productForm, 'name')}
              onChange={(e) => setProductForm({ ...productForm, name: e.target.value })}
            />
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1">Photo</p>
              <div className="flex items-center gap-3">
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  id="wh-prod-photo-input"
                  onChange={(e) => {
                    pickPhoto(e.target.files?.[0], (url) =>
                      setProductForm((f) => (f ? { ...f, photo: url } : f))
                    );
                    e.target.value = '';
                  }}
                />
                <label
                  htmlFor="wh-prod-photo-input"
                  className="px-3 py-2 rounded-xl border border-slate-300 hover:bg-slate-50 text-slate-700 font-bold text-xs cursor-pointer flex items-center gap-1.5"
                >
                  <ImagePlus className="w-3.5 h-3.5" />
                  {photoBusy ? 'Uploading…' : pickStr(productForm, 'photo') ? 'Change Photo' : 'Upload Photo'}
                </label>
                {pickStr(productForm, 'photo') && (
                  <>
                    <img
                      src={pickStr(productForm, 'photo')}
                      alt="Product"
                      className="h-12 w-12 rounded-xl object-cover border border-slate-200"
                    />
                    <button
                      type="button"
                      onClick={() => setProductForm({ ...productForm, photo: '' })}
                      className="text-[11px] font-bold text-rose-600 hover:underline"
                    >
                      Remove
                    </button>
                  </>
                )}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <input
                className={field}
                type="number"
                min={0}
                placeholder="Price (₹)"
                value={pickStr(productForm, 'pricePaisa')}
                onChange={(e) => setProductForm({ ...productForm, pricePaisa: e.target.value })}
              />
              <input
                className={field}
                type="number"
                min={0}
                placeholder="Stock"
                value={pickStr(productForm, 'stock')}
                onChange={(e) => setProductForm({ ...productForm, stock: e.target.value })}
              />
            </div>
            <div className="flex gap-2 pt-1">
              <button
                onClick={() => void saveProduct()}
                disabled={busy || pickStr(productForm, 'name').trim().length < 2}
                className="px-4 py-2.5 bg-pink-600 hover:bg-pink-700 disabled:opacity-40 text-white font-bold text-xs rounded-xl"
              >
                {busy ? 'Saving…' : 'Save Product'}
              </button>
              <button
                onClick={() => setProductForm(null)}
                className="px-4 py-2.5 border border-slate-300 text-slate-600 font-bold text-xs rounded-xl"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {customerForm && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-xl w-full max-w-md p-5 space-y-3">
            <h2 className="font-bold text-slate-900">
              {pickStr(customerForm, 'id') ? 'Edit Customer' : 'Add Customer'}
            </h2>
            <input
              className={field}
              placeholder="Customer name"
              value={pickStr(customerForm, 'name')}
              onChange={(e) => setCustomerForm({ ...customerForm, name: e.target.value })}
            />
            {pickStr(customerForm, 'name').trim() !== '' &&
              nameError(pickStr(customerForm, 'name'), true, 'Customer name') && (
                <p className="text-[11px] font-bold text-rose-600">
                  {nameError(pickStr(customerForm, 'name'), true, 'Customer name')}
                </p>
              )}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <input
                  className={field}
                  placeholder="Phone (10-digit mobile)"
                  value={pickStr(customerForm, 'phone')}
                  onChange={(e) => setCustomerForm({ ...customerForm, phone: e.target.value })}
                />
                {mobileError(pickStr(customerForm, 'phone'), false) && (
                  <p className="mt-1 text-[11px] font-bold text-rose-600">
                    {mobileError(pickStr(customerForm, 'phone'), false)}
                  </p>
                )}
              </div>
              <input
                className={field}
                placeholder="Village / area"
                value={pickStr(customerForm, 'area')}
                onChange={(e) => setCustomerForm({ ...customerForm, area: e.target.value })}
              />
            </div>
            <textarea
              className={field}
              rows={2}
              placeholder="Note (preferences, credit…)"
              value={pickStr(customerForm, 'note')}
              onChange={(e) => setCustomerForm({ ...customerForm, note: e.target.value })}
            />
            <div className="flex gap-2 pt-1">
              <button
                onClick={() => void saveCustomer()}
                disabled={
                  busy ||
                  !!nameError(pickStr(customerForm, 'name'), true, 'Customer name') ||
                  !!mobileError(pickStr(customerForm, 'phone'), false)
                }
                className="px-4 py-2.5 bg-pink-600 hover:bg-pink-700 disabled:opacity-40 text-white font-bold text-xs rounded-xl"
              >
                {busy ? 'Saving…' : pickStr(customerForm, 'id') ? 'Save Changes' : 'Add Customer'}
              </button>
              <button
                onClick={() => setCustomerForm(null)}
                className="px-4 py-2.5 border border-slate-300 text-slate-600 font-bold text-xs rounded-xl"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {recordForm && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-xl w-full max-w-md p-5 space-y-3">
            <h2 className="font-bold text-slate-900">
              {pickStr(recordForm, 'recordId') ? 'Edit Record' : 'Add Record'}
            </h2>
            <div className="grid grid-cols-2 gap-2">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">
                Entry type
                <select
                  className={field}
                  value={pickStr(recordForm, 'type') || 'sale'}
                  onChange={(e) => setRecordForm({ ...recordForm, type: e.target.value })}
                >
                  <option value="sale">Sale (goods on credit)</option>
                  <option value="payment">Cash payment received</option>
                </select>
              </label>
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">
                Date
                <input
                  className={field}
                  type="date"
                  value={pickStr(recordForm, 'date')}
                  onChange={(e) => setRecordForm({ ...recordForm, date: e.target.value })}
                />
              </label>
            </div>
            <div className={`grid gap-2 ${pickStr(recordForm, 'type') !== 'payment' ? 'grid-cols-2' : 'grid-cols-1'}`}>
              <input
                className={field}
                type="number"
                placeholder={pickStr(recordForm, 'type') === 'payment' ? 'Cash received (₹)' : 'Sale amount (₹)'}
                value={pickStr(recordForm, 'amount')}
                onChange={(e) => setRecordForm({ ...recordForm, amount: e.target.value })}
              />
              {pickStr(recordForm, 'type') !== 'payment' && (
                <input
                  className={field}
                  type="number"
                  placeholder="Your cost (₹, optional)"
                  value={pickStr(recordForm, 'cost')}
                  onChange={(e) => setRecordForm({ ...recordForm, cost: e.target.value })}
                />
              )}
            </div>
            <textarea
              className={field}
              rows={2}
              placeholder="Note — what was ordered / delivered…"
              value={pickStr(recordForm, 'note')}
              onChange={(e) => setRecordForm({ ...recordForm, note: e.target.value })}
            />
            <div className="flex gap-2 pt-1">
              <button
                onClick={() => void saveRecord()}
                disabled={busy || !pickStr(recordForm, 'date')}
                className="px-4 py-2.5 bg-pink-600 hover:bg-pink-700 disabled:opacity-40 text-white font-bold text-xs rounded-xl"
              >
                {busy ? 'Saving…' : pickStr(recordForm, 'recordId') ? 'Save Changes' : 'Add Record'}
              </button>
              <button
                onClick={() => setRecordForm(null)}
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
