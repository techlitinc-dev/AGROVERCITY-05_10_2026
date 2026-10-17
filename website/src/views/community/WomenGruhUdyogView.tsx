import React from 'react';
import { Heart, Sparkles, Users, Award, ShoppingBag, ArrowRight } from 'lucide-react';
import { StatCard } from '../../components/common/StatCard';
import { formatCurrency } from '../../lib/utils';

export const WomenGruhUdyogView: React.FC = () => {
  const shgProducts = [
    { title: 'Handmade Organic Urad Dal Papad (1kg)', shg: 'Laxmi Mahila Bachat Gat', price: 280, rating: 4.9 },
    { title: 'Pure Gir Cow Ghee (A2 Bilona Method - 500ml)', shg: 'Radha Krishna SHG', price: 950, rating: 5.0 },
    { title: 'Stone Ground Turmeric Powder (500g)', shg: 'Savtribai Phule SHG', price: 160, rating: 4.8 },
  ];

  return (
    <div className="space-y-6">
      <div className="border-b border-slate-200 pb-4">
        <h1 className="text-2xl font-extrabold text-slate-900 flex items-center gap-2">
          <Heart className="w-7 h-7 text-pink-600" />
          Mahila Gruh Udyog & SHG Enterprise Hub
        </h1>
        <p className="text-xs text-slate-500 mt-1">
          Empowering rural women self-help groups (SHG) with direct access to Krishi Shopping Mall and zero-brokerage sales
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          title="Active Women SHGs"
          value="24 Groups"
          subtitle="Nashik Rural Federation"
          icon={Users}
          colorScheme="purple"
        />
        <StatCard
          title="SHG Monthly Revenue"
          value={formatCurrency(185400)}
          subtitle="Direct bank transfers"
          icon={Sparkles}
          colorScheme="green"
        />
        <StatCard
          title="FSSAI & Quality Score"
          value="98.2%"
          subtitle="Certified organic standards"
          icon={Award}
          colorScheme="amber"
        />
      </div>

      <div className="space-y-4">
        <h3 className="font-bold text-sm text-slate-900">Featured SHG Enterprise Products</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {shgProducts.map((p, i) => (
            <div key={i} className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-xs flex flex-col justify-between">
              <div>
                <span className="text-[10px] font-bold uppercase text-pink-700 bg-pink-50 px-2 py-0.5 rounded-full border border-pink-200">
                  {p.shg}
                </span>
                <h4 className="font-bold text-sm text-slate-900 mt-2">{p.title}</h4>
                <span className="text-base font-black text-emerald-800 mt-2 block">{formatCurrency(p.price)}</span>
              </div>

              <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                <span className="text-amber-600 font-bold">★ {p.rating} Rating</span>
                <button className="px-3 py-1.5 bg-pink-600 hover:bg-pink-700 text-white font-bold rounded-xl shadow-xs text-xs">
                  Buy on Mall
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
