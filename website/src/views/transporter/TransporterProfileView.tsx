import React, { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Award,
  BadgeCheck,
  Check,
  LogOut,
  MapPin,
  Pencil,
  Phone,
  RefreshCw,
  ShieldAlert,
  Star,
  Trash2,
  User,
  X,
} from 'lucide-react';
import { kyc, transport, users, apiErrorMessage } from '../../lib/api';
import { StatusBadge } from '../../components/common/StatusBadge';
import { ModalSheet } from '../../components/common/ModalSheet';
import { useAuthStore } from '../../stores/authStore';
import { asArr, asRec, firstNum, firstStr, fmtDate, str, type Rec } from './utils';

const SAVED_KIND_LABELS: Record<string, string> = {
  'mandi-rate': 'Mandi Rate',
  tree: 'Tree',
  article: 'Article',
  ad: 'Ad',
};

const Stars: React.FC<{ value: number }> = ({ value }) => (
  <span className="inline-flex items-center gap-0.5" title={`${value}/5`}>
    {[1, 2, 3, 4, 5].map((i) => (
      <Star key={i} className={`w-3.5 h-3.5 ${i <= value ? 'text-amber-500 fill-amber-500' : 'text-slate-300'}`} />
    ))}
  </span>
);

/** /transporter/profile — identity, KYC badge, received ratings, saved items. */
export const TransporterProfileView: React.FC = () => {
  const navigate = useNavigate();
  const { user, setUser, logout } = useAuthStore();

  const [profile, setProfile] = useState<Rec>({});
  const [kycRec, setKycRec] = useState<Rec>({});
  const [ratings, setRatings] = useState<Rec[]>([]);
  const [saved, setSaved] = useState<Rec[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [editOpen, setEditOpen] = useState(false);
  const [editForm, setEditForm] = useState({ name: '', village: '', tehsil: '', district: '', state: '', pincode: '', addressLine: '' });
  const [editBusy, setEditBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [me, k, r, s] = await Promise.all([
        users.getMe(),
        kyc.status().catch(() => ({})),
        transport.ratings().catch(() => [] as unknown[]),
        users.savedItems().catch(() => [] as unknown[]),
      ]);
      const meRec = asRec(me);
      setProfile(meRec);
      setKycRec(asRec(k));
      setRatings(asArr(r).map(asRec));
      setSaved(asArr(s).map(asRec));
    } catch (e) {
      setError(apiErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const flash = (msg: string) => {
    setNotice(msg);
    setTimeout(() => setNotice(null), 4000);
  };

  const openEdit = () => {
    setEditForm({
      name: firstStr(profile, ['name'], user?.name ?? ''),
      village: firstStr(profile, ['village'], user?.village ?? ''),
      tehsil: firstStr(profile, ['tehsil'], ''),
      district: firstStr(profile, ['district'], user?.district ?? ''),
      state: firstStr(profile, ['state'], user?.state ?? ''),
      pincode: firstStr(profile, ['pincode'], user?.pincode ?? ''),
      addressLine: firstStr(profile, ['addressLine'], ''),
    });
    setEditOpen(true);
  };

  const saveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setEditBusy(true);
    setError(null);
    try {
      const updated = await users.updateMe({
        name: editForm.name.trim(),
        village: editForm.village.trim() || undefined,
        tehsil: editForm.tehsil.trim() || undefined,
        district: editForm.district.trim() || undefined,
        state: editForm.state.trim() || undefined,
        pincode: editForm.pincode.trim() || undefined,
        addressLine: editForm.addressLine.trim() || undefined,
      });
      setUser(updated);
      setProfile(asRec(updated));
      setEditOpen(false);
      flash('Profile updated.');
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setEditBusy(false);
    }
  };

  const removeSaved = async (item: Rec) => {
    const kind = firstStr(item, ['kind'], '');
    const refId = firstStr(item, ['refId'], '');
    if (!kind || !refId) return;
    try {
      await users.unsaveItem(kind, refId);
      setSaved((prev) => prev.filter((s) => !(firstStr(s, ['kind']) === kind && firstStr(s, ['refId']) === refId)));
      flash('Saved item removed.');
    } catch (err) {
      setError(apiErrorMessage(err));
    }
  };

  const handleLogout = () => {
    logout();
    window.location.href = '/login';
  };

  const kycStatus = firstStr(kycRec, ['status', 'kycStatus'], user?.kycStatus ?? 'unverified');
  const verified = kycStatus === 'verified';
  const avgStars = ratings.length
    ? ratings.reduce((sum, r) => sum + firstNum(r, ['stars', 'rating'], 0), 0) / ratings.length
    : 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <Link to="/transporter" className="text-xs text-slate-400 hover:text-slate-600 flex items-center gap-1 mb-1">
            <ArrowLeft className="w-3.5 h-3.5" /> Transporter Home
          </Link>
          <h1 className="text-2xl font-extrabold text-slate-900 flex items-center gap-2">
            <User className="w-7 h-7 text-emerald-600" />
            Transporter Profile
          </h1>
          <p className="text-xs text-slate-500 mt-1">Identity, KYC standing, received ratings, and saved items</p>
        </div>
        <div className="flex gap-2 self-start sm:self-auto">
          <button onClick={openEdit} className="px-3.5 py-2.5 rounded-2xl border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold text-xs flex items-center gap-1.5">
            <Pencil className="w-4 h-4" /> Edit Profile
          </button>
          <button onClick={load} className="p-2.5 rounded-2xl border border-slate-200 text-slate-500 hover:bg-slate-50" title="Refresh">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {notice && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl text-xs font-bold text-emerald-900 flex items-center gap-2">
          <Check className="w-5 h-5 text-emerald-600" />
          <span>{notice}</span>
        </div>
      )}
      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl text-xs font-bold text-rose-800 flex items-center justify-between gap-2">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="p-1 hover:bg-rose-100 rounded-full">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Identity card */}
        <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs space-y-4">
          <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
            <span className="w-14 h-14 rounded-2xl bg-emerald-50 text-emerald-700 flex items-center justify-center">
              <User className="w-7 h-7" />
            </span>
            <div>
              <p className="font-extrabold text-lg text-slate-900 flex items-center gap-1.5">
                {firstStr(profile, ['name'], user?.name ?? 'Transporter')}
                {verified && <BadgeCheck className="w-5 h-5 text-sky-600" />}
              </p>
              <StatusBadge status={kycStatus} />
            </div>
          </div>
          <div className="space-y-2.5 text-xs">
            <p className="flex items-center gap-2 text-slate-600">
              <Phone className="w-3.5 h-3.5 text-slate-400" /> +91 {firstStr(profile, ['phone'], user?.phone ?? '—')}
            </p>
            <p className="flex items-start gap-2 text-slate-600">
              <MapPin className="w-3.5 h-3.5 text-slate-400 mt-0.5" />
              <span>
                {[firstStr(profile, ['addressLine'], ''), firstStr(profile, ['village'], user?.village ?? '')]
                  .filter((v) => v !== '—')
                  .join(', ') || 'Address not set'}
                <br />
                {[firstStr(profile, ['tehsil'], ''), firstStr(profile, ['district'], user?.district ?? ''), firstStr(profile, ['state'], user?.state ?? '')]
                  .filter((v) => v !== '—')
                  .join(', ')}
                {firstStr(profile, ['pincode'], user?.pincode ?? '') !== '—' ? ` — ${firstStr(profile, ['pincode'])}` : ''}
              </span>
            </p>
            {!verified && (
              <p className="flex items-center gap-2 text-amber-700 bg-amber-50 border border-amber-100 rounded-xl p-2.5">
                <ShieldAlert className="w-4 h-4" /> KYC not verified — complete it to build trust with farmers.
                <Link to="/kyc" className="underline font-bold">Open KYC</Link>
              </p>
            )}
          </div>
          <button
            onClick={handleLogout}
            className="w-full px-4 py-2.5 rounded-2xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs flex items-center justify-center gap-2"
          >
            <LogOut className="w-4 h-4" /> Logout
          </button>
        </div>

        {/* Ratings received */}
        <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs space-y-3 lg:col-span-2">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
              <Award className="w-4 h-4 text-amber-600" /> Ratings Received
            </h3>
            <div className="flex items-center gap-2 text-xs">
              <Stars value={Math.round(avgStars)} />
              <span className="font-bold text-slate-700">{ratings.length ? avgStars.toFixed(1) : '—'}</span>
              <Link to="/transporter/ratings" className="text-emerald-700 font-bold hover:underline">View all →</Link>
            </div>
          </div>
          {ratings.length === 0 && !loading ? (
            <p className="text-xs text-slate-400 text-center py-6">No ratings yet — completed trips with farmer feedback appear here.</p>
          ) : (
            <div className="space-y-2">
              {ratings.slice(0, 6).map((r) => (
                <div key={str(r.id) || JSON.stringify(r).slice(0, 24)} className="p-3 bg-slate-50 rounded-2xl text-xs space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-bold text-slate-800">
                      {firstStr(r, ['farmerName', 'raterName', 'providerName'], `Trip ${firstStr(r, ['bookingId'], '')}`)}
                    </span>
                    <Stars value={firstNum(r, ['stars', 'rating'], 0)} />
                  </div>
                  {firstStr(r, ['comment', 'review'], '') !== '—' && <p className="text-slate-500">{firstStr(r, ['comment', 'review'])}</p>}
                  {asArr(r.tags).length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {asArr(r.tags).map((t) => (
                        <span key={str(t)} className="px-2 py-0.5 rounded-full bg-white border border-slate-200 text-[10px] font-bold text-slate-500 capitalize">
                          {str(t).replace(/_/g, ' ')}
                        </span>
                      ))}
                    </div>
                  )}
                  <p className="text-[10px] text-slate-400">{fmtDate(r.createdAt)}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Saved items */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs space-y-3">
        <h3 className="font-bold text-sm text-slate-900">Saved Items</h3>
        {saved.length === 0 && !loading ? (
          <p className="text-xs text-slate-400 text-center py-6">
            Nothing saved yet — bookmark mandi rates, trees, articles, or ads across the app and they appear here.
          </p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {saved.map((s) => {
              const kind = firstStr(s, ['kind'], 'item');
              return (
                <div key={str(s.id) || `${kind}-${firstStr(s, ['refId'], '')}`} className="flex items-center justify-between gap-3 p-3 bg-slate-50 rounded-2xl text-xs">
                  <div className="min-w-0">
                    <p className="font-bold text-slate-800 truncate">{firstStr(s, ['title'], firstStr(s, ['refId'], 'Saved item'))}</p>
                    <p className="text-slate-400">
                      {SAVED_KIND_LABELS[kind] ?? kind} • saved {fmtDate(s.createdAt)}
                    </p>
                  </div>
                  <button
                    onClick={() => removeSaved(s)}
                    className="p-2 rounded-xl border border-rose-200 text-rose-700 hover:bg-rose-50 font-bold flex items-center gap-1 shrink-0"
                    title="Remove"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Edit profile modal */}
      <ModalSheet isOpen={editOpen} onClose={() => setEditOpen(false)} title="Edit Profile" description="PUT /users/me — phone number is tied to your account and cannot be changed here" maxWidth="md">
        <form onSubmit={saveProfile} className="space-y-3">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Full name</label>
            <input type="text" value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300" required />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Address line</label>
            <input type="text" value={editForm.addressLine} onChange={(e) => setEditForm({ ...editForm, addressLine: e.target.value })} className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300" placeholder="Shop / godown / street" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Village / City</label>
              <input type="text" value={editForm.village} onChange={(e) => setEditForm({ ...editForm, village: e.target.value })} className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300" />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Tehsil / Taluka</label>
              <input type="text" value={editForm.tehsil} onChange={(e) => setEditForm({ ...editForm, tehsil: e.target.value })} className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">District</label>
              <input type="text" value={editForm.district} onChange={(e) => setEditForm({ ...editForm, district: e.target.value })} className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300" />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">State</label>
              <input type="text" value={editForm.state} onChange={(e) => setEditForm({ ...editForm, state: e.target.value })} className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Pincode</label>
            <input
              type="text"
              inputMode="numeric"
              maxLength={6}
              value={editForm.pincode}
              onChange={(e) => setEditForm({ ...editForm, pincode: e.target.value.replace(/\D/g, '').slice(0, 6) })}
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300"
              placeholder="422006"
            />
          </div>
          <button type="submit" disabled={editBusy} className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs disabled:opacity-60">
            {editBusy ? 'Saving…' : 'Save Profile'}
          </button>
        </form>
      </ModalSheet>
    </div>
  );
};
