import React, { useCallback, useEffect, useState } from 'react';
import { FileText, Loader2, Star, ShieldAlert, Phone, MessageSquare } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { exporter } from '../../lib/api/exporter';
import { apiErrorMessage, ratings } from '../../lib/api';
import type { ExportApplication } from '../../types';
import { RateUserModal } from '../../components/common/RateUserModal';
import {
  ContactActions,
  ExportStatusBadge,
  NegotiationChecklist,
  OutcomeModal,
  ReportIssueModal,
  VerificationBadges,
} from '../export/shared';

const FILTERS = [
  { value: '', label: 'All' },
  { value: 'submitted', label: 'Submitted' },
  { value: 'contacted', label: 'Contacted' },
  { value: 'dealDone', label: 'Deal Completed' },
  { value: 'closed', label: 'Closed' },
] as const;

/** Farmer — My Export Applications (spec §3.2, §12). */
export const MyExportApplicationsView: React.FC = () => {
  const navigate = useNavigate();
  const [applications, setApplications] = useState<ExportApplication[]>([]);
  const [filter, setFilter] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [outcomeApp, setOutcomeApp] = useState<ExportApplication | null>(null);
  const [rateApp, setRateApp] = useState<ExportApplication | null>(null);
  const [rateKey, setRateKey] = useState(0);
  const [reportApp, setReportApp] = useState<ExportApplication | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setApplications(await exporter.myApplications(filter || undefined));
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    load();
  }, [load]);

  const withdraw = async (app: ExportApplication) => {
    setBusyId(app.id);
    try {
      const updated = await exporter.withdrawApplication(app.id);
      setApplications((prev) => prev.map((a) => (a.id === updated.id ? updated : a)));
      setNotice('Application withdrawn. You can apply again on the same requirement.');
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setBusyId(null);
    }
  };

  const reportOutcome = async (app: ExportApplication, payload: Parameters<
    (typeof exporter)['reportOutcome']
  >[1]) => {
    const updated = await exporter.reportOutcome(app.id, payload);
    setApplications((prev) => prev.map((a) => (a.id === updated.id ? updated : a)));
    setNotice('Outcome updated. It is a user-reported record only.');
  };

  return (
    <div className="space-y-6">
      <div className="border-b border-slate-200 pb-4">
        <h1 className="text-2xl font-extrabold text-slate-900 flex items-center gap-2">
          <FileText className="w-7 h-7 text-emerald-600" />
          My Export Applications
        </h1>
        <p className="text-xs text-slate-500 mt-1">
          Track what you applied for. When an exporter unlocks your contact, Call, WhatsApp, and Chat
          open here.
        </p>
        <div className="flex flex-wrap gap-2 mt-3">
          {FILTERS.map((f) => (
            <button
              key={f.value}
              type="button"
              onClick={() => setFilter(f.value)}
              className={`text-xs font-bold rounded-xl px-3 py-1.5 border transition ${
                filter === f.value
                  ? 'bg-emerald-600 text-white border-emerald-600'
                  : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

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
          <Loader2 className="w-6 h-6 animate-spin mr-2" /> Loading applications…
        </div>
      ) : applications.length === 0 ? (
        <div className="p-10 text-center rounded-3xl border-2 border-dashed border-slate-200">
          <FileText className="w-10 h-10 mx-auto text-slate-300" />
          <p className="mt-3 text-sm font-bold text-slate-600">No applications here yet</p>
          <p className="mt-1 text-xs text-slate-400">
            Browse export opportunities and apply with your available supply.
          </p>
          <button
            type="button"
            onClick={() => navigate('/farmer/export')}
            className="mt-4 rounded-xl bg-emerald-600 text-white text-xs font-bold px-4 py-2 hover:bg-emerald-700 transition"
          >
            Find Export Opportunities
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {applications.map((app) => {
            const connected = !!app.contactReveal;
            return (
              <div key={app.id} className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <h3 className="text-sm font-extrabold text-slate-900">
                      {app.rfq?.crop || 'Crop requirement'}
                      {app.rfq?.variety ? ` — ${app.rfq.variety}` : ''}
                      <span className="ml-2 text-xs font-semibold text-slate-400">
                        {app.exporter?.companyName || app.exporter?.name || 'Exporter'}
                      </span>
                    </h3>
                    <p className="text-[11px] text-slate-400">
                      Offered {app.quantityOffered} {app.quantityUnit} @ {app.currency} {app.price}/
                      {app.priceUnit} · {app.supplyBasis === 'farmGate' ? 'farm gate' : app.supplyBasis} ·
                      available {app.availableDate}
                    </p>
                  </div>
                  <ExportStatusBadge status={app.status} />
                </div>

                <div className="mt-2">
                  <VerificationBadges
                    identityVerified={app.exporter?.identityVerified}
                    businessVerified={app.exporter?.businessVerified}
                    compact
                  />
                </div>

                {app.outcome && (
                  <p className="mt-2 text-[11px] font-semibold text-slate-500">
                    Outcome:{' '}
                    {app.outcome.value === 'dealDoneOffline'
                      ? 'Supply deal completed offline'
                      : app.outcome.value === 'stillInContact'
                        ? 'Still in contact'
                        : app.outcome.value === 'didNotHappen'
                          ? 'Did not happen'
                          : 'Withdrawn'}
                  </p>
                )}

                {connected ? (
                  <>
                    <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3 items-start">
                      <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-3">
                        <p className="text-[10px] font-extrabold text-emerald-700 uppercase">
                          Exporter contact unlocked
                        </p>
                        <p className="text-xs font-bold text-slate-800 mt-1">
                          {app.contactReveal?.exporter.fullName}
                          {app.contactReveal?.exporter.district
                            ? ` · ${app.contactReveal.exporter.district}`
                            : ''}
                        </p>
                        <div className="mt-2 flex items-center gap-3 text-[11px] text-slate-500">
                          {app.contactReveal?.exporter.phone && (
                            <span className="inline-flex items-center gap-1">
                              <Phone className="w-3 h-3" /> {app.contactReveal.exporter.phone}
                            </span>
                          )}
                          {app.contactReveal?.exporter.whatsappDigits && (
                            <span className="inline-flex items-center gap-1">
                              <MessageSquare className="w-3 h-3" /> WhatsApp available
                            </span>
                          )}
                        </div>
                      </div>
                      <ContactActions
                        contact={app.contactReveal?.exporter}
                        chatRoomId={app.chatRoomId}
                        vertical
                      />
                    </div>
                    {app.negotiationChecklist && app.negotiationChecklist.length > 0 && (
                      <div className="mt-3">
                        <NegotiationChecklist items={app.negotiationChecklist} />
                      </div>
                    )}
                  </>
                ) : (
                  app.status === 'submitted' && (
                    <p className="mt-3 text-[11px] text-slate-400 italic">
                      Contact details stay hidden until the exporter verifies and unlocks your contact.
                    </p>
                  )
                )}

                <div className="mt-3 flex flex-wrap gap-2">
                  {app.status === 'submitted' && (
                    <button
                      type="button"
                      disabled={busyId === app.id}
                      onClick={() => withdraw(app)}
                      className="rounded-xl border border-slate-200 text-slate-600 text-[11px] font-bold px-3 py-1.5 hover:bg-slate-50 transition disabled:opacity-50"
                    >
                      {busyId === app.id ? 'Withdrawing…' : 'Withdraw'}
                    </button>
                  )}
                  {app.status === 'contacted' && (
                    <button
                      type="button"
                      onClick={() => setOutcomeApp(app)}
                      className="rounded-xl border border-slate-200 text-slate-700 text-[11px] font-bold px-3 py-1.5 hover:bg-slate-50 transition"
                    >
                      Update Outcome
                    </button>
                  )}
                  {connected && (
                    <>
                      <button
                        type="button"
                        onClick={() => {
                          setRateApp(app);
                          setRateKey((k) => k + 1);
                        }}
                        className="inline-flex items-center gap-1 rounded-xl border border-amber-200 bg-amber-50 text-amber-700 text-[11px] font-bold px-3 py-1.5 hover:bg-amber-100 transition"
                      >
                        <Star className="w-3 h-3" /> Rate Exporter
                      </button>
                      <button
                        type="button"
                        onClick={() => setReportApp(app)}
                        className="inline-flex items-center gap-1 rounded-xl border border-rose-200 bg-rose-50 text-rose-700 text-[11px] font-bold px-3 py-1.5 hover:bg-rose-100 transition"
                      >
                        <ShieldAlert className="w-3 h-3" /> Report Issue
                      </button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
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
        title={`Rate ${rateApp?.exporter?.companyName || rateApp?.exporter?.name || 'Exporter'}`}
        subtitle="For confirmed connections only — Agrovercity does not verify the deal itself."
        onSubmit={async (stars, review) => {
          if (rateApp) {
            await ratings.submit({
              bookingKind: 'export_connection',
              bookingId: rateApp.id,
              stars,
              comment: review,
            });
            setNotice('Rating submitted. Thank you.');
          }
        }}
      />
      <ReportIssueModal application={reportApp} onClose={() => setReportApp(null)} onReported={() => undefined} />
    </div>
  );
};
