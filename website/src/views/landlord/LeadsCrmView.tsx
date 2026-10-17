import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Check, Phone, RefreshCw, StickyNote, Trash2, Users, X } from 'lucide-react';
import { land, apiErrorMessage } from '../../lib/api';
import { ModalSheet } from '../../components/common/ModalSheet';
import { StatusBadge } from '../../components/common/StatusBadge';
import { formatCurrency } from '../../lib/utils';
import { asArr, asRec, firstNum, firstStr, fmtDate, str, type Rec } from './utils';

const LEAD_STATUSES = ['new', 'contacted', 'negotiating', 'converted', 'dropped'];

/** /landlord/leads — tenant-farmer leads with notes & status pipeline. */
export const LeadsCrmView: React.FC = () => {
  const [leads, setLeads] = useState<Rec[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [noteFor, setNoteFor] = useState<Rec | null>(null);
  const [noteText, setNoteText] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const l = await land.leads();
      setLeads(asArr(l).map(asRec));
    } catch (e) {
      setError(apiErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const flash = (msg: string) => {
    setNotice(msg);
    setTimeout(() => setNotice(null), 4000);
  };

  const setStatus = async (leadId: string, status: string) => {
    try {
      await land.setLeadStatus(leadId, status);
      flash(`Lead marked as "${status}".`);
      await load();
    } catch (e) {
      setError(apiErrorMessage(e));
    }
  };

  const addNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!noteFor) return;
    try {
      await land.addLeadNote(str(noteFor.id), noteText);
      setNoteText('');
      setNoteFor(null);
      flash('Note added.');
      await load();
    } catch (err) {
      setError(apiErrorMessage(err));
    }
  };

  const remove = async (lead: Rec) => {
    if (!window.confirm(`Remove lead "${firstStr(lead, ['name', 'farmerName'], 'this lead')}"?`)) return;
    try {
      await land.removeLead(str(lead.id));
      flash('Lead removed.');
      await load();
    } catch (err) {
      setError(apiErrorMessage(err));
    }
  };

  const notesOf = (lead: Rec): unknown[] => {
    const n = lead.notes;
    return Array.isArray(n) ? n : [];
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <Link to="/landlord" className="text-xs text-slate-400 hover:text-slate-600 flex items-center gap-1 mb-1">
            <ArrowLeft className="w-3.5 h-3.5" /> Landlord Home
          </Link>
          <h1 className="text-2xl font-extrabold text-slate-900 flex items-center gap-2">
            <Users className="w-7 h-7 text-emerald-600" />
            Leads CRM
          </h1>
          <p className="text-xs text-slate-500 mt-1">Track tenant-farmer interest, notes, and conversion pipeline</p>
        </div>
        <button
          onClick={load}
          className="p-2.5 rounded-2xl border border-slate-200 text-slate-500 hover:bg-slate-50 self-start sm:self-auto"
          title="Refresh"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {notice && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl text-xs font-bold text-emerald-900 flex items-center gap-2">
          <Check className="w-5 h-5 text-emerald-600" />
          <span>{notice}</span>
        </div>
      )}
      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl text-xs font-bold text-rose-800 flex items-center justify-between gap-2">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="p-1 hover:bg-rose-100 rounded-full">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Pipeline summary */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {LEAD_STATUSES.map((s) => (
          <div key={s} className="bg-white rounded-2xl border border-slate-200/80 p-4 text-center shadow-xs">
            <p className="text-2xl font-black text-slate-900">{leads.filter((l) => str(l.status, 'new') === s).length}</p>
            <p className="text-[10px] uppercase font-bold text-slate-400 capitalize">{s}</p>
          </div>
        ))}
      </div>

      {leads.length === 0 && !loading ? (
        <div className="p-10 bg-white rounded-3xl border border-dashed border-slate-300 text-center space-y-2">
          <p className="text-sm font-bold text-slate-700">No leads yet</p>
          <p className="text-xs text-slate-500">Farmers who shortlist or enquire about your listings will appear here.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {leads.map((lead) => {
            const id = str(lead.id);
            const status = str(lead.status, 'new');
            return (
              <div key={id || JSON.stringify(lead).slice(0, 24)} className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
                  <div>
                    <h4 className="font-bold text-sm text-slate-900">
                      {firstStr(lead, ['name', 'farmerName', 'tenantName'], 'Lead')}
                    </h4>
                    <p className="text-xs text-slate-400 flex items-center gap-1 mt-0.5">
                      <Phone className="w-3 h-3" />
                      {firstStr(lead, ['phone', 'farmerPhone', 'contact'], '—')} • {firstStr(lead, ['listingTitle', 'source'], 'Listing enquiry')} • {fmtDate(lead.createdAt)}
                    </p>
                  </div>
                  <StatusBadge status={status} />
                </div>

                <div className="flex flex-wrap gap-3 text-xs">
                  {firstNum(lead, ['offeredRent', 'budget', 'annualRent'], 0) > 0 && (
                    <span className="px-3 py-1.5 bg-emerald-50 text-emerald-800 rounded-xl border border-emerald-100 font-bold">
                      Budget: {formatCurrency(firstNum(lead, ['offeredRent', 'budget', 'annualRent']))}/yr
                    </span>
                  )}
                  {firstNum(lead, ['desiredAcres', 'acres'], 0) > 0 && (
                    <span className="px-3 py-1.5 bg-sky-50 text-sky-800 rounded-xl border border-sky-100 font-bold">
                      Seeking: {firstNum(lead, ['desiredAcres', 'acres'])} acres
                    </span>
                  )}
                </div>

                {notesOf(lead).length > 0 && (
                  <div className="space-y-1.5">
                    {notesOf(lead).map((n, i) => (
                      <p key={i} className="text-xs text-slate-600 bg-slate-50 rounded-xl px-3 py-2 border border-slate-100 italic">
                        "{typeof n === 'string' ? n : firstStr(asRec(n), ['note', 'text'], JSON.stringify(n))}"
                      </p>
                    ))}
                  </div>
                )}

                <div className="flex flex-wrap justify-end gap-2 pt-1">
                  <select
                    value={LEAD_STATUSES.includes(status) ? status : 'new'}
                    onChange={(e) => setStatus(id, e.target.value)}
                    className="px-3 py-2 rounded-xl border border-slate-200 text-xs font-bold bg-white text-slate-700"
                  >
                    {LEAD_STATUSES.map((s) => (
                      <option key={s} value={s} className="capitalize">{s}</option>
                    ))}
                  </select>
                  <button
                    onClick={() => {
                      setNoteFor(lead);
                      setNoteText('');
                    }}
                    className="px-3 py-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold text-xs flex items-center gap-1"
                  >
                    <StickyNote className="w-3.5 h-3.5" /> Add Note
                  </button>
                  <button
                    onClick={() => remove(lead)}
                    className="px-3 py-2 rounded-xl border border-rose-200 text-rose-700 hover:bg-rose-50 font-bold text-xs flex items-center gap-1"
                  >
                    <Trash2 className="w-3.5 h-3.5" /> Remove
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Note Modal */}
      <ModalSheet
        isOpen={!!noteFor}
        onClose={() => setNoteFor(null)}
        title="Add Note"
        description={noteFor ? `for ${firstStr(noteFor, ['name', 'farmerName'], 'lead')}` : undefined}
        maxWidth="sm"
      >
        <form onSubmit={addNote} className="space-y-3">
          <textarea
            value={noteText}
            onChange={(e) => setNoteText(e.target.value)}
            rows={3}
            className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300"
            placeholder="Called — wants drip-ready plot, will visit Saturday…"
            required
            autoFocus
          />
          <button type="submit" className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs">
            Save Note
          </button>
        </form>
      </ModalSheet>
    </div>
  );
};
