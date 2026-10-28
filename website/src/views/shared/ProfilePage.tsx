import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  UserRound,
  Camera,
  Save,
  ShieldCheck,
  Star,
  Bookmark,
  FileCheck2,
  AlertCircle,
  CheckCircle2,
  ChevronRight,
  EyeOff,
} from 'lucide-react';
import { apiErrorMessage, kyc, ratings, uploads, users } from '../../lib/api';
import type { PersonaType, UserProfile } from '../../types';
import { useAuthStore, normalizeUserProfile } from '../../stores/authStore';
import { ALL_PERSONAS, isPersonaEnabled, normalizePersona } from '../../lib/personas';
import { cn, formatDateTime, formatNumber } from '../../lib/utils';
import { asRecord, asRecords, pick, pickNum, pickStr, str } from './records';

const SOIL_TYPES = ['Black Cotton', 'Red', 'Alluvial', 'Laterite', 'Sandy Loam', 'Clay'];
const IRRIGATION_TYPES = ['Drip', 'Sprinkler', 'Flood', 'Borewell', 'Canal', 'Rainfed'];

const KYC_BADGE: Record<string, string> = {
  verified: 'bg-emerald-50 border-emerald-200 text-emerald-700',
  approved: 'bg-emerald-50 border-emerald-200 text-emerald-700',
  submitted: 'bg-amber-50 border-amber-200 text-amber-700',
  pending: 'bg-amber-50 border-amber-200 text-amber-700',
  in_review: 'bg-amber-50 border-amber-200 text-amber-700',
  under_review: 'bg-amber-50 border-amber-200 text-amber-700',
  rejected: 'bg-rose-50 border-rose-200 text-rose-700',
};

interface ProfileForm {
  name: string;
  vernacularName: string;
  email: string;
  dateOfBirth: string;
  gender: string;
  alternatePhone: string;
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
  activeCrops: string;
}

const EMPTY_FORM: ProfileForm = {
  name: '',
  vernacularName: '',
  email: '',
  dateOfBirth: '',
  gender: '',
  alternatePhone: '',
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
  activeCrops: '',
};

const formFromUser = (me: Record<string, unknown>): ProfileForm => ({
  name: pickStr(me, 'name'),
  vernacularName: pickStr(me, 'vernacularName'),
  email: pickStr(me, 'email'),
  dateOfBirth: pickStr(me, 'dateOfBirth'),
  gender: pickStr(me, 'gender'),
  alternatePhone: pickStr(me, 'alternatePhone'),
  whatsapp: pickStr(me, 'whatsapp'),
  addressLine: pickStr(me, 'addressLine'),
  village: pickStr(me, 'village'),
  tehsil: pickStr(me, 'tehsil'),
  district: pickStr(me, 'district'),
  state: pickStr(me, 'state'),
  pincode: pickStr(me, 'pincode'),
  landAreaAcres: (() => {
    const v = pick(me, 'landAreaAcres');
    return typeof v === 'number' && Number.isFinite(v) ? String(v) : '';
  })(),
  soilType: pickStr(me, 'soilType'),
  irrigationType: pickStr(me, 'irrigationType'),
  activeCrops: (Array.isArray(me['activeCrops']) ? (me['activeCrops'] as unknown[]) : [])
    .map((c) => str(c))
    .filter(Boolean)
    .join(', '),
});

const inputCls =
  'w-full px-3 py-2.5 text-xs rounded-xl border border-slate-300 focus:outline-none focus:border-emerald-600';

