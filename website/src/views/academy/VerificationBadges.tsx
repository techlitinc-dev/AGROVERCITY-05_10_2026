import React from 'react';
import { BadgeCheck, GraduationCap } from 'lucide-react';

/**
 * Server-derived verification badges. "Identity Verified" means the user
 * completed unified KYC; "Expertise Verified" means the instructor's
 * qualifications/experience were actually reviewed — never inferred from
 * identity KYC, profile text, document upload alone, or course publication.
 */
export const VerificationBadges: React.FC<{
  identity?: unknown;
  expertise?: unknown;
  compact?: boolean;
}> = ({ identity, expertise, compact = false }) => {
  const idOk = identity === true;
  const expOk = expertise === true;
  const base = 'inline-flex items-center gap-1 rounded-full border font-bold';
  const size = compact ? 'px-1.5 py-0.5 text-[9px]' : 'px-2 py-0.5 text-[10px]';
  return (
    <span className="inline-flex items-center gap-1">
      <span
        title="Identity Verified — completed unified KYC"
        className={`${base} ${size} ${
          idOk
            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
            : 'bg-slate-100 text-slate-400 border-slate-200'
        }`}
      >
        <BadgeCheck className="w-3 h-3" />
        {idOk ? 'Identity Verified' : 'Unverified'}
      </span>
      {expOk && (
        <span
          title="Expertise Verified — qualifications/experience reviewed"
          className={`${base} ${size} bg-violet-50 text-violet-700 border-violet-200`}
        >
          <GraduationCap className="w-3 h-3" />
          Expertise Verified
        </span>
      )}
    </span>
  );
};
