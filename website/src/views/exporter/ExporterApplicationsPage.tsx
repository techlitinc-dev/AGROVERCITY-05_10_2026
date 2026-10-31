import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Inbox, Loader2 } from 'lucide-react';
import { exporter } from '../../lib/api/exporter';
import { apiErrorMessage } from '../../lib/api';
import type { ExportApplication, ExportRfq } from '../../types';
import {
  ContactActions,
  ContactUnlockModal,
  ExportStatusBadge,
  NegotiationChecklist,
  VerificationBadges,
} from '../export/shared';

const FILTERS = [
  { value: '', label: 'All' },
  { value: 'submitted', label: 'Submitted' },
  { value: 'contacted', label: 'Contacted' },
  { value: 'dealDone', label: 'Deal Completed' },
  { value: 'closed', label: 'Closed' },
] as const;

/**
 * Exporter — Applications Received (spec §4.4, §8).
 * Compare farmer applications across requirements; contact or dismiss.
 * No "Best Offer" auto-labels, no currency conversion, no quality claims —
 * farmers' certificates show verified only after an actual review.
 */
export const ExporterApplicationsPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const [rfqs, setRfqs] = useState<ExportRfq[]>([]);
  const [applications, setApplications] = useState<ExportApplication[]>([]);
  const [filter, setFilter] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [contactApp, setContactApp] = useState<ExportApplication | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const rfqList = await exporter.rfqs();
      setRfqs(rfqList);
      const all = (
        await Promise.all(
          rfqList.map(async (r) => {
            try {
              return await exporter.rfqApplications(r.id);
            } catch {
              return [] as ExportApplication[];
            }
          }),
        )
      ).flat();
      setApplications(all);
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const rfqById = useMemo(() => Object.fromEntries(rfqs.map((r) => [r.id, r])), [rfqs]);
  const visible = useMemo(
    () =>
      applications.filter((a) => {
        if (!filter) return true;
        if (filter === 'closed') return ['dismissed', 'withdrawn', 'rejected'].includes(a.status);
        return a.status === filter;
      }),
    [applications, filter],
  );

  // Optional deep link: ?rfq=erq_xxx focuses one requirement
  const focusRfq = searchParams.get('rfq');
  const focused = useMemo(
    () => (focusRfq ? visible.filter((a) => a.rfqId === focusRfq) : visible),
    [visible, focusRfq],
  );

  const dismiss = async (app: ExportApplication) => {
    setBusyId(app.id);
    try {
      const updated = await exporter.dismissApplication(app.id);
      setApplications((prev) => prev.map((a) => (a.id === updated.id ? updated : a)));
      setNotice('Application dismissed. The farmer is informed.');
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setBusyId(null);
    }
  };

  const onUnlocked = (updated: ExportApplication) => {
    setApplications((prev) => prev.map((a) => (a.id === updated.id ? updated : a)));
    setContactApp(null);
    setNotice('Contact unlocked — call, WhatsApp, and chat are now open for both parties.');
  };

  return (
    <div className="space-y-6">
      <div className="border-b border-slate-200 pb-4">
        <h1 className="text-2xl font-extrabold text-slate-900 flex items-center gap-2">
          <Inbox className="w-7 h-7 text-emerald-600" />
          Applications Received
        </h1>
        <p className="text-xs text-slate-500 mt-1">
          Compare farmers on quantity, location, quality information, certification evidence,
          availability, packaging, supply basis, and price. Contact unlocks details after terms and
          MPIN — it never accepts an application or creates an order. Original units and currencies
          are shown as quoted (no conversion).
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
      ) : focused.length === 0 ? (
        <div className="p-10 text-center rounded-3xl border-2 border-dashed border-slate-200">
          <Inbox className="w-10 h-10 mx-auto text-slate-300" />
          <p className="mt-3 text-sm font-bold text-slate-600">No applications here</p>
          <p className="mt-1 text-xs text-slate-400">
            Farmers apply on your open requirements — keep requirements clear and current.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {focused.map((app) => {
            const rfq = rfqById[app.rfqId];
            return (
              <div key={app.id} className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-extrabold text-slate-900">
                      {app.farmer?.name || app.sellerName || 'Farmer'}
                      <span className="ml-2 text-xs font-semibold text-slate-400">
                        for {rfq?.crop || app.rfq?.crop || 'requirement'}
                        {rfq?.status === 'closed' || rfq?.status === 'fulfilled'
                          ? ` (${rfq.status})`
                          : ''}
                      </span>
                    </p>
                    <VerificationBadges identityVerified={app.farmer?.identityVerified} compact />
                  </div>
                  <ExportStatusBadge status={app.status} />
                </div>

                <div className="mt-2 grid grid-cols-2 sm:grid-cols-4 gap-x-3 gap-y-1 text-[11px] text-slate-600">
                  <span>
                    <strong>{app.quantityOffered} {app.quantityUnit}</strong> offered
                  </span>
                  <span>
                    <strong>{app.currency} {app.price}</strong>/{app.priceUnit}
                  </span>
                  <span>
                    {app.supplyBasis === 'farmGate' ? 'Farm gate' : app.supplyBasis} · {app.supplyLocation}
                  </span>
                  <span>available {app.availableDate}</span>
                </div>
                <div className="mt-1 flex flex-wrap gap-1.5 text-[10px]">
                  {app.qualityDetails && (
                    <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 font-bold">{app.qualityDetails}</span>
                  )}
                  {(app.certificationNames || []).map((c) => (
                    <span key={c} className="px-2 py-0.5 rounded-full bg-violet-50 text-violet-700 font-bold">{c}</span>
                  ))}
                  {(app.documents || []).map((d) => (
                    <span
                      key={d.id}
                      className={`px-2 py-0.5 rounded-full font-bold border ${
                        d.verified
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          : 'bg-slate-50 text-slate-400 border-slate-200'
                      }`}
                      title={d.verified ? 'Certificate reviewed' : 'Uploaded — review pending; never auto-verified'}
                    >
                      {d.fileName || d.docType || 'Document'} {d.verified ? '✓ verified' : '(unreviewed)'}
                    </span>
                  ))}
                  {app.photos && app.photos.length > 0 && (
                    <span className="px-2 py-0.5 rounded-full bg-sky-50 text-sky-700 font-bold">
                      {app.photos.length} photo{app.photos.length > 1 ? 's' : ''}
                    </span>
                  )}
                  {app.packagingCapability && (
                    <span className="px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 font-bold">{app.packagingCapability}</span>
                  )}
                  {app.previousExperience && (
                    <span className="px-2 py-0.5 rounded-full bg-sky-50 text-sky-700 font-bold">Experience: {app.previousExperience}</span>
                  )}
                </div>
                {app.message && <p className="mt-1.5 text-[11px] italic text-slate-500">"{app.message}"</p>}
                <p className="mt-1 text-[10px] text-slate-400">
                  Applied {new Date(app.createdAt).toLocaleDateString()}
                  {rfq?.partialQuantityAllowed === false ? ' · this RFQ required the full quantity' : ''}
                </p>

                {app.contactReveal ? (
                  <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-3">
                      <p className="text-[10px] font-extrabold text-emerald-700 uppercase">Farmer contact</p>
                      <p className="text-xs font-bold text-slate-800 mt-1">{app.contactReveal.farmer.fullName}</p>
                      <p className="text-[11px] text-slate-500">{app.contactReveal.farmer.phone}</p>
                    </div>
                    <ContactActions contact={app.contactReveal.farmer} chatRoomId={app.chatRoomId} vertical />
                  </div>
                ) : (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {app.status === 'submitted' && (
                      <>
                        <button
                          type="button"
                          onClick={() => setContactApp(app)}
                          className="rounded-xl bg-emerald-600 text-white text-[11px] font-bold px-3 py-1.5 hover:bg-emerald-700 transition"
                        >
                          Contact Farmer
                        </button>
                        <button
                          type="button"
                          disabled={busyId === app.id}
                          onClick={() => dismiss(app)}
                          className="rounded-xl border border-slate-200 text-slate-500 text-[11px] font-bold px-3 py-1.5 hover:bg-slate-50 transition disabled:opacity-50"
                        >
                          Dismiss
                        </button>
                      </>
                    )}
                  </div>
                )}
                {app.contactReveal && app.negotiationChecklist && app.negotiationChecklist.length > 0 && (
                  <div className="mt-3">
                    <NegotiationChecklist items={app.negotiationChecklist} />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <ContactUnlockModal application={contactApp} onClose={() => setContactApp(null)} onUnlocked={onUnlocked} />
    </div>
  );
};
