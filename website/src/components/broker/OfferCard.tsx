import { inr, type DealMessage } from '../../lib/api/broker';
import { useT } from '../../lib/i18n';

interface OfferCardProps {
  message: DealMessage;
  /** Which side of the desk is looking — that side's messages align right. */
  viewer: 'broker' | 'farmer';
  /** Mandi modal price for the delta line; omit when the benchmark failed. */
  benchmark?: number | null;
}

const fmtTime = (iso: string): string =>
  new Date(iso).toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });

/**
 * Structured negotiation card (spec C6): a message carrying amountOffer
 * renders as a ₹/quintal card with a mandi delta; plain text renders as a
 * chat bubble. No free composer exists pre-acceptance — this thread IS the
 * negotiation.
 */
export default function OfferCard({ message, viewer, benchmark }: OfferCardProps) {
  const t = useT();
  const mine = message.senderRole === viewer;
  const delta =
    benchmark && message.amountOffer !== null ? message.amountOffer - benchmark : null;

  if (message.amountOffer === null) {
    return (
      <div className={`chat-bubble ${mine ? 'mine' : 'theirs'}`}>
        <span>{message.text}</span>
        <span className="chat-meta">
          {message.senderName} · {fmtTime(message.createdAt)}
        </span>
      </div>
    );
  }

  return (
    <div className={`broker-offer-card ${mine ? 'mine' : 'theirs'}`}>
      <div className="broker-offer-head">
        <span className="broker-offer-amount">
          {inr(message.amountOffer)}
          {t('perQuintal')}
        </span>
        {delta !== null ? (
          <span className={delta <= 0 ? 'trade-delta-down' : 'trade-delta-up'}>
            {delta <= 0
              ? t('benchmarkBelow', { amount: inr(Math.abs(delta)) })
              : t('benchmarkAbove', { amount: inr(delta) })}
          </span>
        ) : null}
      </div>
      {message.text ? <p className="broker-offer-text">{message.text}</p> : null}
      <span className="chat-meta">
        {message.senderName} · {fmtTime(message.createdAt)}
      </span>
    </div>
  );
}
