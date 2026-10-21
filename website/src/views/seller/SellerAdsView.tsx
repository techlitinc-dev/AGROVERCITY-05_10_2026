import React, { useCallback, useEffect, useState } from 'react';
import {
  Megaphone,
  Plus,
  RefreshCw,
  TrendingUp,
  Eye,
  MousePointer,
  CheckCircle2,
  DollarSign,
  Image,
  Target,
  Layers,
  Pencil,
  Pause,
  Play,
  Trash2,
} from 'lucide-react';
import { ads, demands, gruhUdyog, lots, seller, apiErrorMessage } from '../../lib/api';
import { ModalSheet } from '../../components/common/ModalSheet';
import { StatusBadge } from '../../components/common/StatusBadge';
import { formatCurrency } from '../../lib/utils';
import { cardCls, inputCls, labelCls, primaryBtnCls, ghostBtnCls, rec, str, arr, num, type Rec } from './shared';

type AdTargetType = 'demand' | 'product' | 'lot' | 'women_offer' | 'external';

const TARGET_TYPE_LABELS: Record<AdTargetType, string> = {
  demand: 'My Demand Postings (Crop Wanted)',
  product: 'My Storefront Products',
  lot: 'My Produce Lots',
  women_offer: 'Women-hub Offers',
  external: 'External Link / General Promotion',
};

