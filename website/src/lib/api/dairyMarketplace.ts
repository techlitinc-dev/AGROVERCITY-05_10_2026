import { api } from './client';

export interface DairyDemand {
  id: string;
  managerId: string;
  managerName: string;
  milkType: string;
  minFatPercent: number;
  minSnfPercent: number;
  dailyQuantityLiters: number;
  targetRatePerLiter: number;
  recurringFrequency: string;
  procurementZone: string;
  notes?: string;
  status: 'active' | 'paused' | 'fulfilled';
  activeBids: number;
  createdAt: string;
}

export interface DairyBid {
  id: string;
  managerId: string;
  rfqId?: string;
  farmerId: string;
  farmerName: string;
  cattleCount?: number;
  milkType: string;
  dailyLiters: number;
  offeredRatePerLiter: number;
  transportIncluded: boolean;
  pickupSlot: string;
  negotiationRound: number;
  terms?: string;
  status: 'pending' | 'countered' | 'accepted' | 'rejected';
  createdAt: string;
}

export interface RouteStop {
  farmerId: string;
  farmerName: string;
  locationPin: string;
  expectedLiters: number;
  pickupWindow: string;
  sequence: number;
}

export interface ProcurementRoute {
  id: string;
  managerId: string;
  routeName: string;
  assignedAgentName: string;
  scheduledDate: string;
  stops: RouteStop[];
  totalEstimatedLiters: number;
  status: 'planned' | 'dispatched' | 'completed';
  createdAt: string;
}

export interface CollectionCheck {
  id: string;
  managerId: string;
  farmerId: string;
  farmerName: string;
  milkType: string;
  quantityLiters: number;
  fatPercent: number;
  snfPercent: number;
  ratePerLiter: number;
  totalAmountRupees: number;
  qualityStatus: 'accepted' | 'regraded' | 'rejected';
  evidencePhotoUrl?: string;
  farmerOtpVerified: boolean;
  notes?: string;
  collectedAt: string;
}

export interface DairyRateChart {
  id: string;
  baseCowRate: number;
  baseBuffaloRate: number;
  cowBaseFat: number;
  cowBaseSnf: number;
  buffaloBaseFat: number;
  buffaloBaseSnf: number;
  fatStepRupees: number;
  snfStepRupees: number;
  mandiBenchmarkRates: Array<{ region: string; cowRate: number; buffaloRate: number }>;
  seasonalAlert: string;
}

export interface MilkSlip {
  slipId: string;
  collectionId: string;
  farmerName: string;
  milkType: string;
  quantityLiters: number;
  fatPercent: number;
  snfPercent: number;
  ratePerLiter: number;
  totalAmountRupees: number;
  collectedAt: string;
  payoutStatus: string;
}

export interface DairyManagerAnalytics {
  todayCollectionLiters: number;
  todaySpendRupees: number;
  averageFatPercent: number;
  averageSnfPercent: number;
  activeFarmerSuppliers: number;
  activeRoutesCount: number;
  routeEfficiencyPercent: number;
  qualityDisputeRatePercent: number;
  sevenDayTrend: Array<{ day: string; liters: number; avgFat: number; spend: number }>;
}

export async function fetchDairyAnalytics(): Promise<DairyManagerAnalytics> {
  const res = await api.get<DairyManagerAnalytics>('/dairy-manager/analytics');
  return res.data;
}

export async function fetchDairyDemands(): Promise<DairyDemand[]> {
  const res = await api.get<{ data: DairyDemand[] }>('/dairy-manager/demands');
  return res.data.data;
}

export async function createDairyDemand(data: {
  milkType: string;
  minFatPercent: number;
  minSnfPercent: number;
  dailyQuantityLiters: number;
  targetRatePerLiter: number;
  recurringFrequency?: string;
  procurementZone?: string;
  notes?: string;
}): Promise<DairyDemand> {
  const res = await api.post<DairyDemand>('/dairy-manager/demands', data);
  return res.data;
}

export async function fetchDairyBids(): Promise<DairyBid[]> {
  const res = await api.get<{ data: DairyBid[] }>('/dairy-manager/bids');
  return res.data.data;
}

export async function submitDairyBid(data: {
  rfqId?: string;
  farmerId: string;
  farmerName: string;
  milkType: string;
  offeredRatePerLiter: number;
  dailyLiters: number;
  transportIncluded?: boolean;
  pickupSlot?: string;
  notes?: string;
}): Promise<DairyBid> {
  const res = await api.post<DairyBid>('/dairy-manager/bids', data);
  return res.data;
}

export async function counterDairyBid(bidId: string, data: { counterRatePerLiter: number; terms?: string }): Promise<DairyBid> {
  const res = await api.post<DairyBid>(`/dairy-manager/bids/${bidId}/counter`, data);
  return res.data;
}

export async function fetchProcurementRoutes(): Promise<ProcurementRoute[]> {
  const res = await api.get<{ data: ProcurementRoute[] }>('/dairy-manager/routes');
  return res.data.data;
}

export async function createProcurementRoute(data: {
  routeName: string;
  assignedAgentName: string;
  scheduledDate: string;
  stops: RouteStop[];
}): Promise<ProcurementRoute> {
  const res = await api.post<ProcurementRoute>('/dairy-manager/routes', data);
  return res.data;
}

export async function fetchCollectionChecks(): Promise<CollectionCheck[]> {
  const res = await api.get<{ data: CollectionCheck[] }>('/dairy-manager/collection-check');
  return res.data.data;
}

export async function recordCollectionCheck(data: {
  farmerId: string;
  farmerName: string;
  milkType: string;
  quantityLiters: number;
  fatPercent: number;
  snfPercent: number;
  ratePerLiter: number;
  qualityStatus?: 'accepted' | 'regraded' | 'rejected';
  evidencePhotoUrl?: string;
  farmerOtpVerified?: boolean;
  notes?: string;
}): Promise<CollectionCheck> {
  const res = await api.post<CollectionCheck>('/dairy-manager/collection-check', data);
  return res.data;
}

export async function fetchRateChart(): Promise<DairyRateChart> {
  const res = await api.get<DairyRateChart>('/dairy-manager/rate-chart');
  return res.data;
}

export async function updateRateChart(data: {
  baseCowRate: number;
  baseBuffaloRate: number;
  fatStepRupees: number;
  snfStepRupees: number;
}): Promise<DairyRateChart> {
  const res = await api.put<DairyRateChart>('/dairy-manager/rate-chart', data);
  return res.data;
}

export async function fetchMilkSlips(): Promise<MilkSlip[]> {
  const res = await api.get<{ data: MilkSlip[] }>('/dairy-manager/milk-slips');
  return res.data.data;
}
