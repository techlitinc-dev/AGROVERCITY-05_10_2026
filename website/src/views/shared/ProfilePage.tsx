import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  UserRound,
  ShieldCheck,
  Star,
  Bookmark,
  FileCheck2,
  AlertCircle,
  CheckCircle2,
  ChevronRight,
  MapPin,
  Gauge,
  Plus,
  Pencil,
  Trash2,
  Loader2,
  Save,
  Lock,
  Eye,
} from 'lucide-react';
import {
  addresses as addressesApi,
  addressLabel,
  addressSummary,
  apiErrorMessage,
  kyc,
  ratings,
  users,
  type SavedAddress,
} from '../../lib/api';
import { useAuthStore } from '../../stores/authStore';
import { cn, formatDateTime, formatNumber } from '../../lib/utils';
import { asRecord, asRecords, pickNum, pickStr, str } from './records';
import { AddressPicker } from '../../components/common/AddressPicker';
import { ModalSheet } from '../../components/common/ModalSheet';
import { computeProfileCompletion } from '../../lib/profileCompletion';
import type { UserProfile } from '../../types';

const SOIL_TYPES = ['Black Cotton', 'Red', 'Alluvial', 'Laterite', 'Sandy Loam', 'Clay'];
const IRRIGATION_TYPES = ['Drip', 'Sprinkler', 'Flood', 'Borewell', 'Canal', 'Rainfed'];

const inputCls =
  'w-full px-3 py-2.5 text-xs rounded-xl border border-slate-300 focus:outline-none focus:border-emerald-600';

const Field: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div>
    <label className="block text-xs font-bold text-slate-700 mb-1">{label}</label>
    {children}
  </div>
);

/** Editable profile details — everything except the registered full name. */
interface DetailForm {
  email: string;
  dateOfBirth: string;
  gender: string;
  whatsapp: string;
  addressLine: string;
  village: string;
  tehsil: string;
  district: string;
  state: string;
  pincode: string;
  landAreaAcres: string;
  soilType: string;
  irrigationType: string;
}

const EMPTY_DETAILS: DetailForm = {
  email: '',
  dateOfBirth: '',
  gender: '',
  whatsapp: '',
  addressLine: '',
  village: '',
  tehsil: '',
  district: '',
  state: '',
  pincode: '',
  landAreaAcres: '',
  soilType: '',
  irrigationType: '',
};

const detailFormFrom = (me: Record<string, unknown>): DetailForm => ({
  email: pickStr(me, 'email'),
  dateOfBirth: pickStr(me, 'dateOfBirth'),
  gender: pickStr(me, 'gender'),
  whatsapp: pickStr(me, 'whatsapp'),
  addressLine: pickStr(me, 'addressLine'),
  village: pickStr(me, 'village'),
  tehsil: pickStr(me, 'tehsil'),
  district: pickStr(me, 'district'),
  state: pickStr(me, 'state'),
  pincode: pickStr(me, 'pincode'),
  landAreaAcres: (() => {
    const v = me['landAreaAcres'];
    return typeof v === 'number' && Number.isFinite(v) ? String(v) : '';
  })(),
  soilType: pickStr(me, 'soilType'),
  irrigationType: pickStr(me, 'irrigationType'),
});

const KYC_BADGE: Record<string, string> = {
  verified: 'bg-emerald-50 border-emerald-200 text-emerald-700',
  approved: 'bg-emerald-50 border-emerald-200 text-emerald-700',
  submitted: 'bg-amber-50 border-amber-200 text-amber-700',
  pending: 'bg-amber-50 border-amber-200 text-amber-700',
  in_review: 'bg-amber-50 border-amber-200 text-amber-700',
  under_review: 'bg-amber-50 border-amber-200 text-amber-700',
  rejected: 'bg-rose-50 border-rose-200 text-rose-700',
};

const StarRow: React.FC<{ rating: number }> = ({ rating }) => (
  <span className="inline-flex items-center gap-0.5">
    {[1, 2, 3, 4, 5].map((i) => (
      <Star
        key={i}
        className={cn('w-3.5 h-3.5', i <= Math.round(rating) ? 'text-amber-400 fill-amber-400' : 'text-slate-200')}
      />
    ))}
  </span>
);

