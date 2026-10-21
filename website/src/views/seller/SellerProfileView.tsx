import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Building2,
  BadgeCheck,
  ShieldAlert,
  Save,
  RefreshCw,
  Plus,
  X,
  Store,
  FileText,
  MapPin,
  TrendingUp,
  Image,
  CheckCircle2,
  Landmark,
  ShieldCheck,
  Ban,
} from 'lucide-react';
import { seller, kyc, apiErrorMessage } from '../../lib/api';
import { StatusBadge } from '../../components/common/StatusBadge';
import { cardCls, inputCls, labelCls, primaryBtnCls, ghostBtnCls, rec, str, arr, num, type Rec } from './shared';

const BUSINESS_TYPES = [
  { id: 'wholesaler', label: 'Wholesaler (थोक व्यापारी)' },
  { id: 'commission_agent', label: 'Commission Agent / Adatiya (आढ़तिया)' },
  { id: 'processor', label: 'Agri Processor / Miller (प्रोसेसर / मिलर)' },
  { id: 'retailer', label: 'Semi-Wholesaler / Retailer (खुदरा विक्रेता)' },
  { id: 'exporter', label: 'Produce Exporter (कृषि निर्यातक)' },
];

const CAPACITY_BANDS = [
  { id: 'under_2l', label: '< ₹2 Lakhs / month (Micro Trader)' },
  { id: '2l_10l', label: '₹2 Lakhs - ₹10 Lakhs (Established Vyapari)' },
  { id: '10l_50l', label: '₹10 Lakhs - ₹50 Lakhs (Wholesale Dealer)' },
  { id: 'above_50l', label: '> ₹50 Lakhs (Institutional / Bulk Buyer)' },
];

const COMMON_STATES = [
  'Maharashtra',
  'Gujarat',
  'Madhya Pradesh',
  'Karnataka',
  'Rajasthan',
  'Punjab',
  'Haryana',
  'Uttar Pradesh',
  'Andhra Pradesh',
  'Telangana',
  'Tamil Nadu',
];

