import React from 'react';
import { AlertTriangle, Inbox } from 'lucide-react';

/** Defensive accessors — most persona endpoints return `unknown`. */
export type Rec = Record<string, unknown>;

export const rec = (v: unknown): Rec =>
  v !== null && typeof v === 'object' && !Array.isArray(v) ? (v as Rec) : {};

export const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);

export const num = (v: unknown, d = 0): number => {
  const n = typeof v === 'number' ? v : parseFloat(String(v ?? ''));
  return Number.isFinite(n) ? n : d;
};

export const str = (v: unknown, d: unknown = ''): string =>
  v === null || v === undefined ? String(d ?? '') : typeof v === 'string' ? v : String(v);

/** Money fields on dashboards/settlements are integer paisa. */
export const paisaToRupees = (v: unknown): number => num(v) / 100;

export const ErrorBanner: React.FC<{ message: string | null }> = ({ message }) => {
  if (!message) return null;
  return (
    <div className="flex items-start gap-2 p-3 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold">
      <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
      <span>{message}</span>
    </div>
  );
};

export const EmptyState: React.FC<{ label: string }> = ({ label }) => (
  <div className="flex flex-col items-center justify-center py-10 text-slate-400 gap-2">
    <Inbox className="w-8 h-8" />
    <span className="text-xs font-semibold">{label}</span>
  </div>
);

export const LoadingBlock: React.FC = () => (
  <div className="flex justify-center py-10">
    <div className="w-8 h-8 rounded-full border-4 border-emerald-200 border-t-emerald-600 animate-spin" />
  </div>
);

export const cardCls = 'bg-white rounded-3xl border border-slate-200/80 shadow-xs';
export const inputCls =
  'w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 bg-white';
export const labelCls = 'block text-xs font-bold text-slate-700 mb-1';
export const primaryBtnCls =
  'px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs transition-all disabled:opacity-50 disabled:cursor-not-allowed';
export const ghostBtnCls =
  'px-3.5 py-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold text-xs transition-all disabled:opacity-50 disabled:cursor-not-allowed';
