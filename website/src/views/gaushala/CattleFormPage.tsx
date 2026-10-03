import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import LabeledTextField from '../../components/LabeledTextField';
import ToolShell from '../../components/trade/ToolShell';
import { useEnsureProfile } from '../../components/trade/useEnsureProfile';
import { toast } from '../../components/toast';
import { isApiError } from '../../lib/api/client';
import {
  createAnimal,
  getMyGaushala,
  type CattleGender,
  type CattleHealthStatus,
  type CattleSpecies,
  type LactationStatus,
} from '../../lib/api/gaushala';
import { useT } from '../../lib/i18n';
import '../../lib/i18n/locales/en.gaushala';
import '../../lib/i18n/locales/hi.gaushala';
import '../../theme/gaushala.css';

const SPECIES: CattleSpecies[] = ['cow', 'buffalo', 'goat'];
const GENDERS: CattleGender[] = ['female', 'male'];
const LACTATION: LactationStatus[] = ['lactating', 'dry', 'pregnant', 'heifer', 'calf'];
const HEALTH: CattleHealthStatus[] = ['healthy', 'under_treatment', 'quarantined'];

/** New cattle intake (P8) — full AnimalIn form, POSTed to /livestock/animals with own gaushalaId. */
export default function CattleFormPage() {
  const t = useT();
  const navigate = useNavigate();
  useEnsureProfile('dairyManager');

  const [gaushalaId, setGaushalaId] = useState<string | null>(null);
  const [profileMissing, setProfileMissing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const [tagId, setTagId] = useState('');
  const [name, setName] = useState('');
  const [species, setSpecies] = useState<CattleSpecies>('cow');
  const [breed, setBreed] = useState('');
  const [gender, setGender] = useState<CattleGender>('female');
  const [ageMonths, setAgeMonths] = useState('');
  const [lactationStatus, setLactationStatus] = useState<LactationStatus>('lactating');
  const [lactationCycle, setLactationCycle] = useState('');
  const [dailyYield, setDailyYield] = useState('');
  const [sire, setSire] = useState('');
  const [dam, setDam] = useState('');
  const [healthStatus, setHealthStatus] = useState<CattleHealthStatus>('healthy');
  const [photoUrl, setPhotoUrl] = useState('');

  useEffect(() => {
    getMyGaushala()
      .then((p) => setGaushalaId(p.id))
      .catch((e) => {
        if (isApiError(e) && e.status === 404) setProfileMissing(true);
        else toast(t('actionFailed'), { error: true });
      });
  }, [t]);

  const submit = async () => {
    if (busy || !gaushalaId) return;
    const nextErrors: Record<string, string> = {};
    if (!tagId.trim()) nextErrors.tagId = t('commonRequired');
    else if (tagId.trim().length < 3) nextErrors.tagId = t('commonRequired');
    if (!name.trim()) nextErrors.name = t('commonRequired');
    if (!breed.trim()) nextErrors.breed = t('commonRequired');
    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }
    setBusy(true);
    setErrors({});
    try {
      await createAnimal({
        tagId: tagId.trim(),
        name: name.trim(),
        species,
        breed: breed.trim(),
        gender,
        ageMonths: Math.max(0, Math.min(360, Math.floor(Number(ageMonths)) || 0)),
        lactationStatus,
        lactationCycle: lactationCycle.trim() === '' ? undefined : Math.floor(Number(lactationCycle)) || 0,
        dailyYieldLiters: dailyYield.trim() === '' ? undefined : Number(dailyYield) || 0,
        sire: sire.trim(),
        dam: dam.trim(),
        healthStatus,
        photoUrl: photoUrl.trim(),
        gaushalaId,
      });
      toast(t('gaushalaCattleSaved'));
      navigate('/gaushala/console/cattle', { replace: true });
    } catch (e) {
      if (isApiError(e) && e.fieldErrors && Object.keys(e.fieldErrors).length > 0) {
        setErrors(e.fieldErrors);
      } else if (isApiError(e) && e.status === 404) {
        setProfileMissing(true);
      } else {
        toast(t('actionFailed'), { error: true });
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <ToolShell toolId="gaushalaConsole" backTo="/gaushala/console/cattle">
      <div className="gaushala-wrap">
        {profileMissing ? (
          <div className="gaushala-empty">
            <span className="gaushala-empty-icon" aria-hidden>
              🛕
            </span>
            <p className="gaushala-empty-title">{t('gaushalaCattleSetupFirst')}</p>
            <p className="gaushala-empty-body">{t('gaushalaCattleSetupBody')}</p>
            <div className="gaushala-empty-action">
              <button type="button" className="av-btn av-btn-primary" onClick={() => navigate('/gaushala/console')}>
                {t('gaushalaCattleSetupCta')}
              </button>
            </div>
          </div>
        ) : (
          <>
            <span className="gaushala-section-title" style={{ marginTop: 12 }}>
              {t('gaushalaCattleIntakeTitle')}
            </span>
            {!gaushalaId ? <p className="gaushala-hint">{t('commonLoading')}</p> : null}

            <div className="gaushala-form">
              <LabeledTextField
                label={t('gaushalaFieldTagId')}
                value={tagId}
                onChange={setTagId}
                error={errors.tagId}
                required
                maxLength={20}
              />
              <LabeledTextField
                label={t('gaushalaFieldCowName')}
                value={name}
                onChange={setName}
                error={errors.name}
                required
                maxLength={100}
              />
              <div className="av-field">
                <label className="av-label">{t('gaushalaFieldSpecies')}</label>
                <div className="av-chip-row" style={{ marginTop: 0, paddingTop: 0 }}>
                  {SPECIES.map((s) => (
                    <button
                      key={s}
                      type="button"
                      className={`av-chip${species === s ? ' selected' : ''}`}
                      onClick={() => setSpecies(s)}
                    >
                      {t(`gaushalaSpecies_${s}`)}
                    </button>
                  ))}
                </div>
              </div>
              <LabeledTextField
                label={t('gaushalaFieldBreed')}
                value={breed}
                onChange={setBreed}
                error={errors.breed}
                required
                maxLength={80}
              />
              <div className="av-field">
                <label className="av-label">{t('gaushalaFieldGender')}</label>
                <div className="av-chip-row" style={{ marginTop: 0, paddingTop: 0 }}>
                  {GENDERS.map((g) => (
                    <button
                      key={g}
                      type="button"
                      className={`av-chip${gender === g ? ' selected' : ''}`}
                      onClick={() => setGender(g)}
                    >
                      {t(`gaushalaGender_${g}`)}
                    </button>
                  ))}
                </div>
              </div>
              <LabeledTextField
                label={t('gaushalaFieldAgeMonths')}
                value={ageMonths}
                onChange={setAgeMonths}
                type="number"
                inputMode="numeric"
                error={errors.ageMonths}
              />
              <div className="av-field">
                <label className="av-label">{t('gaushalaFieldLactStatus')}</label>
                <div className="av-chip-row" style={{ marginTop: 0, paddingTop: 0 }}>
                  {LACTATION.map((ls) => (
                    <button
                      key={ls}
                      type="button"
                      className={`av-chip${lactationStatus === ls ? ' selected' : ''}`}
                      onClick={() => setLactationStatus(ls)}
                    >
                      {t(`gaushalaLact_${ls}`)}
                    </button>
                  ))}
                </div>
              </div>
              <LabeledTextField
                label={t('gaushalaFieldLactCycle')}
                value={lactationCycle}
                onChange={setLactationCycle}
                type="number"
                inputMode="numeric"
                error={errors.lactationCycle}
              />
              <LabeledTextField
                label={t('gaushalaFieldYield')}
                value={dailyYield}
                onChange={setDailyYield}
                type="number"
                inputMode="decimal"
                error={errors.dailyYieldLiters}
              />
              <LabeledTextField label={t('gaushalaFieldSire')} value={sire} onChange={setSire} error={errors.sire} />
              <LabeledTextField label={t('gaushalaFieldDam')} value={dam} onChange={setDam} error={errors.dam} />
              <div className="av-field">
                <label className="av-label">{t('gaushalaFieldHealth')}</label>
                <div className="av-chip-row" style={{ marginTop: 0, paddingTop: 0 }}>
                  {HEALTH.map((h) => (
                    <button
                      key={h}
                      type="button"
                      className={`av-chip${healthStatus === h ? ' selected' : ''}`}
                      onClick={() => setHealthStatus(h)}
                    >
                      {t(`gaushalaHealth_${h}`)}
                    </button>
                  ))}
                </div>
              </div>
              <LabeledTextField
                label={t('gaushalaFieldPhotoUrl')}
                value={photoUrl}
                onChange={setPhotoUrl}
                error={errors.photoUrl}
              />

              <div className="gaushala-actions">
                <button
                  type="button"
                  className="av-btn av-btn-primary"
                  onClick={() => void submit()}
                  disabled={busy || !gaushalaId}
                >
                  {busy ? <span className="av-spinner" aria-hidden /> : t('commonSave')}
                </button>
                <button
                  type="button"
                  className="av-btn av-btn-ghost"
                  onClick={() => navigate('/gaushala/console/cattle')}
                  disabled={busy}
                >
                  {t('commonCancel')}
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </ToolShell>
  );
}
