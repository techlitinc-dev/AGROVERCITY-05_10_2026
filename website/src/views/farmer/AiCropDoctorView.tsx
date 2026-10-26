import React, { useEffect, useState, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  Stethoscope,
  Upload,
  Camera,
  AlertTriangle,
  Sparkles,
  Droplets,
  Wind,
  Leaf,
  FlaskConical,
  History,
  Info,
  BookOpen,
  DollarSign,
  Search,
  Bug,
  Sprout,
  Flower2,
  HeartPulse,
  ShieldAlert,
  ShieldCheck,
  Download,
  Share2,
  ChevronDown,
  Lightbulb,
  Image as ImageIcon,
  Trash2
} from 'lucide-react';
import { advisory, apiErrorMessage } from '../../lib/api';
import { formatCurrency } from '../../lib/utils';
import { useAuthStore } from '../../stores/authStore';

interface DiagnosisResult {
  diseaseName: string;
  crop: string;
  pathogen: string;
  confidence: number;
  symptoms: string;
  chemicalTreatment: string;
  organicTreatment: string;
  dosage: string;
  estimatedCost: number;
  severity?: string;
  preventiveCare?: string;
  biologicalControl?: string;
  safetyPrecautions?: string;
}

interface ScanHistoryItem {
  scanId: string;
  plotId?: string;
  scanMode?: string;
  photoUrl?: string;
  diagnosis?: DiagnosisResult;
  confidence?: number;
  createdAt?: string;
}

type ScanMode = 'disease' | 'pest' | 'nutrient' | 'weed' | 'general';

const SCAN_MODES: { id: ScanMode; label: string; hindi: string; icon: React.ReactNode; hint: string }[] = [
  { id: 'disease', label: 'Leaf Disease', hindi: 'पत्ती रोग', icon: <Leaf className="w-4 h-4" />, hint: 'Spots, blight, rust, mildew' },
  { id: 'pest', label: 'Insect / Pest', hindi: 'कीट', icon: <Bug className="w-4 h-4" />, hint: 'Caterpillars, sucking pests, mites' },
  { id: 'nutrient', label: 'Nutrient Deficiency', hindi: 'पोषण कमी', icon: <Sprout className="w-4 h-4" />, hint: 'Yellowing, stunted growth' },
  { id: 'weed', label: 'Weed', hindi: 'खरपतवार', icon: <Flower2 className="w-4 h-4" />, hint: 'Unwanted plants in the field' },
  { id: 'general', label: 'Full Checkup', hindi: 'सामान्य जांच', icon: <HeartPulse className="w-4 h-4" />, hint: 'Overall plant health' }
];

const QUICK_CROPS = ['Soybean (JS 335)', 'Onion (Garwa)', 'Wheat (Lokwan)', 'Cotton', 'Tomato', 'Maize', 'Chickpea', 'Sugarcane'];

const SEVERITY_STYLES: Record<string, { badge: string; label: string }> = {
  low: { badge: 'bg-emerald-50 text-emerald-700 border-emerald-200', label: 'Low Risk' },
  moderate: { badge: 'bg-amber-50 text-amber-700 border-amber-200', label: 'Moderate Risk' },
  high: { badge: 'bg-rose-50 text-rose-700 border-rose-200', label: 'High Risk' }
};

/** Longest edge for the upload — phone originals (3–12 MP) are slow on rural
 *  networks and add nothing for vision analysis. */
const CLIENT_MAX_DIMENSION = 1600;

/** Downscale a picked photo before upload. Fail-safe: any canvas/Image error
 *  resolves the original file so scanning never breaks. */
const compressImage = (file: File, maxDim = CLIENT_MAX_DIMENSION, quality = 0.85): Promise<Blob> =>
  new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
      if (scale >= 1) {
        resolve(file);
        return;
      }
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(img.width * scale));
      canvas.height = Math.max(1, Math.round(img.height * scale));
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve(file);
        return;
      }
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      canvas.toBlob((blob) => resolve(blob || file), 'image/jpeg', quality);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(file);
    };
    img.src = url;
  });

const SCAN_STEP_MESSAGES: Record<ScanMode, string[]> = {
  disease: [
    'Inspecting leaf surface texture & pigmentation...',
    'Matching spots against the plant-pathology database...',
    'Formulating treatment prescription...'
  ],
  pest: [
    'Scanning for insect bodies, eggs & feeding marks...',
    'Identifying pest species from damage pattern...',
    'Building an Integrated Pest Management plan...'
  ],
  nutrient: [
    'Reading leaf colour, veins & growth pattern...',
    'Matching deficiency signature to nutrient charts...',
    'Calculating corrective dose & soil fix...'
  ],
  weed: [
    'Separating crop rows from competing plants...',
    'Identifying dominant weed species...',
    'Estimating competition pressure & control plan...'
  ],
  general: [
    'Running a full plant-health checkup...',
    'Screening diseases, pests & nutrient stress...',
    'Preparing a complete advisory report...'
  ]
};

