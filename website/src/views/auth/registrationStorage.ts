/**
 * Registration safe-field persistence.
 *
 * Only NON-sensitive fields survive provider redirects and browser refreshes.
 * OTP codes, MPINs, Aadhaar data and provider credentials are never written
 * here (or anywhere in browser storage).
 */
export interface SafeRegistrationFields {
  phone: string;
  name: string;
  persona: string;
  state: string;
  district: string;
  village: string;
  language: string;
  /** Resume hint when the provider redirect lands back on the wizard. */
  step?: 'profile' | 'kyc';
}

const KEY = 'agrovercity_registration_safe';

export function saveSafeRegistrationFields(fields: SafeRegistrationFields): void {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(fields));
  } catch {
    // sessionStorage unavailable (private mode) — the wizard still works in-memory.
  }
}

export function loadSafeRegistrationFields(): SafeRegistrationFields | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw || raw === 'undefined' || raw === 'null') return null;
    return JSON.parse(raw) as SafeRegistrationFields;
  } catch {
    return null;
  }
}

export function clearSafeRegistrationFields(): void {
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    // ignore
  }
}
