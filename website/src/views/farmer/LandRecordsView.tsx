import React, { useState } from 'react';
import { FileSpreadsheet, Search, CheckCircle2, MapPin, Download, ShieldCheck, Map } from 'lucide-react';
import { MOCK_LAND_RECORDS } from '../../lib/api';
import { FarmMapModal } from '../../components/common/FarmMapModal';

export const LandRecordsView: React.FC = () => {
  const [surveyQuery, setSurveyQuery] = useState('312');
  const [records, setRecords] = useState(MOCK_LAND_RECORDS);
  const [mapOpen, setMapOpen] = useState(false);

  return (
    <div className="space-y-6">
      <div className="border-b border-slate-200 pb-4">
        <h1 className="text-2xl font-extrabold text-slate-900 flex items-center gap-2">
          <FileSpreadsheet className="w-7 h-7 text-emerald-600" />
          7/12 Land Records (Saat-Baarah Utara)
        </h1>
        <p className="text-xs text-slate-500 mt-1">
          Instant digital verification of land ownership, cadastral boundaries, and crop registration from state revenue registries
        </p>
      </div>

      {/* Search Bar */}
      <div className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-xs flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
          <input
            type="text"
            placeholder="Enter Gat / Survey Number (e.g. 312)..."
            value={surveyQuery}
            onChange={(e) => setSurveyQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 text-xs rounded-2xl border border-slate-200 focus:outline-none focus:border-emerald-600"
          />
        </div>
        <button className="px-5 py-2.5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs">
          Search Digital Record
        </button>
      </div>

      {/* Record Cards */}
      <div className="space-y-4">
        {records.map((rec) => (
          <div
            key={rec.id}
            className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs space-y-4"
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-extrabold text-base text-slate-900">
                    Gat No. {rec.surveyNumber} (Hissa {rec.subDivision})
                  </h3>
                  <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200 flex items-center gap-1">
                    <ShieldCheck className="w-3.5 h-3.5" /> Revenue Verified
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  Village: {rec.village}, Taluka: {rec.taluka}, Dist: {rec.district}
                </p>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => setMapOpen(true)}
                  className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold flex items-center gap-1.5 transition-colors"
                >
                  <Map className="w-4 h-4 text-emerald-700" />
                  <span>Cadastral Map</span>
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div className="p-3 bg-slate-50 rounded-2xl">
                <span className="text-slate-400 font-semibold block text-[10px] uppercase">Registered Owner</span>
                <span className="font-bold text-slate-900">{rec.ownerName}</span>
              </div>
              <div className="p-3 bg-slate-50 rounded-2xl">
                <span className="text-slate-400 font-semibold block text-[10px] uppercase">Total Area</span>
                <span className="font-bold text-slate-900">{rec.totalAreaHa} Hectares (4.5 Acres)</span>
              </div>
              <div className="p-3 bg-slate-50 rounded-2xl">
                <span className="text-slate-400 font-semibold block text-[10px] uppercase">Cultivable Area</span>
                <span className="font-bold text-emerald-800">{rec.cultivableAreaHa} Hectares</span>
              </div>
              <div className="p-3 bg-slate-50 rounded-2xl">
                <span className="text-slate-400 font-semibold block text-[10px] uppercase">Recorded Crops</span>
                <span className="font-bold text-slate-900">{rec.cropsRegistered.join(', ')}</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      <FarmMapModal
        isOpen={mapOpen}
        onClose={() => setMapOpen(false)}
        initialAcres={4.5}
        onSaveBoundary={() => setMapOpen(false)}
      />
    </div>
  );
};
