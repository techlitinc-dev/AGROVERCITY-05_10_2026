import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Inbox, RefreshCcw, MapPin, CalendarDays, ShieldCheck, Star } from 'lucide-react';
import { demands, apiErrorMessage } from '../../lib/api';
import { getMyLeads, updateLeadStatus, type Lead } from '../../lib/api/leads';
import { ModalSheet } from '../../components/common/ModalSheet';
import { formatCurrency, formatDate } from '../../lib/utils';
import {
  ContactActions,
  OutcomeModal,
  RateConnectionModal,
  ReportIssueModal,
  UnlockConnectionModal,
  statusLabel,
} from '../trade/ConnectionActions';
import { SUPPLY_BASIS_LABEL } from '../trade/directConnect';
import type { BuyerDemand } from '../../types';

type Filter = 'all' | 'submitted' | 'contacted' | 'dealDone' | 'closed';

const REQUIREMENT_STATUS_SHORT: Record<string, string> = {
  open: 'requirement open',
  applicationsReceived: 'requirement open',
  paused: 'requirement paused',
  closed: 'requirement closed',
  fulfilled: 'requirement fulfilled',
  draft: 'draft',
};


const FILTERS: { key: Filter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'submitted', label: 'New' },
  { key: 'contacted', label: 'Contacted' },
  { key: 'dealDone', label: 'Deal completed' },
  { key: 'closed', label: 'Dismissed/withdrawn' },
];

/** Buyer destination #4 — Applications Received: compare farmers, contact or
 * dismiss. No "Best Offer"/"Verified document"/"Reliable Supplier" labels —
 * the buyer compares the facts (spec §8). */
