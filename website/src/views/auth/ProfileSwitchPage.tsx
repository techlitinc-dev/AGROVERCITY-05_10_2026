import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Check, ShieldCheck, UserPlus, ArrowRight } from 'lucide-react';
import { useAuthStore } from '../../stores/authStore';
import type { PersonaType } from '../../types';

export const ProfileSwitchPage: React.FC = () => {
  const { user, activePersona, switchPersona } = useAuthStore();
  const navigate = useNavigate();

  const allPersonas: { id: PersonaType; title: string; category: string; icon: string }[] = [
    { id: 'farmer', title: 'Farmer / Kisan', category: 'Agriculture Core', icon: '🌾' },
    { id: 'landlord', title: 'Farm Landlord', category: 'Land & Leases', icon: '🏡' },
    { id: 'transporter', title: 'Transporter / Gadi', category: 'Logistics', icon: '🚚' },
    { id: 'seller', title: 'Agri Vyapari', category: 'Commerce & Inputs', icon: '🏪' },
    { id: 'equipmentOwner', title: 'Equipment Owner', category: 'Machinery Services', icon: '🚜' },
    { id: 'directBuyer', title: 'Direct Buyer', category: 'B2B Procurement', icon: '🏢' },
    { id: 'broker', title: 'Agri Broker / Dalal', category: 'Trade Matchmaking', icon: '🤝' },
    { id: 'dairyManager', title: 'Dudh Dairy Manager', category: 'Livestock & Milk', icon: '🥛' },
    { id: 'instructor', title: 'Gurukul Instructor', category: 'Education & Training', icon: '🎓' },
    { id: 'bankManager', title: 'Bank Loan Manager', category: 'Fintech & Credit', icon: '🏦' },
    { id: 'insuranceProvider', title: 'Crop Insurance Desk', category: 'Risk Mitigation', icon: '📑' },
    { id: 'coldStorageProvider', title: 'Cold Storage Owner', category: 'Post-Harvest Warehousing', icon: '❄️' },
    { id: 'gaushalaManager', title: 'Gaushala & VetNet', category: 'Cattle Welfare & 80G', icon: '🐄' },
    { id: 'customer', title: 'E-Market Customer', category: 'Consumer Shopping', icon: '🛍️' },
    { id: 'superadmin', title: 'Superadmin Platform Ops', category: 'System Governance', icon: '⚡' },
  ];

  const handleSwitch = (p: PersonaType) => {
    switchPersona(p);
    navigate(`/${p}`);
  };

  return (
    <div className="max-w-4xl mx-auto py-6 space-y-6">
      <div className="border-b border-slate-200 pb-4">
        <h1 className="text-2xl font-extrabold text-slate-900">Multi-Profile & Persona Switcher</h1>
        <p className="text-xs text-slate-500 mt-1">
          Switch between your activated roles without logging out. All data remains strictly isolated.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {allPersonas.map((p) => {
          const isActive = activePersona === p.id;
          return (
            <div
              key={p.id}
              onClick={() => handleSwitch(p.id)}
              className={`p-5 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between ${
                isActive
                  ? 'border-emerald-600 bg-emerald-50/70 shadow-md ring-2 ring-emerald-500/20'
                  : 'border-slate-200 bg-white hover:border-slate-300 hover:shadow-xs'
              }`}
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-3xl">{p.icon}</span>
                  {isActive ? (
                    <span className="px-2 py-0.5 rounded-full bg-emerald-600 text-white text-[10px] font-bold flex items-center gap-1">
                      <Check className="w-3 h-3" /> Active Now
                    </span>
                  ) : (
                    <span className="text-xs text-slate-400 group-hover:text-slate-600">
                      Switch <ArrowRight className="w-3 h-3 inline ml-0.5" />
                    </span>
                  )}
                </div>
                <h4 className="font-bold text-sm text-slate-900">{p.title}</h4>
                <p className="text-[11px] text-slate-500 mt-0.5">{p.category}</p>
              </div>

              <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px]">
                <span className="text-slate-500 font-medium">Single Sign-On</span>
                <span className="font-bold text-emerald-700">Enter Role</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
