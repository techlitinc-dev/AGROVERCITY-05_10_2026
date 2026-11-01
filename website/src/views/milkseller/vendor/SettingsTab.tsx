import React, { useState } from 'react';
import { Save } from 'lucide-react';
import { milkVendor } from '../../../lib/api';
import { SectionCard, ErrorBanner, inputCls, btnPrimary, str } from './shared';

interface Props {
  profile: Record<string, unknown>;
  onSaved: (profile: Record<string, unknown>) => void;
  notify: (message: string) => void;
}

export const SettingsTab: React.FC<Props> = ({ profile, onSaved, notify }) => {
  const [form, setForm] = useState({
    businessName: str(profile.businessName),
    displayName: str(profile.displayName),
    phone: str(profile.phone),
    whatsappNumber: str(profile.whatsappNumber),
    address: str(profile.address),
    billPrefix: str(profile.billPrefix, 'MV'),
    defaultBillingCycle: str(profile.defaultBillingCycle, 'monthly'),
    defaultShift: str(profile.defaultShift, 'morning'),
    paymentInstructions: str(profile.paymentInstructions),
    upiId: str(profile.upiId),
    defaultBillNotes: str(profile.defaultBillNotes),
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      const saved = await milkVendor.saveProfile({
        ...form,
        logoStorageReference: profile.logoStorageReference || undefined,
      });
      onSaved(saved);
      notify('Settings saved');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm({ ...form, [key]: e.target.value });

  return (
    <div className="space-y-4">
      <ErrorBanner message={error} />
      {!profile.kycVerified && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700">
          Your vendor KYC is not verified yet — Today, billing and payments unlock once verification completes. Your customers never need KYC or accounts.
        </div>
      )}

      <SectionCard title="Business profile">
        <div className="grid sm:grid-cols-2 gap-3">
          <label className="block">
            <span className="block text-xs font-medium text-slate-600 mb-1">Business name</span>
            <input className={inputCls} value={form.businessName} onChange={set('businessName')} placeholder="Sharma Dairy" />
          </label>
          <label className="block">
            <span className="block text-xs font-medium text-slate-600 mb-1">Display name</span>
            <input className={inputCls} value={form.displayName} onChange={set('displayName')} />
          </label>
          <label className="block">
            <span className="block text-xs font-medium text-slate-600 mb-1">Phone</span>
            <input className={inputCls} value={form.phone} onChange={set('phone')} />
          </label>
          <label className="block">
            <span className="block text-xs font-medium text-slate-600 mb-1">WhatsApp (with country code)</span>
            <input className={inputCls} value={form.whatsappNumber} onChange={set('whatsappNumber')} placeholder="+919812345678" />
          </label>
          <label className="block sm:col-span-2">
            <span className="block text-xs font-medium text-slate-600 mb-1">Address</span>
            <textarea rows={2} className={inputCls} value={form.address} onChange={set('address')} />
          </label>
        </div>
      </SectionCard>

      <SectionCard title="Billing defaults">
        <div className="grid sm:grid-cols-2 gap-3">
          <label className="block">
            <span className="block text-xs font-medium text-slate-600 mb-1">Bill prefix</span>
            <input className={inputCls} value={form.billPrefix} onChange={set('billPrefix')} />
          </label>
          <label className="block">
            <span className="block text-xs font-medium text-slate-600 mb-1">Default billing cycle</span>
            <select className={inputCls} value={form.defaultBillingCycle} onChange={set('defaultBillingCycle')}>
              <option value="weekly">Weekly</option>
              <option value="fifteenDays">Fifteen days</option>
              <option value="monthly">Monthly</option>
              <option value="custom">Custom</option>
            </select>
          </label>
          <label className="block">
            <span className="block text-xs font-medium text-slate-600 mb-1">Default shift</span>
            <select className={inputCls} value={form.defaultShift} onChange={set('defaultShift')}>
              <option value="morning">Morning</option>
              <option value="evening">Evening</option>
            </select>
          </label>
          <label className="block">
            <span className="block text-xs font-medium text-slate-600 mb-1">UPI ID (text only, shown on bills)</span>
            <input className={inputCls} value={form.upiId} onChange={set('upiId')} placeholder="name@upi" />
          </label>
        </div>
      </SectionCard>

      <SectionCard title="Bill message">
        <label className="block">
          <span className="block text-xs font-medium text-slate-600 mb-1">Payment instructions (shown on the bill)</span>
          <textarea rows={3} className={inputCls} value={form.paymentInstructions} onChange={set('paymentInstructions')} placeholder="Please pay by UPI before the 5th of the month…" />
        </label>
        <label className="block mt-3">
          <span className="block text-xs font-medium text-slate-600 mb-1">Default bill notes</span>
          <textarea rows={2} className={inputCls} value={form.defaultBillNotes} onChange={set('defaultBillNotes')} />
        </label>
      </SectionCard>

      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] text-slate-400">Language/timezone follow your existing app preferences.</p>
        <button onClick={save} disabled={saving} className={btnPrimary}>
          <Save className="h-4 w-4" /> {saving ? 'Saving…' : 'Save settings'}
        </button>
      </div>
    </div>
  );
};
