import { useState } from 'react';
import LabeledTextField from '../../components/LabeledTextField';
import ModalSheet from '../../components/ModalSheet';
import MpinPad from '../../components/MpinPad';
import OtpField from '../../components/OtpField';
import { toast } from '../../components/toast';
import { usePhoneOtp } from '../../components/usePhoneOtp';
import { resetMpin } from '../../lib/api/auth';
import { isApiError } from '../../lib/api/client';
import { normalizePhone } from '../../lib/firebase';
import { useT } from '../../lib/i18n';

interface ForgotMpinSheetProps {
  open: boolean;
  onClose: () => void;
  onReset: () => void;
}

/** Bottom sheet: phone → Firebase OTP → new MPIN (×2, live match) → resetMpin. */
export default function ForgotMpinSheet({ open, onClose, onReset }: ForgotMpinSheetProps) {
  const t = useT();
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [mpin, setMpin] = useState('');
  const [mpinConfirm, setMpinConfirm] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [idToken, setIdToken] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const otpFlow = usePhoneOtp(phone);

  const phoneValid = /^\d{10}$/.test(phone);
  const mpinsMatch = mpin.length === 4 && mpin === mpinConfirm;

  const handleSend = async () => {
    if (!phoneValid) {
      toast(t('invalidPhone'), { error: true });
      return;
    }
    const ok = await otpFlow.send();
    if (ok) setOtpSent(true);
  };

  const handleVerify = async () => {
    if (otp.length < 4) {
      toast(t('invalidOtp'), { error: true });
      return;
    }
    const token = await otpFlow.verify(otp);
    if (token) setIdToken(token);
  };

  const handleReset = async () => {
    if (!idToken || !mpinsMatch || busy) return;
    setBusy(true);
    try {
      await resetMpin(idToken, mpin);
      toast(t('mpinResetSuccess'));
      setPhone('');
      setOtp('');
      setMpin('');
      setMpinConfirm('');
      setOtpSent(false);
      setIdToken(null);
      onReset();
      onClose();
    } catch (e) {
      toast(isApiError(e) ? e.message : t('resetMpin'), { error: true });
    } finally {
      setBusy(false);
    }
  };

  return (
    <ModalSheet open={open} onClose={onClose} title={t('forgotMpinTitle')}>
      {idToken ? (
        <div>
          <MpinPad label={t('newMpinFourDigits')} value={mpin} onChange={setMpin} />
          <MpinPad label={t('reEnterNewMpin')} value={mpinConfirm} onChange={setMpinConfirm} error={mpinConfirm.length === 4 && !mpinsMatch} />
          {mpinConfirm.length === 4 ? (
            <p className={`mpin-match-text ${mpinsMatch ? 'ok' : 'bad'}`}>
              {mpinsMatch ? t('mpinMatched') : t('mpinNotMatched')}
            </p>
          ) : null}
          <button
            type="button"
            className="av-btn av-btn-primary"
            disabled={!mpinsMatch || busy}
            onClick={() => void handleReset()}
          >
            {busy ? <span className="av-spinner" /> : t('resetMpin')}
          </button>
        </div>
      ) : otpSent ? (
        <OtpField
          value={otp}
          onChange={setOtp}
          onVerify={() => void handleVerify()}
          verifyDisabled={otp.length < 4 || otpFlow.verifying}
          verifying={otpFlow.verifying}
          onResend={() => void otpFlow.send()}
          resendDisabled={otpFlow.sending}
          countdown={otpFlow.countdown}
        />
      ) : (
        <div>
          <LabeledTextField
            label={t('mobileNumber')}
            value={phone}
            onChange={(v) => setPhone(v.replace(/\D/g, '').slice(0, 10))}
            prefix="+91"
            inputMode="tel"
            maxLength={10}
            placeholder="98765 43210"
          />
          <button
            type="button"
            className="av-btn av-btn-primary"
            disabled={!phoneValid || otpFlow.sending}
            onClick={() => void handleSend()}
          >
            {otpFlow.sending ? <span className="av-spinner" /> : t('sendOtp')}
          </button>
        </div>
      )}
    </ModalSheet>
  );
}
