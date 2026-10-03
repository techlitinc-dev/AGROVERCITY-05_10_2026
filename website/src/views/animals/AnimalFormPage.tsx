import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import LabeledTextField from '../../components/LabeledTextField';
import SegmentedControl from '../../components/SegmentedControl';
import ToolShell from '../../components/trade/ToolShell';
import { toast } from '../../components/toast';
import { isApiError } from '../../lib/api/client';
import {
  registerAnimal,
  type AnimalGender,
  type AnimalSpecies,
  type HealthStatus,
  type LactationStatus,
} from '../../lib/api/animals';
import { useT } from '../../lib/i18n';
import '../../lib/i18n/locales/en.animals';
import '../../lib/i18n/locales/hi.animals';
import '../../theme/animals.css';

const SPECIES: AnimalSpecies[] = ['cow', 'buffalo', 'goat'];
const LACTATIONS: LactationStatus[] = ['lactating', 'dry', 'pregnant', 'heifer', 'calf'];
const HEALTHS: HealthStatus[] = ['healthy', 'under_treatment', 'quarantined'];

/**
 * Animal registration (P10) — one-shot create form. There is NO edit endpoint:
 * after creation animals are read-only, so this page has no edit mode.
 */
export default function AnimalFormPage() {
  const t = useT();
  const navigate = useNavigate();

  const [tagId, setTagId] = useState('');
  const [name, setName] = useState('');
  const [species, setSpecies] = useState<AnimalSpecies>('cow');
  const [breed, setBreed] = useState('');
  const [gender, setGender] = useState<AnimalGender>('female');
  const [ageMonths, setAgeMonths] = useState('');
  const [lactationStatus, setLactationStatus] = useState<LactationStatus>('lactating');
  const [lactationCycle, setLactationCycle] = useState('1');
  const [dailyYield, setDailyYield] = useState('');
  const [sire, setSire] = useState('');
  const [dam, setDam] = useState('');
  const [healthStatus, setHealthStatus] = useState<HealthStatus>('healthy');

  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const submit = async () => {
    if (busy) return;
    const nextErrors: Record<string, string> = {};
    if (tagId.trim().length < 3) nextErrors.tagId = t('commonRequired');
    if (!name.trim()) nextErrors.name = t('commonRequired');
    if (!breed.trim()) nextErrors.breed = t('commonRequired');
    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }
    setBusy(true);
    setErrors({});
    try {
      const animal = await registerAnimal({
        tagId: tagId.trim(),
        name: name.trim(),
        species,
        breed: breed.trim(),
        gender,
        ageMonths: ageMonths === '' ? 0 : Number(ageMonths),
        lactationStatus,
        lactationCycle: lactationCycle === '' ? 0 : Number(lactationCycle),
        dailyYieldLiters: dailyYield === '' ? 0 : Number(dailyYield),
        sire: sire.trim(),
        dam: dam.trim(),
        healthStatus,
      });
      toast(t('animalsFormCreated'));
      navigate(`/livestock/animals/${animal.id}`);
    } catch (e) {
      if (isApiError(e) && e.fieldErrors && Object.keys(e.fieldErrors).length > 0) {
        setErrors(e.fieldErrors);
      } else {
        toast(t('actionFailed'), { error: true });
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <ToolShell toolId="livestock" backTo="/livestock/animals">
      <div className="animals-wrap">
        <div className="animals-section">
          <span className="animals-section-title">🐄 {t('animalsFormTitle')}</span>

          <div className="animals-form">
            <LabeledTextField
              label={t('animalsFormTagId')}
              value={tagId}
              onChange={setTagId}
              placeholder="KA-1024"
              error={errors.tagId}
              required
              maxLength={20}
            />
            <LabeledTextField
              label={t('animalsFormName')}
              value={name}
              onChange={setName}
              error={errors.name}
              required
              maxLength={100}
            />
            <div className="av-field">
              <label className="av-label">{t('animalsFormSpecies')}</label>
              <div className="av-chip-row" style={{ marginTop: 0, paddingTop: 0 }}>
                {SPECIES.map((s) => (
                  <button
                    key={s}
                    type="button"
                    className={`av-chip${species === s ? ' selected' : ''}`}
                    onClick={() => setSpecies(s)}
                  >
                    {t(`animalsSpecies_${s}`)}
                  </button>
                ))}
              </div>
            </div>
            <LabeledTextField
              label={t('animalsFormBreed')}
              value={breed}
              onChange={setBreed}
              placeholder="Gir / HF / Murrah"
              error={errors.breed}
              required
              maxLength={80}
            />
            <div className="av-field">
              <label className="av-label">{t('animalsFormGender')}</label>
              <SegmentedControl<AnimalGender>
                value={gender}
                onChange={setGender}
                options={[
                  { value: 'female', label: t('animalsGender_female') },
                  { value: 'male', label: t('animalsGender_male') },
                ]}
              />
            </div>
            <LabeledTextField
              label={t('animalsFormAgeMonths')}
              value={ageMonths}
              onChange={setAgeMonths}
              type="number"
              inputMode="numeric"
              error={errors.ageMonths}
            />
            <div className="av-field">
              <label className="av-label">{t('animalsFormLactStatus')}</label>
              <div className="av-chip-row" style={{ marginTop: 0, paddingTop: 0 }}>
                {LACTATIONS.map((l) => (
                  <button
                    key={l}
                    type="button"
                    className={`av-chip${lactationStatus === l ? ' selected' : ''}`}
                    onClick={() => setLactationStatus(l)}
                  >
                    {t(`animalsLact_${l}`)}
                  </button>
                ))}
              </div>
            </div>
            <LabeledTextField
              label={t('animalsFormLactCycle')}
              value={lactationCycle}
              onChange={setLactationCycle}
              type="number"
              inputMode="numeric"
              error={errors.lactationCycle}
            />
            <LabeledTextField
              label={t('animalsFormDailyYield')}
              value={dailyYield}
              onChange={setDailyYield}
              type="number"
              inputMode="decimal"
              error={errors.dailyYieldLiters}
            />
            <LabeledTextField
              label={t('animalsFormSire')}
              value={sire}
              onChange={setSire}
              error={errors.sire}
              maxLength={80}
            />
            <LabeledTextField
              label={t('animalsFormDam')}
              value={dam}
              onChange={setDam}
              error={errors.dam}
              maxLength={80}
            />
            <div className="av-field">
              <label className="av-label">{t('animalsFormHealth')}</label>
              <div className="av-chip-row" style={{ marginTop: 0, paddingTop: 0 }}>
                {HEALTHS.map((h) => (
                  <button
                    key={h}
                    type="button"
                    className={`av-chip${healthStatus === h ? ' selected' : ''}`}
                    onClick={() => setHealthStatus(h)}
                  >
                    {t(`animalsHealth_${h}`)}
                  </button>
                ))}
              </div>
            </div>

            <div className="animals-actions">
              <button type="button" className="av-btn av-btn-primary" onClick={() => void submit()} disabled={busy}>
                {busy ? <span className="av-spinner" aria-hidden /> : t('commonSave')}
              </button>
            </div>
          </div>
        </div>
      </div>
    </ToolShell>
  );
}
