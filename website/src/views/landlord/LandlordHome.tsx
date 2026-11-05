import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Home,
  Plus,
  FileCheck,
  Handshake,
  BadgeCheck,
  ShieldAlert,
  ArrowRight,
  RefreshCcw,
  Mountain,
} from 'lucide-react';
import { land, users } from '../../lib/api';
import { formatDateTime } from '../../lib/utils';

interface ListingRow {
  id: string;
  village: string;
  areaAcres: number;
  status?: string;
}

interface RequestRow {
  id: string;
  farmerName?: string;
  listingVillage?: string;
  createdAt?: string;
}

/** Landlord home — the simple direct-connect dashboard (spec §4): active
 * listing count, new interest requests, recent connections, quick actions,
 * KYC status. Rent collection, settlements, profit and lease-management
 * screens were removed from this surface. */
export const LandlordHome: React.FC = () => {
  const [me, setMe] = useState<{ name?: string; kycStatus?: string }>({});
  const [listings, setListings] = useState<ListingRow[]>([]);
  const [pending, setPending] = useState<RequestRow[]>([]);
  const [connections, setConnections] = useState<RequestRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const [profile, mine, pendingRows, allRows] = await Promise.all([
        users.getMe().catch(() => ({})),
        land.myListings().catch(() => []),
        land.leaseRequests({ status: 'pending' }).catch(() => []),
        land.leaseRequests().catch(() => []),
      ]);
      setMe(profile as typeof me);
      setListings(mine as unknown as ListingRow[]);
      setPending(pendingRows as unknown as RequestRow[]);
      const conns = (allRows as unknown as RequestRow[]).filter(
        (r) => (r as { status?: string }).status && (r as { status?: string }).status !== 'pending',
      );
      setConnections(conns);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const verified = me.kycStatus === 'verified';
  const activeListings = listings.filter((l) => l.status === 'open');

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 flex items-center gap-2">
            <Home className="w-7 h-7 text-emerald-600" />
            Namaste{me.name ? `, ${me.name.split(' ')[0]}` : ''} — Farm Landlord
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            List farmland, review farmer interest, and connect directly. Agrovercity never holds rent or deposits.
          </p>
        </div>
        <button onClick={() => void load()} className="p-2.5 rounded-2xl border border-slate-200 hover:bg-slate-50 self-start" title="Refresh">
          <RefreshCcw className={`w-4 h-4 text-slate-600 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      <div
        className={`p-4 rounded-2xl border text-xs font-semibold flex items-center gap-3 ${
          verified ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-amber-50 border-amber-200 text-amber-800'
        }`}
      >
        {verified ? (
          <>
            <BadgeCheck className="w-5 h-5 shrink-0" />
            <span>Identity verified — farmers see the verified badge on your listings.</span>
          </>
        ) : (
          <>
            <ShieldAlert className="w-5 h-5 shrink-0" />
            <span className="flex-1">Complete identity verification (KYC) to list farmland and accept contact requests.</span>
            <Link to="/profile" className="px-3 py-1.5 rounded-lg bg-amber-600 text-white font-bold shrink-0">Verify Now</Link>
          </>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Link to="/landlord/listings" className="group p-6 rounded-3xl bg-emerald-600 text-white shadow-md hover:bg-emerald-700 transition-all">
          <Plus className="w-8 h-8 mb-3" />
          <h3 className="text-lg font-black">Add Land</h3>
          <p className="text-xs text-emerald-100 mt-1">List farmland with rent, availability and an optional farm land photo.</p>
          <span className="inline-flex items-center gap-1 text-xs font-bold mt-4 group-hover:gap-2 transition-all">
            My Land Listings <ArrowRight className="w-3.5 h-3.5" />
          </span>
        </Link>
        <Link to="/landlord/requests" className="group p-6 rounded-3xl bg-white border-2 border-emerald-600 text-emerald-800 shadow-sm hover:bg-emerald-50 transition-all">
          <FileCheck className="w-8 h-8 mb-3" />
          <h3 className="text-lg font-black">View Requests</h3>
          <p className="text-xs text-slate-500 mt-1">
            {loading ? '…' : `${pending.length} pending`} — accept contact requests to connect with farmers.
          </p>
          <span className="inline-flex items-center gap-1 text-xs font-bold mt-4 group-hover:gap-2 transition-all">
            Interest Requests <ArrowRight className="w-3.5 h-3.5" />
          </span>
        </Link>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <Link to="/landlord/listings" className="p-4 rounded-2xl bg-white border border-slate-200/80 text-center hover:border-emerald-300 transition-all">
          <span className="block text-2xl font-black text-slate-900">{loading ? '—' : activeListings.length}</span>
          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">Active Listings</span>
        </Link>
        <Link to="/landlord/requests" className="p-4 rounded-2xl bg-white border border-slate-200/80 text-center hover:border-emerald-300 transition-all">
          <span className="block text-2xl font-black text-slate-900">{loading ? '—' : pending.length}</span>
          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">New Interest</span>
        </Link>
        <Link to="/landlord/connections" className="p-4 rounded-2xl bg-white border border-slate-200/80 text-center hover:border-emerald-300 transition-all">
          <span className="block text-2xl font-black text-slate-900">{loading ? '—' : connections.length}</span>
          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">Connections</span>
        </Link>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
            <Handshake className="w-4 h-4 text-emerald-600" /> Recent Connections
          </h3>
          <Link to="/landlord/connections" className="text-xs font-bold text-emerald-700 hover:underline">View All →</Link>
        </div>
        {loading ? (
          <div className="py-6 text-center text-xs font-bold text-slate-400 animate-pulse">Loading…</div>
        ) : connections.length === 0 ? (
          <div className="py-8 text-center text-xs font-semibold text-slate-400 bg-white rounded-3xl border border-slate-200/80">
            No connections yet — accept a contact request to start.
          </div>
        ) : (
          <div className="space-y-2">
            {connections.slice(0, 5).map((c) => (
              <Link key={c.id} to="/landlord/connections" className="flex items-center justify-between p-3.5 bg-white rounded-2xl border border-slate-200/80 hover:border-emerald-300 transition-all text-xs">
                <div className="min-w-0">
                  <p className="font-bold text-slate-900 truncate">
                    {c.farmerName || 'Farmer'} · {c.listingVillage || 'Farmland'}
                  </p>
                  <p className="text-[10px] text-slate-400">{formatDateTime(c.createdAt ?? '')}</p>
                </div>
                <Mountain className="w-4 h-4 text-emerald-600 shrink-0" />
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
