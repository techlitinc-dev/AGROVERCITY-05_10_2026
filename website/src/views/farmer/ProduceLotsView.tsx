import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Package,
  Plus,
  MapPin,
  CheckCircle2,
  Pencil,
  Trash2,
  Phone,
  MessageSquare,
  Check,
  TrendingUp,
  Users,
  Camera,
  BadgeCheck,
  Handshake,
} from 'lucide-react';
import { lots, users, leads as leadsApi, uploads, apiErrorMessage, readOne, readList } from '../../lib/api';
import type { Lead } from '../../lib/api';
import { ModalSheet } from '../../components/common/ModalSheet';
import { StatusBadge } from '../../components/common/StatusBadge';
import { formatCurrency, formatWeight, formatDateTime } from '../../lib/utils';
import type { ProduceLot, MandiPrice } from '../../types';

interface CatalogCrop {
  name: string;
  vernacularName?: string | null;
  category?: string | null;
  mspPaisa?: number | null;
}

/**
 * Real released crop varieties (ICAR / state agri-university catalogs,
 * Maharashtra-relevant). Used only as typeahead suggestions — farmers can
 * always type a variety that is not listed.
 */
const CROP_VARIETIES: [string, string[]][] = [
  ['soybean', ['JS 335', 'JS 9560', 'JS 2034', 'JS 93-05', 'NRC 86']],
  ['wheat', ['Lokwan', 'HD 2967', 'HD 3086', 'GW 322', 'DDK 1029 (Khapli)']],
  ['cotton', ['Bt Cotton BG-II (RCH 659)', 'Bunny Bt', 'NHH 44', 'PKV Hy-2']],
  ['onion', ['Nashik Red', 'Agrifound Dark Red', 'Phule Samarth', 'Arka Kalyan']],
  ['pigeonpea', ['BDN 711', 'BDN 716', 'ASHA (ICPL 87119)']],
  ['tur', ['BDN 711', 'BDN 716', 'ASHA (ICPL 87119)']],
  ['chickpea', ['JG 11', 'JAKI 9218', 'Vishal', 'Phule G 0515']],
  ['maize', ['DHM 117', 'HQPM 1', 'Pratap QPM 1', 'NK 6240']],
  ['groundnut', ['JL 24', 'TAG 24', 'TG 37A', 'Girnar 3']],
  ['mustard', ['Pusa Mustard 21', 'Varuna', 'RH 749']],
  ['rice', ['Basmati (Pusa 1121)', 'IR 64', 'Ratna', 'Swarna MTU 7029']],
  ['paddy', ['Basmati (Pusa 1121)', 'IR 64', 'Ratna', 'Swarna MTU 7029']],
  ['sorghum', ['CSH 16', 'CSH 30', 'CSV 216 (Maldandi)']],
  ['jowar', ['CSH 16', 'CSH 30', 'CSV 216 (Maldandi)']],
  ['bajra', ['HB 3', 'ICTP 8203', 'Dhanashakti']],
  ['millet', ['HB 3', 'ICTP 8203', 'Dhanashakti']],
  ['tomato', ['Pusa Ruby', 'Arka Vikas', 'US 440 Hybrid', 'Phule Raja']],
  ['potato', ['Kufri Jyoti', 'Kufri Pukhraj', 'Kufri Chipsona']],
  ['grapes', ['Thompson Seedless', 'Sharad Seedless', 'Flame Seedless']],
  ['sugarcane', ['Co 86032', 'CoM 0265', 'VSI 434']],
  ['moong', ['SGC 16 (Samrat)', 'IPM 02-3', 'Kopargaon']],
  ['green gram', ['SGC 16 (Samrat)', 'IPM 02-3', 'Kopargaon']],
  ['urad', ['Pant U 31', 'KU 301', 'VBN 5']],
  ['black gram', ['Pant U 31', 'KU 301', 'VBN 5']],
  ['chilli', ['Byadgi', 'Guntur Sannam', 'Jwala', 'Phule Jyoti']],
  ['turmeric', ['Salem', 'Rajapuri', 'Krishna', 'Phule Swarupa']],
  ['garlic', ['Agrifound White', 'Yamuna Safed', 'Bhima Purple']],
  ['watermelon', ['Sugar Baby', 'Arka Jyoti', 'Dushyant']],
  ['banana', ['Grand Naine', 'Robusta', 'Dwarf Cavendish']],
  ['mango', ['Kesar', 'Alphonso (Hapus)', 'Totapuri', 'Langra']],
  ['pomegranate', ['Bhagwa', 'Ganesh', 'Arakta']],
  ['orange', ['Nagpur Mandarin', 'Mosambi (Satgudi)']],
  ['cauliflower', ['Pusa Katki', 'Phule Gauri', 'Him Palam']]
];

