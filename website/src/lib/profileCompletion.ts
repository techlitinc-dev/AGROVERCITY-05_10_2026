/** Shared profile-completion math — identical numbers on the dashboard and My Profile. */

export interface ProfileCompletion {
  pct: number;
  filled: number;
  total: number;
  missing: string[];
  color: string;
}

const FIELDS: { key: string; label: string }[] = [
  { key: 'photoUrl', label: 'profile photo' },
  { key: 'name', label: 'full name' },
  { key: 'email', label: 'email' },
  { key: 'dateOfBirth', label: 'date of birth' },
  { key: 'gender', label: 'gender' },
  { key: 'whatsapp', label: 'WhatsApp number' },
  { key: 'addressLine', label: 'address' },
  { key: 'village', label: 'village' },
  { key: 'district', label: 'district' },
  { key: 'state', label: 'state' },
  { key: 'pincode', label: 'PIN code' },
  { key: 'landAreaAcres', label: 'farm size' },
  { key: 'soilType', label: 'soil type' },
  { key: 'irrigationType', label: 'irrigation type' },
];

/** 15-point check (14 fields + verified KYC). Returns null when no profile is loaded. */
export function computeProfileCompletion(me: Record<string, unknown> | null): ProfileCompletion | null {
  if (!me) return null;
  const missing = FIELDS.filter((f) => {
    const v = me[f.key];
    return v === undefined || v === null || String(v).trim() === '';
  }).map((f) => f.label);
  if (String(me['kycStatus'] ?? '').trim() !== 'verified') missing.push('KYC verification');
  const total = FIELDS.length + 1;
  const filled = total - missing.length;
  const pct = Math.round((filled / total) * 100);
  const color = pct >= 80 ? 'bg-emerald-500' : pct >= 50 ? 'bg-amber-400' : 'bg-rose-400';
  return { pct, filled, total, missing, color };
}
