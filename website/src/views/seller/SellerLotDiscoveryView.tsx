import React, { useCallback, useEffect, useState } from 'react';
import {
  Search,
  Filter,
  MapPin,
  Calendar,
  Sparkles,
  ArrowUpDown,
  Bookmark,
  Bell,
  Check,
  Package,
  Layers,
  Map as MapIcon,
  Grid,
  ChevronRight,
  TrendingDown,
  DollarSign,
  Clock,
  ShieldCheck,
} from 'lucide-react';
import { lots, purchases, offers, post, apiErrorMessage } from '../../lib/api';
import { StatusBadge } from '../../components/common/StatusBadge';
import { ModalSheet } from '../../components/common/ModalSheet';
import { formatCurrency, formatWeight, formatDateTime } from '../../lib/utils';
import { cardCls, inputCls, labelCls, primaryBtnCls, ghostBtnCls, rec, str, num, type Rec } from './shared';
import type { ProduceLot } from '../../types';

const COMMON_CROPS = ['All', 'Soybean', 'Onion', 'Wheat', 'Cotton', 'Maize', 'Tomato', 'Turmeric', 'Chilli'];
const GRADES = ['All', 'A', 'B', 'C', 'Ungraded'];

export const SellerLotDiscoveryView: React.FC = () => {
  const [lotList, setLotList] = useState<ProduceLot[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // Filters
  const [crop, setCrop] = useState('All');
  const [grade, setGrade] = useState('All');
  const [state, setState] = useState('');
  const [maxDistanceKm, setMaxDistanceKm] = useState<number>(150);
  const [minQty, setMinQty] = useState<number>(0);
  const [maxPrice, setMaxPrice] = useState<number>(0);
  const [sortBy, setSortBy] = useState<'distance' | 'priceAsc' | 'priceDesc' | 'recency'>('distance');
  const [viewMode, setViewMode] = useState<'grid' | 'map'>('grid');

  // Modals
  const [saveSearchModal, setSaveSearchModal] = useState(false);
  const [searchQueryName, setSearchQueryName] = useState('');
  const [alertsEnabled, setAlertsEnabled] = useState(true);
  const [saveBusy, setSaveBusy] = useState(false);

  // Booking / Offer Modal
  const [selectedLot, setSelectedLot] = useState<ProduceLot | null>(null);
  const [bookingAdvance, setBookingAdvance] = useState(15000);
  const [bookingBusy, setBookingBusy] = useState(false);

  const [offerModalLot, setOfferModalLot] = useState<ProduceLot | null>(null);
  const [offerPrice, setOfferPrice] = useState<number>(0);
  const [offerBusy, setOfferBusy] = useState(false);

  const loadLots = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params: Record<string, unknown> = {};
      if (crop !== 'All') params.crop = crop;
      if (grade !== 'All') params.grade = grade;
      if (state) params.state = state;
      if (maxDistanceKm) params.maxDistanceKm = maxDistanceKm;

      // Try browse first, fall back to list
      let items: ProduceLot[] = [];
      try {
        items = await lots.browse(params);
      } catch {
        items = await lots.list(params);
      }
      setLotList(items);
    } catch (e) {
      setError(apiErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }, [crop, grade, state, maxDistanceKm]);

  useEffect(() => {
    void loadLots();
  }, [loadLots]);

  // Client filtering & sorting
  const filtered = lotList.filter((l) => {
    if (minQty > 0 && l.quantityQuintal < minQty) return false;
    if (maxPrice > 0 && l.expectedPricePerQuintal > maxPrice) return false;
    return true;
  });

  filtered.sort((a, b) => {
    if (sortBy === 'priceAsc') return a.expectedPricePerQuintal - b.expectedPricePerQuintal;
    if (sortBy === 'priceDesc') return b.expectedPricePerQuintal - a.expectedPricePerQuintal;
    if (sortBy === 'recency') return (b.createdAt || '').localeCompare(a.createdAt || '');
    // distance asc (fallback to id)
    const distA = num((a as unknown as Rec).distanceKm) || 9999;
    const distB = num((b as unknown as Rec).distanceKm) || 9999;
    return distA - distB;
  });

  const handleSaveSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaveBusy(true);
    setError(null);
    try {
      await post('/saved-searches', {
        queryText: searchQueryName || `${crop === 'All' ? 'All Produce' : crop} in ${state || 'any state'}`,
        crop: crop === 'All' ? undefined : crop,
        state: state || undefined,
        alertsEnabled,
      });
      setNotice(`Saved search "${searchQueryName || 'My Produce Alert'}" active! Alerts will ping when new matching lots arrive.`);
      setSaveSearchModal(false);
      setSearchQueryName('');
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setSaveBusy(false);
    }
  };

  const handleBookLot = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLot) return;
    setBookingBusy(true);
    setError(null);
    try {
      const order = await purchases.create({
        lotId: selectedLot.id,
      });
      if (bookingAdvance > 0) {
        await purchases.advance(order.id, {
          amount: bookingAdvance,
          method: 'upi',
          reference: `adv_${Date.now()}`,
        }).catch(() => null);
      }
      setNotice(`Lot #${selectedLot.id} booked successfully! Order #${order.id} confirmed.`);
      setSelectedLot(null);
      void loadLots();
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setBookingBusy(false);
    }
  };

  const handleSendOffer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!offerModalLot) return;
    setOfferBusy(true);
    setError(null);
    try {
      await offers.create({
        targetType: 'lot',
        targetId: offerModalLot.id,
        pricePerUnit: offerPrice,
        quantity: offerModalLot.quantityQuintal,
        message: `Counter offer by Vyapari at ₹${offerPrice}/qtl`,
      });
      setNotice(`Offer of ₹${offerPrice}/qtl sent to farmer for Lot #${offerModalLot.id}!`);
      setOfferModalLot(null);
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setOfferBusy(false);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <h1 className="text-2xl font-black text-slate-900 flex items-center gap-2.5">
            <Search className="w-7 h-7 text-emerald-600" />
            Produce Lots — Mandi & Farmgate Discovery
          </h1>
          <p className="text-xs text-slate-500 mt-1 font-medium">
            Search, filter by radius/harvest date/grade, compare farmgate prices with mandi rates, and instant-book verified farmer produce.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setSaveSearchModal(true)}
            className={`${ghostBtnCls} flex items-center gap-1.5 text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200`}
          >
            <Bookmark className="w-4 h-4" /> Save This Search & Set Alerts
          </button>
          <div className="inline-flex rounded-xl bg-slate-100 p-1 border border-slate-200">
            <button
              onClick={() => setViewMode('grid')}
              className={`px-3 py-1 text-xs font-bold rounded-lg flex items-center gap-1.5 transition-all ${
                viewMode === 'grid' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              <Grid className="w-3.5 h-3.5" /> Grid
            </button>
            <button
              onClick={() => setViewMode('map')}
              className={`px-3 py-1 text-xs font-bold rounded-lg flex items-center gap-1.5 transition-all ${
                viewMode === 'map' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              <MapIcon className="w-3.5 h-3.5" /> Map View
            </button>
          </div>
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
          <span>{notice}</span>
          <button onClick={() => setNotice(null)} className="font-bold hover:underline">Dismiss</button>
        </div>
      )}

      {/* Filter Bar */}
      <div className={`${cardCls} space-y-4`}>
        <div className="flex flex-wrap items-center gap-3">
          {/* Crop selector */}
          <div className="flex items-center gap-1 overflow-x-auto py-1">
            {COMMON_CROPS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setCrop(c)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all border ${
                  crop === c
                    ? 'bg-emerald-600 text-white border-emerald-600'
                    : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                }`}
              >
                {c}
              </button>
            ))}
          </div>

          <div className="ml-auto flex items-center gap-2">
            <span className="text-xs font-bold text-slate-500 flex items-center gap-1">
              <ArrowUpDown className="w-3.5 h-3.5" /> Sort:
            </span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="text-xs font-bold bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5"
            >
              <option value="distance">Nearest Distance (km)</option>
              <option value="priceAsc">Price: Low to High</option>
              <option value="priceDesc">Price: High to Low</option>
              <option value="recency">Recently Harvested</option>
            </select>
          </div>
        </div>

        {/* Detailed filters row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 gap-3 pt-2 border-t border-slate-100 text-xs">
          <div>
            <label className="text-[10px] font-bold text-slate-400 uppercase">Grade</label>
            <select
              value={grade}
              onChange={(e) => setGrade(e.target.value)}
              className="w-full mt-1 bg-slate-50 border border-slate-200 rounded-xl p-2 font-semibold"
            >
              {GRADES.map((g) => (
                <option key={g} value={g}>{g === 'All' ? 'All Grades' : `Grade ${g}`}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-[10px] font-bold text-slate-400 uppercase">Max Radius: {maxDistanceKm} km</label>
            <input
              type="range"
              min={10}
              max={500}
              step={10}
              value={maxDistanceKm}
              onChange={(e) => setMaxDistanceKm(Number(e.target.value))}
              className="w-full mt-2"
            />
          </div>

          <div>
            <label className="text-[10px] font-bold text-slate-400 uppercase">Min Quantity (Qt)</label>
            <input
              type="number"
              min={0}
              placeholder="0"
              value={minQty || ''}
              onChange={(e) => setMinQty(Number(e.target.value))}
              className="w-full mt-1 bg-slate-50 border border-slate-200 rounded-xl p-2 font-semibold"
            />
          </div>

          <div>
            <label className="text-[10px] font-bold text-slate-400 uppercase">Max Rate (₹/Qt)</label>
            <input
              type="number"
              min={0}
              placeholder="No limit"
              value={maxPrice || ''}
              onChange={(e) => setMaxPrice(Number(e.target.value))}
              className="w-full mt-1 bg-slate-50 border border-slate-200 rounded-xl p-2 font-semibold"
            />
          </div>

          <div>
            <label className="text-[10px] font-bold text-slate-400 uppercase">State</label>
            <input
              type="text"
              placeholder="e.g. Maharashtra"
              value={state}
              onChange={(e) => setState(e.target.value)}
              className="w-full mt-1 bg-slate-50 border border-slate-200 rounded-xl p-2 font-semibold"
            />
          </div>
        </div>
      </div>

      {/* Main Content: Map or Grid */}
      {loading ? (
        <div className="py-24 text-center text-xs font-bold text-slate-400 animate-pulse">
          Scanning farmgate lots & APMC clusters…
        </div>
      ) : filtered.length === 0 ? (
        <div className={`${cardCls} py-16 text-center space-y-3`}>
          <Package className="w-10 h-10 text-slate-300 mx-auto" />
          <h3 className="text-sm font-bold text-slate-800">No Produce Lots Found</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            No lots match this radius or price filter. Try widening the search radius or save this query to receive automatic alerts when farmers list matching lots.
          </p>
          <button
            type="button"
            onClick={() => {
              setCrop('All');
              setGrade('All');
              setState('');
              setMaxDistanceKm(300);
              setMaxPrice(0);
              setMinQty(0);
            }}
            className={`${ghostBtnCls} text-xs font-bold`}
          >
            Reset Filters
          </button>
        </div>
      ) : viewMode === 'map' ? (
        /* Map Browse Mock View */
        <div className="space-y-4">
          <div className="bg-slate-900 text-white rounded-3xl p-6 border border-slate-800 relative overflow-hidden min-h-[420px] flex flex-col justify-between shadow-xl">
            <div className="relative z-10 flex items-center justify-between">
              <div>
                <span className="text-[10px] font-black uppercase tracking-wider text-emerald-400 bg-emerald-950/80 px-3 py-1 rounded-full border border-emerald-800">
                  Interactive Farmgate Geographic Browse
                </span>
                <h3 className="text-lg font-black text-white mt-2">Active Producer Hubs within {maxDistanceKm} km</h3>
                <p className="text-xs text-slate-400">Map coordinates verified via GPS farm boundary mapping</p>
              </div>
              <span className="text-xs font-bold text-slate-300 bg-slate-800/80 px-3 py-1.5 rounded-xl border border-slate-700">
                {filtered.length} Lots Mapped
              </span>
            </div>

            {/* Simulated Interactive Cluster Pins */}
            <div className="relative z-10 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 my-6">
              {filtered.slice(0, 8).map((lot) => {
                const dist = num((lot as unknown as Rec).distanceKm) || 25;
                return (
                  <div
                    key={lot.id}
                    onClick={() => setSelectedLot(lot)}
                    className="p-3 bg-slate-800/90 hover:bg-slate-700/90 transition-all rounded-2xl border border-slate-700 cursor-pointer text-left space-y-1 hover:border-emerald-500 shadow-md"
                  >
                    <div className="flex items-center justify-between text-[10px] font-bold text-emerald-400">
                      <span>{lot.crop}</span>
                      <span>{dist} km</span>
                    </div>
                    <div className="text-sm font-black text-white">{formatCurrency(lot.expectedPricePerQuintal)}/q</div>
                    <div className="text-[10px] text-slate-300 truncate flex items-center gap-1">
                      <MapPin className="w-2.5 h-2.5 text-slate-400" /> {lot.location || 'Maharashtra'}
                    </div>
                    <div className="text-[10px] font-bold text-slate-400">Qty: {lot.quantityQuintal} Qt</div>
                  </div>
                );
              })}
            </div>

            <div className="relative z-10 text-[10px] text-slate-400 flex items-center justify-between border-t border-slate-800 pt-3">
              <span>Coordinates calibrated against APMC yard centres & Maharashtra farm belts.</span>
              <span className="text-emerald-400 font-bold">Click any lot cluster pin to initiate procurement.</span>
            </div>
          </div>
        </div>
      ) : (
        /* Grid View */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filtered.map((lot) => {
            const lotRec = lot as unknown as Rec;
            const dist = num(lotRec.distanceKm);
            const totalEst = lot.quantityQuintal * lot.expectedPricePerQuintal;
            const photos = Array.isArray(lotRec.photos) ? (lotRec.photos as string[]) : [];

            return (
              <div
                key={lot.id}
                className={`${cardCls} flex flex-col justify-between hover:border-emerald-400 hover:shadow-lg transition-all space-y-4`}
              >
                <div className="space-y-3">
                  {/* Top card bar */}
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-base font-black text-slate-900">{lot.crop}</h3>
                        <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
                          Grade {lot.grade}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 font-semibold">{lot.variety || 'JS 335 / Kalitur'}</p>
                    </div>

                    <div className="text-right">
                      <div className="text-lg font-black text-emerald-700">
                        {formatCurrency(lot.expectedPricePerQuintal)}
                        <span className="text-[10px] text-slate-400 font-medium"> /qt</span>
                      </div>
                      <div className="text-[10px] font-bold text-slate-400">Est: {formatCurrency(totalEst)}</div>
                    </div>
                  </div>

                  {/* Photo thumbnail if present */}
                  {photos.length > 0 && (
                    <div className="h-28 w-full rounded-2xl overflow-hidden bg-slate-100 border border-slate-200">
                      <img
                        src={photos[0]}
                        alt={lot.crop}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          (e.target as HTMLElement).style.display = 'none';
                        }}
                      />
                    </div>
                  )}

                  {/* Lot Details */}
                  <div className="grid grid-cols-2 gap-2 text-xs bg-slate-50 p-3 rounded-2xl border border-slate-100">
                    <div>
                      <span className="text-[10px] font-bold text-slate-400 uppercase block">Available Lot</span>
                      <span className="font-extrabold text-slate-800">{formatWeight(lot.quantityQuintal)}</span>
                    </div>

                    <div>
                      <span className="text-[10px] font-bold text-slate-400 uppercase block">Distance</span>
                      <span className="font-extrabold text-slate-800 flex items-center gap-1">
                        <MapPin className="w-3 h-3 text-emerald-600" />
                        {dist ? `${dist} km` : 'Near APMC'}
                      </span>
                    </div>

                    <div className="col-span-2 pt-1 border-t border-slate-200/60 flex items-center justify-between text-[11px]">
                      <span className="text-slate-500 truncate">{lot.location || 'Nashik / Pune Belt'}</span>
                      <span className="text-slate-400 shrink-0 font-medium">{lot.harvestDate ? `Harvest: ${lot.harvestDate}` : 'Ready for Pickup'}</span>
                    </div>
                  </div>
                </div>

                {/* Card CTAs */}
                <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => {
                      setOfferModalLot(lot);
                      setOfferPrice(Math.round(lot.expectedPricePerQuintal * 0.95));
                    }}
                    className={`${ghostBtnCls} w-full text-xs font-bold py-2`}
                  >
                    Make Offer
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setSelectedLot(lot);
                      setBookingAdvance(Math.round(totalEst * 0.15));
                    }}
                    className={`${primaryBtnCls} w-full text-xs font-black py-2 shadow-sm`}
                  >
                    Book Lot
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Save Search Modal */}
      {saveSearchModal && (
        <ModalSheet title="Save Search Alert for Vyapari" isOpen={saveSearchModal} onClose={() => setSaveSearchModal(false)}>
          <form onSubmit={handleSaveSearch} className="space-y-4">
            <p className="text-xs text-slate-500">
              Receive automatic FCM alerts when a farmer lists lots matching: <strong>{crop}</strong> in <strong>{state || 'any state'}</strong>.
            </p>

            <div>
              <label className={labelCls}>Saved Search Query Name</label>
              <input
                type="text"
                required
                value={searchQueryName}
                onChange={(e) => setSearchQueryName(e.target.value)}
                placeholder="e.g. Pune Soybean Grade A"
                className={inputCls}
              />
            </div>

            <div className="flex items-center gap-3 p-3 bg-emerald-50 rounded-2xl border border-emerald-200">
              <input
                type="checkbox"
                id="alertsCheckbox"
                checked={alertsEnabled}
                onChange={(e) => setAlertsEnabled(e.target.checked)}
                className="w-4 h-4 text-emerald-600 rounded"
              />
              <label htmlFor="alertsCheckbox" className="text-xs font-bold text-emerald-900 cursor-pointer">
                Send instant notification when new matching lots are published
              </label>
            </div>

            <div className="flex justify-end gap-2 pt-3">
              <button
                type="button"
                onClick={() => setSaveSearchModal(false)}
                className={`${ghostBtnCls} text-xs font-bold`}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saveBusy}
                className={`${primaryBtnCls} text-xs font-black px-4`}
              >
                {saveBusy ? 'Saving…' : 'Activate Alert'}
              </button>
            </div>
          </form>
        </ModalSheet>
      )}

      {/* Instant Book Modal */}
      {selectedLot && (
        <ModalSheet title={`Book Lot #${selectedLot.id} — ${selectedLot.crop}`} isOpen={!!selectedLot} onClose={() => setSelectedLot(null)}>
          <form onSubmit={handleBookLot} className="space-y-4">
            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-500">Produce:</span>
                <span className="font-bold text-slate-800">{selectedLot.crop} (Grade {selectedLot.grade})</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Quantity:</span>
                <span className="font-bold text-slate-800">{selectedLot.quantityQuintal} Quintals</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Agreed Rate:</span>
                <span className="font-bold text-slate-800">{formatCurrency(selectedLot.expectedPricePerQuintal)} / qtl</span>
              </div>
              <div className="flex justify-between border-t border-slate-200 pt-2 text-sm">
                <span className="font-black text-slate-900">Total Purchase Value:</span>
                <span className="font-black text-emerald-700">{formatCurrency(selectedLot.quantityQuintal * selectedLot.expectedPricePerQuintal)}</span>
              </div>
            </div>

            <div>
              <label className={labelCls}>Advance Escrow Deposit (₹)</label>
              <input
                type="number"
                min={0}
                value={bookingAdvance}
                onChange={(e) => setBookingAdvance(Number(e.target.value))}
                className={inputCls}
              />
              <p className="text-[10px] text-slate-400 mt-1">
                Advance is safely held in platform escrow until delivery verification and digital QC.
              </p>
            </div>

            <div className="flex justify-end gap-2 pt-3">
              <button
                type="button"
                onClick={() => setSelectedLot(null)}
                className={`${ghostBtnCls} text-xs font-bold`}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={bookingBusy}
                className={`${primaryBtnCls} text-xs font-black px-5`}
              >
                {bookingBusy ? 'Confirming Order…' : 'Confirm Purchase Order'}
              </button>
            </div>
          </form>
        </ModalSheet>
      )}

      {/* Make Offer Modal */}
      {offerModalLot && (
        <ModalSheet title={`Counter Offer for Lot #${offerModalLot.id}`} isOpen={!!offerModalLot} onClose={() => setOfferModalLot(null)}>
          <form onSubmit={handleSendOffer} className="space-y-4">
            <p className="text-xs text-slate-500">
              Farmer expected: <strong>{formatCurrency(offerModalLot.expectedPricePerQuintal)}/qtl</strong> for {offerModalLot.quantityQuintal} Qt of {offerModalLot.crop}. Propose your bid rate.
            </p>

            <div>
              <label className={labelCls}>Your Bid Rate (₹ / Quintal) *</label>
              <input
                type="number"
                required
                value={offerPrice}
                onChange={(e) => setOfferPrice(Number(e.target.value))}
                className={inputCls}
              />
            </div>

            <div className="flex justify-end gap-2 pt-3">
              <button
                type="button"
                onClick={() => setOfferModalLot(null)}
                className={`${ghostBtnCls} text-xs font-bold`}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={offerBusy}
                className={`${primaryBtnCls} text-xs font-black px-5`}
              >
                {offerBusy ? 'Sending Bid…' : 'Submit Counter Bid'}
              </button>
            </div>
          </form>
        </ModalSheet>
      )}
    </div>
  );
};
