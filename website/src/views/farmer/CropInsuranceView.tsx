import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ShieldAlert,
  AlertTriangle,
  Camera,
  Check,
  Plus,
  FileCheck2,
  ArrowRight,
  Download,
} from 'lucide-react';
import { insurance, apiErrorMessage } from '../../lib/api';
import { ModalSheet } from '../../components/common/ModalSheet';
import { StatusBadge } from '../../components/common/StatusBadge';
import { formatCurrency, formatDate } from '../../lib/utils';
import type { CropInsuranceClaim } from '../../types';

const asRecord = (v: unknown): Record<string, unknown> =>
  v !== null && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
const asArray = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const asStr = (v: unknown, fallback = ''): string => (typeof v === 'string' ? v : fallback);
const asNum = (v: unknown, fallback = 0): number => (typeof v === 'number' && !Number.isNaN(v) ? v : fallback);

type Tab = 'claims' | 'policies' | 'schemes';

export const CropInsuranceView: React.FC = () => {
  const [tab, setTab] = useState<Tab>('claims');
  const [claims, setClaims] = useState<CropInsuranceClaim[]>([]);
  const [policies, setPolicies] = useState<unknown[]>([]);
  const [schemes, setSchemes] = useState<unknown[]>([]);
  const [rates, setRates] = useState<unknown[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const [intimateModalOpen, setIntimateModalOpen] = useState(false);
  const [applyingScheme, setApplyingScheme] = useState<Record<string, unknown> | null>(null);

  // Intimation form
  const [crop, setCrop] = useState('Soybean');
  const [policyNumber, setPolicyNumber] = useState('');
  const [surveyNumber, setSurveyNumber] = useState('Gat No. 312');
  const [calamity, setCalamity] = useState<CropInsuranceClaim['calamityType']>('Excess Rainfall / Flood');
  const [calamityDate, setCalamityDate] = useState('2026-10-15');
  const [damagePercent, setDamagePercent] = useState(40);
  const [estLoss, setEstLoss] = useState(28000);
  const [photoUrl, setPhotoUrl] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let active = true;
    setLoading(true);
    Promise.all([
      insurance.claims(),
      insurance.policies().catch(() => []),
      insurance.schemes().catch(() => []),
      insurance.rates().catch(() => []),
    ])
      .then(([c, p, s, r]) => {
        if (!active) return;
        setClaims(c);
        setPolicies(p);
        setSchemes(s);
        setRates(r);
        if (p.length > 0) {
          const first = asRecord(p[0]);
          setPolicyNumber(asStr(first.policyNumber ?? first.number, ''));
        }
      })
      .catch((e) => active && setError(apiErrorMessage(e)))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, []);

  const handleIntimate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const created = await insurance.intimateClaim({
        policyNumber: policyNumber || undefined,
        crop,
        surveyNumber,
        calamityType: calamity,
        calamityDate,
        damagePercentage: damagePercent,
        estimatedLossAmount: estLoss,
        photos: photoUrl ? [photoUrl] : [],
      });
      setClaims((prev) => [created, ...prev]);
      setIntimateModalOpen(false);
      setTab('claims');
      setNotice(`Claim #${created.id} intimated. Surveyor will be assigned within 48 hours.`);
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  const handleAppeal = async (claim: CropInsuranceClaim) => {
    setError(null);
    setBusyId(claim.id);
    try {
      await insurance.appealClaim(claim.id, {
        reason: 'Farmer appeal against rejected/under-assessed claim',
      });
      setNotice(`Appeal submitted for claim #${claim.id}. The nodal officer will re-verify.`);
    } catch (e) {
      setError(apiErrorMessage(e));
    } finally {
      setBusyId(null);
    }
  };

  const handleApplyPolicy = async (scheme: Record<string, unknown>) => {
    setError(null);
    setBusyId(asStr(scheme.id));
    try {
      await insurance.applyPolicy({ schemeId: scheme.id, crop: asStr(scheme.crop, crop) });
      setApplyingScheme(null);
      setNotice(`Policy application for ${asStr(scheme.name ?? scheme.title, 'scheme')} submitted.`);
    } catch (e) {
      setError(apiErrorMessage(e));
    } finally {
      setBusyId(null);
    }
  };

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

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 flex items-center gap-2">
            <ShieldAlert className="w-7 h-7 text-emerald-600" />
            PMFBY Crop Insurance & Claim Desk
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Pradhan Mantri Fasal Bima Yojana — 72-hour crop loss intimation, surveyor tracking, and Direct Benefit Transfer (DBT)
          </p>
        </div>

        <div className="flex gap-2 self-start sm:self-auto">
          <Link
            to="/farmer/insurance/policies"
            className="px-4 py-2.5 rounded-2xl border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold text-xs flex items-center gap-2 transition-all"
          >
            <FileCheck2 className="w-4 h-4" />
            <span>My Policies</span>
          </Link>
          <button
            onClick={() => setIntimateModalOpen(true)}
            className="px-4 py-2.5 rounded-2xl bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white font-bold text-xs shadow-md flex items-center gap-2 transition-all"
          >
            <AlertTriangle className="w-4 h-4" />
            <span>Intimate Crop Loss (72h)</span>
          </button>
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

      {/* Tabs */}
      <div className="flex bg-slate-100 p-1 rounded-2xl self-start w-fit">
        {(['claims', 'policies', 'schemes'] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all capitalize ${
              tab === t ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500'
            }`}
          >
            {t === 'claims' ? `My Claims (${claims.length})` : t === 'policies' ? `My Policies (${policies.length})` : 'Schemes & Rates'}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="py-10 text-center text-xs font-bold text-slate-400 animate-pulse">
          Loading insurance desk…
        </div>
      ) : tab === 'claims' ? (
        /* Claims Timeline List */
        <div className="space-y-4">
          {claims.length === 0 ? (
            <div className="py-10 text-center text-xs font-semibold text-slate-400 bg-white rounded-3xl border border-slate-200/80">
              No claims yet. In case of crop loss, intimate within 72 hours of the calamity.
            </div>
          ) : (
            claims.map((claim) => (
              <div
                key={claim.id}
                className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs space-y-4"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="font-bold text-base text-slate-900">{claim.crop} Damage Claim</h4>
                      <span className="font-mono text-xs text-slate-400">#{claim.id}</span>
                    </div>
                    <p className="text-xs text-slate-500">
                      Policy: <strong>{claim.policyNumber}</strong> • {claim.surveyNumber}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <StatusBadge status={claim.status} />
                    <Link
                      to={`/farmer/insurance/claims/${claim.id}`}
                      className="px-3 py-1.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold text-[10px] flex items-center gap-1"
                    >
                      Track <ArrowRight className="w-3 h-3" />
                    </Link>
                  </div>
                </div>

                {/* Claim details */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                  <div className="p-3 bg-slate-50 rounded-2xl">
                    <span className="text-slate-400 font-semibold block text-[10px] uppercase">Calamity Type</span>
                    <span className="font-bold text-slate-900">{claim.calamityType}</span>
                  </div>
                  <div className="p-3 bg-slate-50 rounded-2xl">
                    <span className="text-slate-400 font-semibold block text-[10px] uppercase">Incident Date</span>
                    <span className="font-bold text-slate-900">{formatDate(claim.calamityDate)}</span>
                  </div>
                  <div className="p-3 bg-slate-50 rounded-2xl">
                    <span className="text-slate-400 font-semibold block text-[10px] uppercase">Damage Assessed</span>
                    <span className="font-bold text-rose-700">{claim.damagePercentage}% Area Lost</span>
                  </div>
                  <div className="p-3 bg-slate-50 rounded-2xl">
                    <span className="text-slate-400 font-semibold block text-[10px] uppercase">Estimated DBT</span>
                    <span className="font-black text-emerald-700">{formatCurrency(claim.estimatedLossAmount)}</span>
                  </div>
                </div>

                {/* Photos + appeal */}
                <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                  {claim.photos.length > 0 && (
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-slate-400 font-medium">Geo-Tagged Field Photos:</span>
                      <div className="flex gap-2">
                        {claim.photos.map((src, i) => (
                          <img
                            key={i}
                            src={src}
                            alt="Crop damage proof"
                            className="w-14 h-14 rounded-xl object-cover border border-slate-200"
                          />
                        ))}
                      </div>
                    </div>
                  )}

                  {claim.status === 'rejected' && (
                    <button
                      onClick={() => handleAppeal(claim)}
                      disabled={busyId === claim.id}
                      className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs shadow-xs disabled:opacity-50"
                    >
                      {busyId === claim.id ? 'Submitting…' : 'Appeal Rejection'}
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      ) : tab === 'policies' ? (
        /* Policies list */
        <div className="space-y-4">
          {policies.length === 0 ? (
            <div className="py-10 text-center text-xs font-semibold text-slate-400 bg-white rounded-3xl border border-slate-200/80">
              No active policies. Apply for a PMFBY scheme below.
            </div>
          ) : (
            policies.map((p, i) => {
              const r = asRecord(p);
              const id = asStr(r.id, String(i));
              return (
                <div key={id} className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <h4 className="font-bold text-base text-slate-900">
                        {asStr(r.crop, 'Crop')} — {asStr(r.schemeName ?? r.scheme, 'PMFBY')}
                      </h4>
                      <p className="text-xs text-slate-400 font-mono">
                        Policy {asStr(r.policyNumber ?? r.number, '—')}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <StatusBadge status={asStr(r.status, 'active')} />
                      <button
                        onClick={() => downloadCertificate(id)}
                        className="px-3 py-1.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold text-[10px] flex items-center gap-1"
                      >
                        <Download className="w-3 h-3" /> Certificate
                      </button>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                    <div className="p-3 bg-slate-50 rounded-2xl">
                      <span className="text-slate-400 font-semibold block text-[10px] uppercase">Sum Insured</span>
                      <span className="font-bold text-slate-900">{formatCurrency(asNum(r.sumInsured ?? r.coverage, 0))}</span>
                    </div>
                    <div className="p-3 bg-slate-50 rounded-2xl">
                      <span className="text-slate-400 font-semibold block text-[10px] uppercase">Premium</span>
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
      ) : (
        /* Schemes & rates */
        <div className="space-y-4">
          {schemes.length === 0 ? (
            <div className="py-10 text-center text-xs font-semibold text-slate-400 bg-white rounded-3xl border border-slate-200/80">
              Insurance schemes will appear here when published by providers.
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
                    <span className="text-[10px] uppercase font-bold text-emerald-800 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
                      {asStr(r.category ?? r.type, 'Crop Insurance')}
                    </span>
                    <h4 className="font-extrabold text-base text-slate-900">
                      {asStr(r.name ?? r.title, 'Insurance Scheme')}
                    </h4>
                    <p className="text-xs font-bold text-emerald-700">
                      Premium {asNum(r.premiumPercent, 0) > 0 ? `${asNum(r.premiumPercent)}% of sum insured` : formatCurrency(asNum(r.premium, 0))}
                      {asNum(r.subsidyPercent, 0) > 0 ? ` • ${asNum(r.subsidyPercent)}% govt subsidy` : ''}
                    </p>
                    <p className="text-xs text-slate-500">
                      Coverage: {formatCurrency(asNum(r.sumInsured ?? r.coverage, 0))} • {asStr(r.description, asStr(r.eligibility, ''))}
                    </p>
                    {rates.length > 0 && (
                      <p className="text-[11px] text-slate-400">
                        Live actuarial rates available for {asStr(asRecord(rates[0]).crop, 'all crops')}.
                      </p>
                    )}
                  </div>

                  <button
                    onClick={() => setApplyingScheme(r)}
                    className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs self-start sm:self-auto"
                  >
                    Apply for Policy
                  </button>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* Intimate Claim Modal */}
      <ModalSheet
        isOpen={intimateModalOpen}
        onClose={() => setIntimateModalOpen(false)}
        title="Intimate Crop Damage (72h Deadline)"
        description="Notify insurance nodal officer and surveyor within 72 hours of weather calamity"
        maxWidth="md"
      >
        <form onSubmit={handleIntimate} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Affected Crop</label>
              <select
                value={crop}
                onChange={(e) => setCrop(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 bg-white"
              >
                <option value="Soybean">Soybean (Kharif)</option>
                <option value="Wheat">Wheat (Rabi)</option>
                <option value="Onion">Onion</option>
                <option value="Cotton">Cotton</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Calamity Cause</label>
              <select
                value={calamity}
                onChange={(e) => setCalamity(e.target.value as CropInsuranceClaim['calamityType'])}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 bg-white"
              >
                <option value="Excess Rainfall / Flood">Excess Rainfall / Inundation</option>
                <option value="Drought">Severe Drought / Dry Spell</option>
                <option value="Hailstorm">Hailstorm (Olavrushti)</option>
                <option value="Pest Attack">Widespread Pest Attack</option>
                <option value="Unseasonal Frost">Unseasonal Cold / Frost</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Policy Number</label>
              <input
                type="text"
                value={policyNumber}
                onChange={(e) => setPolicyNumber(e.target.value)}
                placeholder="PMFBY-…"
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 font-mono"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Survey / Gat Number</label>
              <input
                type="text"
                value={surveyNumber}
                onChange={(e) => setSurveyNumber(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Calamity Date</label>
              <input
                type="date"
                value={calamityDate}
                onChange={(e) => setCalamityDate(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Damage Est (%)</label>
              <input
                type="number"
                value={damagePercent}
                onChange={(e) => setDamagePercent(Number(e.target.value))}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 font-bold"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Loss Value (₹)</label>
              <input
                type="number"
                value={estLoss}
                onChange={(e) => setEstLoss(Number(e.target.value))}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 font-bold text-rose-700"
                required
              />
            </div>
          </div>

          {/* Photo attachment */}
          <div className="p-4 border-2 border-dashed border-slate-300 rounded-2xl text-center space-y-2">
            <Camera className="w-8 h-8 text-slate-400 mx-auto" />
            <div className="text-xs text-slate-600">
              <span className="font-bold text-emerald-700">Attach Geo-Tagged Photo URL</span> of the damaged plot
            </div>
            <input
              type="text"
              value={photoUrl}
              onChange={(e) => setPhotoUrl(e.target.value)}
              placeholder="https://… (upload via Vault and paste link)"
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 font-mono"
            />
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full py-3 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs shadow-md transition-all flex items-center justify-center gap-1.5 disabled:opacity-60"
          >
            {submitting ? 'Submitting…' : (
              <>
                <AlertTriangle className="w-4 h-4" /> Submit Loss Intimation to Insurance Desk
              </>
            )}
          </button>
        </form>
      </ModalSheet>

      {/* Apply Policy Confirmation Modal */}
      <ModalSheet
        isOpen={Boolean(applyingScheme)}
        onClose={() => setApplyingScheme(null)}
        title="Apply for Crop Insurance Policy"
        description={`Enrol in ${asStr(applyingScheme?.name ?? applyingScheme?.title, 'this scheme')}`}
        maxWidth="sm"
      >
        <div className="space-y-4">
          <div className="p-3 bg-slate-50 rounded-xl text-xs space-y-1">
            <div className="flex justify-between text-slate-600">
              <span>Crop:</span>
              <span className="font-bold text-slate-900">{asStr(applyingScheme?.crop, crop)}</span>
            </div>
            <div className="flex justify-between text-slate-600">
              <span>Coverage:</span>
              <span className="font-bold text-slate-900">
                {formatCurrency(asNum(applyingScheme?.sumInsured ?? applyingScheme?.coverage, 0))}
              </span>
            </div>
            <div className="flex justify-between text-slate-600">
              <span>Premium:</span>
              <span className="font-bold text-emerald-800">
                {asNum(applyingScheme?.premiumPercent, 0) > 0
                  ? `${asNum(applyingScheme?.premiumPercent)}% of sum insured`
                  : formatCurrency(asNum(applyingScheme?.premium, 0))}
              </span>
            </div>
          </div>
          <button
            onClick={() => applyingScheme && handleApplyPolicy(applyingScheme)}
            disabled={busyId === asStr(applyingScheme?.id)}
            className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md transition-all flex items-center justify-center gap-1.5 disabled:opacity-60"
          >
            {busyId === asStr(applyingScheme?.id) ? 'Submitting…' : (
              <>
                <Plus className="w-4 h-4" /> Confirm Policy Application
              </>
            )}
          </button>
        </div>
      </ModalSheet>
    </div>
  );
};
