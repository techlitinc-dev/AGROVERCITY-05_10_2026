import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search,
  MapPin,
  Package,
  Phone,
  MessageSquare,
  ShieldAlert,
  BadgeCheck,
  User as UserIcon,
} from 'lucide-react';
import { lots, users, leads as leadsApi, apiErrorMessage } from '../../lib/api';
import { isKycError, type Lead } from '../../lib/api/leads';
import { ModalSheet } from '../../components/common/ModalSheet';
import { formatCurrency, formatWeight } from '../../lib/utils';
import { DIRECT_CONNECT_TERMS } from '../trade/MyConnectionsView';

const COMMON_CROPS = ['All', 'Soybean', 'Onion', 'Wheat', 'Cotton', 'Maize', 'Tomato', 'Turmeric', 'Chilli'];

type SortKey = 'recency' | 'priceAsc' | 'priceDesc' | 'quantity';

interface BrowseLot {
  id: string;
  crop: string;
  variety?: string;
  grade?: string;
  quantityQuintal: number;
  expectedPricePerQuintal: number;
  harvestDate?: string;
  location?: string;
  photos?: string[];
  farmerName?: string;
  farmerVillage?: string;
  /** Server-derived identity-verification badge (spec §9). */
  farmerVerified?: boolean;
  createdAt?: string;
}

/**
 * Find Produce — the Vyapari's farmgate discovery (spec §5, Journey A).
 *
 * Essential filters only: crop, district/state, sort. Cards show produce
 * details and the farmer's verification badge — never phone/WhatsApp. Contact
 * unlock = terms + MPIN, idempotent, then Call / WhatsApp / Chat. No Buy Now,
 * no escrow, no platform checkout.
 */
