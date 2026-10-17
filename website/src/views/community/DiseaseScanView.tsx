import React, { useState } from 'react';
import { ScanLine, Camera, CheckCircle2, AlertTriangle, Sparkles, RefreshCw } from 'lucide-react';
import { formatCurrency } from '../../lib/utils';

export const DiseaseScanView: React.FC = () => {
  const [scanning, setScanning] = useState(false);
  const [hasScanned, setHasScanned] = useState(true);

  const handleSimulateScan = () => {
    setScanning(true);
    setTimeout(() => {
      setScanning(false);
      setHasScanned(true);
    }, 1200);
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="border-b border-slate-200 pb-4">
        <h1 className="text-2xl font-extrabold text-slate-900 flex items-center gap-2">
          <ScanLine className="w-7 h-7 text-rose-500" />
          AI Leaf Disease & Pest Scanner
        </h1>
        <p className="text-xs text-slate-500 mt-1">
          Take a photo of an infected leaf or crop to identify pathogens and receive immediate organic and chemical remedies
        </p>
      </div>

      <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/80 shadow-xs space-y-6">
        {/* Camera / Upload Canvas */}
        <div className="relative w-full h-72 rounded-2xl bg-slate-900 overflow-hidden flex items-center justify-center border-2 border-dashed border-slate-300">
          <img
            src="https://images.unsplash.com/photo-1595855759920-86582396756a?auto=format&fit=crop&w=800&q=80"
            alt="Sample leaf scan"
            className="w-full h-full object-cover opacity-70"
          />

          {scanning && (
            <div className="absolute inset-0 bg-emerald-950/60 backdrop-blur-xs flex flex-col items-center justify-center text-white space-y-2">
              <ScanLine className="w-12 h-12 text-emerald-400 animate-bounce" />
              <p className="text-xs font-bold animate-pulse">Running Neural Vision Diagnostic...</p>
            </div>
          )}

          {!scanning && (
            <div className="absolute bottom-4 left-4 right-4 flex justify-between items-center bg-black/60 backdrop-blur-md p-3 rounded-2xl text-white text-xs">
              <span className="flex items-center gap-1.5 font-semibold">
                <Camera className="w-4 h-4 text-emerald-400" /> Soybean Field Gat 312
              </span>
              <button
                onClick={handleSimulateScan}
                className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold shadow-xs transition-colors"
              >
                Scan Another Leaf
              </button>
            </div>
          )}
        </div>

        {/* Diagnosis Results Card */}
        {hasScanned && (
          <div className="p-5 bg-rose-50/70 border border-rose-200 rounded-3xl space-y-4">
            <div className="flex items-start justify-between gap-2">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-rose-800 bg-rose-100 px-2.5 py-0.5 rounded-full">
                  Confidence: 96.4% Match
                </span>
                <h3 className="text-lg font-extrabold text-slate-900 mt-1.5">
                  Early Cercospora Leaf Blight (Cercospora kikuchii)
                </h3>
                <p className="text-xs text-slate-500">Affects soybean foliage, causing purple speckling and defoliation</p>
              </div>
            </div>

            <div className="space-y-2 text-xs text-slate-700 leading-relaxed bg-white p-4 rounded-2xl border border-rose-100">
              <h5 className="font-bold text-slate-900 flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-emerald-600" /> Recommended Action Protocol:
              </h5>
              <ul className="list-disc pl-5 space-y-1 mt-1 text-slate-600">
                <li>
                  <strong>Organic control:</strong> Foliar spray of Trichoderma harzianum @ 5g/liter or Neem oil (10,000 PPM) @ 2ml/L.
                </li>
                <li>
                  <strong>Chemical spray:</strong> Azoxystrobin 18.2% + Difenoconazole 11.4% SC @ 200 ml/acre in 200L clean water.
                </li>
                <li>Avoid overhead irrigation during evening to limit leaf wetness duration.</li>
              </ul>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