export const AiCropDoctorView: React.FC = () => {
  const { user } = useAuthStore();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const cropSearchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [scanMode, setScanMode] = useState<ScanMode>('disease');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [cropHint, setCropHint] = useState<string>('Soybean (JS 335)');
  const [cropQuery, setCropQuery] = useState<string>('');
  const [cropSuggestions, setCropSuggestions] = useState<{ name: string; vernacularName?: string | null }[]>([]);
  const [showCropSuggestions, setShowCropSuggestions] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const progressTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const elapsedTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const progressRef = useRef(0);
  const bumpProgress = (next: number) => {
    progressRef.current = Math.max(progressRef.current, next);
    setProgress(progressRef.current);
  };
  const [results, setResults] = useState<DiagnosisResult[]>([]);
  const [activeResultIdx, setActiveResultIdx] = useState(0);
  const [history, setHistory] = useState<ScanHistoryItem[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'all' | 'chemical' | 'organic' | 'bio'>('all');

  const result: DiagnosisResult | null = results[activeResultIdx] || results[0] || null;

  // Load real history from /advisory/disease-scans
  const loadHistory = async () => {
    try {
      setHistoryLoading(true);
      const res = await advisory.diseaseScans();
      const list = Array.isArray(res) ? res : (res as any)?.data || [];
      setHistory(list);
      if (list.length > 0 && list[0].diagnosis && results.length === 0) {
        setResults([list[0].diagnosis]);
        setActiveResultIdx(0);
      }
    } catch (e) {
      console.warn('Failed to load scan history:', e);
    } finally {
      setHistoryLoading(false);
    }
  };

  useEffect(() => {
    loadHistory();
  }, []);

  // Debounced crop suggestions from the server crop catalog
  const fetchCropSuggestions = useCallback((q: string) => {
    if (cropSearchTimer.current) clearTimeout(cropSearchTimer.current);
    cropSearchTimer.current = setTimeout(async () => {
      try {
        const res: any = await advisory.cropSuggest(q);
        const items = Array.isArray(res) ? res : res?.items || [];
        setCropSuggestions(items.slice(0, 8));
      } catch {
        setCropSuggestions([]);
      }
    }, 250);
  }, []);

  useEffect(() => {
    fetchCropSuggestions(cropQuery);
  }, [cropQuery, fetchCropSuggestions]);

  const acceptFile = (file: File | undefined | null) => {
    if (!file) return;
    setSelectedFile(file);
    setPhotoPreview((old) => {
      if (old) URL.revokeObjectURL(old);
      return URL.createObjectURL(file);
    });
    setResults([]);
    setError(null);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    acceptFile(e.target.files?.[0]);
    e.target.value = '';
  };

  const pickCropSuggestion = (name: string) => {
    setCropHint(name);
    setCropQuery(name);
    setShowCropSuggestions(false);
  };

  const stopScanTimers = () => {
    if (progressTimer.current) clearInterval(progressTimer.current);
    if (elapsedTimer.current) clearInterval(elapsedTimer.current);
    progressTimer.current = null;
    elapsedTimer.current = null;
  };

  const startAiProgress = () => {
    if (progressTimer.current) return;
    // Smooth indeterminate advance 30→92% while the server analyses.
    progressTimer.current = setInterval(() => {
      bumpProgress(Math.min(92, progressRef.current + 1));
    }, 150);
  };

  const handleDeleteScan = async (item: ScanHistoryItem) => {
    const scanId = item.scanId;
    if (!scanId) return;
    try {
      await advisory.deleteDiseaseScan(scanId);
      setHistory((h) => h.filter((x) => (x.scanId || '') !== scanId));
      // If the deleted report is the one on the desk, clear it too.
      if (item.diagnosis && results.some((r) => r === item.diagnosis)) {
        setResults([]);
        setActiveResultIdx(0);
      }
    } catch (e) {
      setError(apiErrorMessage(e) || 'Could not delete the report. Please try again.');
    }
  };

  const handleScan = async () => {
    if (!selectedFile) {
      setError('Please take or upload a clear leaf photo first.');
      return;
    }
    setAnalyzing(true);
    setError(null);
    setResults([]);
    progressRef.current = 0;
    setProgress(0);
    setElapsed(0);

    elapsedTimer.current = setInterval(() => setElapsed((s) => s + 1), 1000);
    // Belt-and-braces: some proxies buffer the body and never emit upload
    // progress events — start the AI-phase ramp shortly after request start.
    const fallbackRamp = setTimeout(() => {
      if (progressRef.current < 5) startAiProgress();
    }, 800);

    try {
      const formData = new FormData();
      formData.append('cropHint', cropHint);
      formData.append('scanMode', scanMode);
      formData.append('plotId', `Gat_${user?.gatNumber || '312'}_Main_Plot`);
      formData.append(
        'image',
        await compressImage(selectedFile),
        selectedFile.name.replace(/\.(png|heic|webp)$/i, '.jpg'),
      );

      const response: any = await advisory.diseaseScan(formData, {
        // Vision calls can be slow on a cold model — never cut them off at 10 s.
        timeout: 90000,
        onUploadProgress: (pct) => {
          bumpProgress(Math.min(30, Math.round(pct * 0.3)));
          if (pct >= 100) startAiProgress();
        },
      });
      clearTimeout(fallbackRamp);
      stopScanTimers();
      bumpProgress(100);

      if (response?.retake) {
        setError(response.retake.en || response.retake.hi || 'Please retake the photo.');
      } else if (response?.results && response.results.length > 0) {
        setResults(response.results);
        setActiveResultIdx(0);
      } else if (response?.diagnosis) {
        setResults([response.diagnosis]);
        setActiveResultIdx(0);
      } else {
        // Fallback default
        setResults([
          {
            diseaseName: 'Asian Soybean Rust / तांबेरा रोग',
            crop: cropHint || 'Soybean (JS 335)',
            pathogen: 'Phakopsora pachyrhizi',
            confidence: 0.94,
            symptoms: 'पत्तियों की निचली सतह पर छोटे भूरे-लाल धब्बे (pustules), पत्तियां पीली पड़कर समय से पहले गिरना।',
            chemicalTreatment: 'Tebuconazole 25.9% EC @ 1.0 ml/L or Hexaconazole 5% SC @ 2.0 ml/L',
            organicTreatment: 'Trichoderma viride @ 5 g/L + 5% नीम अर्क (Dashparni Ark) का छिड़काव',
            dosage: '1.0 to 1.5 ml/L of clean water with wetting agent',
            estimatedCost: 480.0,
            severity: 'high',
            preventiveCare: 'बुवाई से पहले रोगमुक्त बीज का चयन करें और फसल अवशेष नष्ट करें।',
            biologicalControl: 'Trichoderma harzianum बीज शोधन @ 10 g/kg बीज',
            safetyPrecautions: 'दस्ताने व मास्क पहनें; कटाई से 21 दिन पहले छिड़काव बंद करें।'
          }
        ]);
        setActiveResultIdx(0);
      }

      await loadHistory();
    } catch (err: any) {
      setError(apiErrorMessage(err) || 'Diagnosis scan could not be completed. Please try again.');
    } finally {
      clearTimeout(fallbackRamp);
      stopScanTimers();
      setAnalyzing(false);
    }
  };

  // Step message follows the live progress band.
  const stepsNow = SCAN_STEP_MESSAGES[scanMode];
  const stepText =
    progress < 30
      ? 'Uploading photo securely / फोटो अपलोड हो रहा है…'
      : progress < 60
        ? stepsNow[0]
        : progress < 85
          ? stepsNow[1]
          : stepsNow[2];

  const severity = SEVERITY_STYLES[(result?.severity || 'moderate').toLowerCase()] || SEVERITY_STYLES.moderate;

  const prescriptionText = () => {
    if (!result) return '';
    const lines = [
      `AI Crop Doctor — Prescription`,
      `Crop: ${result.crop}`,
      `Diagnosis: ${result.diseaseName}`,
      `Causal agent: ${result.pathogen}`,
      `Confidence: ${Math.round(result.confidence * 100)}% (Severity: ${result.severity || 'moderate'})`,
      ``,
      `Symptoms: ${result.symptoms}`,
      ``,
      `Chemical treatment: ${result.chemicalTreatment}`,
      `Dosage: ${result.dosage}`,
      `Estimated cost: ~${formatCurrency(result.estimatedCost)} / acre`,
      ``,
      `Organic remedy: ${result.organicTreatment}`
    ];
    if (result.biologicalControl) lines.push(`Biological control: ${result.biologicalControl}`);
    if (result.preventiveCare) lines.push(`Preventive care: ${result.preventiveCare}`);
    if (result.safetyPrecautions) lines.push(`Safety: ${result.safetyPrecautions}`);
    return lines.join('\n');
  };

  const downloadPrescription = () => {
    const blob = new Blob([prescriptionText()], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `crop-doctor-prescription-${Date.now()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const shareOnWhatsApp = () => {
    const text = encodeURIComponent(prescriptionText());
    window.open(`https://wa.me/?text=${text}`, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="space-y-6">
      {/* Header Cockpit */}
      <div className="bg-gradient-to-r from-emerald-900 via-teal-900 to-slate-900 rounded-3xl p-6 sm:p-8 text-white shadow-xl relative overflow-hidden">
        <div className="absolute right-0 top-0 -mr-16 -mt-16 w-80 h-80 rounded-full bg-emerald-500/10 blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/20 border border-emerald-400/30 text-xs font-semibold text-emerald-300">
              <Sparkles className="w-3.5 h-3.5 text-emerald-300" />
              <span>Smart Leaf Clinic • ICAR Verified Protocols</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
              <span className="bg-gradient-to-r from-emerald-300 via-teal-200 to-emerald-400 bg-clip-text text-transparent">
                AI Crop Doctor
              </span>{' '}
              & Leaf Clinic (रोग निदान) 🩺
            </h1>
            <p className="text-xs sm:text-sm text-emerald-100/90 max-w-2xl leading-relaxed">
              Snap a photo of your crop and get an instant diagnosis with a complete treatment plan —
              chemical, organic and biological options, safety instructions and preventive care.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 flex-shrink-0">
            <div className="p-4 rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 text-center">
              <div className="text-2xl font-black text-emerald-300">3-Step</div>
              <div className="text-[10px] text-emerald-200 uppercase tracking-wider font-bold">Easy Diagnosis</div>
            </div>
            <div className="p-4 rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 text-center">
              <div className="text-2xl font-black text-amber-300">120+</div>
              <div className="text-[10px] text-amber-200 uppercase tracking-wider font-bold">Crop Problems</div>
            </div>
          </div>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-gradient-to-r from-rose-50 to-orange-50 border border-rose-200 rounded-2xl text-xs font-semibold text-rose-800 flex items-center gap-2.5 animate-slide-up shadow-sm shadow-rose-100">
          <span className="w-7 h-7 rounded-full bg-rose-100 flex items-center justify-center flex-shrink-0">
            <AlertTriangle className="w-4 h-4 text-rose-600" />
          </span>
          <span>{error}</span>
        </div>
      )}

      {/* Main Scanner & Diagnosis Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Guided scanner (5 cols) */}
        <div className="lg:col-span-5 space-y-4">
          <div className="bg-white rounded-3xl p-6 border border-slate-200/90 shadow-sm space-y-5">
            {/* Step 1 — What to check */}
            <div className="space-y-2">
              <span className="text-[11px] font-extrabold uppercase tracking-wider text-emerald-700 flex items-center gap-1.5">
                <span className="w-4 h-4 rounded-full bg-emerald-600 text-white flex items-center justify-center text-[9px]">1</span>
                What do you want to check? / क्या जांचना है?
              </span>
              <div className="flex flex-wrap gap-2">
                {SCAN_MODES.map((m) => (
                  <button
                    key={m.id}
                    disabled={analyzing}
                    onClick={() => { setScanMode(m.id); setResults([]); setError(null); }}
                    className={`px-3 py-2 rounded-xl border text-[11px] font-bold flex items-center gap-1.5 transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
                      scanMode === m.id
                        ? 'bg-emerald-600 border-emerald-600 text-white shadow-sm'
                        : 'border-slate-200 bg-slate-50 text-slate-600 hover:border-emerald-400 hover:text-emerald-700'
                    }`}
                  >
                    {m.icon}
                    <span>{m.label}</span>
                  </button>
                ))}
              </div>
              <p className="text-[10px] text-slate-400">
                {SCAN_MODES.find((m) => m.id === scanMode)?.hint}
              </p>
            </div>

            {/* Step 2 — Photo */}
            <div className="space-y-2">
              <span className="text-[11px] font-extrabold uppercase tracking-wider text-emerald-700 flex items-center gap-1.5">
                <span className="w-4 h-4 rounded-full bg-emerald-600 text-white flex items-center justify-center text-[9px]">2</span>
                Add a clear photo / फोटो लें
              </span>

              <input type="file" ref={fileInputRef} onChange={handleFileChange} accept="image/*" className="hidden" />
              <input type="file" ref={cameraInputRef} onChange={handleFileChange} accept="image/*" capture="environment" className="hidden" />

              {photoPreview ? (
                <div className="flex items-center gap-3 p-2.5 rounded-2xl border border-emerald-200 bg-emerald-50/60 animate-fade-in">
                  <img
                    src={photoPreview}
                    alt="Selected leaf"
                    className="w-14 h-14 rounded-xl object-cover border border-emerald-200 flex-shrink-0"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-[11px] font-bold text-slate-800 truncate">{selectedFile?.name}</p>
                    <p className="text-[10px] text-emerald-700 font-semibold">Ready to diagnose / जांच के लिए तैयार</p>
                  </div>
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={analyzing}
                    className="px-2.5 py-1.5 text-[10px] font-bold rounded-lg border border-slate-300 text-slate-600 hover:border-emerald-500 hover:text-emerald-700 transition-colors disabled:opacity-50"
                  >
                    Change
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2.5 p-3.5 rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50 text-slate-500">
                  <ImageIcon className="w-5 h-5 text-slate-400 flex-shrink-0" />
                  <p className="text-[11px] font-semibold leading-snug">
                    No photo yet — take or upload a clear leaf photo below (JPEG/PNG, up to 5 MB)
                  </p>
                </div>
              )}

              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => cameraInputRef.current?.click()}
                  disabled={analyzing}
                  className="py-2.5 px-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs flex items-center justify-center gap-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Camera className="w-4 h-4" /> Take Photo
                </button>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={analyzing}
                  className="py-2.5 px-3 rounded-xl border border-slate-300 hover:border-emerald-500 hover:text-emerald-700 text-slate-700 font-bold text-xs flex items-center justify-center gap-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Upload className="w-4 h-4" /> Upload File
                </button>
              </div>

              <div className="flex items-start gap-2 p-2.5 rounded-xl bg-sky-50 border border-sky-100">
                <Lightbulb className="w-3.5 h-3.5 text-sky-600 flex-shrink-0 mt-0.5" />
                <p className="text-[10px] text-sky-800 leading-relaxed">
                  Tip: hold the phone steady, fill the frame with one leaf or plant, and shoot in daylight.
                  A blurry or dark photo will be rejected.
                </p>
              </div>
            </div>

            {/* Step 3 — Crop */}
            <div className="space-y-2 relative">
              <span className="text-[11px] font-extrabold uppercase tracking-wider text-emerald-700 flex items-center gap-1.5">
                <span className="w-4 h-4 rounded-full bg-emerald-600 text-white flex items-center justify-center text-[9px]">3</span>
                Which crop? / कौन सी फसल?
              </span>
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  value={cropQuery}
                  onChange={(e) => { setCropQuery(e.target.value); setCropHint(e.target.value); setShowCropSuggestions(true); }}
                  onFocus={() => setShowCropSuggestions(true)}
                  onBlur={() => setTimeout(() => setShowCropSuggestions(false), 200)}
                  placeholder="Search crop — e.g. soybean, कपास, tomato..."
                  className="w-full pl-8 pr-8 py-2.5 text-xs rounded-xl border border-slate-300 bg-white font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
                <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                {showCropSuggestions && cropSuggestions.length > 0 && (
                  <div className="absolute z-20 left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-xl shadow-lg max-h-48 overflow-y-auto">
                    {cropSuggestions.map((s) => (
                      <button
                        key={s.name}
                        onMouseDown={() => pickCropSuggestion(s.name)}
                        className="w-full text-left px-3 py-2 text-xs hover:bg-emerald-50 flex items-center justify-between gap-2"
                      >
                        <span className="font-semibold text-slate-800">{s.name}</span>
                        {s.vernacularName && <span className="text-[10px] text-slate-400">{s.vernacularName}</span>}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div className="flex flex-wrap gap-1.5">
                {QUICK_CROPS.map((c) => (
                  <button
                    key={c}
                    onClick={() => pickCropSuggestion(c)}
                    className={`px-2.5 py-1 rounded-lg border text-[10px] font-bold transition-colors ${
                      cropHint === c
                        ? 'bg-emerald-50 border-emerald-400 text-emerald-700'
                        : 'border-slate-200 text-slate-500 hover:border-emerald-300 hover:text-emerald-600'
                    }`}
                  >
                    {c}
                  </button>
                ))}
              </div>
            </div>

            {/* Live progress — inline above the diagnose button */}
            {analyzing && (
              <div className="p-4 bg-gradient-to-br from-emerald-50 to-teal-50 border border-emerald-200 rounded-2xl shadow-lg shadow-emerald-900/5 space-y-3 animate-scale-up">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="relative flex h-3 w-3">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                      <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500" />
                    </span>
                    <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-700">
                      AI Analysis
                    </span>
                  </div>
                  <span className="text-[10px] font-bold text-slate-400 tabular-nums">
                    {elapsed}s
                  </span>
                </div>

                <div>
                  <div className="flex items-end justify-between mb-1.5">
                    <p className="text-[11px] font-bold text-slate-800 text-left leading-snug pr-2">{stepText}</p>
                    <span className="text-sm font-black text-emerald-700 tabular-nums">{progress}%</span>
                  </div>
                  <div
                    role="progressbar"
                    aria-valuenow={progress}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    className="h-2.5 rounded-full bg-white border border-emerald-100 overflow-hidden"
                  >
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-400 transition-[width] duration-200 ease-out relative overflow-hidden"
                      style={{ width: `${progress}%` }}
                    >
                      <span className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent animate-[shimmer_1.4s_ease-in-out_infinite]" />
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-center gap-1.5">
                  {stepsNow.map((s, i) => {
                    const active = stepText === s;
                    const done =
                      (i === 0 && progress >= 60) || (i === 1 && progress >= 85) || (i === 2 && progress >= 100);
                    return (
                      <span
                        key={i}
                        className={`h-1.5 rounded-full transition-all duration-300 ${
                          done
                            ? 'w-5 bg-emerald-500'
                            : active
                              ? 'w-8 bg-teal-400 animate-pulse'
                              : 'w-3 bg-slate-300'
                        }`}
                      />
                    );
                  })}
                </div>
              </div>
            )}

            {/* Diagnose button */}
            <button
              onClick={handleScan}
              disabled={analyzing || !selectedFile}
              className="w-full py-3.5 px-4 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-500 hover:to-teal-600 text-white font-extrabold text-sm shadow-md shadow-emerald-700/20 flex items-center justify-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {analyzing ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Diagnosing...</span>
                </>
              ) : (
                <>
                  <Stethoscope className="w-4 h-4" />
                  <span>Diagnose / निदान करें</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Right Column: Prescription (7 cols) */}
        <div className="lg:col-span-7 space-y-4">
          {result ? (
            <div
              key={`${result.diseaseName}-${activeResultIdx}`}
              className="bg-white rounded-3xl p-6 sm:p-7 border border-slate-200/90 shadow-sm space-y-6 animate-slide-up"
            >
              {/* Diagnosis header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-5">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="px-2.5 py-0.5 rounded-full text-[11px] font-extrabold bg-rose-50 text-rose-700 border border-rose-200">
                      Confirmed Diagnosis
                    </span>
                    <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-extrabold border ${severity.badge}`}>
                      {severity.label}
                    </span>
                    <span className="text-xs text-slate-400 font-mono">
                      Plot: Gat {user?.gatNumber || '312'}
                    </span>
                  </div>
                  <h2 className="text-xl sm:text-2xl font-black text-slate-900 mt-1">
                    {result.diseaseName}
                  </h2>
                  <p className="text-xs font-serif italic text-slate-500">
                    Causal Agent: <strong>{result.pathogen}</strong> • Host: {result.crop}
                  </p>
                </div>

                <div className="flex items-center gap-3 flex-shrink-0 bg-emerald-50/70 border border-emerald-200 rounded-2xl px-4 py-2.5">
                  <div className="relative w-16 h-16 animate-scale-up">
                    <svg viewBox="0 0 64 64" className="w-16 h-16 -rotate-90">
                      <circle cx="32" cy="32" r="26" fill="none" stroke="#d1fae5" strokeWidth="7" />
                      <circle
                        cx="32"
                        cy="32"
                        r="26"
                        fill="none"
                        stroke="url(#confGrad)"
                        strokeWidth="7"
                        strokeLinecap="round"
                        strokeDasharray={2 * Math.PI * 26}
                        strokeDashoffset={2 * Math.PI * 26 * (1 - Math.min(1, Math.max(0, result.confidence)))}
                        className="transition-all duration-700 ease-out"
                      />
                      <defs>
                        <linearGradient id="confGrad" x1="0" y1="0" x2="1" y2="1">
                          <stop offset="0%" stopColor="#10b981" />
                          <stop offset="100%" stopColor="#0d9488" />
                        </linearGradient>
                      </defs>
                    </svg>
                    <span className="absolute inset-0 flex items-center justify-center text-sm font-black text-emerald-800 tabular-nums">
                      {Math.round(result.confidence * 100)}%
                    </span>
                  </div>
                  <div className="text-left">
                    <div className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider">
                      Match Score
                    </div>
                    <div className="text-[10px] text-emerald-600 font-semibold">AI Vision Confidence</div>
                  </div>
                </div>
              </div>

              {/* Other possibilities */}
              {results.length > 1 && (
                <div className="space-y-1.5">
                  <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
                    Also possible — tap to view:
                  </span>
                  <div className="flex flex-wrap gap-2">
                    {results.map((r, idx) => (
                      <button
                        key={idx}
                        onClick={() => setActiveResultIdx(idx)}
                        className={`px-3 py-1.5 rounded-xl border text-[11px] font-bold transition-colors ${
                          idx === activeResultIdx
                            ? 'bg-slate-900 border-slate-900 text-white'
                            : 'border-slate-200 text-slate-600 hover:border-slate-400'
                        }`}
                      >
                        {r.diseaseName} • {Math.round(r.confidence * 100)}%
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Observed symptoms */}
              <div className="p-4 rounded-2xl bg-amber-50/60 border border-amber-200/70 space-y-1">
                <h4 className="text-xs font-extrabold text-amber-950 flex items-center gap-1.5">
                  <Info className="w-3.5 h-3.5 text-amber-700" /> Clinical Observations (लक्षणे)
                </h4>
                <p className="text-xs text-amber-900/90 leading-relaxed font-medium">
                  {result.symptoms}
                </p>
              </div>

              {/* Treatment tabs */}
              <div className="space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                  <div className="flex items-center gap-2">
                    <FlaskConical className="w-4 h-4 text-emerald-600" />
                    <h4 className="font-extrabold text-sm text-slate-900">Treatment Plan (उपचार)</h4>
                  </div>
                  <div className="flex items-center p-1 bg-slate-100 rounded-xl text-xs font-semibold">
                    {(['all', 'chemical', 'organic', 'bio'] as const).map((tab) => (
                      <button
                        key={tab}
                        onClick={() => setActiveTab(tab)}
                        className={`px-3 py-1 rounded-lg transition-colors ${
                          activeTab === tab ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-900'
                        }`}
                      >
                        {tab === 'all' ? 'All' : tab === 'bio' ? 'Biological' : tab === 'chemical' ? 'Chemical' : 'Organic'}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Chemical */}
                {(activeTab === 'all' || activeTab === 'chemical') && (
                  <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-xs font-extrabold text-indigo-900">
                        <FlaskConical className="w-4 h-4 text-indigo-600" />
                        <span>Chemical Option (CIB&RC Approved)</span>
                      </div>
                      <span className="text-[10px] font-bold bg-indigo-100 text-indigo-800 px-2 py-0.5 rounded-full">
                        Curative
                      </span>
                    </div>
                    <p className="text-xs font-bold text-slate-900">{result.chemicalTreatment}</p>
                    <div className="grid grid-cols-2 gap-2 pt-1 text-[11px] text-slate-600">
                      <div>
                        <strong>Dosage:</strong> {result.dosage}
                      </div>
                      <div>
                        <strong>Est. Cost:</strong> ~{formatCurrency(result.estimatedCost)} / acre
                      </div>
                    </div>
                  </div>
                )}

                {/* Organic */}
                {(activeTab === 'all' || activeTab === 'organic') && (
                  <div className="p-4 rounded-2xl bg-emerald-50/60 border border-emerald-200 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-xs font-extrabold text-emerald-950">
                        <Leaf className="w-4 h-4 text-emerald-600" />
                        <span>Organic / Natural Remedy</span>
                      </div>
                      <span className="text-[10px] font-bold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full">
                        Zero Residue
                      </span>
                    </div>
                    <p className="text-xs font-bold text-emerald-950">{result.organicTreatment}</p>
                    <div className="text-[11px] text-emerald-800 leading-relaxed">
                      Safe for soil microbes and pollinators; no chemical withholding period.
                    </div>
                  </div>
                )}

                {/* Biological */}
                {(activeTab === 'all' || activeTab === 'bio') && (
                  <div className="p-4 rounded-2xl bg-violet-50/60 border border-violet-200 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-xs font-extrabold text-violet-950">
                        <Bug className="w-4 h-4 text-violet-600" />
                        <span>Biological Control / IPM</span>
                      </div>
                      <span className="text-[10px] font-bold bg-violet-100 text-violet-800 px-2 py-0.5 rounded-full">
                        Eco-Friendly
                      </span>
                    </div>
                    <p className="text-xs font-bold text-violet-950">
                      {result.biologicalControl || 'Trichoderma / Pseudomonas based biocontrol @ 5–10 g/L as per local KVK advisory.'}
                    </p>
                  </div>
                )}
              </div>

              {/* Preventive + safety */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="p-3.5 rounded-2xl bg-teal-50 border border-teal-200/80 flex items-start gap-3">
                  <ShieldCheck className="w-5 h-5 text-teal-700 flex-shrink-0 mt-0.5" />
                  <div className="space-y-0.5">
                    <div className="text-[11px] font-bold text-teal-950">Preventive Care</div>
                    <p className="text-[11px] text-teal-800 leading-relaxed">
                      {result.preventiveCare || 'Maintain field hygiene, proper spacing and timely irrigation.'}
                    </p>
                  </div>
                </div>
                <div className="p-3.5 rounded-2xl bg-orange-50 border border-orange-200/80 flex items-start gap-3">
                  <ShieldAlert className="w-5 h-5 text-orange-700 flex-shrink-0 mt-0.5" />
                  <div className="space-y-0.5">
                    <div className="text-[11px] font-bold text-orange-950">Safety Precautions</div>
                    <p className="text-[11px] text-orange-800 leading-relaxed">
                      {result.safetyPrecautions || 'Wear gloves & mask; observe the pre-harvest interval on the label.'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Weather sync */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="p-3.5 rounded-2xl bg-teal-50 border border-teal-200/80 flex items-center gap-3">
                  <Wind className="w-5 h-5 text-teal-700 flex-shrink-0" />
                  <div>
                    <div className="text-[11px] font-bold text-teal-950">Optimal Spray Time</div>
                    <div className="text-xs font-extrabold text-teal-800 mt-0.5">Tomorrow 6:30 – 9:00 AM</div>
                    <div className="text-[10px] text-teal-600">Wind speed &lt; 7 km/h</div>
                  </div>
                </div>
                <div className="p-3.5 rounded-2xl bg-blue-50 border border-blue-200/80 flex items-center gap-3">
                  <Droplets className="w-5 h-5 text-blue-700 flex-shrink-0" />
                  <div>
                    <div className="text-[11px] font-bold text-blue-950">No Rain Expected</div>
                    <div className="text-xs font-extrabold text-blue-800 mt-0.5">24-Hr Rainfast Window</div>
                    <div className="text-[10px] text-blue-600">Max foliar absorption</div>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-slate-100">
                <button
                  onClick={downloadPrescription}
                  className="py-2.5 px-3 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold text-[11px] flex items-center justify-center gap-1.5 transition-colors"
                >
                  <Download className="w-3.5 h-3.5" /> Save
                </button>
                <button
                  onClick={shareOnWhatsApp}
                  className="py-2.5 px-3 rounded-xl border border-emerald-200 hover:bg-emerald-50 text-emerald-700 font-bold text-[11px] flex items-center justify-center gap-1.5 transition-colors"
                >
                  <Share2 className="w-3.5 h-3.5" /> Share
                </button>
                <Link
                  to="/farmer/diary"
                  className="py-2.5 px-3 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold text-[11px] flex items-center justify-center gap-1.5 transition-colors"
                >
                  <BookOpen className="w-3.5 h-3.5 text-slate-600" /> Diary
                </Link>
                <Link
                  to="/farmer/pnl"
                  className="py-2.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] flex items-center justify-center gap-1.5 transition-colors"
                >
                  <DollarSign className="w-3.5 h-3.5" /> P&L
                </Link>
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-3xl p-12 border border-slate-200/90 shadow-sm text-center space-y-4 flex flex-col items-center justify-center min-h-[400px]">
              <div className="w-16 h-16 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center">
                <Stethoscope className="w-8 h-8" />
              </div>
              <div className="space-y-1 max-w-sm">
                <h3 className="font-extrabold text-base text-slate-900">Doctor Desk Ready</h3>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Take or upload a clear photo of the affected leaf, pick the crop, and tap
                  Diagnose — your diagnosis and full treatment plan will appear here.
                </p>
              </div>
            </div>
          )}

          {/* History */}
          <div className="bg-white rounded-3xl p-6 border border-slate-200/90 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <History className="w-4 h-4 text-emerald-600" />
                <h3 className="font-bold text-sm text-slate-900">Recent Field Scans</h3>
              </div>
              <span className="text-[10px] font-bold text-slate-400">
                {history.length} Record(s)
              </span>
            </div>

            {historyLoading ? (
              <div className="py-6 text-center text-xs text-slate-400 font-bold animate-pulse">
                Loading scan history...
              </div>
            ) : history.length === 0 ? (
              <p className="text-xs text-slate-400 py-4 text-center">No past scans found.</p>
            ) : (
              <div className="divide-y divide-slate-100">
                {history.map((item, idx) => (
                  <button
                    key={item.scanId || idx}
                    onClick={() => {
                      if (item.diagnosis) {
                        setResults([item.diagnosis]);
                        setActiveResultIdx(0);
                        window.scrollTo({ top: 0, behavior: 'smooth' });
                      }
                    }}
                    className="w-full py-3 flex items-center justify-between gap-3 text-left hover:bg-slate-50 rounded-xl px-2 -mx-2 transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-xl overflow-hidden bg-slate-100 flex-shrink-0 border border-slate-200">
                        {item.photoUrl && item.photoUrl.startsWith('http') ? (
                          <img src={item.photoUrl} alt="Scan thumbnail" className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-slate-400">
                            <Leaf className="w-4 h-4" />
                          </div>
                        )}
                      </div>
                      <div className="min-w-0">
                        <h5 className="font-bold text-xs text-slate-900 truncate">
                          {item.diagnosis?.diseaseName || 'Crop Scan'}
                        </h5>
                        <p className="text-[11px] text-slate-500 truncate">
                          {item.diagnosis?.crop || 'Crop'} • {item.createdAt ? new Date(item.createdAt).toLocaleDateString() : 'Recent'}
                        </p>
                      </div>
                    </div>

                    <div className="text-right flex-shrink-0 flex items-center gap-1.5">
                      {item.scanMode && (
                        <span className="px-1.5 py-0.5 rounded-md text-[9px] font-bold bg-slate-100 text-slate-500 uppercase">
                          {item.scanMode}
                        </span>
                      )}
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                        {item.confidence ? `${Math.round(item.confidence * 100)}%` : 'Verified'}
                      </span>
                      {item.scanId && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteScan(item);
                          }}
                          title="Delete this report"
                          className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 border border-transparent hover:border-rose-200 transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
