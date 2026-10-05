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

/**
 * Fair-price band (C5) computed from settled trades for the crop + district over
 * the last 90 days. `sampleSize: 0` means there is no history — the backend
 * reports null band bounds rather than inventing numbers.
 */
export interface FairPriceBand {
  crop: string;
  district: string;
  minUnitPaisa: number | null;
  maxUnitPaisa: number | null;
  sampleSize: number;
}

export type QuoteStatus =
  | 'pending'
  | 'countered'
  | 'accepted'
  | 'rejected'
  | 'quote_pending'
  | 'expired';

export interface CustomerQuote {
  id: string;
  customerId: string;
  customerName: string;
  demandId?: string | null;
  lotId?: string | null;
  farmerId: string;
  farmerName: string;
  crop: string;
  /** District the band is computed against (demand district, else buyer's). */
  district?: string;
  offeredPricePerQuintal: number;
  quantityQuintals: number;
  totalValueRupees: number;
  orderValuePaisa?: number;
  deliveryMode: string;
  notes?: string;
  /** Legacy round counter kept for older docs (1-based). */
  negotiationRound: number;
  /** Capped at 3 counter rounds (E8). */
  counterRounds?: number;
  expiresAt?: string;
  priceLockUntil?: string;
  fairPriceBand?: FairPriceBand;
  counterReason?: string;
  status: QuoteStatus;
  createdAt: string;
}

export type EscrowStatus =
  | 'unfunded'
  | 'funded'
  | 'partial_released'
  | 'released'
  | 'frozen'
  | 'refunded';

export type LogisticsMode = 'farmer_delivery' | 'customer_pickup' | 'platform_transport';

export interface OrderStatusEntry {
  status: string;
  at: string;
}

export interface DeliveryInspection {
  damagePct: number;
  gradeMatch: boolean;
  photoUrls: string[];
  notes?: string;
  inspectionOutcome: 'normal' | 'pro_rata' | 'dispute';
  deductionPaisa: number;
  inspectedAt: string;
  inspectedBy: string;
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
  /** Integer paisa — the authoritative money field for WS-03 guardrails. */
  orderValuePaisa?: number;
  escrowStatus: EscrowStatus;
  status:
    | 'confirmed'
    | 'deposit_pending'
    | 'in_fulfillment'
    | 'dispatched'
    | 'delivered'
    | 'settled'
    | 'disputed'
    | 'cancelled';
  deliveryMode?: string;
  pickupSlot?: string;
  qrCodeHash?: string;
  qrVerifiedAt?: string;
  custodyTransferred?: boolean;
  /** Multi-farmer cart split (C6): one parent, one child per farmer. */
  isParent?: boolean;
  parentOrderId?: string | null;
  logisticsMode?: LogisticsMode;
  statusTimeline?: OrderStatusEntry[];
  /** Quote/manifest linkage — global rule 2 (farmerId on every line). */
  lotId?: string | null;
  quoteId?: string | null;
  subscriptionId?: string | null;
  depositPaisa?: number;
  deductionPaisa?: number;
  inspectionOutcome?: 'normal' | 'pro_rata' | 'dispute';
  farmerCompensationPaisa?: number;
  customerCreditPaisa?: number;
  surgeSurchargeDisclosed?: boolean;
  deliveredAt?: string;
  inspection?: DeliveryInspection | null;
  createdAt: string;
}

/** Produce-near-me lot (S3) — every item carries its `farmerId` (rule 2). */
export interface NearMeLot {
  lotId: string;
  farmerId: string;
  farmerName: string;
  crop: string;
  grade: string;
  qtyAvailable: number;
  pricePaisa: number;
  distanceKm: number;
  harvestDate: string;
  freshnessDays: number | null;
  farmerRating: number | null;
}

export interface StorefrontLot {
  lotId: string;
  farmerId: string;
  crop: string;
  grade: string;
  qtyAvailable: number;
  pricePaisa: number;
  harvestDate: string;
  freshnessDays: number | null;
}

export interface FarmerStorefront {
  farmerId: string;
  farmerName: string;
  farmerRating: number | null;
  credentials: Array<{ type: string; verifiedAt?: string | null }>;
  lots: StorefrontLot[];
}

export type NearbySort = 'price' | 'distance' | 'grade' | 'rating' | 'freshness';

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

/** C2 standing demand / subscription frequency. */
export type SubscriptionFrequency = 'daily' | 'weekly' | 'seasonal';

export interface CustomerSubscription {
  id: string;
  customerId: string;
  farmerIds: string[];
  crop: string;
  grade: string;
  qtyKg: number;
  targetPriceBandPaisa: { min: number; max: number };
  deliveryWindow: string;
  frequency: SubscriptionFrequency;
  nextRunAt: string;
  status: 'active' | 'cancelled';
  createdAt: string;
}

