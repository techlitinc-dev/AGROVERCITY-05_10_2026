import React, { useEffect, useState } from 'react';
import {
  Settings,
  LogOut,
  AlertCircle,
  CheckCircle2,
  Download,
  Ban,
  Lock,
  FileSpreadsheet,
  FileText,
} from 'lucide-react';
import { apiErrorMessage, auth, users } from '../../lib/api';
import { buildCsv, buildXls, downloadTextFile, openPrintableReport } from '../../lib/dataExport';
import { useAuthStore } from '../../stores/authStore';
import { cn, formatDateTime } from '../../lib/utils';
import { asRecord, asRecords, pickStr } from './records';

export const SettingsPage: React.FC = () => {
  const { logout } = useAuthStore();
  const [exportStatus, setExportStatus] = useState<Record<string, unknown> | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);

  useEffect(() => {
    users
      .latestDataExport()
      .then((e) => setExportStatus(asRecord(e)))
      .catch(() => undefined);
  }, []);

  const flash = (kind: 'ok' | 'err', text: string) => {
    setNotice({ kind, text });
    window.setTimeout(() => setNotice(null), 5000);
  };

  const requestExport = async () => {
    if (busy) return;
    setBusy('export');
    try {
      // The backend assembles the archive immediately and returns a signed URL.
      const res = asRecord(await users.requestDataExport());
      setExportStatus({
        status: pickStr(res, 'status') || 'ready',
        url: pickStr(res, 'url'),
        createdAt: pickStr(res, 'createdAt'),
      });
      flash('ok', 'Your data export is ready — download it below (link valid 24 hours).');
    } catch (err) {
      flash('err', apiErrorMessage(err));
    } finally {
      setBusy(null);
    }
  };

  // Download helpers — generated client-side from the real archive (no deps).
  const exportUrl = pickStr(exportStatus ?? {}, 'url');

  const loadArchive = async (): Promise<Record<string, unknown> | null> => {
    if (!exportUrl) return null;
    try {
      const res = await fetch(exportUrl);
      if (!res.ok) return null;
      return (await res.json()) as Record<string, unknown>;
    } catch {
      return null;
    }
  };

  const downloadCsv = async () => {
    const archive = await loadArchive();
    if (!archive) {
      flash('err', 'Could not read the export file — use Download JSON instead.');
      return;
    }
    downloadTextFile(buildCsv(archive), 'agrovercity-data-export.csv', 'text/csv;charset=utf-8');
  };

  const downloadExcel = async () => {
    const archive = await loadArchive();
    if (!archive) {
      flash('err', 'Could not read the export file — use Download JSON instead.');
      return;
    }
    downloadTextFile(
      buildXls(archive),
      'agrovercity-data-export.xls',
      'application/vnd.ms-excel;charset=utf-8'
    );
  };

  const downloadPdf = async () => {
    const archive = await loadArchive();
    if (!archive) {
      flash('err', 'Could not read the export file — use Download JSON instead.');
      return;
    }
    if (!openPrintableReport(archive)) {
      flash('err', 'Popup blocked — allow popups to print/save the PDF.');
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="border-b border-slate-200 pb-4">
        <h1 className="text-2xl font-extrabold text-slate-900 flex items-center gap-2">
          <Settings className="w-7 h-7 text-emerald-600" />
          Settings & Privacy
        </h1>
      </div>

      {notice && (
        <div
          className={cn(
            'rounded-2xl border p-3 text-xs flex items-start gap-2',
            notice.kind === 'ok'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-rose-50 border-rose-200 text-rose-800'
          )}
        >
          {notice.kind === 'ok' ? (
            <CheckCircle2 className="w-4 h-4 flex-shrink-0 mt-0.5" />
          ) : (
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          )}
          <span>{notice.text}</span>
        </div>
      )}

      {/* Data export */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs p-5 space-y-3">
        <h3 className="font-bold text-sm text-slate-900 flex items-center gap-1.5">
          <Download className="w-4 h-4 text-emerald-600" /> My Data Export
        </h3>
        <p className="text-xs text-slate-500">
          Download a complete copy of your data (plots, orders, chats, KYC references) in the format you need.
        </p>
        {exportStatus && Object.keys(exportStatus).length > 0 && (
          <p className="text-[11px] text-slate-400">
            Latest export: {pickStr(exportStatus, 'status') || 'ready'} ·{' '}
            {formatDateTime(pickStr(exportStatus, 'requestedAt', 'createdAt')) || '—'}
          </p>
        )}
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => void requestExport()}
            disabled={busy === 'export'}
            className="px-4 py-2.5 bg-slate-800 hover:bg-slate-900 disabled:opacity-40 text-white font-bold text-xs rounded-xl shadow-xs"
          >
            {busy === 'export' ? 'Preparing…' : exportUrl ? 'Refresh Export' : 'Request Data Export'}
          </button>
          {exportUrl && (
            <>
              <a
                href={exportUrl}
                target="_blank"
                rel="noreferrer"
                className="px-3 py-2.5 rounded-xl border border-slate-200 text-slate-700 hover:border-emerald-300 text-xs font-bold flex items-center gap-1.5"
              >
                <Download className="w-3.5 h-3.5 text-emerald-600" /> JSON
              </a>
              <button
                onClick={() => void downloadCsv()}
                className="px-3 py-2.5 rounded-xl border border-slate-200 text-slate-700 hover:border-emerald-300 text-xs font-bold flex items-center gap-1.5"
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" /> CSV
              </button>
              <button
                onClick={() => void downloadExcel()}
                className="px-3 py-2.5 rounded-xl border border-slate-200 text-slate-700 hover:border-emerald-300 text-xs font-bold flex items-center gap-1.5"
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-sky-600" /> Excel
              </button>
              <button
                onClick={() => void downloadPdf()}
                className="px-3 py-2.5 rounded-xl border border-slate-200 text-slate-700 hover:border-emerald-300 text-xs font-bold flex items-center gap-1.5"
              >
                <FileText className="w-3.5 h-3.5 text-rose-500" /> PDF
              </button>
            </>
          )}
        </div>
        {exportUrl && (
          <p className="text-[10px] text-slate-400">
            CSV/Excel are generated from the export file in your browser — no data leaves this device. PDF opens a
            print view; choose “Save as PDF” in the print dialog.
          </p>
        )}
      </div>

      {/* Blocked users */}
      <BlockedUsersSection />

      {/* Change MPIN */}
      <MpinChangeSection />

      {/* Logout */}
      <button
        onClick={() => {
          logout();
          window.location.href = '/login';
        }}
        className="w-full px-4 py-3 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-2xl shadow-xs flex items-center justify-center gap-2"
      >
        <LogOut className="w-4 h-4" /> Sign out on this device
      </button>
    </div>
  );
};

