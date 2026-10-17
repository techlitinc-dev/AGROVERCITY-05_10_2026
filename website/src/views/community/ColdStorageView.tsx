import React, { useState } from 'react';
import { Snowflake, MapPin, Thermometer, ShieldCheck, FileText, Check } from 'lucide-react';
import { ModalSheet } from '../../components/common/ModalSheet';
import { formatCurrency } from '../../lib/utils';

export const ColdStorageView: React.FC = () => {
  const storages = [
    {
      id: 'cs_1',
      name: 'Godavari Cold Chain & Packhouse',
      location: 'Pimpalgaon Baswant, Nashik',
      crops: 'Grapes, Pomegranates, Tomato, Onion',
      chamberTemp: '2°C – 4°C (Humidity 90%)',
      capacityTons: 1500,
      availableTons: 340,
      ratePerMonth: '₹120 / crate',
      enwrSupported: true,
    },
    {
      id: 'cs_2',
      name: 'Lasalgaon Onion Controlled Atmosphere (CA) Store',
      location: 'Lasalgaon, Nashik',
      crops: 'Red Onion, Garlic, Potato',
      chamberTemp: '0°C – 2°C (Controlled N2/CO2)',
      capacityTons: 3000,
      availableTons: 820,
      ratePerMonth: '₹85 / quintal',
      enwrSupported: true,
    },
  ];

  return (
    <div className="space-y-6">
      <div className="border-b border-slate-200 pb-4">
        <h1 className="text-2xl font-extrabold text-slate-900 flex items-center gap-2">
          <Snowflake className="w-7 h-7 text-sky-600" />
          Cold Storage & e-NWR Warehouse Receipts
        </h1>
        <p className="text-xs text-slate-500 mt-1">
          Locate certified cold storage facilities, monitor live chamber temperatures, and get pledge financing via electronic Negotiable Warehouse Receipts (e-NWR)
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {storages.map((s) => (
          <div
            key={s.id}
            className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs space-y-4 flex flex-col justify-between"
          >
            <div>
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="font-extrabold text-base text-slate-900">{s.name}</h3>
                  <p className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                    <MapPin className="w-3.5 h-3.5 text-slate-400" /> {s.location}
                  </p>
                </div>
                {s.enwrSupported && (
                  <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200 flex items-center gap-1">
                    <ShieldCheck className="w-3.5 h-3.5" /> e-NWR WDRA Certified
                  </span>
                )}
              </div>

              <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
                <div className="p-3 bg-slate-50 rounded-2xl">
                  <span className="text-slate-400 font-semibold block text-[10px] uppercase">Telemetry</span>
                  <span className="font-bold text-sky-700 flex items-center gap-1 mt-0.5">
                    <Thermometer className="w-3.5 h-3.5" /> {s.chamberTemp}
                  </span>
                </div>
                <div className="p-3 bg-slate-50 rounded-2xl">
                  <span className="text-slate-400 font-semibold block text-[10px] uppercase">Available Capacity</span>
                  <span className="font-bold text-slate-900 mt-0.5 block">{s.availableTons} / {s.capacityTons} Tons</span>
                </div>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
              <span className="font-bold text-slate-800">{s.ratePerMonth}</span>
              <button className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl shadow-xs">
                Book Storage Chamber
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
