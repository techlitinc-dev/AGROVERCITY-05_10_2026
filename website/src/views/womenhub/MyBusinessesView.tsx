import React, { useCallback, useEffect, useState } from 'react';
import {
  AlertCircle,
  BadgeCheck,
  Briefcase,
  MessageSquare,
  Pencil,
  Play,
  Plus,
  Search,
  Star,
  Trash2,
} from 'lucide-react';
import { apiErrorMessage, womenHub } from '../../lib/api';
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
 * products, enquiries and ratings. Orders live in My Orders & Track (Sr 7.0).
 */
export const MyBusinessesView: React.FC = () => {
  const [items, setItems] = useState<Rec[] | null>(null);
  const [q, setQ] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState<Rec | null>(null); // create/edit payload
  const [editingId, setEditingId] = useState<string | null>(null);
  const [detail, setDetail] = useState<Rec | null>(null);
  const [tab, setTab] = useState<'products' | 'enquiries' | 'ratings'>('products');
  const [productForm, setProductForm] = useState<Rec | null>(null);
  const [respondFor, setRespondFor] = useState<Rec | null>(null);
  const [response, setResponse] = useState('');

  const load = useCallback(async (search = '') => {
    try {
      setItems(asRecords(await womenHub.myBusinesses(search.trim())));
    } catch (err) {
      setError(apiErrorMessage(err));
      setItems([]);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const openDetail = async (id: string) => {
    setError(null);
    try {
      setDetail(asRecord(await womenHub.businessDetail(id)));
      setTab('products');
    } catch (err) {
      setError(apiErrorMessage(err));
    }
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

  const submitResponse = async () => {
    if (!respondFor || !detail || busy) return;
    setBusy(true);
    setError(null);
    try {
      await womenHub.respondEnquiry(pickStr(respondFor, 'id'), response.trim());
      setRespondFor(null);
      setResponse('');
      const businessId = pickStr(asRecord(pick(detail, 'business')), 'id');
      await openDetail(businessId);
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setBusy(false);
    }
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
  const enquiries = detail ? asRecords(pick(detail, 'enquiries')) : [];
  const ratings = detail ? asRecords(pick(detail, 'ratings')) : [];

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
          <p className="text-xs text-slate-500 mt-1">
            Create and manage your businesses — tiffin/dabba service, tailoring, pickle-papad unit
            and more. Each business gets its own products, enquiries and ratings — orders are
            tracked in My Orders &amp; Track.
          </p>
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
                  ['enquiries', `Enquiries (${enquiries.length})`],
                  ['ratings', `Ratings (${ratings.length})`],
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

            {tab === 'enquiries' && (
              <div className="space-y-2">
                {enquiries.length === 0 ? (
                  <p className="text-xs text-slate-400">No enquiries yet.</p>
                ) : (
                  enquiries.map((e) => (
                    <div key={pickStr(e, 'id')} className="border border-slate-200 rounded-2xl p-3 space-y-1">
                      <p className="text-xs font-bold text-slate-900">
                        {pickStr(e, 'productName') || 'General'} — {pickStr(e, 'quantity')}
                        <span
                          className={`ml-2 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            pickStr(e, 'status') === 'responded'
                              ? 'bg-emerald-50 border border-emerald-200 text-emerald-700'
                              : 'bg-amber-50 border border-amber-200 text-amber-700'
                          }`}
                        >
                          {pickStr(e, 'status')}
                        </span>
                      </p>
                      <p className="text-[11px] text-slate-500">
                        {pickStr(e, 'fromName') || 'Customer'}: {pickStr(e, 'message')}
                      </p>
                      {pickStr(e, 'response') && (
                        <p className="text-[11px] text-emerald-700">Response: {pickStr(e, 'response')}</p>
                      )}
                      {pickStr(e, 'status') === 'pending' && (
                        <button
                          onClick={() => setRespondFor(e)}
                          className="px-3 py-1.5 bg-pink-50 border border-pink-200 text-pink-700 text-[11px] font-bold rounded-lg flex items-center gap-1"
                        >
                          <MessageSquare className="w-3 h-3" /> Respond
                        </button>
                      )}
                    </div>
                  ))
                )}
              </div>
            )}

            {tab === 'ratings' && (
              <div className="space-y-2">
                {ratings.length === 0 ? (
                  <p className="text-xs text-slate-400">No ratings yet.</p>
                ) : (
                  ratings.map((r) => (
                    <div key={pickStr(r, 'id')} className="border border-slate-200 rounded-2xl p-3">
                      <p className="text-xs font-bold text-slate-900 flex items-center gap-1">
                        <Star className="w-3.5 h-3.5 text-amber-500" /> {pickNum(r, 'rating')} ·{' '}
                        {pickStr(r, 'fromName') || 'Customer'}
                      </p>
                      {pickStr(r, 'review') && (
                        <p className="text-[11px] text-slate-500 mt-0.5">{pickStr(r, 'review')}</p>
                      )}
                    </div>
                  ))
                )}
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
            <p className="text-xs text-slate-400 bg-white rounded-3xl border border-slate-200/80 p-8 text-center">
              No businesses yet — tap "Create Business" to add your tiffin service, tailoring or
              pickle-papad unit.
            </p>
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
            <input
              className={field}
              placeholder="Photo URL"
              value={pickStr(form, 'photo')}
              onChange={(e) => setForm({ ...form, photo: e.target.value })}
            />
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
                disabled={busy}
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
            <input
              className={field}
              placeholder="Photo URL"
              value={pickStr(productForm, 'photo')}
              onChange={(e) => setProductForm({ ...productForm, photo: e.target.value })}
            />
            <div className="grid grid-cols-2 gap-2">
              <input
                className={field}
                type="number"
                placeholder="Price (₹)"
                value={pickStr(productForm, 'pricePaisa')}
                onChange={(e) => setProductForm({ ...productForm, pricePaisa: e.target.value })}
              />
              <input
                className={field}
                type="number"
                placeholder="Stock"
                value={pickStr(productForm, 'stock')}
                onChange={(e) => setProductForm({ ...productForm, stock: e.target.value })}
              />
            </div>
            <div className="flex gap-2 pt-1">
              <button
                onClick={() => void saveProduct()}
                disabled={busy}
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

      {respondFor && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-xl w-full max-w-md p-5 space-y-3">
            <h2 className="font-bold text-slate-900">Respond to Requirement</h2>
            <p className="text-[11px] text-slate-500">
              {pickStr(respondFor, 'fromName')} asked: {pickStr(respondFor, 'message')}
            </p>
            <textarea
              className={field}
              rows={3}
              placeholder="Your response (price, availability…)"
              value={response}
              onChange={(e) => setResponse(e.target.value)}
            />
            <div className="flex gap-2 pt-1">
              <button
                onClick={() => void submitResponse()}
                disabled={busy || !response.trim()}
                className="px-4 py-2.5 bg-pink-600 hover:bg-pink-700 disabled:opacity-40 text-white font-bold text-xs rounded-xl"
              >
                {busy ? 'Sending…' : 'Send Response'}
              </button>
              <button
                onClick={() => setRespondFor(null)}
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
