import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Wrench,
  Plus,
  FileCheck,
  Briefcase,
  CalendarDays,
  BadgeCheck,
  ShieldAlert,
  ArrowRight,
  RefreshCcw,
} from 'lucide-react';
import { equipmentOwner, users } from '../../lib/api';
import { formatDateTime } from '../../lib/utils';

interface RequestRow {
  id: string;
  farmerName?: string;
  equipmentName?: string;
  date?: string;
  slotName?: string;
  workType?: string;
  createdAt?: string;
}

interface FleetRow {
  equipmentId: string;
  name: string;
  docStatus?: string;
}

/** Equipment Owner home — the simple direct-connect dashboard (spec §4):
 * pending requests, upcoming jobs, availability summary, quick actions,
 * KYC status. Wallet/settlement/payout/commission surfaces were removed. */
export const EquipmentOwnerHome: React.FC = () => {
  const [me, setMe] = useState<{ name?: string; kycStatus?: string; vyapariVerified?: boolean }>({});
  const [pending, setPending] = useState<RequestRow[]>([]);
  const [upcoming, setUpcoming] = useState<RequestRow[]>([]);
  const [fleet, setFleet] = useState<FleetRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const [profile, pendingRows, upcomingRows, fleetRows] = await Promise.all([
        users.getMe().catch(() => ({})),
        equipmentOwner.ownerRequests('pending').catch(() => []),
        equipmentOwner.ownerRequests('upcoming').catch(() => []),
        equipmentOwner.fleet().catch(() => []),
      ]);
      setMe(profile as typeof me);
      setPending(pendingRows as unknown as RequestRow[]);
      setUpcoming(upcomingRows as unknown as RequestRow[]);
      setFleet(fleetRows as unknown as FleetRow[]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const verified = me.kycStatus === 'verified' || Boolean(me.vyapariVerified);
  const verifiedMachines = fleet.filter((f) => f.docStatus === 'verified').length;
  const reviewMachines = fleet.filter((f) => f.docStatus !== 'verified').length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 flex items-center gap-2">
            <Wrench className="w-7 h-7 text-emerald-600" />
            Namaste{me.name ? `, ${me.name.split(' ')[0]}` : ''} — Equipment Owner
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            List your machines, accept farmer requests, and connect directly. No platform payments.
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
            <span className="flex-1">Complete identity verification (KYC) to list equipment and accept requests.</span>
            <Link to="/profile" className="px-3 py-1.5 rounded-lg bg-amber-600 text-white font-bold shrink-0">Verify Now</Link>
          </>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Link to="/equipment/machines" className="group p-6 rounded-3xl bg-emerald-600 text-white shadow-md hover:bg-emerald-700 transition-all">
          <Plus className="w-8 h-8 mb-3" />
          <h3 className="text-lg font-black">Add Equipment</h3>
          <p className="text-xs text-emerald-100 mt-1">List a machine with pricing, operator option and photos.</p>
          <span className="inline-flex items-center gap-1 text-xs font-bold mt-4 group-hover:gap-2 transition-all">
            My Equipment <ArrowRight className="w-3.5 h-3.5" />
          </span>
        </Link>
        <Link to="/equipment/requests" className="group p-6 rounded-3xl bg-white border-2 border-emerald-600 text-emerald-800 shadow-sm hover:bg-emerald-50 transition-all">
          <FileCheck className="w-8 h-8 mb-3" />
          <h3 className="text-lg font-black">View Requests</h3>
          <p className="text-xs text-slate-500 mt-1">
            {loading ? '…' : `${pending.length} pending`} — accept with your MPIN to share contacts.
          </p>
          <span className="inline-flex items-center gap-1 text-xs font-bold mt-4 group-hover:gap-2 transition-all">
            Booking Requests <ArrowRight className="w-3.5 h-3.5" />
          </span>
        </Link>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <Link to="/equipment/requests" className="p-4 rounded-2xl bg-white border border-slate-200/80 text-center hover:border-emerald-300 transition-all">
          <span className="block text-2xl font-black text-slate-900">{loading ? '—' : pending.length}</span>
          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">Pending Requests</span>
        </Link>
        <Link to="/equipment/jobs" className="p-4 rounded-2xl bg-white border border-slate-200/80 text-center hover:border-emerald-300 transition-all">
          <span className="block text-2xl font-black text-slate-900">{loading ? '—' : upcoming.length}</span>
          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">Upcoming Jobs</span>
        </Link>
        <Link to="/equipment/availability" className="p-4 rounded-2xl bg-white border border-slate-200/80 text-center hover:border-emerald-300 transition-all">
          <span className="block text-2xl font-black text-slate-900">{loading ? '—' : fleet.length}</span>
          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">Machines</span>
        </Link>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
            <CalendarDays className="w-4 h-4 text-emerald-600" /> Availability Summary
          </h3>
          <Link to="/equipment/availability" className="text-xs font-bold text-emerald-700 hover:underline">View Calendar →</Link>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200/80 p-4 text-xs space-y-2">
          <div className="flex justify-between">
            <span className="text-slate-500">Verified machines</span>
            <span className="font-black text-emerald-700">{loading ? '—' : verifiedMachines}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">Documents under review</span>
            <span className="font-black text-amber-700">{loading ? '—' : reviewMachines}</span>
          </div>
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
            <Briefcase className="w-4 h-4 text-emerald-600" /> Recent Requests
          </h3>
          <Link to="/equipment/requests" className="text-xs font-bold text-emerald-700 hover:underline">View All →</Link>
        </div>
        {loading ? (
          <div className="py-6 text-center text-xs font-bold text-slate-400 animate-pulse">Loading…</div>
        ) : pending.length === 0 ? (
          <div className="py-8 text-center text-xs font-semibold text-slate-400 bg-white rounded-3xl border border-slate-200/80">
            No pending requests right now.
          </div>
        ) : (
          <div className="space-y-2">
            {pending.slice(0, 5).map((r) => (
              <Link key={r.id} to="/equipment/requests" className="flex items-center justify-between p-3.5 bg-white rounded-2xl border border-slate-200/80 hover:border-emerald-300 transition-all text-xs">
                <div className="min-w-0">
                  <p className="font-bold text-slate-900 truncate">
                    {r.farmerName || 'Farmer'} · {r.equipmentName || 'Equipment'}
                  </p>
                  <p className="text-[10px] text-slate-400">
                    {r.date} {r.slotName ?? ''} · {formatDateTime(r.createdAt ?? '')}
                  </p>
                </div>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-50 border border-amber-200 text-amber-700 shrink-0">
                  Review
                </span>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