/** C9 Business-tier consolidated invoice (one doc per buyer period). */
export interface ConsolidatedInvoice {
  id: string;
  customerId: string;
  period: string;
  lineItemCount: number;
  totalPaisa: number;
  gstPaisa: number;
  createdAt: string;
}

export interface CartLine {
  farmerId: string;
  lotId: string;
  qty: number;
  logisticsMode: LogisticsMode;
}

export interface CartCheckoutResult {
  parentOrderId: string;
  orders: CustomerOrder[];
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

export async function counterCustomerQuote(
  quoteId: string,
  data: { counterPricePerQuintal: number; reason?: string }
): Promise<CustomerQuote> {
  const res = await api.post<CustomerQuote>(`/customer/quotes/${quoteId}/counter`, data);
  return res.data;
}

/**
 * Accept a binding quote (task 3.14). High-value quotes return an order whose
 * `escrowStatus` is the funded state and carry `depositPaisa`; a replay with the
 * same Idempotency-Key returns the original order instead of a duplicate.
 */
export async function acceptCustomerQuote(
  quoteId: string,
  data?: { logisticsMode?: LogisticsMode }
): Promise<CustomerOrder> {
  const res = await api.post<CustomerOrder>(`/customer/quotes/${quoteId}/accept`, data ?? {});
  return res.data;
}

export async function fetchCustomerOrders(): Promise<CustomerOrder[]> {
  const res = await api.get<{ data: CustomerOrder[] }>('/customer/orders');
  return res.data.data;
}

/**
 * Delivery inspection (E5 damage matrix / E7 72h window). The backend returns
 * 422 INSPECTION_WINDOW_EXPIRED once the window closed.
 */
export async function recordDeliveryInspection(
  orderId: string,
  data: {
    damagePct: number;
    gradeMatch: boolean;
    photoUrls: string[];
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

/** E1/E2 cancellation — the backend picks the penalty rule from the caller's role. */
export async function cancelCustomerOrder(orderId: string): Promise<CustomerOrder> {
  const res = await api.post<CustomerOrder>(`/customer/orders/${orderId}/cancel`, {});
  return res.data;
}

/** E3 farmer no-show — auto-cancel + strike + 10% fee credited to the buyer. */
export async function reportFarmerNoShow(orderId: string): Promise<CustomerOrder> {
  const res = await api.post<CustomerOrder>(`/customer/orders/${orderId}/no-show`, {});
  return res.data;
}

/** C6 multi-farmer cart → one parent order + one child order per farmer. */
export async function checkoutCart(lines: CartLine[]): Promise<CartCheckoutResult> {
  const res = await api.post<CartCheckoutResult>('/customer/cart/checkout', { lines });
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

/** Produce near me (S3): rank by price | distance | grade | rating | freshness. */
export async function browseNearMe(params: {
  lat: number;
  lng: number;
  crop?: string;
  sort?: NearbySort;
  radiusKm?: number;
  page?: number;
  pageSize?: number;
}): Promise<{ data: NearMeLot[]; total: number; page: number; pageSize: number }> {
  const res = await api.get<{ data: NearMeLot[]; total: number; page: number; pageSize: number }>(
    '/customer/browse/near-me',
    { params }
  );
  return res.data;
}

/** Farmer storefront: every available lot from one farmerId + rating + credentials. */
export async function getStorefront(farmerId: string): Promise<FarmerStorefront> {
  const res = await api.get<FarmerStorefront>(`/customer/storefronts/${farmerId}`);
  return res.data;
}

export async function getSubscriptions(): Promise<CustomerSubscription[]> {
  const res = await api.get<{ data: CustomerSubscription[] }>('/customer/subscriptions');
  return res.data.data;
}

export async function createSubscription(data: {
  farmerIds: string[];
  crop: string;
  grade: string;
  qtyKg: number;
  targetPriceBandPaisa: { min: number; max: number };
  deliveryWindow: string;
  frequency: SubscriptionFrequency;
}): Promise<CustomerSubscription> {
  const res = await api.post<CustomerSubscription>('/customer/subscriptions', data);
  return res.data;
}

export async function deleteSubscription(subscriptionId: string): Promise<CustomerSubscription> {
  const res = await api.delete<CustomerSubscription>(`/customer/subscriptions/${subscriptionId}`);
  return res.data;
}

/** C9 Business tier: one consolidated GST invoice for the buyer's period. */
export async function fetchConsolidatedInvoice(period: string): Promise<ConsolidatedInvoice> {
  const res = await api.get<ConsolidatedInvoice>('/customer/invoices/consolidated', {
    params: { period },
  });
  return res.data;
}
