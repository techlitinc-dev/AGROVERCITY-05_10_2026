import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeft,
  BarChart3,
  Check,
  Eye,
  Megaphone,
  MousePointerClick,
  Pause,
  Pencil,
  Play,
  Plus,
  RefreshCw,
  Trash2,
  Wallet,
  X,
} from 'lucide-react';
import { ads, transport, uploads, apiErrorMessage } from '../../lib/api';
import { StatusBadge } from '../../components/common/StatusBadge';
import { ModalSheet } from '../../components/common/ModalSheet';
import { formatCurrency } from '../../lib/utils';
import { asArr, asRec, firstNum, firstStr, fmtDate, str, type Rec } from './utils';

const PLACEMENTS = ['home_hero', 'course_banner', 'sidebar_card', 'store_spotlight'];
const TARGET_TYPES = ['course', 'workshop', 'external', 'vehicle'];

interface AdForm {
  title: string;
  headline: string;
  description: string;
  bannerUrl: string;
  ctaText: string;
  placement: string;
  targetType: string;
  targetId: string;
  budgetRupees: number;
  dailyBudgetRupees: number;
  startDate: string;
  endDate: string;
}

const EMPTY_AD: AdForm = {
  title: '',
  headline: '',
  description: '',
  bannerUrl: '',
  ctaText: 'Book Now',
  placement: 'sidebar_card',
  targetType: 'external',
  targetId: '',
  budgetRupees: 1000,
  dailyBudgetRupees: 100,
  startDate: '',
  endDate: '',
};

