import React, { useEffect, useState } from 'react';
import { Award, Download, ShieldCheck, Ban, Plus, AlertCircle, CheckCircle2, RefreshCw, QrCode } from 'lucide-react';
import { teachers, apiErrorMessage } from '../../lib/api';
import { ModalSheet } from '../../components/common/ModalSheet';
import { StatusBadge } from '../../components/common/StatusBadge';
import { formatDateTime } from '../../lib/utils';
import { asRec, nameOf, numOf, recArr, strOf } from './helpers';

/**
 * Instructor certificates — issue completion certificates from the paid
 * roster (teachers.issueCertificate), inspect the tamper-evident download
 * payload (QR + SHA-256), publicly verify, and revoke with a reason.
 */
export const CertificatesPage: React.FC = () => {
  const [students, setStudents] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [download, setDownload] = useState<Record<string, unknown> | null>(null);
  const [downloadLoading, setDownloadLoading] = useState(false);
  const [verifyResult, setVerifyResult] = useState<Record<string, unknown> | null>(null);
  const [revokeFor, setRevokeFor] = useState<Record<string, unknown> | null>(null);
  const [revokeReason, setRevokeReason] = useState('');
  const [saving, setSaving] = useState(false);

  const reload = async () => {
    setLoading(true);
    setError(null);
    try {
      setStudents(recArr(await teachers.allStudents()));
    } catch (e) {
      setError(apiErrorMessage(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    reload();
  }, []);

  const certRows = students.filter((s) => strOf(s.certificateId));
  const completable = students.filter((s) => !strOf(s.certificateId));

  const issue = async (s: Record<string, unknown>) => {
    if (!window.confirm(`Issue the completion certificate to ${nameOf(s)} for “${strOf(s.courseTitle)}”?`)) return;
    setError(null);
    setNotice(null);
    try {
      await teachers.issueCertificate(strOf(s.courseId), strOf(s.studentId));
      setNotice(`Certificate issued to ${nameOf(s)}.`);
      await reload();
    } catch (err) {
      setError(apiErrorMessage(err));
    }
  };

  const openDownload = async (certId: string) => {
    setDownloadLoading(true);
    setDownload(null);
    try {
      setDownload(asRec(await teachers.downloadCertificate(certId)));
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setDownloadLoading(false);
    }
  };

  const openVerify = async (certId: string) => {
    setVerifyResult(null);
    try {
      setVerifyResult(asRec(await teachers.verifyCertificate(certId)));
    } catch (err) {
      setError(apiErrorMessage(err));
    }
  };

  const submitRevoke = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!revokeFor) return;
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      await teachers.revokeCertificate(strOf(revokeFor.certificateId), revokeReason);
      setRevokeFor(null);
      setRevokeReason('');
      setNotice(`Certificate ${strOf(revokeFor.certificateId)} revoked.`);
      await reload();
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 flex items-center gap-2">
            <Award className="w-7 h-7 text-emerald-600" />
            Certificates
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Issue completion certificates, download the tamper-evident payload, verify & revoke
          </p>
        </div>
        <button
          onClick={reload}
          className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold text-[11px] inline-flex items-center gap-1 self-start sm:self-auto"
        >
          <RefreshCw className="w-3.5 h-3.5" /> Refresh
        </button>
      </div>

      {error && (
        <div className="p-3 rounded-2xl bg-rose-50 border border-rose-200 text-xs font-bold text-rose-700 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" /> {error}
        </div>
      )}
      {notice && (
        <div className="p-3 rounded-2xl bg-emerald-50 border border-emerald-200 text-xs font-bold text-emerald-700 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" /> {notice}
        </div>
      )}

      {/* Issued certificates */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100">
          <h3 className="font-bold text-sm text-slate-900">Issued Certificates ({certRows.length})</h3>
        </div>
        {loading ? (
          <p className="p-6 text-xs text-slate-400">Loading…</p>
        ) : certRows.length === 0 ? (
          <p className="p-6 text-xs text-slate-400">No certificates issued yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 text-slate-500 font-bold uppercase text-[10px] tracking-wider border-b border-slate-100">
                  <th className="py-3 px-5">Certificate</th>
                  <th className="py-3 px-3">Student</th>
                  <th className="py-3 px-3">Course</th>
                  <th className="py-3 px-3">Progress</th>
                  <th className="py-3 px-5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {certRows.map((s) => (
                  <tr key={strOf(s.certificateId)} className="hover:bg-slate-50/60">
                    <td className="py-3 px-5 font-mono font-bold text-emerald-800">{strOf(s.certificateId)}</td>
                    <td className="py-3 px-3 font-bold text-slate-900">{nameOf(s, strOf(s.studentName, 'Student'))}</td>
                    <td className="py-3 px-3 text-slate-600 max-w-44 truncate">{strOf(s.courseTitle)}</td>
                    <td className="py-3 px-3 text-slate-600">{numOf(s.progressPercent)}%</td>
                    <td className="py-3 px-5 text-right">
                      <div className="inline-flex gap-1">
                        <button
                          onClick={() => openDownload(strOf(s.certificateId))}
                          className="p-1.5 rounded-lg text-sky-600 hover:bg-sky-50"
                          title="Download payload"
                        >
                          <Download className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => openVerify(strOf(s.certificateId))}
                          className="p-1.5 rounded-lg text-emerald-600 hover:bg-emerald-50"
                          title="Public verify"
                        >
                          <ShieldCheck className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => {
                            setRevokeFor(s);
                            setRevokeReason('');
                          }}
                          className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-50"
                          title="Revoke"
                        >
                          <Ban className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Issue from roster */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100">
          <h3 className="font-bold text-sm text-slate-900">Issue From Roster ({completable.length} without certificate)</h3>
        </div>
        {loading ? null : completable.length === 0 ? (
          <p className="p-6 text-xs text-slate-400">Every enrolled student already holds a certificate.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <tbody className="divide-y divide-slate-100">
                {completable.slice(0, 20).map((s) => (
                  <tr key={`${strOf(s.studentId)}-${strOf(s.courseId)}`} className="hover:bg-slate-50/60">
                    <td className="py-3 px-5 font-bold text-slate-900">{nameOf(s, strOf(s.studentName, 'Student'))}</td>
                    <td className="py-3 px-3 text-slate-600 max-w-52 truncate">{strOf(s.courseTitle)}</td>
                    <td className="py-3 px-3 text-slate-600">{numOf(s.progressPercent)}% complete</td>
                    <td className="py-3 px-5 text-right">
                      <button
                        onClick={() => issue(s)}
                        className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] inline-flex items-center gap-1"
                      >
                        <Plus className="w-3.5 h-3.5" /> Issue Certificate
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Download payload modal */}
      <ModalSheet
        isOpen={downloadLoading || Boolean(download)}
        onClose={() => setDownload(null)}
        title={download ? strOf(download.certificateTitle, 'Certificate of Completion') : undefined}
        description="Co-branded payload with QR content and SHA-256 tamper fingerprint."
        maxWidth="md"
      >
        {downloadLoading ? (
          <p className="text-xs text-slate-400">Loading certificate…</p>
        ) : !download ? null : (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: 'Recipient', value: strOf(download.recipientName) },
                { label: 'Course', value: strOf(download.courseTitle) },
                { label: 'Issued', value: formatDateTime(strOf(download.issuedAt)) },
                { label: 'Institution', value: strOf(download.institution) },
              ].map((f) => (
                <div key={f.label} className="p-3 bg-slate-50 rounded-2xl border border-slate-100">
                  <p className="text-[10px] uppercase font-bold text-slate-400">{f.label}</p>
                  <p className="text-xs font-black text-slate-900">{f.value || '—'}</p>
                </div>
              ))}
            </div>
            <div className="p-3 rounded-2xl bg-emerald-50 border border-emerald-100 space-y-2">
              <p className="text-[10px] uppercase font-bold text-emerald-700 flex items-center gap-1">
                <QrCode className="w-3.5 h-3.5" /> QR Payload
              </p>
              <p className="text-[10px] font-mono text-emerald-800 break-all">{strOf(download.qrPayload)}</p>
              <p className="text-[10px] uppercase font-bold text-emerald-700 pt-2 border-t border-emerald-100">SHA-256 Fingerprint</p>
              <p className="text-[10px] font-mono text-emerald-800 break-all">{strOf(download.fingerprintSha256)}</p>
            </div>
            <p className="text-[10px] text-slate-400">{strOf(download.note)}</p>
          </div>
        )}
      </ModalSheet>

      {/* Verify result modal */}
      <ModalSheet
        isOpen={Boolean(verifyResult)}
        onClose={() => setVerifyResult(null)}
        title="Public Verification"
        description="What an employer sees on the public verify page (no login, no phone)."
        maxWidth="sm"
      >
        {!verifyResult ? null : (
          <div className="space-y-3">
            <div
              className={`p-4 rounded-2xl border text-center ${
                verifyResult.isValid
                  ? 'bg-emerald-50 border-emerald-200'
                  : 'bg-rose-50 border-rose-200'
              }`}
            >
              <ShieldCheck className={`w-8 h-8 mx-auto ${verifyResult.isValid ? 'text-emerald-600' : 'text-rose-500'}`} />
              <p className={`mt-1 font-black text-sm ${verifyResult.isValid ? 'text-emerald-800' : 'text-rose-700'}`}>
                {verifyResult.isValid ? 'Valid Certificate' : 'Revoked / Invalid'}
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: 'Recipient', value: strOf(verifyResult.recipientName) },
                { label: 'Course', value: strOf(verifyResult.courseTitle) },
                { label: 'Issued', value: formatDateTime(strOf(verifyResult.issuedAt)) },
                { label: 'Certificate', value: strOf(verifyResult.certificateId) },
              ].map((f) => (
                <div key={f.label} className="p-3 bg-slate-50 rounded-2xl border border-slate-100">
                  <p className="text-[10px] uppercase font-bold text-slate-400">{f.label}</p>
                  <p className="text-xs font-black text-slate-900 break-all">{f.value || '—'}</p>
                </div>
              ))}
            </div>
            {Boolean(verifyResult.revoked) && (
              <p className="text-xs font-bold text-rose-600">
                Revoked: {strOf(asRec(verifyResult.revoked).reason)}
              </p>
            )}
          </div>
        )}
      </ModalSheet>

      {/* Revoke modal */}
      <ModalSheet
        isOpen={Boolean(revokeFor)}
        onClose={() => setRevokeFor(null)}
        title={`Revoke ${revokeFor ? strOf(revokeFor.certificateId) : ''}`}
        description="The certificate stays resolvable on the public page but reads as invalid. The student is notified."
        maxWidth="sm"
      >
        <form onSubmit={submitRevoke} className="space-y-3">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Reason *</label>
            <textarea
              value={revokeReason}
              onChange={(e) => setRevokeReason(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300"
              rows={2}
              minLength={3}
              required
            />
          </div>
          <button
            type="submit"
            disabled={saving}
            className="w-full py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 disabled:opacity-60 text-white font-bold text-xs shadow-md"
          >
            {saving ? 'Revoking…' : 'Revoke Certificate'}
          </button>
        </form>
      </ModalSheet>
    </div>
  );
};

export default CertificatesPage;
