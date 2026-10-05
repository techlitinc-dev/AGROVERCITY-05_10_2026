import { useEffect, useState } from 'react';
import { useT } from '../../../lib/i18n';

interface SlaClockProps {
  /** Intimation timestamp — the 72-h SLA window starts here. */
  fromIso: string;
  /** Claim window in hours (scheme default 72). */
  windowHours?: number;
}

const DEFAULT_WINDOW_HOURS = 72;
const WARN_MS = 24 * 60 * 60 * 1000;
const HOUR_MS = 3_600_000;

/**
 * Live 72-h SLA countdown driven from the claim's intimation timestamp.
 * Re-renders every minute; turns amber inside the last 24 h and red once the
 * window has breached.
 */
export default function SlaClock({ fromIso, windowHours = DEFAULT_WINDOW_HOURS }: SlaClockProps) {
  const t = useT();
  const [now, setNow] = useState<number>(() => Date.now());

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(id);
  }, []);

  const start = new Date(fromIso).getTime();
  if (Number.isNaN(start)) {
    return <span className="ins-sla ok">—</span>;
  }

  const deadline = start + windowHours * HOUR_MS;
  const remaining = deadline - now;
  const overdue = remaining < 0;
  const absMs = Math.abs(remaining);
  const hours = Math.floor(absMs / HOUR_MS);
  const minutes = Math.floor((absMs % HOUR_MS) / 60_000);
  const state = overdue ? 'breach' : remaining <= WARN_MS ? 'warn' : 'ok';
  const label = overdue
    ? t('insSlaBreach', { hours, minutes })
    : t('insSlaLeft', { hours, minutes });
  const icon = overdue ? '⛔' : remaining <= WARN_MS ? '⏳' : '🕒';

  return (
    <span className={`ins-sla ${state}`}>
      <span aria-hidden>{icon}</span>
      {label}
    </span>
  );
}
