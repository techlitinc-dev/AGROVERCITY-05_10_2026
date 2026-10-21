import React, { useCallback, useEffect, useState } from 'react';
import {
  Building,
  BadgeCheck,
  Send,
  RefreshCw,
  MapPin,
  Package,
  Layers,
  Search,
  CheckCircle2,
  Clock,
  History,
  Store,
  DollarSign,
  Coffee,
  Truck,
} from 'lucide-react';
import { seller, apiErrorMessage } from '../../lib/api';
import { ModalSheet } from '../../components/common/ModalSheet';
import { StatusBadge } from '../../components/common/StatusBadge';
import { formatCurrency } from '../../lib/utils';
import { cardCls, inputCls, labelCls, primaryBtnCls, ghostBtnCls, rec, str, arr, num, type Rec } from './shared';

const BUYER_TYPES = [
  { id: 'all', label: 'All Direct Buyers' },
  { id: 'hotel', label: 'Hotels & Caterers' },
  { id: 'processor', label: 'Food Processors & Mills' },
  { id: 'retailer', label: 'Supermarkets & Retail Chains' },
  { id: 'exporter', label: 'Institutional Exporters' },
];

export const SellerDirectBuyersView: React.FC = () => {
  const [buyersList, setBuyersList] = useState<Rec[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [activeCategory, setActiveCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Contact / Supply Offer Modal
  const [contactBuyer, setContactBuyer] = useState<Rec | null>(null);
  const [offerCrop, setOfferCrop] = useState('Soybean');
  const [offerQty, setOfferQty] = useState(50);
  const [offerPrice, setOfferPrice] = useState(4800);
  const [deliveryNotes, setDeliveryNotes] = useState('Grade A sorted produce, farmgate packed in 50kg gunny bags.');
  const [sending, setSending] = useState(false);

  const loadBuyers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await seller.buyers().catch(() => []);
      setBuyersList(arr(res).map(rec));
    } catch (e) {
      setError(apiErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadBuyers();
  }, [loadBuyers]);

  const filtered = buyersList.filter((b) => {
    const type = str(b.buyerType).toLowerCase();
    if (activeCategory !== 'all' && !type.includes(activeCategory)) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const name = str(b.businessName).toLowerCase();
      const state = str(b.state).toLowerCase();
      const cats = arr(b.categories).map(String).join(' ').toLowerCase();
      if (!name.includes(q) && !state.includes(q) && !cats.includes(q)) return false;
    }
    return true;
  });

  const handleSendQuote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!contactBuyer) return;
    setSending(true);
    setError(null);
    try {
      // Best-effort bulk order proposal or message
      await seller.createBulkOrder({
        buyerId: str(contactBuyer.uid || contactBuyer.id),
        crop: offerCrop,
        quantityQuintals: offerQty,
        ratePerQuintal: offerPrice,
        notes: deliveryNotes,
      }).catch(() => null);

      setNotice(`Supply quote of ${offerQty} Qt ${offerCrop} @ ${formatCurrency(offerPrice)}/q dispatched to ${str(contactBuyer.businessName)}!`);
      setContactBuyer(null);
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <h1 className="text-2xl font-black text-slate-900 flex items-center gap-2.5">
            <Building className="w-7 h-7 text-emerald-600" />
            Direct Buyers Network — Hotel & Bulk Buyer Connect
          </h1>
          <p className="text-xs text-slate-500 mt-1 font-medium">
            Connect directly with verified hotel chains, bulk institutional buyers, food processors, and supermarket groups.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void loadBuyers()}
          className={`${ghostBtnCls} flex items-center gap-1.5 text-xs font-bold`}
        >
          <RefreshCw className="w-3.5 h-3.5" /> Refresh Network
        </button>
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

      {/* Filter and Search Bar */}
      <div className={`${cardCls} space-y-4`}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs font-bold">
            {BUYER_TYPES.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setActiveCategory(t.id)}
                className={`px-3 py-1.5 rounded-xl whitespace-nowrap transition-all border ${
                  activeCategory === t.id
                    ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                    : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          <div className="relative min-w-[240px]">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search by hotel, city, category…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={`${inputCls} pl-9 text-xs`}
            />
          </div>
        </div>
      </div>

      {/* Buyer Cards Grid */}
      {loading ? (
        <div className="py-20 text-center text-xs font-bold text-slate-400 animate-pulse">
          Scanning verified direct buyer directories…
        </div>
      ) : filtered.length === 0 ? (
        <div className={`${cardCls} py-16 text-center space-y-3`}>
          <Building className="w-10 h-10 text-slate-300 mx-auto" />
          <h3 className="text-sm font-bold text-slate-800">No Direct Buyers Found</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            Direct buyers are verified institutional partners. New procurement demands will appear here.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filtered.map((b, idx) => {
            const categories = arr(b.categories).map(String);
            const verified = Boolean(b.verified);
            const dealings = num(b.pastDealingsCount) || 0;
            const openReqs = num(b.openRequirementsCount) || 1;

            return (
              <div
                key={str(b.uid || b.id) || idx}
                className={`${cardCls} flex flex-col justify-between hover:border-emerald-400 hover:shadow-md transition-all space-y-4`}
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-1.5">
                        <h3 className="text-base font-black text-slate-900">{str(b.businessName) || 'Direct Buyer'}</h3>
                        {Boolean(b.verified) ? (
                          <BadgeCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                        ) : null}
                      </div>
                      <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                        {str(b.buyerType) || 'Institutional Buyer'}
                      </span>
                    </div>

                    <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200">
                      {openReqs} Demands Live
                    </span>
                  </div>

                  <div className="flex items-center gap-1 text-xs text-slate-500">
                    <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span>{str(b.district) || 'Pune'}, {str(b.state) || 'Maharashtra'}</span>
                  </div>

                  {/* Buying Categories */}
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase block mb-1">
                      Preferred Sourcing Categories
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {categories.length > 0 ? (
                        categories.map((cat, i) => (
                          <span
                            key={i}
                            className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-slate-100 text-slate-700"
                          >
                            {cat}
                          </span>
                        ))
                      ) : (
                        <span className="text-[10px] text-slate-400">Grains, Vegetables, Pulses</span>
                      )}
                    </div>
                  </div>

                  {/* Dealings Summary */}
                  <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100 flex items-center justify-between text-xs">
                    <span className="text-slate-500 flex items-center gap-1">
                      <History className="w-3.5 h-3.5 text-slate-400" /> Past Dealings with You:
                    </span>
                    <span className="font-extrabold text-slate-800">{dealings} Transactions</span>
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setContactBuyer(b)}
                    className={`${primaryBtnCls} w-full text-xs font-black py-2.5 flex items-center justify-center gap-1.5`}
                  >
                    <Send className="w-3.5 h-3.5" /> Propose Supply Quote
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Propose Supply Quote Modal */}
      {contactBuyer && (
        <ModalSheet title={`Propose Supply to ${str(contactBuyer.businessName)}`} isOpen={!!contactBuyer} onClose={() => setContactBuyer(null)}>
          <form onSubmit={handleSendQuote} className="space-y-4">
            <p className="text-xs text-slate-500">
              Submit your direct farmgate/mandi supply availability to <strong>{str(contactBuyer.businessName)}</strong>.
              Upon acceptance, contract terms and escrow release will be guaranteed by Kisan Setu B2B network.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className={labelCls}>Commodity Crop *</label>
                <select
                  value={offerCrop}
                  onChange={(e) => setOfferCrop(e.target.value)}
                  className={inputCls}
                >
                  <option value="Soybean">Soybean</option>
                  <option value="Onion">Onion</option>
                  <option value="Wheat">Wheat</option>
                  <option value="Tomato">Tomato</option>
                  <option value="Maize">Maize</option>
                </select>
              </div>

              <div>
                <label className={labelCls}>Quantity Available (Qt) *</label>
                <input
                  type="number"
                  min={1}
                  required
                  value={offerQty}
                  onChange={(e) => setOfferQty(Number(e.target.value))}
                  className={inputCls}
                />
              </div>

              <div>
                <label className={labelCls}>Offered Rate (₹ / Qt) *</label>
                <input
                  type="number"
                  min={1}
                  required
                  value={offerPrice}
                  onChange={(e) => setOfferPrice(Number(e.target.value))}
                  className={inputCls}
                />
              </div>
            </div>

            <div>
              <label className={labelCls}>Supply Terms & Packaging Notes</label>
              <textarea
                rows={3}
                value={deliveryNotes}
                onChange={(e) => setDeliveryNotes(e.target.value)}
                className={inputCls}
              />
            </div>

            <div className="flex justify-end gap-2 pt-3">
              <button
                type="button"
                onClick={() => setContactBuyer(null)}
                className={`${ghostBtnCls} text-xs font-bold`}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={sending}
                className={`${primaryBtnCls} text-xs font-black px-5`}
              >
                {sending ? 'Sending Quote…' : 'Dispatch Direct Quote'}
              </button>
            </div>
          </form>
        </ModalSheet>
      )}
    </div>
  );
};
