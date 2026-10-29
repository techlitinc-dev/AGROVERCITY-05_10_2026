import React, { useEffect, useRef, useState } from 'react';
import { ScanLine, Camera, Sparkles, AlertTriangle, History, ImagePlus } from 'lucide-react';
import { advisory, apiClient, apiErrorMessage } from '../../lib/api';
import { formatDateTime } from '../../lib/utils';
import { asRecord, asRecords, bool, num, pick, pickNum, pickStr, str } from '../shared/records';

interface ScanResult {
  disease: string;
  confidence: number;
  remedy?: string;
  treatment?: string;
  organic?: string;
}

interface ScanState {
  scanId?: string;
  photoUrl?: string;
  passed: boolean;
  retake?: string;
  demo: boolean;
  results: ScanResult[];
}

/**
 * POST /advisory/disease-scan is multipart on the backend (fields: `image`,
 * optional `plotId`). The typed `advisory.diseaseScan` wrapper posts JSON, so
 * this view calls apiClient directly with FormData (gap logged in the report).
 */
async function postDiseaseScan(file: File, plotId: string): Promise<unknown> {
  const form = new FormData();
  form.append('image', file);
  if (plotId.trim()) form.append('plotId', plotId.trim());
  const res = await apiClient.post('/advisory/disease-scan', form);
  return res.data?.data ?? res.data;
}

