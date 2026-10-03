import { useT } from '../../../lib/i18n';

const COLORS: Record<string, string> = {
  pending: '#D97706',
  paid: '#16A34A',
  active: '#16A34A',
  inactive: '#94A3B8',
  scheduled: '#D97706',
  delivered: '#0D9488',
  billed: '#7C3AED',
  draft: '#64748B',
};

interface StatusChipProps {
  status: string;
}

/** Colored chip for dairy enums: payment pending/paid, member/customer active/inactive, order + batch states. */
export default function StatusChip({ status }: StatusChipProps) {
  const t = useT();
  const color = COLORS[status] ?? '#64748B';
  return (
    <span
      className="dairy-pill"
      style={{ background: `${color}1A`, color, borderColor: `${color}55` }}
    >
      {t(`dairy_status_${status}`)}
    </span>
  );
}
