import { api } from './api/client';
import { useDashboardStore } from '../stores/dashboard';
import { uuid } from './uuid';

/**
 * Analytics beacon (WS-09 X13) — a tiny queued emitter that batches events to
 * POST /v1/analytics/events (flush every 15s + on page hide). Event names come
 * from the one canonical taxonomy; props must stay flat and PII-free.
 */

type Props = Record<string, string | number | boolean>;

interface QueuedEvent {
  eventId: string;
  persona?: string;
  name: string;
  props: Props;
  sessionId: string;
  clientTs: string;
}

const sessionId = uuid();
let queue: QueuedEvent[] = [];

export function track(name: string, props: Props = {}): void {
  queue.push({
    eventId: uuid(),
    persona: useDashboardStore.getState().activeProfile ?? undefined,
    name,
    props,
    sessionId,
    clientTs: new Date().toISOString(),
  });
}

async function flush(): Promise<void> {
  if (!queue.length) return;
  const batch = queue.slice(0, 50);
  queue = queue.slice(batch.length);
  try {
    await api.post('/analytics/events', { events: batch });
  } catch {
    queue = [...batch, ...queue];
  }
}

export function initAnalytics(): void {
  if (typeof window === 'undefined') return;
  window.setInterval(() => void flush(), 15000);
  window.addEventListener('pagehide', () => void flush());
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') void flush();
  });
}
