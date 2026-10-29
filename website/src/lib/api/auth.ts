import { post } from './http';
import type { UserProfile } from '../../types';

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface OtpSendResult {
  success?: boolean;
  message?: string;
  otpSessionId?: string;
  devOtp?: string;
  expiresInSec?: number;
  resendAfterSec?: number;
}

export interface OtpVerifyResult extends AuthTokens {
  isNewUser: boolean;
  user: UserProfile;
}

export interface RegisterResult extends AuthTokens {
  user: UserProfile;
}

export interface PhoneCheckResult {
  exists: boolean;
  hasMpin: boolean;
  name?: string | null;
  preferredLanguage?: string | null;
  activeProfile?: string | null;
}

export interface OnboardPayload {
  phone: string;
  name: string;
  mpin: string;
  persona?: string;
  state?: string;
  district?: string;
  village?: string;
  language?: string;
  farmSizeAcres?: number;
}

/** Auth namespace. Token contract: { accessToken, refreshToken, user } — no fabricated `token`. */
export const auth = {
  /** POST /auth/otp/send */
  requestOtp: (phone: string): Promise<OtpSendResult> =>
    post<OtpSendResult>('/auth/otp/send', { phone }),

  /** POST /auth/otp/verify — returns tokens + isNewUser flag. */
  verifyOtp: (phone: string, otp: string, otpSessionId?: string): Promise<OtpVerifyResult> =>
    post<OtpVerifyResult>('/auth/otp/verify', {
      phone,
      otp,
      ...(otpSessionId ? { otpSessionId } : {}),
    }),

  /** POST /auth/check — checks whether phone exists in Firestore and has MPIN configured. */
  checkPhone: (phone: string): Promise<PhoneCheckResult> =>
    post<PhoneCheckResult>('/auth/check', { phone }),

  /** POST /auth/onboard — easy 1-step onboarding with MPIN and persona saved directly to Firestore. */
  onboard: (payload: OnboardPayload): Promise<OtpVerifyResult> =>
    post<OtpVerifyResult>('/auth/onboard', payload),

  /** POST /auth/login — MPIN login. */
  loginWithMpin: (phone: string, mpin: string): Promise<OtpVerifyResult> =>
    post<OtpVerifyResult>('/auth/login', { phone, mpin }),

  /** POST /auth/register */
  register: (
    payload: { phone: string; name: string; persona?: string } & Record<string, unknown>
  ): Promise<RegisterResult> => post<RegisterResult>('/auth/register', payload),

  /** POST /auth/mpin/set */
  setMpin: (mpin: string): Promise<{ success: boolean }> =>
    post<{ success: boolean }>('/auth/mpin/set', { mpin }),

  /** Change MPIN while logged in: verify the current MPIN, then store the new one. */
  changeMpin: async (currentMpin: string, newMpin: string): Promise<{ success: boolean }> => {
    await post<{ ok: boolean }>('/auth/mpin/verify', { mpin: currentMpin });
    return post<{ success: boolean }>('/auth/mpin/set', { mpin: newMpin });
  },

  /** POST /auth/mpin/verify — step-up auth; returns verification result. */
  verifyMpin: (mpin: string): Promise<{ verified: boolean }> =>
    post<{ verified: boolean }>('/auth/mpin/verify', { mpin }),

  /** POST /auth/firebase-verify — Firebase Phone Auth idToken exchange. */
  firebaseVerify: (idToken: string, persona?: string): Promise<OtpVerifyResult> =>
    post<OtpVerifyResult>('/auth/firebase-verify', { idToken, persona }),

  /** POST /auth/refresh */
  refreshToken: (refreshToken: string): Promise<AuthTokens> =>
    post<AuthTokens>('/auth/refresh', { refreshToken }),

  /** POST /auth/logout — revokes the refresh token (jti) server-side. */
  logout: (refreshToken: string): Promise<{ ok: boolean }> =>
    post<{ ok: boolean }>('/auth/logout', { refreshToken }),

  /** POST /auth/mpin/reset */
  resetMpin: (payload: Record<string, unknown>): Promise<{ success: boolean }> =>
    post<{ success: boolean }>('/auth/mpin/reset', payload),

  /** GET /auth/sessions */
  sessions: () => post<unknown[]>('/auth/sessions'),
};
