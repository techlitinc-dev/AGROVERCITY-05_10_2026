import { api } from './client';
import type { Paged } from './trade';

/**
 * Insurance ("ClaimsDesk") API wrappers — verified against
 * backend/app/routers/insurance.py + insurance_claims.py (prefix `/insurance`).
 *
 * Claim stages: intimated → surveyorAssigned → fieldAssessed → dbtApproved →
 * disbursed (side states: rejected, appeal re-entry). Money is handled in
 * integer paisa at the UI boundary; the backend rate/policy fields are ₹.
 */

export type ClaimStatus =
  | 'intimated'
  | 'surveyorAssigned'
  | 'fieldAssessed'
  | 'dbtApproved'
  | 'disbursed'
  | 'rejected';

export const CLAIM_STAGES: ClaimStatus[] = [
  'intimated',
  'surveyorAssigned',
  'fieldAssessed',
  'dbtApproved',
  'disbursed',
];

export interface ClaimTimelineEntry {
  status: string;
  at: string;
  note: string;
}

/** WS-07 M15 — localised retake guidance (en + hi strings from the backend). */
export interface ClaimTriageGuidance {
  en: string;
  hi: string;
}

/**
 * WS-07 M15 — claim triage annotation. Arrives on the intimation response
 * (instant photo-quality/completeness feedback) and on the provider console
 * (reasons + suggested surveyor + fraud flag). Absent = screens unchanged.
 */
export interface ClaimTriage {
  photoQuality: 'ok' | 'poor';
  completeness: number;
  retakeGuidance: ClaimTriageGuidance;
  fraudSignal?: number;
  triageReasons?: string[];
  suggestedSurveyor?: string | null;
  confidence?: number;
  decisionId?: string;
}

export interface InsuranceClaim {
  id: string;
  claimNumber: string;
  policyId: string;
  cropName: string;
  calamityType: string;
  dateOfDamage: string;
  cropStage: string;
  estimatedLossPercent: number;
  requestedAmount: number;
  approvedAmount?: number | null;
  status: ClaimStatus;
  statusText: string;
  surveyorName?: string | null;
  surveyorPhone?: string | null;
  surveyorVisitDate?: string | null;
  gpsCoordinates: string;
  village: string;
  damagePhotos: string[];
  submittedAt: string;
  dbtTransactionId?: string | null;
  bankAccountLast4?: string | null;
  appealCount: number;
  rejectionReason?: string | null;
  timeline: ClaimTimelineEntry[];
  // Provider-console extras (present on the provider read surfaces).
  userId?: string | null;
  farmerName?: string | null;
  farmerPhone?: string | null;
  farmerDistrict?: string | null;
  farmerState?: string | null;
  cropStageVerified?: string | null;
  assessedLossPercent?: number | null;
  photoGuidelines?: string[];
  /** WS-07 M15 — instant triage annotation; absent = screens unchanged. */
  triage?: ClaimTriage | null;
  fraudFlag?: boolean | null;
}

export interface CropInsurancePolicy {
  id: string;
  policyNumber: string;
  schemeName: string;
  cropName: string;
  season: string;
  year: number;
  landAreaAcres: number;
  sumInsured: number;
  farmerPremium: number;
  govtSubsidy: number;
  status: string;
  insuranceCompany: string;
  coverageStartDate: string;
  coverageEndDate: string;
  bankName: string;
  kccAccountNo: string;
  certificateUrl?: string | null;
  userId?: string | null;
  farmerName?: string | null;
  farmerPhone?: string | null;
  village?: string | null;
  district?: string | null;
  state?: string | null;
  category?: string | null;
  khasraNumber?: string | null;
  sowingDate?: string | null;
  riskScore?: number | null;
  riskCategory?: string | null;
  appliedAt?: string | null;
  reviewedAt?: string | null;
  reviewedBy?: string | null;
  rejectionReason?: string | null;
  underwriterNotes?: string | null;
}

export interface CropPremiumRate {
  id: string;
  cropName: string;
  category: string;
  season: string;
  sumInsuredPerAcre: number;
  farmerSharePercent: number;
  totalActuarialRatePercent: number;
  cutoffDate: string;
}

