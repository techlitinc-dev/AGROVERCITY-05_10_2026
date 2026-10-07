import { api } from './client';

/**
 * Advisory hub wrappers — mirrors `backend/app/routers/advisory.py` one-to-one.
 *
 * Backend quirks (verified against backend/app/routers/advisory.py):
 * - Every route requires the `farmer` role (403 `FORBIDDEN` for other personas).
 * - Errors use the standard envelope `{ error: { code, message, fieldErrors } }`
 *   surfaced by `client.ts` as `ApiError`.
 * - `/advisory/saturation` records the farmer's own sowing intent when
 *   `shareSowingIntent: true` (opt-in consent copy lives in the UI) and always
 *   answers the aggregate saturation read; it never echoes other farmers' ids.
 * - `/advisory/sowing-intent` answers 201 and requires the `dataSharing` consent
 *   (403 `CONSENT_REQUIRED` otherwise).
 * - `/advisory/disease-scan` is multipart (`image` field, JPG/PNG ≤ 5 MB); a
 *   non-image answers 415 `UNSUPPORTED_FILE_TYPE`.
 * - `/advisory/pest-radar` uses the legacy `{data, page, pageSize, total}`
 *   envelope (NOT the cursor shape) — reports within `radiusKm` of the farmer.
 * - Money on this module is plain rupees (NPK input/derivations, legacy panel);
 *   the phase-05 additions (crop plan, scan history) carry integer paisa.
 */

// ---------- Market saturation (M13) ----------

export interface SaturationInput {
  crop: string;
  district: string;
  lat: number;
  lng: number;
  radiusKm?: number;
  /** Explicit opt-in: records this farmer's sowing intent for the district. */
  shareSowingIntent?: boolean;
}

export type SaturationRisk = 'green' | 'yellow' | 'red';

export interface AlternativeCrop {
  crop: string;
  /** Mandi-linked modal price in rupees/quintal; null when no mandi data exists. */
  expectedPrice: number | null;
}

export interface SaturationResult {
  sowingCount: number;
  radiusKm: number;
  expectedArrivalIncrease: string;
  riskLevel: SaturationRisk;
  /** Mandi-linked base price adjusted by the risk factor; 0 when no mandi data. */
  predictedPrice: number;
  predictedDate: string;
  alternativeCrops: AlternativeCrop[];
  /** Data-basis citation inputs — rendered next to every saturation result. */
  dataBasis: { count: number; district: string };
  /** `mandi_history` when a real mandi price was used, else `unavailable`. */
  priceSource: 'mandi_history' | 'unavailable';
  source: 'ai' | 'fallback';
  decisionId: string | null;
  automationLevel: string;
}

export async function saturation(input: SaturationInput): Promise<SaturationResult> {
  const { data } = await api.post<SaturationResult>('/advisory/saturation', input);
  return data;
}

export interface SowingIntentInput {
  crop: string;
  plotId?: string;
  /** ISO `YYYY-MM-DD`; a past date answers 422 `PAST_DATE`. */
  plannedDate: string;
}

export interface SowingIntentResult {
  recorded: boolean;
  isIntent: boolean;
}

export async function recordSowingIntent(
  input: SowingIntentInput
): Promise<SowingIntentResult> {
  const { data } = await api.post<SowingIntentResult>('/advisory/sowing-intent', input);
  return data;
}

// ---------- Pest radar (5 km) ----------

export interface PestAlert {
  disease: string;
  crop: string;
  distanceKm: number;
  riskLevel: string;
  reportedAt: string;
}

/** Cursor-less legacy envelope — see the module note above. */
export interface PestRadarPage {
  data: PestAlert[];
  page: number;
  pageSize: number;
  total: number;
}

export async function pestRadar(params: {
  lat: number;
  lng: number;
  radiusKm?: number;
}): Promise<PestRadarPage> {
  const { data } = await api.get<PestRadarPage>('/advisory/pest-radar', { params });
  return data;
}

// ---------- NPK calculator ----------

