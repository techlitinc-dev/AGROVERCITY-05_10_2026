import React, { useEffect, useState } from 'react';
import { DollarSign, Plus, Eye, CheckCircle2, AlertCircle, Landmark } from 'lucide-react';
import { dairy, apiErrorMessage } from '../../lib/api';
import { ModalSheet } from '../../components/common/ModalSheet';
import { StatusBadge } from '../../components/common/StatusBadge';
import { formatCurrency, formatDate } from '../../lib/utils';
import { dairyExtras } from './managerApi';
import { asRec, nameOf, numOf, recArr, strOf, todayStr } from './helpers';

function defaultPeriod(): { from: string; to: string } {
  const d = new Date();
  const to = d.toISOString().slice(0, 10);
  const from = new Date(d.getTime() - 9 * 86400000).toISOString().slice(0, 10);
  return { from, to };
}

export const DairyPaymentsPage: React.FC = () => {
  const [batches, setBatches] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [genOpen, setGenOpen] = useState(false);
  const [period, setPeriod] = useState(defaultPeriod());
  const [generating, setGenerating] = useState(false);
  const [generated, setGenerated] = useState<Record<string, unknown> | null>(null);

  const [reviewBatch, setReviewBatch] = useState<Record<string, unknown> | null>(null);
  const [utr, setUtr] = useState('');
  const [marking, setMarking] = useState(false);

  const reload = async () => {
    setLoading(true);
    setError(null);
    try {
      setBatches(recArr(await dairy.manager.paymentBatches()));
    } catch (e) {
      setError(apiErrorMessage(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    reload();
  }, []);

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    setGenerating(true);
    setError(null);
    setNotice(null);
    try {
      const batch = asRec(
        await dairy.manager.createPaymentBatch({ periodFrom: period.from, periodTo: period.to }),
      );
      setGenerated(batch);
      setGenOpen(false);
      setNotice(
        `Batch ${strOf(batch.id)} generated — ${formatCurrency(numOf(batch.totalNet))} for ${recArr(batch.entries).length} members.`,
      );
      await reload();
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setGenerating(false);
    }
  };

  const openMarkPaid = (b: Record<string, unknown>) => {
    setReviewBatch(b);
    setUtr('');
  };

  const handleMarkPaid = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reviewBatch) return;
    setMarking(true);
    setError(null);
    try {
      await dairyExtras.markBatchPaid(strOf(reviewBatch.id), utr.trim());
      setNotice(`Batch ${strOf(reviewBatch.id)} marked as paid${utr.trim() ? ` (UTR ${utr.trim()})` : ''}.`);
      setReviewBatch(null);
      await reload();
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setMarking(false);
    }
  };

  const reviewEntries = reviewBatch ? recArr(reviewBatch.entries) : [];
  const generatedEntries = generated ? recArr(generated.entries) : [];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 flex items-center gap-2">
            <DollarSign className="w-7 h-7 text-emerald-600" />
            Member Payout Batches
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            10-day payment cycles: generate from collections, review entries, mark paid with UTR reference
          </p>
        </div>
        <button
          onClick={() => {
            setPeriod(defaultPeriod());
            setGenOpen(true);
          }}
          className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs flex items-center gap-1.5 self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" /> Generate Batch
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

      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden">
        {loading ? (
          <p className="p-6 text-xs text-slate-400">Loading batches…</p>
        ) : batches.length === 0 ? (
          <div className="p-8 text-center space-y-2">
            <Landmark className="w-10 h-10 text-slate-300 mx-auto" />
            <p className="text-sm font-bold text-slate-700">No payment batches yet</p>
            <p className="text-xs text-slate-400">Generate a batch to pay members for a collection period.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 text-slate-500 font-bold uppercase text-[10px] tracking-wider border-b border-slate-100">
                  <th className="py-3 px-5">Batch</th>
                  <th className="py-3 px-3">Period</th>
                  <th className="py-3 px-3">Liters</th>
                  <th className="py-3 px-3">Gross</th>
                  <th className="py-3 px-3">Net Payable</th>
                  <th className="py-3 px-3">Status</th>
                  <th className="py-3 px-5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {batches.map((b) => (
                  <tr key={strOf(b.id)} className="hover:bg-slate-50/60">
                    <td className="py-3 px-5 font-mono font-bold text-slate-900">{strOf(b.id)}</td>
                    <td className="py-3 px-3 text-slate-600">
                      {formatDate(strOf(b.periodFrom))} → {formatDate(strOf(b.periodTo))}
                    </td>
                    <td className="py-3 px-3 text-slate-700">{numOf(b.totalLiters).toFixed(1)} L</td>
                    <td className="py-3 px-3 text-slate-700">{formatCurrency(numOf(b.totalAmount))}</td>
                    <td className="py-3 px-3 font-black text-emerald-800">{formatCurrency(numOf(b.totalNet))}</td>
                    <td className="py-3 px-3">
                      <StatusBadge status={strOf(b.status, 'draft')} />
                    </td>
                    <td className="py-3 px-5 text-right">
                      <div className="inline-flex gap-1">
                        {Array.isArray(b.entries) && recArr(b.entries).length > 0 && (
                          <button
                            onClick={() => setReviewBatch(b)}
                            className="p-1.5 rounded-lg text-sky-600 hover:bg-sky-50"
                            title="Review entries"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                        )}
                        {strOf(b.status) !== 'paid' && (
                          <button
                            onClick={() => openMarkPaid(b)}
                            className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px]"
                          >
                            Mark Paid
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Generate batch modal */}
      <ModalSheet
        isOpen={genOpen}
        onClose={() => setGenOpen(false)}
        title="Generate Payment Batch"
        description="Aggregates member collections between the period dates into payout entries"
        maxWidth="md"
      >
        <form onSubmit={handleGenerate} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Period From *</label>
              <input
                type="date"
                value={period.from}
                max={todayStr()}
                onChange={(e) => setPeriod({ ...period, from: e.target.value })}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Period To *</label>
              <input
                type="date"
                value={period.to}
                max={todayStr()}
                onChange={(e) => setPeriod({ ...period, to: e.target.value })}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300"
                required
              />
            </div>
          </div>
          <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100 text-[11px] text-slate-500">
            Members with collections in this period are rolled up into one entry each (liters, gross, deduction, net).
            Marking the batch paid triggers payouts to each member's linked bank account.
          </div>
          <button
            type="submit"
            disabled={generating}
            className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white font-bold text-xs shadow-md"
          >
            {generating ? 'Generating…' : 'Generate Batch'}
          </button>
        </form>
      </ModalSheet>

      {/* Review entries modal (freshly generated batch) */}
      <ModalSheet
        isOpen={Boolean(generated)}
        onClose={() => setGenerated(null)}
        title={generated ? `Batch ${strOf(generated.id)} — entries` : undefined}
        description={
          generated
            ? `${formatDate(strOf(generated.periodFrom))} → ${formatDate(strOf(generated.periodTo))} • Net ${formatCurrency(numOf(generated.totalNet))}`
            : undefined
        }
        maxWidth="2xl"
      >
        {generatedEntries.length === 0 ? (
          <p className="text-xs text-slate-400">No member entries in this period.</p>
        ) : (
          <div className="border border-slate-100 rounded-2xl overflow-hidden">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="bg-slate-50 text-slate-500 font-bold uppercase text-[10px] border-b border-slate-100">
                  <th className="py-2.5 px-4">Member</th>
                  <th className="py-2.5 px-3">Liters</th>
                  <th className="py-2.5 px-3">Gross</th>
                  <th className="py-2.5 px-3">Deduction</th>
                  <th className="py-2.5 px-3 text-right">Net</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {generatedEntries.map((en) => (
                  <tr key={strOf(en.id)}>
                    <td className="py-2.5 px-4 font-bold text-slate-800">{nameOf(en)}</td>
                    <td className="py-2.5 px-3 text-slate-600">{numOf(en.liters).toFixed(1)} L</td>
                    <td className="py-2.5 px-3 text-slate-600">{formatCurrency(numOf(en.amount))}</td>
                    <td className="py-2.5 px-3 text-slate-600">{formatCurrency(numOf(en.deduction))}</td>
                    <td className="py-2.5 px-3 text-right font-bold text-emerald-800">
                      {formatCurrency(numOf(en.netAmount))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <button
          onClick={() => {
            openMarkPaid(generated!);
            setGenerated(null);
          }}
          className="mt-4 w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs"
        >
          Mark This Batch Paid
        </button>
      </ModalSheet>

      {/* Mark paid modal */}
      <ModalSheet
        isOpen={Boolean(reviewBatch)}
        onClose={() => setReviewBatch(null)}
        title={reviewBatch ? `Mark ${strOf(reviewBatch.id)} as paid` : undefined}
        description={
          reviewBatch
            ? `Net payout ${formatCurrency(numOf(reviewBatch.totalNet))} — payouts are triggered for each member entry`
            : undefined
        }
        maxWidth="sm"
      >
        <form onSubmit={handleMarkPaid} className="space-y-4">
          {reviewEntries.length > 0 && (
            <div className="max-h-48 overflow-y-auto border border-slate-100 rounded-2xl divide-y divide-slate-50">
              {reviewEntries.map((en) => (
                <div key={strOf(en.id)} className="px-4 py-2 flex justify-between text-xs">
                  <span className="font-bold text-slate-700">{nameOf(en)}</span>
                  <span className="text-emerald-800 font-bold">{formatCurrency(numOf(en.netAmount))}</span>
                </div>
              ))}
            </div>
          )}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">UTR / Payout Reference (optional)</label>
            <input
              type="text"
              value={utr}
              onChange={(e) => setUtr(e.target.value)}
              placeholder="e.g. UTR-UTIB000012345"
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300"
            />
          </div>
          <button
            type="submit"
            disabled={marking}
            className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white font-bold text-xs shadow-md"
          >
            {marking ? 'Processing payouts…' : 'Confirm & Mark Paid'}
          </button>
        </form>
      </ModalSheet>
    </div>
  );
};

export default DairyPaymentsPage;
