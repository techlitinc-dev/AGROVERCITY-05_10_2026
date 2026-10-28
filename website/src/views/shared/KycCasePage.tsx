import React, { useEffect, useRef, useState } from 'react';
import { FileCheck2, Upload, AlertCircle, CheckCircle2, ShieldCheck } from 'lucide-react';
import { apiClient, apiErrorMessage, kyc } from '../../lib/api';
import type { PersonaType } from '../../types';
import { useAuthStore } from '../../stores/authStore';
import { StatusBadge } from '../../components/common/StatusBadge';
import { cn, formatDateTime } from '../../lib/utils';
import { asRecord, asRecords, pick, pickStr } from './records';

const PERSONA_LABELS: { id: PersonaType; label: string }[] = [
  { id: 'farmer', label: 'Farmer / Kisan' },
  { id: 'seller', label: 'Agri Vyapari / Seller' },
  { id: 'transporter', label: 'Transporter' },
  { id: 'equipmentOwner', label: 'Equipment Owner' },
  { id: 'directBuyer', label: 'Industrial Buyer' },
  { id: 'broker', label: 'Agri Broker' },
  { id: 'dairyManager', label: 'Dairy Manager' },
  { id: 'instructor', label: 'Instructor' },
  { id: 'customer', label: 'E-Market Customer' },
];

/**
 * POST /kyc/cases/{caseId}/docs/{docId}/upload is multipart (`file`) on the
 * backend, while the typed `kyc.uploadDoc` wrapper posts JSON — this view
 * calls apiClient with FormData directly (gap logged in the report).
 */
async function uploadKycDoc(caseId: string, docId: string, file: File): Promise<unknown> {
  const form = new FormData();
  form.append('file', file);
  const res = await apiClient.post(`/kyc/cases/${caseId}/docs/${encodeURIComponent(docId)}/upload`, form);
  return res.data?.data ?? res.data;
}

interface CaseRow {
  caseId: string;
  persona: string;
  status: string;
  docs: Record<string, unknown>[];
  updatedAt?: string;
}

