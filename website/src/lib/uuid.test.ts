import { describe, expect, it } from 'vitest';
import { uuid } from './uuid';

describe('uuid', () => {
  it('returns a UUIDv4-shaped string', () => {
    expect(uuid()).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });

  it('does not collide across 500 draws', () => {
    const ids = new Set(Array.from({ length: 500 }, uuid));
    expect(ids.size).toBe(500);
  });

  it('falls back to Math.random when crypto.randomUUID is unavailable', async () => {
    const original = crypto.randomUUID;
    // @ts-expect-error simulating plain-HTTP contexts without secure crypto
    delete crypto.randomUUID;
    try {
      expect(uuid()).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    } finally {
      crypto.randomUUID = original;
    }
  });
});