export interface NpkInput {
  n: number;
  p: number;
  k: number;
  crop: string;
  soilType: string;
}

export interface NpkResult {
  recommendations: string[];
  ureaKgPerAcre: number;
  dapKgPerAcre: number;
  mopKgPerAcre: number;
}

export async function npkRecommendation(input: NpkInput): Promise<NpkResult> {
  const { data } = await api.post<NpkResult>('/advisory/npk', input);
  return data;
}

// ---------- Disease scan (M9) ----------

export interface PestDisease {
  diseaseName: string;
  crop: string;
  pathogen: string;
  confidence: number;
  symptoms: string;
  chemicalTreatment: string;
  organicTreatment: string;
  dosage: string;
  estimatedCost: number;
}

/** Image gate result — the scan never diagnoses a non-leaf / blurry photo. */
export interface DiseaseGate {
  is_plant_leaf: boolean;
  quality_ok: boolean;
  passed: boolean;
}

export interface DiseaseScanResult {
  gate: DiseaseGate;
  /** Retake guidance (already localized per language) when the gate fails. */
  retake: { en: string; hi: string } | null;
  results: PestDisease[];
  /** True when the deterministic stub answered instead of a live model. */
  demo: boolean;
  scanId: string | null;
}

/**
 * Upload a leaf photo (multipart `image`). The backend validates type + size,
 * gates the image, stores the blob and runs the scan path. `Idempotency-Key` is
 * added by `client.ts` on every non-GET request.
 */
export async function diseaseScan(
  image: File | Blob,
  opts: { filename?: string; plotId?: string } = {}
): Promise<DiseaseScanResult> {
  const form = new FormData();
  form.append('image', image, opts.filename ?? 'scan.jpg');
  if (opts.plotId) form.append('plotId', opts.plotId);
  const { data } = await api.post<DiseaseScanResult>('/advisory/disease-scan', form);
  return data;
}

export interface DiseaseScanHistoryRow {
  scanId: string | null;
  plotId: string | null;
  photoUrl: string | null;
  diagnosis: PestDisease | null;
  confidence: number | null;
  createdAt: string | null;
}

export interface DiseaseScanHistory {
  data: DiseaseScanHistoryRow[];
  nextCursor: string | null;
}

export async function diseaseScanHistory(params: {
  plotId?: string;
  cursor?: string;
  limit?: number;
}): Promise<DiseaseScanHistory> {
  const { data } = await api.get<DiseaseScanHistory>('/advisory/disease-scans', { params });
  return data;
}

// ---------- Crop planner (M13, SGR) ----------

export interface CropPlanInput {
  soil: string;
  irrigation: string;
  plotSizeAcres: number;
  cropHistory: string[];
  district: string;
  season?: string;
  lang?: 'en' | 'hi';
}

export interface CropPlanOption {
  crop: string;
  rationale: string;
  /** Indicative revenue in integer paisa; 0 when no mandi data exists. */
  estimatedRevenuePaisa: number;
}

export interface CropPlanResult {
  options: CropPlanOption[];
  source: 'ai' | 'fallback';
  cached: boolean;
  decisionId: string | null;
  automationLevel: string;
}

/** Suggest 2-3 crops with rationale. Never creates anything (`suggest`). */
export async function cropPlan(input: CropPlanInput): Promise<CropPlanResult> {
  const { data } = await api.post<CropPlanResult>('/advisory/crop-plan', input);
  return data;
}

export interface CropPlanConfirmInput {
  crop: string;
  district: string;
  season?: string;
  plotId?: string;
  plannedDate?: string;
  rationale?: string;
}

export interface CropPlanConfirmResult {
  cropCycleId: string;
  created: boolean;
  taskIds: string[];
}

/** Explicit farmer confirm — creates the real crop_cycle + task schedule. */
export async function confirmCropPlan(
  input: CropPlanConfirmInput
): Promise<CropPlanConfirmResult> {
  const { data } = await api.post<CropPlanConfirmResult>('/advisory/crop-plan/confirm', input);
  return data;
}