export interface InsuranceScheme {
  id: string;
  code: string;
  titleEn: string;
  titleHi: string;
  descriptionEn: string;
  descriptionHi: string;
  category: string;
  premiumShareRules: string;
  applicableCrops: string[];
  cutoffNotice: string;
  claimWindowHours: number;
}

export interface InsuranceProviderStats {
  totalPolicies: number;
  pendingPolicies: number;
  activePolicies: number;
  rejectedPolicies: number;
  totalSumInsured: number;
  totalFarmerPremium: number;
  totalGovtSubsidy: number;
  totalClaims: number;
  pendingClaims: number;
  approvedClaims: number;
  disbursedClaims: number;
  totalClaimRequested: number;
  totalClaimApproved: number;
  totalClaimDisbursed: number;
  lossRatioPercent: number;
  avgCycleTimeHours: number;
  byPolicyStatus: Record<string, number>;
  byClaimStatus: Record<string, number>;
  byCrop: Record<string, number>;
  byCalamity: Record<string, number>;
}

export interface Surveyor {
  id: string;
  name: string;
  phone: string;
  districts: string[];
  providerId?: string;
}

export interface PolicyReviewBody {
  action: 'approve' | 'reject';
  rejectionReason?: string;
  underwriterNotes?: string;
  insuranceCompany?: string;
}

export interface ScheduleSurveyBody {
  surveyorName: string;
  surveyorPhone: string;
  surveyorVisitDate: string;
  notes?: string;
}

export interface SurveyReportBody {
  assessedLossPercent: number;
  cropStageVerified?: string;
  surveyorNotes?: string;
}

export interface ClaimReviewBody {
  action: 'approve' | 'reject';
  approvedAmount?: number;
  rejectionReason?: string;
  notes?: string;
}

export interface ClaimDisburseBody {
  dbtTransactionId?: string;
  amount?: number;
  notes?: string;
}

export interface RateBody {
  cropName: string;
  category: string;
  season: 'Kharif' | 'Rabi' | 'Annual';
  sumInsuredPerAcre: number;
  farmerSharePercent: number;
  totalActuarialRatePercent: number;
  cutoffDate: string;
}

export interface FileClaimInput {
  policyId: string;
  cropName: string;
  calamityType: string;
  dateOfDamage: string;
  cropStage: string;
  estimatedLossPercent: number;
  gpsCoordinates: string;
  village: string;
  photos: File[];
}

export interface AppealBody {
  reason: string;
  photos?: string[];
}

// ---- Money helpers (integer paisa at the UI boundary) ----

/** Rupees (float, backend format) → integer paisa. */
export const rupeesToPaisa = (rupees: number): number => Math.round(rupees * 100);

/** Integer paisa → rupees (float) — only when calling the ₹-based rate API. */
export const paisaToRupees = (paisa: number): number => paisa / 100;

