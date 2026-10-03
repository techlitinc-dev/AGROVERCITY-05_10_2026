import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import LabeledTextField from '../../components/LabeledTextField';
import MpinPad from '../../components/MpinPad';
import OtpField from '../../components/OtpField';
import { toast } from '../../components/toast';
import { usePhoneOtp } from '../../components/usePhoneOtp';
import { firebaseVerify, loginWithPhoneMpin, setMpin } from '../../lib/api/auth';
import { isApiError } from '../../lib/api/client';
import { normalizePhone } from '../../lib/firebase';
import { useT } from '../../lib/i18n';
import { useOnboardingStore } from '../../stores/onboarding';
import { useSessionStore } from '../../stores/session';
import ForgotMpinSheet from './ForgotMpinSheet';
import '../../theme/views.css';

type Step = 'phone' | 'mpin' | 'otp' | 'setMpin';
type OtpPurpose = 'register' | 'setMpin';

interface LoginFormProps {
  /** Unregistered number — ask AuthView to open the register wizard. */
  onNeedsRegister: (phoneE164: string) => void;
}

/**
 * Login chain: phone → (probe) → MPIN (registered) or OTP → register.
 * Probe: POST /auth/login with an unknown MPIN — WRONG_MPIN means the number
 * is registered, USER_NOT_FOUND means it is not.
 * Unregistered → verify the number with OTP, then register + set MPIN.
 * MPIN_NOT_SET → OTP → set MPIN. WRONG_MPIN → red pad. Forgot → sheet.
 */
