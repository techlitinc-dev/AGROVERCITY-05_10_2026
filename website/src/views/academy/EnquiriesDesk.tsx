import React, { useEffect, useState } from 'react';
import { Mail, IndianRupee, ArrowLeftRight, AlertCircle, CheckCircle2, RefreshCw } from 'lucide-react';
import { teachers, apiErrorMessage } from '../../lib/api';
import { ModalSheet } from '../../components/common/ModalSheet';
import { StatusBadge } from '../../components/common/StatusBadge';
import { formatCurrency, formatDateTime } from '../../lib/utils';
import { asRec, nameOf, numOf, recArr, strOf } from './helpers';

type Action = { kind: 'quote' | 'counter'; enquiry: Record<string, unknown> } | null;

/**
 * Instructor enquiries desk — structured fee enquiries from farmers, answered
 * with a fee quote or a TTL counter-offer (teachers.enquiries*).
 */
export const EnquiriesDesk: React.FC = () => {
  const [enquiries, setEnquiries] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [action, setAction] = useState<Action>(null);
  const [fee, setFee] = useState(0);
  const [terms, setTerms] = useState('');
  const [ttlHours, setTtlHours] = useState(24);
  const [saving, setSaving] = useState(false);
  const [statusFilter, setStatusFilter] = useState('');

  const reload = async () => {
    setLoading(true);
    setError(null);
    try {
      setEnquiries(recArr(await teachers.enquiries()));
    } catch (e) {
      setError(apiErrorMessage(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    reload();
  }, []);

  const openAction = (kind: 'quote' | 'counter', enquiry: Record<string, unknown>) => {
    setAction({ kind, enquiry });
    setFee(numOf(enquiry.quotedFeeRupees, numOf(enquiry.proposedFeeRupees, 999)));
    setTerms(strOf(enquiry.terms));
    setTtlHours(24);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!action) return;
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      if (action.kind === 'quote') {
        await teachers.quoteEnquiry(strOf(action.enquiry.id), {
          enquiryId: strOf(action.enquiry.id),
          proposedFeeRupees: fee,
          terms,
        });
        setNotice(`Fee quote of ${formatCurrency(fee)} sent to ${nameOf(action.enquiry)}.`);
      } else {
        await teachers.counterEnquiry(strOf(action.enquiry.id), {
          quotedFeeRupees: fee,
          ttlHours,
        });
        setNotice(`Counter offer of ${formatCurrency(fee)} sent — valid ${ttlHours}h.`);
      }
      setAction(null);
      await reload();
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const filtered = statusFilter
    ? enquiries.filter((en) => strOf(en.status, 'open') === statusFilter)
    : enquiries;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 flex items-center gap-2">
            <Mail className="w-7 h-7 text-emerald-600" />
            Enquiries Desk
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Structured fee enquiries from farmers — quote your fee or send a TTL counter-offer
          </p>
        </div>
        <div className="flex items-center gap-2 self-start sm:self-auto">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-1.5 text-xs rounded-xl border border-slate-300 bg-white"
          >
            <option value="">All statuses</option>
            <option value="open">Open</option>
            <option value="quoted">Quoted</option>
            <option value="countered">Countered</option>
            <option value="accepted">Accepted</option>
            <option value="expired">Expired</option>
          </select>
          <button
            onClick={reload}
            className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold text-[11px] inline-flex items-center gap-1"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Refresh
          </button>
        </div>
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

      {loading ? (
        <p className="text-xs text-slate-400">Loading enquiries…</p>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-3xl border border-dashed border-slate-200 p-10 text-center text-xs text-slate-400">
          No enquiries yet — they appear here when a farmer asks about one of your courses.
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((en) => {
            const course = asRec(en.course);
            const quoted = numOf(en.quotedFeeRupees);
            const actionable = ['open', 'quoted', 'countered'].includes(strOf(en.status, 'open'));
            return (
              <div key={strOf(en.id)} className="bg-white rounded-3xl border border-slate-200/80 shadow-xs p-5 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h3 className="font-bold text-sm text-slate-900">
                      {nameOf(en, strOf(en.farmerName, 'Farmer enquiry'))}
                      <span className="text-[10px] text-slate-400 font-semibold ml-2">
                        {strOf(en.courseTitle) || strOf(course.title) || 'Course enquiry'}
                      </span>
                    </h3>
                    <p className="text-[11px] text-slate-400">{formatDateTime(strOf(en.createdAt))}</p>
                  </div>
                  <StatusBadge status={strOf(en.status, 'open')} />
                </div>

                {strOf(en.questionTemplate) && (
                  <p className="text-xs text-slate-600 bg-slate-50 border border-slate-100 rounded-2xl p-3">
                    “{strOf(en.questionTemplate)}”
                  </p>
                )}
                {strOf(en.details) && <p className="text-xs text-slate-500">{strOf(en.details)}</p>}

                <div className="flex flex-wrap items-center gap-3 text-xs">
                  {quoted > 0 && (
                    <span className="font-black text-emerald-800">
                      Quoted {formatCurrency(quoted)}
                      {numOf(en.ttlHours) > 0 && ` • TTL ${numOf(en.ttlHours)}h`}
                    </span>
                  )}
                  {strOf(en.expiresAt) && (
                    <span className="text-[11px] text-slate-400">expires {formatDateTime(strOf(en.expiresAt))}</span>
                  )}
                  {actionable && (
                    <div className="ml-auto flex gap-2">
                      <button
                        onClick={() => openAction('quote', en)}
                        className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] inline-flex items-center gap-1"
                      >
                        <IndianRupee className="w-3.5 h-3.5" /> Fee Quote
                      </button>
                      <button
                        onClick={() => openAction('counter', en)}
                        className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-[11px] inline-flex items-center gap-1"
                      >
                        <ArrowLeftRight className="w-3.5 h-3.5" /> Counter
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <ModalSheet
        isOpen={Boolean(action)}
        onClose={() => setAction(null)}
        title={action?.kind === 'quote' ? 'Send Fee Quote' : 'Send Counter Offer'}
        description={
          action?.kind === 'quote'
            ? 'Sets quotedFeeRupees + terms and moves the enquiry to “quoted”.'
            : 'Farmer-side offer with TTL (24–48h) — auto-expires server-side.'
        }
        maxWidth="sm"
      >
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              {action?.kind === 'quote' ? 'Proposed Fee (₹) *' : 'Counter Fee (₹) *'}
            </label>
            <input
              type="number"
              step="1"
              min="1"
              value={fee}
              onChange={(e) => setFee(Number(e.target.value))}
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300"
              required
            />
          </div>
          {action?.kind === 'quote' ? (
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Terms</label>
              <textarea
                value={terms}
                onChange={(e) => setTerms(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300"
                rows={2}
                placeholder="e.g. 2 instalments, materials included, refund 50% ≥48h before batch"
              />
            </div>
          ) : (
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Validity (hours, 1–48)</label>
              <input
                type="number"
                min="1"
                max="48"
                value={ttlHours}
                onChange={(e) => setTtlHours(Number(e.target.value))}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300"
                required
              />
            </div>
          )}
          <button
            type="submit"
            disabled={saving}
            className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white font-bold text-xs shadow-md"
          >
            {saving ? 'Sending…' : action?.kind === 'quote' ? 'Send Quote' : 'Send Counter'}
          </button>
        </form>
      </ModalSheet>
    </div>
  );
};

export default EnquiriesDesk;
