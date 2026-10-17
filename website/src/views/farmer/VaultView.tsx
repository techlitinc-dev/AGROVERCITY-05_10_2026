import React, { useEffect, useRef, useState } from 'react';
import {
  Lock,
  UploadCloud,
  Trash2,
  FileText,
  ShieldCheck,
} from 'lucide-react';
import { vault, uploads, apiErrorMessage } from '../../lib/api';
import { ModalSheet } from '../../components/common/ModalSheet';
import { StatusBadge } from '../../components/common/StatusBadge';
import { formatDate } from '../../lib/utils';

const asRecord = (v: unknown): Record<string, unknown> =>
  v !== null && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
const asStr = (v: unknown, fallback = ''): string => (typeof v === 'string' ? v : fallback);

export const VaultView: React.FC = () => {
  const [documents, setDocuments] = useState<unknown[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [docType, setDocType] = useState('Land Record');
  const [docName, setDocName] = useState('');
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement | null>(null);

  const reload = async () => {
    const list = await vault.documents();
    setDocuments(list);
  };

  useEffect(() => {
    let active = true;
    setLoading(true);
    reload()
      .catch((e) => active && setError(apiErrorMessage(e)))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, []);

  const openFilePicker = () => fileRef.current?.click();

  const handleUpload = async () => {
    if (!pendingFile) {
      setError('Choose a file first.');
      return;
    }
    setUploading(true);
    setError(null);
    try {
      const uploaded = (await uploads.upload(pendingFile, { folder: 'vault', purpose: 'vault-document' })) as {
        url?: string;
        fileUrl?: string;
      };
      const url = uploaded?.url ?? uploaded?.fileUrl ?? '';
      await vault.upload({
        name: docName || pendingFile.name,
        type: docType,
        url,
        mimeType: pendingFile.type,
        sizeBytes: pendingFile.size,
      });
      await reload();
      setUploadModalOpen(false);
      setPendingFile(null);
      setDocName('');
      setNotice('Document uploaded to your encrypted vault.');
    } catch (e) {
      setError(apiErrorMessage(e));
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const handleDelete = async (docId: string) => {
    setBusyId(docId);
    setError(null);
    try {
      await vault.remove(docId);
      setDocuments((prev) => prev.filter((d) => asStr(asRecord(d).id) !== docId));
      setNotice('Document deleted from vault.');
    } catch (e) {
      setError(apiErrorMessage(e));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 flex items-center gap-2">
            <Lock className="w-7 h-7 text-emerald-600" />
            Document Vault (Digital Tijori)
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            AES-256 encrypted, digitally-signed documents for 1-click DBT, loan and insurance applications
          </p>
        </div>

        <button
          onClick={() => setUploadModalOpen(true)}
          className="px-4 py-2.5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md flex items-center gap-2 self-start sm:self-auto transition-all"
        >
          <UploadCloud className="w-4 h-4" />
          <span>Upload Document</span>
        </button>
      </div>

      <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-2xl text-xs text-emerald-900 flex items-start gap-2">
        <ShieldCheck className="w-4 h-4 text-emerald-700 flex-shrink-0 mt-0.5" />
        <span>
          Documents here are shared with banks, insurers and government desks only after your explicit consent on each application.
        </span>
      </div>

      {error && (
        <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-2xl text-xs font-semibold text-rose-800">
          {error}
        </div>
      )}
      {notice && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-2xl text-xs font-semibold text-emerald-800 flex items-center justify-between">
          <span>{notice}</span>
          <button onClick={() => setNotice(null)} className="font-bold hover:underline">Dismiss</button>
        </div>
      )}

      {loading ? (
        <div className="py-10 text-center text-xs font-bold text-slate-400 animate-pulse">
          Loading vault…
        </div>
      ) : documents.length === 0 ? (
        <div className="py-10 text-center text-xs font-semibold text-slate-400 bg-white rounded-3xl border border-slate-200/80">
          Vault is empty. Upload your 7/12, Aadhaar, bank passbook and soil health card for instant approvals.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {documents.map((doc, i) => {
            const r = asRecord(doc);
            const id = asStr(r.id, String(i));
            const url = asStr(r.url ?? r.fileUrl ?? r.downloadUrl);
            return (
              <div key={id} className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-xs flex items-center justify-between gap-4">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="p-3 rounded-2xl bg-slate-100 text-slate-700 flex-shrink-0">
                    <FileText className="w-6 h-6" />
                  </div>
                  <div className="min-w-0">
                    <h5 className="font-bold text-xs text-slate-900 truncate">
                      {asStr(r.name ?? r.title ?? r.fileName, 'Document')}
                    </h5>
                    <p className="text-[11px] text-slate-400">
                      {asStr(r.type ?? r.category, 'General')}
                      {asStr(r.createdAt ?? r.uploadedAt) ? ` • ${formatDate(asStr(r.createdAt ?? r.uploadedAt))}` : ''}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-shrink-0">
                  <StatusBadge status={asStr(r.status, 'active')} />
                  {url && (
                    <a
                      href={url}
                      target="_blank"
                      rel="noreferrer"
                      className="p-1.5 text-slate-400 hover:text-sky-600 hover:bg-sky-50 rounded-lg transition-colors"
                      title="Open"
                    >
                      <FileText className="w-4 h-4" />
                    </a>
                  )}
                  <button
                    onClick={() => handleDelete(id)}
                    disabled={busyId === id}
                    className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors disabled:opacity-50"
                    title="Delete"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Upload modal */}
      <ModalSheet
        isOpen={uploadModalOpen}
        onClose={() => setUploadModalOpen(false)}
        title="Upload to Vault"
        description="Files are encrypted at rest and digitally signed"
        maxWidth="sm"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Document Name</label>
            <input
              type="text"
              value={docName}
              onChange={(e) => setDocName(e.target.value)}
              placeholder="e.g. 7/12 Gat 312 (2026)"
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Document Type</label>
            <select
              value={docType}
              onChange={(e) => setDocType(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 bg-white"
            >
              <option value="Land Record">Land Record (7/12)</option>
              <option value="Identity">Identity (Aadhaar / PAN)</option>
              <option value="Banking">Banking / DBT</option>
              <option value="Agronomy">Agronomy (Soil Health Card)</option>
              <option value="Insurance">Insurance</option>
              <option value="Other">Other</option>
            </select>
          </div>

          <input
            ref={fileRef}
            type="file"
            onChange={(e) => setPendingFile(e.target.files?.[0] ?? null)}
            className="hidden"
          />
          <button
            type="button"
            onClick={openFilePicker}
            className={`w-full p-4 border-2 border-dashed rounded-2xl text-center text-xs transition-colors ${
              pendingFile ? 'border-emerald-400 bg-emerald-50' : 'border-slate-300 hover:border-emerald-400'
            }`}
          >
            <UploadCloud className="w-6 h-6 text-slate-400 mx-auto mb-1" />
            {pendingFile ? (
              <span className="font-bold text-emerald-800">{pendingFile.name} ({Math.ceil(pendingFile.size / 1024)} KB)</span>
            ) : (
              <span className="text-slate-500 font-semibold">Choose file (PDF / image)</span>
            )}
          </button>

          <button
            onClick={handleUpload}
            disabled={uploading || !pendingFile}
            className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md disabled:opacity-60"
          >
            {uploading ? 'Encrypting & Uploading…' : 'Upload to Vault'}
          </button>
        </div>
      </ModalSheet>
    </div>
  );
};