export default function LoginForm({ onNeedsRegister }: LoginFormProps) {
  const t = useT();
  const navigate = useNavigate();
  const setAuth = useSessionStore((s) => s.setAuth);
  const setOnboarded = useOnboardingStore((s) => s.setOnboarded);

  const [step, setStep] = useState<Step>('phone');
  const [phone, setPhone] = useState('');
  const [mpin, setMpin] = useState('');
  const [otp, setOtp] = useState('');
  const [wrongMpin, setWrongMpin] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [forgotOpen, setForgotOpen] = useState(false);
  const [otpPurpose, setOtpPurpose] = useState<OtpPurpose>('register');
  const otpFlow = usePhoneOtp(phone);

  const phoneValid = /^\d{10}$/.test(phone);
  const phoneE164 = normalizePhone(phone);

  const finishLogin = async (pin: string) => {
    const response = await loginWithPhoneMpin(phoneE164, pin);
    setAuth(response);
    setOnboarded(true);
    navigate('/dashboard');
  };

  const submitPhone = async () => {
    if (!phoneValid) {
      toast(t('invalidPhone'), { error: true });
      return;
    }
    if (busy) return;
    setBusy(true);
    setNotice(null);
    setWrongMpin(false);
    setMpin('');
    try {
      // Probe registration status with an intentionally wrong MPIN.
      await loginWithPhoneMpin(phoneE164, '0000');
      // Unreachable in practice (0000 is never correct) — but if it were, the
      // credentials just worked, so ask for the MPIN again normally.
      setBusy(false);
      setStep('mpin');
    } catch (e) {
      if (isApiError(e)) {
        switch (e.code) {
          case 'WRONG_MPIN':
            // Number is registered → ask for the MPIN.
            setBusy(false);
            setStep('mpin');
            return;
          case 'USER_NOT_FOUND':
            // Number is not registered → verify it with OTP, then register.
            setBusy(false);
            useOnboardingStore.getState().updateWizard({ phone: phoneE164 });
            setOtp('');
            setOtpPurpose('register');
            setStep('otp');
            void otpFlow.send();
            return;
          case 'MPIN_NOT_SET':
            setBusy(false);
            setNotice(t('loginMpinNotSet'));
            setOtp('');
            setOtpPurpose('setMpin');
            setStep('otp');
            void otpFlow.send();
            return;
          default:
            setBusy(false);
            toast(e.message, { error: true });
            return;
        }
      }
      setBusy(false);
      toast(e instanceof Error ? e.message : t('login'), { error: true });
    }
  };

  const submitMpin = async () => {
    if (mpin.length !== 4 || busy) return;
    setBusy(true);
    setWrongMpin(false);
    try {
      await finishLogin(mpin);
    } catch (e) {
      if (isApiError(e)) {
        switch (e.code) {
          case 'WRONG_MPIN':
            setBusy(false);
            setWrongMpin(true);
            setMpin('');
            return;
          case 'USER_NOT_FOUND':
            setBusy(false);
            onNeedsRegister(phoneE164);
            return;
          case 'MPIN_NOT_SET':
            setBusy(false);
            setNotice(t('loginMpinNotSet'));
            setStep('otp');
            void otpFlow.send();
            return;
          default:
            setBusy(false);
            toast(e.message, { error: true });
            return;
        }
      }
      setBusy(false);
      toast(e instanceof Error ? e.message : t('login'), { error: true });
    }
  };

  const submitOtp = async () => {
    if (otp.length < 4) {
      toast(t('invalidOtp'), { error: true });
      return;
    }
    const idToken = await otpFlow.verify(otp);
    if (!idToken) return;
    if (otpPurpose === 'register') {
      // Number verified — hand off to the register wizard (details + MPIN).
      useOnboardingStore.getState().updateWizard({ idToken, otpVerified: true, phone: phoneE164 });
      onNeedsRegister(phoneE164);
      return;
    }
    try {
      const response = await firebaseVerify(idToken);
      if (response.isNewUser) {
        useOnboardingStore.getState().updateWizard({ idToken, otpVerified: true, phone: phoneE164 });
        onNeedsRegister(phoneE164);
        return;
      }
      setAuth(response);
      setOtp('');
      setMpin('');
      setStep('setMpin');
    } catch (e) {
      toast(isApiError(e) ? e.message : t('errOtpVerifyFailed'), { error: true });
    }
  };

  const submitSetMpin = async () => {
    if (mpin.length !== 4 || busy) return;
    setBusy(true);
    try {
      await setMpin(mpin);
      setBusy(false);
      setMpin('');
      setNotice(t('enterMpin'));
      setStep('mpin'); // back to MPIN login with the freshly set MPIN
    } catch (e) {
      setBusy(false);
      toast(isApiError(e) ? e.message : t('setMpinTitle'), { error: true });
    }
  };

  return (
    <div>
      {notice ? <div className="auth-notice">{notice}</div> : null}

      {step === 'phone' ? (
        <div>
          <LabeledTextField
            label={t('mobileNumber')}
            value={phone}
            onChange={(v) => setPhone(v.replace(/\D/g, '').slice(0, 10))}
            prefix="+91"
            inputMode="tel"
            maxLength={10}
            placeholder="98765 43210"
            autoComplete="tel"
          />
          <button
            type="button"
            className="av-btn av-btn-primary"
            disabled={!phoneValid || busy}
            onClick={() => void submitPhone()}
          >
            {busy ? <span className="av-spinner" /> : t('continue')}
          </button>
        </div>
      ) : null}

      {step === 'mpin' ? (
        <div>
          <LabeledTextField
            label={t('mobileNumber')}
            value={phone}
            onChange={() => undefined}
            prefix="+91"
            disabled
          />
          <MpinPad
            label={t('enterMpin')}
            value={mpin}
            onChange={(v) => {
              setMpin(v);
              setWrongMpin(false);
            }}
            error={wrongMpin}
          />
          {wrongMpin ? <p className="mpin-error-text">{t('wrongMpin')}</p> : null}
          <button
            type="button"
            className="av-btn av-btn-primary"
            disabled={mpin.length !== 4 || busy}
            onClick={() => void submitMpin()}
          >
            {busy ? <span className="av-spinner" /> : t('login')}
          </button>
          <div className="auth-links-row">
            <button type="button" className="av-link" onClick={() => setForgotOpen(true)}>
              {t('forgotMpin')}
            </button>
            <button
              type="button"
              className="av-link"
              onClick={() => {
                setStep('phone');
                setMpin('');
                setWrongMpin(false);
              }}
            >
              {t('changeNumber')}
            </button>
          </div>
        </div>
      ) : null}

      {step === 'otp' ? (
        <div>
          <LabeledTextField
            label={t('mobileNumber')}
            value={phone}
            onChange={() => undefined}
            prefix="+91"
            disabled
          />
          <OtpField
            value={otp}
            onChange={setOtp}
            onVerify={() => void submitOtp()}
            verifyDisabled={otp.length < 4 || otpFlow.verifying}
            verifying={otpFlow.verifying}
            onResend={() => void otpFlow.send()}
            resendDisabled={otpFlow.sending}
            countdown={otpFlow.countdown}
          />
          <div className="auth-links-row">
            <button
              type="button"
              className="av-link"
              onClick={() => {
                setStep('mpin');
                setOtp('');
              }}
            >
              {t('back')}
            </button>
          </div>
        </div>
      ) : null}

      {step === 'setMpin' ? (
        <div>
          <MpinPad label={t('newMpinFourDigits')} value={mpin} onChange={setMpin} />
          <button
            type="button"
            className="av-btn av-btn-primary"
            disabled={mpin.length !== 4 || busy}
            onClick={() => void submitSetMpin()}
          >
            {busy ? <span className="av-spinner" /> : t('setMpinAndLogin')}
          </button>
        </div>
      ) : null}

      <ForgotMpinSheet open={forgotOpen} onClose={() => setForgotOpen(false)} onReset={() => {
        setStep('mpin');
        setMpin('');
        setWrongMpin(false);
      }} />
    </div>
  );
}
