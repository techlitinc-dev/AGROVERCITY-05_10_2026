import { post, readOne } from './http';

/** KYC namespace — cases, document upload, status. */

export type KycSessionStatus =
  | 'created'
  | 'pending'
  | 'processing'
  | 'verified'
  | 'failed'
  | 'expired'
  | 'reviewRequired'
  | 'denied';

export interface KycSessionInfo {
  id: string;
  context: 'registration' | 'profile' | 'feature_gate';
  provider: 'mock' | 'sandbox';
  /** Verification method: digilocker (redirect) or aadhaar_okyc (Aadhaar number + OTP). */
  method?: 'digilocker' | 'aadhaar_okyc';
  status: KycSessionStatus;
  authorizationUrl: string;
  returnTo: string;
  expiresAt: string;
  createdAt?: string;
  updatedAt?: string;
  error?: string | null;
  verifiedName?: string | null;
  maskedAadhaar?: string | null;
  /** Masked Aadhaar (XXXXXXXX + last 4) bound to an aadhaar_okyc session. */
  aadhaarLast4?: string | null;
  consentAccepted: boolean;
}

export interface KycMeResult {
  registrationStatus: 'pendingProfile' | 'pendingKyc' | 'completed';
  kycStatus: string;
  kycVerifiedAt?: string | null;
  verifiedName?: string | null;
  maskedAadhaar?: string | null;
  verificationMode?: string | null;
  provider: string;
  session?: KycSessionInfo | null;
  /** True when the mock provider is active — UI must label results "Test Verified". */
  testMode: boolean;
}

export const kyc = {
  /** POST /kyc/cases — open a KYC case for a persona. */
  createCase: (payload: Record<string, unknown>): Promise<unknown> =>
    post<unknown>('/kyc/cases', payload),

  /** GET /kyc/status */
  status: (): Promise<unknown> => readOne<unknown>('/kyc/status'),

  /** POST /kyc/cases/{caseId}/docs/{docId}/upload */
  uploadDoc: (caseId: string, docId: string, payload: Record<string, unknown>): Promise<unknown> =>
    post<unknown>(`/kyc/cases/${caseId}/docs/${docId}/upload`, payload),

  /** GET /kyc/me — registration/KYC state (onboarding or full token). */
  me: (): Promise<KycMeResult> => readOne<KycMeResult>('/kyc/me'),

  /** POST /kyc/sessions — idempotent; the backend forces the registration callback as returnTo for context=registration. */
  createSession: (payload: {
    returnTo?: string;
    context: 'registration' | 'profile' | 'feature_gate';
    consentAccepted: boolean;
    method?: 'digilocker' | 'aadhaar_okyc';
  }): Promise<{ session: KycSessionInfo }> =>
    post<{ session: KycSessionInfo }>('/kyc/sessions', payload),

  /** POST /kyc/sessions/{id}/aadhaar-otp — bind an Aadhaar number + issue OTP (mock provider: returns devOtp). */
  aadhaarOtp: (
    sessionId: string,
    aadhaarNumber: string
  ): Promise<{ session: KycSessionInfo; referenceId: string; devOtp?: string }> =>
    post<{ session: KycSessionInfo; referenceId: string; devOtp?: string }>(
      `/kyc/sessions/${sessionId}/aadhaar-otp`,
      { aadhaarNumber, consentAccepted: true }
    ),

  /** POST /kyc/sessions/{id}/aadhaar-verify — validate the OTP; verified sessions complete via the registration callback. */
  aadhaarVerify: (sessionId: string, otp: string): Promise<{ session: KycSessionInfo }> =>
    post<{ session: KycSessionInfo }>(`/kyc/sessions/${sessionId}/aadhaar-verify`, { otp }),

  /** GET /kyc/sessions/{id} — the ONLY polling source for the callback page. */
  getSession: (id: string): Promise<{ session: KycSessionInfo }> =>
    readOne<{ session: KycSessionInfo }>(`/kyc/sessions/${id}`),

  /** POST /kyc/sessions/{id}/refresh — rotate the authorization URL after failure/expiry. */
  refreshSession: (id: string): Promise<{ session: KycSessionInfo }> =>
    post<{ session: KycSessionInfo }>(`/kyc/sessions/${id}/refresh`),

  /** POST /kyc/sessions/{id}/provider-callback — mock DigiLocker screen decision (approve|deny). */
  providerDecision: (id: string, decision: 'approve' | 'deny'): Promise<{ session: KycSessionInfo }> =>
    post<{ session: KycSessionInfo }>(`/kyc/sessions/${id}/provider-callback`, { decision }),
};
