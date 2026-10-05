import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import ToolShell from '../../components/trade/ToolShell';
import { useEnsureProfile } from '../../components/trade/useEnsureProfile';
import { toast } from '../../components/toast';
import { isApiError } from '../../lib/api/client';
import {
  fileClaim,
  getMyPolicies,
  type ClaimTriage,
  type CropInsurancePolicy,
  type InsuranceClaim,
} from '../../lib/api/insurance';
import { currentLanguage, useT } from '../../lib/i18n';
import '../../lib/i18n/locales/en.insurance';
import '../../lib/i18n/locales/hi.insurance';
import InsEmptyState from '../insurance/components/InsEmptyState';
import '../insurance/insurance.css';

/**
 * Farmer claim intimation (F15) — a 72-h geo-tagged photo filing form with a
 * pre-submit guidelines overlay (what to photograph + a live deadline
 * countdown from the loss date). No paywall: the farmer's core claim loop is
 * never entitlement-gated (global rule 5).
 */

const MAX_PHOTOS = 5;
const WINDOW_HOURS = 72;
const HOUR_MS = 3_600_000;

const CALAMITIES = ['hailstorm', 'flood', 'drought', 'pest', 'fire', 'other'];
const CROP_STAGES = ['sowing', 'vegetative', 'flowering', 'maturity', 'harvest'];

