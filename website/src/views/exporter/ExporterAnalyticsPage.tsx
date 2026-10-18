import React, { useEffect, useState } from 'react';
import {
  TrendingUp,
  DollarSign,
  Ship,
  Globe,
  PieChart as PieIcon,
  BarChart3,
  ArrowUpRight,
  ShieldCheck,
  Calendar,
  AlertCircle,
  RefreshCw,
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  CartesianGrid,
} from 'recharts';
import { exporter, apiErrorMessage } from '../../lib/api';
import { StatCard } from '../../components/common/StatCard';

const PORT_DATA = [
  { name: 'Mundra Port', volumeMt: 420, valueUsd: 480000 },
  { name: 'Nhava Sheva (JNPT)', volumeMt: 380, valueUsd: 440000 },
  { name: 'Chennai Port', volumeMt: 210, valueUsd: 260000 },
  { name: 'Kolkata Port', volumeMt: 140, valueUsd: 155000 },
  { name: 'Cochin Port', volumeMt: 95, valueUsd: 120000 },
];

const DESTINATION_DATA = [
  { name: 'UAE & GCC', value: 42, color: '#3b82f6' },
  { name: 'European Union', value: 24, color: '#10b981' },
  { name: 'United States', value: 16, color: '#f59e0b' },
  { name: 'United Kingdom', value: 11, color: '#8b5cf6' },
  { name: 'Southeast Asia', value: 7, color: '#ec4899' },
];

const MONTHLY_TREND = [
  { month: 'May', volume: 180, forexUsd: 210000 },
  { month: 'Jun', volume: 240, forexUsd: 290000 },
  { month: 'Jul', volume: 310, forexUsd: 360000 },
  { month: 'Aug', volume: 290, forexUsd: 340000 },
  { month: 'Sep', volume: 410, forexUsd: 490000 },
  { month: 'Oct', volume: 480, forexUsd: 580000 },
];

export const ExporterAnalyticsPage: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 flex items-center gap-2">
            <TrendingUp className="w-7 h-7 text-blue-600" />
            Global Trade & Forex Settlement Intelligence
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Real-time analytics for export volumes, foreign exchange realisations, port departures, and destination clearances
          </p>
        </div>

        <span className="text-xs font-bold px-3 py-1.5 rounded-xl bg-blue-50 text-blue-700 border border-blue-200 self-start sm:self-auto">
          Financial Year 2026-27
        </span>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Cumulative Volume (MT)"
          value="1,910 MT"
          icon={Ship}
          subtitle="+28% YoY"
          colorScheme="blue"
        />
        <StatCard
          title="Forex Realized ($ USD)"
          value="$2.27M"
          icon={DollarSign}
          subtitle="₹19.10 Cr INR"
          colorScheme="green"
        />
        <StatCard
          title="On-Time Port Departure"
          value="96.4%"
          icon={ShieldCheck}
          subtitle="Customs SLA < 12h"
          colorScheme="green"
        />
        <StatCard
          title="Avg FOB Realisation"
          value="$1,188/MT"
          icon={TrendingUp}
          subtitle="+4.2% Premium"
          colorScheme="amber"
        />
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Monthly Export Volume & Forex */}
        <div className="bg-white rounded-3xl border border-slate-200/80 p-6 shadow-xs space-y-4">
          <div>
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-blue-600" />
              Monthly Export Volume (Metric Tonnes)
            </h3>
            <p className="text-xs text-slate-500">Containerized agri shipments across major Indian seaports</p>
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={MONTHLY_TREND}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip
                  formatter={(val: number) => [`${val} MT`, 'Volume']}
                  contentStyle={{ borderRadius: '12px', border: '1px solid #e2e8f0', fontSize: '12px' }}
                />
                <Bar dataKey="volume" fill="#3b82f6" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Destination Country Breakdown Pie Chart */}
        <div className="bg-white rounded-3xl border border-slate-200/80 p-6 shadow-xs space-y-4">
          <div>
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <PieIcon className="w-4 h-4 text-emerald-600" />
              Global Destination Markets Share
            </h3>
            <p className="text-xs text-slate-500">Geographic distribution of exported commodities by destination</p>
          </div>

          <div className="h-64 w-full flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={DESTINATION_DATA}
                  cx="50%"
                  cy="50%"
                  innerRadius={55}
                  outerRadius={85}
                  paddingAngle={4}
                  dataKey="value"
                >
                  {DESTINATION_DATA.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(val: number) => [`${val}%`, 'Share']}
                  contentStyle={{ borderRadius: '12px', border: '1px solid #e2e8f0', fontSize: '12px' }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-4 text-xs">
            {DESTINATION_DATA.map((item) => (
              <div key={item.name} className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                <span className="text-slate-600 font-medium">{item.name} ({item.value}%)</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Port of Departure Table */}
      <div className="bg-white rounded-3xl border border-slate-200/80 p-6 shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Ship className="w-4 h-4 text-blue-600" />
              Indian Seaport Cargo Dispatches & Realisations
            </h3>
            <p className="text-xs text-slate-500">Summary by designated port of departure and customs house</p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 text-slate-400 font-bold uppercase text-[10px]">
                <th className="py-2.5 px-3">Port of Departure</th>
                <th className="py-2.5 px-3">Cargo Volume (MT)</th>
                <th className="py-2.5 px-3">Forex Value ($ USD)</th>
                <th className="py-2.5 px-3">Value (₹ INR)</th>
                <th className="py-2.5 px-3">Avg Clearance SLA</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
              {PORT_DATA.map((port) => (
                <tr key={port.name} className="hover:bg-slate-50 transition-colors">
                  <td className="py-3 px-3 font-bold text-slate-900 flex items-center gap-2">
                    <Ship className="w-3.5 h-3.5 text-blue-600" />
                    <span>{port.name}</span>
                  </td>
                  <td className="py-3 px-3 font-semibold">{port.volumeMt} MT</td>
                  <td className="py-3 px-3 font-bold text-blue-700">${port.valueUsd.toLocaleString()}</td>
                  <td className="py-3 px-3">₹{(port.valueUsd * 84.15).toLocaleString()}</td>
                  <td className="py-3 px-3">
                    <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-bold text-[10px]">
                      8.5 Hours
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
