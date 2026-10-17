import React, { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  PackageOpen,
  Search,
  RefreshCw,
  ArrowRight,
} from 'lucide-react';
import { postHarvest, apiErrorMessage } from '../../../lib/api';
import { StatusBadge } from '../../../components/common/StatusBadge';
import { formatDate } from '../../../lib/utils';
import { str, num, arr, type Row, type BookingRow, bookingId, BOOKING_STATUSES } from './types';

/** Bookings queue — filter by status, search, drill into the gate ledger. */
export const BookingsQueueView: React.FC = () => {
  const navigate = useNavigate();
  const [rows, setRows] = useState<BookingRow[]>([]);
  const [total, setTotal] = useState(0);
  const [status, setStatus] = useState('pending');
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (st: string, q: string) => {
    setLoading(true);
    setError(null);
    try {
      const params: Record<string, unknown> = { pageSize: 100 };
      if (st && st !== 'all') params.status = st;
      if (q) params.q = q;
      const res = (await postHarvest.provider.bookings(params)) as unknown as Row;
      const data = arr(res?.data ?? res) as BookingRow[];
      setRows(data);
      setTotal(num(res?.total, data.length));
    } catch (e) {
      setError(apiErrorMessage(e));
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(status, search);
  }, [load, status, search]);

  return (
    <div className="space-y-6">
      <div className="border-b border-slate-200 pb-4">
        <Link to="/coldStorageProvider" className="inline-flex items-center gap-1 text-xs font-bold text-slate-500 hover:text-emerald-600 mb-2">
          <ArrowLeft className="w-4 h-4" /> Back to console
        </Link>
        <h1 className="text-2xl font-extrabold text-slate-900 flex items-center gap-2">
          <PackageOpen className="w-7 h-7 text-emerald-600" />
          Storage Bookings Queue
        </h1>
        <p className="text-xs text-slate-500 mt-1">
          Review farmer reservations, approve allocations, and track inward / release progress
        </p>
      </div>

      {error && (
        <div className="bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold rounded-2xl px-4 py-3">{error}</div>
      )}

      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between gap-3 flex-wrap">
          <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
            Bookings <span className="text-[10px] font-bold text-slate-400">({total})</span>
          </h3>
          <div className="flex items-center gap-2 flex-wrap">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                setSearch(searchInput.trim());
              }}
              className="flex items-center gap-2"
            >
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  placeholder="Farmer, crop, facility, e-NWR"
                  className="pl-8 pr-3 py-1.5 text-xs border border-slate-200 rounded-xl w-56 focus:outline-none focus:ring-2 focus:ring-emerald-200"
                />
              </div>
              <button type="submit" className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl">
                Search
              </button>
            </form>
            <button onClick={() => load(status, search)} className="p-1.5 text-slate-400 hover:text-emerald-600 rounded-xl hover:bg-slate-100" title="Refresh">
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        <div className="px-4 pt-3 flex items-center gap-1.5 flex-wrap">
          <button
            onClick={() => setStatus('all')}
            className={`px-3 py-1 rounded-full text-[11px] font-bold border transition-colors ${
              status === 'all' ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white text-slate-500 border-slate-200 hover:border-emerald-300'
            }`}
          >
            All
          </button>
          {BOOKING_STATUSES.map((f) => (
            <button
              key={f.value}
              onClick={() => setStatus(f.value)}
              className={`px-3 py-1 rounded-full text-[11px] font-bold border transition-colors ${
                status === f.value ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white text-slate-500 border-slate-200 hover:border-emerald-300'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        <div className="overflow-x-auto mt-2">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50 text-slate-500 font-bold uppercase text-[10px] tracking-wider border-b border-slate-100">
                <th className="py-3 px-6">Farmer & Crop</th>
                <th className="py-3 px-4">Quantity</th>
                <th className="py-3 px-4">Facility</th>
                <th className="py-3 px-4">Booked On</th>
                <th className="py-3 px-4">e-NWR / Gate Pass</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-6 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((b) => {
                const id = bookingId(b);
                return (
                  <tr key={id} className="hover:bg-slate-50/60">
                    <td className="py-3.5 px-6 font-bold text-slate-900">
                      {str(b.farmerName, 'Farmer')}
                      <span className="text-[10px] text-slate-400 block font-mono font-normal">
                        {id}{b.farmerPhone ? ` · ${str(b.farmerPhone)}` : ''}
                      </span>
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="font-black text-slate-900">{num(b.inwardNetQuintals ?? b.quantityQuintals)} q</span>
                      <span className="text-[11px] text-slate-500 block">{str(b.cropName)}{b.variety ? ` · ${str(b.variety)}` : ''}</span>
                    </td>
                    <td className="py-3.5 px-4 font-medium text-slate-600">{str(b.facilityName, '—')}</td>
                    <td className="py-3.5 px-4 font-medium text-slate-600">{formatDate(str(b.bookedAt ?? b.expectedDate))}</td>
                    <td className="py-3.5 px-4 font-mono text-[10px] text-slate-500">
                      {str(b.receiptNumber, '—')}
                      {b.gatePassNumber && <span className="block">{str(b.gatePassNumber)}</span>}
                    </td>
                    <td className="py-3.5 px-4">
                      <StatusBadge status={str(b.status, 'pending')} />
                      {str(b.paymentStatus) && (
                        <span className="block text-[10px] font-bold text-slate-400 mt-0.5 capitalize">{str(b.paymentStatus).replace(/_/g, ' ')}</span>
                      )}
                    </td>
                    <td className="py-3.5 px-6 text-right">
                      <button
                        onClick={() => navigate(`/coldStorageProvider/bookings/${encodeURIComponent(id)}`)}
                        className="inline-flex items-center gap-1 px-3.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl shadow-xs"
                      >
                        Open <ArrowRight className="w-3 h-3" />
                      </button>
                    </td>
                  </tr>
                );
              })}
              {!loading && rows.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-10 text-center text-slate-400 font-semibold">
                    No bookings match this filter.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