export default function FarmerClaimIntimatePage() {
  const t = useT();
  const navigate = useNavigate();
  useEnsureProfile('farmer');

  const [policies, setPolicies] = useState<CropInsurancePolicy[] | null>(null);
  const [policyId, setPolicyId] = useState('');
  const [calamityType, setCalamityType] = useState(CALAMITIES[0]);
  const [dateOfDamage, setDateOfDamage] = useState('');
  const [cropStage, setCropStage] = useState(CROP_STAGES[0]);
  const [lossPercent, setLossPercent] = useState('');
  const [village, setVillage] = useState('');
  const [gps, setGps] = useState('');
  const [locating, setLocating] = useState(false);
  const [photos, setPhotos] = useState<File[]>([]);
  const [overlayOpen, setOverlayOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState<number>(() => Date.now());
  const [result, setResult] = useState<{ claim: InsuranceClaim; triage: ClaimTriage | null } | null>(
    null
  );

  const load = useCallback(() => {
    getMyPolicies()
      .then((res) => {
        const active = res.filter((p) => p.status === 'active');
        setPolicies(active);
      })
      .catch(() => setPolicies([]));
  }, []);

  useEffect(load, [load]);

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(id);
  }, []);

  const selectedPolicy = useMemo(
    () => (policies ?? []).find((p) => p.id === policyId) ?? null,
    [policies, policyId]
  );

  const deadline = useMemo(() => {
    if (!dateOfDamage) return null;
    const start = new Date(`${dateOfDamage}T00:00:00`).getTime();
    if (Number.isNaN(start)) return null;
    return start + WINDOW_HOURS * HOUR_MS;
  }, [dateOfDamage]);

  const deadlineLabel = useMemo(() => {
    if (deadline === null) return t('insIntimateNoDate');
    const remaining = deadline - now;
    const overdue = remaining < 0;
    const absMs = Math.abs(remaining);
    const hours = Math.floor(absMs / HOUR_MS);
    const minutes = Math.floor((absMs % HOUR_MS) / 60_000);
    return overdue
      ? t('insDeadlineBreach', { hours, minutes })
      : t('insDeadlineLeft', { hours, minutes });
  }, [deadline, now, t]);

  const deadlineBreached = deadline !== null && deadline - now < 0;

  const useMyLocation = () => {
    if (!navigator.geolocation || locating) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocating(false);
        setGps(`${position.coords.latitude.toFixed(5)},${position.coords.longitude.toFixed(5)}`);
      },
      () => {
        setLocating(false);
        toast(t('insLocationDenied'), { error: true });
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const onPickPhotos = (files: FileList | null) => {
    if (!files) return;
    const picked = Array.from(files).slice(0, MAX_PHOTOS);
    setPhotos(picked);
  };

  const openOverlay = () => {
    if (!policyId || !dateOfDamage || !village.trim() || !gps.trim() || photos.length === 0) {
      toast(t('insIntimateIncomplete'), { error: true });
      return;
    }
    setOverlayOpen(true);
  };

  const confirmSubmit = async () => {
    if (!selectedPolicy) {
      toast(t('insIntimateIncomplete'), { error: true });
      return;
    }
    const percent = Number(lossPercent);
    if (!Number.isFinite(percent) || percent <= 0 || percent > 100) {
      toast(t('insLossPercentInvalid'), { error: true });
      return;
    }
    setBusy(true);
    try {
      const claim = await fileClaim({
        policyId,
        cropName: selectedPolicy.cropName,
        calamityType,
        dateOfDamage,
        cropStage,
        estimatedLossPercent: percent,
        gpsCoordinates: gps.trim(),
        village: village.trim(),
        photos,
      });
      setOverlayOpen(false);
      toast(t('insIntimateFiled'));
      // WS-07 M15 — render the same-day photo-quality/completeness feedback
      // (retake guidance en/hi) before the farmer leaves the page.
      setResult({ claim, triage: claim.triage ?? null });
    } catch (e) {
      toast(isApiError(e) ? e.message : t('insActionFailed'), { error: true });
    } finally {
      setBusy(false);
    }
  };

  if (policies !== null && policies.length === 0) {
    return (
      <ToolShell toolId="cropInsurance" backTo="/dashboard">
        <div className="ins-wrap">
          <InsEmptyState icon="🛡️" titleKey="insNoActivePolicy" bodyKey="insNoActivePolicyBody" />
        </div>
      </ToolShell>
    );
  }

  const guidanceText = (() => {
    const guidance = result?.triage?.retakeGuidance;
    if (!guidance) return '';
    const primary = currentLanguage() === 'hi' ? guidance.hi : guidance.en;
    return primary || guidance.en || guidance.hi || '';
  })();

  return (
    <ToolShell toolId="cropInsurance" backTo="/insurance/my-claims">
      <div className="ins-wrap">
        {result ? (
          <div className="ins-section">
            <span className="ins-section-title">📸 {t('insTriageFiledTitle')}</span>
            <p className="ins-hint">{result.claim.claimNumber}</p>
            {result.triage ? (
              <>
                <div className="ins-chip-row">
                  <span
                    className="ins-pill"
                    style={{
                      color: result.triage.photoQuality === 'poor' ? '#b45309' : '#15803d',
                      borderColor: result.triage.photoQuality === 'poor' ? '#fcd34d' : '#86efac',
                      background: result.triage.photoQuality === 'poor' ? '#fef3c7' : '#dcfce7',
                    }}
                  >
                    {t('insTriagePhotoQuality')}:{' '}
                    {result.triage.photoQuality === 'poor' ? t('insTriagePoor') : t('insTriageOk')}
                  </span>
                  <span className="ins-pill">
                    {t('insTriageCompleteness')}: {Math.round((result.triage.completeness || 0) * 100)}%
                  </span>
                </div>
                {guidanceText ? (
                  <p className="ins-hint">
                    <strong>{t('insTriageRetakeGuidance')}: </strong>
                    {guidanceText}
                  </p>
                ) : null}
              </>
            ) : null}
            <div className="ins-actions-row">
              <button type="button" className="av-btn av-btn-ghost" onClick={() => setResult(null)}>
                {t('insTriageRetakeButton')}
              </button>
              <button
                type="button"
                className="av-btn av-btn-primary"
                onClick={() => navigate(`/insurance/my-claims/${result.claim.id}`)}
              >
                {t('insTriageViewClaim')}
              </button>
            </div>
          </div>
        ) : null}

        <div className="ins-section">
          <span className="ins-section-title">📸 {t('insIntimateTitle')}</span>
          <p className="ins-hint">{t('insIntimateSub')}</p>

          <div className="ins-form">
            <div className="av-field">
              <label className="av-label">{t('insPolicy')}</label>
              <select className="av-input" value={policyId} onChange={(e) => setPolicyId(e.target.value)}>
                <option value="">{t('insSelectPlaceholder')}</option>
                {(policies ?? []).map((policy) => (
                  <option key={policy.id} value={policy.id}>
                    {policy.policyNumber} · {policy.cropName}
                  </option>
                ))}
              </select>
            </div>

            <div className="av-field">
              <label className="av-label">{t('insCalamity')}</label>
              <select className="av-input" value={calamityType} onChange={(e) => setCalamityType(e.target.value)}>
                {CALAMITIES.map((c) => (
                  <option key={c} value={c}>
                    {t(`insCalamity_${c}`)}
                  </option>
                ))}
              </select>
            </div>

            <div className="ins-grid-2">
              <div className="av-field">
                <label className="av-label">{t('insDateOfDamage')}</label>
                <input
                  className="av-input"
                  type="date"
                  value={dateOfDamage}
                  onChange={(e) => setDateOfDamage(e.target.value)}
                />
              </div>
              <div className="av-field">
                <label className="av-label">{t('insCropStage')}</label>
                <select className="av-input" value={cropStage} onChange={(e) => setCropStage(e.target.value)}>
                  {CROP_STAGES.map((s) => (
                    <option key={s} value={s}>
                      {t(`insStage_${s}`)}
                    </option>
                  ))}
                </select>
              </div>
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

            <div className="av-field">
              <label className="av-label">{t('insVillage')}</label>
              <input className="av-input" value={village} onChange={(e) => setVillage(e.target.value)} />
            </div>

            <div className="av-field">
              <label className="av-label">{t('insGpsCoordinates')}</label>
              <div className="ins-grid-2">
                <input
                  className="av-input"
                  value={gps}
                  placeholder="20.00000,73.80000"
                  onChange={(e) => setGps(e.target.value)}
                />
                <button type="button" className="av-btn av-btn-ghost" disabled={locating} onClick={useMyLocation}>
                  {locating ? <span className="av-spinner" /> : `📍 ${t('insUseMyLocation')}`}
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
                onChange={(e) => onPickPhotos(e.target.files)}
              />
              {photos.length > 0 ? (
                <span className="ins-hint">
                  {t('insPhotosPicked', { count: photos.length, max: MAX_PHOTOS })}
                </span>
              ) : null}
            </div>

            <div className={`ins-deadline ${deadlineBreached ? 'breach' : ''}`}>⏱ {deadlineLabel}</div>

            <button type="button" className="av-btn av-btn-primary" onClick={openOverlay}>
              {t('insReviewAndSubmit')}
            </button>
          </div>
        </div>
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
            <div className={`ins-deadline ${deadlineBreached ? 'breach' : ''}`}>⏱ {deadlineLabel}</div>
            <div className="ins-actions-row">
              <button type="button" className="av-btn av-btn-ghost" onClick={() => setOverlayOpen(false)}>
                {t('insCancel')}
              </button>
              <button type="button" className="av-btn av-btn-primary" disabled={busy} onClick={() => void confirmSubmit()}>
                {busy ? <span className="av-spinner" /> : t('insConfirmSubmit')}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </ToolShell>
  );
}
