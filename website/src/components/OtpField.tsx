import { t } from '../lib/i18n';

interface OtpFieldProps {
  value: string;
  onChange: (value: string) => void;
  onVerify: () => void;
  verifyDisabled: boolean;
  verifying: boolean;
  onResend: () => void;
  resendDisabled: boolean;
  countdown: number;
}

/**
 * Shared OTP entry: numeric input + verify CTA + 30s resend cooldown button.
 * Used by login (set-mpin), forgot-MPIN sheet and the register wizard.
 */
export default function OtpField({
  value,
  onChange,
  onVerify,
  verifyDisabled,
  verifying,
  onResend,
  resendDisabled,
  countdown,
}: OtpFieldProps) {
  return (
    <div>
      <div className="av-field">
        <label className="av-label">{t('otp')}</label>
        <input
          className="av-input"
          type="text"
          inputMode="numeric"
          maxLength={6}
          value={value}
          placeholder="123456"
          autoComplete="one-time-code"
          onChange={(e) => onChange(e.target.value.replace(/\D/g, '').slice(0, 6))}
        />
      </div>
      <div className="otp-resend-row">
        <span />
        {countdown > 0 ? (
          <span style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--av-slate-1)' }}>
            {t('resendIn')} {countdown}s
          </span>
        ) : (
          <button type="button" className="av-link" disabled={resendDisabled} onClick={onResend}>
            {t('resendOtp')}
          </button>
        )}
      </div>
      <button
        type="button"
        className="av-btn av-btn-primary"
        disabled={verifyDisabled}
        onClick={onVerify}
      >
        {verifying ? <span className="av-spinner" /> : t('verifyOtp')}
      </button>
    </div>
  );
}
