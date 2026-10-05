import { useT } from '../../../lib/i18n';

const CLAIM_COLORS: Record<string, string> = {
  intimated: '#D97706',
  surveyorAssigned: '#0284C7',
  fieldAssessed: '#7C3AED',
  dbtApproved: '#0D9488',
  disbursed: '#16A34A',
  rejected: '#DC2626',
};

const POLICY_COLORS: Record<string, string> = {
  pending_approval: '#D97706',
  active: '#16A34A',
  rejected: '#DC2626',
};

interface InsStatusChipProps {
  status: string;
  kind?: 'claim' | 'policy';
}

/**
 * Colored chip for claim stages (intimated → disbursed / rejected) and policy
 * states (pending_approval / active / rejected). Labels come from the
 * `ins_status_*` i18n keys.
 */
export default function InsStatusChip({ status, kind = 'claim' }: InsStatusChipProps) {
  const t = useT();
  const palette = kind === 'policy' ? POLICY_COLORS : CLAIM_COLORS;
  const color = palette[status] ?? '#64748B';
  const fallbackKey = kind === 'policy' ? `policy_status_${status}` : `claim_status_${status}`;
  const translated = t(`ins_status_${status}`);
  const label = translated === `ins_status_${status}` ? t(fallbackKey) : translated;
  return (
    <span className="ins-pill" style={{ background: `${color}1A`, color, borderColor: `${color}55` }}>
      {label}
    </span>
  );
}
