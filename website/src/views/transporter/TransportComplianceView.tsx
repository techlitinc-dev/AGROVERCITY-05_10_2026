import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Check, RefreshCw, ShieldAlert, Star, X } from 'lucide-react';
import { transport, apiErrorMessage } from '../../lib/api';
import { StatCard } from '../../components/common/StatCard';
import { StatusBadge } from '../../components/common/StatusBadge';
import { formatCurrency } from '../../lib/utils';
import { asArr, asRec, firstNum, firstStr, fmtDate, str, type Rec } from './utils';

/** /transporter/compliance — strikes, cooldowns, penalty matrix, received ratings. */
export const TransportComplianceView: React.FC = () => {
  const [compliance, setCompliance] = useState<Rec>({});
  const [ratings, setRatings] = useState<Rec[]>([]);
  const [aggregate, setAggregate] = useState<Rec>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [c, r] = await Promise.all([transport.compliance(), transport.ratings().catch(() => [] as unknown[])]);
      const rec = asRec(c);
      setCompliance(rec);
      setRatings(asArr(r).map(asRec));
      setAggregate(asRec(asRec(c).aggregate));
    } catch (e) {
      setError(apiErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const strikes = asArr(compliance.strikes).map(asRec);
  const strikeCount = firstNum(compliance, ['strikeCount'], strikes.length);
  const noShowStrikes = firstNum(compliance, ['noShowStrikes'], 0);
  const cooldowns = asRec(compliance.cooldowns);
  const penalty = asRec(compliance.penaltyMatrix);
  const average = firstNum(aggregate, ['average'], 0);
  const ratingCount = firstNum(aggregate, ['count'], ratings.length);
  const tags = asRec(aggregate.tags);
  const strikesToSuspend = firstNum(penalty, ['strikesToSuspend'], 3);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <Link to="/transporter" className="text-xs text-slate-400 hover:text-slate-600 flex items-center gap-1 mb-1">
            <ArrowLeft className="w-3.5 h-3.5" /> Transporter Home
          </Link>
          <h1 className="text-2xl font-extrabold text-slate-900 flex items-center gap-2">
            <ShieldAlert className="w-7 h-7 text-emerald-600" />
            Compliance & Ratings
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Strike ledger, active restrictions, the enforced penalty matrix, and ratings received from shippers
          </p>
        </div>
        <button
          onClick={load}
          className="p-2.5 rounded-2xl border border-slate-200 text-slate-500 hover:bg-slate-50 self-start sm:self-auto"
          title="Refresh"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl text-xs font-bold text-rose-800 flex items-center justify-between gap-2">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="p-1 hover:bg-rose-100 rounded-full">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatCard
          title="Strikes"
          value={strikeCount}
          subtitle={`${noShowStrikes} no-show • ${strikesToSuspend} = suspension`}
          icon={ShieldAlert}
          colorScheme={strikeCount > 0 ? 'amber' : 'green'}
        />
        <StatCard
          title="Load Board"
          value={cooldowns.loadBoardSuspended ? 'SUSPENDED' : 'Active'}
          subtitle={cooldowns.suspended ? 'Account suspended' : cooldowns.bookingRestricted ? 'Bookings restricted' : 'No restrictions'}
          icon={Check}
          colorScheme={cooldowns.loadBoardSuspended || cooldowns.bookingRestricted || cooldowns.suspended ? 'slate' : 'green'}
        />
        <StatCard
          title="Average Rating"
          value={average > 0 ? `${average}★` : '—'}
          subtitle={`${ratingCount} rating(s) received`}
          icon={Star}
          colorScheme="blue"
        />
        <StatCard
          title="Chat Restriction"
          value={str(cooldowns.chatMutedUntil, '') !== '—' ? 'Muted' : 'Open'}
          subtitle={str(cooldowns.chatMutedUntil, '') !== '—' ? `until ${fmtDate(cooldowns.chatMutedUntil)}` : 'Abuse filter inactive'}
          icon={ShieldAlert}
          colorScheme={str(cooldowns.chatMutedUntil, '') !== '—' ? 'slate' : 'green'}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Strike ledger */}
        <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs space-y-3">
          <h3 className="font-bold text-sm text-slate-900">Strike Ledger</h3>
          {strikes.length === 0 ? (
            <p className="text-xs text-slate-400 text-center py-6">
              {loading ? 'Loading…' : 'Clean record — no strikes. Keep documents current and honour pickup windows.'}
            </p>
          ) : (
            <div className="space-y-2">
              {strikes.map((s) => (
                <div key={str(s.id) || JSON.stringify(s).slice(0, 24)} className="p-3 bg-slate-50 rounded-2xl text-xs flex items-center justify-between gap-2">
                  <div>
                    <p className="font-bold text-slate-800">{firstStr(s, ['reason', 'kind', 'label'], 'Strike')}</p>
                    <p className="text-slate-400">{fmtDate(s.at ?? s.createdAt)} {str(s.bookingId, '') !== '—' ? `• ${str(s.bookingId)}` : ''}</p>
                  </div>
                  <StatusBadge status="strike" />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Penalty matrix */}
        <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs space-y-3">
          <h3 className="font-bold text-sm text-slate-900">Enforced Penalty Matrix</h3>
          {Object.keys(penalty).length === 0 ? (
            <p className="text-xs text-slate-400 text-center py-6">Penalty config unavailable.</p>
          ) : (
            <div className="space-y-2">
              {[
                ['cancelWindowHours', 'Cancel window', (v: number) => `${v} h before pickup`],
                ['strikesToSuspend', 'Strikes to suspend', (v: number) => `${v} strikes`],
                ['farmerCancelPenaltyPct', 'Farmer cancel <24h', (v: number) => `${v}% of fare`],
                ['farmerLateCancelPenaltyPct', 'Farmer cancel <2h', (v: number) => `${v}% of fare`],
                ['transporterCompensationPct', 'Your compensation share', (v: number) => `${v}% of penalty`],
              ].map(([key, label, fmt]) => {
                const value = firstNum(penalty, [key as string], -1);
                if (value < 0) return null;
                return (
                  <div key={key as string} className="flex justify-between p-3 bg-slate-50 rounded-2xl text-xs">
                    <span className="text-slate-500">{label as string}</span>
                    <span className="font-bold text-slate-900">{(fmt as (v: number) => string)(value)}</span>
                  </div>
                );
              })}
              {str(penalty.transporterCancelInsideWindow, '') !== '—' && (
                <p className="text-[11px] text-slate-500">
                  Transporter cancel inside window: <span className="font-bold">{str(penalty.transporterCancelInsideWindow)}</span>
                </p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Ratings received */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-sm text-slate-900">Ratings Received</h3>
          {Object.keys(tags).length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {Object.entries(tags).map(([tag, count]) => (
                <span key={tag} className="px-2.5 py-1 bg-slate-100 text-slate-600 rounded-full text-[10px] font-bold">
                  {tag.replace(/_/g, ' ')} ×{String(count)}
                </span>
              ))}
            </div>
          )}
        </div>
        {ratings.length === 0 && !loading ? (
          <p className="text-xs text-slate-400 text-center py-6">No ratings yet — they appear after delivered trips.</p>
        ) : (
          <div className="space-y-2">
            {ratings.map((r) => {
              const stars = firstNum(r, ['stars'], 0);
              const reviewTags = Array.isArray(r.tags) ? (r.tags as unknown[]) : [];
              return (
                <div key={str(r.id) || JSON.stringify(r).slice(0, 24)} className="p-3 bg-slate-50 rounded-2xl text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <p className="font-bold text-slate-800">
                      {'★'.repeat(Math.max(0, Math.min(5, stars)))}
                      <span className="text-slate-300">{'★'.repeat(5 - Math.max(0, Math.min(5, stars)))}</span>{' '}
                      {str(r.comment, '') !== '—' ? <span className="font-medium text-slate-600">“{str(r.comment)}”</span> : null}
                    </p>
                    {reviewTags.length > 0 && (
                      <p className="text-slate-400 mt-0.5">{reviewTags.map((t) => String(t).replace(/_/g, ' ')).join(' • ')}</p>
                    )}
                  </div>
                  <span className="text-slate-400">{fmtDate(r.createdAt)}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
