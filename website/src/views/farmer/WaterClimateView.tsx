import React from 'react';
import { Droplets, CloudRain, Sun, Wind, CheckCircle2, AlertTriangle, Calendar } from 'lucide-react';
import { StatCard } from '../../components/common/StatCard';

export const WaterClimateView: React.FC = () => {
  return (
    <div className="space-y-6">
      <div className="border-b border-slate-200 pb-4">
        <h1 className="text-2xl font-extrabold text-slate-900 flex items-center gap-2">
          <Droplets className="w-7 h-7 text-sky-600" />
          Water Intelligence & Climate Resilience
        </h1>
        <p className="text-xs text-slate-500 mt-1">
          Borewell groundwater telemetry, canal rotation roster, and micro-climate spray windows
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          title="Borewell Water Table"
          value="185 Feet"
          subtitle="Safe recharge zone (+12 ft post monsoon)"
          icon={Droplets}
          colorScheme="blue"
        />
        <StatCard
          title="Canal Water Roster"
          value="Oct 22"
          subtitle="Right Bank Canal Turn #4 (12h allocation)"
          icon={Calendar}
          colorScheme="green"
        />
        <StatCard
          title="Optimal Spray Window"
          value="07:00 – 11:00 AM"
          subtitle="Wind speed < 8 km/h • Zero drift risk"
          icon={Wind}
          colorScheme="amber"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs space-y-4">
          <h3 className="font-bold text-sm text-slate-900">7-Day Irrigation Schedule for Wheat Sowing</h3>
          <div className="space-y-3">
            {[
              { stage: 'Pre-sowing Paleva Irrigation', date: 'Oct 19', duration: '4 Hours (Drip)', status: 'Upcoming' },
              { stage: 'Crown Root Initiation (CRI)', date: 'Nov 08', duration: '6 Hours', status: 'Scheduled' },
              { stage: 'Late Tillering Stage', date: 'Nov 28', duration: '5 Hours', status: 'Scheduled' },
            ].map((step, idx) => (
              <div key={idx} className="p-3.5 bg-slate-50 rounded-2xl flex items-center justify-between text-xs">
                <div>
                  <h5 className="font-bold text-slate-900">{step.stage}</h5>
                  <p className="text-slate-500">{step.duration}</p>
                </div>
                <div className="text-right">
                  <span className="font-bold text-slate-800">{step.date}</span>
                  <span className="text-[10px] text-emerald-700 block font-semibold">{step.status}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs space-y-4">
          <h3 className="font-bold text-sm text-slate-900">Micro-Climate Spray Window Advice</h3>
          <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-200 text-xs text-emerald-950 space-y-2">
            <div className="flex items-center gap-2 font-bold">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>Safe Foliar Spray Window Active</span>
            </div>
            <p className="leading-relaxed">
              Relative humidity is 58% and ground wind speed is 6 km/h. Safe to spray bio-pesticides or water-soluble NPK. Avoid spraying after 12:30 PM due to thermal evaporation.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