export const SellerProfileView: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [shopName, setShopName] = useState('');
  const [gstNumber, setGstNumber] = useState('');
  const [apmcLicense, setApmcLicense] = useState('');
  const [businessType, setBusinessType] = useState('wholesaler');
  const [buyingCapacityBand, setBuyingCapacityBand] = useState('2l_10l');
  const [yearsInTrade, setYearsInTrade] = useState(5);
  const [logoPath, setLogoPath] = useState('');
  const [operatingStates, setOperatingStates] = useState<string[]>(['Maharashtra']);
  const [mandis, setMandis] = useState<string[]>(['Pune APMC']);
  const [newMandi, setNewMandi] = useState('');

  const [kycStatus, setKycStatus] = useState<string>('unverified');

  const loadProfile = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [profData, kycData] = await Promise.all([
        seller.profile().catch(() => ({})),
        kyc.status().catch(() => ({})),
      ]);
      const p = rec(profData);
      if (p.shopName) setShopName(str(p.shopName));
      if (p.gstNumber) setGstNumber(str(p.gstNumber));
      if (p.apmcLicense) setApmcLicense(str(p.apmcLicense));
      if (p.businessType) setBusinessType(str(p.businessType));
      if (p.buyingCapacityBand) setBuyingCapacityBand(str(p.buyingCapacityBand));
      if (p.yearsInTrade !== undefined) setYearsInTrade(num(p.yearsInTrade) || 5);
      if (p.logoPath) setLogoPath(str(p.logoPath));
      if (Array.isArray(p.operatingStates) && p.operatingStates.length > 0) {
        setOperatingStates(p.operatingStates.map(String));
      }
      if (Array.isArray(p.mandis) && p.mandis.length > 0) {
        setMandis(p.mandis.map(String));
      }
      const k = rec(kycData);
      const cases = arr(k.data ?? k).map(rec);
      const sellerCase = cases.find((c) => str(c.persona) === 'seller');
      setKycStatus(str(sellerCase?.status) || (p.gstNumber ? 'verified' : 'unverified'));
    } catch (e) {
      setError(apiErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadProfile();
  }, [loadProfile]);

  const toggleState = (st: string) => {
    setOperatingStates((prev) =>
      prev.includes(st) ? prev.filter((s) => s !== st) : [...prev, st]
    );
  };

  const addMandi = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newMandi.trim();
    if (trimmed && !mandis.includes(trimmed)) {
      setMandis((prev) => [...prev, trimmed]);
      setNewMandi('');
    }
  };

  const removeMandi = (m: string) => {
    setMandis((prev) => prev.filter((x) => x !== m));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!shopName.trim()) {
      setError('Shop / Business Name is required');
      return;
    }
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      await seller.updateProfile({
        shopName: shopName.trim(),
        gstNumber: gstNumber.trim().toUpperCase(),
        apmcLicense: apmcLicense.trim(),
        businessType,
        buyingCapacityBand,
        yearsInTrade: Number(yearsInTrade) || 0,
        logoPath: logoPath.trim(),
        operatingStates,
        mandis,
      });
      setNotice('Vyapari business profile updated successfully!');
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <h1 className="text-2xl font-black text-slate-900 flex items-center gap-2.5">
            <Building2 className="w-7 h-7 text-emerald-600" />
            Vyapari Business Profile & APMC Mandi Registration
          </h1>
          <p className="text-xs text-slate-500 mt-1 font-medium">
            Manage your B2B trade credentials, APMC mandi operating jurisdictions, buying capacity, and verified tax identity.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => void loadProfile()}
            className={`${ghostBtnCls} flex items-center gap-1.5 text-xs font-bold`}
          >
            <RefreshCw className="w-3.5 h-3.5" /> Reload
          </button>
          <StatusBadge status={kycStatus} />
        </div>
      </div>

      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl text-xs font-semibold text-rose-800 flex items-center justify-between">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="text-rose-600 hover:underline">Dismiss</button>
        </div>
      )}

      {notice && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl text-xs font-semibold text-emerald-800 flex items-center justify-between">
          <span className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            {notice}
          </span>
          <button onClick={() => setNotice(null)} className="text-emerald-700 hover:underline font-bold">Dismiss</button>
        </div>
      )}

      {loading ? (
        <div className="py-20 text-center text-xs font-bold text-slate-400 animate-pulse">
          Loading Vyapari Business Profile…
        </div>
      ) : (
        <form onSubmit={handleSave} className="space-y-6">
          {/* Shop KYC gate — mirrors _assert_shop_kyc on the backend */}
          <div className={`${cardCls} p-5 space-y-3`}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-sm font-black text-slate-900 flex items-center gap-2">
                {kycStatus === 'verified' ? (
                  <ShieldCheck className="w-4 h-4 text-emerald-600" />
                ) : (
                  <ShieldAlert className="w-4 h-4 text-amber-600" />
                )}
                Shop KYC — APMC Licence & GST Verification
              </h2>
              <StatusBadge status={kycStatus} />
            </div>
            {kycStatus === 'verified' ? (
              <p className="text-xs text-slate-600">
                Shop KYC is verified. Rate posting, J-form procurement, and escrow trading are fully unlocked.
              </p>
            ) : (
              <div className="p-3 bg-amber-50 rounded-2xl border border-amber-200 text-xs text-amber-900 space-y-1.5">
                <p className="font-bold flex items-center gap-1.5">
                  <Ban className="w-3.5 h-3.5" /> Blocked until shop KYC is verified:
                </p>
                <ul className="list-disc pl-5 space-y-0.5">
                  <li>Posting mandi rates (POST /seller/rates)</li>
                  <li>J-form procurement recording (POST /seller/procurement)</li>
                </ul>
              </div>
            )}
            <div className="flex flex-wrap gap-2 pt-1">
              <Link to="/kyc" className={`${primaryBtnCls} flex items-center gap-1.5`}>
                <ShieldCheck className="w-3.5 h-3.5" />
                {kycStatus === 'verified' ? 'Review KYC Case' : 'Complete Shop KYC'}
              </Link>
              <Link to="/bank-accounts" className={`${ghostBtnCls} flex items-center gap-1.5`}>
                <Landmark className="w-3.5 h-3.5" /> Bank Accounts (payouts)
              </Link>
            </div>
          </div>

          {/* Section 1: Business Identity */}
          <div className={`${cardCls} space-y-5`}>
            <div className="border-b border-slate-100 pb-3 flex items-center justify-between">
              <h2 className="text-sm font-black text-slate-900 flex items-center gap-2">
                <Store className="w-4 h-4 text-emerald-600" />
                1. Firm & Trade Identity
              </h2>
              <span className="text-xs font-semibold text-slate-400">Required for J-Form & E-Invoicing</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className={labelCls}>Shop / Firm Name *</label>
                <input
                  type="text"
                  required
                  value={shopName}
                  onChange={(e) => setShopName(e.target.value)}
                  placeholder="e.g. Vijay Traders, Kisan Agro Mill"
                  className={inputCls}
                />
              </div>

              <div>
                <label className={labelCls}>Business Entity Type</label>
                <select
                  value={businessType}
                  onChange={(e) => setBusinessType(e.target.value)}
                  className={inputCls}
                >
                  {BUSINESS_TYPES.map((t) => (
                    <option key={t.id} value={t.id}>{t.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className={labelCls}>GSTIN (GST Identification Number)</label>
                <input
                  type="text"
                  value={gstNumber}
                  onChange={(e) => setGstNumber(e.target.value.toUpperCase())}
                  placeholder="27AAAAA0000A1Z5"
                  maxLength={15}
                  className={`${inputCls} uppercase font-mono`}
                />
                <p className="text-[10px] text-slate-400 mt-1">15-character alphanumeric GSTIN</p>
              </div>

              <div>
                <label className={labelCls}>APMC Trader Licence Number</label>
                <input
                  type="text"
                  value={apmcLicense}
                  onChange={(e) => setApmcLicense(e.target.value)}
                  placeholder="APMC-PUN-TR-2024-889"
                  className={inputCls}
                />
                <p className="text-[10px] text-slate-400 mt-1">APMC market yard trading permit number</p>
              </div>

              <div>
                <label className={labelCls}>Experience in Trade (Years)</label>
                <input
                  type="number"
                  min={0}
                  max={70}
                  value={yearsInTrade}
                  onChange={(e) => setYearsInTrade(Number(e.target.value))}
                  className={inputCls}
                />
              </div>

              <div>
                <label className={labelCls}>Monthly Buying Capacity Band</label>
                <select
                  value={buyingCapacityBand}
                  onChange={(e) => setBuyingCapacityBand(e.target.value)}
                  className={inputCls}
                >
                  {CAPACITY_BANDS.map((b) => (
                    <option key={b.id} value={b.id}>{b.label}</option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className={labelCls}>Firm Logo / Shopfront Photo URL</label>
              <input
                type="text"
                value={logoPath}
                onChange={(e) => setLogoPath(e.target.value)}
                placeholder="https://cdn.example.com/firms/vijay-traders.jpg"
                className={inputCls}
              />
            </div>
          </div>

          {/* Section 2: Operating Jurisdictions */}
          <div className={`${cardCls} space-y-5`}>
            <div className="border-b border-slate-100 pb-3 flex items-center justify-between">
              <h2 className="text-sm font-black text-slate-900 flex items-center gap-2">
                <MapPin className="w-4 h-4 text-emerald-600" />
                2. Sourcing States & APMC Mandis
              </h2>
              <span className="text-xs font-semibold text-slate-400">Used by AI sourcing recommendations</span>
            </div>

            {/* Operating States Multi-Select */}
            <div>
              <label className={labelCls}>Operating States (Select all where you source produce)</label>
              <div className="flex flex-wrap gap-2 mt-2">
                {COMMON_STATES.map((st) => {
                  const active = operatingStates.includes(st);
                  return (
                    <button
                      key={st}
                      type="button"
                      onClick={() => toggleState(st)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all border ${
                        active
                          ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm shadow-emerald-600/20'
                          : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      {active ? '✓ ' : '+ '}
                      {st}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Mandis Chips */}
            <div>
              <label className={labelCls}>Active Mandis & Market Yards</label>
              <div className="flex flex-wrap gap-2 mt-1 mb-3">
                {mandis.map((m) => (
                  <span
                    key={m}
                    className="inline-flex items-center gap-1.5 px-3 py-1 bg-slate-100 text-slate-800 rounded-xl text-xs font-semibold border border-slate-200"
                  >
                    <span>{m}</span>
                    <button
                      type="button"
                      onClick={() => removeMandi(m)}
                      className="text-slate-400 hover:text-rose-600 transition-colors"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </span>
                ))}
              </div>

              <div className="flex gap-2 max-w-md">
                <input
                  type="text"
                  value={newMandi}
                  onChange={(e) => setNewMandi(e.target.value)}
                  placeholder="e.g. Nashik APMC, Lasalgaon"
                  className={inputCls}
                />
                <button
                  type="button"
                  onClick={addMandi}
                  className={`${ghostBtnCls} flex items-center gap-1 text-xs font-bold shrink-0`}
                >
                  <Plus className="w-3.5 h-3.5" /> Add Mandi
                </button>
              </div>
            </div>
          </div>

          {/* Submit Actions */}
          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="submit"
              disabled={saving}
              className={`${primaryBtnCls} flex items-center gap-2 text-sm font-black px-6 py-3 shadow-lg shadow-emerald-700/20`}
            >
              <Save className="w-4 h-4" />
              {saving ? 'Saving Profile…' : 'Save Business Profile'}
            </button>
          </div>
        </form>
      )}
    </div>
  );
};