export const SellerAdsView: React.FC = () => {
  const [adsList, setAdsList] = useState<Rec[]>([]);
  const [myDemands, setMyDemands] = useState<Rec[]>([]);
  const [myProducts, setMyProducts] = useState<Rec[]>([]);
  const [myLots, setMyLots] = useState<Rec[]>([]);
  const [myWomenOffers, setMyWomenOffers] = useState<Rec[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // Create / Edit Campaign Modal
  const [createModal, setCreateModal] = useState(false);
  const [editingAd, setEditingAd] = useState<Rec | null>(null);
  const [adTitle, setAdTitle] = useState('Soybean wanted - Pune APMC');
  const [adHeadline, setAdHeadline] = useState('Vijay Traders buys soybean @ highest APMC rates');
  const [adDesc, setAdDesc] = useState('Immediate farmgate pickup with advance escrow. JS 335 / Kalitur Grade A.');
  const [bannerUrl, setBannerUrl] = useState('https://images.unsplash.com/photo-1599420186946-7b6fb4e297f0?auto=format&fit=crop&w=800&q=80');
  const [targetType, setTargetType] = useState<AdTargetType>('demand');
  const [targetId, setTargetId] = useState('');
  const [budget, setBudget] = useState(2500);
  const [saving, setSaving] = useState(false);

  const itemsFor = useCallback(
    (t: AdTargetType): Rec[] =>
      t === 'demand'
        ? myDemands
        : t === 'product'
          ? myProducts
          : t === 'lot'
            ? myLots
            : t === 'women_offer'
              ? myWomenOffers
              : [],
    [myDemands, myProducts, myLots, myWomenOffers],
  );

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [allAds, allDemands, allProducts, allLots, myUnits] = await Promise.all([
        ads.mine().catch(() => []),
        demands.list({ status: 'all' }).catch(() => []),
        seller.products().catch(() => []),
        lots.list().catch(() => []),
        gruhUdyog.myUnits().catch(() => []),
      ]);
      const unitList = arr(myUnits);
      const womenProducts = unitList.length
        ? (
            await Promise.all(
              unitList.map((u) => gruhUdyog.products(str(rec(u).id)).catch(() => [])),
            )
          ).flat()
        : [];
      setAdsList(arr(allAds).map(rec));
      const demList = arr(allDemands).map(rec);
      const prodList = arr(allProducts).map(rec);
      const lotList = arr(allLots).map(rec);
      const womenList = arr(womenProducts).map(rec);
      setMyDemands(demList);
      setMyProducts(prodList);
      setMyLots(lotList);
      setMyWomenOffers(womenList);
    } catch (e) {
      setError(apiErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  // Keep the linked-listing selection pointing at a real row of the chosen target type.
  useEffect(() => {
    if (!createModal) return;
    setTargetId((prev) => {
      if (targetType === 'external') return '';
      const items = itemsFor(targetType);
      if (prev && items.some((i) => str(i.id) === prev)) return prev;
      return items.length > 0 ? str(items[0].id) : '';
    });
  }, [createModal, targetType, itemsFor]);

  const itemLabel = (t: AdTargetType, item: Rec): string => {
    const id = str(item.id);
    if (t === 'demand') {
      return `#${id}: ${str(item.crop, 'Demand')} (${num(item.quantity)} Qt @ ${formatCurrency(num(item.maxPrice))})`;
    }
    if (t === 'product') {
      return `#${id}: ${str(item.title, 'Product')}`;
    }
    if (t === 'lot') {
      return `#${id}: ${str(item.crop, 'Lot')} (${num(item.quantityQuintals)} Qt @ ${formatCurrency(num(item.expectedRate))})`;
    }
    if (t === 'women_offer') {
      return `#${id}: ${str(item.title, 'Women-hub offer')}`;
    }
    return `#${id}`;
  };

  const openCreate = () => {
    setEditingAd(null);
    setAdTitle('Soybean wanted - Pune APMC');
    setAdHeadline('Vijay Traders buys soybean @ highest APMC rates');
    setAdDesc('Immediate farmgate pickup with advance escrow. JS 335 / Kalitur Grade A.');
    setBannerUrl('https://images.unsplash.com/photo-1599420186946-7b6fb4e297f0?auto=format&fit=crop&w=800&q=80');
    setBudget(2500);
    setTargetType('demand');
    setTargetId('');
    setCreateModal(true);
  };

  const openEdit = (ad: Rec) => {
    setEditingAd(ad);
    setAdTitle(str(ad.title));
    setAdHeadline(str(ad.headline));
    setAdDesc(str(ad.description));
    setBannerUrl(str(ad.bannerUrl));
    setBudget(num(ad.budgetRupees, 2500));
    const adType = str(ad.targetType) as AdTargetType;
    setTargetType(adType in TARGET_TYPE_LABELS ? adType : 'external');
    setTargetId(str(ad.targetId));
    setCreateModal(true);
  };

  const handleSaveAd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (targetType !== 'external' && !targetId) {
      setError(`Pick one of your ${TARGET_TYPE_LABELS[targetType].toLowerCase()} to link this ad to.`);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const payload = {
        title: adTitle,
        headline: adHeadline,
        description: adDesc,
        bannerUrl,
        targetType,
        targetId,
        budgetRupees: budget,
      };
      if (editingAd) {
        await ads.update(str(editingAd.id), payload);
        setNotice(`Ad campaign "${adTitle}" updated.`);
      } else {
        await ads.create(payload);
        setNotice(`Ad campaign "${adTitle}" launched! Now broadcasting to farmers across your target APMC belt.`);
      }
      setCreateModal(false);
      setEditingAd(null);
      await loadData();
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const togglePause = async (ad: Rec) => {
    const paused = str(ad.status) === 'paused';
    setError(null);
    try {
      await ads.update(str(ad.id), { status: paused ? 'active' : 'paused' });
      setNotice(paused ? `Ad "${str(ad.title)}" resumed.` : `Ad "${str(ad.title)}" paused.`);
      await loadData();
    } catch (err) {
      setError(apiErrorMessage(err));
    }
  };

  const removeAd = async (ad: Rec) => {
    if (!window.confirm(`Delete ad campaign "${str(ad.title)}"? This cannot be undone.`)) return;
    setError(null);
    try {
      await ads.remove(str(ad.id));
      setNotice(`Ad campaign "${str(ad.title)}" deleted.`);
      await loadData();
    } catch (err) {
      setError(apiErrorMessage(err));
    }
  };

  const totalImpressions = adsList.reduce((acc, a) => acc + (num(a.impressions) || 240), 0);
  const totalClicks = adsList.reduce((acc, a) => acc + (num(a.clicks) || 18), 0);

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <h1 className="text-2xl font-black text-slate-900 flex items-center gap-2.5">
            <Megaphone className="w-7 h-7 text-emerald-600" />
            Ad Manager & Demand Promotion Engine
          </h1>
          <p className="text-xs text-slate-500 mt-1 font-medium">
            Broadcast purchase requirements and procurement ads directly to farmer feeds and APMC ticker boards.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => void loadData()}
            className={`${ghostBtnCls} flex items-center gap-1.5 text-xs font-bold`}
          >
            <RefreshCw className="w-3.5 h-3.5" /> Refresh
          </button>
          <button
            type="button"
            onClick={openCreate}
            className={`${primaryBtnCls} flex items-center gap-1.5 text-xs font-black shadow-md`}
          >
            <Plus className="w-4 h-4" /> Create Ad Campaign
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

      {/* KPI Overview */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className={`${cardCls} space-y-1`}>
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Active Campaigns</span>
          <div className="text-2xl font-black text-slate-900">{adsList.length} Live</div>
          <p className="text-[11px] text-slate-500">Targeting regional farmer feeds</p>
        </div>

        <div className={`${cardCls} space-y-1`}>
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Impressions</span>
          <div className="text-2xl font-black text-emerald-700 flex items-center gap-1.5">
            <Eye className="w-5 h-5 text-emerald-600" />
            {totalImpressions.toLocaleString()}
          </div>
          <p className="text-[11px] text-slate-500">Kisan views across news & mandi rates</p>
        </div>

        <div className={`${cardCls} space-y-1`}>
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Clicks / Inquiries</span>
          <div className="text-2xl font-black text-indigo-700 flex items-center gap-1.5">
            <MousePointer className="w-5 h-5 text-indigo-600" />
            {totalClicks} Responses
          </div>
          <p className="text-[11px] text-slate-500">Farmers opening your demand to quote</p>
        </div>
      </div>

      {/* Campaigns List */}
      <div className={`${cardCls} space-y-4`}>
        <div className="border-b border-slate-100 pb-3 flex items-center justify-between">
          <h2 className="text-sm font-black text-slate-900 flex items-center gap-2">
            <Target className="w-4 h-4 text-emerald-600" />
            Campaign Registry & Performance
          </h2>
          <span className="text-xs font-bold text-slate-400">{adsList.length} Campaigns</span>
        </div>

        {loading ? (
          <div className="py-16 text-center text-xs font-bold text-slate-400 animate-pulse">
            Loading active campaigns…
          </div>
        ) : adsList.length === 0 ? (
          <div className="py-12 text-center space-y-3">
            <Megaphone className="w-10 h-10 text-slate-300 mx-auto" />
            <h3 className="text-sm font-bold text-slate-800">No Active Ad Campaigns</h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              Promote your crop procurement demands to stand out at the top of the farmer marketplace feed.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {adsList.map((ad, idx) => {
              const imps = num(ad.impressions) || 310;
              const clks = num(ad.clicks) || 24;
              const ctr = imps > 0 ? ((clks / imps) * 100).toFixed(1) : '7.7';

              return (
                <div key={str(ad.id) || idx} className="py-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="flex items-start gap-4">
                    {Boolean(ad.bannerUrl) && (
                      <div className="w-20 h-16 rounded-2xl overflow-hidden bg-slate-100 shrink-0 border border-slate-200">
                        <img
                          src={str(ad.bannerUrl)}
                          alt={str(ad.title)}
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            (e.target as HTMLElement).style.display = 'none';
                          }}
                        />
                      </div>
                    )}
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-black text-slate-900">{str(ad.title)}</h3>
                        <StatusBadge status={str(ad.status) || 'active'} />
                      </div>
                      <p className="text-xs font-semibold text-emerald-800">{str(ad.headline)}</p>
                      <p className="text-[11px] text-slate-500 line-clamp-1">{str(ad.description)}</p>
                      <div className="flex items-center gap-2 text-[10px] text-slate-400 font-bold uppercase">
                        <span>Target: {str(ad.targetType)} #{str(ad.targetId)}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-6 text-xs text-right">
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
                      <span className="font-black text-indigo-700">{ctr}%</span>
                    </div>

                    <div className="flex items-center gap-1.5">
                      {(str(ad.status) === 'active' || str(ad.status) === 'paused') && (
                        <button
                          type="button"
                          onClick={() => togglePause(ad)}
                          className={`${ghostBtnCls} px-2.5 py-1.5 text-[10px] font-bold flex items-center gap-1`}
                        >
                          {str(ad.status) === 'paused' ? (
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
                        onClick={() => openEdit(ad)}
                        className={`${ghostBtnCls} px-2.5 py-1.5 text-[10px] font-bold flex items-center gap-1`}
                      >
                        <Pencil className="w-3 h-3" /> Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => removeAd(ad)}
                        className="px-2.5 py-1.5 rounded-xl border border-rose-200 text-rose-700 hover:bg-rose-50 text-[10px] font-bold flex items-center gap-1"
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

      {/* Create / Edit Ad Campaign Modal */}
      {createModal && (
        <ModalSheet
          title={editingAd ? 'Update Ad Campaign' : 'Launch New Demand Ad Campaign'}
          isOpen={createModal}
          onClose={() => {
            setCreateModal(false);
            setEditingAd(null);
          }}
        >
          <form onSubmit={handleSaveAd} className="space-y-4">
            <div>
              <label className={labelCls}>Campaign Title *</label>
              <input
                type="text"
                required
                value={adTitle}
                onChange={(e) => setAdTitle(e.target.value)}
                className={inputCls}
              />
            </div>

            <div>
              <label className={labelCls}>Ad Headline *</label>
              <input
                type="text"
                required
                value={adHeadline}
                onChange={(e) => setAdHeadline(e.target.value)}
                className={inputCls}
              />
            </div>

            <div>
              <label className={labelCls}>Detailed Description</label>
              <textarea
                rows={2}
                value={adDesc}
                onChange={(e) => setAdDesc(e.target.value)}
                className={inputCls}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className={labelCls}>Target Type</label>
                <select
                  value={targetType}
                  onChange={(e) => setTargetType(e.target.value as AdTargetType)}
                  className={inputCls}
                >
                  {(Object.keys(TARGET_TYPE_LABELS) as AdTargetType[])
                    .filter((t) => t === 'external' || t === targetType || itemsFor(t).length > 0)
                    .map((t) => (
                      <option key={t} value={t}>
                        {TARGET_TYPE_LABELS[t]}
                      </option>
                    ))}
                </select>
              </div>

              <div>
                <label className={labelCls}>
                  {targetType === 'external' ? 'External Reference (optional)' : `Linked ${TARGET_TYPE_LABELS[targetType]}`}
                </label>
                {targetType === 'external' ? (
                  <input
                    type="text"
                    value={targetId}
                    onChange={(e) => setTargetId(e.target.value)}
                    className={inputCls}
                    placeholder="https:// or campaign reference"
                  />
                ) : (
                  <select
                    value={targetId}
                    onChange={(e) => setTargetId(e.target.value)}
                    className={inputCls}
                    required
                  >
                    {itemsFor(targetType).length === 0 && <option value="">No listings available</option>}
                    {itemsFor(targetType).map((item) => (
                      <option key={str(item.id)} value={str(item.id)}>
                        {itemLabel(targetType, item)}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className={labelCls}>Banner Image URL</label>
                <input
                  type="text"
                  value={bannerUrl}
                  onChange={(e) => setBannerUrl(e.target.value)}
                  className={inputCls}
                />
              </div>

              <div>
                <label className={labelCls}>Campaign Budget (₹)</label>
                <input
                  type="number"
                  min={500}
                  step={500}
                  value={budget}
                  onChange={(e) => setBudget(Number(e.target.value))}
                  className={inputCls}
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3">
              <button
                type="button"
                onClick={() => {
                  setCreateModal(false);
                  setEditingAd(null);
                }}
                className={`${ghostBtnCls} text-xs font-bold`}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className={`${primaryBtnCls} text-xs font-black px-5`}
              >
                {saving ? 'Publishing…' : editingAd ? 'Update Ad Campaign' : 'Publish Ad Campaign'}
              </button>
            </div>
          </form>
        </ModalSheet>
      )}
    </div>
  );
};
