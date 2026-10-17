import React from 'react';
import { Users, Layers, ShoppingBag, CheckCircle2, DollarSign } from 'lucide-react';
import { StatCard } from '../../components/common/StatCard';
import { formatCurrency } from '../../lib/utils';

export const FpoHubView: React.FC = () => {
  const pools = [
    {
      title: 'Bulk DAP & NPK Fertilizer Group Buy (200 Bags)',
      fpo: 'Sahyadri Farmers Producer Co.',
      savings: '₹140 / bag discount (Wholesale ex-factory)',
      members: 38,
      status: 'Open (Closing in 3 days)',
    },
    {
      title: 'Collective Export Onion Aggregate Pool (500 Tons)',
      fpo: 'Nashik Agro FPO Federation',
      savings: 'Direct Dubai container shipment @ ₹3,400/q',
      members: 72,
      status: 'Target 80% Achieved',
    },
  ];

  return (
    <div className="space-y-6">
      <div className="border-b border-slate-200 pb-4">
        <h1 className="text-2xl font-extrabold text-slate-900 flex items-center gap-2">
          <Users className="w-7 h-7 text-emerald-600" />
          Farmer Producer Organizations (FPO) & Collective Buying
        </h1>
        <p className="text-xs text-slate-500 mt-1">
          Pool your input purchases for wholesale factory pricing and aggregate harvests for institutional export contracts
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          title="Active FPO Pools"
          value="2 Pools"
          subtitle="Collective fertilizer & onion"
          icon={Layers}
          colorScheme="green"
        />
        <StatCard
          title="Collective Savings"
          value={formatCurrency(48600)}
          subtitle="Direct factory discounts"
          icon={DollarSign}
          colorScheme="amber"
        />
        <StatCard
          title="FPO Members Joined"
          value="110 Farmers"
          subtitle="Niphad & Pimpalgaon cluster"
          icon={Users}
          colorScheme="blue"
        />
      </div>

      <div className="space-y-4">
        <h3 className="font-bold text-sm text-slate-900">Live Collective FPO Pools</h3>
        <div className="space-y-3">
          {pools.map((p, i) => (
            <div
              key={i}
              className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4"
            >
              <div>
                <span className="text-[10px] font-bold uppercase text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                  {p.fpo}
                </span>
                <h4 className="font-extrabold text-base text-slate-900 mt-1">{p.title}</h4>
                <p className="text-xs font-bold text-emerald-700 mt-0.5">{p.savings}</p>
                <p className="text-xs text-slate-400 mt-1">
                  {p.members} Farmers Participated • {p.status}
                </p>
              </div>

              <button className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-xs self-start sm:self-auto">
                Join Collective Pool
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
