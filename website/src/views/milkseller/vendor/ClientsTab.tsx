import React, { useCallback, useEffect, useState } from 'react';
import { IndianRupee, Pause, Pencil, Play, Plus, Power, Users } from 'lucide-react';
import { milkVendor, VendorClient } from '../../../lib/api';
import { litresToMl, rupeesToPaisa } from '../../../lib/api/milkVendor';
import { ModalSheet } from '../../../components/common/ModalSheet';
import { SectionCard, EmptyState, ErrorBanner, inputCls, btnPrimary, btnGhost, btnDanger, rec, recArr, str, num, bool, todayStr, fmtMl, fmtPaisa } from './shared';

interface Props {
  products: Record<string, unknown>[];
  refreshKey: number;
  notify: (message: string) => void;
  onChanged: () => void;
}

const EMPTY_FORM = {
  name: '',
  whatsappNumber: '',
  alternatePhone: '',
  address: '',
  deliveryNotes: '',
  defaultProductId: '',
  defaultQuantityLiters: '1',
  scheduleType: 'daily',
  weekdays: [] as number[],
  oneTimeDate: '',
  scheduleStartDate: todayStr(),
  defaultShift: 'morning',
  billingCycle: '',
  openingBalance: '0',
  rateRupees: '60',
};

export const ClientsTab: React.FC<Props> = ({ products, refreshKey, notify, onChanged }) => {
  const [clients, setClients] = useState<VendorClient[]>([]);
  const [statusFilter, setStatusFilter] = useState('active');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState<VendorClient | null>(null);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [dupeWarn, setDupeWarn] = useState(false);

  const [pauseFor, setPauseFor] = useState<VendorClient | null>(null);
  const [pauseRange, setPauseRange] = useState({ startDate: todayStr(), endDate: '' });
  const [detailFor, setDetailFor] = useState<string | null>(null);
  const [detail, setDetail] = useState<Record<string, unknown> | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setClients(await milkVendor.clients({ status: 'all' }));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load clients');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load, refreshKey]);

  const openAdd = () => {
    setEditing(null);
    setForm({ ...EMPTY_FORM, defaultProductId: str(products[0]?.id) });
    setFormError(null);
    setDupeWarn(false);
    setModal(true);
  };

  const openEdit = (c: VendorClient) => {
    setEditing(c);
    setForm({
      name: str(c.name),
      whatsappNumber: str(c.whatsappNumber),
      alternatePhone: str(c.alternatePhone),
      address: str(c.address || c.area),
      deliveryNotes: str(c.deliveryNotes),
      defaultProductId: str(c.defaultProductId) || str(products[0]?.id),
      defaultQuantityLiters: String(num(c.defaultQuantityMilliLitres) / 1000 || '1'),
      scheduleType: str(c.scheduleType, 'daily'),
      weekdays: Array.isArray(c.weekdays) ? (c.weekdays as number[]) : [],
      oneTimeDate: str(c.oneTimeDate),
      scheduleStartDate: str(c.scheduleStartDate, todayStr()),
      defaultShift: str(c.defaultShift, 'morning'),
      billingCycle: str(c.billingCycle),
      openingBalance: String(num(c.openingBalancePaisa) / 100),
      rateRupees: '', // rate changes require a fresh effectiveFrom
    });
    setFormError(null);
    setDupeWarn(false);
    setModal(true);
  };

  const save = async () => {
    setSaving(true);
    setFormError(null);
    try {
      const payload: Record<string, unknown> = {
        name: form.name.trim(),
        whatsappNumber: form.whatsappNumber.trim(),
        alternatePhone: form.alternatePhone.trim() || undefined,
        address: form.address.trim(),
        deliveryNotes: form.deliveryNotes.trim(),
        defaultProductId: form.defaultProductId,
        defaultQuantityMilliLitres: litresToMl(form.defaultQuantityLiters),
        scheduleType: form.scheduleType,
        weekdays: form.scheduleType === 'specificWeekdays' ? form.weekdays : undefined,
        oneTimeDate: form.scheduleType === 'oneTime' ? form.oneTimeDate : undefined,
        scheduleStartDate: form.scheduleStartDate,
        defaultShift: form.defaultShift,
        billingCycle: form.billingCycle || undefined,
        openingBalancePaisa: rupeesToPaisa(form.openingBalance || '0'),
      };
      if (!editing) {
        const rate = rupeesToPaisa(form.rateRupees);
        if (!Number.isFinite(rate) || rate <= 0) throw new Error('Rate is required');
        payload.ratePaisaPerUnit = rate;
        const created = await milkVendor.addClient(payload);
        setDupeWarn(bool(created.duplicatePhone));
        if (!created.duplicatePhone) setModal(false);
        notify('Client added');
      } else {
        if (form.rateRupees) {
          payload.ratePaisaPerUnit = rupeesToPaisa(form.rateRupees);
          payload.effectiveFrom = todayStr();
        }
        const updated = await milkVendor.updateClient(editing.id, payload);
        setDupeWarn(bool(updated.duplicatePhone));
        if (!updated.duplicatePhone) setModal(false);
        notify('Client updated');
      }
      await load();
      onChanged();
    } catch (e) {
      setFormError(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const doPause = async () => {
    if (!pauseFor) return;
    setSaving(true);
    try {
      await milkVendor.pauseClient(pauseFor.id, {
        startDate: pauseRange.startDate,
        endDate: pauseRange.endDate || undefined,
      });
      notify(`${str(pauseFor.name)} paused`);
      setPauseFor(null);
      await load();
      onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Pause failed');
    } finally {
      setSaving(false);
    }
  };

  const doResume = async (c: VendorClient) => {
    try {
      await milkVendor.resumeClient(c.id);
      notify(`${str(c.name)} resumed`);
      await load();
      onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Resume failed');
    }
  };

  const doDeactivate = async (c: VendorClient) => {
    try {
      await milkVendor.deactivateClient(c.id);
      notify(`${str(c.name)} deactivated`);
      await load();
      onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Deactivate failed');
    }
  };

  const openDetail = async (id: string) => {
    setDetailFor(id);
    setDetail(null);
    try {
      setDetail(await milkVendor.client(id));
    } catch {
      setDetail(null);
    }
  };

  const visible = clients.filter((c) => statusFilter === 'all' || str(c.status, 'active') === statusFilter);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className={`${inputCls} w-auto`}>
          <option value="active">Active</option>
          <option value="paused">Paused</option>
          <option value="inactive">Inactive</option>
          <option value="all">All</option>
        </select>
        <button onClick={openAdd} className={btnPrimary}>
          <Plus className="h-4 w-4" /> Add client
        </button>
      </div>

      <ErrorBanner message={error} />
      {loading ? (
        <EmptyState message="Loading clients…" />
      ) : visible.length === 0 ? (
        <EmptyState message="No clients here yet. Add your first customer — they do not need an Agrovercity account." />
      ) : (
        <div className="space-y-2">
          {visible.map((c) => (
            <div key={c.id} className="rounded-2xl border border-slate-200 bg-white p-3 sm:p-4 shadow-sm">
              <div className="flex items-start justify-between gap-2">
                <button className="min-w-0 text-left" onClick={() => openDetail(c.id)}>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-slate-800">{str(c.name)}</span>
                    <span
                      className={`text-[10px] px-1.5 py-0.5 rounded ${
                        c.status === 'paused'
                          ? 'bg-amber-100 text-amber-700'
                          : c.status === 'inactive'
                            ? 'bg-slate-200 text-slate-600'
                            : 'bg-emerald-100 text-emerald-700'
                      }`}
                    >
                      {str(c.status, 'active').toUpperCase()}
                    </span>
                  </div>
                  <div className="text-xs text-slate-500 mt-0.5">
                    {str(c.area || c.address)} · {str(c.scheduleType, 'daily')}
                    {c.status === 'active' && bool(c.scheduledToday) ? ' · due today' : ''}
                  </div>
                </button>
                <div className="text-right shrink-0">
                  <div className="text-sm font-semibold text-slate-800 flex items-center gap-1 justify-end">
                    <IndianRupee className="h-3.5 w-3.5" />
                    {((num(c.recordedBalancePaisa) || 0) / 100).toFixed(2)}
                  </div>
                  <div className="text-[11px] text-slate-500">recorded balance</div>
                </div>
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                <button onClick={() => openEdit(c)} className={btnGhost}>
                  <Pencil className="h-3.5 w-3.5" /> Edit
                </button>
                {c.status === 'paused' ? (
                  <button onClick={() => doResume(c)} className={btnGhost}>
                    <Play className="h-3.5 w-3.5" /> Resume
                  </button>
                ) : (
                  <button onClick={() => setPauseFor(c)} className={btnGhost}>
                    <Pause className="h-3.5 w-3.5" /> Pause
                  </button>
                )}
                {c.status !== 'inactive' && (
                  <button onClick={() => doDeactivate(c)} className={btnDanger}>
                    <Power className="h-3.5 w-3.5" /> Deactivate
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <ModalSheet isOpen={modal} onClose={() => setModal(false)} title={editing ? 'Edit client' : 'Add client'} maxWidth="lg">
        <div className="space-y-3">
          <ErrorBanner message={formError} />
          {dupeWarn && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700">
              Another client has this phone number — please confirm they are different people before saving.
            </div>
          )}
          <Field label="Name *">
            <input className={inputCls} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </Field>
          <Field label="WhatsApp / mobile (with country code) *">
            <input className={inputCls} placeholder="+919812345678" value={form.whatsappNumber} onChange={(e) => setForm({ ...form, whatsappNumber: e.target.value })} />
          </Field>
          <Field label="Alternate phone">
            <input className={inputCls} value={form.alternatePhone} onChange={(e) => setForm({ ...form, alternatePhone: e.target.value })} />
          </Field>
          <Field label="Delivery address / area *">
            <input className={inputCls} value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
          </Field>
          <Field label="Default product *">
            <select className={inputCls} value={form.defaultProductId} onChange={(e) => setForm({ ...form, defaultProductId: e.target.value })}>
              {products.map((p) => (
                <option key={str(p.id)} value={str(p.id)}>
                  {str(p.name)} ({str(p.unit, 'litre')})
                </option>
              ))}
            </select>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Default quantity (litres) *">
              <input type="number" min="0.05" step="0.25" className={inputCls} value={form.defaultQuantityLiters} onChange={(e) => setForm({ ...form, defaultQuantityLiters: e.target.value })} />
            </Field>
            <Field label={editing ? 'New rate (₹/L, from today)' : 'Rate (₹/L) *'}>
              <input type="number" min="0" step="0.5" className={inputCls} value={form.rateRupees} onChange={(e) => setForm({ ...form, rateRupees: e.target.value })} />
            </Field>
          </div>
          <Field label="Delivery schedule *">
            <select className={inputCls} value={form.scheduleType} onChange={(e) => setForm({ ...form, scheduleType: e.target.value })}>
              <option value="daily">Daily</option>
              <option value="alternateDays">Alternate days</option>
              <option value="specificWeekdays">Specific weekdays</option>
              <option value="oneTime">One-time</option>
            </select>
          </Field>
          {form.scheduleType === 'specificWeekdays' && (
            <Field label="Weekdays *">
              <div className="flex flex-wrap gap-2">
                {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((label, i) => (
                  <label key={label} className={`px-2.5 py-1.5 rounded-lg border text-sm cursor-pointer ${form.weekdays.includes(i) ? 'bg-emerald-600 text-white border-emerald-600' : 'border-slate-300'}`}>
                    <input
                      type="checkbox"
                      className="hidden"
                      checked={form.weekdays.includes(i)}
                      onChange={() =>
                        setForm({
                          ...form,
                          weekdays: form.weekdays.includes(i) ? form.weekdays.filter((w) => w !== i) : [...form.weekdays, i],
                        })
                      }
                    />
                    {label}
                  </label>
                ))}
              </div>
            </Field>
          )}
          {form.scheduleType === 'oneTime' && (
            <Field label="One-time date *">
              <input type="date" className={inputCls} value={form.oneTimeDate} onChange={(e) => setForm({ ...form, oneTimeDate: e.target.value })} />
            </Field>
          )}
          <div className="grid grid-cols-2 gap-3">
            <Field label="Start date *">
              <input type="date" className={inputCls} value={form.scheduleStartDate} onChange={(e) => setForm({ ...form, scheduleStartDate: e.target.value })} />
            </Field>
            <Field label="Shift">
              <select className={inputCls} value={form.defaultShift} onChange={(e) => setForm({ ...form, defaultShift: e.target.value })}>
                <option value="morning">Morning</option>
                <option value="evening">Evening</option>
              </select>
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Billing cycle override">
              <select className={inputCls} value={form.billingCycle} onChange={(e) => setForm({ ...form, billingCycle: e.target.value })}>
                <option value="">Use vendor default</option>
                <option value="weekly">Weekly</option>
                <option value="fifteenDays">Fifteen days</option>
                <option value="monthly">Monthly</option>
                <option value="custom">Custom</option>
              </select>
            </Field>
            <Field label="Opening balance (₹)">
              <input type="number" min="0" step="0.01" className={inputCls} value={form.openingBalance} onChange={(e) => setForm({ ...form, openingBalance: e.target.value })} />
            </Field>
          </div>
          <Field label="Delivery notes">
            <textarea className={inputCls} rows={2} value={form.deliveryNotes} onChange={(e) => setForm({ ...form, deliveryNotes: e.target.value })} />
          </Field>
          <div className="flex justify-end gap-2 pt-2">
            <button onClick={() => setModal(false)} className={btnGhost}>Cancel</button>
            <button onClick={save} disabled={saving} className={btnPrimary}>
              {saving ? 'Saving…' : editing ? 'Save changes' : 'Add client'}
            </button>
          </div>
        </div>
      </ModalSheet>

      <ModalSheet isOpen={!!pauseFor} onClose={() => setPauseFor(null)} title={`Pause ${str(pauseFor?.name)}`} maxWidth="sm">
        <div className="space-y-3">
          <p className="text-sm text-slate-600">Paused clients are not listed as required deliveries during the pause range. History and billing stay intact.</p>
          <Field label="Pause from *">
            <input type="date" className={inputCls} value={pauseRange.startDate} onChange={(e) => setPauseRange({ ...pauseRange, startDate: e.target.value })} />
          </Field>
          <Field label="Until (leave empty for open-ended)">
            <input type="date" className={inputCls} value={pauseRange.endDate} onChange={(e) => setPauseRange({ ...pauseRange, endDate: e.target.value })} />
          </Field>
          <div className="flex justify-end gap-2">
            <button onClick={() => setPauseFor(null)} className={btnGhost}>Cancel</button>
            <button onClick={doPause} disabled={saving} className={btnPrimary}>{saving ? 'Saving…' : 'Pause'}</button>
          </div>
        </div>
      </ModalSheet>

      <ModalSheet isOpen={!!detailFor} onClose={() => setDetailFor(null)} title={detail ? str(detail.name) : 'Client'} maxWidth="2xl">
        {!detail ? (
          <EmptyState message="Loading…" />
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
              <MiniStat label="Balance" value={fmtPaisa(num(detail.recordedBalancePaisa))} />
              <MiniStat label="Deliveries" value={String(recArr(detail.recentDeliveries).length)} />
              <MiniStat label="Bills" value={String(recArr(detail.bills).length)} />
              <MiniStat label="Payments" value={String(recArr(detail.payments).length)} />
            </div>
            <SectionCard title="Recent deliveries">
              {recArr(detail.recentDeliveries).length === 0 ? (
                <p className="text-sm text-slate-500">No deliveries recorded yet.</p>
              ) : (
                <ul className="divide-y divide-slate-100 text-sm">
                  {recArr(detail.recentDeliveries).slice(0, 10).map((d) => (
                    <li key={str(d.id)} className="py-1.5 flex justify-between">
                      <span className="text-slate-600">{str(d.deliveryDate)} · {str(d.status)}</span>
                      <span className="text-slate-700">{str(d.status) === 'delivered' ? `${fmtMl(num(d.quantityMilliLitres))} · ${fmtPaisa(num(d.amountPaisa))}` : '—'}</span>
                    </li>
                  ))}
                </ul>
              )}
            </SectionCard>
            <SectionCard title="Bills & payments">
              <ul className="divide-y divide-slate-100 text-sm">
                {recArr(detail.bills).slice(0, 6).map((b) => (
                  <li key={str(b.id)} className="py-1.5 flex justify-between">
                    <span className="text-slate-600">{str(b.billNumber)} (rev {num(b.revisionNumber, 1)}) · {str(b.status)}</span>
                    <span className="text-slate-700">{fmtPaisa(num(b.balancePaisa))}</span>
                  </li>
                ))}
                {recArr(detail.payments).slice(0, 6).map((p) => (
                  <li key={str(p.id)} className="py-1.5 flex justify-between">
                    <span className="text-slate-600">{str(p.paymentDate)} · {str(p.method)}{bool(p.voidedAt) ? ' · VOID' : ''}</span>
                    <span className={bool(p.voidedAt) ? 'text-slate-400 line-through' : 'text-emerald-700'}>{fmtPaisa(num(p.amountPaisa))}</span>
                  </li>
                ))}
              </ul>
            </SectionCard>
          </div>
        )}
      </ModalSheet>
    </div>
  );
};

const Field: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <label className="block">
    <span className="block text-xs font-medium text-slate-600 mb-1">{label}</span>
    {children}
  </label>
);

const MiniStat: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div className="rounded-xl bg-slate-50 border border-slate-200 p-2">
    <div className="text-[10px] uppercase text-slate-500">{label}</div>
    <div className="text-sm font-semibold text-slate-800">{value}</div>
  </div>
);
