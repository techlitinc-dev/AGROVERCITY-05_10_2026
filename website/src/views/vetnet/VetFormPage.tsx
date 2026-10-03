import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import LabeledTextField from '../../components/LabeledTextField';
import MultiChipWithCustom from '../../components/MultiChipWithCustom';
import ToolShell from '../../components/trade/ToolShell';
import { useEnsureProfile } from '../../components/trade/useEnsureProfile';
import { toast } from '../../components/toast';
import { isApiError } from '../../lib/api/client';
import {
  createManagedVet,
  listManagedVets,
  updateManagedVet,
  type ManagedVetInput,
  type VisitType,
} from '../../lib/api/vetnet';
import { useT } from '../../lib/i18n';
import '../../lib/i18n/locales/en.vetnet';
import '../../lib/i18n/locales/hi.vetnet';
import '../../theme/vetnet.css';
import EmptyState from './components/EmptyState';

const VISIT_TYPES: VisitType[] = ['clinic', 'farm', 'tele'];
const SPEC_OPTIONS = ['Cattle', 'Buffalo', 'Goat', 'Poultry'];
const LANGUAGE_OPTIONS = ['Hindi', 'Marathi', 'English'];

function toggle(list: string[], value: string): string[] {
  return list.includes(value) ? list.filter((x) => x !== value) : [...list, value];
}

