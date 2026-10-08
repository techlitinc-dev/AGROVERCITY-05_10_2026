import { useT } from '../lib/i18n';

const TIER_KEYS: Record<string, string> = {
  new: 'trust.tier.new',
  trusted: 'trust.tier.trusted',
  established: 'trust.tier.established',
  top: 'trust.tier.top',
};

const TIER_COLORS: Record<string, string> = {
  new: '#64748B',
  trusted: '#0EA5E9',
  established: '#16A34A',
  top: '#EAB308',
};

/** Small trust-tier badge (WS-03 G9) shown next to a counterparty's name. */
export default function TrustBadge({ tier }: { tier?: string | null }) {
  const t = useT();
  if (!tier || !TIER_KEYS[tier]) return null;
  const color = TIER_COLORS[tier];
  return (
    <span
      className="trade-pill"
      style={{ background: `${color}1A`, color, borderColor: `${color}55` }}
    >
      {t(TIER_KEYS[tier])}
    </span>
  );
}
