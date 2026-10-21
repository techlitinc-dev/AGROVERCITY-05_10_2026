import React, { useCallback, useEffect, useState } from 'react';
import {
  RefreshCw,
  XCircle,
  CheckCircle2,
  Loader2,
  AlertTriangle,
  X,
  type LucideIcon,
} from 'lucide-react';
import { admin, apiErrorMessage, ApiError } from '../../../lib/api';
import { cn } from '../../../lib/utils';

/**
 * Shared building blocks for the SOP-01…27 admin panels.
 *
 * Every record returned by the `admin` namespace is typed `unknown`, so panels
 * render through the small accessor helpers below (`str`, `num`, `idOf`, `KV`)
 * which tolerate any backend field naming.
 */

export type Row = Record<string, unknown>;

// ---------------------------------------------------------------------------
// Record accessors
// ---------------------------------------------------------------------------

export const asRows = (d: unknown): Row[] => {
  if (Array.isArray(d)) return d as Row[];
  if (d && typeof d === 'object' && Array.isArray((d as Row).data)) return (d as Row).data as Row[];
  return [];
};

export const asRow = (d: unknown): Row | null =>
  d && typeof d === 'object' && !Array.isArray(d) ? (d as Row) : null;

const ID_KEYS = [
  'id', 'docId', 'uid', 'userId', 'claimId', 'orderId', 'bookingId', 'lotId',
  'contractId', 'disputeId', 'rateId', 'vehicleId', 'equipmentId', 'fpoId',
  'shgId', 'settlementId', 'courseId', 'sessionId', 'ticketId', 'approvalId',
  'reportId', 'itemId', 'keyId', 'requestId', 'testId', 'applicationId',
  'accountId', 'leaseId', 'listingId', 'poolId', 'storageId', 'facilityId',
  'newsId', 'workshopId', 'channelId', 'expertId', 'ngoId', 'nurseryId',
  'vetId', 'treeId', 'varietyId', 'lineId', 'ratingId', 'productId', 'dealId',
  'buyerId', 'mandiId', 'scheduleId', 'tenantId', 'code', 'district',
];

/** First non-empty value among candidate keys. */
export function str(r: Row | null | undefined, ...keys: string[]): string {
  if (!r) return '—';
  for (const k of keys) {
    const v = r[k];
    if (v !== undefined && v !== null && v !== '') {
      if (typeof v === 'object') return JSON.stringify(v);
      return String(v);
    }
  }
  return '—';
}

export const firstVal = (r: Row | null | undefined, keys: string[]): unknown => {
  if (!r) return undefined;
  for (const k of keys) {
    const v = r[k];
    if (v !== undefined && v !== null && v !== '') return v;
  }
  return undefined;
};

export const idOf = (r: Row): string => str(r, ...ID_KEYS);

export const num = (r: Row | null | undefined, ...keys: string[]): number | null => {
  const v = firstVal(r, keys);
  const n = typeof v === 'number' ? v : parseFloat(String(v ?? ''));
  return Number.isFinite(n) ? n : null;
};

export const fmtVal = (v: unknown): string => {
  if (v === undefined || v === null || v === '') return '—';
  if (typeof v === 'boolean') return v ? 'Yes' : 'No';
  if (typeof v === 'number') return v.toLocaleString('en-IN');
  if (Array.isArray(v)) return v.length ? v.map(fmtVal).join(', ') : '—';
  if (typeof v === 'object') return JSON.stringify(v);
  return String(v);
};

export const isUrlString = (v: unknown): v is string =>
  typeof v === 'string' && (/^https?:\/\//.test(v) || v.startsWith('/'));

/** Render any record value as a link when it looks like a URL. */
export const maybeLink = (v: unknown): React.ReactNode =>
  isUrlString(v) ? (
    <a href={v} target="_blank" rel="noreferrer" className="text-emerald-700 underline break-all">
      {v.length > 64 ? `${v.slice(0, 64)}…` : v}
    </a>
  ) : (
    <>{fmtVal(v)}</>
  );

// ---------------------------------------------------------------------------
// Data fetching
// ---------------------------------------------------------------------------

export function useAsync<T>(fn: () => Promise<T>, deps: unknown[] = []) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  const reload = useCallback(() => setTick((t) => t + 1), []);
  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(null);
    Promise.resolve()
      .then(fn)
      .then((d) => {
        if (alive) setData(d);
      })
      .catch((e) => {
        if (alive) setError(apiErrorMessage(e));
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, tick]);
  return { data, setData, loading, error, reload };
}

