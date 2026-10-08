import { api } from '../api/client';
import { toast } from '../../components/toast';
import { t } from '../i18n';

/**
 * Offline outbox (WS-06 X20). Forms opt in with a 3-line pattern:
 *   1. import { enqueueOp } from '../../lib/offline/outbox';
 *   2. on submit, catch network failures:
 *        if (!navigator.onLine) {
 *          enqueueOp({ idempotencyKey: crypto.randomUUID(), method: 'POST', path, body });
 *          toast(t('offline.pendingSync', { count: pendingCount() }));
 *          return;
 *        }
 *   3. leave online behavior unchanged.
 *
 * Queued ops replay through POST /v1/sync with a client-generated
 * Idempotency-Key; ops that return `status: "error"` stay queued.
 */

const KEY = 'av_outbox';

export interface OutboxOp {
  idempotencyKey: string;
  method: string;
  path: string;
  body: object;
  queuedAt: string;
}

function read(): OutboxOp[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '[]') as OutboxOp[];
  } catch {
    return [];
  }
}

const listeners = new Set<() => void>();

function write(ops: OutboxOp[]): void {
  localStorage.setItem(KEY, JSON.stringify(ops));
  listeners.forEach((cb) => cb());
}

export function enqueueOp(op: OutboxOp): void {
  write([...read(), op]);
}

export function pendingCount(): number {
  return read().length;
}

export function subscribe(cb: () => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

export async function flush(): Promise<void> {
  const ops = read();
  if (!ops.length) return;
  try {
    const { data } = await api.post<{
      results: Array<{ idempotencyKey: string; status: string }>;
    }>('/sync', { operations: ops });
    const errored = new Set(
      (data.results ?? []).filter((r) => r.status === 'error').map((r) => r.idempotencyKey)
    );
    const remaining = ops.filter((op) => errored.has(op.idempotencyKey));
    write(remaining);
    if (remaining.length) toast(t('offline.syncFailed'), { error: true });
    else toast(t('offline.synced'));
  } catch {
    toast(t('offline.syncFailed'), { error: true });
  }
}

if (typeof window !== 'undefined') {
  window.addEventListener('online', () => void flush());
}
