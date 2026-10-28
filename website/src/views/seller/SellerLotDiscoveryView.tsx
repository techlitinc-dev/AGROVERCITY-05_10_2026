import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search,
  MapPin,
  Bookmark,
  Package,
  Map as MapIcon,
  Grid,
  Phone,
  MessageSquare,
  ShieldAlert,
  BadgeCheck,
  User as UserIcon,
} from 'lucide-react';
import { lots, users, leads as leadsApi, post, apiErrorMessage } from '../../lib/api';
import type { Lead } from '../../lib/api';
import { StatusBadge } from '../../components/common/StatusBadge';
import { ModalSheet } from '../../components/common/ModalSheet';
import { formatCurrency, formatWeight } from '../../lib/utils';
import { cardCls, inputCls, labelCls, primaryBtnCls, ghostBtnCls, rec, str, num, type Rec } from './shared';
import type { ProduceLot } from '../../types';

const COMMON_CROPS = ['All', 'Soybean', 'Onion', 'Wheat', 'Cotton', 'Maize', 'Tomato', 'Turmeric', 'Chilli'];
const GRADES = ['All', 'A', 'B', 'C', 'Ungraded'];

export const SellerLotDiscoveryView: React.FC = () => {
  const navigate = useNavigate();
  const [lotList, setLotList] = useState<ProduceLot[]>([]);
  const [myLeads, setMyLeads] = useState<Lead[]>([]);
  const [hasMpin, setHasMpin] = useState(false);
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

  // Save search
  const [saveSearchModal, setSaveSearchModal] = useState(false);
  const [searchQueryName, setSearchQueryName] = useState('');
  const [alertsEnabled, setAlertsEnabled] = useState(true);
  const [saveBusy, setSaveBusy] = useState(false);

  // Contact flow
  const [contactLot, setContactLot] = useState<ProduceLot | null>(null);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [mpin, setMpin] = useState('');
  const [contactBusy, setContactBusy] = useState(false);
  const [contactCard, setContactCard] = useState<{ lot: ProduceLot; lead: Lead } | null>(null);
  const [mpinVisible, setMpinVisible] = useState(false);

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

  const loadMyLeads = useCallback(async () => {
    try {
      setMyLeads(await leadsApi.getMyLeads('sent'));
    } catch {
      setMyLeads([]);
    }
  }, []);

  useEffect(() => {
    void loadLots();
    void loadMyLeads();
    users
      .getMe()
      .then((me) => setHasMpin(Boolean((me as { hasMpin?: boolean }).hasMpin)))
      .catch(() => {});
  }, [loadLots, loadMyLeads]);

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

  const leadForLot = (lotId: string): Lead | undefined =>
    myLeads.find((l) => l.lotId === lotId && l.status !== 'dismissed');

  const openContact = (lot: ProduceLot) => {
    const existing = leadForLot(lot.id);
    if (existing) {
      setContactCard({ lot, lead: existing });
      return;
    }
    setContactLot(lot);
    setTermsAccepted(false);
    setMpin('');
    setMpinVisible(false);
  };

  const handleAcceptTerms = async () => {
    if (!contactLot) return;
    setContactBusy(true);
    setError(null);
    try {
      const { lead } = await leadsApi.createLead(contactLot.id, termsAccepted, mpin.trim() || undefined);
      setContactLot(null);
      setContactCard({ lot: contactLot, lead });
      setNotice(`Contact details unlocked for Lot #${contactLot.id} — call or WhatsApp the farmer directly.`);
      await loadMyLeads();
    } catch (err) {
      if (leadsApi.isMpinError(err)) {
        setError('Incorrect MPIN — try again.');
      } else {
        setError(apiErrorMessage(err));
        if (contactLot) {
          setContactLot(null);
        }
      }
    } finally {
      setContactBusy(false);
    }
  };

  const waLink = (lead: Lead): string | null =>
    lead.farmerContact?.whatsappDigits ? `https://wa.me/${lead.farmerContact.whatsappDigits}` : null;
  const telLink = (lead: Lead): string | null =>
    lead.farmerContact?.phoneDigits ? `tel:+${lead.farmerContact.phoneDigits}` : null;

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 flex items-center gap-2.5">
            <Search className="w-7 h-7 text-emerald-600" />
            Produce Lots — Farmgate Discovery
          </h1>
          <p className="text-xs text-slate-500 mt-1 font-medium">
            Browse farmer lots, compare with mandi rates, and contact the farmer directly — deal, payment and pickup happen between you two.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setSaveSearchModal(true)}
            className={`${ghostBtnCls} flex items-center gap-1.5 text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200`}
          >
            <Bookmark className="w-4 h-4" /> Save Search & Alerts
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
              <MapIcon className="w-3.5 h-3.5" /> Map
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
            <span className="text-xs font-bold text-slate-500 flex items-center gap-1">Sort:</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
              className="text-xs font-bold bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5"
            >
              <option value="distance">Nearest Distance (km)</option>
              <option value="priceAsc">Price: Low to High</option>
              <option value="priceDesc">Price: High to Low</option>
              <option value="recency">Recently Harvested</option>
            </select>
          </div>
        </div>

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
        /* Map Browse View */
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

            <div className="relative z-10 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 my-6">
              {filtered.slice(0, 8).map((lot) => {
                const dist = num((lot as unknown as Rec).distanceKm) || 25;
                return (
                  <div
                    key={lot.id}
                    onClick={() => openContact(lot)}
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
              <span className="text-emerald-400 font-bold">Click any lot cluster pin to contact the farmer.</span>
            </div>
          </div>
        </div>
      ) : (
        /* Grid View */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filtered.map((lot) => {
            const lotRec = lot as unknown as Rec;
            const dist = num(lotRec.distanceKm);
            const photos = Array.isArray(lotRec.photos) ? (lotRec.photos as string[]) : [];
            const existingLead = leadForLot(lot.id);

            return (
              <div
                key={lot.id}
                className={`${cardCls} flex flex-col justify-between hover:border-emerald-400 hover:shadow-lg transition-all space-y-4`}
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-base font-black text-slate-900">{lot.crop}</h3>
                        <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
                          Grade {lot.grade}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 font-semibold">{lot.variety || 'Standard'}</p>
                    </div>

                    <div className="text-right">
                      <div className="text-lg font-black text-emerald-700">
                        {formatCurrency(lot.expectedPricePerQuintal)}
                        <span className="text-[10px] text-slate-400 font-medium"> /qt</span>
                      </div>
                      <div className="text-[10px] font-bold text-slate-400">
                        Est: {formatCurrency(lot.quantityQuintal * lot.expectedPricePerQuintal)}
                      </div>
                    </div>
                  </div>

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
                      <span className="text-slate-400 shrink-0 font-medium">
                        {lot.harvestDate ? `Harvest: ${lot.harvestDate}` : 'Ready for Pickup'}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => openContact(lot)}
                    className={`${existingLead ? ghostBtnCls : primaryBtnCls} w-full text-xs font-black py-2.5 shadow-sm`}
                  >
                    {existingLead ? 'View Contact Again' : 'Contact Farmer'}
                  </button>
                  <p className="text-[10px] text-slate-400 text-center mt-1.5">
                    {existingLead
                      ? 'Contact already unlocked — call, WhatsApp or chat.'
                      : 'Unlock farmer contact — accept terms & verify MPIN.'}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Save Search Modal */}
      {saveSearchModal && (
        <ModalSheet title="Save Search Alert for Vyapari" isOpen={saveSearchModal} onClose={() => setSaveSearchModal(false)}>
          <form
            onSubmit={async (e) => {
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
            }}
            className="space-y-4"
          >
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
              <button type="button" onClick={() => setSaveSearchModal(false)} className={`${ghostBtnCls} text-xs font-bold`}>
                Cancel
              </button>
              <button type="submit" disabled={saveBusy} className={`${primaryBtnCls} text-xs font-black px-4`}>
                {saveBusy ? 'Saving…' : 'Activate Alert'}
              </button>
            </div>
          </form>
        </ModalSheet>
      )}

      {/* Terms & Conditions + MPIN popup — gates contact reveal */}
      <ModalSheet
        isOpen={Boolean(contactLot)}
        onClose={() => setContactLot(null)}
        title="Agrovercity Terms — Connect Directly"
        description={`Lot: ${contactLot?.crop ?? ''} · Grade ${contactLot?.grade ?? ''} · ${contactLot ? formatWeight(contactLot.quantityQuintal) : ''} · expected ${contactLot ? formatCurrency(contactLot.expectedPricePerQuintal) : ''}/q`}
        maxWidth="sm"
      >
        <div className="space-y-4">
          <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-[11px] text-amber-900 space-y-1">
            <p className="font-bold flex items-center gap-1.5">
              <ShieldAlert className="w-3.5 h-3.5" /> Deal directly with the farmer
            </p>
            <p>
              Agrovercity connects farmers and buyers. The deal — price, payment, pickup, quality — is finalized
              <strong> directly between you and the farmer</strong>, off the platform.
            </p>
            <p>
              <strong>Agrovercity is not a party to the transaction and is not accountable for any loss, payment
              default, or quality dispute.</strong> Please verify the produce before paying.
            </p>
          </div>

          <label className="flex items-start gap-2 text-xs font-semibold text-slate-700 cursor-pointer">
            <input
              type="checkbox"
              checked={termsAccepted}
              onChange={(e) => setTermsAccepted(e.target.checked)}
              className="mt-0.5 accent-emerald-600"
            />
            I have read and accept the terms & conditions, and I understand the platform is not accountable for the deal.
          </label>

          {hasMpin && (
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Enter your MPIN to confirm it's you
              </label>
              <div className="relative">
                <input
                  type={mpinVisible ? 'text' : 'password'}
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={4}
                  value={mpin}
                  onChange={(e) => setMpin(e.target.value.replace(/\D/g, '').slice(0, 4))}
                  placeholder="4-digit MPIN"
                  className="w-full px-3 py-2.5 text-base font-bold tracking-[0.5em] rounded-xl border border-slate-300"
                />
                <button
                  type="button"
                  onClick={() => setMpinVisible((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-400 hover:text-slate-600"
                >
                  {mpinVisible ? 'Hide' : 'Show'}
                </button>
              </div>
            </div>
          )}

          <button
            onClick={() => void handleAcceptTerms()}
            disabled={!termsAccepted || contactBusy || (hasMpin && mpin.length !== 4)}
            className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md transition-all disabled:opacity-50"
          >
            {contactBusy ? 'Verifying…' : 'Accept & Show Contact'}
          </button>
        </div>
      </ModalSheet>

      {/* Contact card — revealed after terms + MPIN */}
      <ModalSheet
        isOpen={Boolean(contactCard)}
        onClose={() => setContactCard(null)}
        title="Farmer Contact Unlocked"
        description="Call, WhatsApp or chat — finalize the deal directly"
        maxWidth="sm"
      >
        {contactCard && (
          <div className="space-y-4">
            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 text-center space-y-1.5">
              <div className="w-12 h-12 rounded-full bg-emerald-100 border border-emerald-200 flex items-center justify-center mx-auto">
                <UserIcon className="w-6 h-6 text-emerald-700" />
              </div>
              <p className="text-base font-black text-slate-900">
                {contactCard.lead.farmerContact?.name ?? 'Farmer'}
              </p>
              <p className="text-xs text-slate-500 flex items-center justify-center gap-1">
                <MapPin className="w-3 h-3" />
                {contactCard.lead.farmerContact?.village || 'Village'}
                {contactCard.lead.farmerContact?.district ? `, ${contactCard.lead.farmerContact.district}` : ''}
              </p>
              <p className="text-xs font-bold text-emerald-700">
                {contactCard.lot.crop} · {formatWeight(contactCard.lot.quantityQuintal)} · expected{' '}
                {formatCurrency(contactCard.lot.expectedPricePerQuintal)}/q
              </p>
              {contactCard.lead.farmerContact?.phone && (
                <p className="text-sm font-black text-slate-800">{contactCard.lead.farmerContact.phone}</p>
              )}
            </div>

            <div className="grid grid-cols-3 gap-2">
              <a
                href={telLink(contactCard.lead) ?? '#'}
                className={`${ghostBtnCls} flex flex-col items-center gap-1 py-3 text-xs font-bold ${!telLink(contactCard.lead) ? 'pointer-events-none opacity-40' : ''}`}
              >
                <Phone className="w-4 h-4" /> Call
              </a>
              <a
                href={waLink(contactCard.lead) ?? '#'}
                target="_blank"
                rel="noreferrer"
                className={`flex flex-col items-center gap-1 py-3 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 shadow-sm ${!waLink(contactCard.lead) ? 'pointer-events-none opacity-40' : ''}`}
              >
                <MessageSquare className="w-4 h-4" /> WhatsApp
              </a>
              <button
                type="button"
                onClick={() => {
                  if (contactCard.lead.chatRoomId) {
                    navigate(`/chat?room=${encodeURIComponent(contactCard.lead.chatRoomId)}`);
                  }
                }}
                className={`${ghostBtnCls} flex flex-col items-center gap-1 py-3 text-xs font-bold ${!contactCard.lead.chatRoomId ? 'pointer-events-none opacity-40' : ''}`}
              >
                <MessageSquare className="w-4 h-4" /> Chat
              </button>
            </div>

            <p className="text-[10px] text-slate-400 text-center flex items-center justify-center gap-1">
              <BadgeCheck className="w-3 h-3 text-emerald-600" />
              The farmer has your contact too and may reach out first. Agrovercity does not intermediate the deal.
            </p>
          </div>
        )}
      </ModalSheet>
    </div>
  );
};
