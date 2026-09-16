export interface AdvisorySaturationBody {
  crop: string;
  district: string;
  lat: number;
  lng: number;
  radiusKm: number;
}

export interface AdvisorySaturation {
  sowingCount: number;
  radiusKm: number;
  expectedArrivalIncrease: number;
  riskLevel: 'green' | 'yellow' | 'red';
  predictedPrice: number;
  predictedDate: string;
  alternativeCrops: { crop: string; expectedPrice: number }[];
}

export interface PestDisease {
  id: string;
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

export interface PestAlert {
  disease: string;
  crop: string;
  distanceKm: number;
  riskLevel: 'low' | 'medium' | 'high';
  reportedAt: string;
}

export interface NpkBody {
  n: number;
  p: number;
  k: number;
  crop: string;
  soilType: string;
}

export interface NpkResult {
  recommendation: string;
  fertilizerPlan: { fertilizer: string; qtyKgPerAcre: number }[];
}

export interface SowingIntentBody {
  crop: string;
  intendedAreaAcres: number;
  sowingWindow: string;
  plotId?: string;
  shareForSaturation: boolean;
}

export interface SowingIntentRes {
  id: string;
  intent: boolean;
  crop: string;
  season: string;
  saturationPreview: {
    districtIntentAcres: number;
    vsLastYearPct: number;
    signal: 'high' | 'normal' | 'low';
  };
}