/** Create / edit a managed vet. Edit resolves the vet from the list (?id=) — no GET-single exists. */
export default function VetFormPage() {
  const t = useT();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const vetId = searchParams.get('id');
  const isEdit = Boolean(vetId);
  useEnsureProfile('dairyManager');

  const [loading, setLoading] = useState(isEdit);
  const [notFound, setNotFound] = useState(false);
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [qualification, setQualification] = useState('');
  const [specializations, setSpecializations] = useState<string[]>([]);
  const [clinicAddress, setClinicAddress] = useState('');
  const [experience, setExperience] = useState('');
  const [feeClinic, setFeeClinic] = useState('');
  const [feeFarm, setFeeFarm] = useState('');
  const [feeTele, setFeeTele] = useState('');
  const [visitTypes, setVisitTypes] = useState<VisitType[]>([]);
  const [serviceDistricts, setServiceDistricts] = useState<string[]>([]);
  const [languages, setLanguages] = useState<string[]>([]);
  const [vetCouncilRegNo, setVetCouncilRegNo] = useState('');
  const [emergencyAvailable, setEmergencyAvailable] = useState(false);
  const [availableForFarmVisit, setAvailableForFarmVisit] = useState(true);

  useEffect(() => {
    if (!vetId) return;
    listManagedVets({ pageSize: 500 })
      .then((res) => {
        const found = res.data.find((v) => v.id === vetId);
        if (!found) {
          setNotFound(true);
          return;
        }
        setName(found.name);
        setPhone(found.phone);
        setQualification(found.qualification ?? '');
        setSpecializations(found.specializations ?? []);
        setClinicAddress(found.clinicAddress ?? '');
        setExperience(found.experienceYears > 0 ? String(found.experienceYears) : '');
        setFeeClinic(found.feeClinic > 0 ? String(found.feeClinic) : '');
        setFeeFarm(found.feeFarm > 0 ? String(found.feeFarm) : '');
        setFeeTele(found.feeTele > 0 ? String(found.feeTele) : '');
        setVisitTypes((found.visitTypes ?? []) as VisitType[]);
        setServiceDistricts(found.serviceDistricts ?? []);
        setLanguages(found.languages ?? []);
        setVetCouncilRegNo(found.vetCouncilRegNo ?? '');
        setEmergencyAvailable(Boolean(found.emergencyAvailable));
        setAvailableForFarmVisit(found.availableForFarmVisit !== false);
        setLoading(false);
      })
      .catch(() => setNotFound(true));
  }, [vetId]);

  const save = async () => {
    if (busy) return;
    const nextErrors: Record<string, string> = {};
    if (!name.trim()) nextErrors.name = t('commonRequired');
    const phoneValue = phone.trim();
    if (phoneValue.length < 8 || phoneValue.length > 20) nextErrors.phone = t('vetnetPhoneInvalid');
    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }
    setBusy(true);
    setErrors({});
    const payload: ManagedVetInput = {
      name: name.trim(),
      phone: phoneValue,
      qualification: qualification.trim(),
      specializations,
      clinicAddress: clinicAddress.trim(),
      experienceYears: Number(experience) || 0,
      feeClinic: Number(feeClinic) || 0,
      feeFarm: Number(feeFarm) || 0,
      feeTele: Number(feeTele) || 0,
      visitTypes,
      serviceDistricts,
      languages,
      vetCouncilRegNo: vetCouncilRegNo.trim(),
      emergencyAvailable,
      availableForFarmVisit,
    };
    try {
      if (isEdit && vetId) await updateManagedVet(vetId, payload);
      else await createManagedVet(payload);
      toast(t(isEdit ? 'vetnetVetUpdated' : 'vetnetVetCreated'));
      navigate('/vetnet/vets');
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

  if (notFound) {
    return (
      <ToolShell toolId="vetNetwork" backTo="/vetnet/vets">
        <EmptyState
          icon="🔍"
          titleKey="vetnetVetNotFound"
          action={
            <button type="button" className="av-btn av-btn-ghost" onClick={() => navigate('/vetnet/vets')}>
              ← {t('vetnetTabVets')}
            </button>
          }
        />
      </ToolShell>
    );
  }

  return (
    <ToolShell toolId="vetNetwork" backTo="/vetnet/vets">
      <div className="vetnet-wrap">
        {isEdit && loading ? <p className="vetnet-hint">{t('commonLoading')}</p> : null}

        <div className="vetnet-form">
          <div className="vetnet-field-label" style={{ marginTop: 0 }}>
            {isEdit ? `✏️ ${t('vetnetVetEdit')}` : `＋ ${t('vetnetAddVet')}`}
          </div>
          <LabeledTextField
            label={t('vetnetVetName')}
            value={name}
            onChange={setName}
            error={errors.name}
            required
          />
          <LabeledTextField
            label={t('vetnetVetPhone')}
            value={phone}
            onChange={setPhone}
            type="tel"
            inputMode="tel"
            error={errors.phone}
            required
          />
          <LabeledTextField
            label={t('vetnetVetQualification')}
            value={qualification}
            onChange={setQualification}
            error={errors.qualification}
          />
          <div className="av-field">
            <label className="av-label">{t('vetnetVetSpecializations')}</label>
            <MultiChipWithCustom
              options={SPEC_OPTIONS}
              selected={specializations}
              onToggle={(v) => setSpecializations((list) => toggle(list, v))}
              addLabel={t('vetnetChipAdd')}
              placeholder={t('vetnetSpecPlaceholder')}
            />
          </div>
          <LabeledTextField
            label={t('vetnetVetClinic')}
            value={clinicAddress}
            onChange={setClinicAddress}
            error={errors.clinicAddress}
          />
          <LabeledTextField
            label={t('vetnetVetExperience')}
            value={experience}
            onChange={setExperience}
            type="number"
            inputMode="numeric"
            error={errors.experienceYears}
          />
          <LabeledTextField
            label={t('vetnetFeeClinic')}
            value={feeClinic}
            onChange={setFeeClinic}
            type="number"
            inputMode="numeric"
            error={errors.feeClinic}
          />
          <LabeledTextField
            label={t('vetnetFeeFarm')}
            value={feeFarm}
            onChange={setFeeFarm}
            type="number"
            inputMode="numeric"
            error={errors.feeFarm}
          />
          <LabeledTextField
            label={t('vetnetFeeTele')}
            value={feeTele}
            onChange={setFeeTele}
            type="number"
            inputMode="numeric"
            error={errors.feeTele}
          />
          <div className="av-field">
            <label className="av-label">{t('vetnetVisitTypes')}</label>
            <div className="av-chip-row" style={{ marginTop: 0, paddingTop: 0 }}>
              {VISIT_TYPES.map((vt) => (
                <button
                  key={vt}
                  type="button"
                  className={`av-chip${visitTypes.includes(vt) ? ' selected' : ''}`}
                  onClick={() => setVisitTypes((list) => toggle(list, vt) as VisitType[])}
                >
                  {t(`vetnetVisit_${vt}`)}
                </button>
              ))}
            </div>
          </div>
          <div className="av-field">
            <label className="av-label">{t('vetnetServiceDistricts')}</label>
            <MultiChipWithCustom
              options={[]}
              selected={serviceDistricts}
              onToggle={(v) => setServiceDistricts((list) => toggle(list, v))}
              addLabel={t('vetnetChipAdd')}
              placeholder={t('vetnetDistrictsPlaceholder')}
            />
          </div>
          <div className="av-field">
            <label className="av-label">{t('vetnetVetLanguages')}</label>
            <MultiChipWithCustom
              options={LANGUAGE_OPTIONS}
              selected={languages}
              onToggle={(v) => setLanguages((list) => toggle(list, v))}
              addLabel={t('vetnetChipAdd')}
              placeholder={t('vetnetLanguagesPlaceholder')}
            />
          </div>
          <LabeledTextField
            label={t('vetnetVetRegNo')}
            value={vetCouncilRegNo}
            onChange={setVetCouncilRegNo}
            error={errors.vetCouncilRegNo}
          />
          <div className="av-field">
            <label className="av-label">{t('vetnetEmergencyToggle')}</label>
            <div className="av-chip-row" style={{ marginTop: 0, paddingTop: 0 }}>
              <button
                type="button"
                className={`av-chip${emergencyAvailable ? ' selected' : ''}`}
                onClick={() => setEmergencyAvailable((v) => !v)}
              >
                {emergencyAvailable ? '✓ ' : ''}
                {t('vetnetEmergencyToggle')}
              </button>
            </div>
          </div>
          <div className="av-field">
            <label className="av-label">{t('vetnetFarmVisitToggle')}</label>
            <div className="av-chip-row" style={{ marginTop: 0, paddingTop: 0 }}>
              <button
                type="button"
                className={`av-chip${availableForFarmVisit ? ' selected' : ''}`}
                onClick={() => setAvailableForFarmVisit((v) => !v)}
              >
                {availableForFarmVisit ? '✓ ' : ''}
                {t('vetnetFarmVisitToggle')}
              </button>
            </div>
          </div>

          <div className="vetnet-actions">
            <button type="button" className="av-btn av-btn-primary" onClick={() => void save()} disabled={busy}>
              {busy ? <span className="av-spinner" aria-hidden /> : t('commonSave')}
            </button>
            <button type="button" className="av-btn av-btn-ghost" onClick={() => navigate('/vetnet/vets')} disabled={busy}>
              {t('commonCancel')}
            </button>
          </div>
        </div>
      </div>
    </ToolShell>
  );
}
