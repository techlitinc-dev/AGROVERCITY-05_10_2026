import React, { useEffect, useState } from 'react';
import { Users, Layers, Tractor, Building2, AlertCircle, CheckCircle2, Landmark } from 'lucide-react';
import { apiErrorMessage, fpo } from '../../lib/api';
import { StatCard } from '../../components/common/StatCard';
import { StatusBadge } from '../../components/common/StatusBadge';
import { cn, formatNumber } from '../../lib/utils';
import { asRecord, asRecords, pickNum, pickStr } from '../shared/records';

export const FpoHubView: React.FC = () => {
  const [me, setMe] = useState<Record<string, unknown> | null>(null);
  const [meLoaded, setMeLoaded] = useState(false);
  const [directory, setDirectory] = useState<Record<string, unknown>[]>([]);
  const [pools, setPools] = useState<Record<string, unknown>[]>([]);
  const [machinery, setMachinery] = useState<Record<string, unknown>[]>([]);
  const [joinedPools, setJoinedPools] = useState<Set<string>>(new Set());
  const [busyId, setBusyId] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      const [m, d, p, mac] = await Promise.all([
        fpo.me().catch(() => null),
        fpo.directory().catch(() => []),
        fpo.pools().catch(() => []),
        fpo.machinery().catch(() => []),
      ]);
      if (!alive) return;
      setMe(m ? asRecord(m) : null);
      setMeLoaded(true);
      setDirectory(asRecords(d));
      setPools(asRecords(p));
      setMachinery(asRecords(mac));
    };
    void load();
    return () => {
      alive = false;
    };
  }, []);

  const flash = (kind: 'ok' | 'err', text: string) => {
    setNotice({ kind, text });
    window.setTimeout(() => setNotice(null), 4000);
  };

  const handleJoinRequest = async (fpoId: string, name: string) => {
    if (busyId) return;
    setBusyId(fpoId);
    try {
      await fpo.joinRequest(fpoId);
      flash('ok', `Join request sent to ${name}. The FPO board reviews requests within 48 hours.`);
    } catch (err) {
      flash('err', apiErrorMessage(err));
    } finally {
      setBusyId(null);
    }
  };

  const handleJoinPool = async (poolId: string, title: string) => {
    if (busyId) return;
    setBusyId(poolId);
    try {
      await fpo.joinPool(poolId);
      setJoinedPools((prev) => new Set(prev).add(poolId));
      flash('ok', `Joined "${title}". Pool coordinator will contact you with aggregation details.`);
    } catch (err) {
      flash('err', apiErrorMessage(err));
    } finally {
      setBusyId(null);
    }
  };

  const memberCount = pickNum(me ?? {}, 'members', 'memberCount', 'totalMembers');

  return (
    <div className="space-y-6">
      <div className="border-b border-slate-200 pb-4">
        <h1 className="text-2xl font-extrabold text-slate-900 flex items-center gap-2">
          <Users className="w-7 h-7 text-emerald-600" />
          Farmer Producer Organizations (FPO) & Collective Buying
        </h1>
        <p className="text-xs text-slate-500 mt-1">
          Pool your input purchases for wholesale factory pricing and aggregate harvests for institutional export contracts
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

      {/* My FPO membership */}
      {me && Object.keys(me).length > 0 ? (
        <div className="bg-gradient-to-r from-emerald-800 to-teal-900 rounded-3xl p-6 text-white shadow-md flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-300">
              My FPO Membership
            </span>
            <h3 className="font-extrabold text-lg mt-0.5">
              {pickStr(me, 'name', 'fpoName') || 'My FPO'}
            </h3>
            <p className="text-xs text-emerald-200 mt-1">
              {pickStr(me, 'district') || '—'}, {pickStr(me, 'state') || '—'} · Member since{' '}
              {pickStr(me, 'joinedAt', 'memberSince') || '—'}
            </p>
          </div>
          <div className="flex items-center gap-6 text-center">
            <div>
              <p className="text-xl font-black">{formatNumber(memberCount)}</p>
              <p className="text-[10px] uppercase font-bold text-emerald-300">Members</p>
            </div>
            <div>
              <p className="text-xl font-black">{pickStr(me, 'myRole', 'role') || 'Member'}</p>
              <p className="text-[10px] uppercase font-bold text-emerald-300">My Role</p>
            </div>
          </div>
        </div>
      ) : (
        meLoaded && (
          <div className="bg-white rounded-3xl border border-dashed border-slate-300 p-6 text-center">
            <Landmark className="w-8 h-8 text-slate-300 mx-auto mb-2" />
            <p className="text-xs text-slate-500">
              You are not an FPO member yet — browse the directory below and send a join request.
            </p>
          </div>
        )
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          title="Active FPO Pools"
          value={`${pools.length} Pools`}
          subtitle="Collective fertilizer & onion aggregation"
          icon={Layers}
          colorScheme="green"
        />
        <StatCard
          title="FPOs in Directory"
          value={`${directory.length} FPOs`}
          subtitle="Registered producer companies nearby"
          icon={Building2}
          colorScheme="blue"
        />
        <StatCard
          title="Machinery on Hire"
          value={`${machinery.length} Machines`}
          subtitle="FPO-owned custom hiring centres"
          icon={Tractor}
          colorScheme="amber"
        />
      </div>

      {/* Live pools */}
      <div className="space-y-4">
        <h3 className="font-bold text-sm text-slate-900">Live Collective FPO Pools</h3>
        {pools.length === 0 && (
          <p className="text-xs text-slate-400 bg-white rounded-3xl border border-slate-200/80 p-6 text-center">
            No active pools right now — new group buys open at the start of each sowing window.
          </p>
        )}
        <div className="space-y-3">
          {pools.map((p, i) => {
            const id = pickStr(p, 'id', 'poolId') || String(i);
            const joined = joinedPools.has(id);
            return (
              <div
                key={id}
                className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4"
              >
                <div>
                  <span className="text-[10px] font-bold uppercase text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                    {pickStr(p, 'fpoName', 'fpo') || 'FPO Pool'}
                  </span>
                  <h4 className="font-extrabold text-base text-slate-900 mt-1">
                    {pickStr(p, 'title', 'commodity') || 'Collective pool'}
                  </h4>
                  <p className="text-xs font-bold text-emerald-700 mt-0.5">
                    {pickStr(p, 'savings', 'benefit', 'description') || 'Bulk pricing available'}
                  </p>
                  <p className="text-xs text-slate-400 mt-1 flex items-center gap-2">
                    {formatNumber(pickNum(p, 'members', 'memberCount'))} farmers participating
                    <StatusBadge status={pickStr(p, 'status') || 'open'} />
                  </p>
                </div>
                <button
                  onClick={() => void handleJoinPool(id, pickStr(p, 'title', 'commodity') || 'pool')}
                  disabled={busyId === id || joined}
                  className={cn(
                    'px-5 py-2.5 font-bold text-xs rounded-xl shadow-xs self-start sm:self-auto transition-colors disabled:opacity-60',
                    joined
                      ? 'bg-emerald-50 border border-emerald-200 text-emerald-700'
                      : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                  )}
                >
                  {joined ? '✓ Joined' : 'Join Collective Pool'}
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* Machinery */}
      {machinery.length > 0 && (
        <div className="space-y-4">
          <h3 className="font-bold text-sm text-slate-900">FPO Custom Hiring Centre — Machinery</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {machinery.map((m, i) => (
              <div key={pickStr(m, 'id') || i} className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-xs space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-sm text-slate-900">
                    {pickStr(m, 'name', 'machine') || 'Machine'}
                  </h4>
                  <StatusBadge status={pickStr(m, 'status', 'availability') || 'available'} />
                </div>
                <p className="text-xs text-slate-500">
                  {pickStr(m, 'fpoName', 'fpo') || 'FPO'} · {pickStr(m, 'location') || '—'}
                </p>
                <p className="text-xs font-black text-emerald-700">
                  {pickStr(m, 'rate', 'ratePerHour', 'rateText') || 'Rate on request'}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Directory */}
      <div className="space-y-4">
        <h3 className="font-bold text-sm text-slate-900">FPO Directory — Join a Producer Company</h3>
        {directory.length === 0 && (
          <p className="text-xs text-slate-400 bg-white rounded-3xl border border-slate-200/80 p-6 text-center">
            Directory is being onboarded for your district.
          </p>
        )}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {directory.map((d, i) => {
            const id = pickStr(d, 'id', 'fpoId') || String(i);
            return (
              <div key={id} className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-xs space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h4 className="font-bold text-sm text-slate-900">
                      {pickStr(d, 'name', 'fpoName') || 'Producer Company'}
                    </h4>
                    <p className="text-[11px] text-slate-400">
                      {pickStr(d, 'district') || '—'}, {pickStr(d, 'state') || '—'} · Est.{' '}
                      {pickStr(d, 'establishedYear', 'founded') || '—'}
                    </p>
                  </div>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-sky-50 text-sky-700 border border-sky-200">
                    {formatNumber(pickNum(d, 'members', 'memberCount'))} members
                  </span>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed">
                  {pickStr(d, 'focus', 'specialization', 'description') ||
                    'Input aggregation, custom hiring, and collective marketing.'}
                </p>
                <button
                  onClick={() =>
                    void handleJoinRequest(id, pickStr(d, 'name', 'fpoName') || 'this FPO')
                  }
                  disabled={busyId === id}
                  className="w-full px-4 py-2 bg-sky-600 hover:bg-sky-700 disabled:opacity-40 text-white font-bold text-xs rounded-xl shadow-xs transition-colors"
                >
                  {busyId === id ? 'Sending…' : 'Send Join Request'}
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
