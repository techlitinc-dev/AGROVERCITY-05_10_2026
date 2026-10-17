import React, { useState } from 'react';
import { MapPin, Check, RefreshCw } from 'lucide-react';
import { ModalSheet } from './ModalSheet';

interface FarmMapModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaveBoundary: (areaAcres: number, coordinates: { lat: number; lng: number }[]) => void;
  initialAcres?: number;
}

export const FarmMapModal: React.FC<FarmMapModalProps> = ({
  isOpen,
  onClose,
  onSaveBoundary,
  initialAcres = 4.5,
}) => {
  const [acres, setAcres] = useState<number>(initialAcres);
  const [gatNumber, setGatNumber] = useState<string>('312');
  const [isSaved, setIsSaved] = useState<boolean>(false);

  const samplePoints = [
    { x: 80, y: 70 },
    { x: 320, y: 60 },
    { x: 380, y: 220 },
    { x: 260, y: 310 },
    { x: 70, y: 250 },
  ];

  const polygonPath = samplePoints.map((p) => `${p.x},${p.y}`).join(' ');

  const handleSave = () => {
    setIsSaved(true);
    onSaveBoundary(acres, [
      { lat: 20.0824, lng: 73.9841 },
      { lat: 20.0835, lng: 73.9875 },
      { lat: 20.0805, lng: 73.9882 },
      { lat: 20.0792, lng: 73.9839 },
    ]);
    setTimeout(() => {
      setIsSaved(false);
      onClose();
    }, 600);
  };

  return (
    <ModalSheet
      isOpen={isOpen}
      onClose={onClose}
      title="Farm Parcel Boundary (Geofence Map)"
      description="Verify boundary perimeter for Gat / Survey No. 312, Pimpalgaon Baswant"
      maxWidth="lg"
    >
      <div className="space-y-4">
        {/* Interactive Satellite/Boundary Canvas Simulation */}
        <div className="relative w-full h-72 rounded-2xl bg-slate-900 overflow-hidden border border-slate-300 shadow-inner">
          {/* Simulated Satellite Grid Texture */}
          <div className="absolute inset-0 opacity-40 bg-[radial-gradient(#15803d_1px,transparent_1px)] [background-size:16px_16px]" />

          {/* Simulated Satellite imagery backdrop */}
          <img
            src="https://images.unsplash.com/photo-1500382017468-9049fed747ef?auto=format&fit=crop&w=800&q=80"
            alt="Satellite farmland"
            className="absolute inset-0 w-full h-full object-cover opacity-50 filter saturate-150 contrast-125"
          />

          {/* SVG Boundary Layer */}
          <svg className="absolute inset-0 w-full h-full" viewBox="0 0 450 350">
            {/* Parcel Polygon */}
            <polygon
              points={polygonPath}
              className="fill-emerald-500/30 stroke-emerald-400 stroke-[3] filter drop-shadow-[0_2px_8px_rgba(16,185,129,0.5)]"
            />
            {/* Polygon Corner Pins */}
            {samplePoints.map((p, idx) => (
              <g key={idx}>
                <circle cx={p.x} cy={p.y} r="6" className="fill-white stroke-emerald-600 stroke-2" />
                <circle cx={p.x} cy={p.y} r="2" className="fill-emerald-600" />
              </g>
            ))}
            {/* Center Label */}
            <text
              x="210"
              y="180"
              textAnchor="middle"
              className="fill-white font-bold text-xs shadow-md tracking-wider uppercase bg-black/50"
            >
              Gat {gatNumber} • {acres} Acres
            </text>
          </svg>

          {/* Map Overlay Controls */}
          <div className="absolute top-3 left-3 bg-slate-900/80 backdrop-blur-md px-3 py-1.5 rounded-xl border border-white/20 text-white text-xs flex items-center gap-2">
            <MapPin className="w-4 h-4 text-emerald-400" />
            <span>20.0824° N, 73.9841° E</span>
          </div>

          <div className="absolute bottom-3 right-3 bg-slate-900/80 backdrop-blur-md px-3 py-1.5 rounded-xl border border-white/20 text-white text-xs font-semibold">
            Perimeter: 1,420 meters
          </div>
        </div>

        {/* Inputs & Acreage adjustments */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Gat / Survey Number</label>
            <input
              type="text"
              value={gatNumber}
              onChange={(e) => setGatNumber(e.target.value)}
              className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 outline-none"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Total Cultivable Area</label>
            <div className="relative">
              <input
                type="number"
                step="0.1"
                value={acres}
                onChange={(e) => setAcres(parseFloat(e.target.value) || 0)}
                className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 outline-none pr-14"
              />
              <span className="absolute right-3 top-2.5 text-xs text-slate-400 font-semibold">Acres</span>
            </div>
          </div>
        </div>

        {/* Action Button */}
        <button
          onClick={handleSave}
          disabled={isSaved}
          className="w-full mt-2 py-3 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white rounded-xl font-bold text-sm shadow-md flex items-center justify-center gap-2 transition-all"
        >
          {isSaved ? (
            <>
              <Check className="w-5 h-5 text-emerald-200" />
              Boundary Saved!
            </>
          ) : (
            <>
              <Check className="w-5 h-5" />
              Confirm & Lock Farm Boundary
            </>
          )}
        </button>
      </div>
    </ModalSheet>
  );
};
