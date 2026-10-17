import React, { useEffect, useState } from 'react';
import { FileSpreadsheet, Search, ShieldCheck, Map, Download, Import, Loader2 } from 'lucide-react';
import { landRecords, apiErrorMessage } from '../../lib/api';
import { FarmMapModal } from '../../components/common/FarmMapModal';
import type { LandRecord712 } from '../../types';

export const LandRecordsView: React.FC = () => {
  const [surveyQuery, setSurveyQuery] = useState('312');
  const [district, setDistrict] = useState('');
  const [records, setRecords] = useState<LandRecord712[]>([]);
  const [searched, setSearched] = useState(false);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [mapOpen, setMapOpen] = useState(false);
  const [mapRecord, setMapRecord] = useState<LandRecord712 | null>(null);

  // Preload the farmer's already-imported records on first paint.
  useEffect(() => {
    let active = true;
    landRecords
      .search({})
      .then((res) => {
        if (!active) return;
        setRecords(res);
        setSearched(true);
      })
      .catch(() => {
        /* prod: surface via explicit search instead */
      });
    return () => {
      active = false;
    };
  }, []);

  const handleSearch = async () => {
    setSearching(true);
    setError(null);
    setNotice(null);
    try {
      const params: Record<string, unknown> = {};
      if (surveyQuery.trim()) params.surveyNumber = surveyQuery.trim();
      if (district.trim()) params.district = district.trim();
      const res = await landRecords.search(params);
      setRecords(res);
      setSearched(true);
    } catch (e) {
      setError(apiErrorMessage(e));
    } finally {
      setSearching(false);
    }
  };

  const handleDownloadPdf = async (rec: LandRecord712) => {
    setError(null);
    setBusyId(rec.id);
    try {
      const blob = await landRecords.pdf(rec.id);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `7-12-gat-${rec.surveyNumber}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError(apiErrorMessage(e));
    } finally {
      setBusyId(null);
    }
  };

  const handleImport = async (rec: LandRecord712) => {
    setError(null);
    setBusyId(rec.id);
    try {
      const imported = await landRecords.import(rec.id);
      setRecords((prev) => prev.map((r) => (r.id === imported.id ? { ...r, ...imported } : r)));
      setNotice(`Gat ${rec.surveyNumber} imported into your Agrovercity profile.`);
    } catch (e) {
      setError(apiErrorMessage(e));
    } finally {
      setBusyId(null);
    }
  };

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
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            className="w-full pl-10 pr-4 py-2.5 text-xs rounded-2xl border border-slate-200 focus:outline-none focus:border-emerald-600"
          />
        </div>
        <input
          type="text"
          placeholder="District (optional)"
          value={district}
          onChange={(e) => setDistrict(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
          className="sm:w-48 px-4 py-2.5 text-xs rounded-2xl border border-slate-200 focus:outline-none focus:border-emerald-600"
        />
        <button
          onClick={handleSearch}
          disabled={searching}
          className="px-5 py-2.5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs flex items-center justify-center gap-2 disabled:opacity-60"
        >
          {searching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
          {searching ? 'Searching…' : 'Search Digital Record'}
        </button>
      </div>

      {error && (
        <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-2xl text-xs font-semibold text-rose-800">
          {error}
        </div>
      )}
      {notice && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-2xl text-xs font-semibold text-emerald-800 flex items-center justify-between">
          <span>{notice}</span>
          <button onClick={() => setNotice(null)} className="font-bold hover:underline">Dismiss</button>
        </div>
      )}

      {/* Record Cards */}
      <div className="space-y-4">
        {searched && records.length === 0 ? (
          <div className="py-10 text-center text-xs font-semibold text-slate-400 bg-white rounded-3xl border border-slate-200/80">
            No 7/12 records matched your search. Check the Gat number or district spelling.
          </div>
        ) : (
          records.map((rec) => (
            <div
              key={rec.id}
              className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs space-y-4"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-extrabold text-base text-slate-900">
                      Gat No. {rec.surveyNumber} (Hissa {rec.subDivision})
                    </h3>
                    {rec.isVerified && (
                      <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200 flex items-center gap-1">
                        <ShieldCheck className="w-3.5 h-3.5" /> Revenue Verified
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Village: {rec.village}, Taluka: {rec.taluka}, Dist: {rec.district}
                  </p>
                </div>

                <div className="flex gap-2 flex-wrap">
                  <button
                    onClick={() => {
                      setMapRecord(rec);
                      setMapOpen(true);
                    }}
                    className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold flex items-center gap-1.5 transition-colors"
                  >
                    <Map className="w-4 h-4 text-emerald-700" />
                    <span>Cadastral Map</span>
                  </button>
                  <button
                    onClick={() => handleDownloadPdf(rec)}
                    disabled={busyId === rec.id}
                    className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold flex items-center gap-1.5 transition-colors disabled:opacity-50"
                  >
                    <Download className="w-4 h-4 text-sky-700" />
                    <span>7/12 PDF</span>
                  </button>
                  <button
                    onClick={() => handleImport(rec)}
                    disabled={busyId === rec.id}
                    className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-1.5 transition-colors disabled:opacity-50"
                  >
                    <Import className="w-4 h-4" />
                    <span>Import to Profile</span>
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
                  <span className="font-bold text-slate-900">{rec.totalAreaHa} Hectares</span>
                </div>
                <div className="p-3 bg-slate-50 rounded-2xl">
                  <span className="text-slate-400 font-semibold block text-[10px] uppercase">Cultivable Area</span>
                  <span className="font-bold text-emerald-800">{rec.cultivableAreaHa} Hectares</span>
                </div>
                <div className="p-3 bg-slate-50 rounded-2xl">
                  <span className="text-slate-400 font-semibold block text-[10px] uppercase">Recorded Crops</span>
                  <span className="font-bold text-slate-900">{rec.cropsRegistered.join(', ') || '—'}</span>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      <FarmMapModal
        isOpen={mapOpen}
        onClose={() => setMapOpen(false)}
        initialAcres={mapRecord ? mapRecord.totalAreaHa * 2.47105 : 4.5}
        onSaveBoundary={() => setMapOpen(false)}
      />
    </div>
  );
};