/** /transporter/ads — my sponsored advertisements with per-ad analytics. */
export const TransporterAdsView: React.FC = () => {
  const [myAds, setMyAds] = useState<Rec[]>([]);
  const [myVehicles, setMyVehicles] = useState<Rec[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [adModal, setAdModal] = useState(false);
  const [editingAd, setEditingAd] = useState<Rec | null>(null);
  const [adForm, setAdForm] = useState<AdForm>(EMPTY_AD);
  const [bannerBusy, setBannerBusy] = useState(false);
  const [analyticsFor, setAnalyticsFor] = useState<Rec | null>(null);
  const [analytics, setAnalytics] = useState<Rec | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [rows, vehicles] = await Promise.all([
        ads.mine(),
        transport.myVehicles().catch(() => [] as unknown[]),
      ]);
      setMyAds(asArr(rows).map(asRec));
      setMyVehicles(asArr(vehicles).map(asRec));
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

  const openCreate = () => {
    setEditingAd(null);
    setAdForm(EMPTY_AD);
    setAdModal(true);
  };

  const openEdit = (a: Rec) => {
    setEditingAd(a);
    setAdForm({
      title: firstStr(a, ['title'], ''),
      headline: firstStr(a, ['headline'], ''),
      description: firstStr(a, ['description'], ''),
      bannerUrl: firstStr(a, ['bannerUrl'], ''),
      ctaText: firstStr(a, ['ctaText'], 'Book Now'),
      placement: firstStr(a, ['placement'], 'sidebar_card'),
      targetType: firstStr(a, ['targetType'], 'external'),
      targetId: firstStr(a, ['targetId'], ''),
      budgetRupees: firstNum(a, ['budgetRupees'], 1000),
      dailyBudgetRupees: firstNum(a, ['dailyBudgetRupees'], 100),
      startDate: firstStr(a, ['startDate'], ''),
      endDate: firstStr(a, ['endDate'], ''),
    });
    setAdModal(true);
  };

  const uploadBanner = async (file: File | undefined) => {
    if (!file) return;
    setBannerBusy(true);
    setError(null);
    try {
      const uploaded = (await uploads.upload(file, { folder: 'ads', purpose: 'ad-banner' })) as { url?: string; fileUrl?: string };
      const url = uploaded?.url ?? uploaded?.fileUrl ?? '';
      if (url) {
        setAdForm((prev) => ({ ...prev, bannerUrl: url }));
        flash('Banner uploaded.');
      } else {
        setError('Upload succeeded but no URL was returned.');
      }
    } catch (e) {
      setError(apiErrorMessage(e));
    } finally {
      setBannerBusy(false);
    }
  };

  const saveAd = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const payload: Record<string, unknown> = {
      title: adForm.title.trim(),
      headline: adForm.headline.trim(),
      description: adForm.description.trim(),
      bannerUrl: adForm.bannerUrl.trim(),
      ctaText: adForm.ctaText.trim() || 'Book Now',
      placement: adForm.placement,
      targetType: adForm.targetType,
      targetId: adForm.targetId.trim(),
      budgetRupees: adForm.budgetRupees,
      dailyBudgetRupees: adForm.dailyBudgetRupees,
      ...(adForm.startDate ? { startDate: adForm.startDate } : {}),
      ...(adForm.endDate ? { endDate: adForm.endDate } : {}),
    };
    try {
      if (editingAd) {
        await ads.update(str(editingAd.id), payload);
        flash('Ad updated.');
      } else {
        await ads.create(payload);
        flash('Ad created — it is live immediately (auto-activate).');
      }
      setAdModal(false);
      await load();
    } catch (err) {
      setError(apiErrorMessage(err));
    }
  };

  const removeAd = async (a: Rec) => {
    if (!window.confirm(`Delete ad "${firstStr(a, ['title'], 'Ad')}"?`)) return;
    setError(null);
    try {
      await ads.remove(str(a.id));
      flash('Ad deleted.');
      await load();
    } catch (err) {
      setError(apiErrorMessage(err));
    }
  };

  const togglePause = async (a: Rec) => {
    const paused = firstStr(a, ['status'], '') === 'paused';
    setError(null);
    try {
      await ads.update(str(a.id), { status: paused ? 'active' : 'paused' });
      flash(paused ? 'Ad resumed — it is back in the rotation.' : 'Ad paused — it stops serving immediately.');
      await load();
    } catch (err) {
      setError(apiErrorMessage(err));
    }
  };

  const openAnalytics = async (a: Rec) => {
    setAnalyticsFor(a);
    setAnalytics(null);
    try {
      setAnalytics(asRec(await ads.adAnalytics(str(a.id))));
    } catch (err) {
      setError(apiErrorMessage(err));
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <Link to="/transporter" className="text-xs text-slate-400 hover:text-slate-600 flex items-center gap-1 mb-1">
            <ArrowLeft className="w-3.5 h-3.5" /> Transporter Home
          </Link>
          <h1 className="text-2xl font-extrabold text-slate-900 flex items-center gap-2">
            <Megaphone className="w-7 h-7 text-emerald-600" />
            My Advertisements
          </h1>
          <p className="text-xs text-slate-500 mt-1">Promote your fleet and track impressions, clicks, and spend</p>
        </div>
        <div className="flex gap-2 self-start sm:self-auto">
          <button onClick={openCreate} className="px-4 py-2.5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-2 shadow-md">
            <Plus className="w-4 h-4" /> Create Ad
          </button>
          <button onClick={load} className="p-2.5 rounded-2xl border border-slate-200 text-slate-500 hover:bg-slate-50" title="Refresh">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
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

      {myAds.length === 0 && !loading ? (
        <div className="p-10 bg-white rounded-3xl border border-dashed border-slate-300 text-center space-y-2">
          <Megaphone className="w-10 h-10 text-slate-300 mx-auto" />
          <p className="text-sm font-bold text-slate-700">No ads yet</p>
          <p className="text-xs text-slate-500">Create a sponsored listing to put your trucks in front of farmers and shippers.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {myAds.map((a) => {
            const spent = firstNum(a, ['spentRupees'], 0);
            const budget = firstNum(a, ['budgetRupees'], 0);
            return (
              <div key={str(a.id) || JSON.stringify(a).slice(0, 24)} className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs space-y-4">
                <div className="flex items-start justify-between gap-3 border-b border-slate-100 pb-3">
                  <div className="min-w-0">
                    <h4 className="font-extrabold text-base text-slate-900 truncate">{firstStr(a, ['title'], 'Ad')}</h4>
                    <p className="text-xs text-slate-400 truncate">{firstStr(a, ['headline'], '')}</p>
                  </div>
                  <StatusBadge status={firstStr(a, ['status'], 'draft')} />
                </div>

                {firstStr(a, ['bannerUrl'], '') !== '—' && (
                  <img src={firstStr(a, ['bannerUrl'])} alt={firstStr(a, ['title'], 'Ad banner')} className="w-full h-32 object-cover rounded-2xl border border-slate-200" />
                )}

                {firstStr(a, ['description'], '') !== '—' && <p className="text-xs text-slate-500 line-clamp-3">{firstStr(a, ['description'])}</p>}

                <div className="grid grid-cols-4 gap-2 text-xs">
                  <div className="p-2.5 bg-slate-50 rounded-2xl">
                    <span className="text-slate-400 text-[10px] uppercase font-bold flex items-center gap-1"><Eye className="w-3 h-3" /> Views</span>
                    <p className="font-bold text-slate-900">{firstNum(a, ['impressions'], 0)}</p>
                  </div>
                  <div className="p-2.5 bg-slate-50 rounded-2xl">
                    <span className="text-slate-400 text-[10px] uppercase font-bold flex items-center gap-1"><MousePointerClick className="w-3 h-3" /> Clicks</span>
                    <p className="font-bold text-slate-900">{firstNum(a, ['clicks'], 0)}</p>
                  </div>
                  <div className="p-2.5 bg-slate-50 rounded-2xl">
                    <span className="text-slate-400 text-[10px] uppercase font-bold">CTR</span>
                    <p className="font-bold text-slate-900">{firstNum(a, ['ctrPercent'], 0)}%</p>
                  </div>
                  <div className="p-2.5 bg-slate-50 rounded-2xl">
                    <span className="text-slate-400 text-[10px] uppercase font-bold flex items-center gap-1"><Wallet className="w-3 h-3" /> Spent</span>
                    <p className="font-bold text-slate-900">{formatCurrency(spent)}</p>
                  </div>
                </div>

                <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-emerald-500 rounded-full"
                    style={{ width: `${budget > 0 ? Math.min(100, (spent / budget) * 100) : 0}%` }}
                  />
                </div>
                <p className="text-[10px] text-slate-400">
                  {formatCurrency(spent)} of {formatCurrency(budget)} budget • {fmtDate(a.startDate)} → {fmtDate(a.endDate)}
                </p>

                <div className="flex justify-end gap-2 pt-1">
                  {(firstStr(a, ['status'], '') === 'active' || firstStr(a, ['status'], '') === 'paused') && (
                    <button
                      onClick={() => togglePause(a)}
                      className="px-3 py-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold text-xs flex items-center gap-1"
                    >
                      {firstStr(a, ['status'], '') === 'paused' ? (
                        <>
                          <Play className="w-3.5 h-3.5" /> Resume
                        </>
                      ) : (
                        <>
                          <Pause className="w-3.5 h-3.5" /> Pause
                        </>
                      )}
                    </button>
                  )}
                  <button
                    onClick={() => openAnalytics(a)}
                    className="px-3 py-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold text-xs flex items-center gap-1"
                  >
                    <BarChart3 className="w-3.5 h-3.5" /> Analytics
                  </button>
                  <button
                    onClick={() => openEdit(a)}
                    className="px-3 py-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold text-xs flex items-center gap-1"
                  >
                    <Pencil className="w-3.5 h-3.5" /> Edit
                  </button>
                  <button
                    onClick={() => removeAd(a)}
                    className="px-3 py-2 rounded-xl border border-rose-200 text-rose-700 hover:bg-rose-50 font-bold text-xs flex items-center gap-1"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create / edit ad modal */}
      <ModalSheet isOpen={adModal} onClose={() => setAdModal(false)} title={editingAd ? 'Edit Ad' : 'Create Ad'} description="Mirror of POST/PUT /ads — title, headline (vehicle/availability), body, banner, budget" maxWidth="md">
        <form onSubmit={saveAd} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Title</label>
              <input type="text" value={adForm.title} onChange={(e) => setAdForm({ ...adForm, title: e.target.value })} className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300" minLength={3} required />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Headline (vehicle / availability)</label>
              <input type="text" value={adForm.headline} onChange={(e) => setAdForm({ ...adForm, headline: e.target.value })} className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300" minLength={5} placeholder="2 reefer trucks free this week" required />
            </div>
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Body</label>
            <textarea value={adForm.description} onChange={(e) => setAdForm({ ...adForm, description: e.target.value })} rows={3} maxLength={500} className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300" placeholder="Routes, capacity, tarpaulin, GPS tracking…" />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Banner image</label>
            <div className="flex items-center gap-3">
              {adForm.bannerUrl ? (
                <img src={adForm.bannerUrl} alt="Banner" className="w-16 h-10 rounded-xl object-cover border border-slate-200" />
              ) : (
                <span className="w-16 h-10 rounded-xl bg-slate-100 border border-slate-200" />
              )}
              <input
                type="file"
                accept="image/*"
                disabled={bannerBusy}
                onChange={(e) => {
                  void uploadBanner(e.target.files?.[0]);
                  e.target.value = '';
                }}
                className="flex-1 px-3 py-2 text-xs rounded-xl border border-slate-300 bg-white"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Placement</label>
              <select value={adForm.placement} onChange={(e) => setAdForm({ ...adForm, placement: e.target.value })} className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 bg-white">
                {PLACEMENTS.map((p) => (
                  <option key={p} value={p}>{p.replace(/_/g, ' ')}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">CTA text</label>
              <input type="text" value={adForm.ctaText} onChange={(e) => setAdForm({ ...adForm, ctaText: e.target.value })} className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300" maxLength={40} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Target type</label>
              <select
                value={adForm.targetType}
                onChange={(e) => {
                  const nextType = e.target.value;
                  setAdForm((prev) => ({
                    ...prev,
                    targetType: nextType,
                    targetId: nextType === 'vehicle' ? firstStr(myVehicles[0] ?? {}, ['id'], '') : '',
                  }));
                }}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 bg-white"
              >
                {TARGET_TYPES.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                {adForm.targetType === 'vehicle' ? 'Linked vehicle (my fleet)' : 'Targeting district / area'}
              </label>
              {adForm.targetType === 'vehicle' ? (
                <select
                  value={adForm.targetId}
                  onChange={(e) => setAdForm({ ...adForm, targetId: e.target.value })}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 bg-white"
                  required
                >
                  {myVehicles.length === 0 && <option value="">No vehicles in your fleet yet</option>}
                  {myVehicles.map((v) => (
                    <option key={str(v.id)} value={str(v.id)}>
                      {firstStr(v, ['registrationNumber', 'registrationNo'], 'Vehicle')} — {firstStr(v, ['vehicleType'], 'truck')} ({firstNum(v, ['capacityTons', 'capacityTonnes'], 0)}T)
                    </option>
                  ))}
                </select>
              ) : (
                <input type="text" value={adForm.targetId} onChange={(e) => setAdForm({ ...adForm, targetId: e.target.value })} className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300" placeholder="Nashik" />
              )}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Budget (₹)</label>
              <input type="number" min={0} value={adForm.budgetRupees} onChange={(e) => setAdForm({ ...adForm, budgetRupees: Number(e.target.value) })} className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300" required />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Daily budget (₹)</label>
              <input type="number" min={0} value={adForm.dailyBudgetRupees} onChange={(e) => setAdForm({ ...adForm, dailyBudgetRupees: Number(e.target.value) })} className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300" required />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Start date</label>
              <input type="date" value={adForm.startDate} onChange={(e) => setAdForm({ ...adForm, startDate: e.target.value })} className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300" />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">End date</label>
              <input type="date" value={adForm.endDate} onChange={(e) => setAdForm({ ...adForm, endDate: e.target.value })} className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300" />
            </div>
          </div>
          <button type="submit" className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md">
            {editingAd ? 'Save Changes' : 'Create Ad'}
          </button>
        </form>
      </ModalSheet>

      {/* Analytics modal */}
      <ModalSheet isOpen={!!analyticsFor} onClose={() => setAnalyticsFor(null)} title={`Ad Analytics — ${analyticsFor ? firstStr(analyticsFor, ['title'], 'Ad') : ''}`} maxWidth="sm">
        {analytics ? (
          <div className="space-y-2">
            {[
              ['Status', firstStr(analytics, ['status'], '—')],
              ['Impressions', String(firstNum(analytics, ['impressions'], 0))],
              ['Clicks', String(firstNum(analytics, ['clicks'], 0))],
              ['CTR', `${firstNum(analytics, ['ctrPercent'], 0)}%`],
              ['Spend', formatCurrency(firstNum(analytics, ['spentRupees'], 0))],
              ['Budget', formatCurrency(firstNum(analytics, ['budgetRupees'], 0))],
              ['Remaining budget', formatCurrency(firstNum(analytics, ['remainingBudgetRupees'], 0))],
            ].map(([label, value]) => (
              <div key={label} className="flex justify-between p-3 bg-slate-50 rounded-2xl text-xs">
                <span className="text-slate-500">{label}</span>
                <span className="font-bold text-slate-900">{value}</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-slate-400 text-center py-4">Loading analytics…</p>
        )}
      </ModalSheet>
    </div>
  );
};
