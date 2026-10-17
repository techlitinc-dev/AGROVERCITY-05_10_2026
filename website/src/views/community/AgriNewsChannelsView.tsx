import React from 'react';
import { Radio, Newspaper, Volume2, Calendar, Play } from 'lucide-react';

export const AgriNewsChannelsView: React.FC = () => {
  const news = [
    {
      id: 1,
      title: 'Central Government raises Minimum Support Price (MSP) for Wheat by ₹150/q to ₹2,425/q for Rabi 2026',
      source: 'Krishi Mantralaya Press Information Bureau',
      time: '2 hours ago',
      category: 'Policy & MSP',
    },
    {
      id: 2,
      title: 'Maharashtra APMC Mandi arrivals hit seasonal peak as soybean harvesting accelerates in Vidarbha',
      source: 'Agrovercity Market Intelligence',
      time: '4 hours ago',
      category: 'Mandi Arrivals',
    },
    {
      id: 3,
      title: 'IMD forecasts favorable winter chill across northern & central belts, beneficial for wheat tillering',
      source: 'India Meteorological Dept',
      time: 'Yesterday',
      category: 'Weather Radar',
    },
  ];

  return (
    <div className="space-y-6">
      <div className="border-b border-slate-200 pb-4">
        <h1 className="text-2xl font-extrabold text-slate-900 flex items-center gap-2">
          <Radio className="w-7 h-7 text-indigo-600" />
          Agri News, Gyan Hub & Live Audio Bulletins
        </h1>
        <p className="text-xs text-slate-500 mt-1">
          Daily verified agricultural updates, mandi policy shifts, and regional vernacular radio broadcasts
        </p>
      </div>

      {/* Live Audio Radio Broadcast Player Tile */}
      <div className="p-6 bg-gradient-to-r from-indigo-900 via-indigo-800 to-slate-900 rounded-3xl text-white shadow-md flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-white/10 backdrop-blur-md flex items-center justify-center border border-white/20">
            <Volume2 className="w-6 h-6 text-indigo-300 animate-pulse" />
          </div>
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-300">
              Live Mandi Radio Bulletin (मराठी / हिन्दी)
            </span>
            <h4 className="font-extrabold text-sm sm:text-base mt-0.5">
              Today's 12:00 PM Nashik & Lasalgaon Bhav Samachar
            </h4>
          </div>
        </div>

        <button className="px-5 py-2.5 rounded-2xl bg-indigo-500 hover:bg-indigo-600 text-white font-bold text-xs shadow-md flex items-center gap-2 flex-shrink-0">
          <Play className="w-4 h-4 fill-current" />
          <span>Listen Live</span>
        </button>
      </div>

      {/* News Feed */}
      <div className="space-y-4">
        {news.map((item) => (
          <div
            key={item.id}
            className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs space-y-2 hover:border-slate-300 transition-colors"
          >
            <div className="flex justify-between items-center text-xs">
              <span className="text-[10px] font-bold uppercase text-indigo-800 bg-indigo-50 px-2 py-0.5 rounded-full border border-indigo-200">
                {item.category}
              </span>
              <span className="text-slate-400">{item.time}</span>
            </div>

            <h3 className="font-extrabold text-sm sm:text-base text-slate-900 leading-snug">
              {item.title}
            </h3>
            <p className="text-xs text-slate-500">Source: {item.source}</p>
          </div>
        ))}
      </div>
    </div>
  );
};
