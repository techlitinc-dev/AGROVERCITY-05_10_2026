import { api } from './client';

export interface CustomerDemand {
  id: string;
  customerId: string;
  customerName: string;
  crop: string;
  variety: string;
  grade: string;
  quantityQuintals: number;
  targetMinPrice: number;
  targetMaxPrice: number;
  recurringFrequency: string;
  deliveryWindow: string;
  district: string;
  notes?: string;
  status: 'open' | 'fulfilled' | 'closed';
  bidsCount: number;
  createdAt: string;
}

export interface CustomerQuote {
  id: string;
  customerId: string;
  customerName: string;
  demandId?: string;
  lotId?: string;
  farmerId: string;
  farmerName: string;
  crop: string;
  offeredPricePerQuintal: number;
  quantityQuintals: number;
  totalValueRupees: number;
  deliveryMode: string;
  notes?: string;
  negotiationRound: number;
  counterReason?: string;
  status: 'pending' | 'countered' | 'accepted' | 'rejected';
  createdAt: string;
}

export interface CustomerOrder {
  id: string;
  customerId: string;
  farmerId: string;
  farmerName: string;
  crop: string;
  grade: string;
  quantityQuintals: number;
  pricePerQuintal: number;
  totalAmountRupees: number;
  escrowStatus: 'funded' | 'released' | 'partial_released' | 'frozen';
  status: 'confirmed' | 'in_fulfillment' | 'dispatched' | 'delivered' | 'settled' | 'disputed';
  deliveryMode: string;
  pickupSlot: string;
  qrCodeHash: string;
  qrVerifiedAt?: string;
  custodyTransferred?: boolean;
  inspection?: {
    quantityReceivedQuintals: number;
    gradeMatch: boolean;
    damagePercent: number;
    action: string;
    adjustedAmountRupees: number;
    inspectedAt: string;
    inspectedBy: string;
    notes?: string;
  };
  createdAt: string;
}

export interface CustomerAnalytics {
  totalSpendRupees: number;
  totalTonnageMT: number;
  totalVolumeQuintals: number;
  activeOrdersCount: number;
  standingDemandsCount: number;
  openQuotesCount: number;
  mandiSavingsPercent: number;
  fulfillmentSlaPercent: number;
  categorySpend: Array<{ category: string; amount: number }>;
  monthlySpendTrend: Array<{ month: string; spend: number; tonnage: number }>;
}

export interface CommodityAdvice {
  crop: string;
  currentMandiPrice: number;
  projectedNextMonth: number;
  priceTrend: string;
  recommendation: string;
  peakHarvestMonth: string;
}

export interface FavoriteSupplier {
  id: string;
  farmerId: string;
  farmerName: string;
  primaryCrops: string[];
  location: string;
  rating: number;
  totalOrders: number;
  trustBadge: string;
}

export async function fetchCustomerAnalytics(): Promise<CustomerAnalytics> {
  const res = await api.get<CustomerAnalytics>('/customer/analytics');
  return res.data;
}

export async function fetchCustomerDemands(): Promise<CustomerDemand[]> {
  const res = await api.get<{ data: CustomerDemand[] }>('/customer/demands');
  return res.data.data;
}

export async function createCustomerDemand(data: {
  crop: string;
  variety?: string;
  grade?: string;
  quantityQuintals: number;
  targetMinPrice: number;
  targetMaxPrice: number;
  recurringFrequency?: string;
  deliveryWindow?: string;
  district?: string;
  notes?: string;
}): Promise<CustomerDemand> {
  const res = await api.post<CustomerDemand>('/customer/demands', data);
  return res.data;
}

export async function deleteCustomerDemand(demandId: string): Promise<void> {
  await api.delete(`/customer/demands/${demandId}`);
}

export async function fetchCustomerQuotes(): Promise<CustomerQuote[]> {
  const res = await api.get<{ data: CustomerQuote[] }>('/customer/quotes');
  return res.data.data;
}

export async function submitBindingQuote(data: {
  crop: string;
  offeredPricePerQuintal: number;
  quantityQuintals: number;
  demandId?: string;
  lotId?: string;
  farmerId?: string;
  farmerName?: string;
  deliveryMode?: string;
  notes?: string;
}): Promise<CustomerQuote> {
  const res = await api.post<CustomerQuote>('/customer/quotes', data);
  return res.data;
}

export async function counterCustomerQuote(quoteId: string, data: { counterPricePerQuintal: number; reason?: string }): Promise<CustomerQuote> {
  const res = await api.post<CustomerQuote>(`/customer/quotes/${quoteId}/counter`, data);
  return res.data;
}

export async function fetchCustomerOrders(): Promise<CustomerOrder[]> {
  const res = await api.get<{ data: CustomerOrder[] }>('/customer/orders');
  return res.data.data;
}

export async function recordDeliveryInspection(
  orderId: string,
  data: {
    quantityReceivedQuintals: number;
    gradeMatch: boolean;
    damagePercent: number;
    action: 'accept' | 'partial_accept' | 'reject';
    notes?: string;
  }
): Promise<CustomerOrder> {
  const res = await api.post<CustomerOrder>(`/customer/orders/${orderId}/inspection`, data);
  return res.data;
}

export async function verifyQrHandover(orderId: string): Promise<{ success: boolean; status: string }> {
  const res = await api.post<{ success: boolean; status: string }>(`/customer/orders/${orderId}/qr-handover`);
  return res.data;
}

export async function fetchProcurementPlanner(): Promise<{ recommendedCommodities: CommodityAdvice[] }> {
  const res = await api.get<{ recommendedCommodities: CommodityAdvice[] }>('/customer/planner');
  return res.data;
}

export async function fetchFavoriteSuppliers(): Promise<FavoriteSupplier[]> {
  const res = await api.get<{ data: FavoriteSupplier[] }>('/customer/suppliers/favorites');
  return res.data.data;
}

export async function addFavoriteSupplier(data: {
  farmerId: string;
  farmerName: string;
  primaryCrops?: string[];
  location?: string;
}): Promise<FavoriteSupplier> {
  const res = await api.post<FavoriteSupplier>('/customer/suppliers/favorites', data);
  return res.data;
}
