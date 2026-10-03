import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import ModalSheet from '../../components/ModalSheet';
import ToolShell from '../../components/trade/ToolShell';
import { useEnsureProfile } from '../../components/trade/useEnsureProfile';
import { toast } from '../../components/toast';
import { isApiError } from '../../lib/api/client';
import {
  enrollCampaign,
  getCampaign,
  listVetAnimals,
  markVaccinated,
  type CampaignDetail,
  type CampaignEnrollment,
  type VetAnimal,
} from '../../lib/api/vetnet';
import { useT } from '../../lib/i18n';
import '../../lib/i18n/locales/en.vetnet';
import '../../lib/i18n/locales/hi.vetnet';
import '../../theme/vetnet.css';
import EmptyState from './components/EmptyState';
import { fmtDate } from '../dairy/components/SlipCard';

const CMP_PILL: Record<CampaignDetail['status'], string> = {
  upcoming: 'vetnet-pill-info',
  active: 'vetnet-pill-ok',
  closed: 'vetnet-pill-grey',
};

const ENR_PILL: Record<CampaignEnrollment['status'], string> = {
  enrolled: 'vetnet-pill-info',
  vaccinated: 'vetnet-pill-ok',
};

/** Campaign detail (P9) — full header, own-animal enrollment, mark-vaccinated. */
export default function CampaignDetailPage() {
  const t = useT();
  const navigate = useNavigate();
  const { campaignId } = useParams<{ campaignId: string }>();
  useEnsureProfile('dairyManager');

  const [campaign, setCampaign] = useState<CampaignDetail | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [failed, setFailed] = useState(false);

  const [enrollOpen, setEnrollOpen] = useState(false);
  const [animals, setAnimals] = useState<VetAnimal[] | null>(null);
  const [pickedAnimal, setPickedAnimal] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    if (!campaignId) return;
    setFailed(false);
    getCampaign(campaignId)
      .then(setCampaign)
      .catch((e) => {
        if (isApiError(e) && e.status === 404) setNotFound(true);
        else setFailed(true);
      });
  }, [campaignId]);

  useEffect(load, [load]);

  const openEnroll = () => {
    setPickedAnimal('');
    setAnimals(null);
    setEnrollOpen(true);
    listVetAnimals()
      .then((res) => setAnimals(res.data))
      .catch(() => setAnimals([]));
  };

  const submitEnroll = async () => {
    if (!campaignId || busy) return;
    if (!pickedAnimal) {
      toast(t('vetnetRxSelectAnimalRequired'), { error: true });
      return;
    }
    setBusy(true);
    try {
      await enrollCampaign(campaignId, pickedAnimal);
      toast(t('vetnetCmpEnrolled'));
      setEnrollOpen(false);
      load();
    } catch (e) {
      if (isApiError(e) && e.code === 'ALREADY_ENROLLED') {
        toast(t('vetnetCmpAlreadyEnrolled'), { error: true });
      } else {
        toast(t('actionFailed'), { error: true });
      }
      if (isApiError(e) && (e.status === 403 || e.status === 409)) {
        setEnrollOpen(false);
        load();
      }
    } finally {
      setBusy(false);
    }
  };

  const submitMarkVaccinated = async (enrollment: CampaignEnrollment) => {
    if (!campaignId || busy) return;
    setBusy(true);
    try {
      await markVaccinated(campaignId, enrollment.animalId);
      toast(t('vetnetCmpVaccinated'));
      load();
    } catch {
      toast(t('actionFailed'), { error: true });
      load();
    } finally {
      setBusy(false);
    }
  };

  if (notFound) {
    return (
      <ToolShell toolId="vetNetwork" backTo="/vetnet/campaigns">
        <EmptyState
          icon="🔍"
          titleKey="vetnetCmpNotFound"
          action={
            <button type="button" className="av-btn av-btn-ghost" onClick={() => navigate('/vetnet/campaigns')}>
              ← {t('vetnetTabCampaigns')}
            </button>
          }
        />
      </ToolShell>
    );
  }

  return (
    <ToolShell toolId="vetNetwork" backTo="/vetnet/campaigns">
      <div className="vetnet-wrap">
        {campaign === null && !failed ? <p className="vetnet-hint">{t('commonLoading')}</p> : null}

        {failed ? (
          <EmptyState
            icon="📡"
            titleKey="vetnetLoadFailed"
            action={
              <button type="button" className="av-btn av-btn-ghost" onClick={load}>
                ↻ {t('retry')}
              </button>
            }
          />
        ) : null}

        {campaign ? (
          <>
            <div className="vetnet-card" style={{ marginTop: 10 }}>
              <div className="vetnet-card-row">
                <span className="vetnet-card-title">{campaign.title}</span>
                <span className={`vetnet-pill ${CMP_PILL[campaign.status]}`}>
                  {t(`vetnetCmpStatus_${campaign.status}`)}
                </span>
              </div>
              <div className="vetnet-card-sub">
                {t('vetnetCmpVaccineLabel')}: {campaign.vaccine}
              </div>
              {campaign.disease ? (
                <div className="vetnet-card-sub">
                  {t('vetnetCmpDiseaseLabel')}: {campaign.disease}
                </div>
              ) : null}
              <div className="vetnet-card-sub">
                {t('vetnetCmpWindow', { from: fmtDate(campaign.fromDate), to: fmtDate(campaign.toDate) })}
              </div>
              {campaign.targetDistricts?.length ? (
                <div className="vetnet-mini-chips">
                  {campaign.targetDistricts.map((d) => (
                    <span key={d} className="vetnet-mini-chip">
                      {d}
                    </span>
                  ))}
                </div>
              ) : null}
              <div className="vetnet-card-amount">{t('vetnetCmpCount', { count: campaign.enrollmentCount })}</div>
            </div>

            <div className="vetnet-actions">
              <button
                type="button"
                className="av-btn av-btn-primary"
                onClick={openEnroll}
                disabled={campaign.status === 'closed'}
              >
                ＋ {t('vetnetCmpEnroll')}
              </button>
            </div>

            <div className="vetnet-field-label" style={{ marginTop: 14 }}>
              {t('vetnetCmpEnrollments')}
            </div>
            {campaign.enrollments.length === 0 ? (
              <EmptyState icon="💉" titleKey="vetnetCmpEnrollmentsEmpty" />
            ) : (
              <div className="vetnet-list">
                {campaign.enrollments.map((enrollment) => (
                  <div key={enrollment.id} className="vetnet-card">
                    <div className="vetnet-enr-row">
                      <span className="vetnet-card-sub">
                        {t('vetnetCmpAnimalCol')}: {enrollment.animalId}
                      </span>
                      <span className={`vetnet-pill ${ENR_PILL[enrollment.status]}`}>
                        {t(`vetnetEnrStatus_${enrollment.status}`)}
                      </span>
                    </div>
                    <div className="vetnet-card-sub">
                      {t('vetnetCmpFarmerCol')}: {enrollment.farmerUid}
                    </div>
                    {enrollment.status === 'vaccinated' && enrollment.vaccinatedAt ? (
                      <div className="vetnet-card-sub">
                        {t('vetnetCmpVaccinatedAt')}: {fmtDate(enrollment.vaccinatedAt)}
                      </div>
                    ) : null}
                    {enrollment.status === 'enrolled' ? (
                      <div className="vetnet-actions-row">
                        <button
                          type="button"
                          className="av-btn av-btn-primary"
                          onClick={() => void submitMarkVaccinated(enrollment)}
                          disabled={busy}
                        >
                          💉 {t('vetnetCmpMarkVaccinated')}
                        </button>
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            )}
          </>
        ) : null}
      </div>

      <ModalSheet open={enrollOpen} onClose={() => !busy && setEnrollOpen(false)} title={t('vetnetCmpEnrollTitle')}>
        <div className="vetnet-form">
          <p className="vetnet-hint" style={{ marginTop: 0 }}>
            {t('vetnetCmpEnrollHint')}
          </p>
          {animals === null ? <p className="vetnet-hint">{t('commonLoading')}</p> : null}
          {animals !== null && animals.length === 0 ? (
            <p className="vetnet-hint">{t('vetnetCmpEnrollEmpty')}</p>
          ) : null}
          {animals !== null && animals.length > 0 ? (
            <div className="vetnet-chip-row" style={{ marginTop: 0, paddingTop: 0, maxHeight: 180, overflowY: 'auto' }}>
              {animals.map((a) => (
                <button
                  key={a.id}
                  type="button"
                  className={`av-chip${pickedAnimal === a.id ? ' selected' : ''}`}
                  onClick={() => setPickedAnimal(a.id)}
                >
                  {a.tagId} · {a.name}
                </button>
              ))}
            </div>
          ) : null}
          <div className="vetnet-actions">
            <button type="button" className="av-btn av-btn-primary" onClick={() => void submitEnroll()} disabled={busy}>
              {busy ? <span className="av-spinner" aria-hidden /> : t('vetnetCmpEnroll')}
            </button>
            <button type="button" className="av-btn av-btn-ghost" onClick={() => setEnrollOpen(false)} disabled={busy}>
              {t('commonCancel')}
            </button>
          </div>
        </div>
      </ModalSheet>
    </ToolShell>
  );
}
