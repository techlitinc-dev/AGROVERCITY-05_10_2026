import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import ToolShell from '../../components/trade/ToolShell';
import { useEnsureProfile } from '../../components/trade/useEnsureProfile';
import { toast } from '../../components/toast';
import { isApiError } from '../../lib/api/client';
import {
  addSurveyor,
  getProviderClaims,
  listSurveyors,
  removeSurveyor,
  scheduleSurvey,
  type InsuranceClaim,
  type Surveyor,
} from '../../lib/api/insurance';
import { useT } from '../../lib/i18n';
import InsEmptyState from './components/InsEmptyState';
import SlaClock from './components/SlaClock';
import './insurance.css';

/**
 * Surveyor roster + assignment (A2). The roster is a provider-managed list of
 * {name, phone, districts[]}; assignment calls schedule_survey on intimations
 * that still need a surveyor. Phones render only inside this console.
 */
export default function SurveyorsPage() {
  const t = useT();
  useEnsureProfile('insuranceProvider');

  const [roster, setRoster] = useState<Surveyor[] | null>(null);
  const [pending, setPending] = useState<InsuranceClaim[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState(false);

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [districts, setDistricts] = useState('');

  const [selected, setSelected] = useState<Record<string, string>>({});
  const [visitDate, setVisitDate] = useState<Record<string, string>>({});

  const load = useCallback(() => {
    setFailed(false);
    Promise.all([listSurveyors(), getProviderClaims({ status: 'intimated', pageSize: 100 })])
      .then(([rosterRes, claimsRes]) => {
        setRoster(rosterRes);
        setPending(claimsRes.data);
      })
      .catch(() => setFailed(true));
  }, []);

  useEffect(load, [load]);

  const submitRoster = async () => {
    const districtList = districts
      .split(',')
      .map((d) => d.trim())
      .filter((d) => d.length > 0);
    if (!name.trim() || phone.trim().length < 6) {
      toast(t('insSurveyorFormInvalid'), { error: true });
      return;
    }
    setBusy(true);
    try {
      const created = await addSurveyor({ name: name.trim(), phone: phone.trim(), districts: districtList });
      setRoster((prev) => [...(prev ?? []), created]);
      setName('');
      setPhone('');
      setDistricts('');
      toast(t('insSurveyorAdded'));
    } catch (e) {
      toast(isApiError(e) ? e.message : t('insActionFailed'), { error: true });
    } finally {
      setBusy(false);
    }
  };

  const drop = async (surveyorId: string) => {
    setBusy(true);
    try {
      await removeSurveyor(surveyorId);
      setRoster((prev) => (prev ?? []).filter((s) => s.id !== surveyorId));
      toast(t('insSurveyorRemoved'));
    } catch (e) {
      toast(isApiError(e) ? e.message : t('insActionFailed'), { error: true });
    } finally {
      setBusy(false);
    }
  };

  const assign = async (claim: InsuranceClaim) => {
    const surveyorId = selected[claim.id];
    const visit = visitDate[claim.id];
    const surveyor = (roster ?? []).find((s) => s.id === surveyorId);
    if (!surveyor) {
      toast(t('insPickSurveyor'), { error: true });
      return;
    }
    if (!visit) {
      toast(t('insPickVisitDate'), { error: true });
      return;
    }
    setBusy(true);
    try {
      await scheduleSurvey(claim.id, {
        surveyorName: surveyor.name,
        surveyorPhone: surveyor.phone,
        surveyorVisitDate: visit,
      });
      setPending((prev) => (prev ?? []).filter((c) => c.id !== claim.id));
      toast(t('insSurveyorAssigned'));
    } catch (e) {
      toast(isApiError(e) ? e.message : t('insActionFailed'), { error: true });
    } finally {
      setBusy(false);
    }
  };

  return (
    <ToolShell toolId="insuranceProviderHome" backTo="/insurance/console">
      <div className="ins-wrap">
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
        ) : (
          <>
            <div className="ins-section">
              <span className="ins-section-title">🧭 {t('insRosterTitle')}</span>
              {roster === null ? <p className="ins-hint">{t('commonLoading')}</p> : null}
              {roster !== null && roster.length === 0 ? (
                <InsEmptyState icon="🧭" titleKey="insRosterEmpty" bodyKey="insRosterEmptyBody" />
              ) : null}
              <div className="ins-list">
                {(roster ?? []).map((surveyor) => (
                  <div key={surveyor.id} className="ins-card">
                    <div className="ins-card-row">
                      <span className="ins-card-title">{surveyor.name}</span>
                      <button
                        type="button"
                        className="av-btn av-btn-ghost"
                        disabled={busy}
                        onClick={() => void drop(surveyor.id)}
                      >
                        ✕ {t('insRemove')}
                      </button>
                    </div>
                    <span className="ins-card-sub">{surveyor.phone}</span>
                    {surveyor.districts.length > 0 ? (
                      <span className="ins-card-sub">
                        {t('insSurveyorDistricts')}: {surveyor.districts.join(', ')}
                      </span>
                    ) : null}
                  </div>
                ))}
              </div>

              <div className="ins-form">
                <div className="av-field">
                  <label className="av-label">{t('insSurveyorName')}</label>
                  <input className="av-input" value={name} onChange={(e) => setName(e.target.value)} />
                </div>
                <div className="av-field">
                  <label className="av-label">{t('insSurveyorPhone')}</label>
                  <input className="av-input" value={phone} onChange={(e) => setPhone(e.target.value)} />
                </div>
                <div className="av-field">
                  <label className="av-label">{t('insSurveyorDistricts')}</label>
                  <input
                    className="av-input"
                    value={districts}
                    placeholder={t('insSurveyorDistrictsPlaceholder')}
                    onChange={(e) => setDistricts(e.target.value)}
                  />
                </div>
                <button type="button" className="av-btn av-btn-primary" disabled={busy} onClick={() => void submitRoster()}>
                  {busy ? <span className="av-spinner" /> : t('insAddSurveyor')}
                </button>
              </div>
            </div>

            <div className="ins-section">
              <span className="ins-section-title">📌 {t('insAssignmentsTitle')}</span>
              {pending !== null && pending.length === 0 ? (
                <InsEmptyState icon="✅" titleKey="insAssignmentsEmpty" bodyKey="insAssignmentsEmptyBody" />
              ) : null}
              <div className="ins-list">
                {(pending ?? []).map((claim) => (
                  <div key={claim.id} className="ins-card">
                    <div className="ins-card-row">
                      <Link className="ins-card-title" to={`/insurance/console/claims/${claim.id}`}>
                        {claim.claimNumber}
                      </Link>
                      <SlaClock fromIso={claim.submittedAt} />
                    </div>
                    <span className="ins-card-sub">
                      {claim.farmerName || t('insFarmer')} · {claim.cropName} · {claim.village}
                    </span>
                    <div className="ins-grid-2">
                      <div className="av-field" style={{ marginBottom: 0 }}>
                        <label className="av-label">{t('insPickSurveyor')}</label>
                        <select
                          className="av-input"
                          value={selected[claim.id] ?? ''}
                          onChange={(e) => setSelected((prev) => ({ ...prev, [claim.id]: e.target.value }))}
                        >
                          <option value="">{t('insSelectPlaceholder')}</option>
                          {(roster ?? []).map((s) => (
                            <option key={s.id} value={s.id}>
                              {s.name}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="av-field" style={{ marginBottom: 0 }}>
                        <label className="av-label">{t('insVisitDate')}</label>
                        <input
                          className="av-input"
                          type="date"
                          value={visitDate[claim.id] ?? ''}
                          onChange={(e) => setVisitDate((prev) => ({ ...prev, [claim.id]: e.target.value }))}
                        />
                      </div>
                    </div>
                    <button type="button" className="av-btn av-btn-primary" disabled={busy} onClick={() => void assign(claim)}>
                      {t('insAssignSurveyor')}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </ToolShell>
  );
}
