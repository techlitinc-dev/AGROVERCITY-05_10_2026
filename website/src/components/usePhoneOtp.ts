import { useCallback, useEffect, useRef, useState } from 'react';
import type { ConfirmationResult } from 'firebase/auth';
import { confirmPhoneOtp, normalizePhone, sendPhoneOtp } from '../lib/firebase';
import { t } from '../lib/i18n';
import { toast } from './toast';

export const OTP_RESEND_SECONDS = 30;

/** Map Firebase auth error codes to a friendly, actionable message. */
function firebaseMessage(e: unknown, fallbackKey: string): string {
  const code = (e as { code?: string } | null)?.code ?? '';
  switch (code) {
    case 'auth/invalid-phone-number':
      return t('invalidPhone');
    case 'auth/invalid-verification-code':
      return t('invalidOtp');
    case 'auth/code-expired':
    case 'auth/session-expired':
      return t('errOtpExpired');
    case 'auth/too-many-requests':
      return t('errTooManyRequests');
    case 'auth/quota-exceeded':
      return t('errSmsQuota');
    case 'auth/network-request-failed':
      return t('errNetwork');
    case 'auth/captcha-check-failed':
    case 'auth/invalid-app-credential':
    case 'auth/missing-client-identifier':
      return t('errRecaptcha');
    default:
      return e instanceof Error ? `${e.message}${code ? ` (${code})` : ''}` : t(fallbackKey);
  }
}

/**
 * Shared Firebase phone-OTP flow (login set-mpin / forgot-mpin / register).
 * send() starts the 30s resend cooldown; verify() resolves the Firebase
 * confirmation into an ID token. Firebase failures surface as toasts.
 */
export function usePhoneOtp(phoneDigits: string) {
  const [confirmation, setConfirmation] = useState<ConfirmationResult | null>(null);
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current !== null) window.clearInterval(timerRef.current);
    };
  }, []);

  const startCountdown = useCallback(() => {
    setCountdown(OTP_RESEND_SECONDS);
    if (timerRef.current !== null) window.clearInterval(timerRef.current);
    timerRef.current = window.setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1 && timerRef.current !== null) {
          window.clearInterval(timerRef.current);
          timerRef.current = null;
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, []);

  /** Returns true when the OTP was sent successfully. */
  const send = useCallback(async (): Promise<boolean> => {
    if (sending) return false;
    setSending(true);
    try {
      const result = await sendPhoneOtp(normalizePhone(phoneDigits), 'recaptcha-container');
      setConfirmation(result);
      startCountdown();
      return true;
    } catch (e) {
      toast(firebaseMessage(e, 'errOtpSendFailed'), { error: true });
      return false;
    } finally {
      setSending(false);
    }
  }, [phoneDigits, sending, startCountdown]);

  /** Returns the Firebase ID token, or null when verification failed. */
  const verify = useCallback(async (code: string): Promise<string | null> => {
    if (!confirmation || verifying) return null;
    setVerifying(true);
    try {
      return await confirmPhoneOtp(confirmation, code);
    } catch (e) {
      toast(firebaseMessage(e, 'errOtpVerifyFailed'), { error: true });
      return null;
    } finally {
      setVerifying(false);
    }
  }, [confirmation, verifying]);

  return { confirmation, sending, verifying, countdown, send, verify };
}
