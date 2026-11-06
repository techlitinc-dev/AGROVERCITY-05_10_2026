import React, { useEffect, useState } from 'react';
import { Gift, CheckCircle2, ExternalLink } from 'lucide-react';
import { schemes, apiErrorMessage } from '../../lib/api';
import { formatDate } from '../../lib/utils';

const asRecord = (v: unknown): Record<string, unknown> =>
  v !== null && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
const asStr = (v: unknown, fallback = ''): string => (typeof v === 'string' ? v : fallback);

export const GovtSchemesView: React.FC = () => {
  const [schemeList, setSchemeList] = useState<unknown[]>([]);
  const [portals, setPortals] = useState<unknown[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    Promise.all([
      schemes.list().catch(() => []),
      schemes.portals().catch(() => []),
    ])
      .then(([s, p]) => {
        if (!active) return;
        setSchemeList(s);
        setPortals(p);
      })
      .catch((e) => active && setError(apiErrorMessage(e)))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, []);

  const handleApply = async (id: string, title: string) => {
    setError(null);
    setBusyId(id);
    try {
      await schemes.apply(id, {});
      setNotice(`Application for "${title}" submitted.`);
    } catch (e) {
      setError(apiErrorMessage(e));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="border-b border-slate-200 pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 flex items-center gap-2">
            <Gift className="w-7 h-7 text-emerald-600" />
            Govt Schemes (Sarkari Yojana)
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Personalized DBT subsidy recommendations for your profile
          </p>
        </div>
      </div>

      {error && (
        <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-2xl text-xs font-semibold text-rose-800">
          {error}
        </div>
      )}
      {notice && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-2xl text-xs font-semibold text-emerald-800 flex items-center justify-between">
          <span>{notice}</span>
          <button onClick={() => setNotice(null)} className="font-bold hover:underline">Dismiss</button>
        </div>
      )}

      <div className="space-y-4">
        {loading ? (
            <div className="py-10 text-center text-xs font-bold text-slate-400 animate-pulse">
              Loading schemes…
            </div>
          ) : schemeList.length === 0 ? (
            <div className="py-10 text-center text-xs font-semibold text-slate-400 bg-white rounded-3xl border border-slate-200/80">
              No schemes matched to your profile yet. Complete KYC and link your 7/12 records.
            </div>
          ) : (
            schemeList.map((sch, i) => {
              const r = asRecord(sch);
              const id = asStr(r.id, String(i));
              const title = asStr(r.title ?? r.name, 'Government Scheme');
              return (
                <div
                  key={id}
                  className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                >
                  <div className="space-y-1.5 max-w-xl">
                    <span className="text-[10px] uppercase font-bold text-emerald-800 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
                      {asStr(r.category ?? r.ministry, 'Agriculture')}
                    </span>
                    <h4 className="font-extrabold text-base text-slate-900">{title}</h4>
                    <p className="text-xs font-bold text-emerald-700">
                      {asStr(r.benefit, asStr(r.subsidy, ''))}
                    </p>
                    <p className="text-xs text-slate-500">
                      Eligibility: {asStr(r.eligibility, asStr(r.description, 'All farmers'))}
                    </p>
                    {asStr(r.deadline) && (
                      <p className="text-[11px] text-amber-700 font-semibold">
                        Deadline: {formatDate(asStr(r.deadline))}
                      </p>
                    )}
                  </div>

                  <div className="flex flex-col sm:items-end gap-2">
                    {r.isEligible === true && (
                      <span className="text-xs font-bold text-emerald-700 flex items-center gap-1">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" /> You are eligible!
                      </span>
                    )}
                    <button
                      onClick={() => handleApply(id, title)}
                      disabled={busyId === id}
                      className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs disabled:opacity-50"
                    >
                      {busyId === id ? 'Applying…' : 'Apply Now'}
                    </button>
                  </div>
                </div>
              );
            })
          )}

          {/* External portals */}
          {portals.length > 0 && (
            <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs space-y-3">
              <h3 className="font-bold text-sm text-slate-900">State & National Agri Portals</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {portals.map((p, i) => {
                  const r = asRecord(p);
                  const url = asStr(r.url ?? r.link);
                  return (
                    <a
                      key={asStr(r.id, String(i))}
                      href={url || '#'}
                      target={url ? '_blank' : undefined}
                      rel="noreferrer"
                      className="p-3.5 bg-slate-50 hover:bg-slate-100 rounded-2xl border border-slate-100 flex items-center justify-between text-xs transition-colors"
                    >
                      <div>
                        <p className="font-bold text-slate-900">{asStr(r.name ?? r.title, 'Portal')}</p>
                        <p className="text-[10px] text-slate-400">{asStr(r.description, '')}</p>
                      </div>
                      <ExternalLink className="w-4 h-4 text-slate-400" />
                    </a>
                  );
                })}
              </div>
            </div>
          )}
      </div>
    </div>
  );
};
