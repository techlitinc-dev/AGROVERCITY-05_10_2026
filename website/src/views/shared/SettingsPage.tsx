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
  Star,
  ChevronDown,
  ChevronUp,
  ShieldCheck,
  Ban,
  Lock,
} from 'lucide-react';
import { apiClient, apiErrorMessage, auth, ratings, users } from '../../lib/api';
import type { UserProfile } from '../../types';
import { useAuthStore } from '../../stores/authStore';
import { useI18nStore } from '../../lib/i18n';
import { cn, formatDateTime, formatNumber } from '../../lib/utils';
import { asRecord, asRecords, bool, pick, pickNum, pickStr } from './records';

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
        {toggleRow(
          'Discoverable in search',
          'Allow other members to find your profile in search and discovery',
          settings['discoverable'] === undefined ? true : bool(settings['discoverable']),
          (next) => void saveSetting('discoverable', next)
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

      {/* Blocked users */}
      <BlockedUsersSection />

      {/* Ratings & reviews */}
      <RatingsReviewsSection />

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

/* ---------------------------------------------------- Ratings & Reviews */

const StarRow: React.FC<{ rating: number; className?: string }> = ({ rating, className }) => (
  <span className={cn('inline-flex items-center gap-0.5', className)}>
    {[1, 2, 3, 4, 5].map((i) => (
      <Star
        key={i}
        className={cn('w-3.5 h-3.5', i <= Math.round(rating) ? 'text-amber-400 fill-amber-400' : 'text-slate-200')}
      />
    ))}
  </span>
);

const RatingsReviewsSection: React.FC = () => {
  const [mine, setMine] = useState<Record<string, unknown> | null>(null);
  const [given, setGiven] = useState<Record<string, unknown>[] | null>(null);
  const [givenOpen, setGivenOpen] = useState(false);
  const [replyingId, setReplyingId] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);

  const loadMine = async () => {
    try {
      setMine(asRecord(await ratings.mine()));
    } catch {
      setMine({});
    }
  };

  useEffect(() => {
    void loadMine();
  }, []);

  useEffect(() => {
    if (!givenOpen || given !== null) return;
    ratings
      .given()
      .then((rows) => setGiven(asRecords(rows)))
      .catch(() => setGiven([]));
  }, [givenOpen, given]);

  const sendReply = async (ratingId: string) => {
    if (!replyText.trim() || busy) return;
    setBusy(true);
    setNotice(null);
    try {
      await ratings.reply(ratingId, { reply: replyText.trim() });
      setNotice({ kind: 'ok', text: 'Reply posted on your review.' });
      setReplyingId(null);
      setReplyText('');
      await loadMine();
    } catch (err) {
      setNotice({ kind: 'err', text: apiErrorMessage(err) });
    } finally {
      setBusy(false);
    }
  };

  const avgRaw = mine ? pick(mine, 'average') : undefined;
  const average = typeof avgRaw === 'number' && Number.isFinite(avgRaw) ? avgRaw : null;
  const reviewCount = mine ? pickNum(mine, 'count') : 0;
  const trustTier = mine ? pickStr(mine, 'trustTier') : '';
  const recent = mine ? asRecords(pick(mine, 'recent')) : [];

  return (
    <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs p-5 space-y-4">
      <h3 className="font-bold text-sm text-slate-900 flex items-center gap-1.5">
        <Star className="w-4 h-4 text-amber-500" /> Ratings & Reviews
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

      {mine === null ? (
        <p className="text-xs text-slate-400">Loading your ratings…</p>
      ) : reviewCount === 0 && recent.length === 0 ? (
        <p className="text-xs text-slate-400">
          No ratings yet — completed orders, deliveries and consultations earn star ratings from
          other members.
        </p>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-4 p-3 rounded-2xl bg-slate-50 border border-slate-100">
            <div>
              <p className="text-2xl font-black text-slate-900">
                {average !== null ? average.toFixed(1) : '—'}
                <span className="text-sm font-bold text-slate-400">/5</span>
              </p>
              <StarRow rating={average ?? 0} />
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

          <div className="space-y-2">
            {recent.length === 0 && <p className="text-xs text-slate-400">No written reviews yet.</p>}
            {recent.map((r, i) => {
              const id = pickStr(r, 'id') || String(i);
              const reply = pickStr(r, 'reply');
              return (
                <div key={id} className="p-3 rounded-2xl border border-slate-100 bg-slate-50/60 space-y-1.5">
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                    <div>
                      <p className="font-bold text-slate-800">{pickStr(r, 'raterName') || 'Member'}</p>
                      <p className="text-[11px] text-slate-400 capitalize">
                        {pickStr(r, 'kind') || 'general'} · {formatDateTime(pickStr(r, 'createdAt')) || '—'}
                      </p>
                    </div>
                    <StarRow rating={pickNum(r, 'rating')} />
                  </div>
                  {pickStr(r, 'comment') && <p className="text-xs text-slate-600">{pickStr(r, 'comment')}</p>}
                  {reply ? (
                    <p className="text-[11px] text-slate-500 border-l-2 border-emerald-300 pl-2">
                      <span className="font-bold text-emerald-700">Your reply:</span> {reply}
                    </p>
                  ) : replyingId === id ? (
                    <div className="flex flex-col sm:flex-row gap-2 pt-1">
                      <input
                        type="text"
                        value={replyText}
                        onChange={(e) => setReplyText(e.target.value)}
                        placeholder="Write a public reply…"
                        className="flex-1 px-3 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:border-emerald-600"
                      />
                      <div className="flex gap-2">
                        <button
                          onClick={() => void sendReply(id)}
                          disabled={busy || !replyText.trim()}
                          className="px-3 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white text-[11px] font-bold rounded-xl"
                        >
                          {busy ? 'Posting…' : 'Reply'}
                        </button>
                        <button
                          onClick={() => {
                            setReplyingId(null);
                            setReplyText('');
                          }}
                          className="px-3 py-2 bg-slate-100 text-slate-600 text-[11px] font-bold rounded-xl"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      onClick={() => {
                        setReplyingId(id);
                        setReplyText('');
                      }}
                      className="text-[11px] font-bold text-emerald-700"
                    >
                      Reply
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* Ratings I gave */}
      <div className="pt-2 border-t border-slate-100">
        <button
          onClick={() => setGivenOpen((o) => !o)}
          className="flex items-center justify-between w-full text-xs font-bold text-slate-700 hover:text-slate-900"
        >
          <span>Ratings I gave</span>
          {givenOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>
        {givenOpen && (
          <div className="mt-2 space-y-1.5">
            {given === null ? (
              <p className="text-xs text-slate-400">Loading…</p>
            ) : given.length === 0 ? (
              <p className="text-xs text-slate-400">You have not rated anyone yet.</p>
            ) : (
              given.map((g, i) => (
                <div key={pickStr(g, 'id') || i} className="flex items-center justify-between gap-2 text-xs p-2 rounded-xl bg-slate-50 border border-slate-100">
                  <div>
                    <p className="font-bold text-slate-800">{pickStr(g, 'rateeName', 'toName', 'name', 'raterName') || 'Member'}</p>
                    <p className="text-[10px] text-slate-400 capitalize">
                      {pickStr(g, 'kind') || 'general'} · {formatDateTime(pickStr(g, 'createdAt')) || '—'}
                    </p>
                  </div>
                  <StarRow rating={pickNum(g, 'rating')} />
                </div>
              ))
            )}
          </div>
        )}
      </div>
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
