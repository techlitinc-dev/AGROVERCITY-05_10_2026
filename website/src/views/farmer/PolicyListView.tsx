import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FileCheck2,
  ArrowLeft,
  Download,
  ShieldCheck,
  Plus,
  CheckCircle2,
} from 'lucide-react';
import { insurance, apiErrorMessage } from '../../lib/api';
import { ModalSheet } from '../../components/common/ModalSheet';
import { StatusBadge } from '../../components/common/StatusBadge';
import { formatCurrency, formatDate } from '../../lib/utils';

const asRecord = (v: unknown): Record<string, unknown> =>
  v !== null && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
const asStr = (v: unknown, fallback = ''): string => (typeof v === 'string' ? v : fallback);
const asNum = (v: unknown, fallback = 0): number => (typeof v === 'number' && !Number.isNaN(v) ? v : fallback);

export const PolicyListView: React.FC = () => {
  const navigate = useNavigate();
  const [policies, setPolicies] = useState<unknown[]>([]);
  const [schemes, setSchemes] = useState<unknown[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [applyModal, setApplyModal] = useState<Record<string, unknown> | null>(null);
  const [applyCrop, setApplyCrop] = useState('Soybean');
  const [applySurvey, setApplySurvey] = useState('Gat No. 312');

  const reload = async () => {
    const [p, s] = await Promise.all([insurance.policies(), insurance.schemes().catch(() => [])]);
    setPolicies(p);
    setSchemes(s);
  };

  useEffect(() => {
    let active = true;
    setLoading(true);
    reload()
      .catch((e) => active && setError(apiErrorMessage(e)))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, []);

  const downloadCertificate = async (policyId: string) => {
    setError(null);
    try {
      const blob = await insurance.policyCertificate(policyId);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `policy-${policyId}-certificate.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError(apiErrorMessage(e));
    }
  };

  const handleApply = async () => {
    if (!applyModal) return;
    setBusyId(asStr(applyModal.id));
    setError(null);
    try {
      await insurance.applyPolicy({
        schemeId: applyModal.id,
        crop: applyCrop,
        surveyNumber: applySurvey,
      });
      await reload();
      setApplyModal(null);
      setNotice('Policy application submitted for underwriting.');
    } catch (e) {
      setError(apiErrorMessage(e));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/farmer/insurance')}
            className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 transition-colors"
            title="Back to insurance desk"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <h1 className="text-2xl font-extrabold text-slate-900 flex items-center gap-2">
              <FileCheck2 className="w-7 h-7 text-emerald-600" />
              My Crop Insurance Policies
            </h1>
            <p className="text-xs text-slate-500 mt-1">
              Active covers, certificates, and enrolment into PMFBY schemes
            </p>
          </div>
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

      {loading ? (
        <div className="py-10 text-center text-xs font-bold text-slate-400 animate-pulse">
          Loading policies…
        </div>
      ) : (
        <>
          <div className="space-y-4">
            <h3 className="font-bold text-sm text-slate-900">Active Policies ({policies.length})</h3>
            {policies.length === 0 ? (
              <div className="py-10 text-center text-xs font-semibold text-slate-400 bg-white rounded-3xl border border-slate-200/80">
                No active policies. Enrol in a scheme below to get covered before the next season.
              </div>
            ) : (
              policies.map((p, i) => {
                const r = asRecord(p);
                const id = asStr(r.id, String(i));
                return (
                  <div key={id} className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="font-bold text-base text-slate-900">
                            {asStr(r.crop, 'Crop')} — {asStr(r.schemeName ?? r.scheme, 'PMFBY')}
                          </h4>
                          <StatusBadge status={asStr(r.status, 'active')} />
                        </div>
                        <p className="text-xs text-slate-400 font-mono">
                          Policy {asStr(r.policyNumber ?? r.number, '—')}
                        </p>
                      </div>
                      <button
                        onClick={() => downloadCertificate(id)}
                        className="px-3.5 py-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold text-xs flex items-center gap-1.5 self-start sm:self-auto"
                      >
                        <Download className="w-3.5 h-3.5" /> Download Certificate
                      </button>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                      <div className="p-3 bg-slate-50 rounded-2xl">
                        <span className="text-slate-400 font-semibold block text-[10px] uppercase">Sum Insured</span>
                        <span className="font-bold text-slate-900">{formatCurrency(asNum(r.sumInsured ?? r.coverage, 0))}</span>
                      </div>
                      <div className="p-3 bg-slate-50 rounded-2xl">
                        <span className="text-slate-400 font-semibold block text-[10px] uppercase">Premium Paid</span>
                        <span className="font-bold text-slate-900">{formatCurrency(asNum(r.premium, 0))}</span>
                      </div>
                      <div className="p-3 bg-slate-50 rounded-2xl">
                        <span className="text-slate-400 font-semibold block text-[10px] uppercase">Season</span>
                        <span className="font-bold text-slate-900">{asStr(r.season, 'Kharif 2026')}</span>
                      </div>
                      <div className="p-3 bg-slate-50 rounded-2xl">
                        <span className="text-slate-400 font-semibold block text-[10px] uppercase">Valid Till</span>
                        <span className="font-bold text-slate-900">{formatDate(asStr(r.validTill ?? r.expiryDate, ''))}</span>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Available schemes to enrol */}
          <div className="space-y-4">
            <h3 className="font-bold text-sm text-slate-900">Available Schemes ({schemes.length})</h3>
            {schemes.length === 0 ? (
              <div className="py-8 text-center text-xs font-semibold text-slate-400 bg-white rounded-3xl border border-slate-200/80">
                No schemes open for enrolment right now.
              </div>
            ) : (
              schemes.map((s, i) => {
                const r = asRecord(s);
                const id = asStr(r.id, String(i));
                return (
                  <div
                    key={id}
                    className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                  >
                    <div className="space-y-1.5 max-w-xl">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[10px] uppercase font-bold text-emerald-800 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
                          {asStr(r.category ?? r.type, 'Crop Insurance')}
                        </span>
                        {r.isEligible === true && (
                          <span className="text-[10px] font-bold text-emerald-700 flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3" /> You are eligible
                          </span>
                        )}
                      </div>
                      <h4 className="font-extrabold text-base text-slate-900">{asStr(r.name ?? r.title, 'Scheme')}</h4>
                      <p className="text-xs text-slate-500">
                        Coverage {formatCurrency(asNum(r.sumInsured ?? r.coverage, 0))}
                        {asNum(r.premiumPercent, 0) > 0 ? ` • Premium ${asNum(r.premiumPercent)}%` : ''}
                        {asNum(r.subsidyPercent, 0) > 0 ? ` • ${asNum(r.subsidyPercent)}% govt subsidy` : ''}
                      </p>
                    </div>
                    <button
                      onClick={() => setApplyModal(r)}
                      className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs flex items-center gap-1.5 self-start sm:self-auto"
                    >
                      <Plus className="w-3.5 h-3.5" /> Apply / Enrol
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </>
      )}

      {/* Apply modal */}
      <ModalSheet
        isOpen={Boolean(applyModal)}
        onClose={() => setApplyModal(null)}
        title="Apply for Policy"
        description={`Enrol in ${asStr(applyModal?.name ?? applyModal?.title, 'this scheme')}`}
        maxWidth="sm"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Crop</label>
            <select
              value={applyCrop}
              onChange={(e) => setApplyCrop(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 bg-white"
            >
              <option value="Soybean">Soybean</option>
              <option value="Wheat">Wheat</option>
              <option value="Onion">Onion</option>
              <option value="Cotton">Cotton</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Survey / Gat Number</label>
            <input
              type="text"
              value={applySurvey}
              onChange={(e) => setApplySurvey(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300"
            />
          </div>
          <button
            onClick={handleApply}
            disabled={busyId === asStr(applyModal?.id)}
            className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md disabled:opacity-60 flex items-center justify-center gap-1.5"
          >
            <ShieldCheck className="w-4 h-4" />
            {busyId === asStr(applyModal?.id) ? 'Submitting…' : 'Confirm Application'}
          </button>
        </div>
      </ModalSheet>
    </div>
  );
};
