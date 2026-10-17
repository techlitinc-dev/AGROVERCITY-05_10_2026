import React, { useEffect, useState } from 'react';
import { ReceiptIndianRupee, Search, AlertCircle, Download } from 'lucide-react';
import { livestock, apiErrorMessage } from '../../lib/api';
import { StatusBadge } from '../../components/common/StatusBadge';
import { formatCurrency, formatDate } from '../../lib/utils';
import { nameOf, numOf, recArr, strOf } from './helpers';

export const ReceiptsRegister: React.FC = () => {
  const [receipts, setReceipts] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [kindFilter, setKindFilter] = useState('');

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        setReceipts(recArr(await livestock.gaushala.receipts()));
      } catch (e) {
        setError(apiErrorMessage(e));
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const filtered = receipts.filter((r) => {
    if (kindFilter && strOf(r.kind) !== kindFilter) return false;
    if (query) {
      const q = query.toLowerCase();
      return (
        nameOf(r).toLowerCase().includes(q) ||
        strOf(r.certificateNumber).toLowerCase().includes(q) ||
        strOf(r.id).toLowerCase().includes(q)
      );
    }
    return true;
  });

  const totalFiltered = filtered.reduce((acc, r) => acc + numOf(r.amountInr ?? r.amount), 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 flex items-center gap-2">
            <ReceiptIndianRupee className="w-7 h-7 text-emerald-600" />
            80G Receipts Register
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Immutable tax receipts issued against verified adoption & donation payments
          </p>
        </div>
        <div className="flex items-center gap-2 self-start sm:self-auto">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search donor / receipt no."
              className="pl-8 pr-3 py-1.5 text-xs rounded-xl border border-slate-300 bg-white w-56"
            />
          </div>
          <select
            value={kindFilter}
            onChange={(e) => setKindFilter(e.target.value)}
            className="px-3 py-1.5 text-xs rounded-xl border border-slate-300 bg-white"
          >
            <option value="">All kinds</option>
            <option value="adoption">Adoption</option>
            <option value="donation">Donation</option>
          </select>
        </div>
      </div>

      {error && (
        <div className="p-3 rounded-2xl bg-rose-50 border border-rose-200 text-xs font-bold text-rose-700 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" /> {error}
        </div>
      )}

      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <span className="text-xs font-bold text-slate-500">
            {filtered.length} receipts • {formatCurrency(totalFiltered)} total
          </span>
        </div>
        {loading ? (
          <p className="p-6 text-xs text-slate-400">Loading receipts…</p>
        ) : filtered.length === 0 ? (
          <p className="p-6 text-xs text-slate-400">
            {receipts.length === 0 ? 'No receipts issued yet — they are generated when you approve/acknowledge a verified payment.' : 'No receipts match the filter.'}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 text-slate-500 font-bold uppercase text-[10px] tracking-wider border-b border-slate-100">
                  <th className="py-3 px-5">Receipt No.</th>
                  <th className="py-3 px-3">Kind</th>
                  <th className="py-3 px-3">Donor</th>
                  <th className="py-3 px-3">Amount</th>
                  <th className="py-3 px-3">Issued</th>
                  <th className="py-3 px-3">Status</th>
                  <th className="py-3 px-5 text-right">PDF</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((r) => (
                  <tr key={strOf(r.id)} className="hover:bg-slate-50/60">
                    <td className="py-3 px-5 font-mono font-bold text-slate-900">
                      {strOf(r.certificateNumber) || strOf(r.id)}
                    </td>
                    <td className="py-3 px-3 capitalize text-slate-600">{strOf(r.kind, 'donation')}</td>
                    <td className="py-3 px-3 font-bold text-slate-700">{nameOf(r)}</td>
                    <td className="py-3 px-3 font-black text-emerald-800">
                      {formatCurrency(numOf(r.amountInr ?? r.amount))}
                    </td>
                    <td className="py-3 px-3 text-slate-600">{formatDate(strOf(r.issuedAt ?? r.createdAt))}</td>
                    <td className="py-3 px-3">
                      <StatusBadge status={strOf(r.status, 'issued')} />
                    </td>
                    <td className="py-3 px-5 text-right">
                      {strOf(r.certificateUrl) ? (
                        <a
                          href={strOf(r.certificateUrl)}
                          target="_blank"
                          rel="noreferrer"
                          className="p-1.5 rounded-lg text-sky-600 hover:bg-sky-50 inline-flex"
                          title="Download certificate PDF"
                        >
                          <Download className="w-4 h-4" />
                        </a>
                      ) : (
                        <span className="text-[10px] text-slate-300">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default ReceiptsRegister;
