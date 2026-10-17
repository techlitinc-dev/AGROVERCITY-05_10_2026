import React, { useEffect, useState } from 'react';
import { Users, Gift, Copy, Check, Send, Share2 } from 'lucide-react';
import { referrals, apiErrorMessage } from '../../lib/api';
import { StatCard } from '../../components/common/StatCard';

const asRecord = (v: unknown): Record<string, unknown> =>
  v !== null && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
const asArray = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const asNum = (v: unknown, fallback = 0): number => (typeof v === 'number' && !Number.isNaN(v) ? v : fallback);
const asStr = (v: unknown, fallback = ''): string => (typeof v === 'string' ? v : fallback);

export const ReferralsView: React.FC = () => {
  const [summary, setSummary] = useState<Record<string, unknown> | null>(null);
  const [referred, setReferred] = useState<unknown[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [invitePhone, setInvitePhone] = useState('');
  const [inviteChannel, setInviteChannel] = useState<'whatsapp' | 'sms'>('whatsapp');
  const [inviting, setInviting] = useState(false);

  useEffect(() => {
    let active = true;
    setLoading(true);
    referrals
      .summary()
      .then((res) => {
        if (!active) return;
        const r = asRecord(res);
        setSummary(r);
        setReferred(asArray(r.referred ?? r.referredUsers ?? r.invites));
      })
      .catch((e) => active && setError(apiErrorMessage(e)))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, []);

  const inviteCode = asStr(summary?.inviteCode ?? summary?.code ?? summary?.referralCode, '');
  const totalReferrals = asNum(summary?.totalReferrals ?? summary?.referralCount, referred.length);
  const coinsEarned = asNum(summary?.coinsEarned ?? summary?.totalCoinsEarned, 0);

  const copyCode = () => {
    if (!inviteCode) return;
    navigator.clipboard.writeText(inviteCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const shareLink = inviteCode ? `${window.location.origin}/register?ref=${inviteCode}` : '';

  const handleInvite = async () => {
    if (!invitePhone.trim()) {
      setError('Enter the farmer\'s mobile number to send an invite.');
      return;
    }
    setInviting(true);
    setError(null);
    try {
      await referrals.invite({ phone: invitePhone.trim(), channel: inviteChannel });
      setNotice(`Invite sent to ${invitePhone} via ${inviteChannel.toUpperCase()}.`);
      setInvitePhone('');
    } catch (e) {
      setError(apiErrorMessage(e));
    } finally {
      setInviting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="border-b border-slate-200 pb-4">
        <h1 className="text-2xl font-extrabold text-slate-900 flex items-center gap-2">
          <Users className="w-7 h-7 text-emerald-600" />
          Refer & Earn (Gaon Connect)
        </h1>
        <p className="text-xs text-slate-500 mt-1">
          Invite neighbouring farmers. When they verify their 7/12 record, you both earn Kisan Coins.
        </p>
      </div>

      {error && (
        <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-2xl text-xs font-semibold text-rose-800">
          {error}
        </div>
      )}
      {notice && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-2xl text-xs font-semibold text-emerald-800 flex items-center justify-between">
          <span>{notice}</span>
          <button onClick={() => setNotice(null)} className="font-bold hover:underline">Dismiss</button>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          title="Total Referrals"
          value={loading ? '—' : `${totalReferrals} Farmers`}
          subtitle="Joined with your invite code"
          icon={Users}
          colorScheme="green"
        />
        <StatCard
          title="Coins Earned"
          value={loading ? '—' : coinsEarned}
          subtitle="50 coins per verified joining"
          icon={Gift}
          colorScheme="amber"
        />
        <StatCard
          title="My Invite Code"
          value={inviteCode || '—'}
          subtitle="Share it with your village"
          icon={Share2}
          colorScheme="purple"
        />
      </div>

      {/* Invite code banner */}
      <div className="bg-gradient-to-r from-emerald-800 to-teal-900 rounded-3xl p-6 sm:p-8 text-white shadow-md flex flex-col sm:flex-row sm:items-center justify-between gap-6">
        <div className="space-y-1">
          <h3 className="font-extrabold text-lg">Invite Neighboring Farmers & Earn 50 Coins</h3>
          <p className="text-xs text-emerald-200 max-w-lg">
            Share your unique invite code. When they register their 7/12 land record, both of you receive 50 bonus Kisan Coins!
          </p>
        </div>

        <div className="flex items-center gap-3 bg-white/10 backdrop-blur-md p-2 rounded-2xl border border-white/20 self-start sm:self-auto">
          <span className="font-mono font-black text-sm tracking-wider px-3">{inviteCode || 'LOADING…'}</span>
          <button
            onClick={copyCode}
            disabled={!inviteCode}
            className="px-3 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-white font-bold text-xs rounded-xl shadow-xs flex items-center gap-1.5 transition-colors disabled:opacity-50"
          >
            {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copied ? 'Copied' : 'Copy'}</span>
          </button>
        </div>
      </div>

      {/* Direct invite form */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs space-y-4">
        <h3 className="font-bold text-sm text-slate-900">Send Direct Invite</h3>
        <div className="flex flex-col sm:flex-row gap-3">
          <input
            type="tel"
            value={invitePhone}
            onChange={(e) => setInvitePhone(e.target.value.replace(/[^\d+]/g, ''))}
            placeholder="Farmer's mobile number (+91…)"
            className="flex-1 px-4 py-2.5 text-xs rounded-2xl border border-slate-200 focus:outline-none focus:border-emerald-600"
          />
          <div className="flex bg-slate-100 p-1 rounded-2xl">
            {(['whatsapp', 'sms'] as const).map((ch) => (
              <button
                key={ch}
                onClick={() => setInviteChannel(ch)}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all uppercase ${
                  inviteChannel === ch ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500'
                }`}
              >
                {ch}
              </button>
            ))}
          </div>
          <button
            onClick={handleInvite}
            disabled={inviting}
            className="px-5 py-2.5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md flex items-center justify-center gap-2 disabled:opacity-60"
          >
            <Send className="w-4 h-4" />
            {inviting ? 'Sending…' : 'Send Invite'}
          </button>
        </div>
        {shareLink && (
          <p className="text-[11px] text-slate-400 break-all">
            Share link: <span className="font-mono">{shareLink}</span>
          </p>
        )}
      </div>

      {/* Referred farmers list */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs space-y-3">
        <h3 className="font-bold text-sm text-slate-900">Referred Farmers ({referred.length})</h3>
        {loading ? (
          <p className="text-xs text-slate-400 py-4 text-center animate-pulse">Loading…</p>
        ) : referred.length === 0 ? (
          <p className="text-xs text-slate-400 py-4 text-center">
            No referrals yet. Your joined farmers will appear here with their verification status.
          </p>
        ) : (
          <div className="space-y-2">
            {referred.map((u, i) => {
              const r = asRecord(u);
              return (
                <div key={asStr(r.id ?? r.userId, String(i))} className="p-3.5 bg-slate-50 rounded-2xl border border-slate-100 flex items-center justify-between gap-3 text-xs">
                  <div>
                    <p className="font-bold text-slate-900">{asStr(r.name ?? r.phone, 'Farmer')}</p>
                    <p className="text-[10px] text-slate-400">
                      Joined {asStr(r.joinedAt ?? r.createdAt, '')}
                    </p>
                  </div>
                  <span className={`text-[10px] font-bold px-2 py-1 rounded-lg ${
                    r.verified === true || asStr(r.status) === 'verified'
                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                      : 'bg-amber-50 text-amber-700 border border-amber-200'
                  }`}>
                    {r.verified === true || asStr(r.status) === 'verified' ? 'Coins Credited' : 'Awaiting 7/12 verification'}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
