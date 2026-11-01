import React, { useEffect, useState } from 'react';
import {
  Inbox,
  Phone,
  MessageCircle,
  CheckCircle2,
  AlertCircle,
  ShieldCheck,
  XCircle,
  Hourglass,
  RefreshCw,
} from 'lucide-react';
import { courses, teachers, apiErrorMessage } from '../../lib/api';
import { ModalSheet } from '../../components/common/ModalSheet';
import { asRec, boolOf, nameOf, numOf, recArr, strOf } from './helpers';
import { VerificationBadges } from './VerificationBadges';

/**
 * Instructor Enrollment Requests — every paid-course "Contact Instructor to
 * Enroll" request. Shows the learner's identity badge, the course, the listed
 * price at contact time, the unlocked learner contact (Call / WhatsApp / Chat),
 * the current access status and the manual "Grant Course Access" action.
 * Granting records the instructor's acknowledgement that the learner paid
 * directly — it is never platform payment verification.
 */
export const EnrollmentRequestsPage: React.FC = () => {
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [pendingCount, setPendingCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [grantTarget, setGrantTarget] = useState<Record<string, unknown> | null>(null);
  const [ack, setAck] = useState(false);
  const [externalPaymentRef, setExternalPaymentRef] = useState('');
  const [instructorNote, setInstructorNote] = useState('');
  const [saving, setSaving] = useState(false);

  const reload = async () => {
    setLoading(true);
    setError(null);
    try {
      const payload = asRec(await teachers.enrollmentRequests());
      setRows(recArr(payload.data));
      setPendingCount(numOf(payload.pendingCount));
    } catch (e) {
      setError(apiErrorMessage(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const openChat = async (courseId: string) => {
    try {
      await courses.courseChat(courseId);
      setNotice('Chat opened with the learner.');
    } catch (e) {
      setError(apiErrorMessage(e));
    }
  };

  const grant = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!grantTarget || !ack || saving) return;
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      const result = asRec(
        await teachers.grantAccess(strOf(grantTarget.requestId), {
          paymentReceivedAck: true,
          externalPaymentRef: externalPaymentRef.trim(),
          instructorNote: instructorNote.trim(),
        }),
      );
      setNotice(
        boolOf(result.alreadyGranted)
          ? `${nameOf(grantTarget)} already has access — nothing changed.`
          : `Access granted to ${nameOf(grantTarget)}. The learner is notified and can start immediately.`,
      );
      setGrantTarget(null);
      setAck(false);
      setExternalPaymentRef('');
      setInstructorNote('');
      await reload();
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const dismiss = async (row: Record<string, unknown>) => {
    if (!window.confirm(`Dismiss the request from ${nameOf(row)} for “${strOf(row.courseTitle)}”?`)) return;
    setError(null);
    setNotice(null);
    try {
      await teachers.dismissRequest(strOf(row.requestId));
      setNotice('Request dismissed.');
      await reload();
    } catch (e) {
      setError(apiErrorMessage(e));
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 flex items-center gap-2">
            <Inbox className="w-7 h-7 text-emerald-600" />
            Enrollment Requests
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Learners who contacted you about a paid course. Grant access after they pay you directly —
            Agrovercity never holds or verifies the payment.
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

      {pendingCount > 0 && (
        <div className="p-3 rounded-2xl bg-amber-50 border border-amber-200 text-xs font-bold text-amber-800 flex items-center gap-2">
          <Hourglass className="w-4 h-4 shrink-0" /> {pendingCount} request(s) waiting for you to grant access.
        </div>
      )}

      {loading ? (
        <p className="text-xs text-slate-400">Loading requests…</p>
      ) : rows.length === 0 ? (
        <div className="bg-white rounded-3xl border border-dashed border-slate-200 p-10 text-center text-xs text-slate-400">
          No paid-course contact requests yet. When a learner contacts you about a paid course, they
          appear here with their contact details unlocked.
        </div>
      ) : (
        <div className="space-y-3">
          {rows.map((row) => {
            const accessStatus = strOf(row.accessStatus, 'none');
            const contact = asRec(row.learnerContact);
            const waiting = accessStatus === 'none' && strOf(row.requestStatus) === 'contacted';
            return (
              <div
                key={strOf(row.requestId)}
                className={`bg-white rounded-3xl border shadow-xs p-5 space-y-3 ${
                  waiting ? 'border-amber-200/80' : 'border-slate-200/80'
                }`}
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-extrabold text-slate-900 flex items-center gap-2 flex-wrap">
                      {nameOf(row, strOf(row.learnerName, 'Learner'))}
                      <VerificationBadges compact identity={row.learnerIdentityVerified} />
                    </p>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      requested <strong>{strOf(row.courseTitle) || 'Course'}</strong> • listed price{' '}
                      <strong>
                        {strOf(row.currency, 'INR') || 'INR'} {numOf(row.priceRupees).toLocaleString('en-IN')}
                      </strong>{' '}
                      at contact • {strOf(row.requestedAt)?.slice(0, 10) || '—'}
                    </p>
                  </div>
                  <div>
                    {accessStatus === 'accessGranted' ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-violet-50 text-violet-700 border border-violet-200 text-[10px] font-bold">
                        <ShieldCheck className="w-3.5 h-3.5" /> Access granted by you
                      </span>
                    ) : accessStatus === 'accessRevoked' ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-rose-50 text-rose-700 border border-rose-200 text-[10px] font-bold">
                        <XCircle className="w-3.5 h-3.5" /> Access revoked
                      </span>
                    ) : strOf(row.requestStatus) === 'dismissed' ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-slate-100 text-slate-500 border border-slate-200 text-[10px] font-bold">
                        <XCircle className="w-3.5 h-3.5" /> Dismissed
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-50 text-amber-700 border border-amber-200 text-[10px] font-bold">
                        <Hourglass className="w-3.5 h-3.5" /> Waiting for access grant
                      </span>
                    )}
                  </div>
                </div>

                {strOf(row.requestStatus) === 'contacted' && (
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[11px] text-slate-500">
                      {strOf(contact.phone) && <span className="font-mono">{strOf(contact.phone)}</span>}
                    </span>
                    {strOf(contact.phone) && (
                      <a
                        href={`tel:${strOf(contact.phone)}`}
                        className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] inline-flex items-center gap-1"
                      >
                        <Phone className="w-3.5 h-3.5" /> Call
                      </a>
                    )}
                    {strOf(contact.whatsapp) && (
                      <a
                        href={`https://wa.me/${strOf(contact.whatsapp).replace(/\D/g, '')}`}
                        target="_blank"
                        rel="noreferrer"
                        className="px-3 py-1.5 rounded-xl bg-green-600 hover:bg-green-700 text-white font-bold text-[11px] inline-flex items-center gap-1"
                      >
                        <MessageCircle className="w-3.5 h-3.5" /> WhatsApp
                      </a>
                    )}
                    <button
                      onClick={() => openChat(strOf(row.courseId))}
                      className="px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-[11px] inline-flex items-center gap-1"
                    >
                      <MessageCircle className="w-3.5 h-3.5" /> Chat
                    </button>
                  </div>
                )}

                {waiting && (
                  <div className="flex flex-wrap gap-2 pt-1 border-t border-slate-100">
                    <button
                      onClick={() => {
                        setGrantTarget(row);
                        setAck(false);
                        setExternalPaymentRef('');
                        setInstructorNote('');
                      }}
                      className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs inline-flex items-center gap-1.5"
                    >
                      <CheckCircle2 className="w-4 h-4" /> Grant Course Access
                    </button>
                    <button
                      onClick={() => dismiss(row)}
                      className="px-4 py-2 rounded-xl border border-slate-300 text-slate-500 hover:bg-slate-50 font-bold text-xs"
                    >
                      Dismiss
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Grant modal */}
      <ModalSheet
        isOpen={Boolean(grantTarget)}
        onClose={() => setGrantTarget(null)}
        title={grantTarget ? `Grant access — ${nameOf(grantTarget)}` : undefined}
        description={
          grantTarget
            ? `${strOf(grantTarget.courseTitle)} • listed ${strOf(grantTarget.currency, 'INR') || 'INR'} ${numOf(grantTarget.priceRupees).toLocaleString('en-IN')} at contact`
            : undefined
        }
        maxWidth="md"
      >
        <form onSubmit={grant} className="space-y-3">
          <div className="p-3 rounded-2xl bg-amber-50 border border-amber-200 text-[11px] text-amber-800 leading-relaxed">
            Only grant access after the learner has paid you directly, outside Agrovercity. Agrovercity
            does not verify the payment or provide refunds. The learner gets full course access
            immediately and is notified.
          </div>
          <label className="flex items-start gap-2 text-[11px] text-slate-700 leading-relaxed bg-slate-50 border border-slate-100 rounded-2xl p-3 cursor-pointer">
            <input
              type="checkbox"
              checked={ack}
              onChange={(e) => setAck(e.target.checked)}
              className="w-4 h-4 mt-0.5 accent-emerald-600 shrink-0"
              required
            />
            <span>
              I confirm the learner paid me directly for this course and I am granting course access
              manually.
            </span>
          </label>
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              External payment reference <span className="text-slate-400 font-semibold">(optional, private)</span>
            </label>
            <input
              type="text"
              value={externalPaymentRef}
              onChange={(e) => setExternalPaymentRef(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300"
              placeholder="e.g. UPI transaction id"
              maxLength={120}
            />
            <p className="text-[10px] text-slate-400 mt-1">
              Visible only to you — never shown as platform-verified payment evidence.
            </p>
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Private note <span className="text-slate-400 font-semibold">(optional)</span>
            </label>
            <textarea
              value={instructorNote}
              onChange={(e) => setInstructorNote(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300"
              rows={2}
              maxLength={500}
              placeholder="e.g. Paid in cash during field visit"
            />
          </div>
          <button
            type="submit"
            disabled={saving || !ack}
            className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold text-xs shadow-md"
          >
            {saving ? 'Granting…' : 'Grant Course Access'}
          </button>
        </form>
      </ModalSheet>
    </div>
  );
};

export default EnrollmentRequestsPage;