export const KycCasePage: React.FC = () => {
  const { user } = useAuthStore();
  const [cases, setCases] = useState<CaseRow[]>([]);
  const [persona, setPersona] = useState<PersonaType>('farmer');
  const [requiredDocs, setRequiredDocs] = useState<string[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const pendingUpload = useRef<{ caseId: string; docId: string } | null>(null);

  useEffect(() => {
    void loadCases();
    if (user?.activePersona) setPersona(user.activePersona);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.activePersona]);

  const loadCases = async () => {
    try {
      const res = await kyc.status();
      const rows = asRecords(res).map((c): CaseRow => {
        const docs = asRecords(pick(c, 'docs'));
        return {
          caseId: pickStr(c, 'caseId', 'id'),
          persona: pickStr(c, 'persona') || 'farmer',
          status: pickStr(c, 'status') || 'pending',
          docs,
          updatedAt: pickStr(c, 'updatedAt'),
        };
      });
      setCases(rows);
    } catch {
      setCases([]);
    }
  };

  const flash = (kind: 'ok' | 'err', text: string) => {
    setNotice({ kind, text });
    window.setTimeout(() => setNotice(null), 5000);
  };

  const createCase = async () => {
    if (busy) return;
    setBusy('create');
    try {
      const res = await kyc.createCase({ persona, docs: [] });
      const rec = asRecord(res);
      const docs = pick(rec, 'requiredDocs');
      if (Array.isArray(docs)) {
        setRequiredDocs(docs.map((d) => String(d)));
      }
      flash('ok', `KYC case opened for ${persona}. Upload each required document below.`);
      await loadCases();
    } catch (err) {
      flash('err', apiErrorMessage(err));
    } finally {
      setBusy(null);
    }
  };

  const pickFile = (caseId: string, docId: string) => {
    pendingUpload.current = { caseId, docId };
    fileRef.current?.click();
  };

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    const target = pendingUpload.current;
    e.target.value = '';
    if (!file || !target || busy) return;
    setBusy(target.docId);
    try {
      await uploadKycDoc(target.caseId, target.docId, file);
      flash('ok', `${file.name} uploaded — verification usually completes within 48 hours.`);
      await loadCases();
    } catch (err) {
      flash('err', apiErrorMessage(err));
    } finally {
      setBusy(null);
      pendingUpload.current = null;
    }
  };

  const docStatus = (c: CaseRow, docType: string): string => {
    const doc = c.docs.find((d) => pickStr(d, 'type') === docType);
    return doc ? pickStr(doc, 'status') || 'pending' : 'missing';
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="border-b border-slate-200 pb-4">
        <h1 className="text-2xl font-extrabold text-slate-900 flex items-center gap-2">
          <FileCheck2 className="w-7 h-7 text-emerald-600" />
          KYC Verification Cases
        </h1>
        <p className="text-xs text-slate-500 mt-1">
          One case per persona. Verified KYC unlocks payments, credit, and insurance claim settlements.
        </p>
      </div>

      <input ref={fileRef} type="file" accept="image/jpeg,image/png,application/pdf" className="hidden" onChange={(e) => void handleFile(e)} />

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

      {/* Create case */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs p-5 space-y-4">
        <h3 className="font-bold text-sm text-slate-900">Open a KYC Case</h3>
        <div className="flex flex-col sm:flex-row gap-3">
          <select
            value={persona}
            onChange={(e) => setPersona(e.target.value as PersonaType)}
            className="flex-1 px-3 py-2.5 text-xs rounded-xl border border-slate-300 focus:outline-none focus:border-emerald-600 bg-white"
          >
            {PERSONA_LABELS.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </select>
          <button
            onClick={() => void createCase()}
            disabled={busy === 'create'}
            className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white font-bold text-xs rounded-xl shadow-xs"
          >
            {busy === 'create' ? 'Opening…' : 'Open / Refresh Case'}
          </button>
        </div>
        {requiredDocs.length > 0 && (
          <p className="text-[11px] text-slate-400">
            Required for this persona: {requiredDocs.map((d) => d.replace(/_/g, ' ')).join(' · ')}
          </p>
        )}
      </div>

      {/* Existing cases */}
      {cases.length === 0 ? (
        <p className="text-xs text-slate-400 bg-white rounded-3xl border border-slate-200/80 p-6 text-center">
          No KYC cases yet — open one above to start verification.
        </p>
      ) : (
        <div className="space-y-4">
          {cases.map((c) => (
            <div key={c.caseId} className="bg-white rounded-3xl border border-slate-200/80 shadow-xs p-5 space-y-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h3 className="font-extrabold text-sm text-slate-900 capitalize">{c.persona} KYC</h3>
                  <p className="text-[11px] text-slate-400 font-mono">{c.caseId}</p>
                </div>
                <StatusBadge status={c.status} />
              </div>

              <div className="space-y-2">
                {(requiredDocs.length > 0
                  ? requiredDocs
                  : c.docs.map((d) => pickStr(d, 'type'))
                ).map((docType) => {
                  const status = docStatus(c, docType);
                  const doc = c.docs.find((d) => pickStr(d, 'type') === docType);
                  const docId = doc ? pickStr(doc, 'docId') : `${c.caseId}:${docType}`;
                  return (
                    <div
                      key={docType}
                      className="flex items-center justify-between gap-3 p-3 rounded-2xl border border-slate-100 bg-slate-50/60 text-xs"
                    >
                      <div>
                        <p className="font-bold text-slate-800 capitalize">{docType.replace(/_/g, ' ')}</p>
                        <p className="text-[11px] text-slate-400">
                          {status === 'missing' ? 'Not uploaded' : status}
                          {pickStr(doc ?? {}, 'reason') ? ` — ${pickStr(doc ?? {}, 'reason')}` : ''}
                        </p>
                      </div>
                      <button
                        onClick={() => pickFile(c.caseId, docId)}
                        disabled={busy !== null}
                        className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white font-bold rounded-xl flex items-center gap-1.5"
                      >
                        <Upload className="w-3.5 h-3.5" />
                        {busy === docId ? 'Uploading…' : status === 'missing' ? 'Upload' : 'Re-upload'}
                      </button>
                    </div>
                  );
                })}
              </div>

              {c.updatedAt && (
                <p className="text-[10px] text-slate-400">Last updated {formatDateTime(c.updatedAt)}</p>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="p-4 bg-emerald-50/60 border border-emerald-100 rounded-2xl flex items-center gap-2 text-[11px] text-emerald-800">
        <ShieldCheck className="w-4 h-4 flex-shrink-0" />
        <span>
          Only masked Aadhaar (last 4 digits) is stored. Files are encrypted at rest and shared only with the verification desk.
        </span>
      </div>
    </div>
  );
};
