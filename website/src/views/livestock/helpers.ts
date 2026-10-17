/**
 * Defensive field readers for the loosely-typed (`unknown`) API payloads
 * returned by the gaushala / vet workspaces.
 */

export function asRec(v: unknown): Record<string, unknown> {
  return v !== null && typeof v === 'object' && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : {};
}

export function arrOf(v: unknown): unknown[] {
  return Array.isArray(v) ? v : [];
}

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

export function nameOf(v: unknown, fallback = '—'): string {
  const r = asRec(v);
  return (
    strOf(r.name) ||
    strOf(r.farmerName) ||
    strOf(r.memberName) ||
    strOf(r.donorName) ||
    strOf(r.adopterName) ||
    strOf(r.title) ||
    strOf(r.animalName) ||
    strOf(r.vaccine) ||
    fallback
  );
}

export function idOf(v: unknown): string {
  const r = asRec(v);
  return (
    strOf(r.id) ||
    strOf(r.uid) ||
    strOf(r.certificateId) ||
    strOf(r.animalId) ||
    strOf(r.memberId) ||
    strOf(r.orderId)
  );
}

export function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

export function monthStr(): string {
  return new Date().toISOString().slice(0, 7);
}

export function statsOf(v: unknown): Record<string, unknown> {
  return asRec(asRec(v).stats);
}
