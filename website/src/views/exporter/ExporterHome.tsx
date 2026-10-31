import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Globe2, FileText, Inbox, Handshake, Loader2, Plus, ArrowRight } from 'lucide-react';
import { exporter } from '../../lib/api/exporter';
import { apiErrorMessage } from '../../lib/api';
import type { ExportApplication, ExportRfq } from '../../types';
import { ExportStatusBadge } from '../export/shared';

/**
 * Exporter — Home (spec §4.1): open requirement count, new applications,
 * recent connections, quick action to post a requirement. No shipping,
 * LC, escrow, forex, or order pipeline lives here.
 */
export const ExporterHome: React.FC = () => {
  const navigate = useNavigate();
  const [rfqs, setRfqs] = useState<ExportRfq[]>([]);
  const [connections, setConnections] = useState<ExportApplication[]>([]);
  const [newApplications, setNewApplications] = useState<ExportApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [rfqList, connList] = await Promise.all([exporter.rfqs(), exporter.connections()]);
      setRfqs(rfqList);
      setConnections(connList);
      const openRfqs = rfqList.filter((r) => r.status === 'open' || r.status === 'paused');
      const apps = (
        await Promise.all(
          openRfqs.map(async (r) => {
            try {
              return await exporter.rfqApplications(r.id);
            } catch {
              return [] as ExportApplication[];
            }
          }),
        )
      ).flat();
      setNewApplications(apps.filter((a) => a.status === 'submitted'));
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const openRfqs = rfqs.filter((r) => r.status === 'open').length;
  const draftRfqs = rfqs.filter((r) => r.status === 'draft').length;

  return (
    <div className="space-y-6">
      <div className="border-b border-slate-200 pb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 flex items-center gap-2">
            <Globe2 className="w-7 h-7 text-emerald-600" />
            Export Sourcing Home
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Post structured crop requirements, compare farmer applications, and connect directly.
            Sampling, contracts, payments, customs, freight, and insurance stay between you and the
            farmer — Agrovercity only connects you.
          </p>
        </div>
        <button
          type="button"
          onClick={() => navigate('/exporter/rfqs?new=1')}
          className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 text-white text-xs font-bold px-4 py-2.5 hover:bg-emerald-700 transition shadow-sm"
        >
          <Plus className="w-4 h-4" /> Post Export Requirement
        </button>
      </div>

      {error && (
        <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-2xl text-xs font-semibold text-rose-800">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-16 text-slate-400">
          <Loader2 className="w-6 h-6 animate-spin mr-2" /> Loading your sourcing desk…
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <StatCard icon={FileText} label="Open Requirements" value={openRfqs} sub={`${draftRfqs} draft`} />
            <StatCard
              icon={Inbox}
              label="New Applications"
              value={newApplications.length}
              sub="awaiting your review"
              highlight={newApplications.length > 0}
            />
            <StatCard icon={Handshake} label="Connections" value={connections.length} sub="contact unlocked" />
            <StatCard
              icon={Globe2}
              label="Total Requirements"
              value={rfqs.length}
              sub={`${rfqs.filter((r) => r.status === 'fulfilled').length} fulfilled`}
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <section className="rounded-3xl border border-slate-200 bg-white p-4">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-extrabold text-slate-800">New applications</h2>
                <button
                  type="button"
                  onClick={() => navigate('/exporter/applications')}
                  className="text-[11px] font-bold text-emerald-700 inline-flex items-center gap-1 hover:underline"
                >
                  Review all <ArrowRight className="w-3 h-3" />
                </button>
              </div>
              {newApplications.length === 0 ? (
                <p className="text-xs text-slate-400 italic">
                  No new applications. Farmers apply on your open requirements.
                </p>
              ) : (
                <ul className="space-y-2">
                  {newApplications.slice(0, 5).map((app) => (
                    <li key={app.id} className="flex items-center justify-between gap-2 text-xs">
                      <span className="font-semibold text-slate-700">
                        {app.farmer?.name || app.sellerName || 'Farmer'} · {app.rfq?.crop}
                        <span className="text-slate-400 ml-1">
                          {app.quantityOffered} {app.quantityUnit} @ {app.currency} {app.price}/{app.priceUnit}
                        </span>
                      </span>
                      <ExportStatusBadge status={app.status} />
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="rounded-3xl border border-slate-200 bg-white p-4">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-extrabold text-slate-800">Recent requirements</h2>
                <button
                  type="button"
                  onClick={() => navigate('/exporter/rfqs')}
                  className="text-[11px] font-bold text-emerald-700 inline-flex items-center gap-1 hover:underline"
                >
                  Manage <ArrowRight className="w-3 h-3" />
                </button>
              </div>
              {rfqs.length === 0 ? (
                <p className="text-xs text-slate-400 italic">
                  Post your first export requirement to start receiving farmer applications.
                </p>
              ) : (
                <ul className="space-y-2">
                  {rfqs.slice(0, 5).map((rfq) => (
                    <li key={rfq.id} className="flex items-center justify-between gap-2 text-xs">
                      <span className="font-semibold text-slate-700">
                        {rfq.crop}
                        <span className="text-slate-400 ml-1">
                          {rfq.quantityQuintals} {rfq.quantityUnit || 'q'} · {rfq.deliveryLocation}
                        </span>
                      </span>
                      <ExportStatusBadge status={rfq.status} />
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="rounded-3xl border border-slate-200 bg-white p-4 lg:col-span-2">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-extrabold text-slate-800">Recent connections</h2>
                <button
                  type="button"
                  onClick={() => navigate('/exporter/connections')}
                  className="text-[11px] font-bold text-emerald-700 inline-flex items-center gap-1 hover:underline"
                >
                  All connections <ArrowRight className="w-3 h-3" />
                </button>
              </div>
              {connections.length === 0 ? (
                <p className="text-xs text-slate-400 italic">
                  Farmers you contact appear here with Call, WhatsApp, and Chat.
                </p>
              ) : (
                <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {connections.slice(0, 4).map((app) => (
                    <li key={app.id} className="flex items-center justify-between gap-2 text-xs rounded-xl bg-slate-50 border border-slate-100 px-3 py-2">
                      <span className="font-semibold text-slate-700">
                        {app.farmer?.name || app.sellerName || 'Farmer'}
                        <span className="text-slate-400 ml-1">{app.rfq?.crop}</span>
                      </span>
                      <ExportStatusBadge status={app.status} />
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        </>
      )}
    </div>
  );
};

const StatCard: React.FC<{
  icon: React.ElementType;
  label: string;
  value: number;
  sub?: string;
  highlight?: boolean;
}> = ({ icon: Icon, label, value, sub, highlight }) => (
  <div
    className={`rounded-3xl border p-4 ${
      highlight ? 'border-emerald-300 bg-emerald-50/60' : 'border-slate-200 bg-white'
    }`}
  >
    <div className="flex items-center gap-2 text-slate-400">
      <Icon className="w-4 h-4" />
      <span className="text-[10px] font-extrabold uppercase tracking-wide">{label}</span>
    </div>
    <p className="mt-1 text-2xl font-black text-slate-900">{value}</p>
    {sub && <p className="text-[10px] text-slate-400 font-semibold">{sub}</p>}
  </div>
);
