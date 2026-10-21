import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Heart,
  Search,
  MapPin,
  Users,
  PiggyBank,
  HandCoins,
  CalendarDays,
  BadgeCheck,
  X,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';
import { apiErrorMessage, women } from '../../lib/api';
import { useAuthStore } from '../../stores/authStore';
import { formatDate, formatNumber, formatPaisa } from '../../lib/utils';
import { asRecord, asRecords, bool, pick, pickNum, pickStr } from '../shared/records';

/**
 * Bachat Gat directory — farmer-facing SHG discovery page.
 * Search groups by name / village / district and request to join.
 */
export const DirectoryView: React.FC = () => {
  const { isAuthenticated } = useAuthStore();
  const [q, setQ] = useState('');
  const [village, setVillage] = useState('');
  const [district, setDistrict] = useState('');
  const [items, setItems] = useState<Record<string, unknown>[] | null>(null);
  const [myGroupName, setMyGroupName] = useState<string | null>(null);
  const [modalFor, setModalFor] = useState<Record<string, unknown> | null>(null);
  const [message, setMessage] = useState('');
  const [requestedIds, setRequestedIds] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const search = async () => {
    setBusy(true);
    setError(null);
    try {
      const rows = await women.directory({
        q: q.trim() || undefined,
        village: village.trim() || undefined,
        district: district.trim() || undefined,
      });
      setItems(asRecords(rows));
    } catch (err) {
      setError(apiErrorMessage(err));
      setItems([]);
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    void search();
    // Detect an existing membership for the top banner (404 / no group → skip).
    women
      .shg()
      .then((res) => {
        const group = asRecord(pick(asRecord(res), 'group'));
        if (Object.keys(group).length > 0) setMyGroupName(pickStr(group, 'name') || 'your SHG');
      })
      .catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const requestJoin = async () => {
    if (!modalFor || busy) return;
    const shgId = pickStr(modalFor, 'id');
    if (!shgId) return;
    setBusy(true);
    setError(null);
    try {
      await women.createJoinRequest({ shgId, message: message.trim() || undefined });
      setRequestedIds((prev) => new Set(prev).add(shgId));
      setModalFor(null);
      setMessage('');
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="border-b border-slate-200 pb-4">
        <h1 className="text-2xl font-extrabold text-slate-900 flex items-center gap-2">
          <Heart className="w-7 h-7 text-pink-600" />
          Mahila Bachat Gat Directory
        </h1>
        <p className="text-xs text-slate-500 mt-1">
          Find a Self-Help Group in your village — pool monthly savings, borrow interest-free from
          the group fund, and sell together on the Krishi Mall.
        </p>
      </div>

      {myGroupName && (
        <Link
          to="/community/women"
          className="flex items-center justify-between gap-3 bg-emerald-50 border border-emerald-200 rounded-2xl p-4 hover:border-emerald-400 transition-colors"
        >
          <div className="flex items-center gap-2 text-xs font-bold text-emerald-900">
            <BadgeCheck className="w-4 h-4 text-emerald-600" />
            You are a member of {myGroupName}
          </div>
          <span className="text-[11px] font-bold text-emerald-700">Open your hub →</span>
        </Link>
      )}

      {error && (
        <div className="rounded-2xl border p-3 text-xs flex items-start gap-2 bg-rose-50 border-rose-200 text-rose-800">
          <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {/* Search */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs p-5">
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
          <input
            type="text"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && void search()}
            placeholder="Group name…"
            className="px-3 py-2.5 text-xs rounded-xl border border-slate-300 focus:outline-none focus:border-pink-600"
          />
          <input
            type="text"
            value={village}
            onChange={(e) => setVillage(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && void search()}
            placeholder="Village"
            className="px-3 py-2.5 text-xs rounded-xl border border-slate-300 focus:outline-none focus:border-pink-600"
          />
          <input
            type="text"
            value={district}
            onChange={(e) => setDistrict(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && void search()}
            placeholder="District"
            className="px-3 py-2.5 text-xs rounded-xl border border-slate-300 focus:outline-none focus:border-pink-600"
          />
          <button
            onClick={() => void search()}
            disabled={busy}
            className="px-4 py-2.5 bg-pink-600 hover:bg-pink-700 disabled:opacity-40 text-white font-bold text-xs rounded-xl shadow-xs flex items-center justify-center gap-1.5"
          >
            <Search className="w-3.5 h-3.5" /> {busy ? 'Searching…' : 'Search'}
          </button>
        </div>
      </div>

      {/* Results */}
      {items === null ? (
        <p className="text-xs text-slate-400">Loading groups…</p>
      ) : items.length === 0 ? (
        <p className="text-xs text-slate-400 bg-white rounded-3xl border border-slate-200/80 p-8 text-center">
          No Bachat Gat found for this search — try a nearby village or district name.
        </p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {items.map((g, i) => {
            const id = pickStr(g, 'id') || String(i);
            const name = pickStr(g, 'name') || 'SHG';
            const status = requestedIds.has(id)
              ? 'pending'
              : (pickStr(g, 'myRequestStatus') || 'none');
            const verified = bool(pick(g, 'verified'));
            return (
              <div key={id} className="bg-white rounded-3xl border border-slate-200/80 shadow-xs p-5 space-y-3 flex flex-col">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="font-bold text-sm text-slate-900">{name}</h3>
                    <p className="text-[11px] text-slate-400 flex items-center gap-1 mt-0.5">
                      <MapPin className="w-3 h-3" />
                      {[pickStr(g, 'village'), pickStr(g, 'district')].filter(Boolean).join(' • ') || 'Location not set'}
                    </p>
                  </div>
                  {verified && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-[10px] font-bold text-emerald-700 flex-shrink-0">
                      <BadgeCheck className="w-3 h-3" /> Verified
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-2 text-[11px]">
                  <span className="flex items-center gap-1.5 text-slate-500">
                    <Users className="w-3.5 h-3.5 text-slate-400" />
                    {formatNumber(pickNum(g, 'memberCount'))} members
                  </span>
                  <span className="flex items-center gap-1.5 text-slate-500">
                    <CalendarDays className="w-3.5 h-3.5 text-slate-400" />
                    Formed {formatDate(pickStr(g, 'formedAt')) || '—'}
                  </span>
                  <span className="flex items-center gap-1.5 text-slate-700 font-bold">
                    <PiggyBank className="w-3.5 h-3.5 text-pink-500" />
                    Corpus {formatPaisa(pickNum(g, 'corpusPaisa'))}
                  </span>
                  <span className="flex items-center gap-1.5 text-slate-700 font-bold">
                    <HandCoins className="w-3.5 h-3.5 text-amber-500" />
                    Fund {formatPaisa(pickNum(g, 'loanFundPaisa'))}
                  </span>
                </div>
                <p className="text-[11px] text-slate-400">
                  Monthly deposit {formatPaisa(pickNum(g, 'monthlyDepositPaisa'))}
                </p>

                <div className="pt-1 mt-auto">
                  {!isAuthenticated ? (
                    <Link
                      to="/login"
                      className="block text-center px-4 py-2 bg-pink-600 hover:bg-pink-700 text-white font-bold text-xs rounded-xl"
                    >
                      Login to request join
                    </Link>
                  ) : status === 'none' ? (
                    <button
                      onClick={() => setModalFor(g)}
                      className="w-full px-4 py-2 bg-pink-600 hover:bg-pink-700 text-white font-bold text-xs rounded-xl"
                    >
                      Request to join
                    </button>
                  ) : status === 'pending' ? (
                    <button
                      disabled
                      className="w-full px-4 py-2 bg-slate-100 text-slate-400 font-bold text-xs rounded-xl disabled:opacity-60"
                    >
                      Requested
                    </button>
                  ) : status === 'approved' ? (
                    <Link
                      to="/community/women"
                      className="block text-center px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl"
                    >
                      Member — open hub
                    </Link>
                  ) : (
                    <button
                      disabled
                      className="w-full px-4 py-2 bg-rose-50 border border-rose-200 text-rose-400 font-bold text-xs rounded-xl disabled:opacity-60"
                    >
                      Declined
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Join request modal */}
      {modalFor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/40" onClick={() => setModalFor(null)} />
          <div className="relative bg-white rounded-3xl border border-slate-200 shadow-xl w-full max-w-md p-5 space-y-3">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h3 className="font-bold text-sm text-slate-900">Request to join {pickStr(modalFor, 'name')}</h3>
                <p className="text-[11px] text-slate-400">
                  The group admin reviews requests — you will be notified on approval.
                </p>
              </div>
              <button onClick={() => setModalFor(null)} className="text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={3}
              placeholder="Introduce yourself (optional) — village, what you grow or make…"
              className="w-full px-3 py-2.5 text-xs rounded-xl border border-slate-300 focus:outline-none focus:border-pink-600"
            />
            <div className="flex gap-2">
              <button
                onClick={() => void requestJoin()}
                disabled={busy}
                className="flex-1 px-4 py-2.5 bg-pink-600 hover:bg-pink-700 disabled:opacity-40 text-white font-bold text-xs rounded-xl"
              >
                {busy ? 'Sending…' : 'Send request'}
              </button>
              <button
                onClick={() => setModalFor(null)}
                className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl"
              >
                Cancel
              </button>
            </div>
            {!error && (
              <p className="text-[10px] text-slate-300 flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" /> One request per group; you can withdraw later.
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
