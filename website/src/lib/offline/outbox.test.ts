import { beforeEach, describe, expect, it, vi } from 'vitest';

const post = vi.fn();
vi.mock('../api/client', () => ({ api: { post: (...args: unknown[]) => post(...args) } }));

const toast = vi.fn();
vi.mock('../../components/toast', () => ({ toast: (...args: unknown[]) => toast(...args) }));

vi.mock('../i18n', () => ({ t: (key: string) => key }));

import { enqueueOp, flush, pendingCount, subscribe, type OutboxOp } from './outbox';

const KEY = 'av_outbox';
const store = new Map<string, string>();

function op(overrides: Partial<OutboxOp> = {}): OutboxOp {
  return {
    idempotencyKey: crypto.randomUUID(),
    method: 'POST',
    path: '/v1/diary/entries',
    body: { amountRupees: 100 },
    queuedAt: new Date().toISOString(),
    ...overrides,
  };
}

beforeEach(() => {
  store.clear();
  post.mockReset();
  toast.mockReset();
  globalThis.localStorage = {
    get length() { return store.size; },
    clear: () => store.clear(),
    getItem: (k: string) => (store.has(k) ? (store.get(k) as string) : null),
    key: (i: number) => [...store.keys()][i] ?? null,
    removeItem: (k: string) => void store.delete(k),
    setItem: (k: string, v: string) => void store.set(k, String(v)),
  } as Storage;
});

describe('outbox', () => {
  it('enqueues ops and reports pending count', () => {
    expect(pendingCount()).toBe(0);
    enqueueOp(op());
    enqueueOp(op());
    expect(pendingCount()).toBe(2);
    expect(JSON.parse(store.get(KEY) as string)).toHaveLength(2);
  });

  it('notifies subscribers on write and stops after unsubscribe', () => {
    const cb = vi.fn();
    const unsub = subscribe(cb);
    enqueueOp(op());
    expect(cb).toHaveBeenCalledTimes(1);
    unsub();
    enqueueOp(op());
    expect(cb).toHaveBeenCalledTimes(1);
  });

  it('flush clears the outbox when the server accepts everything', async () => {
    const a = op();
    enqueueOp(a);
    post.mockResolvedValue({ data: { results: [{ idempotencyKey: a.idempotencyKey, status: 'ok' }] } });
    await flush();
    expect(post).toHaveBeenCalledWith('/sync', { operations: [a] });
    expect(pendingCount()).toBe(0);
    expect(toast).toHaveBeenCalledWith('offline.synced');
  });

  it('keeps only server-errored ops queued and toasts an error', async () => {
    const good = op();
    const bad = op();
    enqueueOp(good);
    enqueueOp(bad);
    post.mockResolvedValue({
      data: { results: [
        { idempotencyKey: good.idempotencyKey, status: 'ok' },
        { idempotencyKey: bad.idempotencyKey, status: 'error' },
      ] },
    });
    await flush();
    const remaining = JSON.parse(store.get(KEY) as string) as OutboxOp[];
    expect(remaining.map((o) => o.idempotencyKey)).toEqual([bad.idempotencyKey]);
    expect(toast).toHaveBeenCalledWith('offline.syncFailed', { error: true });
  });

  it('keeps everything queued when the sync request itself fails', async () => {
    const a = op();
    enqueueOp(a);
    post.mockRejectedValue(new Error('network down'));
    await flush();
    expect(pendingCount()).toBe(1);
    expect(toast).toHaveBeenCalledWith('offline.syncFailed', { error: true });
  });

  it('is a no-op when empty', async () => {
    await flush();
    expect(post).not.toHaveBeenCalled();
    expect(toast).not.toHaveBeenCalled();
  });
});
