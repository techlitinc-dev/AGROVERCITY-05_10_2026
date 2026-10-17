/**
 * Defensive field readers for the loosely-typed (`unknown`) API payloads
 * used across the academy / instructor console.
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
    strOf(r.studentName) ||
    strOf(r.farmerName) ||
    strOf(r.title) ||
    strOf(r.instructorName) ||
    fallback
  );
}

export function idOf(v: unknown): string {
  const r = asRec(v);
  return strOf(r.id) || strOf(r.uid) || strOf(r.certificateId) || strOf(r.studentId);
}
