import { api } from './client';
import type { Lot } from './trade';

/**
 * Buyer discovery — feed, saved farmers, analytics, buyer profile.
 * Verified against backend/app/routers/direct_buyer.py (role: directBuyer|seller).
 */

export interface BuyerProfileStats {
  totalPurchases?: number;
  totalSpend?: number;
  completedPurchases?: number;
  activeDemands?: number;
  [key: string]: unknown;
}

export interface BuyerProfile {
  roleProfile?: Record<string, unknown>;
  stats?: BuyerProfileStats;
  [key: string]: unknown;
}

export interface BuyerAnalytics {
  totalSpend: number;
  totalVolume: number;
  activeDemands: number;
  openOffers: number;
  purchasesByStatus: Record<string, number>;
  monthlyProcurement: Array<{ month: string; spend: number; volume: number }>;
  cropBreakdown: Array<{ crop: string; spend: number; volume: number; avgPrice: number }>;
  topSuppliers: Array<{ farmerId: string; farmerName: string; spend: number; purchases: number }>;
  avgPriceVsMandi: Array<{
    crop: string;
    avgPurchasePrice: number;
    mandiModalPrice: number | null;
  }>;
  qcRejectionRate: number;
  completionRate: number;
  pendingBalance: number;
}

export interface SavedFarmer {
  farmerId: string;
  farmerName: string;
  village: string;
  district: string;
  rating: number | null;
}

export async function buyerProfile(): Promise<BuyerProfile> {
  const { data } = await api.get<BuyerProfile>('/direct-buyer/profile');
  return data;
}

export async function buyerAnalytics(): Promise<BuyerAnalytics> {
  const { data } = await api.get<BuyerAnalytics>('/direct-buyer/analytics');
  return data;
}

export async function buyerFeed(limit = 20): Promise<{ data: Lot[]; total: number }> {
  const { data } = await api.get<{ data: Lot[]; total: number }>('/direct-buyer/feed', {
    params: { limit },
  });
  return data;
}

export async function listSavedFarmers(): Promise<{ data: SavedFarmer[]; total: number }> {
  const { data } = await api.get<{ data: SavedFarmer[]; total: number }>(
    '/direct-buyer/saved-farmers'
  );
  return data;
}

export async function saveFarmer(farmerId: string): Promise<unknown> {
  const { data } = await api.post('/direct-buyer/saved-farmers', { farmerId });
  return data;
}

export async function unsaveFarmer(farmerId: string): Promise<void> {
  await api.delete(`/direct-buyer/saved-farmers/${farmerId}`);
}
