/**
 * Money display helpers for the CreditDesk console.
 * Backend amounts that are already integer paisa render via rupeesFromPaisa;
 * legacy rupee amounts render via rupeesFromAmount. No `?? <number>` fallbacks.
 */

export function count(value: number | null | undefined): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

export function rupeesFromPaisa(paisa: number | null | undefined): string {
  return `₹${Math.round(count(paisa) / 100).toLocaleString('en-IN')}`;
}

export function rupeesFromAmount(amount: number | null | undefined): string {
  return `₹${Math.round(count(amount)).toLocaleString('en-IN')}`;
}

export function percent(value: number | null | undefined): string {
  return `${Math.round(count(value))}%`;
}
