import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { FileText, Inbox, Star, Flag, RefreshCcw, Undo2, ShieldCheck } from 'lucide-react';
import { getMyLeads, updateLeadStatus, type Lead } from '../../lib/api/leads';
import { apiErrorMessage } from '../../lib/api';
import { ModalSheet } from '../../components/common/ModalSheet';
import { formatCurrency, formatDate } from '../../lib/utils';
import { VerificationBadges } from './BuyerDemandsView';
import {
  ContactActions,
  OutcomeModal,
  RateConnectionModal,
  ReportIssueModal,
  statusLabel,
} from '../trade/ConnectionActions';
import { FREQUENCY_LABEL, NEGOTIATION_CHECKLIST, SUPPLY_BASIS_LABEL } from '../trade/directConnect';
import { demands } from '../../lib/api';
import type { BuyerDemand } from '../../types';

type Filter = 'all' | 'submitted' | 'contacted' | 'dealDone' | 'closed';

const FILTERS: { key: Filter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'submitted', label: 'Submitted' },
  { key: 'contacted', label: 'Contacted' },
  { key: 'dealDone', label: 'Deal completed' },
  { key: 'closed', label: 'Closed' },
];

/** Farmer destination #2 — "My Industrial Applications" (spec §3/§12).
 * Also embedded as a tab on My Industry (`embedded` hides the page header). */
