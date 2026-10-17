import React, { useCallback, useEffect, useState } from 'react';
import { Building2, Save, RefreshCcw, ShieldCheck } from 'lucide-react';
import { directBuyer, users, apiErrorMessage } from '../../lib/api';
import {
  cardCls,
  ErrorBanner,
  ghostBtnCls,
  inputCls,
  labelCls,
  LoadingBlock,
  primaryBtnCls,
  num,
  rec,
  str,
  type Rec,
} from './shared';

const BUYER_TYPES = ['retailer', 'wholesaler', 'processor', 'exporter', 'hotel', 'institutional'];

/**
 * Buyer org setup: company profile persisted through the persona-setup role
 * profile (directBuyer). The buyer-org roster itself lives on the Team page.
 */
export const BuyerOrgSetupPage: React.FC = () => {
  const [org, setOrg] = useState<Rec>({});
  const [profile, setProfile] = useState<Rec>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // form fields
  const [companyName, setCompanyName] = useState('');
  const [buyerType, setBuyerType] = useState('wholesaler');
  const [gstin, setGstin] = useState('');
  const [licenseNo, setLicenseNo] = useState('');
  const [capacityPerMonth, setCapacityPerMonth] = useState(0);
  const [creditTermsDays, setCreditTermsDays] = useState(0);
  const [operatingStates, setOperatingStates] = useState('');
  const [categories, setCategories] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [o, p] = await Promise.all([
        directBuyer.org().catch(() => ({})),
        directBuyer.profile().catch(() => ({})),
      ]);
      const orgRec = rec(o);
      const profRec = rec(p);
      setOrg(orgRec);
      setProfile(profRec);
      const role = rec(profRec.roleProfile ?? profRec.profile);
      setCompanyName(str(role.companyName, str(orgRec.companyName)));
      setBuyerType(str(role.buyerType, 'wholesaler'));
      setGstin(str(role.gstin));
      setLicenseNo(str(role.licenseNo));
      setCapacityPerMonth(num(role.capacityPerMonth));
      setCreditTermsDays(num(role.creditTermsDays));
      setOperatingStates((role.operatingStates as string[] | undefined)?.join(', ') ?? '');
      setCategories((role.categories as string[] | undefined)?.join(', ') ?? '');
    } catch (e) {
      setError(apiErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setActionError(null);
    setNotice(null);
    try {
      await users.personaSetup({
        profiles: ['directBuyer'],
        primaryProfile: 'directBuyer',
        roleProfiles: {
          directBuyer: {
            companyName,
            buyerType,
            gstin,
            licenseNo,
            capacityPerMonth,
            creditTermsDays,
            operatingStates: operatingStates.split(',').map((s) => s.trim()).filter(Boolean),
            categories: categories.split(',').map((s) => s.trim()).filter(Boolean),
          },
        },
      });
      setNotice('Organisation profile saved');
      await load();
    } catch (err) {
      setActionError(apiErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const members = Array.isArray(org.members) ? (org.members as unknown[]) : [];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 flex items-center gap-2">
            <Building2 className="w-7 h-7 text-emerald-600" />
            Organisation Setup
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Company identity used on contracts, statements and escrow payouts
          </p>
        </div>
        <button onClick={() => void load()} className={ghostBtnCls}>
          <RefreshCcw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
        </button>
      </div>

      <ErrorBanner message={error ?? actionError} />
      {notice && (
        <div className="p-3 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center gap-2">
          <ShieldCheck className="w-4 h-4" /> {notice}
        </div>
      )}

      {loading ? (
        <LoadingBlock />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          <form onSubmit={(e) => void save(e)} className={`${cardCls} p-6 space-y-4 lg:col-span-3`}>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Company Name</label>
                <input className={inputCls} value={companyName} onChange={(e) => setCompanyName(e.target.value)} required />
              </div>
              <div>
                <label className={labelCls}>Buyer Type</label>
                <select className={inputCls} value={buyerType} onChange={(e) => setBuyerType(e.target.value)}>
                  {BUYER_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t.charAt(0).toUpperCase() + t.slice(1)}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>GSTIN</label>
                <input className={inputCls} value={gstin} onChange={(e) => setGstin(e.target.value)} placeholder="27AAAAA0000A1Z5" />
              </div>
              <div>
                <label className={labelCls}>Trade License No.</label>
                <input className={inputCls} value={licenseNo} onChange={(e) => setLicenseNo(e.target.value)} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Capacity (q/month)</label>
                <input type="number" className={inputCls} value={capacityPerMonth} onChange={(e) => setCapacityPerMonth(Number(e.target.value))} />
              </div>
              <div>
                <label className={labelCls}>Credit Terms (days)</label>
                <input type="number" className={inputCls} value={creditTermsDays} onChange={(e) => setCreditTermsDays(Number(e.target.value))} />
              </div>
            </div>
            <div>
              <label className={labelCls}>Operating States (comma separated)</label>
              <input className={inputCls} value={operatingStates} onChange={(e) => setOperatingStates(e.target.value)} placeholder="Maharashtra, Gujarat" />
            </div>
            <div>
              <label className={labelCls}>Sourcing Categories (comma separated)</label>
              <input className={inputCls} value={categories} onChange={(e) => setCategories(e.target.value)} placeholder="Pulses, Oilseeds, Spices" />
            </div>
            <button type="submit" disabled={saving} className={`${primaryBtnCls} w-full py-3 flex items-center justify-center gap-1.5`}>
              <Save className="w-4 h-4" /> {saving ? 'Saving…' : 'Save Organisation Profile'}
            </button>
          </form>

          <div className="lg:col-span-2 space-y-4">
            <div className={`${cardCls} p-5 space-y-3`}>
              <h3 className="font-bold text-sm text-slate-900">Current Org Snapshot</h3>
              {[
                { label: 'Company', value: str(org.companyName, companyName || '—') },
                { label: 'Org ID', value: str(org.id, '—') },
                { label: 'Team Size', value: String(members.length) },
                { label: 'KYC', value: str(profile.kycStatus, '—') },
              ].map((r) => (
                <div key={r.label} className="flex justify-between text-xs">
                  <span className="text-slate-400 font-semibold">{r.label}</span>
                  <span className="font-bold text-slate-800">{r.value}</span>
                </div>
              ))}
            </div>
            <div className={`${cardCls} p-5 space-y-2`}>
              <h3 className="font-bold text-sm text-slate-900">Why this matters</h3>
              <ul className="text-[11px] text-slate-500 space-y-1.5 list-disc pl-4">
                <li>Company name and GSTIN appear on farmer contracts and GST invoices.</li>
                <li>Operating states determine IGST vs CGST+SGST on your invoices.</li>
                <li>Credit terms flow into contract payment-term defaults.</li>
              </ul>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
