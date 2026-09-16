export type ClaimStatus =
  | 'intimated'
  | 'surveyorAssigned'
  | 'fieldAssessed'
  | 'dbtApproved'
  | 'disbursed'
  | 'rejected';

export interface CropInsurancePolicy {
  id: string;
  policyNumber: string;
  schemeName: string;
  vernacularSchemeName: string;
  cropName: string;
  vernacularCropName: string;
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
  certificateUrl: string;
}

export interface CropPremiumRate {
  id: string;
  cropName: string;
  vernacularCropName: string;
  category: string;
  season: string;
  sumInsuredPerAcre: number;
  farmerSharePercent: number;
  totalActuarialRatePercent: number;
  cutoffDate: string;
}

export interface ClaimTimelineStep {
  status: ClaimStatus;
  at: string;
  note?: string;
}

export interface InsuranceClaimRecord {
  id: string;
  claimNumber: string;
  policyId: string;
  cropName: string;
  vernacularCropName: string;
  calamityType: string;
  dateOfDamage: string;
  estimatedLossPercent: number;
  requestedAmount: number;
  approvedAmount: number | null;
  status: ClaimStatus;
  statusText: string;
  surveyorName: string | null;
  surveyorPhone: string | null;
  surveyorVisitDate: string | null;
  gpsCoordinates: string;
  village: string;
  damagePhotos: string[];
  submittedAt: string;
  dbtTransactionId: string | null;
  bankAccountLast4: string | null;
  timeline: ClaimTimelineStep[];
  appealOf?: string | null;
  round?: number;
}

export interface ClaimIntimationBody {
  policyId: string;
  cropName: string;
  calamityType: string;
  dateOfDamage: string;
  cropStage: string;
  estimatedLossPercent: number;
  gpsCoordinates: string;
  village: string;
}

export interface ClaimAppealBody {
  appealNote: string;
  damagePhotos: string[];
}

export interface ClaimAppealRes {
  id: string;
  appealOf: string;
  status: ClaimStatus;
  round: number;
  submittedAt: string;
}
