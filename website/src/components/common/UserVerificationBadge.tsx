import React from 'react';
import { BadgeCheck, ShieldAlert } from 'lucide-react';

interface Props {
  /** Server-derived identity-verification flag. */
  verified: boolean | undefined | null;
  /** Compact inline rendering for dense cards. */
  size?: 'sm' | 'xs';
  /** Optional label override (e.g. "Verified Farmer", "Verified Vyapari"). */
  label?: string;
}

/**
 * Unified identity-verification badge (spec §15 wherever two personas meet).
 * "Verified" means identity verified ONLY — never equipment quality, payment,
 * safety, or work-completion guarantees. The flag must come from a
 * backend-authorized response, never from profile completeness.
 */
export const UserVerificationBadge: React.FC<Props> = ({ verified, size = 'xs', label }) => {
  if (!verified) {
    return (
      <span
        className={`inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 font-bold text-slate-400 ${
          size === 'sm' ? 'px-2 py-0.5 text-[10px]' : 'px-1.5 py-0.5 text-[9px]'
        }`}
        title="Identity not yet verified"
      >
        <ShieldAlert className={size === 'sm' ? 'w-3 h-3' : 'w-2.5 h-2.5'} />
        {label ?? 'Unverified'}
      </span>
    );
  }
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border border-sky-200 bg-sky-50 font-bold text-sky-700 ${
        size === 'sm' ? 'px-2 py-0.5 text-[10px]' : 'px-1.5 py-0.5 text-[9px]'
      }`}
      title="Identity verified — verification means identity only"
    >
      <BadgeCheck className={size === 'sm' ? 'w-3 h-3' : 'w-2.5 h-2.5'} />
      {label ?? 'Verified'}
    </span>
  );
};
