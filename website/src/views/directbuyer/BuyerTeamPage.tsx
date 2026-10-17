import React, { useCallback, useEffect, useState } from 'react';
import { Users, UserPlus, RefreshCcw, ShieldCheck, Trash2 } from 'lucide-react';
import { directBuyer, apiErrorMessage } from '../../lib/api';
import { ModalSheet } from '../../components/common/ModalSheet';
import { StatusBadge } from '../../components/common/StatusBadge';
import { formatDateTime } from '../../lib/utils';
import {
  arr,
  cardCls,
  EmptyState,
  ErrorBanner,
  ghostBtnCls,
  inputCls,
  labelCls,
  LoadingBlock,
  primaryBtnCls,
  rec,
  str,
  type Rec,
} from './shared';

const ROLE_HINTS: Record<string, string> = {
  admin: 'Full control — contracts, payments, QC, team',
  procurement: 'Raise demands, negotiate offers, book lots',
  qa: 'Run QC inspections on delivered purchases',
  finance: 'Fund escrow and record payments',
};

/** Buyer org team: roster with RBAC roles + invites. */
export const BuyerTeamPage: React.FC = () => {
  const [org, setOrg] = useState<Rec>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setOrg(rec(await directBuyer.org().catch(() => ({}))));
    } catch (e) {
      setError(apiErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const members = arr(org.members).map(rec);
  const isAdmin = members.find((m) => str(m.role) === 'admin') && true;

  const [inviteModal, setInviteModal] = useState(false);
  const [phone, setPhone] = useState('');
  const [role, setRole] = useState<'procurement' | 'qa' | 'finance' | 'admin'>('procurement');

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 flex items-center gap-2">
            <Users className="w-7 h-7 text-emerald-600" />
            Organisation Team
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            {str(org.companyName, 'Buyer organisation')} — role-based access for procurement, QC and finance actions
          </p>
        </div>
        <div className="flex gap-2 self-start sm:self-auto">
          <button onClick={() => void load()} className={ghostBtnCls}>
            <RefreshCcw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button onClick={() => setInviteModal(true)} className={primaryBtnCls}>
            <UserPlus className="w-4 h-4 inline mr-1" /> Invite Member
          </button>
        </div>
      </div>

      <ErrorBanner message={error ?? actionError} />
      {notice && (
        <div className="p-3 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center gap-2">
          <ShieldCheck className="w-4 h-4" /> {notice}
        </div>
      )}

      {loading ? (
        <LoadingBlock />
      ) : members.length === 0 ? (
        <div className={cardCls}>
          <EmptyState label="No team members yet — invite by registered phone number" />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {members.map((m) => (
            <div key={str(m.uid)} className={`${cardCls} p-5 space-y-2`}>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-bold text-slate-900">
                    {str(m.name, 'Member')}
                    {str(m.uid) === str(org.adminUid) && (
                      <span className="ml-2 text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">ORG ADMIN</span>
                    )}
                  </p>
                  <p className="text-[11px] text-slate-400">{str(m.phone)} · joined {formatDateTime(str(m.addedAt))}</p>
                </div>
                <StatusBadge status={str(m.role, 'member')} />
              </div>
              <p className="text-[11px] text-slate-500">{ROLE_HINTS[str(m.role)] || 'Team member'}</p>
              {str(m.uid) !== str(org.adminUid) && isAdmin && (
                <div className="flex gap-2 pt-1">
                  <button
                    onClick={() => {
                      setActionError(null);
                      directBuyer
                        .removeMember(str(m.uid))
                        .then(() => {
                          setNotice('Member removed');
                          return load();
                        })
                        .catch((err) => setActionError(apiErrorMessage(err)));
                    }}
                    className={`${ghostBtnCls} text-rose-600`}
                  >
                    <Trash2 className="w-3.5 h-3.5 inline mr-1" /> Remove
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <div className={`${cardCls} p-5 space-y-2`}>
        <h3 className="font-bold text-sm text-slate-900">Role Capabilities</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {Object.entries(ROLE_HINTS).map(([r, hint]) => (
            <p key={r} className="text-[11px] text-slate-600 bg-slate-50 rounded-xl px-3 py-2">
              <strong className="capitalize text-slate-800">{r}</strong> — {hint}
            </p>
          ))}
        </div>
      </div>

      <ModalSheet isOpen={inviteModal} onClose={() => setInviteModal(false)} title="Invite Team Member" description="Invitee must be a registered Agrovercity user; matched by phone number" maxWidth="sm">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setActionError(null);
            directBuyer
              .inviteMember({ phone, role })
              .then(() => {
                setNotice('Member invited & added to the roster');
                setInviteModal(false);
                setPhone('');
                return load();
              })
              .catch((err) => setActionError(apiErrorMessage(err)));
          }}
          className="space-y-4"
        >
          <div>
            <label className={labelCls}>Phone Number</label>
            <input className={inputCls} value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+91…" required />
          </div>
          <div>
            <label className={labelCls}>Role</label>
            <select className={inputCls} value={role} onChange={(e) => setRole(e.target.value as typeof role)}>
              <option value="procurement">Procurement</option>
              <option value="qa">Quality (QC)</option>
              <option value="finance">Finance</option>
              <option value="admin">Admin</option>
            </select>
            <p className="text-[11px] text-slate-400 mt-1">{ROLE_HINTS[role]}</p>
          </div>
          <ErrorBanner message={actionError} />
          <button type="submit" className={`${primaryBtnCls} w-full py-3`}>Send Invite</button>
        </form>
      </ModalSheet>
    </div>
  );
};
