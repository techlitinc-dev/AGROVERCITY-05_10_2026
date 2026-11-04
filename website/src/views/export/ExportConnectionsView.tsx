import React, { useCallback, useEffect, useState } from 'react';
import { Handshake, Loader2, Star, ShieldAlert } from 'lucide-react';
import { exporter } from '../../lib/api/exporter';
import { apiErrorMessage, ratings } from '../../lib/api';
import type { ExportApplication, ExportApplicationContact } from '../../types';
import { RateUserModal } from '../../components/common/RateUserModal';
import {
  ContactActions,
  ExportStatusBadge,
  NegotiationChecklist,
  OutcomeModal,
  ReportIssueModal,
} from './shared';

/**
 * My Connections — shared by farmer and exporter (spec §3.3, §4.5, §12).
 * Previously contacted parties with Call / WhatsApp / Chat, user-reported
 * outcomes, ratings and issue reporting. No payment/shipping state exists
 * here by design.
 */
export const ExportConnectionsView: React.FC<{ persona: 'farmer' | 'exporter'; embedded?: boolean }> = ({ persona, embedded = false }) => {
  const [connections, setConnections] = useState<ExportApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [outcomeApp, setOutcomeApp] = useState<ExportApplication | null>(null);
  const [rateApp, setRateApp] = useState<ExportApplication | null>(null);
  const [rateKey, setRateKey] = useState(0);
  const [reportApp, setReportApp] = useState<ExportApplication | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setConnections(persona === 'farmer' ? await exporter.myConnections() : await exporter.connections());
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [persona]);

  useEffect(() => {
    load();
  }, [load]);

  const reportOutcome = async (app: ExportApplication, payload: Parameters<
    (typeof exporter)['reportOutcome']
  >[1]) => {
    setBusyId(app.id);
    try {
      const updated = await exporter.reportOutcome(app.id, payload);
      setConnections((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
      setNotice('Outcome recorded. It is a user-reported record only — no payment or shipment step was created.');
    } finally {
      setBusyId(null);
    }
  };

  const submitRating = async (app: ExportApplication, stars: number, review: string) => {
    await ratings.submit({
      bookingKind: 'export_connection',
      bookingId: app.id,
      stars,
      comment: review,
    });
    setNotice('Rating submitted. Thank you for keeping the export community trustworthy.');
  };

  const otherParty = (app: ExportApplication): ExportApplicationContact | null =>
    persona === 'farmer' ? (app.contactReveal?.exporter ?? null) : (app.contactReveal?.farmer ?? null);
  const otherName = (app: ExportApplication): string =>
    persona === 'farmer'
      ? app.exporter?.companyName || app.exporter?.name || 'Exporter'
      : app.farmer?.name || app.sellerName || 'Farmer';

  return (
    <div className="space-y-6">
      {!embedded && (
        <div className="border-b border-slate-200 pb-4">
          <h1 className="text-2xl font-extrabold text-slate-900 flex items-center gap-2">
            <Handshake className="w-7 h-7 text-emerald-600" />
            My Export Connections
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Exporters you are in touch with. Sampling, quality, price, payment, packaging, transport,
            customs, freight, and insurance are settled directly between you and the exporter —
            Agrovercity never holds export payments.
          </p>
        </div>
      )}

      {error && (
        <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-2xl text-xs font-semibold text-rose-800">
          {error}
        </div>
      )}
      {notice && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-2xl text-xs font-semibold text-emerald-800 flex items-start justify-between gap-4">
          <span>{notice}</span>
          <button type="button" onClick={() => setNotice(null)} className="text-emerald-600 font-bold shrink-0">
            Close
          </button>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-16 text-slate-400">
          <Loader2 className="w-6 h-6 animate-spin mr-2" /> Loading connections…
        </div>
      ) : connections.length === 0 ? (
        <div className="p-10 text-center rounded-3xl border-2 border-dashed border-slate-200">
          <Handshake className="w-10 h-10 mx-auto text-slate-300" />
          <p className="mt-3 text-sm font-bold text-slate-600">No export connections yet</p>
          <p className="mt-1 text-xs text-slate-400">
            {persona === 'farmer'
              ? 'Apply on export opportunities — when an exporter unlocks your contact, the connection appears here.'
              : 'Unlock contact on farmer applications — connected farmers appear here.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {connections.map((app) => (
            <div key={app.id} className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <h3 className="text-sm font-extrabold text-slate-900">
                    {app.rfq?.crop || 'Crop requirement'}
                    <span className="ml-2 text-xs font-semibold text-slate-400">
                      via {otherName(app)}
                    </span>
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    You offered {app.quantityOffered} {app.quantityUnit} @ {app.currency} {app.price}/
                    {app.priceUnit} · {app.supplyBasis === 'farmGate' ? 'farm gate' : app.supplyBasis}
                    {app.rfq?.deliveryLocation ? ` · ${app.rfq.deliveryLocation}` : ''}
                  </p>
                </div>
                <ExportStatusBadge status={app.status} />
              </div>

              {app.outcome && (
                <p className="mt-2 text-[11px] font-semibold text-slate-500">
                  Outcome: {app.outcome.value === 'dealDoneOffline'
                    ? 'Supply deal completed offline'
                    : app.outcome.value === 'stillInContact'
                      ? 'Still in contact'
                      : app.outcome.value === 'didNotHappen'
                        ? 'Did not happen'
                        : 'Withdrawn'}
                  {app.outcome.dealDetails?.finalQuantity
                    ? ` — ${app.outcome.dealDetails.finalQuantity} ${app.outcome.dealDetails.finalQuantityUnit || ''} @ ${app.outcome.dealDetails.finalCurrency || ''} ${app.outcome.dealDetails.finalPrice || ''}`
                    : ''}
                </p>
              )}

              <div className="mt-3">
                <ContactActions contact={otherParty(app)} chatRoomId={app.chatRoomId} />
              </div>

              {app.negotiationChecklist && app.negotiationChecklist.length > 0 && (
                <div className="mt-3">
                  <NegotiationChecklist items={app.negotiationChecklist} />
                </div>
              )}

              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={busyId === app.id}
                  onClick={() => setOutcomeApp(app)}
                  className="rounded-xl border border-slate-200 text-slate-700 text-[11px] font-bold px-3 py-1.5 hover:bg-slate-50 transition"
                >
                  Update Outcome
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setRateApp(app);
                    setRateKey((k) => k + 1);
                  }}
                  className="inline-flex items-center gap-1 rounded-xl border border-amber-200 bg-amber-50 text-amber-700 text-[11px] font-bold px-3 py-1.5 hover:bg-amber-100 transition"
                >
                  <Star className="w-3 h-3" /> Rate
                </button>
                <button
                  type="button"
                  onClick={() => setReportApp(app)}
                  className="inline-flex items-center gap-1 rounded-xl border border-rose-200 bg-rose-50 text-rose-700 text-[11px] font-bold px-3 py-1.5 hover:bg-rose-100 transition"
                >
                  <ShieldAlert className="w-3 h-3" /> Report Issue
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <OutcomeModal
        open={!!outcomeApp}
        onClose={() => setOutcomeApp(null)}
        onSubmit={async (payload) => {
          if (outcomeApp) await reportOutcome(outcomeApp, payload);
        }}
      />

      <RateUserModal
        key={rateKey}
        open={!!rateApp}
        onClose={() => setRateApp(null)}
        title={`Rate ${rateApp ? otherName(rateApp) : ''}`}
        subtitle="Ratings are only for confirmed connections. Agrovercity does not verify the underlying deal."
        submitLabel="Submit Rating"
        onSubmit={async (stars, review) => {
          if (rateApp) await submitRating(rateApp, stars, review);
        }}
      />

      <ReportIssueModal
        application={reportApp}
        onClose={() => setReportApp(null)}
        onReported={() => undefined}
      />
    </div>
  );
};