export const MyIndustrialApplicationsView: React.FC<{ embedded?: boolean }> = ({ embedded = false }) => {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [demandMap, setDemandMap] = useState<Record<string, BuyerDemand>>({});
  const [filter, setFilter] = useState<Filter>('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [outcomeLead, setOutcomeLead] = useState<Lead | null>(null);
  const [rateLead, setRateLead] = useState<Lead | null>(null);
  const [issueOpen, setIssueOpen] = useState(false);
  const [withdrawLead, setWithdrawLead] = useState<Lead | null>(null);
  const [withdrawing, setWithdrawing] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const apps = await getMyLeads('received', undefined, 'demand');
      setLeads(apps);
      const map: Record<string, BuyerDemand> = {};
      await Promise.all(
        apps.map(async (l) => {
          if (l.demandId && !map[l.demandId]) {
            try {
              map[l.demandId] = await demands.get(l.demandId);
            } catch {
              /* requirement may have been deleted — summary fields on the lead suffice */
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

  const visible = leads.filter((l) => {
    if (filter === 'all') return true;
    if (filter === 'closed') return ['dismissed', 'withdrawn', 'rejected'].includes(l.status);
    return l.status === filter;
  });

  const contactOf = (lead: Lead) => lead.buyerContact;

  const withdraw = async () => {
    if (!withdrawLead) return;
    setWithdrawing(true);
    setError(null);
    try {
      const updated = await updateLeadStatus(withdrawLead.id, 'withdrawn');
      setLeads((prev) => prev.map((l) => (l.id === updated.id ? updated : l)));
      setWithdrawLead(null);
      setNotice('Application withdrawn.');
    } catch (e) {
      setError(apiErrorMessage(e));
    } finally {
      setWithdrawing(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${embedded ? '' : 'border-b border-slate-200 pb-4'}`}>
        {!embedded && (
          <div>
            <h1 className="text-2xl font-extrabold text-slate-900 flex items-center gap-2">
              <FileText className="w-7 h-7 text-emerald-600" />
              My Industrial Applications
            </h1>
            <p className="text-xs text-slate-500 mt-1">
              Applications you sent on industrial buyer requirements. Your contact stays private until the buyer accepts
              the connection.
            </p>
          </div>
        )}
        <div className="flex gap-2">
          <button
            onClick={() => void load()}
            className="px-3 py-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-600"
          >
            <RefreshCcw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <Link
            to="/farmer/demands"
            className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md transition-all"
          >
            Browse requirements
          </Link>
        </div>
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
            {f.label} ({f.key === 'all' ? leads.length : leads.filter((l) =>
                f.key === 'closed'
                  ? ['dismissed', 'withdrawn', 'rejected'].includes(l.status)
                  : l.status === f.key
              ).length})
          </button>
        ))}
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
          <Inbox className="w-10 h-10 text-slate-300 mx-auto mb-2" />
          <p className="text-xs font-semibold text-slate-400">
            No applications here yet. Browse industrial requirements and apply with your quote.
          </p>
          <Link
            to="/farmer/demands"
            className="inline-block mt-3 px-4 py-2 rounded-xl bg-emerald-600 text-white font-bold text-xs"
          >
            Find requirements
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {visible.map((lead) => {
            const demand = lead.demandId ? demandMap[lead.demandId] : undefined;
            const unlocked = Boolean(lead.contactRevealedAt);
            const buyerName =
              lead.buyerContact?.fullName || demand?.buyerSummary?.companyName || demand?.buyerCompany || 'Industrial buyer';
            const recurring = demand && (demand.supplyType === 'recurring' || (demand.frequency ?? 'oneTime') !== 'oneTime');
            return (
              <div key={lead.id} className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-xs space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 border-b border-slate-100 pb-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-extrabold text-sm text-slate-900">{buyerName}</span>
                      {demand?.buyerSummary && <VerificationBadges summary={demand.buyerSummary} />}
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
                    <p className="text-xs text-slate-600">
                      <strong>{lead.demandCrop}</strong>
                      {lead.demandVariety ? ` (${lead.demandVariety})` : ''} · offered{' '}
                      <strong>{lead.quantity} {lead.unit || 'q'}</strong> @{' '}
                      <strong className="text-emerald-800">{formatCurrency(lead.pricePerUnit ?? 0)}/{lead.unit || 'q'}</strong>
                      {' · '}
                      {SUPPLY_BASIS_LABEL[lead.supplyBasis ?? 'farmGate']}
                      {lead.availableDate ? ` · available ${formatDate(lead.availableDate)}` : ''}
                    </p>
                    {recurring && lead.canRecur !== undefined && (
                      <p className="text-[11px] text-violet-700 font-bold flex items-center gap-1">
                        <ShieldCheck className="w-3 h-3" />
                        {lead.canRecur
                          ? `Can supply ${FREQUENCY_LABEL[demand?.frequency ?? 'weekly'].toLowerCase()}`
                          : 'One-time supply only'}
                      </p>
                    )}
                    <p className="text-[10px] text-slate-400">Applied {formatDate(lead.createdAt)}</p>
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    {lead.status === 'submitted' && (
                      <button
                        onClick={() => setWithdrawLead(lead)}
                        className="px-3 py-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-600 font-bold text-xs flex items-center gap-1"
                      >
                        <Undo2 className="w-3.5 h-3.5" /> Withdraw
                      </button>
                    )}
                    {['contacted', 'dealDone'].includes(lead.status) && (
                      <>
                        <button
                          onClick={() => setOutcomeLead(lead)}
                          className="px-3 py-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold text-xs"
                        >
                          Update outcome
                        </button>
                        <button
                          onClick={() => setRateLead(lead)}
                          className="px-3 py-2 rounded-xl border border-amber-200 bg-amber-50 text-amber-700 font-bold text-xs flex items-center gap-1"
                        >
                          <Star className="w-3.5 h-3.5" /> Rate
                        </button>
                      </>
                    )}
                    <button
                      onClick={() => setIssueOpen(true)}
                      className="px-3 py-2 rounded-xl border border-rose-200 text-rose-600 font-bold text-xs flex items-center gap-1"
                    >
                      <Flag className="w-3.5 h-3.5" /> Report
                    </button>
                  </div>
                </div>

                {lead.message && (
                  <p className="text-[11px] text-slate-600 bg-slate-50 border border-slate-100 rounded-xl p-2.5">
                    “{lead.message}”
                  </p>
                )}

                {unlocked ? (
                  <div className="space-y-2">
                    <ContactActions contact={contactOf(lead)} chatRoomId={lead.chatRoomId} />
                    {lead.status === 'contacted' && (
                      <details className="text-[11px] text-slate-500 bg-slate-50 rounded-xl p-3">
                        <summary className="font-bold text-slate-600 cursor-pointer">
                          Negotiation checklist (guidance only)
                        </summary>
                        <ul className="list-disc pl-5 mt-1.5 space-y-0.5">
                          {NEGOTIATION_CHECKLIST.map((item) => (
                            <li key={item}>{item}</li>
                          ))}
                        </ul>
                      </details>
                    )}
                  </div>
                ) : (
                  <p className="text-[11px] text-slate-500 flex items-center gap-1.5">
                    <ShieldCheck className="w-3.5 h-3.5 text-slate-400" />
                    Contact details stay hidden until the buyer reviews your application and accepts the connection.
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}

      <OutcomeModal
        lead={outcomeLead}
        onClose={() => setOutcomeLead(null)}
        onSaved={(updated) => setLeads((prev) => prev.map((l) => (l.id === updated.id ? updated : l)))}
      />
      <RateConnectionModal lead={rateLead} onClose={() => setRateLead(null)} />
      <ReportIssueModal open={issueOpen} onClose={() => setIssueOpen(false)} />

      <ModalSheet
        isOpen={Boolean(withdrawLead)}
        onClose={() => setWithdrawLead(null)}
        title="Withdraw application"
        description="The buyer will be informed. You can apply again later — the requirement stays open."
        maxWidth="sm"
      >
        <div className="space-y-3">
          <p className="text-xs text-slate-600">Withdraw your application for {withdrawLead?.demandCrop}?</p>
          <div className="flex gap-2">
            <button
              onClick={() => void withdraw()}
              disabled={withdrawing}
              className="flex-1 py-3 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs shadow-md transition-all disabled:opacity-50"
            >
              {withdrawing ? 'Withdrawing…' : 'Yes, withdraw'}
            </button>
            <button
              onClick={() => setWithdrawLead(null)}
              className="flex-1 py-3 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold text-xs"
            >
              Keep application
            </button>
          </div>
        </div>
      </ModalSheet>
    </div>
  );
};
