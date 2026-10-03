import Timeline from '../trade/Timeline';
import type { PurchaseEvent } from '../../lib/api/purchases';
import type { Deal } from '../../lib/api/broker';

/**
 * Milestone tracking only (spec F9/B9) — status events on the shared Timeline,
 * no GPS, no map. The deal doc carries createdAt/updatedAt, so the history
 * shows the real recorded events only: creation + the current status event.
 */
export default function DealTimeline({ deal }: { deal: Deal }) {
  const events: PurchaseEvent[] = [
    { status: 'created', at: deal.createdAt },
    ...(deal.status !== 'negotiating'
      ? [{ status: deal.status, at: deal.updatedAt, note: deal.cancelReason }]
      : []),
  ];
  return <Timeline events={events} />;
}
