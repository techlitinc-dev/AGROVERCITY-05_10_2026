import { useEffect, useState } from 'react';
import LabeledTextField from '../../../components/LabeledTextField';
import { toast } from '../../../components/toast';
import { fetchStates } from '../../../lib/api/reference';
import { useT } from '../../../lib/i18n';
import { INDIAN_STATES } from '../../../lib/states';
import { useOnboardingStore } from '../../../stores/onboarding';

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const PHONE_RE = /^\d{10}$/;
const PIN_RE = /^\d{6}$/;

const GENDERS = ['male', 'female', 'other'] as const;

interface Step1IdentityProps {
  onNext: () => void;
}

/**
 * Register wizard step 1 — "Your Details". The mobile number was already
 * verified with OTP on the auth screen, so this step collects the name,
 * state (all Indian states from GET /states), optional contact/identity
 * details and the optional referral code.
 */
export default function Step1Identity({ onNext }: Step1IdentityProps) {
  const t = useT();
  const wizard = useOnboardingStore((s) => s.wizard);
  const updateWizard = useOnboardingStore((s) => s.updateWizard);

  const [states, setStates] = useState<string[]>(INDIAN_STATES);
  const [name, setName] = useState(wizard.name);
  const [stateName, setStateName] = useState(wizard.state || 'Maharashtra');
  const [email, setEmail] = useState(wizard.email);
  const [dateOfBirth, setDateOfBirth] = useState(wizard.dateOfBirth);
  const [gender, setGender] = useState(wizard.gender);
  const [pincode, setPincode] = useState(wizard.pincode);
  const [addressLine, setAddressLine] = useState(wizard.addressLine);
  const [alternatePhone, setAlternatePhone] = useState(wizard.alternatePhone);
  const [referralCode, setReferralCode] = useState(wizard.referralCode);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    let cancelled = false;
    fetchStates()
      .then((res) => {
        if (!cancelled && res.states?.length) setStates(res.states);
      })
      .catch(() => undefined); // fall back to the bundled list
    return () => {
      cancelled = true;
    };
  }, []);

  const handleContinue = () => {
    const next: Record<string, string> = {};
    if (name.trim().length === 0) next.name = t('enterFullNamePrompt');
    if (email.trim() && !EMAIL_RE.test(email.trim())) next.email = t('invalidEmail');
    if (pincode.trim() && !PIN_RE.test(pincode.trim())) next.pincode = t('invalidPincode');
    if (alternatePhone.trim() && !PHONE_RE.test(alternatePhone.trim()))
      next.alternatePhone = t('invalidPhone');
    if (Object.keys(next).length > 0) {
      setErrors(next);
      toast(next.name ?? t('checkFields'), { error: true });
      return;
    }
    updateWizard({
      name: name.trim(),
      state: stateName,
      email: email.trim(),
      dateOfBirth,
      gender,
      pincode: pincode.trim(),
      addressLine: addressLine.trim(),
      alternatePhone: alternatePhone.trim(),
      referralCode: referralCode.trim(),
    });
    onNext();
  };

  return (
    <div>
      <h1 className="av-page-title">{t('setupAccount')}</h1>
      <p className="av-page-subtitle" style={{ marginBottom: 16 }}>
        {t('setupAccountSub')}
      </p>

      <LabeledTextField
        label={t('fullName')}
        value={name}
        onChange={(v) => {
          setName(v);
          setErrors((e) => ({ ...e, name: '' }));
        }}
        placeholder={t('fullName')}
        error={errors.name}
        required
        autoComplete="name"
      />

      <div className="av-field">
        <label className="av-label">
          {t('state')} *
        </label>
        <select className="av-input" value={stateName} onChange={(e) => setStateName(e.target.value)}>
          {states.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>

      <LabeledTextField
        label={t('emailOptional')}
        type="email"
        value={email}
        onChange={(v) => {
          setEmail(v);
          setErrors((e) => ({ ...e, email: '' }));
        }}
        placeholder="you@example.com"
        error={errors.email}
        autoComplete="email"
      />

      <LabeledTextField
        label={t('dateOfBirthOptional')}
        type="date"
        value={dateOfBirth}
        onChange={setDateOfBirth}
        autoComplete="bday"
      />

      <div className="av-field">
        <label className="av-label">{t('genderOptional')}</label>
        <select
          className="av-input"
          value={gender}
          onChange={(e) => setGender(e.target.value as typeof gender)}
        >
          <option value="">—</option>
          {GENDERS.map((g) => (
            <option key={g} value={g}>
              {t(`gender_${g}`)}
            </option>
          ))}
        </select>
      </div>

      <LabeledTextField
        label={t('pincodeOptional')}
        value={pincode}
        onChange={(v) => {
          setPincode(v.replace(/\D/g, ''));
          setErrors((e) => ({ ...e, pincode: '' }));
        }}
        placeholder="000000"
        inputMode="numeric"
        maxLength={6}
        error={errors.pincode}
        autoComplete="postal-code"
      />

      <LabeledTextField
        label={t('addressLineOptional')}
        value={addressLine}
        onChange={setAddressLine}
        placeholder={t('addressLineHint')}
        autoComplete="street-address"
      />

      <LabeledTextField
        label={t('alternatePhoneOptional')}
        value={alternatePhone}
        onChange={(v) => {
          setAlternatePhone(v.replace(/\D/g, ''));
          setErrors((e) => ({ ...e, alternatePhone: '' }));
        }}
        placeholder="10-digit number"
        inputMode="tel"
        maxLength={10}
        error={errors.alternatePhone}
        autoComplete="tel"
      />

      <LabeledTextField
        label={t('referralCodeOptional')}
        value={referralCode}
        onChange={setReferralCode}
        placeholder="AGVC-XXXX"
        autoComplete="off"
      />

      <div className="wizard-actions">
        <button type="button" className="av-btn av-btn-primary" onClick={handleContinue}>
          {t('continue')}
        </button>
      </div>
    </div>
  );
}
