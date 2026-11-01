import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Handshake, RefreshCcw, Star, Flag } from 'lucide-react';
import { getMyLeads, type Lead } from '../../lib/api/leads';
import { apiErrorMessage } from '../../lib/api';
import { formatCurrency, formatDate } from '../../lib/utils';
import {
  ContactActions,
  OutcomeModal,
  RateConnectionModal,
  ReportIssueModal,
  statusLabel,
} from '../trade/ConnectionActions';
import { NEGOTIATION_CHECKLIST, SUPPLY_BASIS_LABEL } from '../trade/directConnect';

/** Buyer destination #5 — My Suppliers / Connections (spec §4/§12).
 * Reconnecting with a previous supplier never requires a new application. */
export const BuyerSuppliersPage: React.FC = () => {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [outcomeLead, setOutcomeLead] = useState<Lead | null>(null);
  const [rateLead, setRateLead] = useState<Lead | null>(null);
  const [issueOpen, setIssueOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [demandLeads, lotLeads] = await Promise.all([
        getMyLeads('sent', undefined, 'demand'),
        getMyLeads('sent', undefined, 'lot'),
      ]);
      const merged = new Map<string, Lead>();
      for (const l of [...demandLeads, ...lotLeads]) merged.set(l.id, l);
      setLeads([...merged.values()].sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || '')));
    } catch (e) {
      setError(apiErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  // One row per farmer: the most recent connection wins.
  const byFarmer = new Map<string, Lead>();
  for (const l of leads) {
    if (!byFarmer.has(l.farmerId)) byFarmer.set(l.farmerId, l);
  }
  const suppliers = [...byFarmer.values()];

  return (
    <div className="space-y-6">
      <div className="border-b border-slate-200 pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 flex items-center gap-2">
            <Handshake className="w-7 h-7 text-emerald-600" />
            My Suppliers
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Farmers you are connected with. Call, WhatsApp or chat to reconnect — continuing an existing conversation
            never needs a new application.
          </p>
        </div>
        <button
          onClick={() => void load()}
          className="px-3 py-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-600 self-start"
        >
          <RefreshCcw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {error && (
        <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-2xl text-xs font-semibold text-rose-800">
          {error}
        </div>
      )}

      {loading ? (
        <div className="py-10 text-center text-xs font-bold text-slate-400 animate-pulse">Loading suppliers…</div>
      ) : suppliers.length === 0 ? (
        <div className="py-12 text-center bg-white rounded-3xl border border-slate-200/80">
          <p className="text-xs font-semibold text-slate-400">
            No suppliers yet — contact a farmer from your applications to build your network.
          </p>
          <Link
            to="/directbuyer/applications"
            className="inline-block mt-3 px-4 py-2 rounded-xl bg-emerald-600 text-white font-bold text-xs"
          >
            View applications
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
          {suppliers.map((lead) => {
            const unlocked = Boolean(lead.contactRevealedAt);
            const history = leads.filter((l) => l.farmerId === lead.farmerId);
            const crops = [...new Set(history.map((l) => l.demandCrop || l.lotCrop).filter(Boolean))];
            const outcomes = history.filter((l) => ['dealDone', 'dismissed', 'withdrawn'].includes(l.status));
            return (
              <div key={lead.farmerId} className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-xs space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <span className="font-extrabold text-sm text-slate-900">
                      {lead.farmerContact?.fullName || 'Farmer'}
                    </span>
                    {lead.farmerContact?.verified && (
                      <span className="ml-2 text-[10px] font-bold text-sky-700 bg-sky-50 border border-sky-200 px-2 py-0.5 rounded-full">
                        Identity Verified
                      </span>
                    )}
                    <p className="text-[11px] text-slate-400">
                      {[lead.farmerContact?.village, lead.farmerContact?.district].filter(Boolean).join(', ') || 'Location not shared'}
                      {' · '}Connected {formatDate(lead.createdAt)}
                    </p>
                    <p className="text-[11px] text-slate-600">
                      Crops: {crops.join(', ') || '—'}
                      {outcomes.length > 0 && (
                        <span className="text-slate-400">
                          {' '}
                          · {outcomes.length} recorded outcome{outcomes.length === 1 ? '' : 's'}
                        </span>
                      )}
                    </p>
                  </div>
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                      lead.status === 'dealDone'
                        ? 'text-sky-700 bg-sky-50 border-sky-200'
                        : ['dismissed', 'withdrawn'].includes(lead.status)
                          ? 'text-slate-500 bg-slate-100 border-slate-200'
                          : 'text-amber-700 bg-amber-50 border-amber-200'
                    }`}
                  >
                    {statusLabel(lead.status)}
                  </span>
                </div>

                <p className="text-xs text-slate-600">
                  Last: {lead.demandCrop || lead.lotCrop || 'Produce'} · {lead.quantity} {lead.unit || 'q'} @{' '}
                  <strong className="text-emerald-800">{formatCurrency(lead.pricePerUnit ?? 0)}/{lead.unit || 'q'}</strong>{' '}
                  · {SUPPLY_BASIS_LABEL[lead.supplyBasis ?? 'farmGate']}
                </p>

                {unlocked ? (
                  <div className="space-y-2">
                    <ContactActions contact={lead.farmerContact} chatRoomId={lead.chatRoomId} />
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
                  </div>
                ) : (
                  <p className="text-[11px] text-slate-400">Contact hidden — unlock from the application to reconnect.</p>
                )}

                <div className="flex gap-2 pt-1">
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
                  <button
                    onClick={() => setIssueOpen(true)}
                    className="px-3 py-2 rounded-xl border border-rose-200 text-rose-600 font-bold text-xs flex items-center gap-1 ml-auto"
                  >
                    <Flag className="w-3.5 h-3.5" /> Report
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <OutcomeModal
        lead={outcomeLead}
        onClose={() => setOutcomeLead(null)}
        onSaved={() => void load()}
      />
      <RateConnectionModal lead={rateLead} onClose={() => setRateLead(null)} />
      <ReportIssueModal open={issueOpen} onClose={() => setIssueOpen(false)} />
    </div>
  );
};
