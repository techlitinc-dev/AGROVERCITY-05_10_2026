import React, { useEffect, useRef, useState } from 'react';
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
import { insurance, uploads, apiErrorMessage } from '../../lib/api';
import { ModalSheet } from '../../components/common/ModalSheet';
import { StatusBadge } from '../../components/common/StatusBadge';
import { formatCurrency, formatDate } from '../../lib/utils';
import { useAuthStore } from '../../stores/authStore';
import type { CropInsuranceClaim } from '../../types';

const asRecord = (v: unknown): Record<string, unknown> =>
  v !== null && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
const asArray = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const asStr = (v: unknown, fallback = ''): string => (typeof v === 'string' ? v : fallback);
const asNum = (v: unknown, fallback = 0): number => (typeof v === 'number' && !Number.isNaN(v) ? v : fallback);

const MAX_CLAIM_PHOTOS = 5;

type Tab = 'claims' | 'policies' | 'schemes';

export const CropInsuranceView: React.FC = () => {
  const { user } = useAuthStore();
  const [tab, setTab] = useState<Tab>('claims');
  const [claims, setClaims] = useState<unknown[]>([]);
  const [policies, setPolicies] = useState<unknown[]>([]);
  const [schemes, setSchemes] = useState<unknown[]>([]);
  const [rates, setRates] = useState<unknown[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const [intimateModalOpen, setIntimateModalOpen] = useState(false);
  const [applyingScheme, setApplyingScheme] = useState<Record<string, unknown> | null>(null);

  // Intimation form — field names match POST /insurance/claims/from-uploads.
  const [cropName, setCropName] = useState('Soybean');
  const [policyId, setPolicyId] = useState('');
  const [calamity, setCalamity] = useState('Excess Rainfall / Flood');
  const [dateOfDamage, setDateOfDamage] = useState('2026-10-15');
  const [cropStage, setCropStage] = useState('vegetative');
  const [damagePercent, setDamagePercent] = useState(40);
  const [gpsCoordinates, setGpsCoordinates] = useState('');
  const [village, setVillage] = useState('');
  const [photoFiles, setPhotoFiles] = useState<File[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const photoInputRef = useRef<HTMLInputElement | null>(null);

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
        setClaims(c as unknown[]);
        setPolicies(p);
        setSchemes(s);
        setRates(r);
        if (p.length > 0) {
          const first = asRecord(p[0]);
          setPolicyId(asStr(first.id));
          const crop = asStr(first.cropName);
          if (crop) setCropName(crop);
        }
      })
      .catch((e) => active && setError(apiErrorMessage(e)))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!intimateModalOpen) return;
    if (!village && user?.village) setVillage(user.village);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [intimateModalOpen]);

  const locateMe = () => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => setGpsCoordinates(`${pos.coords.latitude.toFixed(5)}, ${pos.coords.longitude.toFixed(5)}`),
      () => undefined
    );
  };

  const handleIntimate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      // Photos go through POST /uploads first; the claim references the URLs.
      const photoUrls: string[] = [];
      for (const file of photoFiles.slice(0, MAX_CLAIM_PHOTOS)) {
        const uploaded = (await uploads.upload(file, { folder: 'claims', purpose: 'claim-photo' })) as {
          url?: string;
        };
        if (uploaded?.url) photoUrls.push(uploaded.url);
      }
      const created = await insurance.intimateClaimFromUploads({
        policyId,
        cropName,
        calamityType: calamity,
        dateOfDamage,
        cropStage,
        estimatedLossPercent: damagePercent,
        gpsCoordinates,
        village,
        damagePhotoUrls: photoUrls,
      });
      setClaims((prev) => [created, ...prev]);
      setIntimateModalOpen(false);
      setPhotoFiles([]);
      setTab('claims');
      const rec = asRecord(created);
      setNotice(
        `Claim #${asStr(rec.claimNumber, asStr(rec.id))} intimated. Surveyor will be assigned within 48 hours.`
      );
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  const handleAppeal = async (claimId: string) => {
    setError(null);
    setBusyId(claimId);
    try {
      await insurance.appealClaim(claimId, {
        reason: 'Farmer appeal against rejected/under-assessed claim',
      });
      setNotice(`Appeal submitted for claim #${claimId}. The nodal officer will re-verify.`);
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
      await insurance.applyPolicy({ schemeId: scheme.id, crop: asStr(scheme.crop, cropName) });
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
            claims.map((rawClaim, idx) => {
              const claim = asRecord(rawClaim);
              const claimId = asStr(claim.id, String(idx));
              // Backend records (InsuranceClaimRecord) and legacy mock rows
              // carry different field names — read both.
              const claimCrop = asStr(claim.cropName ?? claim.crop, 'Crop');
              const policyLabel = asStr(claim.policyId ?? claim.policyNumber, '—');
              const claimStatus = asStr(claim.status, 'intimated');
              const lossPct = asNum(claim.estimatedLossPercent ?? claim.damagePercentage, 0);
              const claimPhotos = asArray(claim.damagePhotos ?? claim.photos);
              return (
              <div
                key={claimId}
                className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs space-y-4"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="font-bold text-base text-slate-900">{claimCrop} Damage Claim</h4>
                      <span className="font-mono text-xs text-slate-400">#{asStr(claim.claimNumber, claimId)}</span>
                    </div>
                    <p className="text-xs text-slate-500">
                      Policy: <strong>{policyLabel}</strong>
                      {asStr(claim.village ?? claim.surveyNumber) ? ` • ${asStr(claim.village ?? claim.surveyNumber)}` : ''}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <StatusBadge status={claimStatus} />
                    <Link
                      to={`/farmer/insurance/claims/${claimId}`}
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
                    <span className="font-bold text-slate-900">{asStr(claim.calamityType, '—')}</span>
                  </div>
                  <div className="p-3 bg-slate-50 rounded-2xl">
                    <span className="text-slate-400 font-semibold block text-[10px] uppercase">Incident Date</span>
                    <span className="font-bold text-slate-900">{formatDate(asStr(claim.dateOfDamage ?? claim.calamityDate))}</span>
                  </div>
                  <div className="p-3 bg-slate-50 rounded-2xl">
                    <span className="text-slate-400 font-semibold block text-[10px] uppercase">Damage Assessed</span>
                    <span className="font-bold text-rose-700">{lossPct}% Area Lost</span>
                  </div>
                  <div className="p-3 bg-slate-50 rounded-2xl">
                    <span className="text-slate-400 font-semibold block text-[10px] uppercase">Estimated DBT</span>
                    <span className="font-black text-emerald-700">
                      {formatCurrency(asNum(claim.requestedAmount ?? claim.estimatedLossAmount, 0))}
                    </span>
                  </div>
                </div>

                {/* Photos + appeal */}
                <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                  {claimPhotos.length > 0 && (
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-slate-400 font-medium">Geo-Tagged Field Photos:</span>
                      <div className="flex gap-2">
                        {claimPhotos.map((src, i) => (
                          <img
                            key={i}
                            src={asStr(src)}
                            alt="Crop damage proof"
                            className="w-14 h-14 rounded-xl object-cover border border-slate-200"
                          />
                        ))}
                      </div>
                    </div>
                  )}

                  {claimStatus === 'rejected' && (
                    <button
                      onClick={() => handleAppeal(claimId)}
                      disabled={busyId === claimId}
                      className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs shadow-xs disabled:opacity-50"
                    >
                      {busyId === claimId ? 'Submitting…' : 'Appeal Rejection'}
                    </button>
                  )}
                </div>
              </div>
              );
            })
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
                value={cropName}
                onChange={(e) => setCropName(e.target.value)}
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
              <label className="block text-xs font-bold text-slate-700 mb-1">Policy</label>
              <select
                value={policyId}
                onChange={(e) => setPolicyId(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 bg-white"
                required
              >
                <option value="" disabled>Select policy…</option>
                {policies.map((p, i) => {
                  const rec = asRecord(p);
                  const id = asStr(rec.id, String(i));
                  return (
                    <option key={id} value={id}>
                      {asStr(rec.policyNumber, id)} — {asStr(rec.cropName, 'Crop')}
                    </option>
                  );
                })}
              </select>
              {policies.length === 0 && (
                <p className="text-[10px] text-rose-600 font-semibold mt-1">
                  No active policies — apply for a PMFBY scheme first.
                </p>
              )}
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Crop Stage at Damage</label>
              <select
                value={cropStage}
                onChange={(e) => setCropStage(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 bg-white"
              >
                <option value="germination">Germination / Emergence</option>
                <option value="vegetative">Vegetative Growth</option>
                <option value="flowering">Flowering</option>
                <option value="fruiting">Fruiting / Grain Filling</option>
                <option value="harvest">Ready for Harvest</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Calamity Date</label>
              <input
                type="date"
                value={dateOfDamage}
                onChange={(e) => setDateOfDamage(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Damage Est (%)</label>
              <input
                type="number"
                min={0}
                max={100}
                value={damagePercent}
                onChange={(e) => setDamagePercent(Number(e.target.value))}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 font-bold"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Village</label>
              <input
                type="text"
                value={village}
                onChange={(e) => setVillage(e.target.value)}
                placeholder="e.g. Pimpalgaon Baswant"
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">GPS Coordinates</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={gpsCoordinates}
                onChange={(e) => setGpsCoordinates(e.target.value)}
                placeholder="20.0000, 74.0000"
                className="flex-1 px-3 py-2 text-xs rounded-xl border border-slate-300 font-mono"
                required
              />
              <button
                type="button"
                onClick={locateMe}
                className="px-3 py-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-600 font-bold text-[10px] whitespace-nowrap"
              >
                Use my location
              </button>
            </div>
          </div>

          {/* Photo attachment — uploaded via POST /uploads, then submitted as URLs */}
          <div className="p-4 border-2 border-dashed border-slate-300 rounded-2xl text-center space-y-2">
            <Camera className="w-8 h-8 text-slate-400 mx-auto" />
            <div className="text-xs text-slate-600">
              <span className="font-bold text-emerald-700">Upload up to {MAX_CLAIM_PHOTOS} geo-tagged photos</span> of
              the damaged plot — wide field view + close-ups of affected plants.
            </div>
            <input
              ref={photoInputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(e) => {
                const files = Array.from(e.target.files ?? []);
                setPhotoFiles((prev) => [...prev, ...files].slice(0, MAX_CLAIM_PHOTOS));
                if (e.target) e.target.value = '';
              }}
            />
            <button
              type="button"
              onClick={() => photoInputRef.current?.click()}
              disabled={photoFiles.length >= MAX_CLAIM_PHOTOS}
              className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs disabled:opacity-50"
            >
              Add Photos ({photoFiles.length}/{MAX_CLAIM_PHOTOS})
            </button>
            {photoFiles.length > 0 && (
              <div className="flex gap-2 flex-wrap justify-center pt-1">
                {photoFiles.map((file, i) => (
                  <div key={i} className="relative">
                    <img
                      src={URL.createObjectURL(file)}
                      alt={file.name}
                      className="w-14 h-14 rounded-xl object-cover border border-slate-200"
                    />
                    <button
                      type="button"
                      onClick={() => setPhotoFiles((prev) => prev.filter((_, idx) => idx !== i))}
                      className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-rose-600 text-white text-[9px] font-black leading-none"
                      title="Remove photo"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <button
            type="submit"
            disabled={submitting || !policyId}
            className="w-full py-3 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs shadow-md transition-all flex items-center justify-center gap-1.5 disabled:opacity-60"
          >
            {submitting ? 'Uploading photos & submitting…' : (
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
              <span className="font-bold text-slate-900">{asStr(applyingScheme?.crop, cropName)}</span>
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