export const ProfilePage: React.FC = () => {
  const [me, setMe] = useState<Record<string, unknown> | null>(null);
  const [photoUrl, setPhotoUrl] = useState('');
  const [notice, setNotice] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);
  const [kycCases, setKycCases] = useState<Record<string, unknown>[] | null>(null);
  const [ratingMine, setRatingMine] = useState<Record<string, unknown> | null>(null);
  const [savedCount, setSavedCount] = useState<number | null>(null);

  // Saved addresses (account-level Zomato-style address book).
  const [addrRows, setAddrRows] = useState<SavedAddress[]>([]);
  const [addrLoading, setAddrLoading] = useState(true);
  const [addrPickerOpen, setAddrPickerOpen] = useState(false);
  const [addrEditing, setAddrEditing] = useState<SavedAddress | null>(null);
  const [addrBusyId, setAddrBusyId] = useState<string | null>(null);
  const [form, setForm] = useState<DetailForm>(EMPTY_DETAILS);
  const [busy, setBusy] = useState(false);
  const [viewOpen, setViewOpen] = useState(false);

  useEffect(() => {
    users
      .getMe()
      .then((u) => {
        const rec = asRecord(u);
        setMe(rec);
        setForm(detailFormFrom(rec));
        setPhotoUrl(pickStr(rec, 'photoUrl'));
      })
      .catch(() => setMe({}));
    kyc
      .status()
      .then((s) => setKycCases(asRecords(s)))
      .catch(() => setKycCases([]));
    ratings
      .mine()
      .then((r) => setRatingMine(asRecord(r)))
      .catch(() => setRatingMine({}));
    users
      .savedItems()
      .then((s) => setSavedCount(asRecords(s).length))
      .catch(() => setSavedCount(null));
  }, []);

  const flash = (kind: 'ok' | 'err', text: string) => {
    setNotice({ kind, text });
    window.setTimeout(() => setNotice(null), 5000);
  };

  const setField = (key: keyof DetailForm) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  // Full name is registered data — everything else here is editable.
  const saveProfile = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const updated = asRecord(
        await users.updateMe({
          email: form.email.trim() || undefined,
          dateOfBirth: form.dateOfBirth || undefined,
          gender: form.gender || undefined,
          whatsapp: form.whatsapp.trim() || undefined,
          addressLine: form.addressLine.trim() || undefined,
          village: form.village.trim() || undefined,
          tehsil: form.tehsil.trim() || undefined,
          district: form.district.trim() || undefined,
          state: form.state.trim() || undefined,
          pincode: form.pincode.trim() || undefined,
          landAreaAcres: form.landAreaAcres ? Number(form.landAreaAcres) : undefined,
          soilType: form.soilType || undefined,
          irrigationType: form.irrigationType || undefined,
        } as Partial<UserProfile>)
      );
      setMe(updated);
      setForm(detailFormFrom(updated));
      flash('ok', 'Profile updated.');
    } catch (err) {
      flash('err', apiErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  // --- Saved addresses handlers (shared AddressPicker does add/edit) ---
  useEffect(() => {
    addressesApi
      .list()
      .then(setAddrRows)
      .catch(() => undefined)
      .finally(() => setAddrLoading(false));
  }, []);

  const handleAddressSaved = (saved: SavedAddress) => {
    setAddrRows((prev) => {
      const exists = prev.some((r) => r.id === saved.id);
      const next = exists ? prev.map((r) => (r.id === saved.id ? saved : r)) : [...prev, saved];
      // Mirror the backend default-clearing so the list stays consistent.
      if (saved.isDefault) return next.map((r) => ({ ...r, isDefault: r.id === saved.id }));
      return next;
    });
    setAddrEditing(null);
  };

  const handleAddressDelete = async (a: SavedAddress) => {
    if (!window.confirm(`Delete "${addressLabel(a)}" address?`)) return;
    setAddrBusyId(a.id);
    try {
      await addressesApi.remove(a.id);
      setAddrRows((prev) => prev.filter((r) => r.id !== a.id));
      flash('ok', 'Address deleted.');
    } catch (err) {
      flash('err', apiErrorMessage(err));
    } finally {
      setAddrBusyId(null);
    }
  };

  const handleAddressDefault = async (a: SavedAddress) => {
    if (a.isDefault) return;
    setAddrBusyId(a.id);
    try {
      await addressesApi.update(a.id, { ...a, isDefault: true });
      setAddrRows((prev) => prev.map((r) => ({ ...r, isDefault: r.id === a.id })));
      flash('ok', `"${addressLabel(a)}" is now your default address.`);
    } catch (err) {
      flash('err', apiErrorMessage(err));
    } finally {
      setAddrBusyId(null);
    }
  };

  const name = pickStr(me ?? {}, 'name') || 'Member';
  const vernacularName = pickStr(me ?? {}, 'vernacularName');
  const initials = name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w.charAt(0).toUpperCase())
    .join('');
  const linkedProfiles = (Array.isArray(me?.['linkedProfiles']) ? (me!['linkedProfiles'] as unknown[]) : [])
    .map((p) => str(p))
    .filter(Boolean);
  const activeProfile = pickStr(me ?? {}, 'activeProfile');

  // View Profile — the details captured at login/registration (read-only).
  const registrationRows: { label: string; value: string }[] = [
    { label: 'Full name', value: pickStr(me ?? {}, 'name') },
    { label: 'Phone', value: pickStr(me ?? {}, 'phone').replace(/^\+91/, '+91 ') },
    { label: 'Registered personas', value: linkedProfiles.join(', ') },
    { label: 'Active persona', value: activeProfile },
    { label: 'Email', value: pickStr(me ?? {}, 'email') },
    { label: 'Member since', value: formatDateTime(pickStr(me ?? {}, 'createdAt')) },
    { label: 'KYC status', value: pickStr(me ?? {}, 'kycStatus') },
  ];

  const average = ratingMine ? pickNum(ratingMine, 'average') : 0;
  const reviewCount = ratingMine ? pickNum(ratingMine, 'count') : 0;
  const trustTier = ratingMine ? pickStr(ratingMine, 'trustTier') : '';

  // Profile completion — shared math with the dashboard nudge.
  const completion = computeProfileCompletion(me);

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="border-b border-slate-200 pb-4">
        <h1 className="text-2xl font-extrabold text-slate-900 flex items-center gap-2">
          <UserRound className="w-7 h-7 text-emerald-600" />
          My Profile
        </h1>
        <p className="text-xs text-slate-500 mt-1">
          Your identity across every persona, KYC standing, and reputation
        </p>
      </div>

      {notice && (
        <div
          className={cn(
            'rounded-2xl border p-3 text-xs flex items-start gap-2',
            notice.kind === 'ok'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-rose-50 border-rose-200 text-rose-800'
          )}
        >
          {notice.kind === 'ok' ? (
            <CheckCircle2 className="w-4 h-4 flex-shrink-0 mt-0.5" />
          ) : (
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          )}
          <span>{notice.text}</span>
        </div>
      )}

      {/* Header card */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-4 min-w-0">
            <div className="relative flex-shrink-0">
              {photoUrl ? (
                <img src={photoUrl} alt={name} className="w-16 h-16 rounded-2xl object-cover border border-slate-200" />
              ) : (
                <div className="w-16 h-16 rounded-2xl bg-emerald-700 text-white font-black text-lg flex items-center justify-center">
                  {initials || 'M'}
                </div>
              )}
            </div>
            <div className="min-w-0">
              <p className="text-lg font-extrabold text-slate-900 truncate">
                {name}
                {vernacularName.trim() && (
                  <span className="text-sm font-bold text-slate-400 ml-2">{vernacularName.trim()}</span>
                )}
              </p>
              <p className="text-xs text-slate-500 font-mono">+91 {pickStr(me ?? {}, 'phone').replace(/^\+91/, '')}</p>
              {linkedProfiles.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {linkedProfiles.map((p) => (
                    <span
                      key={p}
                      className={cn(
                        'px-2 py-0.5 rounded-full text-[10px] font-bold border',
                        p === activeProfile
                          ? 'bg-emerald-600 border-emerald-600 text-white'
                          : 'bg-slate-50 border-slate-200 text-slate-600'
                      )}
                    >
                      {p.charAt(0).toUpperCase() + p.slice(1)}
                    </span>
                  ))}
                </div>
              )}
              <p className="text-[11px] text-slate-400 mt-2">
                Member since {formatDateTime(pickStr(me ?? {}, 'createdAt')) || '—'}
              </p>
            </div>
          </div>
          <button
            onClick={() => setViewOpen(true)}
            className="flex-shrink-0 px-3 py-2 rounded-xl border border-slate-200 text-slate-600 hover:border-emerald-300 hover:text-emerald-700 text-[11px] font-bold flex items-center gap-1.5 transition-colors"
          >
            <Eye className="w-3.5 h-3.5" /> View Profile
          </button>
        </div>
      </div>

      {/* Profile completion — shown here once complete (the dashboard nudges while incomplete). */}
      {completion && completion.pct >= 100 && (
        <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-sm text-slate-900 flex items-center gap-1.5">
              <Gauge className="w-4 h-4 text-emerald-600" /> Profile Completion
            </h3>
            <span className="text-sm font-black text-slate-900">{completion.pct}%</span>
          </div>
          <div className="w-full h-3 rounded-full bg-slate-100 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${completion.color}`}
              style={{ width: `${completion.pct}%` }}
            />
          </div>
          <p className="text-[11px] text-slate-400">
            {completion.filled} of {completion.total} completed — your profile is complete!
          </p>
        </div>
      )}

      {/* Profile details — everything editable except the registered full name */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs p-5 space-y-4">
        <h3 className="font-bold text-sm text-slate-900 flex items-center gap-1.5">
          <UserRound className="w-4 h-4 text-emerald-600" /> Profile Details
        </h3>
        {me === null ? (
          <p className="text-xs text-slate-400">Loading your profile…</p>
        ) : (
          <>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Full name</p>
              <p className="text-xs font-semibold text-slate-800 mt-0.5 flex items-center gap-1.5">
                {pickStr(me, 'name') || '—'}
                <Lock className="w-3 h-3 text-slate-400" />
              </p>
              <p className="text-[10px] text-slate-400 mt-0.5">
                Set at registration — contact support to change.
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="Email">
                <input type="email" value={form.email} onChange={setField('email')} className={inputCls} />
              </Field>
              <Field label="Date of birth">
                <input type="date" value={form.dateOfBirth} onChange={setField('dateOfBirth')} className={inputCls} />
              </Field>
              <Field label="Gender">
                <select value={form.gender} onChange={setField('gender')} className={inputCls}>
                  <option value="">Select…</option>
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                  <option value="other">Other</option>
                </select>
              </Field>
              <Field label="WhatsApp number (10-digit)">
                <input
                  type="tel"
                  value={form.whatsapp}
                  onChange={(e) => setForm((f) => ({ ...f, whatsapp: e.target.value.replace(/\D/g, '').slice(0, 10) }))}
                  className={inputCls}
                  placeholder="Buyers reach you here"
                />
              </Field>
              <Field label="Address line">
                <input type="text" value={form.addressLine} onChange={setField('addressLine')} className={inputCls} />
              </Field>
              <Field label="Village">
                <input type="text" value={form.village} onChange={setField('village')} className={inputCls} />
              </Field>
              <Field label="Tehsil">
                <input type="text" value={form.tehsil} onChange={setField('tehsil')} className={inputCls} />
              </Field>
              <Field label="District">
                <input type="text" value={form.district} onChange={setField('district')} className={inputCls} />
              </Field>
              <Field label="State">
                <input type="text" value={form.state} onChange={setField('state')} className={inputCls} />
              </Field>
              <Field label="PIN code">
                <input
                  type="text"
                  value={form.pincode}
                  onChange={(e) => setForm((f) => ({ ...f, pincode: e.target.value.replace(/\D/g, '').slice(0, 6) }))}
                  className={inputCls}
                />
              </Field>
              <Field label="Land area (acres)">
                <input
                  type="number"
                  min={0}
                  step={0.1}
                  value={form.landAreaAcres}
                  onChange={setField('landAreaAcres')}
                  className={inputCls}
                />
              </Field>
              <Field label="Soil type">
                <select value={form.soilType} onChange={setField('soilType')} className={inputCls}>
                  <option value="">Select…</option>
                  {[...new Set([...SOIL_TYPES, form.soilType].filter(Boolean))].map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Irrigation type">
                <select value={form.irrigationType} onChange={setField('irrigationType')} className={inputCls}>
                  <option value="">Select…</option>
                  {[...new Set([...IRRIGATION_TYPES, form.irrigationType].filter(Boolean))].map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
            <button
              onClick={() => void saveProfile()}
              disabled={busy}
              className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white font-bold text-xs rounded-xl shadow-xs flex items-center gap-1.5"
            >
              <Save className="w-3.5 h-3.5" /> {busy ? 'Saving…' : 'Save Profile'}
            </button>
          </>
        )}
      </div>

      {/* Saved addresses — the account-level Zomato-style address book */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-sm text-slate-900 flex items-center gap-1.5">
            <MapPin className="w-4 h-4 text-emerald-600" /> Saved Addresses
          </h3>
          <button
            onClick={() => {
              setAddrEditing(null);
              setAddrPickerOpen(true);
            }}
            className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold flex items-center gap-1"
          >
            <Plus className="w-3.5 h-3.5" /> Add new
          </button>
        </div>

        {addrLoading ? (
          <p className="text-xs text-slate-400">Loading addresses…</p>
        ) : addrRows.length === 0 ? (
          <p className="text-xs text-slate-400">
            No saved addresses yet — add your Home, Farm or Warehouse address once and reuse it
            across checkout, transport, land and equipment bookings.
          </p>
        ) : (
          <ul className="space-y-2.5">
            {addrRows.map((a) => (
              <li
                key={a.id}
                className="rounded-2xl border border-slate-200 p-3.5 flex items-start gap-3"
              >
                <MapPin className="w-4 h-4 text-emerald-600 mt-0.5 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-[10px] font-bold border border-emerald-200">
                      {addressLabel(a)}
                    </span>
                    {!!a.isDefault && (
                      <span className="px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 text-[10px] font-bold border border-amber-200 flex items-center gap-1">
                        <Star className="w-3 h-3 fill-amber-500 text-amber-500" /> Default
                      </span>
                    )}
                  </div>
                  <p className="text-xs font-semibold text-slate-800 mt-1 truncate">
                    {addressSummary(a)}
                  </p>
                  {!a.isDefault && (
                    <button
                      onClick={() => void handleAddressDefault(a)}
                      disabled={addrBusyId === a.id}
                      className="mt-1.5 text-[11px] font-bold text-emerald-700 hover:underline disabled:opacity-50"
                    >
                      Set as default
                    </button>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => {
                      setAddrEditing(a);
                      setAddrPickerOpen(true);
                    }}
                    className="p-1.5 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-700"
                    title="Edit"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => void handleAddressDelete(a)}
                    disabled={addrBusyId === a.id}
                    className="p-1.5 rounded-full hover:bg-rose-50 text-slate-400 hover:text-rose-600 disabled:opacity-50"
                    title="Delete"
                  >
                    {addrBusyId === a.id ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Trash2 className="w-3.5 h-3.5" />
                    )}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <AddressPicker
        isOpen={addrPickerOpen}
        onClose={() => {
          setAddrPickerOpen(false);
          setAddrEditing(null);
        }}
        onSaved={handleAddressSaved}
        initial={addrEditing}
      />

      {/* View Profile — read-only registration/login details */}
      <ModalSheet
        isOpen={viewOpen}
        onClose={() => setViewOpen(false)}
        title="Registration Details"
        description="The details used when you registered and signed in — view only"
        maxWidth="sm"
      >
        <dl className="space-y-3">
          {registrationRows.map((row) => (
            <div key={row.label} className="flex items-start justify-between gap-3">
              <dt className="text-[10px] font-bold uppercase tracking-wider text-slate-400 pt-0.5">{row.label}</dt>
              <dd className="text-xs font-semibold text-slate-800 text-right break-words capitalize">
                {row.value.trim() || '—'}
              </dd>
            </div>
          ))}
        </dl>
        <button
          onClick={() => setViewOpen(false)}
          className="w-full mt-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 text-xs font-bold hover:bg-slate-50"
        >
          Close
        </button>
      </ModalSheet>

      {/* KYC status */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs p-5 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-sm text-slate-900 flex items-center gap-1.5">
            <FileCheck2 className="w-4 h-4 text-emerald-600" /> KYC Status
          </h3>
          <Link to="/kyc" className="text-[11px] font-bold text-emerald-700 flex items-center gap-0.5">
            Manage <ChevronRight className="w-3.5 h-3.5" />
          </Link>
        </div>
        {kycCases === null ? (
          <p className="text-xs text-slate-400">Loading KYC status…</p>
        ) : kycCases.length === 0 ? (
          <p className="text-xs text-slate-400">
            No KYC cases yet — verification unlocks payments, credit and trade limits.
          </p>
        ) : (
          <div className="space-y-2">
            {kycCases.map((c, i) => {
              const status = (pickStr(c, 'status') || 'pending').toLowerCase();
              const persona = pickStr(c, 'persona', 'profileType') || 'general';
              return (
                <div
                  key={pickStr(c, 'caseId', 'id') || i}
                  className="flex items-center justify-between gap-2 p-2.5 rounded-xl bg-slate-50 border border-slate-100 text-xs"
                >
                  <p className="font-bold text-slate-800 capitalize">{persona}</p>
                  <span className={cn('px-2 py-0.5 rounded-full border text-[10px] font-bold capitalize', KYC_BADGE[status] ?? 'bg-slate-100 border-slate-200 text-slate-600')}>
                    {status.replace(/_/g, ' ')}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Ratings summary */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs p-5 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-sm text-slate-900 flex items-center gap-1.5">
            <Star className="w-4 h-4 text-amber-500" /> Ratings
          </h3>
          <Link to="/ratings" className="text-[11px] font-bold text-emerald-700 flex items-center gap-0.5">
            All reviews <ChevronRight className="w-3.5 h-3.5" />
          </Link>
        </div>
        {ratingMine === null ? (
          <p className="text-xs text-slate-400">Loading ratings…</p>
        ) : reviewCount === 0 ? (
          <p className="text-xs text-slate-400">
            No ratings yet — completed orders, deliveries and consultations earn star ratings from other members.
          </p>
        ) : (
          <div className="flex flex-wrap items-center gap-4 p-3 rounded-2xl bg-slate-50 border border-slate-100">
            <div>
              <p className="text-2xl font-black text-slate-900">
                {average.toFixed(1)}
                <span className="text-sm font-bold text-slate-400">/5</span>
              </p>
              <StarRow rating={average} />
            </div>
            <div className="text-xs text-slate-500">
              <p className="font-bold text-slate-800">{formatNumber(reviewCount)} reviews</p>
              {trustTier && (
                <p className="flex items-center gap-1 text-emerald-700 font-bold mt-0.5">
                  <ShieldCheck className="w-3.5 h-3.5" /> {trustTier} tier
                </p>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Saved items shortcut */}
      <Link
        to="/saved"
        className="bg-white rounded-3xl border border-slate-200/80 shadow-xs p-5 flex items-center justify-between gap-3 hover:border-emerald-300 transition-colors"
      >
        <div className="flex items-center gap-3">
          <Bookmark className="w-4 h-4 text-emerald-600" />
          <div>
            <p className="font-bold text-sm text-slate-900">Saved Items</p>
            <p className="text-[11px] text-slate-400">
              {savedCount === null ? 'Mandi rates, trees, articles and ads you bookmarked' : `${formatNumber(savedCount)} saved items`}
            </p>
          </div>
        </div>
        <ChevronRight className="w-4 h-4 text-slate-400" />
      </Link>

      {/* Address book shortcut */}
      <Link
        to="/profile/addresses"
        className="bg-white rounded-3xl border border-slate-200/80 shadow-xs p-5 flex items-center justify-between gap-3 hover:border-emerald-300 transition-colors"
      >
        <div className="flex items-center gap-3">
          <MapPin className="w-4 h-4 text-emerald-600" />
          <div>
            <p className="font-bold text-sm text-slate-900">My Addresses</p>
            <p className="text-[11px] text-slate-400">
              Home, Farm, Warehouse and more — reused across every role
            </p>
          </div>
        </div>
        <ChevronRight className="w-4 h-4 text-slate-400" />
      </Link>
    </div>
  );
};
