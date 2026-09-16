export interface CarbonPotential {
  annualIncomePotential: number;
  co2eTonnes: number;
  practices: string[];
}

export interface ResilientVariety {
  id: string;
  crop: string;
  varietyName: string;
  trait: string;
  source: string;
}

export interface ColdStorage {
  id: string;
  name: string;
  distanceKm: number;
  tempRange: string;
  availableMT: number;
  ratePerQuintalMonth: number;
}

export interface GradeResult {
  grade: string;
  uniformityPercent: number;
  shelfLifeDays: number;
  recommendedPrice: number;
}

export type ColdStorageBookingStatus = 'requested' | 'confirmed' | 'active' | 'completed' | 'cancelled';

export interface ColdStorageBooking {
  id: string;
  warehouseId: string;
  crop: string;
  quantityQuintals: number;
  durationWeeks: number;
  startDate: string;
  ratePerQuintalPerWeek: number;
  totalAmount: number;
  status: ColdStorageBookingStatus;
}
