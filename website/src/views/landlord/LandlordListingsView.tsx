import React, { useCallback, useEffect, useState } from 'react';
import { Plus, RefreshCw, Pencil, BadgeCheck, ShieldAlert, FileText, Upload } from 'lucide-react';
import { land, uploads, apiErrorMessage, addresses as addressesApi, addressLabel, addressSummary, type SavedAddress } from '../../lib/api';
import { ModalSheet } from '../../components/common/ModalSheet';
import { UserVerificationBadge } from '../../components/common/UserVerificationBadge';
import { formatCurrency } from '../../lib/utils';
import { isKycError } from '../../lib/api/leads';

interface ListingRow {
  id: string;
  village: string;
  taluka?: string;
  district: string;
  state?: string;
  areaAcres: number;
  irrigated?: boolean | null;
  expectedRentRupees: number;
  rentUnit?: string;
  availableFrom?: string | null;
  minDurationMonths?: number | null;
  maxDurationMonths?: number | null;
  waterSource?: string | null;
  soilType?: string | null;
  notes?: string | null;
  photos?: string[];
  status?: string;
  landDocumentsStatus?: string;
  landDocuments?: string[];
  landDocumentsRejectionReason?: string | null;
  surveyNumber?: string | null;
  landlordVerified?: boolean;
  landVerified?: boolean;
}

const EMPTY_FORM = {
  village: '',
  taluka: '',
  district: '',
  state: 'Maharashtra',
  areaAcres: 2,
  irrigated: true,
  expectedRentRupees: 8000,
  rentUnit: 'perAcrePerYear',
  availableFrom: '',
  surveyNumber: '',
  waterSource: '',
  soilType: '',
  minDurationMonths: 0,
  maxDurationMonths: 0,
  permittedCrops: '',
  notes: '',
  photoUrl: '',
  documentUrl: '',
};

const STATUS_ACTIONS: { id: string; label: string; cls: string }[] = [
  { id: 'open', label: 'Reactivate', cls: 'border-emerald-200 text-emerald-700 hover:bg-emerald-50' },
  { id: 'paused', label: 'Pause', cls: 'border-amber-200 text-amber-700 hover:bg-amber-50' },
  { id: 'leased', label: 'Mark Leased', cls: 'border-sky-200 text-sky-700 hover:bg-sky-50' },
  { id: 'withdrawn', label: 'Withdraw', cls: 'border-rose-200 text-rose-600 hover:bg-rose-50' },
];

/** My Land Listings — add/edit farmland, photos, private documents, pricing
 * and availability; pause/reactivate/leased/withdrawn; and the true land
 * verification state (spec §4/§5/§6). */
