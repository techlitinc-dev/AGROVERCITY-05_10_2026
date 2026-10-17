import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Users, Plus, Trash2, RefreshCw } from 'lucide-react';
import { insurance, apiErrorMessage, del } from '../../lib/api';
import { formatDate } from '../../lib/utils';
import { str, num, arr, type Row } from './loanTypes';

/**
 * Surveyor roster — provider-scoped field assessors.
 *
 * NOTE: `insurance.removeSurveyor` in lib/api issues a POST but the backend
 * route is DELETE, so removal here calls the exported `del` helper directly.
 */
export const SurveyorRosterView: React.FC = () => {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [districts, setDistricts] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setRows(arr((await insurance.surveyors()) as unknown) as Row[]);
    } catch (e) {
      setError(apiErrorMessage(e));
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await insurance.addSurveyor({
        name: name.trim(),
        phone: phone.trim(),
        districts: districts.split(',').map((d) => d.trim()).filter(Boolean),
      });
      setNotice(`${name.trim()} added to the roster.`);
      setName('');
      setPhone('');
      setDistricts('');
      await load();
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const remove = async (s: Row) => {
    const id = str(s.id);
    if (!id) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await del(`/insurance/provider/surveyors/${id}`);
      setNotice(`${str(s.name)} removed from the roster.`);
      await load();
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="border-b border-slate-200 pb-4">
        <Link to="/insuranceProvider" className="inline-flex items-center gap-1 text-xs font-bold text-slate-500 hover:text-emerald-600 mb-2">
          <ArrowLeft className="w-4 h-4" /> Back to claims desk
        </Link>
        <h1 className="text-2xl font-extrabold text-slate-900 flex items-center gap-2">
          <Users className="w-7 h-7 text-emerald-600" />
          Field Surveyor Roster
        </h1>
        <p className="text-xs text-slate-500 mt-1">
          Village-level loss assessors assigned to claims from the claim case file
        </p>
      </div>

      {error && (
        <div className="bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold rounded-2xl px-4 py-3">{error}</div>
      )}
      {notice && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-semibold rounded-2xl px-4 py-3">{notice}</div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <form onSubmit={add} className="bg-white rounded-3xl border border-slate-200/80 shadow-xs p-5 space-y-3 h-fit">
          <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
            <Plus className="w-4 h-4 text-emerald-600" /> Add Surveyor
          </h3>
          <label className="block text-[10px] font-bold text-slate-500 uppercase">
            Name
            <input value={name} onChange={(e) => setName(e.target.value)} required
              className="mt-1 w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-200" />
          </label>
          <label className="block text-[10px] font-bold text-slate-500 uppercase">
            Phone
            <input value={phone} onChange={(e) => setPhone(e.target.value)} required placeholder="10-digit mobile"
              className="mt-1 w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-200" />
          </label>
          <label className="block text-[10px] font-bold text-slate-500 uppercase">
            Districts (comma separated)
            <input value={districts} onChange={(e) => setDistricts(e.target.value)} placeholder="Nashik, Dhule"
              className="mt-1 w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-200" />
          </label>
          <button type="submit" disabled={busy}
            className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white font-bold text-sm rounded-xl">
            {busy ? 'Adding…' : 'Add to Roster'}
          </button>
        </form>

        <div className="lg:col-span-2 bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between">
            <h3 className="font-bold text-sm text-slate-900">Roster ({rows.length})</h3>
            <button onClick={load} className="p-1.5 text-slate-400 hover:text-emerald-600 rounded-xl hover:bg-slate-100" title="Refresh">
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
          <div className="divide-y divide-slate-100">
            {rows.map((s) => (
              <div key={str(s.id)} className="px-4 py-3.5 flex items-center justify-between gap-3 flex-wrap">
                <div>
                  <span className="text-sm font-bold text-slate-900">{str(s.name)}</span>
                  <span className="text-xs text-slate-500 font-mono ml-2">{str(s.phone)}</span>
                  <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                    {arr(s.districts).length === 0 ? (
                      <span className="text-[10px] font-bold text-slate-400 uppercase">All districts</span>
                    ) : (
                      arr(s.districts).map((d) => (
                        <span key={str(d)} className="text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-100 px-2 py-0.5 rounded-full">
                          {str(d)}
                        </span>
                      ))
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-[10px] text-slate-400 font-semibold">Joined {formatDate(str(s.createdAt))}</span>
                  <button
                    onClick={() => remove(s)}
                    disabled={busy}
                    className="inline-flex items-center gap-1 px-3 py-1.5 bg-white border border-rose-200 text-rose-600 hover:bg-rose-50 font-bold text-[11px] rounded-xl disabled:opacity-60"
                  >
                    <Trash2 className="w-3.5 h-3.5" /> Remove
                  </button>
                </div>
              </div>
            ))}
            {rows.length === 0 && !loading && (
              <p className="py-10 text-center text-slate-400 font-semibold text-xs">No surveyors on the roster yet.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
