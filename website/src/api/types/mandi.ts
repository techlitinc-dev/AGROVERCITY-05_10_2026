export type TrendDir = 'up' | 'down' | 'flat';

export interface MandiPrice {
  id: string;
  mandiName: string;
  distanceKm: number;
  commodity: string;
  variety: string;
  minPrice: number;
  maxPrice: number;
  modalPrice: number;
  msp: number | null;
  trend: TrendDir;
  changePercent: number;
  arrivalsQuintals: number;
  updatedAt: string;
}

export interface VyapariRate {
  id: string;
  crop: string;
  rateDisplay: string;
  priceChange: number;
  changeDir: TrendDir;
  mandiName: string;
  vyapariCount: number;
  lastUpdated: string;
}

export interface MandiCompareRow {
  mandiName: string;
  modalPrice: number;
  transportCost: number;
  netProfit: number;
}

export interface MandiListEntry {
  id: string;
  name: string;
  district: string;
  state: string;
  lat: number;
  lng: number;
}

export interface MandiPricePoint {
  date: string;
  modalPrice: number;
  arrivalsQuintals: number;
}

export interface MandiPriceHistory {
  crop: string;
  mandi: string;
  points: MandiPricePoint[];
  msp: number | null;
  summary: { min: number; max: number; avg: number };
}
