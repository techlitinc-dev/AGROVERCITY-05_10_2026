import React, { useState } from 'react';
import {
  TrendingUp,
  Search,
  Filter,
  Bell,
  ArrowUpRight,
  ArrowDownRight,
  MapPin,
  Calendar,
  Check,
} from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';
import { MOCK_MANDI_PRICES } from '../../lib/api';
import { ModalSheet } from '../../components/common/ModalSheet';
import { formatCurrency } from '../../lib/utils';
import type { MandiPrice } from '../../types';

export const MandiPricesView: React.FC = () => {
  const [prices, setPrices] = useState<MandiPrice[]>(MOCK_MANDI_PRICES);
  const [search, setSearch] = useState('');
  const [selectedCrop, setSelectedCrop] = useState<string>('All');
  const [alertModalOpen, setAlertModalOpen] = useState(false);
  const [alertCrop, setAlertCrop] = useState('Soybean');
  const [targetPrice, setTargetPrice] = useState(4850);
  const [alertSaved, setAlertSaved] = useState(false);

  // Simulated 7-day trend chart data for Soybean
  const chartData = [
    { day: '11 Oct', price: 4620 },
    { day: '12 Oct', price: 4680 },
    { day: '13 Oct', price: 4710 },
    { day: '14 Oct', price: 4690 },
    { day: '15 Oct', price: 4750 },
    { day: '16 Oct', price: 4780 },
    { day: '17 Oct (Today)', price: 4820 },
  ];

  const filteredPrices = prices.filter((p) => {
    const matchesCrop = selectedCrop === 'All' || p.commodity.toLowerCase().includes(selectedCrop.toLowerCase());
    const matchesSearch =
      p.commodity.toLowerCase().includes(search.toLowerCase()) ||
      p.mandi.toLowerCase().includes(search.toLowerCase()) ||
      p.district.toLowerCase().includes(search.toLowerCase());
    return matchesCrop && matchesSearch;
  });

  const crops = ['All', 'Soybean', 'Wheat', 'Onion', 'Cotton', 'Tomato'];

  const handleSaveAlert = () => {
    setAlertSaved(true);
    setTimeout(() => {
      setAlertSaved(false);
      setAlertModalOpen(false);
    }, 800);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 flex items-center gap-2">
            <TrendingUp className="w-7 h-7 text-emerald-600" />
            Live Mandi Prices & Price Discovery
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Real-time APMC arrivals, modal rates, and MSP intelligence across Maharashtra & Central India
          </p>
        </div>

        <button
          onClick={() => setAlertModalOpen(true)}
          className="px-4 py-2.5 rounded-2xl bg-amber-500 hover:bg-amber-600 active:bg-amber-700 text-white font-bold text-xs shadow-sm flex items-center gap-2 self-start sm:self-auto transition-all"
        >
          <Bell className="w-4 h-4" />
          <span>Set Price Alert</span>
        </button>
      </div>

      {/* Historical Trend Chart Card */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-sm text-slate-900">Soybean Modal Price Movement (7-Day APMC Trend)</h3>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                +4.3% this week
              </span>
            </div>
            <p className="text-xs text-slate-400">Modal price (₹/quintal) vs Govt MSP ₹4,600/q</p>
          </div>
          <div className="text-right">
            <span className="text-2xl font-black text-emerald-700">₹4,820</span>
            <span className="text-xs text-slate-500"> / quintal</span>
          </div>
        </div>

        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="mandiGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis dataKey="day" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
              <YAxis
                domain={[4500, 5000]}
                tick={{ fontSize: 11, fill: '#64748b' }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v) => `₹${v}`}
              />
              <Tooltip
                formatter={(val: number) => [`₹${val}/quintal`, 'Modal Rate']}
                contentStyle={{ borderRadius: '1rem', border: '1px solid #e2e8f0', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}
              />
              <Area type="monotone" dataKey="price" stroke="#059669" strokeWidth={3} fillOpacity={1} fill="url(#mandiGradient)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
          <input
            type="text"
            placeholder="Search commodity, mandi yard, or district..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 text-xs rounded-2xl border border-slate-200 bg-white focus:outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/20"
          />
        </div>

        <div className="flex gap-1.5 overflow-x-auto no-scrollbar pb-1">
          {crops.map((c) => (
            <button
              key={c}
              onClick={() => setSelectedCrop(c)}
              className={`px-3.5 py-2 text-xs font-semibold rounded-2xl whitespace-nowrap transition-colors ${
                selectedCrop === c
                  ? 'bg-emerald-600 text-white font-bold shadow-xs'
                  : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      {/* Live Mandi Data Table */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-100 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
                <th className="py-3.5 px-4 sm:px-6">Commodity & Variety</th>
                <th className="py-3.5 px-4">Mandi Yard</th>
                <th className="py-3.5 px-4">Min / Max Rate</th>
                <th className="py-3.5 px-4 text-right">Modal Price</th>
                <th className="py-3.5 px-4 text-right">Govt MSP</th>
                <th className="py-3.5 px-4 text-right">Today's Trend</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredPrices.map((row) => (
                <tr key={row.id} className="hover:bg-slate-50/60 transition-colors">
                  <td className="py-4 px-4 sm:px-6">
                    <span className="font-bold text-slate-900 block">{row.commodity}</span>
                    <span className="text-[11px] text-slate-400">{row.variety}</span>
                  </td>
                  <td className="py-4 px-4">
                    <span className="font-semibold text-slate-800 flex items-center gap-1">
                      <MapPin className="w-3.5 h-3.5 text-emerald-600" /> {row.mandi}
                    </span>
                    <span className="text-[10px] text-slate-400">{row.district}, {row.state}</span>
                  </td>
                  <td className="py-4 px-4 font-mono text-slate-600">
                    {formatCurrency(row.minPrice)} – {formatCurrency(row.maxPrice)}
                  </td>
                  <td className="py-4 px-4 text-right">
                    <span className="font-extrabold text-sm text-slate-900 block">
                      {formatCurrency(row.modalPrice)}
                    </span>
                    <span className="text-[10px] text-slate-400">per quintal</span>
                  </td>
                  <td className="py-4 px-4 text-right">
                    {row.msp && row.msp > 0 ? (
                      <span className="font-semibold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md">
                        {formatCurrency(row.msp)}
                      </span>
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </td>
                  <td className="py-4 px-4 text-right">
                    <span
                      className={`inline-flex items-center text-xs font-bold px-2 py-0.5 rounded-full ${
                        row.trendPercentage >= 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'
                      }`}
                    >
                      {row.trendPercentage >= 0 ? (
                        <ArrowUpRight className="w-3.5 h-3.5 mr-0.5" />
                      ) : (
                        <ArrowDownRight className="w-3.5 h-3.5 mr-0.5" />
                      )}
                      {Math.abs(row.trendPercentage)}%
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Price Alert Modal Sheet */}
      <ModalSheet
        isOpen={alertModalOpen}
        onClose={() => setAlertModalOpen(false)}
        title="Create Mandi Price Alert"
        description="Receive instant WhatsApp & SMS notifications when mandi rates cross your target"
        maxWidth="md"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Select Crop</label>
            <select
              value={alertCrop}
              onChange={(e) => setAlertCrop(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 bg-white"
            >
              <option value="Soybean">Soybean (Yellow)</option>
              <option value="Wheat">Wheat (Lokwan)</option>
              <option value="Onion">Onion (Red Garva)</option>
              <option value="Cotton">Cotton (Medium Staple)</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Target Price (₹ per Quintal)</label>
            <div className="relative">
              <span className="absolute left-3 top-2.5 text-xs text-slate-400 font-bold">₹</span>
              <input
                type="number"
                value={targetPrice}
                onChange={(e) => setTargetPrice(Number(e.target.value))}
                className="w-full pl-7 pr-4 py-2 text-sm font-bold rounded-xl border border-slate-300 focus:outline-none focus:border-emerald-600"
              />
            </div>
            <p className="text-[11px] text-slate-400 mt-1">Current modal rate is ₹4,820/q.</p>
          </div>

          <button
            onClick={handleSaveAlert}
            disabled={alertSaved}
            className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md transition-all flex items-center justify-center gap-1.5"
          >
            {alertSaved ? (
              <>
                <Check className="w-4 h-4 text-emerald-200" /> Price Alert Active!
              </>
            ) : (
              <>
                <Bell className="w-4 h-4" /> Save & Activate Price Alert
              </>
            )}
          </button>
        </div>
      </ModalSheet>
    </div>
  );
};
