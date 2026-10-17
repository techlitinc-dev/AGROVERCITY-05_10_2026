import React, { useEffect, useState } from 'react';
import { Building2, Save, AlertCircle, CheckCircle2, Landmark } from 'lucide-react';
import { livestock, apiErrorMessage } from '../../lib/api';
import { formatCurrency } from '../../lib/utils';
import { asRec, strOf } from './helpers';

const EMPTY = {
  name: '',
  trustName: '',
  address: '',
  district: '',
  phone: '',
  capacity: 0,
  regNo80G: '',
  pan: '',
  bankAccountName: '',
  bankAccountNumber: '',
  bankIfsc: '',
};

export const GaushalaProfilePage: React.FC = () => {
  const [exists, setExists] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY);

  useEffect(() => {
    (async () => {
      try {
        const mine = asRec(await livestock.gaushala.mine());
        const bank = asRec(mine.bankDetails);
        const certs = asRec(mine.certifications);
        setExists(true);
        setForm({
          name: strOf(mine.name),
          trustName: strOf(mine.trustName),
          address: strOf(mine.address),
          district: strOf(mine.district),
          phone: strOf(mine.phone),
          capacity: Number(mine.capacity ?? 0) || 0,
          regNo80G: strOf(certs.regNo80G) || strOf(certs['80g']),
          pan: strOf(certs.pan),
          bankAccountName: strOf(bank.accountName),
          bankAccountNumber: strOf(bank.accountNumber),
          bankIfsc: strOf(bank.ifsc),
        });
      } catch {
        setExists(false);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setNotice(null);
    const payload: Record<string, unknown> = {
      name: form.name,
      trustName: form.trustName,
      address: form.address,
      district: form.district,
      phone: form.phone,
      capacity: Number(form.capacity),
      certifications: {
        regNo80G: form.regNo80G,
        pan: form.pan,
      },
      bankDetails: {
        accountName: form.bankAccountName,
        accountNumber: form.bankAccountNumber,
        ifsc: form.bankIfsc,
      },
    };
    try {
      if (exists) {
        await livestock.gaushala.updateProfile(payload);
        setNotice('Gaushala profile updated.');
      } else {
        await livestock.gaushala.createProfile(payload);
        setExists(true);
        setNotice('Gaushala profile created. Head to the dashboard to manage cattle.');
      }
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <p className="text-xs text-slate-400">Loading profile…</p>;

  const inputCls = 'w-full px-3 py-2 text-xs rounded-xl border border-slate-300';
  const labelCls = 'block text-xs font-bold text-slate-700 mb-1';

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="border-b border-slate-200 pb-4">
        <h1 className="text-2xl font-extrabold text-slate-900 flex items-center gap-2">
          <Building2 className="w-7 h-7 text-emerald-600" />
          {exists ? 'Gaushala Trust Profile' : 'Create Gaushala Profile'}
        </h1>
        <p className="text-xs text-slate-500 mt-1">
          Trust identity, 80G certification and bank details used on receipts and transparency reports
        </p>
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

      <form onSubmit={handleSave} className="space-y-5">
        <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs p-6 space-y-3">
          <h3 className="font-bold text-sm text-slate-900">Trust identity</h3>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Gaushala Name *</label>
              <input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={inputCls} required />
            </div>
            <div>
              <label className={labelCls}>Trust Name</label>
              <input type="text" value={form.trustName} onChange={(e) => setForm({ ...form, trustName: e.target.value })} className={inputCls} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Phone</label>
              <input type="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Shelter Capacity (heads)</label>
              <input type="number" min="0" value={form.capacity} onChange={(e) => setForm({ ...form, capacity: Number(e.target.value) })} className={inputCls} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Address</label>
              <input type="text" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>District</label>
              <input type="text" value={form.district} onChange={(e) => setForm({ ...form, district: e.target.value })} className={inputCls} />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs p-6 space-y-3">
          <h3 className="font-bold text-sm text-slate-900">80G certification</h3>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>80G Registration No.</label>
              <input type="text" value={form.regNo80G} onChange={(e) => setForm({ ...form, regNo80G: e.target.value })} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Trust PAN</label>
              <input type="text" value={form.pan} onChange={(e) => setForm({ ...form, pan: e.target.value })} className={inputCls} />
            </div>
          </div>
          <p className="text-[10px] text-slate-400">
            Donation receipts carry these numbers for donor tax exemption (Section 80G).
          </p>
        </div>

        <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs p-6 space-y-3">
          <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
            <Landmark className="w-4 h-4 text-emerald-600" /> Bank details (for donation settlements)
          </h3>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className={labelCls}>Account Name</label>
              <input type="text" value={form.bankAccountName} onChange={(e) => setForm({ ...form, bankAccountName: e.target.value })} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Account Number</label>
              <input type="text" value={form.bankAccountNumber} onChange={(e) => setForm({ ...form, bankAccountNumber: e.target.value })} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>IFSC</label>
              <input type="text" value={form.bankIfsc} onChange={(e) => setForm({ ...form, bankIfsc: e.target.value })} className={inputCls} />
            </div>
          </div>
        </div>

        <button
          type="submit"
          disabled={saving}
          className="inline-flex items-center gap-1.5 px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white font-bold text-xs shadow-md"
        >
          <Save className="w-4 h-4" /> {saving ? 'Saving…' : exists ? 'Save Profile' : 'Create Profile'}
        </button>
      </form>
    </div>
  );
};

export default GaushalaProfilePage;
