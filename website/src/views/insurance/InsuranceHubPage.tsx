import { useCallback, useEffect, useMemo, useState } from 'react';
import ToolShell from '../../components/trade/ToolShell';
import { toast } from '../../components/toast';
import { isApiError } from '../../lib/api/client';
import {
  CLAIM_STAGES,
  appealClaim,
  calculatePremium,
  fileClaim,
  fmtPaisa,
  fmtRupees,
  getMyClaims,
  getMyPolicies,
  getPolicyCertificate,
  type CropInsurancePolicy,
  type InsuranceClaim,
  type PremiumCalcResult,
} from '../../lib/api/insurance';
import { useT } from '../../lib/i18n';
import '../../theme/trade.css';
import './insurance.css';
import InsEmptyState from './components/InsEmptyState';
import InsStatusChip from './components/InsStatusChip';

/**
 * Farmer crop-insurance hub (tasks 5.25–5.29) — four tabs: policy passbook with
 * e-certificate download, 72-hour claim intimation (geo-tagged photos + a visible
 * SLA clock + a guidelines modal), the premium calculator, and the multi-stage
 * claim tracker with the appeal/resubmit path (F15).
 *
 * This is the WS-05 farmer face; the provider console keeps its own
 * INSURANCE_PAGES entries under different tool ids.
 */

const TABS = ['passbook', 'intimation', 'premium', 'tracker'] as const;
type Tab = (typeof TABS)[number];

const MAX_PHOTOS = 5;
const WINDOW_HOURS = 72;
const HOUR_MS = 3_600_000;

const CALAMITIES = ['hailstorm', 'flood', 'drought', 'pest', 'fire', 'other'];
const CROP_STAGES = ['sowing', 'vegetative', 'flowering', 'maturity', 'harvest'];

const TAB_KEY: Record<Tab, string> = {
  passbook: 'insuranceTabPassbook',
  intimation: 'insuranceTabIntimation',
  premium: 'insuranceTabPremium',
  tracker: 'insuranceTabTracker',
};

export default function InsuranceHubPage() {
  const t = useT();
  const [tab, setTab] = useState<Tab>('passbook');

  return (
    <ToolShell toolId="insuranceHub" backTo="/dashboard">
      <div className="ins-wrap">
        <div className="ins-section">
          <span className="ins-section-title">🛡️ {t('insuranceHubTitle')}</span>
          <p className="ins-hint">{t('insuranceHubIntro')}</p>
        </div>

        <div className="ins-chip-row" role="tablist">
          {TABS.map((value) => (
            <button
              key={value}
              type="button"
              role="tab"
              aria-selected={tab === value}
              className={`av-btn ${tab === value ? 'av-btn-primary' : 'av-btn-ghost'}`}
              onClick={() => setTab(value)}
            >
              {t(TAB_KEY[value])}
            </button>
          ))}
        </div>

        {tab === 'passbook' ? <PassbookTab /> : null}
        {tab === 'intimation' ? <IntimationTab /> : null}
        {tab === 'premium' ? <PremiumTab /> : null}
        {tab === 'tracker' ? <TrackerTab /> : null}
      </div>
    </ToolShell>
  );
}

/* ---------------------------------------------------------- (a) passbook ---- */

