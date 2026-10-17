/**
 * Defensive field readers for the loosely-typed (`unknown`) API payloads.
 * Firestore-backed endpoints return plain dicts whose exact keys vary by
 * persona/write-path, so views read through these instead of casting.
 */

export function asRec(v: unknown): Record<string, unknown> {
  return v !== null && typeof v === 'object' && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : {};
}

export function arrOf(v: unknown): unknown[] {
  return Array.isArray(v) ? v : [];
}

/** Coerce an unknown value (object or envelope) into an array of records. */
export function recArr(v: unknown): Record<string, unknown>[] {
  return arrOf(v).map(asRec);
}

export function strOf(v: unknown, fallback = ''): string {
  if (typeof v === 'string') return v;
  if (typeof v === 'number') return String(v);
  return fallback;
}

export function numOf(v: unknown, fallback = 0): number {
  const n = typeof v === 'number' ? v : parseFloat(String(v));
  return Number.isFinite(n) ? n : fallback;
}

export function boolOf(v: unknown, fallback = false): boolean {
  return typeof v === 'boolean' ? v : fallback;
}

/** Pick the first non-empty string among common name/title keys. */
export function nameOf(v: unknown, fallback = '—'): string {
  const r = asRec(v);
  return (
    strOf(r.name) ||
    strOf(r.farmerName) ||
    strOf(r.memberName) ||
    strOf(r.customerName) ||
    strOf(r.donorName) ||
    strOf(r.adopterName) ||
    strOf(r.title) ||
    strOf(r.animalName) ||
    fallback
  );
}

/** Best-effort id extractor (id/uid/certificateId/...). */
export function idOf(v: unknown): string {
  const r = asRec(v);
  return (
    strOf(r.id) ||
    strOf(r.uid) ||
    strOf(r.certificateId) ||
    strOf(r.memberId) ||
    strOf(r.animalId) ||
    strOf(r.batchId) ||
    strOf(r.orderId)
  );
}

export function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

export function monthStr(): string {
  return new Date().toISOString().slice(0, 7);
}

/** Nested stats object often returned by dashboard endpoints. */
export function statsOf(v: unknown): Record<string, unknown> {
  return asRec(asRec(v).stats);
}
