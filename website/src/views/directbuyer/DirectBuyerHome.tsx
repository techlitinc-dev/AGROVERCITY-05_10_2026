import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Building2,
  Layers,
  Plus,
  Inbox,
  Handshake,
  CheckCheck,
  RefreshCcw,
  ArrowRight,
  ShieldCheck,
  BadgeCheck,
  Megaphone,
} from 'lucide-react';
import { demands, directBuyer, apiErrorMessage } from '../../lib/api';
import { getMyLeads, type Lead } from '../../lib/api/leads';
import { StatCard } from '../../components/common/StatCard';
import { StatusBadge } from '../../components/common/StatusBadge';
import { formatWeight, formatDate } from '../../lib/utils';
import { FREQUENCY_LABEL, REQUIREMENT_STATUS_LABEL } from '../trade/directConnect';
import type { BuyerDemand } from '../../types';

/** Industrial Buyer home (spec §4.1): open requirement count, new application
 * count, contacted suppliers, recent outcomes, Post Requirement quick action
 * and business-verification status. No escrow/payment/QC controls — sourcing
 * connections only. */
export const DirectBuyerHome: React.FC = () => {
  const [requirements, setRequirements] = useState<BuyerDemand[]>([]);
  const [applications, setApplications] = useState<Lead[]>([]);
  const [verification, setVerification] = useState<{ identityVerified?: boolean; businessVerified?: boolean }>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [reqs, apps, ver] = await Promise.all([
        demands.list({ status: 'all' }),
        getMyLeads('sent', undefined, 'demand').catch(() => [] as Lead[]),
        directBuyer.verification().catch(() => ({})),
      ]);
      setRequirements(reqs);
      setApplications(apps);
      setVerification(ver);
    } catch (e) {
      setError(apiErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const openCount = requirements.filter((d) => ['open', 'applicationsReceived'].includes(d.status)).length;
  const newCount = applications.filter((a) => a.status === 'submitted').length;
  const contactedCount = new Set(
    applications.filter((a) => ['contacted', 'dealDone'].includes(a.status)).map((a) => a.farmerId)
  ).size;
  const recentOutcomes = applications
    .filter((a) => ['dealDone', 'dismissed', 'withdrawn'].includes(a.status))
    .sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''))
    .slice(0, 5);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 flex items-center gap-2">
            <Building2 className="w-7 h-7 text-emerald-600" />
            Industrial Buyer Desk
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Publish sourcing requirements, compare farmer applications, and unlock direct contact with the suppliers
            you choose. Deals close directly between the parties — Agrovercity never holds payments.
          </p>
        </div>
        <div className="flex gap-2 self-start sm:self-auto">
          <button onClick={() => void load()} className="px-3 py-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-600">
            <RefreshCcw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <Link
            to="/directbuyer/requirements/new"
            className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md transition-all flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4" /> Post Requirement
          </Link>
        </div>
      </div>

      {/* Verification status — distinct identity/business badges (spec §13). */}
      <div className="flex flex-wrap items-center gap-2">
        {verification.identityVerified ? (
          <span className="text-[10px] font-bold text-sky-700 bg-sky-50 border border-sky-200 px-2.5 py-1 rounded-full flex items-center gap-1">
            <BadgeCheck className="w-3 h-3" /> Identity Verified
          </span>
        ) : (
          <Link
            to="/kyc"
            className="text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-full flex items-center gap-1 hover:bg-amber-100 transition-all"
          >
            <ShieldCheck className="w-3 h-3" /> Complete identity KYC to publish
          </Link>
        )}
        {verification.businessVerified ? (
          <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-full flex items-center gap-1">
            <ShieldCheck className="w-3 h-3" /> Business Verified
          </span>
        ) : (
          <Link
            to="/directbuyer/org"
            className="text-[10px] font-bold text-slate-600 bg-slate-50 border border-slate-200 px-2.5 py-1 rounded-full flex items-center gap-1 hover:bg-slate-100 transition-all"
          >
            Get business verification
          </Link>
        )}
      </div>

      {error && (
        <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-2xl text-xs font-semibold text-rose-800">
          {error}
        </div>
      )}

      {loading ? (
        <div className="py-10 text-center text-xs font-bold text-slate-400 animate-pulse">Loading your desk…</div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
              title="Open Requirements"
              value={`${openCount}`}
              subtitle={`${requirements.length} total`}
              icon={Layers}
              colorScheme="blue"
            />
            <StatCard
              title="New Applications"
              value={`${newCount}`}
              subtitle="Waiting for your review"
              icon={Inbox}
              colorScheme="green"
            />
            <StatCard
              title="Contacted Suppliers"
              value={`${contactedCount}`}
              subtitle="Direct connections"
              icon={Handshake}
              colorScheme="amber"
            />
            <StatCard
              title="Recorded Outcomes"
              value={`${applications.filter((a) => ['dealDone', 'dismissed', 'withdrawn'].includes(a.status)).length}`}
              subtitle="User-reported"
              icon={CheckCheck}
              colorScheme="purple"
            />
          </div>

          {/* Quick actions */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { to: '/directbuyer/requirements/new', label: 'Post Requirement', icon: Megaphone },
              { to: '/directbuyer/requirements', label: 'My Requirements', icon: Layers },
              { to: '/directbuyer/applications', label: 'Applications', icon: Inbox },
              { to: '/directbuyer/suppliers', label: 'My Suppliers', icon: Handshake },
              { to: '/directbuyer/org', label: 'Business Profile', icon: Building2 },
            ].map((l) => (
              <Link
                key={l.to + l.label}
                to={l.to}
                className="bg-white p-3.5 rounded-2xl border border-slate-200/80 flex items-center gap-2.5 hover:border-emerald-300 transition-all text-xs font-bold text-slate-800"
              >
                <span className="p-2 rounded-xl bg-emerald-50 text-emerald-700">
                  <l.icon className="w-4 h-4" />
                </span>
                {l.label}
                <ArrowRight className="w-3.5 h-3.5 ml-auto text-slate-400" />
              </Link>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Recent requirements */}
            <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
                <h3 className="font-bold text-sm text-slate-900">Recent Requirements</h3>
                <Link to="/directbuyer/requirements" className="text-[11px] font-bold text-emerald-700 hover:underline">
                  View all
                </Link>
              </div>
              {requirements.length === 0 ? (
                <p className="px-5 py-8 text-center text-xs font-semibold text-slate-400">
                  No requirements yet — post your first sourcing requirement.
                </p>
              ) : (
                <ul className="divide-y divide-slate-100">
                  {requirements.slice(0, 5).map((d) => (
                    <li key={d.id} className="px-5 py-3 flex items-center justify-between gap-3">
                      <div>
                        <p className="text-xs font-bold text-slate-900">
                          {d.crop} {d.variety ? `(${d.variety})` : ''}
                          {d.supplyType === 'recurring' || (d.frequency ?? 'oneTime') !== 'oneTime' ? (
                            <span className="ml-2 text-[10px] text-violet-700 font-bold">
                              {FREQUENCY_LABEL[d.frequency ?? 'weekly']}
                            </span>
                          ) : null}
                        </p>
                        <p className="text-[10px] text-slate-400">
                          {formatWeight(d.quantity ?? d.requiredQuantityQuintal ?? 0)} · {d.applicationsCount ?? 0} applications ·{' '}
                          {formatDate(d.createdAt)}
                        </p>
                      </div>
                      <StatusBadge status={REQUIREMENT_STATUS_LABEL[d.status] ?? d.status} />
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Recent outcomes */}
            <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
                <h3 className="font-bold text-sm text-slate-900">Recent Outcomes</h3>
                <Link to="/directbuyer/suppliers" className="text-[11px] font-bold text-emerald-700 hover:underline">
                  My suppliers
                </Link>
              </div>
              {recentOutcomes.length === 0 ? (
                <p className="px-5 py-8 text-center text-xs font-semibold text-slate-400">
                  No outcomes recorded yet. After you contact a supplier, record what happened — it is your own report,
                  not a payment record.
                </p>
              ) : (
                <ul className="divide-y divide-slate-100">
                  {recentOutcomes.map((a) => (
                    <li key={a.id} className="px-5 py-3 flex items-center justify-between gap-3">
                      <div>
                        <p className="text-xs font-bold text-slate-900">
                          {a.farmerContact?.fullName || 'Farmer'} · {a.demandCrop}
                        </p>
                        <p className="text-[10px] text-slate-400">
                          {a.quantity} {a.unit || 'q'} @ ₹{a.pricePerUnit}/{a.unit || 'q'} · updated {formatDate(a.updatedAt)}
                        </p>
                      </div>
                      <StatusBadge
                        status={
                          a.status === 'dealDone'
                            ? 'Deal completed'
                            : a.status === 'withdrawn'
                              ? 'Withdrawn'
                              : 'Did not happen'
                        }
                      />
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
};