const Field: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div>
    <label className="block text-xs font-bold text-slate-700 mb-1">{label}</label>
    {children}
  </div>
);

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
  const { user, setUser } = useAuthStore();
  const [me, setMe] = useState<Record<string, unknown> | null>(null);
  const [form, setForm] = useState<ProfileForm>(EMPTY_FORM);
  const [photoUrl, setPhotoUrl] = useState('');
  const [photoBusy, setPhotoBusy] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);
  const [personaBusy, setPersonaBusy] = useState<PersonaType | null>(null);
  const [kycCases, setKycCases] = useState<Record<string, unknown>[] | null>(null);
  const [ratingMine, setRatingMine] = useState<Record<string, unknown> | null>(null);
  const [savedCount, setSavedCount] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Persona visibility (hide ≠ unlink — everything reappears on re-enable).
  const disabledPersonas = new Set((user?.disabledPersonas ?? []).map(normalizePersona));
  const enabledLinked = (user?.availablePersonas ?? []).filter(
    (p) => !disabledPersonas.has(normalizePersona(p))
  );

  const togglePersona = async (persona: PersonaType, enabled: boolean, label: string) => {
    if (personaBusy) return;
    const norm = normalizePersona(persona);
    if (
      !enabled &&
      enabledLinked.length <= 1 &&
      enabledLinked.some((p) => normalizePersona(p) === norm)
    ) {
      flash('err', 'At least one persona must stay enabled.');
      return;
    }
    if (!enabled && normalizePersona(user?.activePersona ?? '') === norm) {
      const fallback = enabledLinked.find((p) => normalizePersona(p) !== norm);
      if (
        !window.confirm(
          `Hide ${label}? You'll be switched to ${fallback ?? 'your next enabled persona'}. You can turn it back on anytime.`
        )
      ) {
        return;
      }
    }
    setPersonaBusy(norm);
    try {
      await users.setPersonaVisibility(norm, enabled);
      const fresh = await users.getMe();
      const rec = asRecord(fresh);
      setMe(rec);
      setUser(normalizeUserProfile(fresh));
      flash('ok', `${label} ${enabled ? 'enabled' : 'hidden'}.`);
    } catch (err) {
      flash('err', apiErrorMessage(err));
    } finally {
      setPersonaBusy(null);
    }
  };

  useEffect(() => {
    users
      .getMe()
      .then((u) => {
        const rec = asRecord(u);
        setMe(rec);
        setForm(formFromUser(rec));
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

  const setField = (key: keyof ProfileForm) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  const flash = (kind: 'ok' | 'err', text: string) => {
    setNotice({ kind, text });
    window.setTimeout(() => setNotice(null), 5000);
  };

  const onPhotoPicked = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || photoBusy) return;
    setPhotoBusy(true);
    try {
      const uploaded = await uploads.upload(file);
      const url = pickStr(asRecords(uploaded)[0] ?? {}, 'url');
      if (!url) throw new Error('upload did not return a url');
      setPhotoUrl(url);
    } catch (err) {
      flash('err', apiErrorMessage(err));
    } finally {
      setPhotoBusy(false);
    }
  };

  const saveProfile = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const payload: Record<string, unknown> = {
        name: form.name.trim() || undefined,
        vernacularName: form.vernacularName.trim() || undefined,
        email: form.email.trim() || undefined,
        dateOfBirth: form.dateOfBirth || undefined,
        gender: form.gender || undefined,
        alternatePhone: form.alternatePhone.trim() || undefined,
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
        activeCrops: form.activeCrops
          .split(',')
          .map((c) => c.trim())
          .filter(Boolean),
      };
      const trimmedPhoto = photoUrl.trim();
      if (trimmedPhoto) payload.photoUrl = trimmedPhoto;
      const updated = asRecord(await users.updateMe(payload as Partial<UserProfile>));
      setMe(updated);
      setForm(formFromUser(updated));
      setPhotoUrl(pickStr(updated, 'photoUrl'));
      flash('ok', 'Profile updated.');
    } catch (err) {
      flash('err', apiErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const name = form.name.trim() || pickStr(me ?? {}, 'name') || 'Member';
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

  const average = ratingMine ? pickNum(ratingMine, 'average') : 0;
  const reviewCount = ratingMine ? pickNum(ratingMine, 'count') : 0;
  const trustTier = ratingMine ? pickStr(ratingMine, 'trustTier') : '';

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
        <div className="flex items-start gap-4">
          <div className="relative flex-shrink-0">
            {photoUrl ? (
              <img src={photoUrl} alt={name} className="w-16 h-16 rounded-2xl object-cover border border-slate-200" />
            ) : (
              <div className="w-16 h-16 rounded-2xl bg-emerald-700 text-white font-black text-lg flex items-center justify-center">
                {initials || 'M'}
              </div>
            )}
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={photoBusy}
              title="Change profile photo"
              className="absolute -bottom-1.5 -right-1.5 w-6 h-6 rounded-full bg-slate-800 text-white flex items-center justify-center shadow hover:bg-slate-900 disabled:opacity-40"
            >
              <Camera className="w-3 h-3" />
            </button>
            <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => void onPhotoPicked(e)} />
          </div>
          <div className="min-w-0">
            <p className="text-lg font-extrabold text-slate-900 truncate">
              {name}
              {form.vernacularName.trim() && (
                <span className="text-sm font-bold text-slate-400 ml-2">{form.vernacularName.trim()}</span>
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
      </div>

      {/* Persona visibility — hide/show personas (hidden ≠ deleted) */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs p-5 space-y-4">
        <div>
          <h3 className="font-bold text-sm text-slate-900 flex items-center gap-1.5">
            <EyeOff className="w-4 h-4 text-emerald-600" /> Persona Visibility
          </h3>
          <p className="text-[11px] text-slate-400 mt-1">
            Turn personas on or off. A hidden persona disappears from the switcher and its menus —
            nothing is deleted, and turning it back on restores everything.
          </p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {ALL_PERSONAS.map((p) => {
            const enabled = isPersonaEnabled(user?.disabledPersonas, p.id);
            const busyP = personaBusy === p.id;
            return (
              <div
                key={p.id}
                className={cn(
                  'flex items-center justify-between gap-3 rounded-2xl border px-3 py-2.5 transition-colors',
                  enabled ? 'border-slate-200 bg-white' : 'border-slate-200 bg-slate-50'
                )}
              >
                <span
                  className={cn(
                    'flex items-center gap-2 text-xs font-semibold min-w-0',
                    enabled ? 'text-slate-700' : 'text-slate-400'
                  )}
                >
                  <span className="text-base flex-shrink-0">{p.icon}</span>
                  <span className="truncate">{p.label}</span>
                  {!enabled && (
                    <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400 flex-shrink-0">
                      Hidden
                    </span>
                  )}
                </span>
                <button
                  type="button"
                  role="switch"
                  aria-checked={enabled}
                  aria-label={`${p.label} visibility`}
                  disabled={busyP}
                  onClick={() => togglePersona(p.id, !enabled, p.label)}
                  className={cn(
                    'relative w-10 h-[22px] rounded-full transition-colors flex-shrink-0 disabled:opacity-60',
                    enabled ? 'bg-emerald-600' : 'bg-slate-300'
                  )}
                >
                  <span
                    className={cn(
                      'absolute top-[2px] h-[18px] w-[18px] rounded-full bg-white shadow transition-all',
                      enabled ? 'left-[20px]' : 'left-[2px]'
                    )}
                  />
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* Edit profile */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs p-5 space-y-4">
        <h3 className="font-bold text-sm text-slate-900 flex items-center gap-1.5">
          <UserRound className="w-4 h-4 text-emerald-600" /> Edit Profile
        </h3>
        {me === null ? (
          <p className="text-xs text-slate-400">Loading your profile…</p>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="Full name">
                <input type="text" value={form.name} onChange={setField('name')} className={inputCls} />
              </Field>
              <Field label="Vernacular name (नाम)">
                <input type="text" value={form.vernacularName} onChange={setField('vernacularName')} className={inputCls} />
              </Field>
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
              <Field label="Alternate phone (10-digit)">
                <input
                  type="tel"
                  value={form.alternatePhone}
                  onChange={(e) => setForm((f) => ({ ...f, alternatePhone: e.target.value.replace(/\D/g, '').slice(0, 10) }))}
                  className={inputCls}
                />
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
              <Field label="Active crops (comma separated)">
                <input
                  type="text"
                  value={form.activeCrops}
                  onChange={setField('activeCrops')}
                  placeholder="e.g. onion, wheat"
                  className={inputCls}
                />
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
          <Link to="/settings#ratings" className="text-[11px] font-bold text-emerald-700 flex items-center gap-0.5">
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
    </div>
  );
};