/* ---------------------------------------------------- Blocked users */

const BlockedUsersSection: React.FC = () => {
  const [blocked, setBlocked] = useState<Record<string, unknown>[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);

  useEffect(() => {
    users
      .blocks()
      .then((rows) => setBlocked(asRecords(rows)))
      .catch(() => setBlocked([]));
  }, []);

  const unblock = async (userId: string) => {
    if (busy) return;
    setBusy(userId);
    setNotice(null);
    try {
      await users.unblockUser(userId);
      setBlocked((prev) => (prev ?? []).filter((b) => pickStr(b, 'userId') !== userId));
      setNotice({ kind: 'ok', text: 'User unblocked — they can contact you again.' });
    } catch (err) {
      setNotice({ kind: 'err', text: apiErrorMessage(err) });
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs p-5 space-y-3">
      <h3 className="font-bold text-sm text-slate-900 flex items-center gap-1.5">
        <Ban className="w-4 h-4 text-rose-500" /> Blocked Users
      </h3>

      {notice && (
        <div
          className={cn(
            'rounded-2xl border p-2.5 text-xs flex items-start gap-2',
            notice.kind === 'ok'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-rose-50 border-rose-200 text-rose-800'
          )}
        >
          {notice.kind === 'ok' ? (
            <CheckCircle2 className="w-4 h-4 flex-shrink-0 mt-0.5" />
          ) : (
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          )}
          <span>{notice.text}</span>
        </div>
      )}

      {blocked === null ? (
        <p className="text-xs text-slate-400">Loading blocked users…</p>
      ) : blocked.length === 0 ? (
        <p className="text-xs text-slate-400">No blocked users</p>
      ) : (
        <div className="space-y-2">
          {blocked.map((b, i) => {
            const userId = pickStr(b, 'userId', 'id') || String(i);
            return (
              <div
                key={userId}
                className="flex items-center justify-between gap-3 p-3 rounded-2xl border border-slate-100 bg-slate-50/60 text-xs"
              >
                <div>
                  <p className="font-bold text-slate-800">{pickStr(b, 'name') || 'Member'}</p>
                  <p className="text-[11px] text-slate-400">
                    blocked {formatDateTime(pickStr(b, 'at')) || '—'}
                  </p>
                </div>
                <button
                  onClick={() => void unblock(userId)}
                  disabled={busy === userId}
                  className="px-3 py-1.5 bg-white border border-slate-200 text-slate-700 font-bold rounded-xl hover:border-emerald-300 disabled:opacity-40"
                >
                  {busy === userId ? 'Unblocking…' : 'Unblock'}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

/* ---------------------------------------------------- Change MPIN */

const MpinChangeSection: React.FC = () => {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);

  const submit = async () => {
    if (busy) return;
    setNotice(null);
    if (!/^\d{4}$/.test(current)) {
      setNotice({ kind: 'err', text: 'Enter your current 4-digit MPIN.' });
      return;
    }
    if (!/^\d{4}$/.test(next)) {
      setNotice({ kind: 'err', text: 'New MPIN must be exactly 4 digits.' });
      return;
    }
    if (next !== confirm) {
      setNotice({ kind: 'err', text: 'New MPIN and confirmation do not match.' });
      return;
    }
    if (next === current) {
      setNotice({ kind: 'err', text: 'New MPIN must be different from the current MPIN.' });
      return;
    }
    setBusy(true);
    try {
      await auth.changeMpin(current, next);
      setNotice({ kind: 'ok', text: 'MPIN changed successfully — use it from your next sign-in.' });
      setCurrent('');
      setNext('');
      setConfirm('');
    } catch (err) {
      setNotice({ kind: 'err', text: apiErrorMessage(err) });
    } finally {
      setBusy(false);
    }
  };

  const mpinInput = (value: string, onChange: (v: string) => void, placeholder: string) => (
    <input
      type="password"
      inputMode="numeric"
      maxLength={4}
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value.replace(/\D/g, '').slice(0, 4))}
      className="w-full px-3 py-2.5 text-xs rounded-xl border border-slate-300 focus:outline-none focus:border-emerald-600 tracking-widest"
    />
  );

  return (
    <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs p-5 space-y-3">
      <h3 className="font-bold text-sm text-slate-900 flex items-center gap-1.5">
        <Lock className="w-4 h-4 text-emerald-600" /> Change MPIN
      </h3>
      <p className="text-xs text-slate-500">
        Your 4-digit MPIN protects sign-in and payments. Changing it keeps you signed in on this
        device.
      </p>

      {notice && (
        <div
          className={cn(
            'rounded-2xl border p-2.5 text-xs flex items-start gap-2',
            notice.kind === 'ok'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-rose-50 border-rose-200 text-rose-800'
          )}
        >
          {notice.kind === 'ok' ? (
            <CheckCircle2 className="w-4 h-4 flex-shrink-0 mt-0.5" />
          ) : (
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          )}
          <span>{notice.text}</span>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1">Current MPIN</label>
          {mpinInput(current, setCurrent, '••••')}
        </div>
        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1">New MPIN</label>
          {mpinInput(next, setNext, '••••')}
        </div>
        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1">Confirm new MPIN</label>
          {mpinInput(confirm, setConfirm, '••••')}
        </div>
      </div>
      <button
        onClick={() => void submit()}
        disabled={busy || current.length !== 4 || next.length !== 4 || confirm.length !== 4}
        className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white font-bold text-xs rounded-xl shadow-xs flex items-center gap-1.5"
      >
        <Lock className="w-3.5 h-3.5" /> {busy ? 'Changing…' : 'Change MPIN'}
      </button>
    </div>
  );
};