/** Pull a human-readable metric out of an arbitrary summary payload. */
export const metric = (d: unknown, ...keys: string[]): string => {
  const r = asRow(d);
  if (!r) return '—';
  const v = firstVal(r, keys);
  if (v === undefined) return '—';
  if (typeof v === 'number') return v.toLocaleString('en-IN');
  return String(v);
};

// ---------------------------------------------------------------------------
// Feedback banners
// ---------------------------------------------------------------------------

export const Banner: React.FC<{
  kind: 'error' | 'success' | 'info';
  children: React.ReactNode;
  className?: string;
}> = ({ kind, children, className }) => {
  const styles = {
    error: 'bg-rose-50 border-rose-200 text-rose-800',
    success: 'bg-emerald-50 border-emerald-200 text-emerald-800',
    info: 'bg-sky-50 border-sky-200 text-sky-800',
  }[kind];
  const Icon = kind === 'error' ? XCircle : kind === 'success' ? CheckCircle2 : AlertTriangle;
  return (
    <div className={cn('flex items-start gap-2 px-4 py-3 rounded-2xl border text-xs font-semibold', styles, className)}>
      <Icon className="w-4 h-4 shrink-0 mt-0.5" />
      <span className="break-words">{children}</span>
    </div>
  );
};

// ---------------------------------------------------------------------------
// PanelShell — the white card wrapper every SOP body renders inside
// ---------------------------------------------------------------------------

export const PanelShell: React.FC<{
  title: string;
  subtitle?: string;
  icon?: LucideIcon;
  actions?: React.ReactNode;
  loading?: boolean;
  error?: string | null;
  onRefresh?: () => void;
  children: React.ReactNode;
}> = ({ title, subtitle, icon: Icon, actions, loading, error, onRefresh, children }) => (
  <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden">
    <div className="p-4 border-b border-slate-100 flex flex-wrap items-center gap-3">
      {Icon && (
        <div className="p-2 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-100">
          <Icon className="w-5 h-5" />
        </div>
      )}
      <div className="min-w-0 flex-1">
        <h3 className="font-bold text-sm text-slate-900">{title}</h3>
        {subtitle && <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>}
      </div>
      {actions}
      {onRefresh && (
        <button
          onClick={onRefresh}
          title="Refresh"
          className="p-2 rounded-xl border border-slate-200 text-slate-500 hover:text-emerald-700 hover:border-emerald-300 transition-colors"
        >
          <RefreshCw className={cn('w-4 h-4', loading && 'animate-spin')} />
        </button>
      )}
    </div>
    <div className="p-4 space-y-4">
      {error && <Banner kind="error">{error}</Banner>}
      {loading ? (
        <div className="space-y-2.5 py-2">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-9 rounded-xl bg-slate-100 animate-pulse" style={{ opacity: 1 - i * 0.2 }} />
          ))}
        </div>
      ) : (
        children
      )}
    </div>
  </div>
);

// ---------------------------------------------------------------------------
// DataTable
// ---------------------------------------------------------------------------

export interface Column {
  header: string;
  className?: string;
  cell: (row: Row) => React.ReactNode;
}

