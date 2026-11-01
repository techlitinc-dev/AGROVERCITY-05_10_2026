import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Search,
  Megaphone,
  Handshake,
  ShieldCheck,
  ShieldAlert,
  ArrowRight,
  RefreshCcw,
  BadgeCheck,
} from 'lucide-react';
import { demands, users, apiErrorMessage } from '../../lib/api';
import { getMyLeads, type Lead } from '../../lib/api/leads';
import { formatCurrency, formatDateTime } from '../../lib/utils';

/**
 * Agri Vyapari home — the simple direct-connect dashboard (spec §4).
 *
 * Two primary actions (Find Produce / Post Requirement), live counters for
 * applications and open requirements, recent connections, and the KYC status.
 * The legacy 23-module directory (POS, khata, mall storefront, procurement,
 * settlements, ads, coins, …) is removed from this surface; its routes
 * redirect home.
 */
export const SellerHome: React.FC = () => {
  const [me, setMe] = useState<{ name?: string; kycStatus?: string; vyapariVerified?: boolean }>({});
  const [myDemands, setMyDemands] = useState<Record<string, unknown>[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const [profile, demandRows, leadRows] = await Promise.all([
        users.getMe().catch(() => ({})),
        demands.list({ status: 'all' }).catch(() => [] as Record<string, unknown>[]),
        getMyLeads('sent').catch(() => [] as Lead[]),
      ]);
      setMe(profile as typeof me);
      setMyDemands(demandRows as Record<string, unknown>[]);
      setLeads(leadRows);
    } catch (e) {
      setError(apiErrorMessage(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const verified = me.kycStatus === 'verified' || Boolean(me.vyapariVerified);
  const activeRequirements = myDemands.filter((d) => d.status === 'open');
  const applications = leads.filter((l) => l.source === 'demand');
  const newApplications = applications.filter((l) => l.status === 'submitted');
  const recentConnections = leads.slice(0, 5);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 flex items-center gap-2">
            <Handshake className="w-7 h-7 text-emerald-600" />
            Namaste{me.name ? `, ${me.name.split(' ')[0]}` : ''} — Agri Vyapari
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Find farmer produce or post a buying requirement — connect directly, deal directly.
          </p>
        </div>
        <button onClick={() => void load()} className="p-2 rounded-xl border border-slate-200 hover:bg-slate-50 self-start" title="Refresh">
          <RefreshCcw className={`w-4 h-4 text-slate-600 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {error && (
        <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-2xl text-xs font-semibold text-rose-800">
          {error}
        </div>
      )}

      {/* Verification status */}
      <div
        className={`p-4 rounded-2xl border text-xs font-semibold flex items-center gap-3 ${
          verified
            ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
            : 'bg-amber-50 border-amber-200 text-amber-800'
        }`}
      >
        {verified ? (
          <>
            <BadgeCheck className="w-5 h-5 shrink-0" />
            <span>
              Identity verified. Farmers see the verified badge on your requirements — verification means
              identity only, not payment or quality guarantees.
            </span>
          </>
        ) : (
          <>
            <ShieldAlert className="w-5 h-5 shrink-0" />
            <span className="flex-1">Complete identity verification (KYC) to post requirements and contact farmers.</span>
            <Link to="/seller/profile" className="px-3 py-1.5 rounded-lg bg-amber-600 text-white font-bold shrink-0">
              Verify Now
            </Link>
          </>
        )}
      </div>

      {/* Primary actions */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Link
          to="/seller/lots"
          className="group p-6 rounded-3xl bg-emerald-600 text-white shadow-md hover:bg-emerald-700 transition-all"
        >
          <Search className="w-8 h-8 mb-3" />
          <h3 className="text-lg font-black">Find Produce</h3>
          <p className="text-xs text-emerald-100 mt-1">
            Browse farmer lots near you. Unlock a farmer's contact with your MPIN and deal directly.
          </p>
          <span className="inline-flex items-center gap-1 text-xs font-bold mt-4 group-hover:gap-2 transition-all">
            Browse lots <ArrowRight className="w-3.5 h-3.5" />
          </span>
        </Link>
        <Link
          to="/seller/demands"
          className="group p-6 rounded-3xl bg-white border-2 border-emerald-600 text-emerald-800 shadow-sm hover:bg-emerald-50 transition-all"
        >
          <Megaphone className="w-8 h-8 mb-3" />
          <h3 className="text-lg font-black">Post Requirement</h3>
          <p className="text-xs text-slate-500 mt-1">
            Tell farmers what you need — crop, quantity, area. Farmers apply; you contact them directly.
          </p>
          <span className="inline-flex items-center gap-1 text-xs font-bold mt-4 group-hover:gap-2 transition-all">
            Post a requirement <ArrowRight className="w-3.5 h-3.5" />
          </span>
        </Link>
      </div>

      {/* Counters */}
      <div className="grid grid-cols-2 gap-4">
        <Link to="/seller/demands" className="p-4 rounded-2xl bg-white border border-slate-200/80 text-center hover:border-emerald-300 transition-all">
          <span className="block text-2xl font-black text-slate-900">
            {loading ? '—' : newApplications.length}
          </span>
          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">
            New Applications
          </span>
        </Link>
        <Link to="/seller/demands" className="p-4 rounded-2xl bg-white border border-slate-200/80 text-center hover:border-emerald-300 transition-all">
          <span className="block text-2xl font-black text-slate-900">
            {loading ? '—' : activeRequirements.length}
          </span>
          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">
            Active Requirements
          </span>
        </Link>
      </div>

      {/* Recent connections */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-sm text-slate-900">Recent Connections</h3>
          <Link to="/seller/connections" className="text-xs font-bold text-emerald-700 hover:underline">
            View All →
          </Link>
        </div>
        {loading ? (
          <div className="py-8 text-center text-xs font-bold text-slate-400 animate-pulse">Loading…</div>
        ) : recentConnections.length === 0 ? (
          <div className="py-8 text-center text-xs font-semibold text-slate-400 bg-white rounded-3xl border border-slate-200/80">
            No connections yet. Find produce or post a requirement to start connecting with farmers.
          </div>
        ) : (
          <div className="space-y-2">
            {recentConnections.map((lead) => (
              <Link
                key={lead.id}
                to="/seller/connections"
                className="flex items-center justify-between p-3.5 bg-white rounded-2xl border border-slate-200/80 hover:border-emerald-300 transition-all text-xs"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <span className="p-2 rounded-xl bg-emerald-50 text-emerald-700 shrink-0">
                    <Handshake className="w-4 h-4" />
                  </span>
                  <div className="min-w-0">
                    <p className="font-bold text-slate-900 truncate">
                      {lead.farmerContact?.fullName || lead.farmerContact?.name || 'Farmer'}
                      <span className="font-semibold text-slate-500"> · {lead.lotCrop || lead.demandCrop}</span>
                    </p>
                    <p className="text-[10px] text-slate-400">{formatDateTime(lead.createdAt)}</p>
                  </div>
                </div>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full border capitalize border-slate-200 bg-slate-50 text-slate-600 shrink-0">
                  {lead.status === 'dealDone' ? 'deal completed' : lead.status}
                </span>
              </Link>
            ))}
          </div>
        )}
      </div>

      <p className="text-[10px] text-slate-400 text-center flex items-center justify-center gap-1.5">
        <ShieldCheck className="w-3.5 h-3.5" />
        Agrovercity only connects the two parties — price, payment, pickup and quality are settled directly
        between you and the farmer. No escrow, no platform payment.
        {applications[0]?.pricePerUnit ? ` Latest quote ${formatCurrency(applications[0].pricePerUnit)}/q.` : ''}
      </p>
    </div>
  );
};
