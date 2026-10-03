import { useT } from '../../lib/i18n';

/**
 * Deal status pill — plan §2.3 plain-language sentence captions (not state
 * names), localized per persona. Deal statuses are broker-module specific, so
 * the mapping lives here instead of the shared trade StatusPill.
 */

const COLORS: Record<string, string> = {
  negotiating: '#D97706',
  contract_issued: '#0284C7',
  accepted: '#16A34A',
  in_transit: '#0369A1',
  completed: '#0D9488',
  cancelled: '#64748B',
};

interface DealStatusPillProps {
  status: string;
}

export default function DealStatusPill({ status }: DealStatusPillProps) {
  const t = useT();
  const color = COLORS[status] ?? '#64748B';
  const label = t(`dealStatus_${status}`);
  return (
    <span
      className="trade-pill"
      style={{ background: `${color}1A`, color, borderColor: `${color}55` }}
    >
      {label === `dealStatus_${status}` ? status : label}
    </span>
  );
}