export const DataTable: React.FC<{
  columns: Column[];
  rows: Row[];
  empty?: string;
  footer?: React.ReactNode;
}> = ({ columns, rows, empty = 'No records in this queue.', footer }) => {
  if (!rows.length) {
    return (
      <div className="text-center py-10 text-xs font-semibold text-slate-400 border border-dashed border-slate-200 rounded-2xl">
        {empty}
      </div>
    );
  }
  return (
    <div className="overflow-x-auto rounded-2xl border border-slate-100">
      <table className="w-full text-left text-xs border-collapse">
        <thead>
          <tr className="bg-slate-50 text-slate-500 font-bold uppercase text-[10px] tracking-wider border-b border-slate-100">
            {columns.map((c) => (
              <th key={c.header} className={cn('py-2.5 px-4', c.className)}>
                {c.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rows.map((row, i) => (
            <tr key={idOf(row) !== '—' ? idOf(row) : i} className="hover:bg-slate-50/60 align-top">
              {columns.map((c) => (
                <td key={c.header} className={cn('py-3 px-4', c.className)}>
                  {c.cell(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {footer}
    </div>
  );
};

// ---------------------------------------------------------------------------
// KV — human-readable rendering of any record (detail drawers / viewers)
// ---------------------------------------------------------------------------

export const KV: React.FC<{
  record: Row | null | undefined;
  omit?: string[];
  compact?: boolean;
}> = ({ record, omit = [], compact }) => {
  if (!record) return <p className="text-xs text-slate-400">No detail available.</p>;
  const entries = Object.entries(record).filter(([k, v]) => !omit.includes(k) && v !== undefined && v !== null && v !== '');
  if (!entries.length) return <p className="text-xs text-slate-400">No fields to show.</p>;
  return (
    <dl className={cn('grid gap-x-6 gap-y-2', compact ? 'grid-cols-1' : 'grid-cols-1 sm:grid-cols-2')}>
      {entries.map(([k, v]) => (
        <div key={k} className="min-w-0">
          <dt className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{k}</dt>
          <dd className="text-xs font-semibold text-slate-800 break-words">
            {typeof v === 'object' && v !== null ? (
              <pre className="mt-1 p-2 bg-slate-50 border border-slate-100 rounded-xl text-[10px] overflow-x-auto whitespace-pre-wrap">
                {JSON.stringify(v, null, 2)}
              </pre>
            ) : (
              maybeLink(v)
            )}
          </dd>
        </div>
      ))}
    </dl>
  );
};

// ---------------------------------------------------------------------------
// Tabs (in-panel sub-navigation)
// ---------------------------------------------------------------------------

export const Tabs: React.FC<{
  tabs: { id: string; label: string }[];
  active: string;
  onChange: (id: string) => void;
}> = ({ tabs, active, onChange }) => (
  <div className="flex flex-wrap gap-1.5">
    {tabs.map((t) => (
      <button
        key={t.id}
        onClick={() => onChange(t.id)}
        className={cn(
          'px-3.5 py-1.5 rounded-full text-xs font-bold transition-all border',
          active === t.id
            ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
            : 'bg-white text-slate-600 border-slate-200 hover:border-emerald-300 hover:text-emerald-700'
        )}
      >
        {t.label}
      </button>
    ))}
  </div>
);

// ---------------------------------------------------------------------------
// Form controls
// ---------------------------------------------------------------------------

const inputCls =
  'w-full px-3.5 py-2.5 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 bg-white';

export const TextInput: React.FC<{
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  list?: string;
  inputMode?: 'text' | 'numeric' | 'decimal' | 'tel' | 'email' | 'url';
  maxLength?: number;
  required?: boolean;
  disabled?: boolean;
  autoComplete?: string;
  className?: string;
}> = ({ value, onChange, placeholder, type = 'text', list, inputMode, maxLength, required, disabled, autoComplete, className }) => (
  <input
    type={type}
    value={value}
    list={list}
    inputMode={inputMode}
    maxLength={maxLength}
    required={required}
    disabled={disabled}
    autoComplete={autoComplete}
    placeholder={placeholder}
    onChange={(e) => onChange(e.target.value)}
    className={cn(inputCls, disabled && 'opacity-60 cursor-not-allowed', className)}
  />
);

export const TextArea: React.FC<{
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  rows?: number;
  className?: string;
}> = ({ value, onChange, placeholder, rows = 3, className }) => (
  <textarea
    value={value}
    rows={rows}
    placeholder={placeholder}
    onChange={(e) => onChange(e.target.value)}
    className={cn(inputCls, className)}
  />
);

export const Select: React.FC<{
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  className?: string;
}> = ({ value, onChange, options, className }) => (
  <select value={value} onChange={(e) => onChange(e.target.value)} className={cn(inputCls, className)}>
    {options.map((o) => (
      <option key={o.value} value={o.value}>
        {o.label}
      </option>
    ))}
  </select>
);

export const Field: React.FC<{ label: string; children: React.ReactNode; className?: string }> = ({
  label,
  children,
  className,
}) => (
  <label className={cn('block', className)}>
    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{label}</span>
    <div className="mt-1">{children}</div>
  </label>
);

// ---------------------------------------------------------------------------
// Buttons
// ---------------------------------------------------------------------------

type Tone = 'primary' | 'danger' | 'ghost' | 'warn';

const toneCls: Record<Tone, string> = {
  primary: 'bg-emerald-600 hover:bg-emerald-700 text-white border-emerald-600',
  danger: 'bg-rose-600 hover:bg-rose-700 text-white border-rose-600',
  warn: 'bg-amber-500 hover:bg-amber-600 text-white border-amber-500',
  ghost: 'bg-white text-slate-600 border-slate-200 hover:border-emerald-300 hover:text-emerald-700',
};

export const Btn: React.FC<{
  tone?: Tone;
  onClick?: () => void;
  type?: 'button' | 'submit';
  disabled?: boolean;
  busy?: boolean;
  className?: string;
  children: React.ReactNode;
}> = ({ tone = 'ghost', onClick, type = 'button', disabled, busy, className, children }) => (
  <button
    type={type}
    onClick={onClick}
    disabled={disabled || busy}
    className={cn(
      'inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl border text-xs font-bold shadow-xs transition-colors disabled:opacity-50 disabled:cursor-not-allowed',
      toneCls[tone],
      className
    )}
  >
    {busy && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
    {children}
  </button>
);

// ---------------------------------------------------------------------------
// ReasonModal — every admin mutation requires an audit reason (min 3 chars);
// destructive actions can additionally require MPIN step-up (POST /admin/verify-mpin).
// ---------------------------------------------------------------------------

export interface ReasonRequest {
  title: string;
  description?: string;
  confirmLabel?: string;
  tone?: Tone;
  /** Prefill the reason input (admin can edit). */
  defaultReason?: string;
  /** Require 4-digit MPIN step-up before running the action. */
  requireMpin?: boolean;
  action: (reason: string, mpin?: string) => Promise<unknown>;
  onDone?: () => void;
}

const ReasonModalInner: React.FC<{ req: ReasonRequest; onClose: () => void }> = ({ req, onClose }) => {
  const [reason, setReason] = useState(req.defaultReason ?? '');
  const [mpin, setMpin] = useState('');
  const [step, setStep] = useState<'reason' | 'mpin'>('reason');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reasonOk = reason.trim().length >= 3;

  const runAction = async (withMpin?: string) => {
    setBusy(true);
    setError(null);
    try {
      if (req.requireMpin) {
        await admin.users.verifyMpin(withMpin ?? mpin);
      }
      await req.action(reason.trim(), withMpin ?? mpin ?? undefined);
      setDone(true);
      req.onDone?.();
      window.setTimeout(onClose, 900);
    } catch (e) {
      setError(
        e instanceof ApiError && e.code === 'INVALID_MPIN'
          ? 'MPIN verification failed. Re-enter your 4-digit admin MPIN.'
          : apiErrorMessage(e)
      );
      if (req.requireMpin) setStep('mpin');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs" role="dialog" aria-modal>
      <div className="w-full max-w-md bg-white rounded-3xl border border-slate-200 shadow-lg p-5 space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h4 className="font-extrabold text-sm text-slate-900">{req.title}</h4>
            {req.description && <p className="text-xs text-slate-500 mt-1">{req.description}</p>}
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100">
            <X className="w-4 h-4" />
          </button>
        </div>

        {done ? (
          <Banner kind="success">Action recorded. Audit trail updated.</Banner>
        ) : (
          <>
            {error && <Banner kind="error">{error}</Banner>}
            {step === 'reason' ? (
              <div className="space-y-3">
                <Field label="Audit reason (required, min 3 chars) — sent as X-Audit-Reason">
                  <TextArea
                    value={reason}
                    onChange={setReason}
                    rows={2}
                    placeholder="e.g. Verified against 7/12 extract + Aadhaar"
                  />
                </Field>
                <div className="flex justify-end gap-2 pt-1">
                  <Btn onClick={onClose}>Cancel</Btn>
                  <Btn
                    tone={req.tone ?? 'primary'}
                    disabled={!reasonOk}
                    busy={busy}
                    onClick={() => (req.requireMpin ? setStep('mpin') : runAction())}
                  >
                    {req.confirmLabel ?? 'Confirm'}
                  </Btn>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <Banner kind="info">
                  Destructive action — step-up verification required. Enter your 4-digit admin MPIN.
                </Banner>
                <Field label="Admin MPIN">
                  <TextInput type="password" inputMode="numeric" maxLength={4} value={mpin} onChange={(v) => setMpin(v.replace(/\D/g, '').slice(0, 4))} placeholder="••••" className="tracking-[0.5em] text-center text-base" />
                </Field>
                <div className="flex justify-between gap-2 pt-1">
                  <Btn onClick={() => setStep('reason')}>Back</Btn>
                  <Btn tone={req.tone ?? 'primary'} disabled={mpin.length !== 4} busy={busy} onClick={() => runAction()}>
                    {req.confirmLabel ?? 'Authorize'}
                  </Btn>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export function useReasonModal() {
  const [req, setReq] = useState<ReasonRequest | null>(null);
  const request = useCallback((r: ReasonRequest) => setReq(r), []);
  const close = useCallback(() => setReq(null), []);
  const modal = req ? <ReasonModalInner req={req} onClose={close} /> : null;
  return { request, modal };
}

// ---------------------------------------------------------------------------
// Misc
// ---------------------------------------------------------------------------

export const money = (n: number | null | undefined): string =>
  n === null || n === undefined ? '—' : `₹${n.toLocaleString('en-IN')}`;

export const asNumber = (v: unknown): number | null => {
  const n = typeof v === 'number' ? v : parseFloat(String(v ?? ''));
  return Number.isFinite(n) ? n : null;
};

export const pct = (v: unknown): string => {
  const n = asNumber(v);
  return n === null ? '—' : `${n}%`;
};

// ---------------------------------------------------------------------------
// JsonConfigCard — generic get/PUT editor for single-object platform configs
// ---------------------------------------------------------------------------

export const JsonConfigCard: React.FC<{
  title: string;
  subtitle: string;
  icon?: LucideIcon;
  load: () => Promise<unknown>;
  save: (payload: Record<string, unknown>, reason: string) => Promise<unknown>;
  onSaved?: () => void;
}> = ({ title, subtitle, icon, load, save, onSaved }) => {
  const cfg = useAsync(load, []);
  const [draft, setDraft] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: 'error' | 'success'; text: string } | null>(null);

  const persist = async () => {
    if (!draft) return;
    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(draft);
    } catch {
      setMsg({ kind: 'error', text: 'Invalid JSON — fix the draft before saving.' });
      return;
    }
    setBusy(true);
    setMsg(null);
    try {
      await save(parsed, `${title} update from admin console`);
      setMsg({ kind: 'success', text: 'Saved.' });
      setDraft(null);
      onSaved?.();
      cfg.reload();
    } catch (e) {
      setMsg({ kind: 'error', text: apiErrorMessage(e) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <PanelShell
      title={title}
      subtitle={subtitle}
      icon={icon}
      loading={cfg.loading}
      error={cfg.error}
      onRefresh={() => {
        cfg.reload();
        setDraft(null);
      }}
      actions={
        draft !== null ? (
          <div className="flex gap-2">
            <Btn onClick={() => setDraft(null)}>Cancel</Btn>
            <Btn tone="primary" busy={busy} onClick={persist}>Save (audited)</Btn>
          </div>
        ) : (
          <Btn onClick={() => setDraft(JSON.stringify(cfg.data ?? {}, null, 2))}>Edit as JSON</Btn>
        )
      }
    >
      {msg && <Banner kind={msg.kind}>{msg.text}</Banner>}
      {draft !== null ? (
        <TextArea value={draft} onChange={setDraft} rows={16} className="font-mono text-[11px]" />
      ) : (
        <KV record={asRow(cfg.data)} />
      )}
    </PanelShell>
  );
};
