/** Defensive helpers for landlord views — API payloads are loosely typed (`unknown`). */

export type Rec = Record<string, unknown>;

export const asRec = (v: unknown): Rec =>
  v !== null && typeof v === 'object' && !Array.isArray(v) ? (v as Rec) : {};

export const asArr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);

export const str = (v: unknown, fb = '—'): string =>
  typeof v === 'string' && v.trim() ? v : fb;

export const num = (v: unknown, fb = 0): number =>
  typeof v === 'number' && !Number.isNaN(v) ? v : fb;

export const firstStr = (r: Rec, keys: string[], fb = '—'): string => {
  for (const k of keys) {
    const v = r[k];
    if (typeof v === 'string' && v.trim()) return v;
  }
  return fb;
};

export const firstNum = (r: Rec, keys: string[], fb = 0): number => {
  for (const k of keys) {
    const v = r[k];
    if (typeof v === 'number' && !Number.isNaN(v)) return v;
  }
  return fb;
};

export const fmtDate = (v: unknown): string => {
  if (typeof v !== 'string' || !v) return '—';
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? v : d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
};

export const boolVal = (v: unknown): boolean => v === true || v === 'true' || v === 1;

export function downloadBlob(filename: string, blob: Blob): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function downloadJson(filename: string, data: unknown): void {
  downloadBlob(filename, new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
}