function PassbookTab() {
  const t = useT();
  const [policies, setPolicies] = useState<CropInsurancePolicy[] | null>(null);
  const [certs, setCerts] = useState<Record<string, string>>({});
  const [failed, setFailed] = useState(false);

  const load = useCallback(() => {
    setFailed(false);
    getMyPolicies()
      .then(setPolicies)
      .catch(() => setFailed(true));
  }, []);

  useEffect(load, [load]);

  const fetchCert = async (policy: CropInsurancePolicy) => {
    try {
      const { certificateUrl } = await getPolicyCertificate(policy.id);
      setCerts((prev) => ({ ...prev, [policy.id]: certificateUrl }));
      toast(t('insuranceCertReady'));
    } catch {
      toast(t('insActionFailed'), { error: true });
    }
  };

  return (
    <>
      <div className="ins-section">
        <span className="ins-section-title">📘 {t('insurancePassbookTitle')}</span>
        {failed ? (
          <InsEmptyState
            icon="📡"
            titleKey="insLoadFailed"
            action={
              <button type="button" className="av-btn av-btn-ghost" onClick={load}>
                ↻ {t('retry')}
              </button>
            }
          />
        ) : null}
        {policies === null && !failed ? <p className="ins-hint">{t('commonLoading')}</p> : null}
        {policies !== null && policies.length === 0 ? (
          <InsEmptyState icon="🛡️" titleKey="insuranceNoPolicies" bodyKey="insuranceNoPoliciesBody" />
        ) : null}
        <div className="ins-list">
          {(policies ?? []).map((policy) => (
            <div className="ins-card" key={policy.id}>
              <div className="ins-card-row">
                <span className="ins-card-title">
                  {policy.policyNumber} · {policy.cropName}
                </span>
                <InsStatusChip status={policy.status} kind="policy" />
              </div>
              <span className="ins-card-sub">
                {t('insuranceSumInsured')}: {fmtRupees(policy.sumInsured)}
              </span>
              <span className="ins-card-sub">
                {t('insuranceValidity')}: {policy.coverageEndDate}
              </span>
              <div className="ins-actions-row">
                <button
                  type="button"
                  className="av-btn av-btn-ghost"
                  onClick={() => void fetchCert(policy)}
                >
                  ⬇ {t('insuranceCertDownload')}
                </button>
                {certs[policy.id] ? (
                  <a className="av-btn" href={certs[policy.id]} target="_blank" rel="noreferrer">
                    {t('insuranceCertReady')}
                  </a>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

/* --------------------------------------------------------- (b) intimation --- */

function IntimationTab() {
  const t = useT();
  const [policies, setPolicies] = useState<CropInsurancePolicy[]>([]);
  const [policyId, setPolicyId] = useState('');
  const [calamityType, setCalamityType] = useState(CALAMITIES[0]);
  const [dateOfDamage, setDateOfDamage] = useState('');
  const [cropStage, setCropStage] = useState(CROP_STAGES[0]);
  const [lossPercent, setLossPercent] = useState('');
  const [village, setVillage] = useState('');
  const [gps, setGps] = useState('');
  const [photos, setPhotos] = useState<File[]>([]);
  const [overlayOpen, setOverlayOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const [filed, setFiled] = useState<InsuranceClaim | null>(null);

  useEffect(() => {
    getMyPolicies()
      .then((rows) => setPolicies(rows.filter((p) => p.status === 'active')))
      .catch(() => setPolicies([]));
  }, []);

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(id);
  }, []);

  const deadline = useMemo(() => {
    if (!dateOfDamage) return null;
    const start = new Date(`${dateOfDamage}T00:00:00`).getTime();
    if (Number.isNaN(start)) return null;
    return start + WINDOW_HOURS * HOUR_MS;
  }, [dateOfDamage]);

  const slaLabel = useMemo(() => {
    if (deadline === null) return t('insIntimateNoDate');
    const remaining = deadline - now;
    const absMs = Math.abs(remaining);
    const hours = Math.floor(absMs / HOUR_MS);
    const minutes = Math.floor((absMs % HOUR_MS) / 60_000);
    return remaining < 0
      ? t('insDeadlineBreach', { hours, minutes })
      : t('insDeadlineLeft', { hours, minutes });
  }, [deadline, now, t]);

  const useLocation = () => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (position) =>
        setGps(`${position.coords.latitude.toFixed(5)},${position.coords.longitude.toFixed(5)}`),
      () => toast(t('insLocationDenied'), { error: true }),
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const openOverlay = () => {
    if (!policyId || !dateOfDamage || !village.trim() || !gps.trim() || photos.length === 0) {
      toast(t('insIntimateIncomplete'), { error: true });
      return;
    }
    setOverlayOpen(true);
  };

  const confirmSubmit = async () => {
    const policy = policies.find((p) => p.id === policyId);
    const percent = Number(lossPercent);
    if (!policy || !Number.isFinite(percent) || percent <= 0 || percent > 100) {
      toast(t('insIntimateIncomplete'), { error: true });
      return;
    }
    setBusy(true);
    try {
      const claim = await fileClaim({
        policyId,
        cropName: policy.cropName,
        calamityType,
        dateOfDamage,
        cropStage,
        estimatedLossPercent: percent,
        gpsCoordinates: gps.trim(),
        village: village.trim(),
        photos,
      });
      setOverlayOpen(false);
      setFiled(claim);
      toast(t('insIntimateFiled'));
    } catch (e) {
      toast(isApiError(e) ? e.message : t('insActionFailed'), { error: true });
    } finally {
      setBusy(false);
    }
  };

  if (policies.length === 0) {
    return (
      <div className="ins-section">
        <span className="ins-section-title">📸 {t('insuranceIntimateTitle')}</span>
        <InsEmptyState icon="🛡️" titleKey="insNoActivePolicy" bodyKey="insNoActivePolicyBody" />
      </div>
    );
  }

  return (
    <div className="ins-section">
      <span className="ins-section-title">📸 {t('insuranceIntimateTitle')}</span>
      <p className="ins-hint">{t('insIntimateSub')}</p>

      {filed ? (
        <p className="ins-hint">
          ✅ {filed.claimNumber} — <InsStatusChip status={filed.status} />
        </p>
      ) : null}

      <div className="ins-form">
        <div className="av-field">
          <label className="av-label">{t('insPolicy')}</label>
          <select className="av-input" value={policyId} onChange={(e) => setPolicyId(e.target.value)}>
            <option value="">{t('insSelectPlaceholder')}</option>
            {policies.map((policy) => (
              <option key={policy.id} value={policy.id}>
                {policy.policyNumber} · {policy.cropName}
              </option>
            ))}
          </select>
        </div>

        <div className="ins-grid-2">
          <div className="av-field">
            <label className="av-label">{t('insCalamity')}</label>
            <select className="av-input" value={calamityType} onChange={(e) => setCalamityType(e.target.value)}>
              {CALAMITIES.map((value) => (
                <option key={value} value={value}>
                  {t(`insCalamity_${value}`)}
                </option>
              ))}
            </select>
          </div>
          <div className="av-field">
            <label className="av-label">{t('insDateOfDamage')}</label>
            <input
              className="av-input"
              type="date"
              value={dateOfDamage}
              onChange={(e) => setDateOfDamage(e.target.value)}
            />
          </div>
        </div>

        <div className="ins-grid-2">
          <div className="av-field">
            <label className="av-label">{t('insCropStage')}</label>
            <select className="av-input" value={cropStage} onChange={(e) => setCropStage(e.target.value)}>
              {CROP_STAGES.map((value) => (
                <option key={value} value={value}>
                  {t(`insStage_${value}`)}
                </option>
              ))}
            </select>
          </div>
          <div className="av-field">
            <label className="av-label">{t('insEstimatedLoss')}</label>
            <input
              className="av-input"
              type="number"
              min={0}
              max={100}
              value={lossPercent}
              onChange={(e) => setLossPercent(e.target.value)}
            />
          </div>
        </div>

        <div className="av-field">
          <label className="av-label">{t('insVillage')}</label>
          <input className="av-input" value={village} onChange={(e) => setVillage(e.target.value)} />
        </div>

        <div className="av-field">
          <label className="av-label">{t('insuranceGpsTaggedPhoto')}</label>
          <div className="ins-grid-2">
            <input
              className="av-input"
              value={gps}
              placeholder="20.00000,73.80000"
              onChange={(e) => setGps(e.target.value)}
            />
            <button type="button" className="av-btn av-btn-ghost" onClick={useLocation}>
              📍 {t('insUseMyLocation')}
            </button>
          </div>
        </div>

        <div className="av-field">
          <label className="av-label">{t('insDamagePhotos')}</label>
          <input
            className="av-input"
            type="file"
            accept="image/*"
            multiple
            onChange={(e) => setPhotos(Array.from(e.target.files ?? []).slice(0, MAX_PHOTOS))}
          />
          {photos.length > 0 ? (
            <span className="ins-hint">
              {t('insPhotosPicked', { count: photos.length, max: MAX_PHOTOS })}
            </span>
          ) : null}
        </div>

        <div className="ins-deadline">
          ⏱ {t('insuranceSlaClockLabel')}: {slaLabel}
        </div>

        <button type="button" className="av-btn av-btn-primary" onClick={openOverlay}>
          {t('insReviewAndSubmit')}
        </button>
      </div>

      {overlayOpen ? (
        <div className="ins-overlay-scrim" role="dialog" aria-modal="true">
          <div className="ins-overlay">
            <span className="ins-overlay-title">📋 {t('insGuidelinesTitle')}</span>
            <ul className="ins-overlay-list">
              <li>{t('insGuidelineWide')}</li>
              <li>{t('insGuidelineClose')}</li>
              <li>{t('insGuidelineGps')}</li>
              <li>{t('insGuidelineMax', { max: MAX_PHOTOS })}</li>
            </ul>
            <div className="ins-actions-row">
              <button type="button" className="av-btn av-btn-ghost" onClick={() => setOverlayOpen(false)}>
                {t('insCancel')}
              </button>
              <button
                type="button"
                className="av-btn av-btn-primary"
                disabled={busy}
                onClick={() => void confirmSubmit()}
              >
                {busy ? <span className="av-spinner" /> : t('insConfirmSubmit')}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

/* ------------------------------------------------------------ (c) premium --- */

function PremiumTab() {
  const t = useT();
  const [crop, setCrop] = useState('');
  const [season, setSeason] = useState('Kharif');
  const [area, setArea] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<PremiumCalcResult | null>(null);

  const run = async () => {
    const acres = Number(area);
    if (!crop.trim() || !(acres > 0)) {
      toast(t('actionFailed'), { error: true });
      return;
    }
    setBusy(true);
    try {
      setResult(await calculatePremium({ cropName: crop.trim(), season, landAreaAcres: acres }));
    } catch (e) {
      if (isApiError(e) && e.code === 'RATE_NOT_FOUND') toast(t('insNoActivePolicy'), { error: true });
      else toast(t('actionFailed'), { error: true });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="ins-section">
      <span className="ins-section-title">🧾 {t('insurancePremiumTitle')}</span>
      <div className="ins-form">
        <div className="av-field">
          <label className="av-label">{t('insurancePremiumCrop')}</label>
          <input className="av-input" value={crop} onChange={(e) => setCrop(e.target.value)} />
        </div>
        <div className="ins-grid-2">
          <div className="av-field">
            <label className="av-label">{t('insurancePremiumSeason')}</label>
            <select className="av-input" value={season} onChange={(e) => setSeason(e.target.value)}>
              <option value="Kharif">Kharif</option>
              <option value="Rabi">Rabi</option>
              <option value="Annual">Annual</option>
            </select>
          </div>
          <div className="av-field">
            <label className="av-label">{t('insurancePremiumArea')}</label>
            <input
              className="av-input"
              type="number"
              inputMode="decimal"
              value={area}
              onChange={(e) => setArea(e.target.value)}
            />
          </div>
        </div>
        <button type="button" className="av-btn av-btn-primary" disabled={busy} onClick={() => void run()}>
          {busy ? <span className="av-spinner" /> : t('insurancePremiumRun')}
        </button>
      </div>

      {result ? (
        <div className="ins-card">
          <span className="ins-card-title">{t('insurancePremiumResult')}</span>
          <span className="ins-card-sub">
            {t('insurancePremiumSumInsured')}: {fmtPaisa(result.sumInsuredPaisa)}
          </span>
          <span className="ins-card-amount">
            {t('insurancePremiumFarmerShare')}: {fmtPaisa(result.farmerPremiumPaisa)}
          </span>
          <span className="ins-card-sub">
            {t('insurancePremiumSubsidy')}: {fmtPaisa(result.govtSubsidyPaisa)}
          </span>
        </div>
      ) : null}
    </div>
  );
}

/* ------------------------------------------------------------ (d) tracker --- */

function TrackerTab() {
  const t = useT();
  const [claims, setClaims] = useState<InsuranceClaim[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    setFailed(false);
    getMyClaims()
      .then((res) => setClaims(res.data))
      .catch(() => setFailed(true));
  }, []);

  useEffect(load, [load]);

  const submitAppeal = async (claimId: string) => {
    if (reason.trim().length < 10) {
      toast(t('insAppealReasonShort'), { error: true });
      return;
    }
    setBusy(true);
    try {
      await appealClaim(claimId, { reason });
      setReason('');
      setOpenId(null);
      toast(t('insAppealSubmitted'));
      load();
    } catch (e) {
      toast(isApiError(e) ? e.message : t('insActionFailed'), { error: true });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="ins-section">
      <span className="ins-section-title">🚚 {t('insuranceTrackerTitle')}</span>
      {failed ? (
        <InsEmptyState
          icon="📡"
          titleKey="insLoadFailed"
          action={
            <button type="button" className="av-btn av-btn-ghost" onClick={load}>
              ↻ {t('retry')}
            </button>
          }
        />
      ) : null}
      {claims === null && !failed ? <p className="ins-hint">{t('commonLoading')}</p> : null}
      {claims !== null && claims.length === 0 ? (
        <InsEmptyState icon="🛡️" titleKey="insuranceTrackerEmpty" bodyKey="insuranceTrackerEmptyBody" />
      ) : null}

      <div className="ins-list">
        {(claims ?? []).map((claim) => {
          const reached = new Set(claim.timeline.map((entry) => entry.status));
          return (
            <div className="ins-card" key={claim.id}>
              <div className="ins-card-row">
                <span className="ins-card-title">{claim.claimNumber}</span>
                <InsStatusChip status={claim.status} />
              </div>
              <span className="ins-card-sub">
                {claim.cropName} · {claim.calamityType}
              </span>
              <div className="ins-chip-row">
                {CLAIM_STAGES.map((stage) => (
                  <span
                    className="ins-pill"
                    key={stage}
                    style={
                      reached.has(stage)
                        ? { color: '#15803d', background: '#dcfce7', borderColor: '#86efac' }
                        : undefined
                    }
                  >
                    {t(`ins_status_${stage}`)}
                  </span>
                ))}
              </div>
              {claim.status === 'rejected' ? (
                openId === claim.id ? (
                  <div className="ins-form">
                    <div className="av-field">
                      <label className="av-label">{t('insAppealReason')}</label>
                      <textarea
                        className="av-input"
                        rows={3}
                        value={reason}
                        onChange={(e) => setReason(e.target.value)}
                      />
                    </div>
                    <button
                      type="button"
                      className="av-btn av-btn-primary"
                      disabled={busy}
                      onClick={() => void submitAppeal(claim.id)}
                    >
                      {busy ? <span className="av-spinner" /> : t('insuranceAppealSubmit')}
                    </button>
                  </div>
                ) : (
                  <div className="ins-actions-row">
                    <button
                      type="button"
                      className="av-btn av-btn-ghost"
                      onClick={() => setOpenId(claim.id)}
                    >
                      {t('insuranceAppealSubmit')}
                    </button>
                  </div>
                )
              ) : null}
              {claim.appealCount > 0 ? (
                <span className="ins-card-sub">{t('insAppealSubmitted')}</span>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}
