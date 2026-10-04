import { inr, type DealMessage } from '../../lib/api/broker';
import { useT } from '../../lib/i18n';

interface OfferCardProps {
  message: DealMessage & { expiresAt?: string | null };
  /** Which side of the desk is looking — that side's messages align right. */
  viewer: 'broker' | 'farmer';
  /** Mandi modal price for the delta line; omit when the benchmark failed. */
  benchmark?: number | null;
  /** Offer expiration ISO string for TTL countdown chip */
  expiresAt?: string | null;
}

const fmtTime = (iso: string): string =>
  new Date(iso).toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });

const fmtSentAgo = (iso: string): string => {
  const ms = Date.now() - new Date(iso).getTime();
  if (!Number.isFinite(ms) || ms <= 0) return '0m';
  const m = Math.floor(ms / 60000);
  if (m < 60) return `${Math.max(1, m)}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
};

const offerTimeLeft = (iso: string): string | null => {
  const ms = new Date(iso).getTime() - Date.now();
  if (!Number.isFinite(ms) || ms <= 0) return null;
  const m = Math.floor(ms / 60000);
  if (m < 60) return `${Math.max(1, m)}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ${m % 60}m`;
  return `${Math.floor(h / 24)}d`;
};

/**
 * Structured negotiation card (spec C6): a message carrying amountOffer
 * renders as a ₹/quintal card with a mandi delta; plain text renders as a
 * chat bubble. No free composer exists pre-acceptance — this thread IS the
 * negotiation.
 */
export default function OfferCard({ message, viewer, benchmark, expiresAt }: OfferCardProps) {
  const t = useT();
  const mine = message.senderRole === viewer;
  const delta =
    benchmark && message.amountOffer !== null ? message.amountOffer - benchmark : null;
  const effectiveExpiresAt = expiresAt ?? message.expiresAt ?? null;
  const timeLeft = effectiveExpiresAt ? offerTimeLeft(effectiveExpiresAt) : null;
  const isExpired = effectiveExpiresAt ? new Date(effectiveExpiresAt).getTime() <= Date.now() : false;
  const sentAgo = fmtSentAgo(message.createdAt);

  if (message.amountOffer === null) {
    return (
      <div className={`chat-bubble ${mine ? 'mine' : 'theirs'}`}>
        <span>{message.text}</span>
        <span className="chat-meta">
          {message.senderName} · {fmtTime(message.createdAt)} · {t('offerSentAgo', { time: sentAgo })}
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
        {message.senderName} · {fmtTime(message.createdAt)} · {t('offerSentAgo', { time: sentAgo })}
        {effectiveExpiresAt ? (
          <span
            className="av-chip"
            style={{
              marginLeft: 8,
              fontSize: '0.75rem',
              padding: '2px 8px',
              borderRadius: '12px',
              background: isExpired ? '#fde8e8' : '#e1effe',
              color: isExpired ? '#9b1c1c' : '#1e429f',
              fontWeight: 600,
              display: 'inline-flex',
              alignItems: 'center',
            }}
          >
            ⏳ {timeLeft ? t('offerTtlChip', { time: timeLeft }) : t('offerTtlExpired')}
          </span>
        ) : null}
      </span>
    </div>
  );
}
