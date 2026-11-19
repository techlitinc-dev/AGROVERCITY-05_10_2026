import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  BadgeCheck,
  FileText,
  Mountain,
  RefreshCcw,
  ShieldAlert,
  Upload,
  ArrowRight,
  CheckCircle2,
  Lock,
} from 'lucide-react';
import { land, uploads, apiErrorMessage } from '../../lib/api';

const asRecord = (v: unknown): Record<string, unknown> =>
  v !== null && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
const asStr = (v: unknown, fallback = ''): string => (typeof v === 'string' ? v : fallback);

interface VerificationRow {
  id: string;
  village?: string;
  district?: string;
  areaAcres?: number;
  status?: string;
  landDocumentsStatus?: string;
  landDocuments?: string[];
  landDocumentsRejectionReason?: string | null;
  landVerified?: boolean;
}

/**
 * Land Verification — the dedicated document-verification desk (spec §6).
 * Landlords submit private title documents (7/12 record, land tax receipt)
 * per listing; verification personnel review them and set the verified /
 * rejected state. Uploading alone never earns the badge — only the review
 * does. Identity KYC is a separate, earlier gate.
 */
export const LandlordVerificationView: React.FC = () => {
  const [rows, setRows] = useState<VerificationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const mine = (await land.myListings()) as unknown[];
      setRows(
        mine.map((raw) => {
          const r = asRecord(raw);
          return {
            id: asStr(r.id),
            village: asStr(r.village),
            district: asStr(r.district),
            areaAcres: typeof r.areaAcres === 'number' ? r.areaAcres : undefined,
            status: asStr(r.status),
            landDocumentsStatus: asStr(r.landDocumentsStatus) || undefined,
            landDocuments: Array.isArray(r.landDocuments) ? r.landDocuments.map((u) => asStr(u)).filter(Boolean) : [],
            landDocumentsRejectionReason:
              typeof r.landDocumentsRejectionReason === 'string' ? r.landDocumentsRejectionReason : null,
            landVerified: r.landVerified === true,
          };
        }),
      );
    } catch (e) {
      setError(apiErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const submitDocuments = async (listing: VerificationRow, files: FileList | null) => {
    if (!files || files.length === 0) return;
    setBusyId(listing.id);
    setError(null);
    setNotice(null);
    try {
      const picked = Array.from(files).slice(0, 5);
      const urls: string[] = [];
      for (const file of picked) {
        const uploaded = asRecord(
          await uploads.upload(file, { folder: 'land', purpose: 'land-documents' }),
        );
        const url = asStr(uploaded.url) || asStr(uploaded.fileUrl);
        if (url) urls.push(url);
      }
      if (urls.length === 0) {
        setError('Upload failed — no file was stored. Please retry.');
        return;
      }
      await land.submitLandDocuments(listing.id, urls);
      setNotice(
        `${urls.length} document(s) submitted for ${listing.village || 'your listing'} — now under review.`,
      );
      await load();
    } catch (e) {
      setError(apiErrorMessage(e));
    } finally {
      setBusyId(null);
    }
  };

  const statusChip = (l: VerificationRow) => {
    if (l.landDocumentsStatus === 'verified' || l.landVerified) {
      return (
        <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full inline-flex items-center gap-1">
          <BadgeCheck className="w-3 h-3" /> Land Docs Verified
        </span>
      );
    }
    if (l.landDocumentsStatus === 'rejected') {
      return (
        <span className="text-[10px] font-bold text-rose-700 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded-full">
          Docs Rejected
        </span>
      );
    }
    if (l.landDocumentsStatus === 'pending') {
      return (
        <span className="text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full inline-flex items-center gap-1">
          <ShieldAlert className="w-3 h-3" /> Docs Under Review
        </span>
      );
    }
    return (
      <span className="text-[10px] font-bold text-slate-500 bg-slate-50 border border-slate-200 px-2 py-0.5 rounded-full">
        Docs Not Submitted
      </span>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 flex items-center gap-2">
            <BadgeCheck className="w-7 h-7 text-emerald-600" />
            Land Verification
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Submit your land title documents (7/12 record, land tax receipt) for review. Once verified, the
            "Land Docs Verified" badge appears on your listing for farmers.
          </p>
        </div>
        <button
          onClick={() => void load()}
          disabled={loading}
          className="px-4 py-2.5 rounded-2xl border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold text-xs flex items-center gap-2 self-start sm:self-auto"
        >
          <RefreshCcw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      <div className="p-3.5 bg-sky-50 border border-sky-200 rounded-2xl text-xs font-semibold text-sky-800 flex items-start gap-2">
        <Lock className="w-4 h-4 flex-shrink-0 mt-0.5" />
        <span>
          Documents are private — visible only to you and verification personnel. Uploading sets the review
          state to <strong>Under Review</strong>; the badge is awarded only after an actual document review.
          Identity KYC alone never earns it, and a rejection always comes with the reviewer's reason so you
          can correct and resubmit.
        </span>
      </div>

      {error && (
        <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-2xl text-xs font-semibold text-rose-800">
          {error}
        </div>
      )}
      {notice && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-2xl text-xs font-semibold text-emerald-800 flex items-center justify-between gap-4">
          <span>{notice}</span>
          <button onClick={() => setNotice(null)} className="font-bold hover:underline shrink-0">
            Dismiss
          </button>
        </div>
      )}

      {loading ? (
        <div className="py-10 text-center text-xs font-bold text-slate-400 animate-pulse">
          Loading your land listings…
        </div>
      ) : rows.length === 0 ? (
        <div className="py-12 text-center bg-white rounded-3xl border border-slate-200/80 space-y-3">
          <Mountain className="w-10 h-10 text-slate-300 mx-auto" />
          <p className="text-sm font-bold text-slate-700">No land listings yet</p>
          <p className="text-xs text-slate-400">
            Post a land request first — verification documents are attached to a listing.
          </p>
          <Link
            to="/landlord/listings"
            className="inline-flex items-center gap-1 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs"
          >
            Post Land Request <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {rows.map((l) => (
            <div
              key={l.id}
              className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-xs space-y-3"
            >
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div>
                  <h4 className="font-bold text-sm text-slate-900 capitalize">
                    {l.village || 'Farmland'}
                    {l.district ? ` · ${l.district}` : ''}
                  </h4>
                  <p className="text-[11px] text-slate-500">
                    {l.areaAcres ? `${l.areaAcres} acres · ` : ''}
                    {l.landDocuments?.length ?? 0} document(s) on file
                  </p>
                </div>
                {statusChip(l)}
              </div>

              {l.landDocumentsStatus === 'rejected' && l.landDocumentsRejectionReason && (
                <div className="p-3 rounded-2xl bg-rose-50 border border-rose-200 text-[11px] font-semibold text-rose-800">
                  Rejection reason: {l.landDocumentsRejectionReason}
                </div>
              )}

              {l.landDocumentsStatus === 'verified' && (
                <div className="p-3 rounded-2xl bg-emerald-50 border border-emerald-200 text-[11px] font-semibold text-emerald-800 flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  This listing shows the "Land Docs Verified" badge to farmers browsing farmland.
                </div>
              )}

              {l.landDocumentsStatus === 'pending' && (
                <p className="text-[11px] text-slate-500">
                  Verification personnel review each submission. You can replace the documents while the
                  review is pending — the review clock restarts with the new files.
                </p>
              )}

              <div className="flex items-center justify-between gap-2 flex-wrap">
                <p className="text-[10px] text-slate-400 flex items-center gap-1">
                  <FileText className="w-3 h-3" />
                  Accepted: 7/12 extract, land tax receipt, sale deed (images or PDF, up to 5 files)
                </p>
                <label
                  className={`px-3.5 py-2 rounded-xl text-[11px] font-bold flex items-center gap-1.5 transition-all ${
                    busyId === l.id
                      ? 'bg-slate-100 text-slate-400 cursor-wait'
                      : 'bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer'
                  }`}
                >
                  <Upload className="w-3.5 h-3.5" />
                  {busyId === l.id
                    ? 'Uploading…'
                    : l.landDocumentsStatus === 'rejected'
                      ? 'Upload Corrected Documents'
                      : l.landDocuments && l.landDocuments.length > 0
                        ? 'Replace Documents'
                        : 'Submit Documents'}
                  <input
                    type="file"
                    multiple
                    accept="image/*,application/pdf"
                    className="hidden"
                    disabled={busyId === l.id}
                    onChange={(e) => {
                      void submitDocuments(l, e.target.files);
                      e.target.value = '';
                    }}
                  />
                </label>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
