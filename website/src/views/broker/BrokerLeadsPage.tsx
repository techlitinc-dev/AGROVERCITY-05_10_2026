import React, { useCallback, useEffect, useState } from 'react';
import {
  Users,
  Plus,
  RefreshCcw,
  Phone,
  MapPin,
  Trash2,
  ArrowLeft,
  ShieldCheck,
  ClipboardList,
  ArrowRightLeft,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { broker, apiErrorMessage } from '../../lib/api';
import { ModalSheet } from '../../components/common/ModalSheet';
import { StatusBadge } from '../../components/common/StatusBadge';
import { formatCurrency, formatWeight, formatDate } from '../../lib/utils';
import {
  arr,
  cardCls,
  EmptyState,
  ErrorBanner,
  ghostBtnCls,
  inputCls,
  labelCls,
  LoadingBlock,
  num,
  primaryBtnCls,
  rec,
  str,
  type Rec,
} from './shared';

const LEAD_STATUSES = ['active', 'contacted', 'negotiating', 'converted', 'dead'] as const;

const STATUS_TONE: Record<string, string> = {
  active: 'bg-sky-50 text-sky-700 border-sky-200',
  contacted: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  negotiating: 'bg-amber-50 text-amber-700 border-amber-200',
  converted: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  dead: 'bg-slate-100 text-slate-500 border-slate-200',
};

/**
 * Broker lead CRM — pipeline of farmer/buyer contacts, status movement
 * (active → contacted → negotiating → converted/dead) and the wholesale
 * buyer-requirements board with one-tap response.
 */
export const BrokerLeadsPage: React.FC = () => {
  const [leads, setLeads] = useState<Rec[]>([]);
  const [requirements, setRequirements] = useState<Rec[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [ld, req] = await Promise.all([
        broker.leads().catch(() => [] as unknown[]),
        broker.buyerRequirements().catch(() => [] as unknown[]),
      ]);
      setLeads((ld as unknown[]).map(rec));
      setRequirements((req as unknown[]).map(rec));
    } catch (e) {
      setError(apiErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const act = useCallback(
    async (fn: () => Promise<unknown>, successMsg?: string) => {
      setActionError(null);
      setNotice(null);
      try {
        await fn();
        if (successMsg) setNotice(successMsg);
        await load();
      } catch (err) {
        setActionError(apiErrorMessage(err));
      }
    },
    [load]
  );

  // --- create / edit lead form ---
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState<Rec | null>(null);
  const [name, setName] = useState('');
  const [type, setType] = useState<'farmer' | 'buyer'>('farmer');
  const [phone, setPhone] = useState('');
  const [commodity, setCommodity] = useState('');
  const [quantity, setQuantity] = useState(0);
  const [targetRate, setTargetRate] = useState(0);
  const [location, setLocation] = useState('');
  const [notes, setNotes] = useState('');

  const openCreate = () => {
    setEditing(null);
    setName('');
    setType('farmer');
    setPhone('');
    setCommodity('');
    setQuantity(0);
    setTargetRate(0);
    setLocation('');
    setNotes('');
    setModal(true);
  };

  const openEdit = (l: Rec) => {
    setEditing(l);
    setName(str(l.name));
    setType(str(l.type, 'farmer') === 'buyer' ? 'buyer' : 'farmer');
    setPhone(str(l.phone));
    setCommodity(str(l.commodity));
    setQuantity(num(l.quantityExpected));
    setTargetRate(num(l.targetRate));
    setLocation(str(l.location));
    setNotes(str(l.notes));
    setModal(true);
  };

  const saveLead = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload: Record<string, unknown> = {
      name,
      type,
      phone,
      commodity,
      quantityExpected: quantity,
      targetRate,
      location,
      notes,
    };
    if (editing) {
      await act(() => broker.updateLead(str(editing.id), payload), 'Lead updated');
    } else {
      await act(() => broker.createLead(payload), 'Lead added to CRM');
    }
    setModal(false);
  };

  const moveStatus = async (lead: Rec, status: string) => {
    await act(() => broker.updateLead(str(lead.id), { status }), `Lead marked ${status}`);
  };

  const removeLead = async (lead: Rec) => {
    await act(() => broker.deleteLead(str(lead.id)), 'Lead removed');
  };

  const respondRequirement = async (req: Rec) => {
    const rName = str(rec(req.buyer ?? req).name ?? req.buyerName, 'Buyer');
    await act(
      () =>
        broker.respondBuyerRequirement(str(req.id), {
          note: `Broker response — I can source ${str(req.commodity)} at your target`,
        }),
      `Responded to ${rName}'s requirement — check CRM for the pre-filled buyer lead`
    );
  };

  const counts = LEAD_STATUSES.map((s) => ({
    status: s,
    count: leads.filter((l) => str(l.status, 'active') === s).length,
  }));
  const visibleLeads = statusFilter ? leads.filter((l) => str(l.status, 'active') === statusFilter) : leads;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div className="flex items-center gap-3">
          <Link to="/broker" className={ghostBtnCls}>
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <h1 className="text-2xl font-extrabold text-slate-900 flex items-center gap-2">
              <Users className="w-7 h-7 text-emerald-600" />
              Lead CRM
            </h1>
            <p className="text-xs text-slate-500 mt-1">
              Farmer & buyer contacts — track the pipeline from first namaste to converted deal
            </p>
          </div>
        </div>
        <div className="flex gap-2 self-start sm:self-auto">
          <button onClick={() => void load()} className={ghostBtnCls}>
            <RefreshCcw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button onClick={() => openCreate()} className={primaryBtnCls}>
            <Plus className="w-4 h-4 inline mr-1" /> Add Lead
          </button>
        </div>
      </div>

      <ErrorBanner message={error ?? actionError} />
      {notice && (
        <div className="p-3 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center gap-2">
          <ShieldCheck className="w-4 h-4" /> {notice}
        </div>
      )}

      {/* pipeline summary */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {counts.map((c) => (
          <button
            key={c.status}
            onClick={() => setStatusFilter(statusFilter === c.status ? '' : c.status)}
            className={`${cardCls} p-3 text-left border transition-all ${
              statusFilter === c.status ? 'border-emerald-400 ring-2 ring-emerald-500/20' : 'hover:border-emerald-200'
            }`}
          >
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{c.status}</span>
            <span className="block text-xl font-black text-slate-900 mt-0.5">{c.count}</span>
          </button>
        ))}
      </div>

      {loading ? (
        <LoadingBlock />
      ) : (
        <>
          <div className={`${cardCls} overflow-hidden`}>
            <div className="p-4 border-b border-slate-100 flex items-center justify-between">
              <h3 className="font-bold text-sm text-slate-900">My Leads ({visibleLeads.length}{statusFilter ? ` of ${leads.length}` : ""})</h3>
              {statusFilter && (
                <button onClick={() => setStatusFilter('')} className="text-xs font-bold text-emerald-700 hover:underline">
                  Clear filter
                </button>
              )}
            </div>
            {visibleLeads.length === 0 ? (
              <EmptyState label="No leads in this bucket — add your first contact" />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-50 text-slate-500 font-bold uppercase text-[10px] tracking-wider border-b border-slate-100">
                      <th className="py-3 px-5">Contact</th>
                      <th className="py-3 px-3">Type</th>
                      <th className="py-3 px-3">Requirement</th>
                      <th className="py-3 px-3">Location</th>
                      <th className="py-3 px-3">Status</th>
                      <th className="py-3 px-5 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {visibleLeads.map((l) => {
                      const status = str(l.status, 'active');
                      const next = LEAD_STATUSES[LEAD_STATUSES.indexOf(status as (typeof LEAD_STATUSES)[number]) + 1];
                      return (
                        <tr key={str(l.id)} className="hover:bg-slate-50/60">
                          <td className="py-3 px-5">
                            <span className="font-bold text-slate-900">{str(l.name) || 'Unnamed'}</span>
                            {str(l.phone) && (
                              <span className="text-[10px] text-slate-400 block font-normal flex items-center gap-1">
                                <Phone className="w-3 h-3" /> {str(l.phone)}
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-3">
                            <span
                              className={`px-2 py-0.5 rounded-full border text-[10px] font-bold capitalize ${
                                str(l.type) === 'buyer'
                                  ? 'bg-violet-50 text-violet-700 border-violet-200'
                                  : 'bg-lime-50 text-lime-700 border-lime-200'
                              }`}
                            >
                              {str(l.type, 'farmer')}
                            </span>
                          </td>
                          <td className="py-3 px-3">
                            <span className="font-semibold text-slate-700">{str(l.commodity) || '—'}</span>
                            <span className="text-[10px] text-slate-400 block">
                              {num(l.quantityExpected) > 0 ? `${formatWeight(num(l.quantityExpected))} ` : ''}
                              {num(l.targetRate) > 0 ? `@ ${formatCurrency(num(l.targetRate))}/q` : ''}
                            </span>
                          </td>
                          <td className="py-3 px-3 text-slate-600">
                            {str(l.location) ? (
                              <span className="flex items-center gap-1">
                                <MapPin className="w-3 h-3 text-slate-400" /> {str(l.location)}
                              </span>
                            ) : (
                              '—'
                            )}
                          </td>
                          <td className="py-3 px-3">
                            <span className={`px-2 py-0.5 rounded-full border text-[10px] font-bold capitalize ${STATUS_TONE[status] ?? STATUS_TONE.active}`}>
                              {status}
                            </span>
                          </td>
                          <td className="py-3 px-5 text-right whitespace-nowrap space-x-1.5">
                            {next && ['active', 'contacted', 'negotiating'].includes(status) && (
                              <button onClick={() => void moveStatus(l, next)} className="text-[10px] font-bold text-emerald-700 hover:underline">
                                → {next}
                              </button>
                            )}
                            <button onClick={() => openEdit(l)} className="text-[10px] font-bold text-slate-500 hover:underline">
                              Edit
                            </button>
                            <button onClick={() => void removeLead(l)} className="text-rose-500 hover:text-rose-700 align-middle" title="Delete lead">
                              <Trash2 className="w-3.5 h-3.5 inline" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* buyer requirements board */}
          <div className={`${cardCls} overflow-hidden`}>
            <div className="p-4 border-b border-slate-100">
              <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
                <ClipboardList className="w-4 h-4 text-emerald-600" />
                Wholesale Buyer Requirements ({requirements.length})
              </h3>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Enterprises posting bulk needs — respond to pre-fill a buyer lead with the AI lead score attached
              </p>
            </div>
            {requirements.length === 0 ? (
              <EmptyState label="No open buyer requirements right now" />
            ) : (
              <div className="divide-y divide-slate-100">
                {requirements.map((r) => (
                  <div key={str(r.id)} className="p-4 flex flex-wrap items-center gap-3">
                    <div className="flex-1 min-w-48">
                      <span className="font-bold text-slate-900 text-xs">
                        {str(r.commodity) || 'Commodity'}
                        {str(r.variety) ? ` · ${str(r.variety)}` : ''}
                      </span>
                      <span className="text-[10px] text-slate-400 block">
                        {str(rec(r.buyer ?? r).name ?? r.buyerName, 'Buyer')} · {str(r.location ?? r.deliveryLocation)}
                        {num(r.aiScore) > 0 ? ` · AI score ${num(r.aiScore)}/100` : ''}
                      </span>
                    </div>
                    <div className="text-xs font-bold text-slate-700">
                      {formatWeight(num(r.quantity ?? r.quantityQuintals))}
                      <span className="text-[10px] text-slate-400 block font-normal">
                        {num(r.maxPrice ?? r.targetRate) > 0 ? `up to ${formatCurrency(num(r.maxPrice ?? r.targetRate))}/q` : 'rate negotiable'}
                      </span>
                    </div>
                    <div className="text-[10px] text-slate-500">
                      {str(r.neededBy) ? `by ${formatDate(str(r.neededBy))}` : ''}
                    </div>
                    <button onClick={() => void respondRequirement(r)} className={ghostBtnCls}>
                      <ArrowRightLeft className="w-3.5 h-3.5 inline mr-1" /> Respond
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      <ModalSheet isOpen={modal} onClose={() => setModal(false)} title={editing ? 'Edit Lead' : 'Add Lead'} description="Track farmers and buyers you meet at the mandi gate" maxWidth="lg">
        <form onSubmit={(e) => void saveLead(e)} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Name</label>
              <input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} required />
            </div>
            <div>
              <label className={labelCls}>Phone</label>
              <input className={inputCls} value={phone} onChange={(e) => setPhone(e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Type</label>
              <select className={inputCls} value={type} onChange={(e) => setType(e.target.value as 'farmer' | 'buyer')}>
                <option value="farmer">Farmer (seller side)</option>
                <option value="buyer">Buyer (enterprise side)</option>
              </select>
            </div>
            <div>
              <label className={labelCls}>Commodity</label>
              <input className={inputCls} value={commodity} onChange={(e) => setCommodity(e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className={labelCls}>Qty Expected (q)</label>
              <input type="number" className={inputCls} value={quantity} onChange={(e) => setQuantity(Number(e.target.value))} />
            </div>
            <div>
              <label className={labelCls}>Target Rate (₹/q)</label>
              <input type="number" className={inputCls} value={targetRate} onChange={(e) => setTargetRate(Number(e.target.value))} />
            </div>
            <div>
              <label className={labelCls}>Location</label>
              <input className={inputCls} value={location} onChange={(e) => setLocation(e.target.value)} />
            </div>
          </div>
          <div>
            <label className={labelCls}>Notes</label>
            <textarea rows={2} className={inputCls} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
          <ErrorBanner message={actionError} />
          <button type="submit" className={`${primaryBtnCls} w-full py-3`}>
            {editing ? 'Save Lead' : 'Add Lead'}
          </button>
        </form>
      </ModalSheet>
    </div>
  );
};
