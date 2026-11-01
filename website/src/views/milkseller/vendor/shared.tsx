import React from 'react';
import { formatPaisa } from '../../../lib/utils';

/** Defensive readers for the loosely-typed vendor payloads. */
export function rec(v: unknown): Record<string, unknown> {
  return v !== null && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
}
export function recArr(v: unknown): Record<string, unknown>[] {
  return Array.isArray(v) ? v.map(rec) : [];
}
export function str(v: unknown, fallback = ''): string {
  return typeof v === 'string' ? v : typeof v === 'number' ? String(v) : fallback;
}
export function num(v: unknown, fallback = 0): number {
  const n = typeof v === 'number' ? v : parseFloat(String(v));
  return Number.isFinite(n) ? n : fallback;
}
export function bool(v: unknown, fallback = false): boolean {
  return typeof v === 'boolean' ? v : fallback;
}

export const todayStr = (): string => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

export const fmtMl = (ml: number): string => {
  if (!ml) return '0 ml';
  if (ml % 1000 === 0) return `${ml / 1000} L`;
  return `${(ml / 1000).toFixed(3).replace(/0+$/, '').replace(/\.$/, '')} L`;
};

export const fmtPaisa = (paisa: number): string => formatPaisa(paisa || 0);

export const shiftLabel = (shift: string): string => (shift === 'evening' ? 'Evening' : 'Morning');

export const BILL_STATUSES: Record<string, string> = {
  generated: 'Generated',
  shared: 'Shared',
  revised: 'Revised',
  cancelled: 'Cancelled',
};

/** Trigger a browser download for a Blob. */
export function saveBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 5000);
}

/**
 * PDF sharing per spec: use the device share sheet with the PDF file where
 * supported; click-to-chat WhatsApp never auto-attaches a local PDF — the
 * caller still opens the chat with the prefilled message + secure link.
 */
export async function sharePdfIfSupported(blob: Blob, filename: string, text: string): Promise<boolean> {
  const nav = navigator as Navigator & { canShare?: (data: { files: File[] }) => boolean };
  if (!nav.canShare || typeof nav.canShare !== 'function') return false;
  try {
    const file = new File([blob], filename, { type: 'application/pdf' });
    if (!nav.canShare({ files: [file] })) return false;
    await navigator.share({ files: [file], text });
    return true;
  } catch {
    return false; // user dismissed or share failed — fall back to chat + link
  }
}

export const SectionCard: React.FC<{ title: string; action?: React.ReactNode; children: React.ReactNode }> = ({
  title,
  action,
  children,
}) => (
  <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 sm:p-5">
    <div className="flex items-center justify-between mb-3">
      <h3 className="text-sm font-semibold text-slate-800">{title}</h3>
      {action}
    </div>
    {children}
  </div>
);

export const ErrorBanner: React.FC<{ message: string | null }> = ({ message }) =>
  message ? (
    <div className="mb-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{message}</div>
  ) : null;

export const EmptyState: React.FC<{ message: string }> = ({ message }) => (
  <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
    {message}
  </div>
);

export const inputCls =
  'w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500';
export const btnPrimary =
  'inline-flex items-center justify-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50';
export const btnGhost =
  'inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50';
export const btnDanger =
  'inline-flex items-center justify-center gap-1.5 rounded-lg border border-rose-300 bg-white px-3 py-2 text-sm font-medium text-rose-700 hover:bg-rose-50 disabled:opacity-50';
