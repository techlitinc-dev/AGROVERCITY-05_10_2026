import React, { useEffect, useState } from 'react';
import { UserPlus, CheckCircle2, XCircle, MapPin } from 'lucide-react';
import { apiErrorMessage, women } from '../../../lib/api';
import { StatusBadge } from '../../../components/common/StatusBadge';
import { cn, formatDateTime } from '../../../lib/utils';
import { asRecords, pickStr } from '../../shared/records';

/**
 * SHG admin queue — women from the village requesting to join this group.
 * GET /women/shg/join-requests + approve/decline actions.
 */
export const JoinRequestsSection: React.FC = () => {
  const [items, setItems] = useState<Record<string, unknown>[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);

  const load = async () => {
    try {
      const rows = await women.joinRequests();
      setItems(asRecords(rows));
    } catch (err) {
      setItems([]);
      setNotice({ kind: 'err', text: apiErrorMessage(err) });
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const act = async (uid: string, action: 'approve' | 'decline') => {
    if (busy) return;
    setBusy(uid);
    setNotice(null);
    try {
      if (action === 'approve') {
        await women.approveJoinRequest(uid);
      } else {
        await women.declineJoinRequest(uid);
      }
      setNotice({
        kind: 'ok',
        text: action === 'approve' ? 'Member approved — she can now deposit and borrow.' : 'Join request declined.',
      });
      await load();
    } catch (err) {
      setNotice({ kind: 'err', text: apiErrorMessage(err) });
    } finally {
      setBusy(null);
    }
  };

  const pending = (items ?? []).filter((r) => (pickStr(r, 'status') || 'pending') === 'pending');
  const decided = (items ?? []).filter((r) => (pickStr(r, 'status') || 'pending') !== 'pending').slice(0, 5);

  return (
    <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs p-5 space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="font-bold text-xs text-slate-900 flex items-center gap-1.5">
          <UserPlus className="w-4 h-4 text-pink-600" /> Join Requests
        </h4>
        <span className="text-[11px] text-slate-400">{pending.length} pending</span>
      </div>

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
            <XCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          )}
          <span>{notice.text}</span>
        </div>
      )}

      {items === null ? (
        <p className="text-xs text-slate-400">Loading requests…</p>
      ) : pending.length === 0 ? (
        <p className="text-xs text-slate-400">No pending requests — share your group in the village to invite members.</p>
      ) : (
        <div className="space-y-2">
          {pending.map((r, i) => {
            const uid = pickStr(r, 'uid') || String(i);
            return (
              <div key={uid} className="p-3 rounded-2xl border border-slate-100 bg-slate-50/60 space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                  <div>
                    <p className="font-bold text-slate-800">{pickStr(r, 'name') || 'Applicant'}</p>
                    <p className="text-[11px] text-slate-400 flex items-center gap-1">
                      <MapPin className="w-3 h-3" />
                      {pickStr(r, 'village') || 'Village not shared'} ·{' '}
                      {formatDateTime(pickStr(r, 'createdAt')) || '—'}
                    </p>
                  </div>
                  <StatusBadge status="pending" />
                </div>
                {pickStr(r, 'message') && (
                  <p className="text-[11px] text-slate-500 italic border-l-2 border-pink-200 pl-2">
                    “{pickStr(r, 'message')}”
                  </p>
                )}
                <div className="flex gap-2">
                  <button
                    onClick={() => void act(uid, 'approve')}
                    disabled={busy !== null}
                    className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white text-[11px] font-bold rounded-xl"
                  >
                    Approve
                  </button>
                  <button
                    onClick={() => void act(uid, 'decline')}
                    disabled={busy !== null}
                    className="px-3 py-1.5 bg-rose-50 border border-rose-200 text-rose-700 text-[11px] font-bold rounded-xl disabled:opacity-40"
                  >
                    Decline
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {decided.length > 0 && (
        <div className="pt-2 border-t border-slate-100 space-y-1">
          {decided.map((r, i) => (
            <div key={pickStr(r, 'uid') || `d-${i}`} className="flex items-center justify-between text-[11px] text-slate-400">
              <span>{pickStr(r, 'name') || 'Applicant'}</span>
              <StatusBadge status={pickStr(r, 'status') || 'pending'} className="text-[9px] px-1.5" />
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
