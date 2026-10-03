type Translate = (key: string, params?: Record<string, string | number>) => string;

/** Date formatting + age/due-date helpers shared by the herd registry pages. */

export const fmtDate = (value: string): string =>
  value ? new Date(value).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';

/** Local today as YYYY-MM-DD (for date input defaults). */
export const todayStr = (): string => new Date().toLocaleDateString('en-CA');

/** Days from today until the given date (negative = past). */
export const daysUntil = (dateStr: string): number => {
  if (!dateStr) return Number.NaN;
  const start = new Date(`${todayStr()}T00:00:00`).getTime();
  const end = new Date(`${dateStr.slice(0, 10)}T00:00:00`).getTime();
  return Math.round((end - start) / 86_400_000);
};

/** ageMonths → "4 yr 2 mo" / "9 mo". */
export function fmtAge(ageMonths: number, t: Translate): string {
  const months = Math.max(0, Math.round(ageMonths || 0));
  const years = Math.floor(months / 12);
  const rest = months % 12;
  if (years > 0) return t('animalsAgeYm', { years, months: rest });
  return t('animalsAgeM', { months: rest });
}
