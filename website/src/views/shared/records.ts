/**
 * Defensive accessors for the `unknown`-typed API payloads.
 * The typed API layer returns `unknown` for most community/shared endpoints,
 * so views read fields through these helpers and degrade gracefully.
 */

export type Rec = Record<string, unknown>;

export function asRecord(value: unknown): Rec {
  if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
    return value as Rec;
  }
  return {};
}

export function asRecords(value: unknown): Rec[] {
  if (Array.isArray(value)) return value.map(asRecord);
  const single = asRecord(value);
  return Object.keys(single).length > 0 ? [single] : [];
}

export function str(value: unknown, fallback = ''): string {
  if (typeof value === 'string') return value;
  if (typeof value === 'number') return String(value);
  return fallback;
}

export function num(value: unknown, fallback = 0): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
}

export function bool(value: unknown, fallback = false): boolean {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') return value === 'true';
  return fallback;
}

/** First present field among candidates — backend shapes vary per endpoint. */
export function pick(record: Rec, ...keys: string[]): unknown {
  for (const key of keys) {
    if (record[key] !== undefined && record[key] !== null) return record[key];
  }
  return undefined;
}

export function pickStr(record: Rec, ...keys: string[]): string {
  return str(pick(record, ...keys));
}

export function pickNum(record: Rec, ...keys: string[]): number {
  return num(pick(record, ...keys));
}