export const SellerLotDiscoveryView: React.FC = () => {
  const navigate = useNavigate();
  const [lotList, setLotList] = useState<BrowseLot[]>([]);
  const [myLeads, setMyLeads] = useState<Lead[]>([]);
  const [hasMpin, setHasMpin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // Essential filters only (spec §5)
  const [crop, setCrop] = useState('All');
  const [state, setState] = useState('');
  const [sortBy, setSortBy] = useState<SortKey>('recency');

  // Contact flow
  const [contactLot, setContactLot] = useState<BrowseLot | null>(null);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [mpin, setMpin] = useState('');
  const [contactBusy, setContactBusy] = useState(false);
  const [contactCard, setContactCard] = useState<{ lot: BrowseLot; lead: Lead } | null>(null);

  const loadLots = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params: Record<string, unknown> = {};
      if (crop !== 'All') params.crop = crop;
      if (state) params.state = state;
      setLotList((await lots.browse(params)) as BrowseLot[]);
    } catch (e) {
      setError(apiErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }, [crop, state]);

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

  const sorted = [...lotList];
  sorted.sort((a, b) => {
    if (sortBy === 'priceAsc') return a.expectedPricePerQuintal - b.expectedPricePerQuintal;
    if (sortBy === 'priceDesc') return b.expectedPricePerQuintal - a.expectedPricePerQuintal;
    if (sortBy === 'quantity') return b.quantityQuintal - a.quantityQuintal;
    return (b.createdAt || '').localeCompare(a.createdAt || '');
  });

  const leadForLot = (lotId: string): Lead | undefined =>
    myLeads.find((l) => l.lotId === lotId && l.status !== 'dismissed');

  const openContact = (lot: BrowseLot) => {
    const existing = leadForLot(lot.id);
    if (existing) {
      setContactCard({ lot, lead: existing });
      return;
    }
    setContactLot(lot);
    setTermsAccepted(false);
    setMpin('');
  };

  const handleAcceptTerms = async () => {
    if (!contactLot) return;
    setContactBusy(true);
    setError(null);
    try {
      const { lead } = await leadsApi.createLead(contactLot.id, termsAccepted, mpin.trim() || undefined);
      setContactLot(null);
      setContactCard({ lot: contactLot, lead });
      setNotice(`Contact details unlocked for ${contactLot.crop} — call or WhatsApp the farmer directly.`);
      await loadMyLeads();
    } catch (err) {
      if (isKycError(err)) {
        setError('Complete your identity verification (KYC) to contact farmers — see Profile & Verification.');
        setContactLot(null);
      } else {
        setError(apiErrorMessage(err));
        if (leadsApi.isMpinError(err)) setError('Incorrect MPIN — try again.');
        setContactLot(null);
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
      <div className="border-b border-slate-200 pb-5">
        <h1 className="text-xl sm:text-2xl font-black text-slate-900 flex items-center gap-2.5">
          <Search className="w-7 h-7 text-emerald-600" />
          Find Produce
        </h1>
        <p className="text-xs text-slate-500 mt-1 font-medium">
          Browse farmer lots and contact the farmer directly — price, payment, pickup and quality are settled
          between you two. Agrovercity never holds money.
        </p>
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

      {/* Filter bar — essential filters only */}
      <div className="bg-white rounded-3xl p-4 border border-slate-200/80 space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1 overflow-x-auto py-1 no-scrollbar">
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
            <input
              type="text"
              placeholder="District / state"
              value={state}
              onChange={(e) => setState(e.target.value)}
              className="text-xs font-semibold bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 w-36"
            />
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortKey)}
              className="text-xs font-bold bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5"
            >
              <option value="recency">Latest first</option>
              <option value="priceAsc">Price: low → high</option>
              <option value="priceDesc">Price: high → low</option>
              <option value="quantity">Quantity: high → low</option>
            </select>
          </div>
        </div>
      </div>

      {/* Lot cards */}
      {loading ? (
        <div className="py-24 text-center text-xs font-bold text-slate-400 animate-pulse">Scanning farmgate lots…</div>
      ) : sorted.length === 0 ? (
        <div className="bg-white rounded-3xl py-16 text-center border border-slate-200/80 space-y-3">
          <Package className="w-10 h-10 text-slate-300 mx-auto" />
          <h3 className="text-sm font-bold text-slate-800">No Produce Lots Found</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            No open lots match this crop or area right now. Try another crop — farmers list fresh lots daily.
          </p>
          <button
            type="button"
            onClick={() => {
              setCrop('All');
              setState('');
            }}
            className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50"
          >
            Reset Filters
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {sorted.map((lot) => {
            const photos = Array.isArray(lot.photos) ? lot.photos : [];
            const existingLead = leadForLot(lot.id);
            return (
              <div
                key={lot.id}
                className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-xs flex flex-col justify-between hover:border-emerald-400 hover:shadow-lg transition-all space-y-4"
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="text-base font-black text-slate-900">{lot.crop}</h3>
                        {lot.farmerVerified && (
                          <span className="text-[10px] font-bold text-sky-700 bg-sky-50 border border-sky-200 px-2 py-0.5 rounded-full flex items-center gap-1">
                            <BadgeCheck className="w-3 h-3" /> Verified Farmer
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-500 font-semibold">
                        {lot.variety || 'Standard'} · Grade {lot.grade || 'A'} · by {lot.farmerName || 'Farmer'}
                        {lot.farmerVillage ? `, ${lot.farmerVillage}` : ''}
                      </p>
                    </div>
                    <div className="text-right">
                      <div className="text-lg font-black text-emerald-700">
                        {formatCurrency(lot.expectedPricePerQuintal)}
                        <span className="text-[10px] text-slate-400 font-medium"> /qt</span>
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
                      <span className="text-[10px] font-bold text-slate-400 uppercase block">Available</span>
                      <span className="font-extrabold text-slate-800">{formatWeight(lot.quantityQuintal)}</span>
                    </div>
                    <div>
                      <span className="text-[10px] font-bold text-slate-400 uppercase block">Pickup Area</span>
                      <span className="font-extrabold text-slate-800 flex items-center gap-1">
                        <MapPin className="w-3 h-3 text-emerald-600" />
                        {lot.location || '—'}
                      </span>
                    </div>
                    <div className="col-span-2 pt-1 border-t border-slate-200/60 text-[11px] text-slate-400">
                      {lot.harvestDate ? `Harvested: ${lot.harvestDate}` : 'Ready for pickup'}
                    </div>
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => openContact(lot)}
                    className={`${existingLead ? 'border border-slate-200 text-slate-600 hover:bg-slate-50' : 'bg-emerald-600 hover:bg-emerald-700 text-white'} w-full text-xs font-black py-2.5 rounded-xl shadow-sm transition-all`}
                  >
                    {existingLead ? 'View Contact Again' : 'Contact Farmer'}
                  </button>
                  <p className="text-[10px] text-slate-400 text-center mt-1.5">
                    {existingLead
                      ? 'Contact already unlocked — call, WhatsApp or chat.'
                      : 'Unlock contact — accept terms & verify MPIN. No platform payment.'}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Terms + MPIN — protects the contact reveal (idempotent) */}
      <ModalSheet
        isOpen={Boolean(contactLot)}
        onClose={() => setContactLot(null)}
        title="Connect Directly with the Farmer"
        description={
          contactLot
            ? `${contactLot.crop} · ${formatWeight(contactLot.quantityQuintal)} · expected ${formatCurrency(contactLot.expectedPricePerQuintal)}/q · ${contactLot.location || 'pickup at farm'}`
            : undefined
        }
        maxWidth="sm"
      >
        <div className="space-y-4">
          <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-[11px] text-amber-900 leading-relaxed">
            {DIRECT_CONNECT_TERMS}
          </div>

          {contactLot?.farmerVerified && (
            <p className="text-[11px] font-bold text-sky-700 flex items-center gap-1.5">
              <BadgeCheck className="w-3.5 h-3.5" /> This farmer's identity is verified (verification means identity only).
            </p>
          )}

          <label className="flex items-start gap-2 text-xs font-semibold text-slate-700 cursor-pointer">
            <input
              type="checkbox"
              checked={termsAccepted}
              onChange={(e) => setTermsAccepted(e.target.checked)}
              className="mt-0.5 accent-emerald-600"
            />
            I have read and accept the direct-connect terms.
          </label>

          {hasMpin && (
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Enter your MPIN to confirm it's you</label>
              <input
                type="password"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={4}
                value={mpin}
                onChange={(e) => setMpin(e.target.value.replace(/\D/g, '').slice(0, 4))}
                placeholder="4-digit MPIN"
                className="w-full px-3 py-2.5 text-base font-bold tracking-[0.5em] rounded-xl border border-slate-300"
              />
            </div>
          )}

          <button
            onClick={() => void handleAcceptTerms()}
            disabled={!termsAccepted || contactBusy || (hasMpin && mpin.length !== 4)}
            className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md transition-all disabled:opacity-50"
          >
            {contactBusy ? 'Verifying…' : 'Accept & Show Contact'}
          </button>
          <p className="text-[10px] text-slate-400 text-center flex items-center justify-center gap-1">
            <ShieldAlert className="w-3 h-3" />
            There is no Buy Now or advance payment here — you deal with the farmer directly.
          </p>
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
              {contactCard.lead.farmerContact?.verified !== false && (
                <p className="text-[10px] font-bold text-sky-700 flex items-center justify-center gap-1">
                  <BadgeCheck className="w-3 h-3" /> Identity verified
                </p>
              )}
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
                className={`flex flex-col items-center gap-1 py-3 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50 ${!telLink(contactCard.lead) ? 'pointer-events-none opacity-40' : ''}`}
              >
                <Phone className="w-4 h-4" /> Call
              </a>
              <a
                href={waLink(contactCard.lead) ?? '#'}
                target="_blank"
                rel="noreferrer"
                className={`flex flex-col items-center gap-1 py-3 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 ${!waLink(contactCard.lead) ? 'pointer-events-none opacity-40' : ''}`}
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
                className={`flex flex-col items-center gap-1 py-3 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50 ${!contactCard.lead.chatRoomId ? 'pointer-events-none opacity-40' : ''}`}
              >
                <MessageSquare className="w-4 h-4" /> Chat
              </button>
            </div>

            <p className="text-[10px] text-slate-400 text-center flex items-center justify-center gap-1">
              <BadgeCheck className="w-3 h-3 text-emerald-600" />
              The farmer has your contact too. Agrovercity does not intermediate the deal.
            </p>
          </div>
        )}
      </ModalSheet>
    </div>
  );
};
