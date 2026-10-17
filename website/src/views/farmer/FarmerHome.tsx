import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  TrendingUp,
  Package,
  Truck,
  BookOpen,
  CloudSun,
  ShieldAlert,
  ArrowRight,
  Coins,
  MapPin,
  Sparkles,
  Bot,
  AlertTriangle,
  Droplets,
  CalendarCheck,
  CheckCircle2,
} from 'lucide-react';
import { StatCard } from '../../components/common/StatCard';
import { MOCK_MANDI_PRICES, MOCK_PRODUCE_LOTS, MOCK_PURCHASES } from '../../lib/api';
import { useAuthStore } from '../../stores/authStore';
import { formatCurrency, formatWeight } from '../../lib/utils';

export const FarmerHome: React.FC = () => {
  const { user } = useAuthStore();
  const [tasks, setTasks] = useState([
    { id: 1, text: 'Top-dress Urea (30 kg/acre) before evening irrigation', done: false, time: 'By 5:00 PM' },
    { id: 2, text: 'Confirm pickup slot with Rahul Shinde for Soybean lot', done: true, time: 'Completed' },
    { id: 3, text: 'Check Lasalgaon Mandi modal rates for Onion harvest', done: false, time: 'Today' },
  ]);

  const toggleTask = (id: number) => {
    setTasks((prev) =>
      prev.map((t) => (t.id === id ? { ...t, done: !t.done } : t))
    );
  };

  return (
    <div className="space-y-6">
      {/* Welcome & Weather Cockpit Header */}
      <div className="bg-gradient-to-r from-emerald-800 to-teal-900 rounded-3xl p-6 sm:p-8 text-white shadow-lg relative overflow-hidden">
        <div className="absolute right-0 top-0 -mr-16 -mt-16 w-64 h-64 rounded-full bg-emerald-600/20 blur-2xl" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-xs font-semibold text-emerald-300">
              <MapPin className="w-4 h-4 text-emerald-400" />
              <span>{user?.village || 'Pimpalgaon Baswant'}, {user?.district || 'Nashik'}</span>
              <span className="text-emerald-400/40">•</span>
              <span>Gat 312 ({user?.farmSizeAcres || 4.5} Acres)</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
              Ram Ram, {user?.name.split(' ')[0] || 'Ramesh'} Ji! 🌾
            </h1>
            <p className="text-xs sm:text-sm text-emerald-100/90 max-w-xl">
              Weather is clear for harvesting. Soybean modal rate is up <strong>+2.8%</strong> today at Latur APMC.
            </p>
          </div>

          {/* Real-time Weather Tile */}
          <div className="bg-white/10 backdrop-blur-md rounded-2xl p-4 border border-white/20 flex items-center gap-4 flex-shrink-0">
            <CloudSun className="w-10 h-10 text-amber-300" />
            <div>
              <div className="text-2xl font-black">28°C</div>
              <p className="text-[11px] text-emerald-200">Sunny • Humidity 58%</p>
              <div className="text-[10px] text-emerald-300 font-bold mt-0.5 flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3 text-emerald-400" /> Spray Window: Optimal
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Primary KPI Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Active Lots"
          value="2 Lots"
          subtitle="55 Quintals on offer"
          icon={Package}
          colorScheme="green"
        />
        <StatCard
          title="Pending Offers"
          value="1 Counter"
          subtitle="Shree Foods ₹4,720/q"
          icon={TrendingUp}
          trend={{ value: 2.8, isPositive: true }}
          colorScheme="amber"
        />
        <StatCard
          title="Booked Transport"
          value="1 Trip"
          subtitle="Pickup tomorrow 6:00 AM"
          icon={Truck}
          colorScheme="blue"
        />
        <StatCard
          title="Kisan Coins"
          value={user?.kisanCoins || 350}
          subtitle="Redeemable on Krishi Mall"
          icon={Coins}
          colorScheme="purple"
        />
      </div>

      {/* Quick Launchpad Buttons */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Link
          to="/farmer/lots"
          className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-xs hover:border-emerald-500 hover:shadow-md transition-all flex items-center gap-3"
        >
          <div className="p-2.5 rounded-xl bg-emerald-50 text-emerald-700">
            <Package className="w-5 h-5" />
          </div>
          <div>
            <h5 className="font-bold text-xs text-slate-900">Post Crop Lot</h5>
            <p className="text-[10px] text-slate-400">Sell direct to buyer</p>
          </div>
        </Link>

        <Link
          to="/farmer/transport"
          className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-xs hover:border-sky-500 hover:shadow-md transition-all flex items-center gap-3"
        >
          <div className="p-2.5 rounded-xl bg-sky-50 text-sky-700">
            <Truck className="w-5 h-5" />
          </div>
          <div>
            <h5 className="font-bold text-xs text-slate-900">Book Gadi</h5>
            <p className="text-[10px] text-slate-400">Pickup & bilty</p>
          </div>
        </Link>

        <Link
          to="/farmer/equipment"
          className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-xs hover:border-amber-500 hover:shadow-md transition-all flex items-center gap-3"
        >
          <div className="p-2.5 rounded-xl bg-amber-50 text-amber-700">
            <CalendarCheck className="w-5 h-5" />
          </div>
          <div>
            <h5 className="font-bold text-xs text-slate-900">Rent Yantra</h5>
            <p className="text-[10px] text-slate-400">Tractor & rotavator</p>
          </div>
        </Link>

        <Link
          to="/farmer/diary"
          className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-xs hover:border-indigo-500 hover:shadow-md transition-all flex items-center gap-3"
        >
          <div className="p-2.5 rounded-xl bg-indigo-50 text-indigo-700">
            <BookOpen className="w-5 h-5" />
          </div>
          <div>
            <h5 className="font-bold text-xs text-slate-900">Farm Diary</h5>
            <p className="text-[10px] text-slate-400">P&L & break-even</p>
          </div>
        </Link>
      </div>

      {/* Two-Column Cockpit: Live Mandi Insights & Daily Tasks */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Mandi Insights Column */}
        <div className="lg:col-span-2 bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-emerald-600" />
              <h3 className="font-bold text-sm text-slate-900">Nearby Mandi Live Rates</h3>
            </div>
            <Link
              to="/farmer/mandi"
              className="text-xs font-bold text-emerald-700 hover:underline flex items-center gap-1"
            >
              Full Analytics <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="divide-y divide-slate-100">
            {MOCK_MANDI_PRICES.slice(0, 3).map((item) => (
              <div key={item.id} className="py-3 flex items-center justify-between">
                <div>
                  <h5 className="font-bold text-xs text-slate-900">{item.commodity}</h5>
                  <p className="text-[11px] text-slate-500">{item.mandi} • {item.variety}</p>
                </div>
                <div className="text-right">
                  <div className="text-sm font-extrabold text-slate-900">
                    {formatCurrency(item.modalPrice)}
                    <span className="text-[10px] font-normal text-slate-500">/q</span>
                  </div>
                  <span
                    className={`text-[10px] font-bold ${
                      item.trendPercentage >= 0 ? 'text-emerald-700' : 'text-rose-600'
                    }`}
                  >
                    {item.trendPercentage >= 0 ? `+${item.trendPercentage}%` : `${item.trendPercentage}%`}
                  </span>
                </div>
              </div>
            ))}
          </div>

          {/* Direct buyer lot selling banner */}
          <div className="p-4 rounded-2xl bg-amber-50/70 border border-amber-200 flex items-center justify-between">
            <div className="space-y-0.5">
              <h5 className="font-bold text-xs text-amber-950">Soybean 20q Lot has 1 Counter-Offer!</h5>
              <p className="text-[11px] text-amber-800">
                Shree Foods Pvt Ltd countered at ₹4,720/q. Review and accept to auto-create purchase.
              </p>
            </div>
            <Link
              to="/farmer/lots"
              className="px-3.5 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs shadow-xs"
            >
              Review Offer
            </Link>
          </div>
        </div>

        {/* Daily Tasks & Agronomy Advice */}
        <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <CalendarCheck className="w-5 h-5 text-emerald-600" />
              <h3 className="font-bold text-sm text-slate-900">Today's Farm Action</h3>
            </div>
            <span className="text-[10px] font-bold bg-emerald-50 text-emerald-800 px-2 py-0.5 rounded-full">
              {tasks.filter((t) => t.done).length}/{tasks.length} Done
            </span>
          </div>

          <div className="space-y-2.5">
            {tasks.map((task) => (
              <div
                key={task.id}
                onClick={() => toggleTask(task.id)}
                className={`p-3 rounded-2xl border transition-all cursor-pointer flex items-start gap-3 ${
                  task.done
                    ? 'bg-slate-50 border-slate-200 opacity-60'
                    : 'bg-white border-slate-200/90 hover:border-emerald-400 shadow-xs'
                }`}
              >
                <div
                  className={`w-5 h-5 rounded-lg border mt-0.5 flex items-center justify-center transition-colors ${
                    task.done ? 'bg-emerald-600 border-emerald-600 text-white' : 'border-slate-300'
                  }`}
                >
                  {task.done && <CheckCircle2 className="w-3.5 h-3.5" />}
                </div>
                <div className="flex-1">
                  <p className={`text-xs font-semibold ${task.done ? 'line-through text-slate-400' : 'text-slate-800'}`}>
                    {task.text}
                  </p>
                  <span className="text-[10px] text-slate-400 mt-0.5 block">{task.time}</span>
                </div>
              </div>
            ))}
          </div>

          {/* AI Agronomist Tip of the Day */}
          <div className="p-3.5 rounded-2xl bg-teal-50 border border-teal-200/80 text-teal-950 flex items-start gap-3">
            <Bot className="w-5 h-5 text-teal-700 flex-shrink-0 mt-0.5" />
            <div>
              <h5 className="font-bold text-xs">Agronomist Advisory</h5>
              <p className="text-[11px] text-teal-900/80 mt-0.5 leading-relaxed">
                Soil moisture in Gat 312 is ideal for wheat sowing. Seed treatment with Trichoderma viride @ 5g/kg will prevent root rot.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