export const DiseaseScanView: React.FC = () => {
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [plotId, setPlotId] = useState('');
  const [scanning, setScanning] = useState(false);
  const [scan, setScan] = useState<ScanState | null>(null);
  const [history, setHistory] = useState<Record<string, unknown>[]>([]);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let alive = true;
    advisory
      .diseaseScans()
      .then((rows) => {
        if (alive) setHistory(asRecords(rows));
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const chosen = e.target.files?.[0] ?? null;
    setFile(chosen);
    setPreviewUrl(chosen ? URL.createObjectURL(chosen) : null);
    setScan(null);
    setError(null);
  };

  const handleScan = async () => {
    if (!file || scanning) return;
    setScanning(true);
    setError(null);
    try {
      const payload = await postDiseaseScan(file, plotId);
      const rec = asRecord(payload);
      const gate = asRecord(pick(rec, 'gate'));
      const results = asRecords(pick(rec, 'results')).map((r) => ({
        disease: pickStr(r, 'disease', 'name', 'label', 'title') || 'Unidentified pathogen',
        confidence: pickNum(r, 'confidence', 'confidenceScore', 'score'),
        remedy: pickStr(r, 'remedy', 'recommendation', 'advice'),
        treatment: pickStr(r, 'treatment', 'chemicalControl', 'chemical'),
        organic: pickStr(r, 'organic', 'organicControl', 'organicRemedy'),
      }));
      setScan({
        scanId: pickStr(rec, 'scanId', 'id') || undefined,
        photoUrl: pickStr(rec, 'photoUrl', 'photo_url') || previewUrl || undefined,
        passed: bool(pick(gate, 'passed'), results.length > 0),
        retake: pickStr(rec, 'retake') || undefined,
        demo: Boolean(pick(rec, 'demo')),
        results,
      });
      // Refresh history with the newest scan at the top.
      advisory
        .diseaseScans()
        .then((rows) => setHistory(asRecords(rows)))
        .catch(() => undefined);
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setScanning(false);
    }
  };

  const topResult = scan?.results[0];

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="border-b border-slate-200 pb-4">
        <h1 className="text-2xl font-extrabold text-slate-900 flex items-center gap-2">
          <ScanLine className="w-7 h-7 text-rose-500" />
          AI Scanner
        </h1>
        <p className="text-xs text-slate-500 mt-1">
          Take a photo of an infected leaf or crop to identify pathogens and receive immediate organic and chemical remedies
        </p>
      </div>

      {error && (
        <div className="bg-rose-50 border border-rose-200 rounded-2xl p-3 text-xs text-rose-800 flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 text-rose-600 flex-shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/80 shadow-xs space-y-6">
        {/* Upload canvas */}
        <div className="relative w-full h-72 rounded-2xl bg-slate-900 overflow-hidden flex items-center justify-center border-2 border-dashed border-slate-300">
          {previewUrl ? (
            <img src={previewUrl} alt="Leaf to scan" className="w-full h-full object-cover opacity-80" />
          ) : (
            <div className="text-center text-slate-400 space-y-2 px-6">
              <Camera className="w-10 h-10 mx-auto text-slate-500" />
              <p className="text-xs font-semibold">Upload a clear close-up photo of the infected leaf</p>
            </div>
          )}

          {scanning && (
            <div className="absolute inset-0 bg-emerald-950/60 backdrop-blur-xs flex flex-col items-center justify-center text-white space-y-2">
              <ScanLine className="w-12 h-12 text-emerald-400 animate-bounce" />
              <p className="text-xs font-bold animate-pulse">Running Neural Vision Diagnostic...</p>
            </div>
          )}

          {!scanning && (
            <div className="absolute bottom-4 left-4 right-4 flex flex-col sm:flex-row gap-2 justify-between items-stretch sm:items-center bg-black/60 backdrop-blur-md p-3 rounded-2xl text-white text-xs">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={handleFileChange}
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                className="px-3.5 py-1.5 bg-white/10 hover:bg-white/20 border border-white/20 rounded-xl font-bold flex items-center justify-center gap-1.5 transition-colors"
              >
                <ImagePlus className="w-4 h-4" /> {file ? 'Change Photo' : 'Choose Photo'}
              </button>
              <button
                onClick={() => void handleScan()}
                disabled={!file}
                className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white rounded-xl font-bold shadow-xs transition-colors"
              >
                {file ? 'Scan Leaf' : 'Select a photo first'}
              </button>
            </div>
          )}
        </div>

        {/* Optional plot tag */}
        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1">
            Plot ID (optional — links the scan to your farm plot)
          </label>
          <input
            type="text"
            value={plotId}
            onChange={(e) => setPlotId(e.target.value)}
            placeholder="e.g. plot_8f31"
            className="w-full sm:w-64 px-3 py-2.5 text-xs rounded-xl border border-slate-300 focus:outline-none focus:border-emerald-600"
          />
        </div>

        {/* Diagnosis results */}
        {scan && !scan.passed && (
          <div className="p-5 bg-amber-50/70 border border-amber-200 rounded-3xl space-y-2">
            <h3 className="text-sm font-extrabold text-amber-900 flex items-center gap-1.5">
              <AlertTriangle className="w-4 h-4" /> Photo needs a retake
            </h3>
            <p className="text-xs text-amber-800 leading-relaxed">
              {scan.retake || 'The image could not be analyzed. Please upload a sharper, well-lit close-up of a single leaf.'}
            </p>
          </div>
        )}

        {scan && scan.passed && topResult && (
          <div className="p-5 bg-rose-50/70 border border-rose-200 rounded-3xl space-y-4">
            <div className="flex items-start justify-between gap-2">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-rose-800 bg-rose-100 px-2.5 py-0.5 rounded-full">
                  Confidence: {(topResult.confidence * 100 > 100 ? topResult.confidence : topResult.confidence * 100).toFixed(1)}% Match
                  {scan.demo && ' · Demo model'}
                </span>
                <h3 className="text-lg font-extrabold text-slate-900 mt-1.5">{topResult.disease}</h3>
                {scan.scanId && (
                  <p className="text-[11px] text-slate-400 font-mono mt-0.5">Scan ID: {scan.scanId}</p>
                )}
              </div>
            </div>

            <div className="space-y-2 text-xs text-slate-700 leading-relaxed bg-white p-4 rounded-2xl border border-rose-100">
              <h5 className="font-bold text-slate-900 flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-emerald-600" /> Recommended Action Protocol:
              </h5>
              <ul className="list-disc pl-5 space-y-1 mt-1 text-slate-600">
                {topResult.organic && (
                  <li>
                    <strong>Organic control:</strong> {topResult.organic}
                  </li>
                )}
                {topResult.treatment && (
                  <li>
                    <strong>Chemical spray:</strong> {topResult.treatment}
                  </li>
                )}
                {topResult.remedy && <li>{topResult.remedy}</li>}
                {!topResult.organic && !topResult.treatment && !topResult.remedy && (
                  <li>Consult a local agronomist for a spray schedule matched to your crop stage.</li>
                )}
              </ul>
              {scan.results.length > 1 && (
                <p className="text-[11px] text-slate-400 pt-1">
                  Also matched: {scan.results.slice(1).map((r) => r.disease).join(', ')}
                </p>
              )}
            </div>
          </div>
        )}

        {/* History */}
        <div className="space-y-3">
          <h3 className="font-bold text-sm text-slate-900 flex items-center gap-1.5">
            <History className="w-4 h-4 text-slate-400" /> Previous Scans
          </h3>
          {history.length === 0 ? (
            <p className="text-xs text-slate-400">No scans yet — your diagnosis history will appear here.</p>
          ) : (
            <div className="space-y-2">
              {history.slice(0, 8).map((h, i) => {
                const diagnosis = asRecord(pick(h, 'diagnosis'));
                return (
                  <div
                    key={pickStr(h, 'scanId', 'id') || i}
                    className="flex items-center justify-between gap-3 p-3 rounded-2xl border border-slate-100 bg-slate-50/60 text-xs"
                  >
                    <div>
                      <p className="font-bold text-slate-800">
                        {pickStr(diagnosis, 'disease', 'name', 'label') || 'Scan result'}
                      </p>
                      <p className="text-[11px] text-slate-400">
                        {formatDateTime(pickStr(h, 'createdAt')) || '—'}
                        {pick(h, 'plotId') ? ` · Plot ${str(pick(h, 'plotId'))}` : ''}
                      </p>
                    </div>
                    <span className="font-bold text-rose-700">
                      {(num(pick(h, 'confidence')) * 100).toFixed(0)}%
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