export const BuyerApplicationsPage: React.FC = () => {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [demandMap, setDemandMap] = useState<Record<string, BuyerDemand>>({});
  const [filter, setFilter] = useState<Filter>('all');
  const [requirementFilter, setRequirementFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [termsLead, setTermsLead] = useState<Lead | null>(null);
  const [outcomeLead, setOutcomeLead] = useState<Lead | null>(null);
  const [rateLead, setRateLead] = useState<Lead | null>(null);
  const [issueOpen, setIssueOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const apps = await getMyLeads('sent', undefined, 'demand');
      setLeads(apps);
      const map: Record<string, BuyerDemand> = {};
      await Promise.all(
        apps.map(async (l) => {
          if (l.demandId && !map[l.demandId]) {
            try {
              map[l.demandId] = await demands.get(l.demandId);
            } catch {
              /* deleted requirement — lead summary fields suffice */
            }
          }
        })
      );
      setDemandMap(map);
    } catch (e) {
      setError(apiErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const requirementIds = [...new Set(leads.map((l) => l.demandId).filter(Boolean))] as string[];

  const visible = leads.filter((l) => {
    const statusOk =
      filter === 'all'
        ? true
        : filter === 'closed'
          ? ['dismissed', 'withdrawn', 'rejected'].includes(l.status)
          : l.status === filter;
    const reqOk = requirementFilter === 'all' || l.demandId === requirementFilter;
    return statusOk && reqOk;
  });

  const dismiss = async (lead: Lead) => {
    setError(null);
    try {
      const updated = await updateLeadStatus(lead.id, 'dismissed');
      setLeads((prev) => prev.map((l) => (l.id === updated.id ? updated : l)));
      setNotice('Application dismissed.');
    } catch (e) {
      setError(apiErrorMessage(e));
    }
  };

  return (
    <div className="space-y-6">
      <div className="border-b border-slate-200 pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 flex items-center gap-2">
            <Inbox className="w-7 h-7 text-emerald-600" />
            Applications Received
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Farmers who applied to your requirements. Compare quantity, price, location, availability, quality and
            packaging — then contact the farmers you choose. Contacts unlock both ways only after your acceptance.
          </p>
        </div>
        <button
          onClick={() => void load()}
          className="px-3 py-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-600 self-start"
        >
          <RefreshCcw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      <div className="flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold border transition-all ${
              filter === f.key
                ? 'bg-emerald-600 border-emerald-600 text-white'
                : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
            }`}
          >
            {f.label}
          </button>
        ))}
        <select
          value={requirementFilter}
          onChange={(e) => setRequirementFilter(e.target.value)}
          className="px-3 py-1.5 rounded-xl text-xs font-bold bg-white border border-slate-200"
        >
          <option value="all">All requirements</option>
          {requirementIds.map((id) => (
            <option key={id} value={id}>
              {demandMap[id]?.crop || 'Requirement'}
            </option>
          ))}
        </select>
      </div>

      {error && (
        <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-2xl text-xs font-semibold text-rose-800">
          {error}
        </div>
      )}
      {notice && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-2xl text-xs font-semibold text-emerald-800 flex items-center justify-between gap-4">
          <span>{notice}</span>
          <button onClick={() => setNotice(null)} className="font-bold hover:underline shrink-0">
            Dismiss
          </button>
        </div>
      )}

      {loading ? (
        <div className="py-10 text-center text-xs font-bold text-slate-400 animate-pulse">Loading applications…</div>
      ) : visible.length === 0 ? (
        <div className="py-12 text-center bg-white rounded-3xl border border-slate-200/80">
          <p className="text-xs font-semibold text-slate-400">
            No applications here. Share your requirements with farmers or check back soon.
          </p>
          <Link
            to="/directbuyer/requirements"
            className="inline-block mt-3 px-4 py-2 rounded-xl bg-emerald-600 text-white font-bold text-xs"
          >
            Manage requirements
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
          {visible.map((lead) => {
            const demand = lead.demandId ? demandMap[lead.demandId] : undefined;
            const unlocked = Boolean(lead.contactRevealedAt);
            const farmerName = lead.farmerContact?.fullName || lead.farmerContact?.name || 'Farmer';
            return (
              <div key={lead.id} className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-xs space-y-3">
                <div className="flex items-start justify-between gap-3 border-b border-slate-100 pb-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-extrabold text-sm text-slate-900">{farmerName}</span>
                      {lead.farmerContact?.verified && (
                        <span
                          title="Identity Verified — farmer completed unified KYC"
                          className="text-[10px] font-bold text-sky-700 bg-sky-50 border border-sky-200 px-2 py-0.5 rounded-full flex items-center gap-1"
                        >
                          <ShieldCheck className="w-3 h-3" /> Identity Verified
                        </span>
                      )}
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                          lead.status === 'dealDone'
                            ? 'text-sky-700 bg-sky-50 border-sky-200'
                            : lead.status === 'contacted'
                              ? 'text-amber-700 bg-amber-50 border-amber-200'
                              : ['dismissed', 'withdrawn', 'rejected'].includes(lead.status)
                                ? 'text-slate-500 bg-slate-100 border-slate-200'
                                : 'text-emerald-700 bg-emerald-50 border-emerald-200'
                        }`}
                      >
                        {statusLabel(lead.status)}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400">
                      {lead.demandCrop}
                      {lead.demandVariety ? ` (${lead.demandVariety})` : ''} · applied {formatDate(lead.createdAt)}
                      {demand ? ` · ${REQUIREMENT_STATUS_SHORT[demand.status] ?? demand.status}` : ''}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2 text-xs">
                  <div className="p-2.5 bg-slate-50 rounded-xl">
                    <span className="text-slate-400 block text-[10px] uppercase font-bold">Offered</span>
                    <span className="font-bold text-slate-800">
                      {lead.quantity} {lead.unit || 'q'}
                    </span>
                  </div>
                  <div className="p-2.5 bg-slate-50 rounded-xl">
                    <span className="text-slate-400 block text-[10px] uppercase font-bold">Quote</span>
                    <span className="font-black text-emerald-800">
                      {formatCurrency(lead.pricePerUnit ?? 0)}/{lead.unit || 'q'}
                    </span>
                  </div>
                  <div className="p-2.5 bg-slate-50 rounded-xl">
                    <span className="text-slate-400 block text-[10px] uppercase font-bold">Supply basis</span>
                    <span className="font-bold text-slate-800">{SUPPLY_BASIS_LABEL[lead.supplyBasis ?? 'farmGate']}</span>
                  </div>
                  <div className="p-2.5 bg-slate-50 rounded-xl">
                    <span className="text-slate-400 block text-[10px] uppercase font-bold">Available</span>
                    <span className="font-bold text-slate-800">{lead.availableDate ? formatDate(lead.availableDate) : '—'}</span>
                  </div>
                  <div className="p-2.5 bg-slate-50 rounded-xl col-span-2">
                    <span className="text-slate-400 block text-[10px] uppercase font-bold">Location</span>
                    <span className="font-bold text-slate-800 flex items-center gap-1">
                      <MapPin className="w-3 h-3 text-slate-400" />
                      {lead.supplyLocation || '—'}
                    </span>
                  </div>
                  {lead.canRecur !== undefined && lead.canRecur !== null && (
                    <div className="p-2.5 bg-slate-50 rounded-xl col-span-3">
                      <span className="text-slate-400 block text-[10px] uppercase font-bold">Recurring supply</span>
                      <span className="font-bold text-slate-800">
                        {lead.canRecur ? `Yes${lead.availabilityNote ? ` — ${lead.availabilityNote}` : ''}` : 'No — one-time only'}
                      </span>
                    </div>
                  )}
                </div>

                {(lead.qualityDetails || lead.packagingCapability || lead.certifications?.length || lead.photos?.length) && (
                  <div className="p-2.5 bg-slate-50 rounded-xl text-[11px] text-slate-600 space-y-1">
                    {lead.qualityDetails && <p>Quality: {lead.qualityDetails}</p>}
                    {lead.packagingCapability && <p>Packaging: {lead.packagingCapability}</p>}
                    {lead.certifications && lead.certifications.length > 0 && (
                      <p>Documents referenced: {lead.certifications.join(', ')}</p>
                    )}
                    {lead.sourceLot && (
                      <p className="text-slate-500">
                        Reference lot: {lead.sourceLot.crop} · {lead.sourceLot.quantityQuintals} q
                        {lead.sourceLot.harvestDate ? ` · harvest ${lead.sourceLot.harvestDate}` : ''}
                      </p>
                    )}
                    {lead.photos && lead.photos.length > 0 && (
                      <p className="text-slate-500 flex items-center gap-1">
                        <CalendarDays className="w-3 h-3" /> {lead.photos.length} photo(s) attached
                      </p>
                    )}
                  </div>
                )}

                {lead.message && (
                  <p className="text-[11px] text-slate-600 bg-slate-50 border border-slate-100 rounded-xl p-2.5">
                    “{lead.message}”
                  </p>
                )}

                <div className="flex flex-wrap items-center gap-2 pt-1">
                  {unlocked ? (
                    <>
                      <ContactActions contact={lead.farmerContact} chatRoomId={lead.chatRoomId} />
                      {['contacted', 'dealDone'].includes(lead.status) && (
                        <>
                          <button
                            onClick={() => setOutcomeLead(lead)}
                            className="px-3 py-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold text-xs"
                          >
                            Outcome
                          </button>
                          <button
                            onClick={() => setRateLead(lead)}
                            className="px-3 py-2 rounded-xl border border-amber-200 bg-amber-50 text-amber-700 font-bold text-xs flex items-center gap-1"
                          >
                            <Star className="w-3.5 h-3.5" /> Rate
                          </button>
                        </>
                      )}
                    </>
                  ) : ['submitted'].includes(lead.status) ? (
                    <>
                      <button
                        onClick={() => setTermsLead(lead)}
                        className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md transition-all"
                      >
                        Contact Farmer
                      </button>
                      <button
                        onClick={() => void dismiss(lead)}
                        className="px-3 py-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-600 font-bold text-xs"
                      >
                        Dismiss
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={() => setTermsLead(lead)}
                      className="px-4 py-2 rounded-xl border border-emerald-300 text-emerald-700 font-bold text-xs hover:bg-emerald-50 transition-all"
                    >
                      View contact again
                    </button>
                  )}
                  <button
                    onClick={() => setIssueOpen(true)}
                    className="px-3 py-2 rounded-xl border border-rose-200 text-rose-600 font-bold text-xs ml-auto"
                  >
                    Report
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <UnlockConnectionModal
        lead={termsLead}
        onClose={() => setTermsLead(null)}
        onUnlocked={(updated) => {
          setLeads((prev) => prev.map((l) => (l.id === updated.id ? updated : l)));
          setNotice('Contact unlocked — call, WhatsApp or chat directly.');
        }}
      />
      <OutcomeModal
        lead={outcomeLead}
        onClose={() => setOutcomeLead(null)}
        onSaved={(updated) => setLeads((prev) => prev.map((l) => (l.id === updated.id ? updated : l)))}
      />
      <RateConnectionModal lead={rateLead} onClose={() => setRateLead(null)} />
      <ReportIssueModal open={issueOpen} onClose={() => setIssueOpen(false)} />
    </div>
  );
};

