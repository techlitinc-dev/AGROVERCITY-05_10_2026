import type { PurchaseEvent } from '../../lib/api/purchases';
import { t } from '../../lib/i18n';

/**
 * Vertical timeline rendered from purchase.events[] — the booking dashboard
 * is a timeline, not a table (plan §2.6).
 */

const EVENT_ICONS: Record<string, string> = {
  created: '📦',
  confirmed: '✅',
  advancePaid: '💰',
  pickupScheduled: '🚚',
  inTransit: '🛣️',
  delivered: '📍',
  qc: '🔍',
  qcDisputed: '⚠️',
  resolved: '🤝',
  completed: '🎉',
  payment: '💵',
  cancelled: '❌',
  // transport waypoints
  requested: '📋',
  accepted: '✅',
  enRoute: '🛣️',
  bid_accepted: '🤝',
  at_pickup: '📍',
  loaded: '📦',
  weighbridge: '⚖️',
  in_transit: '🛣️',
  unloading: '🏗️',
  unloaded: '✅',
};

interface TimelineProps {
  events: PurchaseEvent[];
}

function eventLabel(status: string): string {
  const specific = t(`event_${status}`);
  return specific === `event_${status}` ? t(`status_${status}`) : specific;
}

export default function Timeline({ events }: TimelineProps) {
  if (!events?.length) return null;
  return (
    <ol className="trade-timeline">
      {events.map((event, i) => (
        <li key={`${event.at}-${i}`} className="trade-timeline-item">
          <span className="trade-timeline-dot" aria-hidden>
            {EVENT_ICONS[event.status] ?? '•'}
          </span>
          <span className="trade-timeline-body">
            <span className="trade-timeline-title">{eventLabel(event.status)}</span>
            {event.note ? <span className="trade-timeline-note">{event.note}</span> : null}
            <span className="trade-timeline-time">
              {new Date(event.at).toLocaleString('en-IN', {
                day: 'numeric',
                month: 'short',
                hour: '2-digit',
                minute: '2-digit',
              })}
            </span>
          </span>
        </li>
      ))}
    </ol>
  );
}