export const LandlordListingsView: React.FC = () => {
  const [listings, setListings] = useState<ListingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const [formOpen, setFormOpen] = useState(false);  const [editing, setEditing] = useState<ListingRow | null>(null);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [savedAddrs, setSavedAddrs] = useState<SavedAddress[]>([]);
  useEffect(() => {
    addressesApi
      .list()
      .then(setSavedAddrs)
      .catch(() => undefined);
  }, []);
  const [saving, setSaving] = useState(false);
  const [uploadBusy, setUploadBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const rows = (await land.myListings()) as unknown as ListingRow[];
      setListings(rows);
    } catch (e) {
      setError(apiErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const openAdd = () => {
    setEditing(null);
    setForm({ ...EMPTY_FORM });
    setFormOpen(true);
  };

  const openEdit = (l: ListingRow) => {
    setEditing(l);
    setForm({
      village: l.village ?? '',
      taluka: l.taluka ?? '',
      district: l.district ?? '',
      state: l.state ?? 'Maharashtra',
      areaAcres: l.areaAcres ?? 0,
      irrigated: l.irrigated ?? true,
      expectedRentRupees: l.expectedRentRupees ?? 0,
      rentUnit: l.rentUnit ?? 'perAcrePerYear',
      availableFrom: l.availableFrom ?? '',
      surveyNumber: '',
      waterSource: l.waterSource ?? '',
      soilType: l.soilType ?? '',
      minDurationMonths: l.minDurationMonths ?? 0,
      maxDurationMonths: l.maxDurationMonths ?? 0,
      permittedCrops: '',
      notes: l.notes ?? '',
      photoUrl: l.photos?.[0] ?? '',
      documentUrl: '',
    });
    setFormOpen(true);
  };

  const pickFile = async (
    file: File | undefined,
    folder: string,
    purpose: string,
    apply: (url: string) => void,
  ) => {
    if (!file) return;
    setUploadBusy(true);
    try {
      const uploaded = (await uploads.upload(file, { folder, purpose })) as
        | { url?: string; fileUrl?: string }
        | undefined;
      const url = uploaded?.url ?? uploaded?.fileUrl ?? '';
      if (url) apply(url);
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setUploadBusy(false);
    }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const payload = {
        village: form.village.trim(),
        taluka: form.taluka.trim(),
        district: form.district.trim(),
        state: form.state.trim(),
        areaAcres: form.areaAcres,
        irrigated: form.irrigated,
        expectedRentRupees: form.expectedRentRupees,
        rentUnit: form.rentUnit,
        availableFrom: form.availableFrom || undefined,
        surveyNumber: form.surveyNumber.trim() || undefined,
        waterSource: form.waterSource.trim() || undefined,
        soilType: form.soilType.trim() || undefined,
        minDurationMonths: form.minDurationMonths || undefined,
        maxDurationMonths: form.maxDurationMonths || undefined,
        permittedCrops: form.permittedCrops.trim() || undefined,
        notes: form.notes.trim() || undefined,
        photos: form.photoUrl.trim() ? [form.photoUrl.trim()] : [],
        landDocuments: form.documentUrl.trim() ? [form.documentUrl.trim()] : [],
      };
      if (editing) {
        await land.updateListing(editing.id, payload);
        setNotice('Listing updated.');
      } else {
        await land.createListing(payload);
        setNotice('Land listed — it is live once identity KYC and moderation rules pass.');
      }
      setFormOpen(false);
      await load();
    } catch (err) {
      if (isKycError(err)) {
        setError('Complete your identity verification (KYC) to list farmland — see Profile & Verification.');
        setFormOpen(false);
      } else {
        setError(apiErrorMessage(err));
      }
    } finally {
      setSaving(false);
    }
  };

  const submitDocuments = async (l: ListingRow) => {
    if (!form.documentUrl.trim()) {
      setError('Choose a document to submit.');
      return;
    }
    setBusyId(l.id);
    setError(null);
    try {
      await land.submitLandDocuments(l.id, [form.documentUrl.trim()]);
      setNotice('Documents submitted — verification is pending review.');
      setForm((f) => ({ ...f, documentUrl: '' }));
      await load();
    } catch (e) {
      setError(apiErrorMessage(e));
    } finally {
      setBusyId(null);
    }
  };

  const setStatus = async (l: ListingRow, status: string) => {
    setBusyId(l.id);
    setError(null);
    try {
      await land.updateListing(l.id, { status } as unknown as Parameters<typeof land.updateListing>[1]);
      setNotice(
        status === 'leased'
          ? 'Marked leased — new interest is closed; existing connections stay in My Connections.'
          : `Listing ${status}.`,
      );
      await load();
    } catch (e) {
      setError(apiErrorMessage(e));
    } finally {
      setBusyId(null);
    }
  };

  const verificationChip = (l: ListingRow) => {
    if (l.landDocumentsStatus === 'verified' || l.landVerified) {
      return (
        <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full inline-flex items-center gap-1">
          <BadgeCheck className="w-3 h-3" /> Land Docs Verified
        </span>
      );
    }
    if (l.landDocumentsStatus === 'rejected') {
      return (
        <span className="text-[10px] font-bold text-rose-700 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded-full" title={l.landDocumentsRejectionReason ?? ''}>
          Docs Rejected{l.landDocumentsRejectionReason ? `: ${l.landDocumentsRejectionReason}` : ''}
        </span>
      );
    }
    if (l.landDocumentsStatus === 'pending') {
      return (
        <span className="text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full inline-flex items-center gap-1">
          <ShieldAlert className="w-3 h-3" /> Docs Under Review
        </span>
      );
    }
    return (
      <span className="text-[10px] font-bold text-slate-500 bg-slate-50 border border-slate-200 px-2 py-0.5 rounded-full">
        Docs Not Submitted
      </span>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 flex items-center gap-2">
            <BadgeCheck className="w-7 h-7 text-emerald-600" />
            My Land Listings
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            List farmland with rent, availability and photos. "Land Docs Verified" appears only after an actual
            document review — identity KYC or an upload alone never earns it.
          </p>
        </div>
        <div className="flex gap-2 self-start sm:self-auto">
          <button onClick={openAdd} className="px-4 py-2.5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md flex items-center gap-2">
            <Plus className="w-4 h-4" /> Add Land
          </button>
          <button onClick={() => void load()} className="p-2.5 rounded-2xl border border-slate-200 hover:bg-slate-50" title="Refresh">
            <RefreshCw className={`w-4 h-4 text-slate-600 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {error && (
        <div className="flex items-center justify-between p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="font-bold hover:underline">Dismiss</button>
        </div>
      )}
      {notice && (
        <div className="flex items-center justify-between p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold">
          <span>{notice}</span>
          <button onClick={() => setNotice(null)} className="font-bold hover:underline">Dismiss</button>
        </div>
      )}

      {loading ? (
        <div className="py-10 text-center text-xs font-bold text-slate-400 animate-pulse">Loading your land…</div>
      ) : listings.length === 0 ? (
        <div className="p-12 text-center text-slate-500 bg-white rounded-3xl border border-slate-200 space-y-2">
          <BadgeCheck className="w-10 h-10 text-slate-300 mx-auto" />
          <p className="text-sm font-bold">No land listed yet</p>
          <p className="text-xs text-slate-400">Add your first plot to start receiving farmer interest.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {listings.map((l) => (
            <div key={l.id} className={`bg-white rounded-3xl p-5 border shadow-xs ${l.status !== 'open' ? 'border-slate-200 opacity-80' : 'border-slate-200/80'}`}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <UserVerificationBadge verified={l.landlordVerified} label="Verified Landlord" />
                    {verificationChip(l)}
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full border capitalize border-slate-200 bg-slate-50 text-slate-600">
                      {l.status ?? 'open'}
                    </span>
                  </div>
                  <h3 className="font-extrabold text-base text-slate-900 mt-1">
                    {l.areaAcres} acres · {l.village}
                  </h3>
                  <p className="text-xs text-slate-500">
                    {[l.taluka, l.district, l.state].filter(Boolean).join(', ')}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <span className="text-lg font-black text-emerald-700">{formatCurrency(l.expectedRentRupees)}</span>
                  <span className="text-[10px] text-slate-400 block">
                    {l.rentUnit === 'totalPerYear' ? '/year total' : '/acre/year'}
                  </span>
                </div>
              </div>

              <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs bg-slate-50 p-3 rounded-2xl border border-slate-100">
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase block">Water</span>
                  <span className="font-extrabold text-slate-800">{l.irrigated === false ? 'Rainfed' : 'Irrigated'}</span>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase block">Available From</span>
                  <span className="font-extrabold text-slate-800">{l.availableFrom || 'Immediate'}</span>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase block">Duration</span>
                  <span className="font-extrabold text-slate-800">
                    {l.minDurationMonths || l.maxDurationMonths ? `${l.minDurationMonths ?? '…'}–${l.maxDurationMonths ?? '…'} mo` : 'Flexible'}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase block">Documents</span>
                  <span className="font-bold text-slate-600">{l.landDocuments?.length ?? 0} private file(s)</span>
                </div>
              </div>

              {/* Verification panel — private document submission */}
              <div className="mt-3 p-3 rounded-2xl border border-slate-200 bg-slate-50/60 space-y-2">
                <p className="text-[10px] font-black uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                  <FileText className="w-3 h-3" /> Land Verification (private)
                </p>
                <div className="flex flex-wrap items-center gap-2">
                  <input
                    type="file"
                    accept="application/pdf,image/*"
                    className="hidden"
                    id={`doc-input-${l.id}`}
                    onChange={(e) =>
                      void pickFile(e.target.files?.[0], 'land-docs', 'land-document', (url) =>
                        setForm((f) => ({ ...f, documentUrl: url })),
                      )
                    }
                  />
                  <label
                    htmlFor={`doc-input-${l.id}`}
                    className="px-3 py-1.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 font-bold text-[10px] cursor-pointer flex items-center gap-1"
                  >
                    <Upload className="w-3 h-3" />
                    {uploadBusy ? 'Uploading…' : form.documentUrl ? 'Picked — submit below' : 'Choose 7/12 or ownership doc'}
                  </label>
                  {form.documentUrl && (
                    <button
                      onClick={() => void submitDocuments(l)}
                      disabled={busyId === l.id}
                      className="px-3 py-1.5 rounded-xl bg-emerald-600 text-white font-bold text-[10px] disabled:opacity-50"
                    >
                      Submit for Review
                    </button>
                  )}
                  <span className="text-[9px] text-slate-400">Visible only to you and verification personnel.</span>
                </div>
              </div>

              <div className="mt-3 flex items-center justify-between gap-2 flex-wrap">
                <div className="flex gap-1.5 flex-wrap">
                  {STATUS_ACTIONS.filter((a) => a.id !== l.status).map((a) => (
                    <button
                      key={a.id}
                      onClick={() => void setStatus(l, a.id)}
                      disabled={busyId === l.id}
                      className={`px-2.5 py-1.5 rounded-lg border text-[10px] font-bold disabled:opacity-50 ${a.cls}`}
                    >
                      {a.label}
                    </button>
                  ))}
                </div>
                <button onClick={() => openEdit(l)} className="p-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-500" title="Edit listing">
                  <Pencil className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add / edit form — a basic listing needs no complicated land-record form */}
      <ModalSheet
        isOpen={formOpen}
        onClose={() => setFormOpen(false)}
        title={editing ? 'Edit Listing' : 'Add Land'}
        description="Required: village, district, area, water type, expected rent and availability."
        maxWidth="md"
      >
        <form onSubmit={(e) => void submit(e)} className="space-y-4">
          {savedAddrs.length > 0 && (
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Fill from saved address</label>
              <select
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 bg-white"
                value=""
                onChange={(e) => {
                  const a = savedAddrs.find((x) => x.id === e.target.value);
                  if (!a) return;
                  setForm((f) => ({ ...f, village: a.village || f.village, district: a.district || f.district, state: a.state || f.state }));
                }}
              >
                <option value="">Select a saved address…</option>
                {savedAddrs.map((a) => (
                  <option key={a.id} value={a.id}>
                    {addressLabel(a)} — {addressSummary(a)}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Village *</label>
              <input className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300" value={form.village} onChange={(e) => setForm({ ...form, village: e.target.value })} required />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">District *</label>
              <input className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300" value={form.district} onChange={(e) => setForm({ ...form, district: e.target.value })} required />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Taluka</label>
              <input className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300" value={form.taluka} onChange={(e) => setForm({ ...form, taluka: e.target.value })} />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">State</label>
              <input className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300" value={form.state} onChange={(e) => setForm({ ...form, state: e.target.value })} />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Area (acres) *</label>
              <input type="number" min={0.1} step={0.1} className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 font-bold" value={form.areaAcres} onChange={(e) => setForm({ ...form, areaAcres: Number(e.target.value) })} required />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Water Type *</label>
              <select className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 bg-white" value={String(form.irrigated)} onChange={(e) => setForm({ ...form, irrigated: e.target.value === 'true' })}>
                <option value="true">Irrigated</option>
                <option value="false">Rainfed</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Expected Rent (₹) *</label>
              <input type="number" min={1} className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 font-bold" value={form.expectedRentRupees} onChange={(e) => setForm({ ...form, expectedRentRupees: Number(e.target.value) })} required />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Rent Unit *</label>
              <select className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 bg-white" value={form.rentUnit} onChange={(e) => setForm({ ...form, rentUnit: e.target.value })}>
                <option value="perAcrePerYear">Per acre / year</option>
                <option value="totalPerYear">Total / year</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Available From *</label>
              <input type="date" className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300" value={form.availableFrom} onChange={(e) => setForm({ ...form, availableFrom: e.target.value })} required />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Survey/Gat No. (private)</label>
              <input className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300" value={form.surveyNumber} onChange={(e) => setForm({ ...form, surveyNumber: e.target.value })} placeholder="Never shown publicly" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Water Source</label>
              <input className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300" value={form.waterSource} onChange={(e) => setForm({ ...form, waterSource: e.target.value })} />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Soil</label>
              <input className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300" value={form.soilType} onChange={(e) => setForm({ ...form, soilType: e.target.value })} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Min Duration (months)</label>
              <input type="number" min={0} className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300" value={form.minDurationMonths} onChange={(e) => setForm({ ...form, minDurationMonths: Number(e.target.value) })} />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Max Duration (months)</label>
              <input type="number" min={0} className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300" value={form.maxDurationMonths} onChange={(e) => setForm({ ...form, maxDurationMonths: Number(e.target.value) })} />
            </div>
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Permitted Crops / Restrictions</label>
            <input className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300" value={form.permittedCrops} onChange={(e) => setForm({ ...form, permittedCrops: e.target.value })} />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Photo</label>
            <div className="flex items-center gap-3">
              <input type="file" accept="image/*" className="hidden" id="land-photo-input" onChange={(e) => void pickFile(e.target.files?.[0], 'land', 'land-photo', (url) => setForm((f) => ({ ...f, photoUrl: url })))} />
              <label htmlFor="land-photo-input" className="px-3 py-2 rounded-xl border border-slate-300 hover:bg-slate-50 text-slate-700 font-bold text-xs cursor-pointer">
                {uploadBusy ? 'Uploading…' : form.photoUrl ? 'Change Photo' : 'Upload Photo'}
              </label>
              {form.photoUrl && <img src={form.photoUrl} alt="Land" className="h-12 w-12 rounded-xl object-cover border border-slate-200" />}
            </div>
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Private Document (7/12, ownership)</label>
            <div className="flex items-center gap-3">
              <input type="file" accept="application/pdf,image/*" className="hidden" id="land-doc-input" onChange={(e) => void pickFile(e.target.files?.[0], 'land-docs', 'land-document', (url) => setForm((f) => ({ ...f, documentUrl: url })))} />
              <label htmlFor="land-doc-input" className="px-3 py-2 rounded-xl border border-slate-300 hover:bg-slate-50 text-slate-700 font-bold text-xs cursor-pointer">
                {form.documentUrl ? 'Picked — submit with listing' : 'Upload Document'}
              </label>
              <span className="text-[9px] text-slate-400">Submitted for review; never public.</span>
            </div>
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Notes</label>
            <textarea rows={2} className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </div>
          <button type="submit" disabled={saving} className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md disabled:opacity-50">
            {saving ? 'Saving…' : editing ? 'Save Changes' : 'List Land'}
          </button>
        </form>
      </ModalSheet>
    </div>
  );
};
