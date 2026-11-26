import React, { useCallback, useEffect, useState } from 'react';
import {
  Megaphone,
  Plus,
  RefreshCw,
  Eye,
  MousePointer,
  CheckCircle2,
  Pause,
  Play,
  Trash2,
  Target,
} from 'lucide-react';
import { ads, apiErrorMessage, lots } from '../../lib/api';
import { ModalSheet } from '../../components/common/ModalSheet';
import { StatusBadge } from '../../components/common/StatusBadge';
import { formatCurrency } from '../../lib/utils';
import { asRecords, pickNum, pickStr } from './records';

interface CampaignRow {
  id: string;
  title: string;
  headline: string;
  description: string;
  bannerUrl: string;
  status: string;
  targetType: string;
  targetId: string;
  budgetRupees: number;
  impressions?: number;
  clicks?: number;
}

const inputCls =
  'w-full px-3 py-2.5 text-xs rounded-xl border border-slate-300 focus:outline-none focus:border-emerald-600';

/**
 * Universal Ads & Promotions hub — every persona manages its sponsored
 * campaigns here. Reads and writes the real /ads endpoints; empty states are
 * honest (no fabricated impressions or click counts).
 */
export const AdsPromotionsView: React.FC = () => {
  const [rows, setRows] = useState<CampaignRow[] | null>(null);
  const [myLots, setMyLots] = useState<{ id: string; label: string }[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const [fTitle, setFTitle] = useState('');
  const [fHeadline, setFHeadline] = useState('');
  const [fDesc, setFDesc] = useState('');
  const [fBanner, setFBanner] = useState('');
  const [fTargetType, setFTargetType] = useState<'lot' | 'external'>('lot');
  const [fTargetId, setFTargetId] = useState('');
  const [fBudget, setFBudget] = useState(500);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [mine, lotRows] = await Promise.all([
        ads.mine().catch(() => []),
        lots.list().catch(() => []),
      ]);
      setRows(
        asRecords(mine).map((a) => ({
          id: pickStr(a, 'id') || pickStr(a, 'adId'),
          title: pickStr(a, 'title'),
          headline: pickStr(a, 'headline'),
          description: pickStr(a, 'description'),
          bannerUrl: pickStr(a, 'bannerUrl'),
          status: pickStr(a, 'status') || 'active',
          targetType: pickStr(a, 'targetType'),
          targetId: pickStr(a, 'targetId'),
          budgetRupees: pickNum(a, 'budgetRupees'),
          impressions: pickNum(a, 'impressions'),
          clicks: pickNum(a, 'clicks'),
        }))
      );
      setMyLots(
        asRecords(lotRows).map((l) => ({
          id: pickStr(l, 'id'),
          label: `${pickStr(l, 'crop', 'Lot')} · ${pickNum(l, 'quantityQuintal')} q`,
        }))
      );
    } catch (e) {
      setError(apiErrorMessage(e));
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const openCreate = () => {
    setFTitle('');
    setFHeadline('');
    setFDesc('');
    setFBanner('');
    setFTargetType(myLots.length > 0 ? 'lot' : 'external');
    setFTargetId(myLots.length > 0 ? myLots[0].id : '');
    setFBudget(500);
    setModalOpen(true);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving) return;
    setSaving(true);
    setError(null);
    try {
      await ads.create({
        title: fTitle.trim(),
        headline: fHeadline.trim(),
        description: fDesc.trim(),
        bannerUrl: fBanner.trim(),
        targetType: fTargetType,
        targetId: fTargetType === 'lot' ? fTargetId : fTargetId.trim(),
        budgetRupees: fBudget,
      });
      setNotice(`Ad campaign "${fTitle.trim()}" launched.`);
      setModalOpen(false);
      await load();
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const togglePause = async (row: CampaignRow) => {
    if (busyId) return;
    setBusyId(row.id);
    setError(null);
    try {
      const paused = row.status === 'paused';
      await ads.update(row.id, { status: paused ? 'active' : 'paused' });
      setNotice(`Ad "${row.title}" ${paused ? 'resumed' : 'paused'}.`);
      await load();
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setBusyId(null);
    }
  };

  const removeCampaign = async (row: CampaignRow) => {
    if (busyId) return;
    if (!window.confirm(`Delete ad campaign "${row.title}"? This cannot be undone.`)) return;
    setBusyId(row.id);
    setError(null);
    try {
      await ads.remove(row.id);
      setNotice(`Ad campaign "${row.title}" deleted.`);
      await load();
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setBusyId(null);
    }
  };

  const live = rows?.filter((r) => r.status === 'active').length ?? 0;
  const totalImpressions = rows?.reduce((acc, r) => acc + (r.impressions ?? 0), 0) ?? 0;
  const totalClicks = rows?.reduce((acc, r) => acc + (r.clicks ?? 0), 0) ?? 0;

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <h1 className="text-2xl font-black text-slate-900 flex items-center gap-2.5">
            <Megaphone className="w-7 h-7 text-emerald-600" />
            Ads & Promotions
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => void load()}
            className="px-3 py-2 rounded-xl border border-slate-200 text-slate-600 hover:border-emerald-300 text-xs font-bold flex items-center gap-1.5"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Refresh
          </button>
          <button
            type="button"
            onClick={openCreate}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black rounded-xl shadow-md flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4" /> Create Campaign
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl text-xs font-semibold text-rose-800 flex items-center justify-between">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="text-rose-600 hover:underline">Dismiss</button>
        </div>
      )}

      {notice && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl text-xs font-semibold text-emerald-800 flex items-center justify-between">
          <span className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            {notice}
          </span>
          <button onClick={() => setNotice(null)} className="font-bold hover:underline">Dismiss</button>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-4 space-y-1">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Live Campaigns</span>
          <div className="text-2xl font-black text-slate-900">{rows === null ? '—' : live}</div>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-4 space-y-1">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Impressions</span>
          <div className="text-2xl font-black text-emerald-700 flex items-center gap-1.5">
            <Eye className="w-5 h-5 text-emerald-600" />
            {rows === null ? '—' : totalImpressions.toLocaleString()}
          </div>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-4 space-y-1">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Clicks</span>
          <div className="text-2xl font-black text-indigo-700 flex items-center gap-1.5">
            <MousePointer className="w-5 h-5 text-indigo-600" />
            {rows === null ? '—' : totalClicks}
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-5 space-y-4">
        <div className="border-b border-slate-100 pb-3 flex items-center justify-between">
          <h2 className="text-sm font-black text-slate-900 flex items-center gap-2">
            <Target className="w-4 h-4 text-emerald-600" />
            My Campaigns
          </h2>
          <span className="text-xs font-bold text-slate-400">{rows?.length ?? 0} total</span>
        </div>

        {rows === null ? (
          <div className="py-12 text-center text-xs font-bold text-slate-400 animate-pulse">
            Loading campaigns…
          </div>
        ) : rows.length === 0 ? (
          <div className="py-12 text-center space-y-3">
            <Megaphone className="w-10 h-10 text-slate-300 mx-auto" />
            <h3 className="text-sm font-bold text-slate-800">No campaigns yet</h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              Create your first promotion to reach buyers, transporters and the Agri Market audience.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {rows.map((row) => {
              const imps = row.impressions ?? 0;
              const clks = row.clicks ?? 0;
              const ctr = imps > 0 ? `${((clks / imps) * 100).toFixed(1)}%` : '—';
              return (
                <div key={row.id} className="py-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="flex items-start gap-4 min-w-0">
                    {row.bannerUrl && (
                      <div className="w-20 h-16 rounded-2xl overflow-hidden bg-slate-100 shrink-0 border border-slate-200">
                        <img
                          src={row.bannerUrl}
                          alt={row.title}
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            (e.target as HTMLElement).style.display = 'none';
                          }}
                        />
                      </div>
                    )}
                    <div className="space-y-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-black text-slate-900 truncate">{row.title}</h3>
                        <StatusBadge status={row.status} />
                      </div>
                      {row.headline && <p className="text-xs font-semibold text-emerald-800">{row.headline}</p>}
                      {row.description && <p className="text-[11px] text-slate-500 line-clamp-1">{row.description}</p>}
                      <p className="text-[10px] text-slate-400 font-bold uppercase">
                        {row.targetType}
                        {row.targetId ? ` #${row.targetId}` : ''} · budget {formatCurrency(row.budgetRupees)}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-5 text-xs md:text-right">
                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-400 block">Impressions</span>
                      <span className="font-extrabold text-slate-800">{imps.toLocaleString()}</span>
                    </div>
                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-400 block">Clicks</span>
                      <span className="font-extrabold text-emerald-700">{clks}</span>
                    </div>
                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-400 block">CTR</span>
                      <span className="font-black text-indigo-700">{ctr}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      {(row.status === 'active' || row.status === 'paused') && (
                        <button
                          type="button"
                          onClick={() => void togglePause(row)}
                          disabled={busyId !== null}
                          className="px-2.5 py-1.5 rounded-xl border border-slate-200 text-slate-600 hover:border-emerald-300 text-[10px] font-bold flex items-center gap-1 disabled:opacity-40"
                        >
                          {row.status === 'paused' ? (
                            <>
                              <Play className="w-3 h-3" /> Resume
                            </>
                          ) : (
                            <>
                              <Pause className="w-3 h-3" /> Pause
                            </>
                          )}
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => void removeCampaign(row)}
                        disabled={busyId !== null}
                        className="px-2.5 py-1.5 rounded-xl border border-rose-200 text-rose-700 hover:bg-rose-50 text-[10px] font-bold flex items-center gap-1 disabled:opacity-40"
                      >
                        <Trash2 className="w-3 h-3" /> Delete
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {modalOpen && (
        <ModalSheet
          title="Launch New Campaign"
          isOpen={modalOpen}
          onClose={() => setModalOpen(false)}
        >
          <form onSubmit={(e) => void handleCreate(e)} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Campaign Title *</label>
              <input type="text" required value={fTitle} onChange={(e) => setFTitle(e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Ad Headline *</label>
              <input type="text" required value={fHeadline} onChange={(e) => setFHeadline(e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Description</label>
              <textarea rows={2} value={fDesc} onChange={(e) => setFDesc(e.target.value)} className={inputCls} />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Promotion Target</label>
                <select
                  value={fTargetType}
                  onChange={(e) => {
                    const t = e.target.value as 'lot' | 'external';
                    setFTargetType(t);
                    setFTargetId(t === 'lot' && myLots.length > 0 ? myLots[0].id : '');
                  }}
                  className={inputCls}
                >
                  <option value="lot">My Produce Lot</option>
                  <option value="external">External Link / General Promotion</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  {fTargetType === 'lot' ? 'Linked Lot *' : 'Reference (optional)'}
                </label>
                {fTargetType === 'lot' ? (
                  <select value={fTargetId} onChange={(e) => setFTargetId(e.target.value)} className={inputCls} required>
                    {myLots.length === 0 && <option value="">No open lots — post a lot first</option>}
                    {myLots.map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.label}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    type="text"
                    value={fTargetId}
                    onChange={(e) => setFTargetId(e.target.value)}
                    className={inputCls}
                    placeholder="https:// or campaign reference"
                  />
                )}
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Banner Image URL</label>
                <input type="text" value={fBanner} onChange={(e) => setFBanner(e.target.value)} className={inputCls} />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Budget (₹) *</label>
                <input
                  type="number"
                  min={500}
                  step={500}
                  required
                  value={fBudget}
                  onChange={(e) => setFBudget(Number(e.target.value))}
                  className={inputCls}
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-3">
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 text-xs font-bold"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving || (fTargetType === 'lot' && myLots.length === 0)}
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white text-xs font-black rounded-xl"
              >
                {saving ? 'Publishing…' : 'Publish Campaign'}
              </button>
            </div>
          </form>
        </ModalSheet>
      )}
    </div>
  );
};
