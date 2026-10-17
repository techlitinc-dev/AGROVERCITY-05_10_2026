import React, { useEffect, useState } from 'react';
import { HeartHandshake, IndianRupee, ShieldCheck, AlertCircle, CheckCircle2 } from 'lucide-react';
import { livestock, readList, apiErrorMessage } from '../../lib/api';
import { ModalSheet } from '../../components/common/ModalSheet';
import { StatusBadge } from '../../components/common/StatusBadge';
import { formatCurrency, formatDate } from '../../lib/utils';
import { asRec, nameOf, numOf, recArr, strOf } from './helpers';

type Tab = 'adoptions' | 'donations';

const ADOPTION_ACTIONS: Record<string, { label: string; status: string; style: string }[]> = {
  active: [
    { label: 'Approve (issue 80G receipt)', status: 'approved', style: 'bg-emerald-600 hover:bg-emerald-700 text-white' },
    { label: 'Reject', status: 'rejected', style: 'bg-rose-50 hover:bg-rose-100 text-rose-600' },
  ],
  approved: [
    { label: 'Mark completed', status: 'completed', style: 'bg-emerald-600 hover:bg-emerald-700 text-white' },
    { label: 'Reject', status: 'rejected', style: 'bg-rose-50 hover:bg-rose-100 text-rose-600' },
  ],
};