/** Integer paisa → ₹ display string. */
export function fmtPaisa(paisa: number): string {
  return `₹${(paisa / 100).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

/** Rupees amount (as stored by the insurance backend) → ₹ display string. */
export function fmtRupees(amount: number): string {
  return `₹${amount.toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

// ---- Provider: policies ----

export async function getProviderPolicies(
  params: { status?: string; crop?: string; category?: string; q?: string; page?: number; pageSize?: number } = {}
): Promise<Paged<CropInsurancePolicy>> {
  const { data } = await api.get<Paged<CropInsurancePolicy>>('/insurance/provider/policies', { params });
  return data;
}

export async function getProviderPolicy(policyId: string): Promise<CropInsurancePolicy> {
  const { data } = await api.get<CropInsurancePolicy>(`/insurance/provider/policies/${policyId}`);
  return data;
}

export async function reviewPolicy(policyId: string, body: PolicyReviewBody): Promise<CropInsurancePolicy> {
  const { data } = await api.post<CropInsurancePolicy>(`/insurance/provider/policies/${policyId}/review`, body);
  return data;
}

// ---- Provider: claims ----

export async function getProviderClaims(
  params: { status?: string; calamityType?: string; q?: string; page?: number; pageSize?: number } = {}
): Promise<Paged<InsuranceClaim>> {
  const { data } = await api.get<Paged<InsuranceClaim>>('/insurance/provider/claims', { params });
  return data;
}

export async function getProviderClaim(claimId: string): Promise<InsuranceClaim> {
  const { data } = await api.get<InsuranceClaim>(`/insurance/provider/claims/${claimId}`);
  return data;
}

export async function scheduleSurvey(claimId: string, body: ScheduleSurveyBody): Promise<InsuranceClaim> {
  const { data } = await api.post<InsuranceClaim>(`/insurance/provider/claims/${claimId}/schedule_survey`, body);
  return data;
}

export async function submitSurveyReport(claimId: string, body: SurveyReportBody): Promise<InsuranceClaim> {
  const { data } = await api.post<InsuranceClaim>(`/insurance/provider/claims/${claimId}/survey_report`, body);
  return data;
}

export async function reviewClaim(claimId: string, body: ClaimReviewBody): Promise<InsuranceClaim> {
  const { data } = await api.post<InsuranceClaim>(`/insurance/provider/claims/${claimId}/review`, body);
  return data;
}

export async function disburseClaim(claimId: string, body: ClaimDisburseBody): Promise<InsuranceClaim> {
  const { data } = await api.post<InsuranceClaim>(`/insurance/provider/claims/${claimId}/disburse`, body);
  return data;
}

export async function getProviderStats(): Promise<InsuranceProviderStats> {
  const { data } = await api.get<InsuranceProviderStats>('/insurance/provider/stats');
  return data;
}

// ---- Provider: surveyor roster + rates ----

export async function listSurveyors(): Promise<Surveyor[]> {
  const { data } = await api.get<{ data: Surveyor[]; total: number }>('/insurance/provider/surveyors');
  return data.data;
}

export async function addSurveyor(body: { name: string; phone: string; districts: string[] }): Promise<Surveyor> {
  const { data } = await api.post<Surveyor>('/insurance/provider/surveyors', body);
  return data;
}

export async function removeSurveyor(surveyorId: string): Promise<void> {
  await api.delete(`/insurance/provider/surveyors/${surveyorId}`);
}

export async function updateRates(body: RateBody): Promise<CropPremiumRate> {
  const { data } = await api.post<CropPremiumRate>('/insurance/provider/rates', body);
  return data;
}

export async function getRates(params: { season?: string; crop?: string } = {}): Promise<CropPremiumRate[]> {
  const { data } = await api.get<Paged<CropPremiumRate>>('/insurance/rates', { params });
  return data.data;
}

// ---- Farmer ----

export async function fileClaim(input: FileClaimInput): Promise<InsuranceClaim> {
  const form = new FormData();
  form.append('policyId', input.policyId);
  form.append('cropName', input.cropName);
  form.append('calamityType', input.calamityType);
  form.append('dateOfDamage', input.dateOfDamage);
  form.append('cropStage', input.cropStage);
  form.append('estimatedLossPercent', String(input.estimatedLossPercent));
  form.append('gpsCoordinates', input.gpsCoordinates);
  form.append('village', input.village);
  for (const photo of input.photos) form.append('damagePhotos', photo);
  const { data } = await api.post<InsuranceClaim>('/insurance/claims', form);
  return data;
}

export async function getMyClaims(): Promise<Paged<InsuranceClaim>> {
  const { data } = await api.get<Paged<InsuranceClaim>>('/insurance/claims');
  return data;
}

export async function getMyClaim(claimId: string): Promise<InsuranceClaim> {
  const { data } = await api.get<InsuranceClaim>(`/insurance/claims/${claimId}`);
  return data;
}

export async function appealClaim(claimId: string, body: AppealBody): Promise<InsuranceClaim> {
  const { data } = await api.post<InsuranceClaim>(`/insurance/claims/${claimId}/appeal`, body);
  return data;
}

export async function getMyPolicies(): Promise<CropInsurancePolicy[]> {
  const { data } = await api.get<Paged<CropInsurancePolicy>>('/insurance/policies');
  return data.data;
}

export async function getSchemes(): Promise<InsuranceScheme[]> {
  const { data } = await api.get<{ data: InsuranceScheme[]; total: number }>('/insurance/schemes');
  return data.data;
}
