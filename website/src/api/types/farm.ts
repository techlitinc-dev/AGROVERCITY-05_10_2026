export interface FarmPlot {
  id: string;
  farmerId: string;
  name: string;
  areaAcres: number;
  soilType: string;
  irrigationType: string;
  khasraNumber?: string;
  boundaryPoints: { lat: number; lng: number }[];
  isPrimary: boolean;
  currentCrop: string | null;
  createdAt: string;
}

export type CropCycleStage = 'sown' | 'germinated' | 'vegetative' | 'flowering' | 'harvested';
export type CropSeason = 'kharif' | 'rabi' | 'zaid';

export interface CropCycle {
  id: string;
  plotId: string;
  farmerId: string;
  crop: string;
  season: CropSeason;
  sowingDate: string;
  expectedHarvestDate: string;
  expectedYieldQuintals: number;
  actualYieldQuintals: number | null;
  stage: CropCycleStage;
  status: 'intent' | 'active' | 'closed';
  createdAt: string;
}
