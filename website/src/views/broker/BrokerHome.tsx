import React, { useState } from 'react';
import { HeartHandshake, Layers, DollarSign, Check, Users, ArrowRight, FileText } from 'lucide-react';
import { StatCard } from '../../components/common/StatCard';
import { StatusBadge } from '../../components/common/StatusBadge';
import { formatCurrency } from '../../lib/utils';

export const BrokerHome: React.FC = () => {
  const [deals, setDeals] = useState([
    {
      id: 'dl_801',
      crop: 'Soybean (Grade A)',
      farmer: 'Ramesh Patil (Pimpalgaon)',
      buyer: 'Shree Foods Pvt Ltd (Vashi)',
      qty: '20 Quintals',
      dealValue: 95000,
      commissionEarned: 950, // 1% brokerage
      status: 'confirmed',
    },
    {
      id: 'dl_802',
      crop: 'Lokwan Wheat',
      farmer: 'Baban Shinde (Niphad)',
      buyer: 'ITC Choupal (Nagpur)',
      qty: '50 Quintals',
      dealValue: 139000,
      commissionEarned: 1390,
      status: 'inTransit',
    },
  ]);

  return (
    <div className="space-y-6">
      <div className="border-b border-slate-200 pb-4">
        <h1 className="text-2xl font-extrabold text-slate-900 flex items-center gap-2">
          <HeartHandshake className="w-7 h-7 text-emerald-600" />
          Agri Broker & Dalal Deal Desk
        </h1>
        <p className="text-xs text-slate-500 mt-1">
          Bridge farm produce lots with institutional buyers, draft tripartite trade deals, and track 1% digital brokerage
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          title="Deals in Pipeline"
          value={`${deals.length} Deals`}
          subtitle="70 Quintals under negotiation"
          icon={Layers}
          colorScheme="blue"
        />
        <StatCard
          title="Total Brokerage Earned"
          value={formatCurrency(2340)}
          subtitle="Direct bank settlement"
          icon={DollarSign}
          colorScheme="green"
        />
        <StatCard
          title="Connected Farmer Network"
          value="48 Kisan Members"
          subtitle="Nashik & Niphad APMC catchment"
          icon={Users}
          colorScheme="amber"
        />
      </div>

      {/* Deals Pipeline Table */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <h3 className="font-bold text-sm text-slate-900">Active Trade Matchmaking Pipeline</h3>
          <span className="text-xs text-slate-400 font-semibold">1% Platform Brokerage</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50 text-slate-500 font-bold uppercase text-[10px] tracking-wider border-b border-slate-100">
                <th className="py-3 px-6">Deal ID & Crop</th>
                <th className="py-3 px-4">Seller (Farmer)</th>
                <th className="py-3 px-4">Buyer (Enterprise)</th>
                <th className="py-3 px-4">Volume & Value</th>
                <th className="py-3 px-4">Commission</th>
                <th className="py-3 px-6 text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {deals.map((d) => (
                <tr key={d.id} className="hover:bg-slate-50/60">
                  <td className="py-3.5 px-6 font-bold text-slate-900">
                    {d.crop}
                    <span className="text-[10px] text-slate-400 block font-mono">#{d.id}</span>
                  </td>
                  <td className="py-3.5 px-4 font-semibold text-slate-700">{d.farmer}</td>
                  <td className="py-3.5 px-4 font-semibold text-slate-700">{d.buyer}</td>
                  <td className="py-3.5 px-4">
                    <span className="font-bold text-slate-900">{formatCurrency(d.dealValue)}</span>
                    <span className="text-[11px] text-slate-400 block">{d.qty}</span>
                  </td>
                  <td className="py-3.5 px-4 font-bold text-emerald-700">
                    +{formatCurrency(d.commissionEarned)}
                  </td>
                  <td className="py-3.5 px-6 text-right">
                    <StatusBadge status={d.status} />
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