type LeadFilter = 'all' | 'new' | 'contacted' | 'sold';

export const ProduceLotsView: React.FC = () => {
  const navigate = useNavigate();
  const [lotsList, setLotsList] = useState<ProduceLot[]>([]);
  const [leadList, setLeadList] = useState<Lead[]>([]);
  const [leadFilter, setLeadFilter] = useState<LeadFilter>('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [profile, setProfile] = useState<{ village?: string; district?: string; name?: string }>({});

  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [editingLot, setEditingLot] = useState<ProduceLot | null>(null);
  const [soldLot, setSoldLot] = useState<ProduceLot | null>(null);
  const [soldRate, setSoldRate] = useState<number>(0);
  const [soldLead, setSoldLead] = useState<Lead | null>(null);

  // Real reference data: crop catalog (vernacular names + MSP) and mandi modal
  // prices, both served live from the backend — never hardcoded sample rows.
  const [cropCatalog, setCropCatalog] = useState<CatalogCrop[]>([]);
  const [mandiRows, setMandiRows] = useState<MandiPrice[]>([]);

  // Lot form state — location defaults come from the farmer's own profile.
  const [newCrop, setNewCrop] = useState('');
  const [newVariety, setNewVariety] = useState('');
  const [newQuantity, setNewQuantity] = useState<number>(20);
  const [newGrade, setNewGrade] = useState<'A' | 'B' | 'C' | 'Ungraded'>('A');
  const [newPrice, setNewPrice] = useState<number>(0);
  const [newLocation, setNewLocation] = useState('');
  const [newVillage, setNewVillage] = useState('');
  const [newHarvestDate, setNewHarvestDate] = useState(new Date().toISOString().slice(0, 10));
  const [newPhotoUrl, setNewPhotoUrl] = useState('');
  const [photoBusy, setPhotoBusy] = useState(false);
  const photoInputRef = useRef<HTMLInputElement>(null);

  const reload = async () => {
    const [l, received] = await Promise.all([
      lots.list(),
      leadsApi.getMyLeads('received').catch(() => [] as Lead[]),
    ]);
    // Withdrawn lots are the farmer's "delete" — never resurface them here.
    setLotsList(l.filter((lot) => lot.status !== 'withdrawn'));
    setLeadList(received);
  };

  useEffect(() => {
    let active = true;
    setLoading(true);
    reload()
      .catch((e) => active && setError(apiErrorMessage(e)))
      .finally(() => active && setLoading(false));
    // Full crop catalog (vernacular names + MSP) for the crop typeahead.
    readOne<{ items: CatalogCrop[] }>('/reference/crops-suggest', { params: { q: '', limit: 100 } })
      .then((res) => active && setCropCatalog(res?.items ?? []))
      .catch(() => {});
    // Profile seeds the form defaults (village/district) — no demo data.
    users
      .getMe()
      .then((me) => {
        if (!active) return;
        setProfile({ village: me.village, district: me.district, name: me.name });
        setNewVillage(me.village || '');
        setNewLocation([me.village, me.district].filter(Boolean).join(', '));
      })
      .catch(() => {});
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Live mandi benchmark rows for the typed crop — real APMC/Agmarknet prices.
  useEffect(() => {
    const crop = newCrop.trim();
    if (!crop) {
      setMandiRows([]);
      return;
    }
    const timer = setTimeout(() => {
      readList<MandiPrice>('/mandi/prices', { params: { crop, pageSize: 6 } })
        .then((rows) => {
          const anyRows = rows as (MandiPrice & { distanceKm?: number })[];
          const local = anyRows.filter((r) => r.distanceKm != null);
          const national = anyRows.filter((r) => r.distanceKm == null);
          setMandiRows([...local, ...national].slice(0, 3) as MandiPrice[]);
        })
        .catch(() => setMandiRows([]));
    }, 250);
    return () => clearTimeout(timer);
  }, [newCrop]);

  // Real released varieties matching the typed crop (falls back to empty = free text).
  const varietyOptions = useMemo(() => {
    const needle = newCrop.trim().toLowerCase();
    if (needle.length < 2) return [];
    for (const [key, list] of CROP_VARIETIES) {
      if (needle.includes(key)) return list;
    }
    return [];
  }, [newCrop]);

  // MSP: catalog row first, else any mandi row that carries the notified MSP.
  const mspPerQuintal = useMemo(() => {
    const fromCatalog = cropCatalog.find(
      (c) => c.name.toLowerCase() === newCrop.trim().toLowerCase()
    )?.mspPaisa;
    if (fromCatalog) return Math.round(fromCatalog / 100);
    const fromMandi = (mandiRows as (MandiPrice & { msp?: number })[]).find((r) => r.msp)?.msp;
    return fromMandi ?? null;
  }, [cropCatalog, newCrop, mandiRows]);

  const leadCountForLot = (lotId: string): number =>
    leadList.filter((lead) => lead.lotId === lotId && lead.status !== 'dismissed').length;

  const visibleLeads = leadList.filter(
    (lead) => leadFilter === 'all' || lead.status === leadFilter
  );

  const openEditModal = (lot: ProduceLot) => {
    setEditingLot(lot);
    setNewCrop(lot.crop);
    setNewVariety(lot.variety);
    setNewQuantity(lot.quantityQuintal);
    setNewGrade(lot.grade);
    setNewPrice(lot.expectedPricePerQuintal);
    setNewLocation(lot.location);
    setNewVillage(lot.village || '');
    setNewHarvestDate(lot.harvestDate || new Date().toISOString().slice(0, 10));
    setNewPhotoUrl((lot as ProduceLot & { photos?: string[] }).photos?.[0] || '');
    setCreateModalOpen(true);
  };

  const resetForm = () => {
    setEditingLot(null);
    setNewCrop('');
    setNewVariety('');
    setNewQuantity(20);
    setNewGrade('A');
    setNewPrice(0);
    setNewLocation([profile.village, profile.district].filter(Boolean).join(', '));
    setNewVillage(profile.village || '');
    setNewHarvestDate(new Date().toISOString().slice(0, 10));
    setNewPhotoUrl('');
  };

  const handlePhotoPicked = async (file: File | undefined) => {
    if (!file) return;
    setPhotoBusy(true);
    setError(null);
    try {
      const uploaded = (await uploads.upload(file, { folder: 'lots', purpose: 'lot-photo' })) as
        | { url?: string; fileUrl?: string }
        | undefined;
      const url = uploaded?.url ?? uploaded?.fileUrl ?? '';
      if (!url) throw new Error('Upload succeeded but no URL was returned.');
      setNewPhotoUrl(url);
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setPhotoBusy(false);
      if (photoInputRef.current) photoInputRef.current.value = '';
    }
  };

  const handleSaveLot = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      const photosArray = newPhotoUrl.trim() ? [newPhotoUrl.trim()] : [];
      if (editingLot) {
        const updated = await lots.update(editingLot.id, {
          crop: newCrop,
          variety: newVariety,
          quantityQuintal: newQuantity,
          grade: newGrade,
          expectedPricePerQuintal: newPrice,
          location: newLocation,
          village: newVillage,
          harvestDate: newHarvestDate,
          photos: photosArray,
        });
        setLotsList((prev) => prev.map((l) => (l.id === updated.id ? updated : l)));
        setNotice(`Lot #${updated.id} updated.`);
      } else {
        // Post directly to the marketplace — no moderation gate.
        const created = await lots.create({
          crop: newCrop,
          variety: newVariety,
          quantityQuintal: newQuantity,
          grade: newGrade,
          expectedPricePerQuintal: newPrice,
          location: newLocation,
          village: newVillage,
          harvestDate: newHarvestDate,
          photos: photosArray,
          submitForReview: false,
        });
        setLotsList((prev) => [created, ...prev]);
        setNotice('Produce lot posted — buyers can contact you now.');
      }
      setCreateModalOpen(false);
      resetForm();
    } catch (err) {
      setError(apiErrorMessage(err));
    }
  };

  const handleWithdrawLot = async (id: string) => {
    setError(null);
    setBusyId(id);
    try {
      await lots.remove(id);
      setLotsList((prev) => prev.filter((l) => l.id !== id));
      setNotice('Lot withdrawn from the marketplace.');
    } catch (e) {
      setError(apiErrorMessage(e));
    } finally {
      setBusyId(null);
    }
  };

  const openMarkSold = (lot: ProduceLot) => {
    setSoldLot(lot);
    setSoldRate(lot.expectedPricePerQuintal);
  };

  const confirmMarkSold = async () => {
    if (!soldLot) return;
    setError(null);
    setBusyId(soldLot.id);
    try {
      const updated = (await leadsApi.markLotSold(soldLot.id, soldRate || undefined)) as ProduceLot;
      setLotsList((prev) => prev.map((l) => (l.id === updated.id ? { ...l, ...updated } : l)));
      setNotice(
        `Lot #${soldLot.id} marked sold${soldRate ? ` at ${formatCurrency(soldRate)}/q` : ''} — great trade!`
      );
      setSoldLot(null);
    } catch (e) {
      setError(apiErrorMessage(e));
    } finally {
      setBusyId(null);
    }
  };

  const setLeadStatus = async (lead: Lead, status: Lead['status'], finalRate?: number) => {
    setError(null);
    setBusyId(lead.id);
    try {
      const updated = await leadsApi.updateLeadStatus(lead.id, status, finalRate);
      setLeadList((prev) => prev.map((l) => (l.id === updated.id ? updated : l)));
      if (status === 'sold') {
        setNotice(`Deal with ${lead.buyerContact?.name ?? 'buyer'} recorded — lot marked sold.`);
        await reload();
      } else if (status === 'dismissed') {
        setNotice('Lead dismissed.');
      }
    } catch (e) {
      setError(apiErrorMessage(e));
    } finally {
      setBusyId(null);
    }
  };

  const openLeadSold = (lead: Lead) => {
    setSoldLead(lead);
    setSoldRate(lead.finalRate ?? lead.expectedRate ?? 0);
  };

  const confirmLeadSold = async () => {
    if (!soldLead) return;
    await setLeadStatus(soldLead, 'sold', soldRate || undefined);
    setSoldLead(null);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 flex items-center gap-2">
            <Package className="w-7 h-7 text-emerald-600" />
            Sell Produce — Lots & Buyer Leads
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Post your produce lot — interested agri/vyapari buyers see it and contact you directly (call / WhatsApp / chat). You negotiate and close the deal yourself.
          </p>
        </div>

        <button
          onClick={() => {
            resetForm();
            setCreateModalOpen(true);
          }}
          className="px-4 py-2.5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-bold text-xs shadow-md flex items-center gap-2 self-start sm:self-auto transition-all"
        >
          <Plus className="w-4 h-4" />
          <span>Post New Produce Lot</span>
        </button>
      </div>

      {error && (
        <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-2xl text-xs font-semibold text-rose-800">
          {error}
        </div>
      )}
      {notice && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-2xl text-xs font-semibold text-emerald-800 flex items-center justify-between animate-in fade-in">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>{notice}</span>
          </div>
          <button onClick={() => setNotice(null)} className="font-bold hover:underline">Dismiss</button>
        </div>
      )}

      {/* Section 1: Active Lots Grid */}
      <div className="space-y-3">
        <h3 className="font-bold text-sm text-slate-900">My Listed Produce Lots ({lotsList.length})</h3>

        {loading ? (
          <div className="py-10 text-center text-xs font-bold text-slate-400 animate-pulse">
            Loading your produce lots…
          </div>
        ) : lotsList.length === 0 ? (
          <div className="py-10 text-center text-xs font-semibold text-slate-400 bg-white rounded-3xl border border-slate-200/80">
            No lots listed yet. Post your first produce lot to start receiving buyer leads.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {lotsList.map((lot) => (
              <div
                key={lot.id}
                className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-xs hover:border-slate-300 transition-all flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                        Grade {lot.grade}
                      </span>
                      <h4 className="text-base font-extrabold text-slate-900 mt-1.5">
                        {lot.crop} ({lot.variety})
                      </h4>
                      <p className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                        <MapPin className="w-3.5 h-3.5 text-slate-400" /> {lot.location}
                      </p>
                    </div>
                    <StatusBadge status={lot.status} />
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-2 p-3 bg-slate-50 rounded-2xl text-xs">
                    <div>
                      <span className="text-slate-400 text-[10px] uppercase font-bold">Quantity</span>
                      <p className="font-bold text-slate-800">{formatWeight(lot.quantityQuintal)}</p>
                    </div>
                    <div>
                      <span className="text-slate-400 text-[10px] uppercase font-bold">Expected Price</span>
                      <p className="font-bold text-emerald-700">
                        {formatCurrency(lot.expectedPricePerQuintal)}
                        <span className="text-[10px] text-slate-500">/q</span>
                      </p>
                    </div>
                  </div>
                </div>

                {(lot as ProduceLot & { finalRate?: number }).finalRate ? (
                  <div className="mt-2 p-2 bg-emerald-50 rounded-xl border border-emerald-200 text-[10px] text-emerald-800 font-semibold flex items-center gap-1.5">
                    <Handshake className="w-3.5 h-3.5" />
                    Closed at {formatCurrency((lot as ProduceLot & { finalRate?: number }).finalRate!)}/q
                  </div>
                ) : null}

                {/* Moderation notes if present */}
                {(lot as ProduceLot & { moderation?: { action?: string; reason?: string } }).moderation && (
                  <div className="mt-2 p-2 bg-emerald-50 rounded-xl border border-emerald-200 text-[10px] text-emerald-800 font-semibold flex items-center justify-between">
                    <span>
                      Moderation: {(lot as ProduceLot & { moderation?: { action?: string } }).moderation?.action}
                    </span>
                    <span>{(lot as ProduceLot & { moderation?: { reason?: string } }).moderation?.reason}</span>
                  </div>
                )}

                <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-slate-600 flex items-center gap-1">
                      <Users className="w-3.5 h-3.5 text-emerald-600" />
                      {leadCountForLot(lot.id)} Buyer Leads
                    </span>
                    {lot.status === 'open' && (
                      <button
                        onClick={() => openMarkSold(lot)}
                        disabled={busyId === lot.id}
                        className="px-2.5 py-1 text-[10px] font-black rounded-lg bg-sky-600 text-white hover:bg-sky-700 transition-all disabled:opacity-50"
                      >
                        Mark Sold
                      </button>
                    )}
                    {(lot.status === 'pending_review' || lot.status === 'rejected') && (
                      <button
                        onClick={() => lots.submitForReview(lot.id).then((u) =>
                          setLotsList((prev) => prev.map((l) => (l.id === u.id ? u : l)))
                        ).catch((e) => setError(apiErrorMessage(e)))}
                        disabled={busyId === lot.id}
                        className="px-2.5 py-1 text-[10px] font-black rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 transition-all disabled:opacity-50"
                      >
                        {lot.status === 'pending_review' ? 'In Review' : 'Submit Review'}
                      </button>
                    )}
                  </div>
                  <div className="flex gap-1">
                    {lot.status !== 'sold' && (
                      <button
                        onClick={() => openEditModal(lot)}
                        className="p-1.5 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                        title="Edit lot"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                    )}
                    {lot.status !== 'sold' && (
                      <button
                        onClick={() => handleWithdrawLot(lot.id)}
                        disabled={busyId === lot.id}
                        className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors disabled:opacity-50"
                        title="Withdraw lot"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Section 2: Buyer Leads inbox — the direct-connect model */}
      <div className="space-y-3 pt-4 border-t border-slate-200">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h3 className="font-bold text-sm text-slate-900 flex items-center gap-1.5">
              <Users className="w-4 h-4 text-emerald-600" />
              Buyer Leads ({leadList.filter((l) => l.status !== 'dismissed').length})
            </h3>
            <p className="text-xs text-slate-400">
              Buyers who tapped "Contact Farmer" on your lots. Call, WhatsApp or chat with them and close the deal directly — then mark it sold.
            </p>
          </div>
          <div className="flex bg-slate-100 p-1 rounded-2xl self-start overflow-x-auto">
            {(['all', 'new', 'contacted', 'sold'] as LeadFilter[]).map((f) => (
              <button
                key={f}
                onClick={() => setLeadFilter(f)}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all capitalize whitespace-nowrap ${
                  leadFilter === f ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500'
                }`}
              >
                {f === 'all' ? 'All' : f}
              </button>
            ))}
          </div>
        </div>

        {visibleLeads.length === 0 ? (
          <div className="py-8 text-center text-xs font-semibold text-slate-400 bg-white rounded-3xl border border-slate-200/80">
            {leadFilter === 'all'
              ? 'No buyer leads yet. They will appear here when buyers contact you about your lots.'
              : `No ${leadFilter} leads right now.`}
          </div>
        ) : (
          <div className="space-y-3">
            {visibleLeads.map((lead) => (
              <div
                key={lead.id}
                className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4"
              >
                <div className="space-y-1.5 max-w-xl">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-extrabold text-sm text-slate-900">
                      {lead.buyerContact?.fullName || 'Buyer'}
                    </span>
                    {lead.buyerContact?.verified && (
                      <span className="text-[10px] font-bold text-sky-700 bg-sky-50 border border-sky-200 px-2 py-0.5 rounded-full flex items-center gap-1">
                        <BadgeCheck className="w-3 h-3" /> Verified Vyapari
                      </span>
                    )}
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full border capitalize ${
                        lead.status === 'new'
                          ? 'text-emerald-700 bg-emerald-50 border-emerald-200'
                          : lead.status === 'sold'
                            ? 'text-slate-600 bg-slate-100 border-slate-200'
                            : 'text-amber-700 bg-amber-50 border-amber-200'
                      }`}
                    >
                      {lead.status}
                    </span>
                  </div>
                  <p className="text-xs text-slate-600">
                    Interested in: <strong>{lead.lotCrop} ({lead.lotVariety})</strong> — {formatWeight(lead.quantityQuintals ?? 0)} · expected {formatCurrency(lead.expectedRate ?? 0)}/q
                  </p>
                  {lead.finalRate ? (
                    <p className="text-xs font-bold text-emerald-700">Closed at {formatCurrency(lead.finalRate)}/q</p>
                  ) : null}
                  <p className="text-[10px] text-slate-400">{formatDateTime(lead.createdAt)}</p>
                  {lead.buyerContact?.phoneDigits && (
                    <p className="text-xs font-bold text-slate-700">
                      📞 {lead.buyerContact.phone}
                      {lead.buyerContact.whatsappDigits
                        ? ` · WhatsApp ${lead.buyerContact.whatsappDigits.slice(-10)}`
                        : ''}
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-2 self-end md:self-center flex-wrap">
                  {lead.status !== 'sold' && lead.chatRoomId && (
                    <>
                      <button
                        onClick={() => navigate(`/chat?room=${encodeURIComponent(lead.chatRoomId!)}`)}
                        className="p-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-600"
                        title="Chat with buyer"
                      >
                        <MessageSquare className="w-4 h-4" />
                      </button>
                      {lead.buyerContact?.phoneDigits && (
                        <a
                          href={`tel:+${lead.buyerContact.phoneDigits}`}
                          className="p-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-600"
                          title="Call buyer"
                        >
                          <Phone className="w-4 h-4" />
                        </a>
                      )}
                      {lead.buyerContact?.whatsappDigits && (
                        <a
                          href={`https://wa.me/${lead.buyerContact.whatsappDigits}`}
                          target="_blank"
                          rel="noreferrer"
                          className="p-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white"
                          title="WhatsApp buyer"
                        >
                          <MessageSquare className="w-4 h-4" />
                        </a>
                      )}
                    </>
                  )}
                  {lead.status === 'new' && (
                    <button
                      onClick={() => setLeadStatus(lead, 'contacted')}
                      disabled={busyId === lead.id}
                      className="px-3 py-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold text-xs disabled:opacity-50"
                    >
                      Mark Contacted
                    </button>
                  )}
                  {lead.status === 'contacted' && (
                    <button
                      onClick={() => openLeadSold(lead)}
                      disabled={busyId === lead.id}
                      className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs disabled:opacity-50"
                    >
                      Mark Sold
                    </button>
                  )}
                  {lead.status !== 'sold' && (
                    <button
                      onClick={() => setLeadStatus(lead, 'dismissed')}
                      disabled={busyId === lead.id}
                      className="px-2.5 py-2 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 font-bold text-[10px] disabled:opacity-50"
                    >
                      Dismiss
                    </button>
                  )}
                  {lead.status === 'sold' && (
                    <span className="text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-xl flex items-center gap-1">
                      <Check className="w-4 h-4" /> Deal Done
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create / Edit Produce Lot Modal */}
      <ModalSheet
        isOpen={createModalOpen}
        onClose={() => {
          setCreateModalOpen(false);
          resetForm();
        }}
        title={editingLot ? 'Edit Produce Lot' : 'Post New Produce Lot'}
        description={editingLot ? 'Update quantity, grade or expected price' : 'List your harvested crop — buyers contact you directly as soon as you post'}
        maxWidth="lg"
      >
        <form onSubmit={handleSaveLot} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Crop</label>
              <input
                type="text"
                list="lot-crop-options"
                value={newCrop}
                onChange={(e) => setNewCrop(e.target.value)}
                placeholder="Type to search crops — e.g. Onion, Soybean, कांदा"
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300"
                required
              />
              <datalist id="lot-crop-options">
                {cropCatalog.map((c) => (
                  <option key={c.name} value={c.name}>
                    {c.vernacularName || c.category || ''}
                  </option>
                ))}
              </datalist>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Variety</label>
              <input
                type="text"
                list="lot-variety-options"
                value={newVariety}
                onChange={(e) => setNewVariety(e.target.value)}
                placeholder={varietyOptions.length > 0 ? varietyOptions.join(' / ') : 'e.g. JS 335, Nashik Red'}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300"
                required
              />
              <datalist id="lot-variety-options">
                {varietyOptions.map((v) => (
                  <option key={v} value={v} />
                ))}
              </datalist>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Quantity (q)</label>
              <input
                type="number"
                step={0.5}
                value={newQuantity}
                onChange={(e) => setNewQuantity(Number(e.target.value))}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 font-bold"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Quality Grade</label>
              <select
                value={newGrade}
                onChange={(e) => setNewGrade(e.target.value as 'A' | 'B' | 'C' | 'Ungraded')}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 bg-white"
              >
                <option value="A">Grade A (Export/Premium)</option>
                <option value="B">Grade B (Standard)</option>
                <option value="C">Grade C (Commercial)</option>
                <option value="Ungraded">Ungraded (Field run)</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Expected Price (₹/q)</label>
              <input
                type="number"
                value={newPrice}
                onChange={(e) => setNewPrice(Number(e.target.value))}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 font-bold text-emerald-800"
                required
              />
            </div>
          </div>

          {(mspPerQuintal !== null || mandiRows.length > 0) && (
            <div className="p-3 bg-sky-50 rounded-2xl border border-sky-200 space-y-1.5">
              <p className="text-[10px] font-black uppercase tracking-wider text-sky-700 flex items-center gap-1.5">
                <TrendingUp className="w-3.5 h-3.5" />
                Live market guidance{newCrop.trim() ? ` for ${newCrop.trim()}` : ''} (real APMC / Agmarknet data)
              </p>
              {mspPerQuintal !== null && (
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-600">Govt. MSP (notified minimum)</span>
                  <span className="flex items-center gap-2">
                    <strong className="text-slate-900">{formatCurrency(mspPerQuintal)}/q</strong>
                    <button
                      type="button"
                      onClick={() => setNewPrice(mspPerQuintal)}
                      className="px-2 py-0.5 rounded-lg bg-white border border-sky-200 text-sky-700 font-bold text-[10px] hover:bg-sky-100"
                    >
                      Use MSP
                    </button>
                  </span>
                </div>
              )}
              {mandiRows.map((row) => {
                const r = row as MandiPrice & { mandiName?: string; date?: string };
                return (
                  <div key={r.id} className="flex items-center justify-between text-xs">
                    <span className="text-slate-600">
                      {(r.mandiName || (r as { mandi?: string }).mandi || 'APMC Mandi')}
                      {r.date || (r as { priceDate?: string }).priceDate ? ` · ${r.date || (r as { priceDate?: string }).priceDate}` : ''} (modal)
                    </span>
                    <span className="flex items-center gap-2">
                      <strong className="text-slate-900">{formatCurrency(r.modalPrice)}/q</strong>
                      <button
                        type="button"
                        onClick={() => setNewPrice(Math.round(r.modalPrice))}
                        className="px-2 py-0.5 rounded-lg bg-white border border-sky-200 text-sky-700 font-bold text-[10px] hover:bg-sky-100"
                      >
                        Use
                      </button>
                    </span>
                  </div>
                );
              })}
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Village / Taluka</label>
              <input
                type="text"
                value={newVillage}
                onChange={(e) => setNewVillage(e.target.value)}
                placeholder="e.g. Khed, Niphad"
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Harvest Date</label>
              <input
                type="date"
                value={newHarvestDate}
                onChange={(e) => setNewHarvestDate(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Pickup Location / Gate</label>
            <input
              type="text"
              value={newLocation}
              onChange={(e) => setNewLocation(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Produce Photo</label>
            <div className="flex items-center gap-3">
              <input
                ref={photoInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => void handlePhotoPicked(e.target.files?.[0])}
              />
              <button
                type="button"
                onClick={() => photoInputRef.current?.click()}
                disabled={photoBusy}
                className="px-3 py-2 rounded-xl border border-slate-300 hover:bg-slate-50 text-slate-700 font-bold text-xs flex items-center gap-2 disabled:opacity-50"
              >
                <Camera className="w-4 h-4" />
                {photoBusy ? 'Uploading…' : newPhotoUrl ? 'Change Photo' : 'Upload Photo'}
              </button>
              {newPhotoUrl && (
                <div className="relative">
                  <img src={newPhotoUrl} alt="Produce" className="h-12 w-12 rounded-xl object-cover border border-slate-200" />
                </div>
              )}
            </div>
            <p className="text-[10px] text-slate-400 mt-1">
              A real photo of your produce gets the most buyer leads.
            </p>
          </div>

          <button
            type="submit"
            className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-bold text-xs shadow-md transition-all mt-2"
          >
            {editingLot ? 'Save Lot Changes' : 'Post Produce Lot'}
          </button>
          {!editingLot && (
            <p className="text-[10px] text-slate-400 text-center">
              Your lot goes live immediately — no admin review step. Buyers see your first name and village only; your number is shared only with interested buyers.
            </p>
          )}
        </form>
      </ModalSheet>

      {/* Mark Sold modal (lot-level) */}
      <ModalSheet
        isOpen={Boolean(soldLot)}
        onClose={() => setSoldLot(null)}
        title="Mark Lot as Sold"
        description="Close the loop after you close the deal directly with the buyer"
        maxWidth="sm"
      >
        {soldLot && (
          <div className="space-y-4">
            <div className="p-3 bg-slate-50 rounded-xl text-xs space-y-1">
              <div className="flex justify-between text-slate-600">
                <span>Lot:</span>
                <span className="font-bold text-slate-900">{soldLot.crop} ({soldLot.variety})</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Quantity:</span>
                <span className="font-bold text-slate-900">{formatWeight(soldLot.quantityQuintal)}</span>
              </div>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Final rate you closed at (₹/q, optional)
              </label>
              <input
                type="number"
                min={0}
                value={soldRate}
                onChange={(e) => setSoldRate(Number(e.target.value))}
                className="w-full px-3 py-2.5 text-base font-bold rounded-xl border border-slate-300 text-emerald-800"
              />
            </div>
            <button
              onClick={confirmMarkSold}
              disabled={busyId === soldLot.id}
              className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md transition-all disabled:opacity-50"
            >
              Confirm — Lot Sold
            </button>
          </div>
        )}
      </ModalSheet>

      {/* Mark Sold modal (lead-level) */}
      <ModalSheet
        isOpen={Boolean(soldLead)}
        onClose={() => setSoldLead(null)}
        title="Record the Deal"
        description="Mark this lead as sold — the lot leaves the marketplace"
        maxWidth="sm"
      >
        {soldLead && (
          <div className="space-y-4">
            <div className="p-3 bg-slate-50 rounded-xl text-xs space-y-1">
              <div className="flex justify-between text-slate-600">
                <span>Buyer:</span>
                <span className="font-bold text-slate-900">{soldLead.buyerContact?.fullName || 'Buyer'}</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Lot:</span>
                <span className="font-bold text-slate-900">{soldLead.lotCrop} ({soldLead.lotVariety})</span>
              </div>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Final rate you closed at (₹/q, optional)
              </label>
              <input
                type="number"
                min={0}
                value={soldRate}
                onChange={(e) => setSoldRate(Number(e.target.value))}
                className="w-full px-3 py-2.5 text-base font-bold rounded-xl border border-slate-300 text-emerald-800"
              />
            </div>
            <button
              onClick={confirmLeadSold}
              disabled={busyId === soldLead.id}
              className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md transition-all disabled:opacity-50"
            >
              Confirm — Deal Done
            </button>
          </div>
        )}
      </ModalSheet>
    </div>
  );
};