export const AdoptionsDonationsView: React.FC = () => {
  const [tab, setTab] = useState<Tab>('adoptions');
  const [gaushalaId, setGaushalaId] = useState('');
  const [adoptions, setAdoptions] = useState<Record<string, unknown>[]>([]);
  const [donations, setDonations] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [savingId, setSavingId] = useState('');

  // verify-payment modal
  const [verifyFor, setVerifyFor] = useState<Record<string, unknown> | null>(null);
  const [verifyKind, setVerifyKind] = useState<'adoption' | 'donation'>('donation');
  const [verifyForm, setVerifyForm] = useState({ razorpayOrderId: '', razorpayPaymentId: '', signature: '' });

  useEffect(() => {
    (async () => {
      try {
        const mine = asRec(await livestock.gaushala.mine());
        setGaushalaId(strOf(mine.id));
      } catch {
        // profile may not exist yet; lists will still load unscoped
      }
    })();
  }, []);

  const reload = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = gaushalaId ? { gaushalaId } : {};
      // lib list methods take no params; backend supports ?gaushalaId=
      const [a, d] = await Promise.all([
        readList<unknown[]>('/livestock/gaushala/adoptions', { params }),
        readList<unknown[]>('/livestock/gaushala/donations', { params }),
      ]);
      setAdoptions(recArr(a));
      setDonations(recArr(d));
    } catch (e) {
      setError(apiErrorMessage(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gaushalaId]);

  const withSaving = async (id: string, fn: () => Promise<unknown>, msg: string) => {
    setSavingId(id);
    setError(null);
    setNotice(null);
    try {
      await fn();
      setNotice(msg);
      await reload();
      return true;
    } catch (err) {
      setError(apiErrorMessage(err));
      return false;
    } finally {
      setSavingId('');
    }
  };

  const initiatePay = (row: Record<string, unknown>, kind: Tab) =>
    withSaving(
      `pay-${strOf(row.id)}`,
      async () => {
        const res = asRec(
          kind === 'adoptions'
            ? await livestock.gaushala.payAdoption(strOf(row.id), {})
            : await livestock.gaushala.payDonation(strOf(row.id), {}),
        );
        setVerifyKind(kind === 'adoptions' ? 'adoption' : 'donation');
        setVerifyFor(row);
        setVerifyForm({ razorpayOrderId: strOf(res.razorpayOrderId), razorpayPaymentId: '', signature: '' });
      },
      'Payment order initiated — complete verification to mark paid.',
    );

  const saveVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!verifyFor) return;
    const ok = await withSaving(
      `verify-${strOf(verifyFor.id)}`,
      async () => {
        if (verifyKind === 'adoption') {
          await livestock.gaushala.verifyAdoptionPayment(strOf(verifyFor.id), verifyForm);
        } else {
          await livestock.gaushala.verifyDonationPayment(strOf(verifyFor.id), verifyForm);
        }
      },
      'Payment verified.',
    );
    if (ok) setVerifyFor(null);
  };

  const setAdoptionStatus = (row: Record<string, unknown>, status: string) =>
    withSaving(
      `st-${strOf(row.id)}`,
      () => livestock.gaushala.updateAdoptionStatus(strOf(row.id), status),
      status === 'approved'
        ? `Adoption approved — 80G receipt issued to ${nameOf(row)}.`
        : `Adoption ${status}.`,
    );

  const setDonationStatus = (row: Record<string, unknown>, status: string) =>
    withSaving(
      `st-${strOf(row.id)}`,
      () => livestock.gaushala.updateDonationStatus(strOf(row.id), status),
      status === 'acknowledged'
        ? `Donation acknowledged — 80G receipt issued to ${nameOf(row)}.`
        : `Donation ${status}.`,
    );

  const paymentBadge = (row: Record<string, unknown>) => (
    <StatusBadge status={strOf(row.paymentStatus, 'pending') === 'paid' ? 'paid' : 'pending'} />
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 flex items-center gap-2">
            <HeartHandshake className="w-7 h-7 text-emerald-600" />
            Adoptions & Donations
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Approval queues — verify payments, then approve/acknowledge to auto-issue 80G receipts
          </p>
        </div>
        <div className="flex bg-slate-100 p-1 rounded-2xl self-start sm:self-auto">
          {(
            [
              { id: 'adoptions', label: `Adoptions (${adoptions.length})` },
              { id: 'donations', label: `Donations (${donations.length})` },
            ] as { id: Tab; label: string }[]
          ).map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                tab === t.id ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500'
              }`}
            >
              {t.label}
            </button>
          ))}
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
        <p className="text-xs text-slate-400">Loading queues…</p>
      ) : tab === 'adoptions' ? (
        adoptions.length === 0 ? (
          <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs p-8 text-center text-xs text-slate-400">
            No adoption requests yet.
          </div>
        ) : (
          <div className="space-y-3">
            {adoptions.map((a) => {
              const status = strOf(a.status, 'active');
              const paid = strOf(a.paymentStatus) === 'paid';
              const actions = ADOPTION_ACTIONS[status] || [];
              return (
                <div key={strOf(a.id)} className="bg-white rounded-3xl border border-slate-200/80 shadow-xs p-5 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h3 className="font-bold text-sm text-slate-900">
                        {nameOf(a)}
                        <span className="ml-2 text-xs font-semibold text-slate-400">
                          {strOf(a.plan) ? `• ${strOf(a.plan)} plan` : ''}
                        </span>
                      </h3>
                      <p className="text-[11px] text-slate-400">
                        {strOf(a.id)} • {formatDate(strOf(a.createdAt))} • {strOf(a.animalName) || 'Any cow'}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <StatusBadge status={status} />
                      {paymentBadge(a)}
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <span className="text-sm font-black text-emerald-800 flex items-center gap-1">
                      <IndianRupee className="w-4 h-4" />
                      {formatCurrency(numOf(a.amountInr))}
                    </span>
                    <div className="flex flex-wrap gap-2">
                      {!paid && status !== 'completed' && status !== 'rejected' && (
                        <button
                          onClick={() => initiatePay(a, 'adoptions')}
                          disabled={savingId === `pay-${strOf(a.id)}`}
                          className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-[11px] disabled:opacity-50"
                        >
                          {savingId === `pay-${strOf(a.id)}` ? 'Working…' : 'Initiate / Verify Payment'}
                        </button>
                      )}
                      {actions.map((act) => (
                        <button
                          key={act.status}
                          onClick={() => setAdoptionStatus(a, act.status)}
                          disabled={savingId === `st-${strOf(a.id)}`}
                          className={`px-3 py-1.5 rounded-xl font-bold text-[11px] disabled:opacity-50 ${act.style}`}
                        >
                          {act.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )
      ) : donations.length === 0 ? (
        <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs p-8 text-center text-xs text-slate-400">
          No donations yet.
        </div>
      ) : (
        <div className="space-y-3">
          {donations.map((d) => {
            const status = strOf(d.status, 'pending');
            const paid = strOf(d.paymentStatus) === 'paid';
            return (
              <div key={strOf(d.id)} className="bg-white rounded-3xl border border-slate-200/80 shadow-xs p-5 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h3 className="font-bold text-sm text-slate-900">{nameOf(d)}</h3>
                    <p className="text-[11px] text-slate-400">
                      {strOf(d.id)} • {formatDate(strOf(d.createdAt))} • {strOf(d.category) || 'General'}
                      {strOf(d.donorPan) ? ` • PAN ${strOf(d.donorPan)}` : ''}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <StatusBadge status={status} />
                    {paymentBadge(d)}
                  </div>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <span className="text-sm font-black text-emerald-800 flex items-center gap-1">
                    <IndianRupee className="w-4 h-4" />
                    {formatCurrency(numOf(d.amountInr))}
                  </span>
                  <div className="flex flex-wrap gap-2">
                    {!paid && status !== 'acknowledged' && status !== 'rejected' && (
                      <button
                        onClick={() => initiatePay(d, 'donations')}
                        disabled={savingId === `pay-${strOf(d.id)}`}
                        className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-[11px] disabled:opacity-50"
                      >
                        {savingId === `pay-${strOf(d.id)}` ? 'Working…' : 'Initiate / Verify Payment'}
                      </button>
                    )}
                    {status !== 'acknowledged' && status !== 'rejected' && (
                      <>
                        <button
                          onClick={() => setDonationStatus(d, 'acknowledged')}
                          disabled={savingId === `st-${strOf(d.id)}`}
                          className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] disabled:opacity-50 inline-flex items-center gap-1"
                        >
                          <ShieldCheck className="w-3.5 h-3.5" /> Acknowledge + 80G Receipt
                        </button>
                        <button
                          onClick={() => setDonationStatus(d, 'rejected')}
                          disabled={savingId === `st-${strOf(d.id)}`}
                          className="px-3 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-600 font-bold text-[11px] disabled:opacity-50"
                        >
                          Reject
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Verify payment modal */}
      <ModalSheet
        isOpen={Boolean(verifyFor)}
        onClose={() => setVerifyFor(null)}
        title={verifyFor ? `Verify payment — ${nameOf(verifyFor)}` : undefined}
        description="Paste the Razorpay checkout references to signature-verify and mark the record paid"
        maxWidth="md"
      >
        <form onSubmit={saveVerify} className="space-y-3">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Razorpay Order ID *</label>
            <input
              type="text"
              value={verifyForm.razorpayOrderId}
              onChange={(e) => setVerifyForm({ ...verifyForm, razorpayOrderId: e.target.value })}
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 font-mono"
              required
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Razorpay Payment ID *</label>
            <input
              type="text"
              value={verifyForm.razorpayPaymentId}
              onChange={(e) => setVerifyForm({ ...verifyForm, razorpayPaymentId: e.target.value })}
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 font-mono"
              required
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Signature *</label>
            <input
              type="text"
              value={verifyForm.signature}
              onChange={(e) => setVerifyForm({ ...verifyForm, signature: e.target.value })}
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 font-mono"
              required
            />
          </div>
          <button
            type="submit"
            disabled={savingId === `verify-${strOf(verifyFor?.id)}`}
            className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white font-bold text-xs shadow-md"
          >
            {savingId === `verify-${strOf(verifyFor?.id)}` ? 'Verifying…' : 'Verify & Mark Paid'}
          </button>
        </form>
      </ModalSheet>
    </div>
  );
};

export default AdoptionsDonationsView;
