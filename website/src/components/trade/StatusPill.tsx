import { t } from '../../lib/i18n';

/**
 * Status pill — every trade status enum mapped to a colored, localized pill.
 * Kinds: lot, demand, offer, purchase, payment.
 */

const COLORS: Record<string, string> = {
  // lots
  open: '#16A34A',
  sold: '#64748B',
  withdrawn: '#94A3B8',
  // demands
  closed: '#94A3B8',
  fulfilled: '#0284C7',
  // offers
  pending: '#D97706',
  countered: '#7C3AED',
  accepted: '#16A34A',
  rejected: '#DC2626',
  // purchases
  confirmed: '#D97706',
  advancePaid: '#0284C7',
  pickupScheduled: '#7C3AED',
  inTransit: '#0369A1',
  delivered: '#0D9488',
  qcDisputed: '#DC2626',
  completed: '#16A34A',
  cancelled: '#64748B',
  // offers
  expired: '#B45309',
  // transport bookings
  requested: '#D97706',
  enRoute: '#0369A1',
  // transport loads
  booked: '#0284C7',
  // vehicles
  verified: '#16A34A',
  // settlements
  approved: '#0284C7',
  paid: '#16A34A',
};

interface StatusPillProps {
  status: string;
}

export default function StatusPill({ status }: StatusPillProps) {
  const color = COLORS[status] ?? '#64748B';
  return (
    <span
      className="trade-pill"
      style={{ background: `${color}1A`, color, borderColor: `${color}55` }}
    >
      {t(`status_${status}`)}
    </span>
  );
}
