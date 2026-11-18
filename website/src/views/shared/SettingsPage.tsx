import React, { useEffect, useState } from 'react';
import {
  Settings,
  User,
  LogOut,
  Save,
  AlertCircle,
  CheckCircle2,
  Download,
  Ban,
  Lock,
} from 'lucide-react';
import { apiErrorMessage, auth, users } from '../../lib/api';
import type { UserProfile } from '../../types';
import { useAuthStore } from '../../stores/authStore';
import { cn, formatDateTime } from '../../lib/utils';
import { asRecord, asRecords, pickStr } from './records';

export const SettingsPage: React.FC = () => {
  const { user, login, logout } = useAuthStore();
  const [profile, setProfile] = useState({ name: '', village: '', pincode: '', farmSizeAcres: '' });
  const [exportStatus, setExportStatus] = useState<Record<string, unknown> | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);

  useEffect(() => {
    if (user) {
      setProfile({
        name: user.name || '',
        village: user.village || '',
        pincode: user.pincode || '',
        farmSizeAcres: user.farmSizeAcres ? String(user.farmSizeAcres) : '',
      });
    }
    users
      .latestDataExport()
      .then((e) => setExportStatus(asRecord(e)))
      .catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const flash = (kind: 'ok' | 'err', text: string) => {
    setNotice({ kind, text });
    window.setTimeout(() => setNotice(null), 5000);
  };

  const saveProfile = async () => {
    if (busy) return;
    setBusy('profile');
    try {
      const updated: UserProfile = await users.updateMe({
        name: profile.name.trim() || undefined,
        village: profile.village.trim() || undefined,
        pincode: profile.pincode.trim() || undefined,
        farmSizeAcres: profile.farmSizeAcres ? Number(profile.farmSizeAcres) : undefined,
      } as Partial<UserProfile>);
      // Keep the auth store in sync with the freshly saved profile.
      login(updated);
      flash('ok', 'Profile updated.');
    } catch (err) {
      flash('err', apiErrorMessage(err));
    } finally {
      setBusy(null);
    }
  };

  const requestExport = async () => {
    if (busy) return;
    setBusy('export');
    try {
      await users.requestDataExport();
      flash('ok', 'Data export requested — a download link is sent to your registered number within 24 hours.');
      const latest = await users.latestDataExport().catch(() => null);
      if (latest) setExportStatus(asRecord(latest));
    } catch (err) {
      flash('err', apiErrorMessage(err));
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="border-b border-slate-200 pb-4">
        <h1 className="text-2xl font-extrabold text-slate-900 flex items-center gap-2">
          <Settings className="w-7 h-7 text-emerald-600" />
          Settings & Privacy
        </h1>
        <p className="text-xs text-slate-500 mt-1">
          Profile, data export, blocked users, and sign-in security across every persona
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

      {/* Profile */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs p-5 space-y-4">
        <h3 className="font-bold text-sm text-slate-900 flex items-center gap-1.5">
          <User className="w-4 h-4 text-emerald-600" /> Profile
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Full name</label>
            <input
              type="text"
              value={profile.name}
              onChange={(e) => setProfile((p) => ({ ...p, name: e.target.value }))}
              className="w-full px-3 py-2.5 text-xs rounded-xl border border-slate-300 focus:outline-none focus:border-emerald-600"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Village</label>
            <input
              type="text"
              value={profile.village}
              onChange={(e) => setProfile((p) => ({ ...p, village: e.target.value }))}
              className="w-full px-3 py-2.5 text-xs rounded-xl border border-slate-300 focus:outline-none focus:border-emerald-600"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">PIN code</label>
            <input
              type="text"
              value={profile.pincode}
              onChange={(e) => setProfile((p) => ({ ...p, pincode: e.target.value.replace(/\D/g, '').slice(0, 6) }))}
              className="w-full px-3 py-2.5 text-xs rounded-xl border border-slate-300 focus:outline-none focus:border-emerald-600"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Farm size (acres)</label>
            <input
              type="number"
              min={0}
              step={0.1}
              value={profile.farmSizeAcres}
              onChange={(e) => setProfile((p) => ({ ...p, farmSizeAcres: e.target.value }))}
              className="w-full px-3 py-2.5 text-xs rounded-xl border border-slate-300 focus:outline-none focus:border-emerald-600"
            />
          </div>
        </div>
        <button
          onClick={() => void saveProfile()}
          disabled={busy === 'profile'}
          className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white font-bold text-xs rounded-xl shadow-xs flex items-center gap-1.5"
        >
          <Save className="w-3.5 h-3.5" /> {busy === 'profile' ? 'Saving…' : 'Save Profile'}
        </button>
      </div>

      {/* Data export */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs p-5 space-y-3">
        <h3 className="font-bold text-sm text-slate-900 flex items-center gap-1.5">
          <Download className="w-4 h-4 text-emerald-600" /> My Data Export
        </h3>
        <p className="text-xs text-slate-500">
          Request a complete copy of your data (plots, orders, chats, KYC references) as a downloadable archive.
        </p>
        {exportStatus && Object.keys(exportStatus).length > 0 && (
          <p className="text-[11px] text-slate-400">
            Latest request: {pickStr(exportStatus, 'status') || 'requested'} ·{' '}
            {formatDateTime(pickStr(exportStatus, 'requestedAt', 'createdAt')) || '—'}
          </p>
        )}
        <button
          onClick={() => void requestExport()}
          disabled={busy === 'export'}
          className="px-4 py-2.5 bg-slate-800 hover:bg-slate-900 disabled:opacity-40 text-white font-bold text-xs rounded-xl shadow-xs"
        >
          {busy === 'export' ? 'Requesting…' : 'Request Data Export'}
        </button>
      </div>

      {/* Blocked users */}
      <BlockedUsersSection />

      {/* Change MPIN */}
      <MpinChangeSection />

      {/* Logout */}
      <button
        onClick={() => {
          logout();
          window.location.href = '/login';
        }}
        className="w-full px-4 py-3 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-2xl shadow-xs flex items-center justify-center gap-2"
      >
        <LogOut className="w-4 h-4" /> Sign out on this device
      </button>
    </div>
  );
};

/* ---------------------------------------------------- Blocked users */

const BlockedUsersSection: React.FC = () => {
  const [blocked, setBlocked] = useState<Record<string, unknown>[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);

  useEffect(() => {
    users
      .blocks()
      .then((rows) => setBlocked(asRecords(rows)))
      .catch(() => setBlocked([]));
  }, []);

  const unblock = async (userId: string) => {
    if (busy) return;
    setBusy(userId);
    setNotice(null);
    try {
      await users.unblockUser(userId);
      setBlocked((prev) => (prev ?? []).filter((b) => pickStr(b, 'userId') !== userId));
      setNotice({ kind: 'ok', text: 'User unblocked — they can contact you again.' });
    } catch (err) {
      setNotice({ kind: 'err', text: apiErrorMessage(err) });
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs p-5 space-y-3">
      <h3 className="font-bold text-sm text-slate-900 flex items-center gap-1.5">
        <Ban className="w-4 h-4 text-rose-500" /> Blocked Users
      </h3>

      {notice && (
        <div
          className={cn(
            'rounded-2xl border p-2.5 text-xs flex items-start gap-2',
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

      {blocked === null ? (
        <p className="text-xs text-slate-400">Loading blocked users…</p>
      ) : blocked.length === 0 ? (
        <p className="text-xs text-slate-400">No blocked users</p>
      ) : (
        <div className="space-y-2">
          {blocked.map((b, i) => {
            const userId = pickStr(b, 'userId', 'id') || String(i);
            return (
              <div
                key={userId}
                className="flex items-center justify-between gap-3 p-3 rounded-2xl border border-slate-100 bg-slate-50/60 text-xs"
              >
                <div>
                  <p className="font-bold text-slate-800">{pickStr(b, 'name') || 'Member'}</p>
                  <p className="text-[11px] text-slate-400">
                    blocked {formatDateTime(pickStr(b, 'at')) || '—'}
                  </p>
                </div>
                <button
                  onClick={() => void unblock(userId)}
                  disabled={busy === userId}
                  className="px-3 py-1.5 bg-white border border-slate-200 text-slate-700 font-bold rounded-xl hover:border-emerald-300 disabled:opacity-40"
                >
                  {busy === userId ? 'Unblocking…' : 'Unblock'}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

/* ---------------------------------------------------- Change MPIN */

const MpinChangeSection: React.FC = () => {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);

  const submit = async () => {
    if (busy) return;
    setNotice(null);
    if (!/^\d{4}$/.test(current)) {
      setNotice({ kind: 'err', text: 'Enter your current 4-digit MPIN.' });
      return;
    }
    if (!/^\d{4}$/.test(next)) {
      setNotice({ kind: 'err', text: 'New MPIN must be exactly 4 digits.' });
      return;
    }
    if (next !== confirm) {
      setNotice({ kind: 'err', text: 'New MPIN and confirmation do not match.' });
      return;
    }
    if (next === current) {
      setNotice({ kind: 'err', text: 'New MPIN must be different from the current MPIN.' });
      return;
    }
    setBusy(true);
    try {
      await auth.changeMpin(current, next);
      setNotice({ kind: 'ok', text: 'MPIN changed successfully — use it from your next sign-in.' });
      setCurrent('');
      setNext('');
      setConfirm('');
    } catch (err) {
      setNotice({ kind: 'err', text: apiErrorMessage(err) });
    } finally {
      setBusy(false);
    }
  };

  const mpinInput = (value: string, onChange: (v: string) => void, placeholder: string) => (
    <input
      type="password"
      inputMode="numeric"
      maxLength={4}
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value.replace(/\D/g, '').slice(0, 4))}
      className="w-full px-3 py-2.5 text-xs rounded-xl border border-slate-300 focus:outline-none focus:border-emerald-600 tracking-widest"
    />
  );

  return (
    <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs p-5 space-y-3">
      <h3 className="font-bold text-sm text-slate-900 flex items-center gap-1.5">
        <Lock className="w-4 h-4 text-emerald-600" /> Change MPIN
      </h3>
      <p className="text-xs text-slate-500">
        Your 4-digit MPIN protects sign-in and payments. Changing it keeps you signed in on this
        device.
      </p>

      {notice && (
        <div
          className={cn(
            'rounded-2xl border p-2.5 text-xs flex items-start gap-2',
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

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1">Current MPIN</label>
          {mpinInput(current, setCurrent, '••••')}
        </div>
        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1">New MPIN</label>
          {mpinInput(next, setNext, '••••')}
        </div>
        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1">Confirm new MPIN</label>
          {mpinInput(confirm, setConfirm, '••••')}
        </div>
      </div>
      <button
        onClick={() => void submit()}
        disabled={busy || current.length !== 4 || next.length !== 4 || confirm.length !== 4}
        className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white font-bold text-xs rounded-xl shadow-xs flex items-center gap-1.5"
      >
        <Lock className="w-3.5 h-3.5" /> {busy ? 'Changing…' : 'Change MPIN'}
      </button>
    </div>
  );
};
