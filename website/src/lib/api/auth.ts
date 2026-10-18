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

  /** POST /auth/mpin/verify — step-up auth; returns verification result. */
  verifyMpin: (mpin: string): Promise<{ verified: boolean }> =>
    post<{ verified: boolean }>('/auth/mpin/verify', { mpin }),

  /** POST /auth/firebase-verify — Firebase Phone Auth idToken exchange. */
  firebaseVerify: (idToken: string, persona?: string): Promise<OtpVerifyResult> =>
    post<OtpVerifyResult>('/auth/firebase-verify', { idToken, persona }),

  /** POST /auth/refresh */
  refreshToken: (refreshToken: string): Promise<AuthTokens> =>
    post<AuthTokens>('/auth/refresh', { refreshToken }),

  /** POST /auth/logout */
  logout: (): Promise<{ success: boolean }> => post<{ success: boolean }>('/auth/logout'),

  /** POST /auth/mpin/reset */
  resetMpin: (payload: Record<string, unknown>): Promise<{ success: boolean }> =>
    post<{ success: boolean }>('/auth/mpin/reset', payload),

  /** GET /auth/sessions */
  sessions: () => post<unknown[]>('/auth/sessions'),
};
