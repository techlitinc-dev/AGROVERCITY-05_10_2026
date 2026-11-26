/**
 * Shared form-field validators (all personas). Each helper returns an error
 * message string, or '' when the value is valid — render the message inline
 * under the field and block submit while it is non-empty.
 *
 * Optional fields: pass required=false — an empty value is then valid, but a
 * non-empty value must still match the format.
 */

export const MOBILE_RE = /^[6-9]\d{9}$/;
export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
export const PINCODE_RE = /^[1-9]\d{5}$/;
export const IFSC_RE = /^[A-Z]{4}0[A-Z0-9]{6}$/i;
export const BANK_ACCOUNT_RE = /^\d{6,18}$/;

/** Strip spaces/dashes and an optional +91 / 91 country prefix. */
export function normalizeMobile(value: string): string {
  let v = value.replace(/[\s-]/g, '');
  if (v.startsWith('+91')) v = v.slice(3);
  else if (v.startsWith('91') && v.length === 12) v = v.slice(2);
  return v;
}

export function mobileError(value: string, required = true): string {
  const raw = value.trim();
  if (!raw) return required ? 'Mobile number is required.' : '';
  const v = normalizeMobile(raw);
  if (!/^\d+$/.test(v)) return 'Mobile number must contain only digits.';
  if (v.length !== 10) return 'Mobile number must be exactly 10 digits.';
  return MOBILE_RE.test(v) ? '' : 'Enter a valid 10-digit mobile number (starts 6-9).';
}

export function nameError(value: string, required = true, label = 'Name'): string {
  const v = value.trim();
  if (!v) return required ? `${label} is required.` : '';
  if (v.length < 2) return `${label} must be at least 2 characters.`;
  if (v.length > 80) return `${label} must be under 80 characters.`;
  if (!/[A-Za-zऀ-ॿ]/.test(v)) return `${label} must contain letters.`;
  return '';
}

export function emailError(value: string, required = false): string {
  const v = value.trim();
  if (!v) return required ? 'Email is required.' : '';
  return EMAIL_RE.test(v) ? '' : 'Enter a valid email address.';
}

export function pincodeError(value: string, required = false): string {
  const v = value.trim();
  if (!v) return required ? 'Pincode is required.' : '';
  return PINCODE_RE.test(v) ? '' : 'Enter a valid 6-digit pincode.';
}

export function ifscError(value: string, required = false): string {
  const v = value.trim();
  if (!v) return required ? 'IFSC is required.' : '';
  return IFSC_RE.test(v) ? '' : 'Enter a valid IFSC (e.g. SBIN0001234).';
}

export function bankAccountError(value: string, required = false): string {
  const v = value.trim();
  if (!v) return required ? 'Account number is required.' : '';
  return BANK_ACCOUNT_RE.test(v) ? '' : 'Account number must be 6-18 digits.';
}
