import React, { useEffect, useRef, useState } from 'react';
import {
  Building2,
  CheckCircle2,
  AlertCircle,
  FileText,
  CreditCard,
  MapPin,
  Save,
  ShieldCheck,
  Upload,
} from 'lucide-react';
import { apiErrorMessage, nursery, uploads } from '../../lib/api';

const SPECIALIZATIONS = [
  { id: 'fruit', label: 'Fruit Saplings (Mango, Guava, Lemon, Pomegranate)' },
  { id: 'timber', label: 'Commercial Timber (Teak, Malabar Neem, Sandalwood)' },
  { id: 'medicinal', label: 'Medicinal & Herbal (Tulsi, Ashwagandha, Amla)' },
  { id: 'ornamental', label: 'Ornamental & Indoor (Bonsai, Palms, Foliage)' },
  { id: 'flowering', label: 'Flowering Plants (Rose, Mogra, Hibiscus)' },
  { id: 'vegetables', label: 'Vegetable Seedlings (Tomato, Chilli, Brinjal)' },
];

export const NurseryProfileView: React.FC = () => {
  const [profile, setProfile] = useState<Record<string, unknown>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form fields
  const [nurseryName, setNurseryName] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [district, setDistrict] = useState('');
  const [state, setState] = useState('');
  const [pincode, setPincode] = useState('');
  const [registrationNo, setRegistrationNo] = useState('');
  const [licenseNo, setLicenseNo] = useState('');
  const [bankAccount, setBankAccount] = useState('');
  const [ifscCode, setIfscCode] = useState('');
  const [settlementUpi, setSettlementUpi] = useState('');
  const [deliveryRadiusKm, setDeliveryRadiusKm] = useState(50);
  const [specializations, setSpecializations] = useState<string[]>([]);
  const [docUrl, setDocUrl] = useState('');
  const [uploadingDoc, setUploadingDoc] = useState(false);
  const docFileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let mounted = true;
    nursery
      .profile()
      .then((res) => {
        if (!mounted) return;
        const p = (res as Record<string, unknown>) || {};
        setProfile(p);
        setNurseryName(String(p.nurseryName || ''));
        setOwnerName(String(p.ownerName || ''));
        setPhone(String(p.phone || ''));
        setEmail(String(p.email || ''));
        setAddress(String(p.address || ''));
        setDistrict(String(p.district || ''));
        setState(String(p.state || ''));
        setPincode(String(p.pincode || ''));
        setRegistrationNo(String(p.registrationNo || ''));
        setLicenseNo(String(p.licenseNo || ''));
        setBankAccount(String(p.bankAccount || ''));
        setIfscCode(String(p.ifscCode || ''));
        setSettlementUpi(String(p.settlementUpi || ''));
        setDeliveryRadiusKm(Number(p.deliveryRadiusKm || 50));
        setSpecializations(Array.isArray(p.specializations) ? (p.specializations as string[]) : ['fruit', 'timber']);
        if (Array.isArray(p.documentUrls) && p.documentUrls.length > 0) {
          setDocUrl(String(p.documentUrls[0]));
        }
      })
      .catch((err) => {
        if (!mounted) return;
        setError('Failed to load nursery profile');
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, []);

  const toggleSpecialization = (id: string) => {
    setSpecializations((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const handleDocUpload = async (file: File | undefined) => {
    if (!file) return;
    setUploadingDoc(true);
    setError(null);
    try {
      const uploaded = (await uploads.upload(file, { folder: 'nursery', purpose: 'kyc-document' })) as
        | Array<{ url?: string; fileUrl?: string }>
        | { url?: string; fileUrl?: string }
        | undefined;
      const first = Array.isArray(uploaded) ? uploaded[0] : uploaded;
      const url = first?.url ?? first?.fileUrl ?? '';
      if (!url) throw new Error('Upload succeeded but no URL was returned.');
      setDocUrl(url);
    } catch (err: unknown) {
      setError(apiErrorMessage(err));
    } finally {
      setUploadingDoc(false);
      if (docFileRef.current) docFileRef.current.value = '';
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(false);

    try {
      const payload = {
        nurseryName,
        ownerName,
        phone,
        email,
        address,
        district,
        state,
        pincode,
        registrationNo,
        licenseNo,
        bankAccount,
        ifscCode,
        settlementUpi,
        deliveryRadiusKm,
        specializations,
        documentUrls: docUrl ? [docUrl] : [],
      };
      const res = await nursery.updateProfile(payload);
      setProfile((res as Record<string, unknown>) || {});
      setSuccess(true);
      setTimeout(() => setSuccess(false), 4000);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error updating profile';
      setError(msg);
    } finally {
      setSaving(false);
    }
  };

  const isVerified = profile.verified === true || profile.status === 'verified';

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-12">
      {/* Title */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <Building2 className="w-6 h-6 text-emerald-700" />
            Nursery Profile & Shop KYC
          </h1>
          <p className="text-xs text-slate-500">
            Configure your shop credentials, National Horticulture Board (NHB) registration, and bank details.
          </p>
        </div>

        {/* KYC Badge */}
        <div>
          {isVerified ? (
            <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-100 text-emerald-800 text-xs font-bold border border-emerald-300">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>KYC Verified Seller</span>
            </div>
          ) : (
            <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-100 text-amber-800 text-xs font-bold border border-amber-300">
              <AlertCircle className="w-4 h-4 text-amber-600" />
              <span>KYC Pending Admin Review</span>
            </div>
          )}
        </div>
      </div>

      {success && (
        <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs font-bold flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          Nursery business profile and KYC documents updated successfully!
        </div>
      )}

      {error && (
        <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-bold flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-rose-600" />
          {error}
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-6">
        {/* Section 1: Shop Information */}
        <div className="p-6 rounded-3xl bg-white border border-slate-200 shadow-sm space-y-4">
          <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2 border-b border-slate-100 pb-3">
            <Building2 className="w-4 h-4 text-emerald-700" />
            1. Nursery Identity & Contact
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700">Nursery Firm Name *</label>
              <input
                type="text"
                required
                value={nurseryName}
                onChange={(e) => setNurseryName(e.target.value)}
                placeholder="e.g. Kisan Green Agro Nursery"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700">Owner / Proprietor Name *</label>
              <input
                type="text"
                required
                value={ownerName}
                onChange={(e) => setOwnerName(e.target.value)}
                placeholder="e.g. Ramesh Patel"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700">Contact Phone Number *</label>
              <input
                type="tel"
                required
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="9823001122"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700">Business Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="ramesh.nursery@agrovercity.in"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              />
            </div>
          </div>
        </div>

        {/* Section 2: Location & Delivery Area */}
        <div className="p-6 rounded-3xl bg-white border border-slate-200 shadow-sm space-y-4">
          <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2 border-b border-slate-100 pb-3">
            <MapPin className="w-4 h-4 text-emerald-700" />
            2. Nursery Location & Delivery Radius
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-3 space-y-1">
              <label className="text-xs font-bold text-slate-700">Full Nursery Physical Address *</label>
              <input
                type="text"
                required
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Gat 45, Pune-Solapur Highway, Uruli Kanchan"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700">District *</label>
              <input
                type="text"
                required
                value={district}
                onChange={(e) => setDistrict(e.target.value)}
                placeholder="Pune"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700">State *</label>
              <input
                type="text"
                required
                value={state}
                onChange={(e) => setState(e.target.value)}
                placeholder="Maharashtra"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700">Postal PIN Code *</label>
              <input
                type="text"
                required
                value={pincode}
                onChange={(e) => setPincode(e.target.value)}
                placeholder="412202"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              />
            </div>

            <div className="md:col-span-3 space-y-1">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-700">Delivery & Pickup Coverage Radius</label>
                <span className="text-xs font-black text-emerald-800">{deliveryRadiusKm} km</span>
              </div>
              <input
                type="range"
                min="10"
                max="250"
                step="5"
                value={deliveryRadiusKm}
                onChange={(e) => setDeliveryRadiusKm(Number(e.target.value))}
                className="w-full accent-emerald-700 cursor-pointer"
              />
              <p className="text-[11px] text-slate-400">
                Farmers within {deliveryRadiusKm} km can place farmgate delivery or direct pickup orders.
              </p>
            </div>
          </div>
        </div>

        {/* Section 3: Legal Registration & KYC Docs */}
        <div className="p-6 rounded-3xl bg-white border border-slate-200 shadow-sm space-y-4">
          <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2 border-b border-slate-100 pb-3">
            <ShieldCheck className="w-4 h-4 text-emerald-700" />
            3. Regulatory & KYC Compliance
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700">
                NHB / Horticulture Registration No.
              </label>
              <input
                type="text"
                value={registrationNo}
                onChange={(e) => setRegistrationNo(e.target.value)}
                placeholder="NHB/MH/2026/0891"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700">Nursery Trade License No.</label>
              <input
                type="text"
                value={licenseNo}
                onChange={(e) => setLicenseNo(e.target.value)}
                placeholder="LIC-PUN-NUR-44"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              />
            </div>

            <div className="md:col-span-2 space-y-1">
              <label className="text-xs font-bold text-slate-700">
                Registration / 7-12 / Land Doc Proof
              </label>
              <input
                ref={docFileRef}
                type="file"
                accept="image/*,application/pdf"
                className="hidden"
                onChange={(e) => handleDocUpload(e.target.files?.[0])}
              />
              <div className="flex flex-col sm:flex-row gap-2">
                <button
                  type="button"
                  onClick={() => docFileRef.current?.click()}
                  disabled={uploadingDoc}
                  className="inline-flex items-center justify-center gap-2 px-3.5 py-2.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold transition disabled:opacity-50"
                >
                  <Upload className="w-4 h-4" />
                  {uploadingDoc ? 'Uploading…' : docUrl ? 'Replace Document' : 'Upload Document'}
                </button>
                {docUrl && (
                  <a
                    href={docUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="flex-1 inline-flex items-center gap-2 px-3.5 py-2.5 rounded-xl border border-emerald-300 bg-emerald-50 text-emerald-900 text-xs font-bold truncate"
                  >
                    <FileText className="w-4 h-4 text-emerald-700 shrink-0" />
                    <span className="truncate">{docUrl.split('/').pop() || 'View uploaded document'}</span>
                  </a>
                )}
              </div>
              <p className="text-[11px] text-slate-400">
                {docUrl
                  ? 'Document uploaded. Saving the profile persists it with your KYC submission.'
                  : 'Upload your NHB certificate, trade license, or 7-12 land extract (PDF or image).'}
              </p>
            </div>
          </div>
        </div>

        {/* Section 4: Bank & Settlement Payout Info */}
        <div className="p-6 rounded-3xl bg-white border border-slate-200 shadow-sm space-y-4">
          <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2 border-b border-slate-100 pb-3">
            <CreditCard className="w-4 h-4 text-emerald-700" />
            4. Settlement & Bank Payout Details
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700">Bank Account Number</label>
              <input
                type="text"
                value={bankAccount}
                onChange={(e) => setBankAccount(e.target.value)}
                placeholder="50100234567890"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700">Bank IFSC Code</label>
              <input
                type="text"
                value={ifscCode}
                onChange={(e) => setIfscCode(e.target.value)}
                placeholder="HDFC0000123"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700">Settlement UPI ID</label>
              <input
                type="text"
                value={settlementUpi}
                onChange={(e) => setSettlementUpi(e.target.value)}
                placeholder="ramesh.nursery@okhdfcbank"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              />
            </div>
          </div>
        </div>

        {/* Section 5: Plant Specializations */}
        <div className="p-6 rounded-3xl bg-white border border-slate-200 shadow-sm space-y-4">
          <h2 className="text-sm font-bold text-slate-900 border-b border-slate-100 pb-3">
            5. Nursery Specializations
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {SPECIALIZATIONS.map((spec) => {
              const active = specializations.includes(spec.id);
              return (
                <button
                  type="button"
                  key={spec.id}
                  onClick={() => toggleSpecialization(spec.id)}
                  className={`p-3 rounded-2xl border text-left text-xs font-bold transition flex items-center justify-between ${
                    active
                      ? 'bg-emerald-50 border-emerald-400 text-emerald-950 shadow-sm'
                      : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  <span>{spec.label}</span>
                  {active && <CheckCircle2 className="w-4 h-4 text-emerald-700" />}
                </button>
              );
            })}
          </div>
        </div>

        {/* Submit Button */}
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={saving}
            className="px-6 py-3 rounded-2xl bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs shadow-lg transition flex items-center gap-2 disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            {saving ? 'Saving Profile…' : 'Save Nursery Profile & KYC'}
          </button>
        </div>
      </form>
    </div>
  );
};
