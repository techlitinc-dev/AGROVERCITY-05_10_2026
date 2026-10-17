import React, { useEffect, useState } from 'react';
import {
  Settings,
  User,
  BellRing,
  Database,
  MonitorSmartphone,
  LogOut,
  Save,
  AlertCircle,
  CheckCircle2,
  Download,
} from 'lucide-react';
import { apiClient, apiErrorMessage, users } from '../../lib/api';
import type { UserProfile } from '../../types';
import { useAuthStore } from '../../stores/authStore';
import { useI18nStore } from '../../lib/i18n';
import { cn, formatDateTime } from '../../lib/utils';
import { asRecord, asRecords, bool, pickStr } from './records';

interface SessionRow {
  id: string;
  device?: string;
  ip?: string;
  createdAt?: string;
  current?: boolean;
}

export const SettingsPage: React.FC = () => {
  const { user, login, logout } = useAuthStore();
  const { language, setLanguage } = useI18nStore();
  const [profile, setProfile] = useState({ name: '', village: '', pincode: '', farmSizeAcres: '' });
  const [settings, setSettings] = useState<Record<string, unknown>>({});
  const [consents, setConsents] = useState<Record<string, boolean | undefined>>({});
  const [exportStatus, setExportStatus] = useState<Record<string, unknown> | null>(null);
  const [sessions, setSessions] = useState<SessionRow[]>([]);
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
      .getSettings()
      .then((s) => setSettings(asRecord(s)))
      .catch(() => undefined);
    users
      .getConsents()
      .then((c) => setConsents(c))
      .catch(() => undefined);
    users
      .latestDataExport()
      .then((e) => setExportStatus(asRecord(e)))
      .catch(() => undefined);
    void loadSessions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const loadSessions = async () => {
    // No typed wrapper exists for /auth/sessions — call apiClient directly.
    try {
      const res = await apiClient.get('/auth/sessions');
      const list = asRecords(res.data?.sessions ?? res.data);
      setSessions(
        list.map((s) => ({
          id: pickStr(s, 'id', 'jti'),
          device: pickStr(s, 'device', 'userAgent'),
          ip: pickStr(s, 'ip'),
          createdAt: pickStr(s, 'createdAt'),
          current: bool(s['current']),
        }))
      );
    } catch {
      setSessions([]);
    }
  };

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

  const saveSetting = async (key: string, value: unknown) => {
    const next = { ...settings, [key]: value };
    setSettings(next);
    try {
      const saved = await users.updateSettings(next);
      setSettings(asRecord(saved));
    } catch (err) {
      flash('err', apiErrorMessage(err));
    }
  };

  const saveConsent = async (key: string, value: boolean) => {
    const next = { ...consents, [key]: value };
    setConsents(next);
    try {
      const saved = await users.updateConsents(next);
      setConsents(saved);
    } catch (err) {
      flash('err', apiErrorMessage(err));
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

  const revokeSession = async (jti: string) => {
    if (busy) return;
    setBusy(jti);
    try {
      await apiClient.delete(`/auth/sessions/${jti}`);
      setSessions((prev) => prev.filter((s) => s.id !== jti));
      flash('ok', 'Session revoked — that device is signed out.');
    } catch (err) {
      flash('err', apiErrorMessage(err));
    } finally {
      setBusy(null);
    }
  };

  const toggleRow = (
    label: string,
    description: string,
    value: boolean,
    onChange: (next: boolean) => void
  ) => (
    <button
      onClick={() => onChange(!value)}
      className="w-full flex items-center justify-between gap-3 px-3 py-3 rounded-2xl border border-slate-200 hover:border-emerald-300 transition-colors text-left"
    >
      <div>
        <p className="text-xs font-bold text-slate-800">{label}</p>
        <p className="text-[11px] text-slate-400">{description}</p>
      </div>
      <span className={cn('w-9 h-5 rounded-full relative flex-shrink-0', value ? 'bg-emerald-500' : 'bg-slate-300')}>
        <span
          className={cn(
            'absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all',
            value ? 'left-[18px]' : 'left-0.5'
          )}
        />
      </span>
    </button>
  );

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="border-b border-slate-200 pb-4">
        <h1 className="text-2xl font-extrabold text-slate-900 flex items-center gap-2">
          <Settings className="w-7 h-7 text-emerald-600" />
          Settings & Privacy
        </h1>
        <p className="text-xs text-slate-500 mt-1">
          Profile, preferences, consents, data export, and active sessions across every persona
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

      {/* Preferences */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs p-5 space-y-3">
        <h3 className="font-bold text-sm text-slate-900 flex items-center gap-1.5">
          <BellRing className="w-4 h-4 text-emerald-600" /> App Preferences
        </h3>
        {toggleRow('Hindi interface (हिन्दी)', 'Switch the whole app language', language === 'hi', (next) => {
          setLanguage(next ? 'hi' : 'en');
          void saveSetting('language', next ? 'hi' : 'en');
        })}
        {toggleRow(
          'Women mode',
          'Prioritise SHG, gruh udyog and mahila-specific content',
          bool(settings['womenMode']),
          (next) => void saveSetting('womenMode', next)
        )}
        {toggleRow(
          'High contrast',
          'Boost text and border contrast across all screens',
          bool(settings['highContrast']),
          (next) => void saveSetting('highContrast', next)
        )}
        {toggleRow(
          'Dark mode',
          'Dark surfaces for night-time mandi monitoring',
          bool(settings['darkMode']),
          (next) => void saveSetting('darkMode', next)
        )}
      </div>

      {/* Consents */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs p-5 space-y-3">
        <h3 className="font-bold text-sm text-slate-900 flex items-center gap-1.5">
          <Database className="w-4 h-4 text-emerald-600" /> Data Consents
        </h3>
        {Object.keys(consents).length === 0 && (
          <p className="text-xs text-slate-400">Consent switches are exposed here once the server returns them.</p>
        )}
        {Object.entries(consents).map(([key, value]) =>
          typeof value === 'boolean' || value === undefined
            ? toggleRow(
                key.replace(/([A-Z])/g, ' $1').replace(/^./, (c) => c.toUpperCase()),
                'Tap to grant or withdraw this consent',
                bool(value),
                (next) => void saveConsent(key, next)
              )
            : null
        )}
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

      {/* Sessions */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs p-5 space-y-3">
        <h3 className="font-bold text-sm text-slate-900 flex items-center gap-1.5">
          <MonitorSmartphone className="w-4 h-4 text-emerald-600" /> Active Sessions
        </h3>
        {sessions.length === 0 ? (
          <p className="text-xs text-slate-400">
            Session list unavailable (server may not track sessions in this environment) — changing your password or MPIN revokes everything.
          </p>
        ) : (
          <div className="space-y-2">
            {sessions.map((s) => (
              <div
                key={s.id}
                className="flex items-center justify-between gap-3 p-3 rounded-2xl border border-slate-100 bg-slate-50/60 text-xs"
              >
                <div>
                  <p className="font-bold text-slate-800">
                    {s.device || 'Unknown device'} {s.current && <span className="text-emerald-700">(this device)</span>}
                  </p>
                  <p className="text-[11px] text-slate-400">
                    {s.ip || '—'} · active since {formatDateTime(s.createdAt || '') || '—'}
                  </p>
                </div>
                {!s.current && (
                  <button
                    onClick={() => void revokeSession(s.id)}
                    disabled={busy === s.id}
                    className="px-3 py-1.5 bg-rose-50 border border-rose-200 text-rose-700 font-bold rounded-xl disabled:opacity-40"
                  >
                    Revoke
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

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
