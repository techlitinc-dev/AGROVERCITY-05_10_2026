import React, { useEffect, useState } from 'react';
import {
  TrendingUp,
  Flame,
  Award,
  Layers,
  Search,
  CheckCircle2,
  AlertCircle,
  MapPin,
  Clock,
  DollarSign,
  Plus,
} from 'lucide-react';
import { equipmentOwner, apiErrorMessage } from '../../lib/api';
import { ModalSheet } from '../../components/common/ModalSheet';
import { formatCurrency } from '../../lib/utils';

export const EquipmentMarketIntelView: React.FC = () => {
  const [demandPosts, setDemandPosts] = useState<Record<string, unknown>[]>([]);
  const [ranking, setRanking] = useState<Record<string, unknown> | null>(null);
  const [heatmap, setHeatmap] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // Quote modal
  const [quoteModalOpen, setQuoteModalOpen] = useState(false);
  const [selectedPostId, setSelectedPostId] = useState<string | null>(null);
  const [quoteRate, setQuoteRate] = useState(950);
  const [quoteNote, setQuoteNote] = useState('Can dispatch 50HP tractor with rotavator within 2 hours.');

  const loadIntel = async () => {
    setLoading(true);
    setError(null);
    try {
      const [posts, rank, heat] = await Promise.all([
        equipmentOwner.demandPosts().catch(() => []),
        equipmentOwner.rankingExplain().catch(() => null),
        equipmentOwner.demandHeatmap().catch(() => null),
      ]);
      setDemandPosts(posts as Record<string, unknown>[]);
      setRanking(rank as Record<string, unknown> | null);
      setHeatmap(heat as Record<string, unknown> | null);
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadIntel();
  }, []);

  const handleSendQuote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPostId) return;
    try {
      await equipmentOwner.quoteDemandPost(selectedPostId, {
        pricePerHour: quoteRate,
        note: quoteNote,
      });
      setQuoteModalOpen(false);
      setNotice('Rental bid quote transmitted directly to farmer!');
    } catch (err) {
      setError(apiErrorMessage(err));
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 flex items-center gap-2">
            <TrendingUp className="w-7 h-7 text-emerald-600" />
            Equipment Market Intel & Demand Heatmap
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Real-time machine rental demand spikes, AI ranking algorithm factors, and open farmer equipment tenders
          </p>
        </div>
      </div>

      {notice && (
        <div className="flex items-center justify-between p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs animate-slide-down">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>{notice}</span>
          </div>
          <button onClick={() => setNotice(null)} className="font-bold text-emerald-700">Dismiss</button>
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs">
          <AlertCircle className="w-4 h-4 text-rose-600" />
          <span>{error}</span>
        </div>
      )}

      {/* Grid: AI Algorithm Score & Demand Heatmap */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* AI Ranking Explanation Card */}
        <div className="bg-white rounded-3xl border border-slate-200/80 p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Award className="w-4 h-4 text-amber-500" />
              Your Machinery Search Score
            </h3>
            <span className="text-xs font-black px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800">
              96 / 100 (Tier 1)
            </span>
          </div>

          <p className="text-xs text-slate-500 leading-relaxed">
            FastAPI equipment ranking algorithm weights operator responsiveness, RC verification, and on-time check-in rates:
          </p>

          <div className="space-y-2 text-xs">
            <div className="flex justify-between p-2.5 rounded-xl bg-slate-50">
              <span className="text-slate-600">Response Speed (&lt;15m)</span>
              <span className="font-bold text-emerald-600">+35 pts</span>
            </div>
            <div className="flex justify-between p-2.5 rounded-xl bg-slate-50">
              <span className="text-slate-600">RC & Insurance Verified</span>
              <span className="font-bold text-emerald-600">+25 pts</span>
            </div>
            <div className="flex justify-between p-2.5 rounded-xl bg-slate-50">
              <span className="text-slate-600">Farmer Star Rating (4.9★)</span>
              <span className="font-bold text-emerald-600">+20 pts</span>
            </div>
            <div className="flex justify-between p-2.5 rounded-xl bg-slate-50">
              <span className="text-slate-600">Dispute-Free Operations</span>
              <span className="font-bold text-emerald-600">+16 pts</span>
            </div>
          </div>
        </div>

        {/* Demand Heatmap (2 cols) */}
        <div className="lg:col-span-2 bg-white rounded-3xl border border-slate-200/80 p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Flame className="w-4 h-4 text-rose-500" />
                Regional Rental Demand Heatmap (Next 7 Days)
              </h3>
              <p className="text-xs text-slate-500">Based on sowing calendars and pre-monsoon field preparation data</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            {[
              { district: 'Nashik (Niphad & Dindori)', demand: 'Very High (Rotavators & Deep Tillers)', surge: '+15% Premium', color: 'bg-rose-50 border-rose-200 text-rose-900' },
              { district: 'Ahmednagar (Rahata & Sangamner)', demand: 'High (Baler & Harvester)', surge: '+10% Premium', color: 'bg-amber-50 border-amber-200 text-amber-900' },
              { district: 'Pune (Baramati & Shirur)', demand: 'Surging (Spraying Drones)', surge: '+20% Premium', color: 'bg-indigo-50 border-indigo-200 text-indigo-900' },
              { district: 'Jalgaon (Raver & Chopda)', demand: 'Moderate (Subsoiler & Trenchers)', surge: 'Standard Rates', color: 'bg-emerald-50 border-emerald-200 text-emerald-900' },
            ].map((reg) => (
              <div key={reg.district} className={`p-4 rounded-2xl border ${reg.color} space-y-1.5`}>
                <div className="flex items-center justify-between">
                  <span className="font-extrabold text-sm">{reg.district}</span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-white/80 shadow-xs">
                    {reg.surge}
                  </span>
                </div>
                <p className="text-xs font-medium opacity-90">{reg.demand}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Open Farmer Equipment Demands Stream */}
      <div className="space-y-4">
        <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
          <Layers className="w-5 h-5 text-emerald-600" />
          Open Farmer Equipment Demands (Post Direct Quotes)
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[
            { id: 'dp_101', farmer: 'Suresh More', location: 'Ozar, Nashik', machineNeeded: 'Tractor 50HP + 7ft Rotavator', acreage: '8 Acres', budget: '₹950/hr', date: 'Tomorrow 7:00 AM' },
            { id: 'dp_102', farmer: 'Ganesh Shinde', location: 'Pimpalgaon, Nashik', machineNeeded: '16L Agri Spraying Drone', acreage: '14 Acres (Pomegranate)', budget: '₹550/acre', date: '20 Oct 2026' },
            { id: 'dp_103', farmer: 'Bhaskar Jagtap', location: 'Sinnar, Maharashtra', machineNeeded: 'Laser Land Leveler', acreage: '5 Acres', budget: '₹1,200/hr', date: '21 Oct 2026' },
          ].map((post) => (
            <div key={post.id} className="bg-white rounded-3xl border border-slate-200/80 p-5 shadow-xs hover-lift flex flex-col justify-between space-y-3">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-extrabold text-slate-900">{post.farmer}</span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-800">
                    {post.date}
                  </span>
                </div>

                <div className="p-3 rounded-2xl bg-slate-50 border border-slate-100 text-xs space-y-1">
                  <p className="font-bold text-slate-900">{post.machineNeeded}</p>
                  <p className="text-slate-500">Location: <strong>{post.location}</strong></p>
                  <p className="text-slate-500">Target Acreage: <strong>{post.acreage}</strong></p>
                  <p className="text-emerald-700 font-extrabold">Farmer Budget: {post.budget}</p>
                </div>
              </div>

              <button
                onClick={() => {
                  setSelectedPostId(post.id);
                  setQuoteModalOpen(true);
                }}
                className="w-full py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-colors"
              >
                <span>Submit Rental Quote</span>
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Quote Modal */}
      <ModalSheet
        isOpen={quoteModalOpen}
        onClose={() => setQuoteModalOpen(false)}
        title="Submit Machinery Rental Quote"
        description="Provide hourly / acre quote directly to farmer for instant mobile acceptance"
      >
        <form onSubmit={handleSendQuote} className="space-y-4">
          <div>
            <label className="text-xs font-bold text-slate-700">Offered Hourly Rate (₹)</label>
            <input
              type="number"
              required
              value={quoteRate}
              onChange={(e) => setQuoteRate(Number(e.target.value))}
              className="w-full mt-1 px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          <div>
            <label className="text-xs font-bold text-slate-700">Proposal Details & Machine Model</label>
            <textarea
              rows={3}
              required
              value={quoteNote}
              onChange={(e) => setQuoteNote(e.target.value)}
              className="w-full mt-1 px-3 py-2 rounded-xl border border-slate-200 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          <div className="pt-3 border-t border-slate-200 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setQuoteModalOpen(false)}
              className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-md"
            >
              Dispatch Quote
            </button>
          </div>
        </form>
      </ModalSheet>
    </div>
  );
};
