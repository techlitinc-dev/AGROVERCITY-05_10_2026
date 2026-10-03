import { api } from './client';

// Verified against backend/app/routers/livestock_dairy.py + livestock.py (procurement).
//
// QUIRK (do not "fix"): query params are snake_case (`date_from`, `date_to`,
// `farmer_code`-style), while request BODIES are camelCase (`periodFrom`,
// `periodTo`, `memberId`…). Mixing these up yields a 400/422 from FastAPI.

export interface Paged<T> {
  data: T[];
  page: number;
  pageSize: number;
  total: number;
}

export type DairySpecies = 'cow' | 'buffalo';
export type CollectionShift = 'morning' | 'evening';
export type SaleShift = 'am' | 'pm';
export type EntityStatus = 'active' | 'inactive';

/** ₹ with 2 decimals (paise matter on milk rates). */
export function fmtINR(amount: number): string {
  return `₹${amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/** Liters to 2 decimals. */
export function fmtL(liters: number): string {
  return liters.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// ---- Members ----

export interface BankDetails {
  accountNumber?: string;
  ifsc?: string;
  holderName?: string;
}

export interface DairyMember {
  id: string;
  centerId: string;
  farmerUid: string;
  name: string;
  phone: string;
  village: string;
  memberCode: string;
  bankDetails: BankDetails;
  defaultSpecies: DairySpecies;
  deduction: number;
  status: EntityStatus;
  createdAt: string;
  updatedAt?: string;
}

export interface DairyMemberInput {
  name: string;
  phone?: string;
  village?: string;
  farmerUid?: string;
  memberCode?: string;
  bankDetails?: BankDetails;
  defaultSpecies?: DairySpecies;
  deduction?: number;
  status?: EntityStatus;
}

export async function listMembers(params: {
  status?: EntityStatus | 'all';
  page?: number;
  pageSize?: number;
} = {}): Promise<Paged<DairyMember>> {
  const { data } = await api.get<Paged<DairyMember>>('/livestock/dairy/members', {
    params: params.status && params.status !== 'all' ? { status: params.status } : {},
  });
  return data;
}

export async function createMember(payload: DairyMemberInput): Promise<DairyMember> {
  const { data } = await api.post<DairyMember>('/livestock/dairy/members', payload);
  return data;
}

export async function updateMember(memberId: string, payload: DairyMemberInput): Promise<DairyMember> {
  const { data } = await api.put<DairyMember>(`/livestock/dairy/members/${memberId}`, payload);
  return data;
}

/** Soft delete — backend sets status: "inactive". */
export async function deactivateMember(memberId: string): Promise<DairyMember> {
  const { data } = await api.delete<DairyMember>(`/livestock/dairy/members/${memberId}`);
  return data;
}

export interface MemberStatement {
  member: DairyMember;
  collections: MilkCollection[];
  payments: PaymentEntry[];
  totals: { liters: number; amount: number; paid: number };
}

export async function getMemberStatement(
  memberId: string,
  dateFrom?: string,
  dateTo?: string
): Promise<MemberStatement> {
  const { data } = await api.get<MemberStatement>(`/livestock/dairy/members/${memberId}/statement`, {
    params: { ...(dateFrom ? { date_from: dateFrom } : {}), ...(dateTo ? { date_to: dateTo } : {}) },
  });
  return data;
}

// ---- Rate charts ----

export interface RateChart {
  id: string;
  centerId: string;
  species: DairySpecies;
  effectiveFrom: string;
  baseRate: number;
  fatBase: number;
  snfBase: number;
  fatStep: number;
  snfStep: number;
  minRate: number;
  minFat: number;
  minSnf: number;
  active: boolean;
  createdAt: string;
  updatedAt?: string;
}

export interface RateChartInput {
  species: DairySpecies;
  effectiveFrom: string;
  baseRate: number;
  fatBase: number;
  snfBase: number;
  fatStep?: number;
  snfStep?: number;
  minRate?: number;
  minFat?: number;
  minSnf?: number;
  active?: boolean;
}

/** Single active chart for the species; 404 RATE_CHART_NOT_FOUND when none. */
export async function getActiveRateChart(species: DairySpecies): Promise<RateChart> {
  const { data } = await api.get<RateChart>('/livestock/dairy/rate-chart', { params: { species } });
  return data;
}

export async function listRateChartVersions(species?: DairySpecies): Promise<Paged<RateChart>> {
  const { data } = await api.get<Paged<RateChart>>('/livestock/dairy/rate-chart/versions', {
    params: species ? { species } : {},
  });
  return data;
}

export async function createRateChart(payload: RateChartInput): Promise<RateChart> {
  const { data } = await api.post<RateChart>('/livestock/dairy/rate-chart', payload);
  return data;
}

export async function updateRateChart(chartId: string, payload: RateChartInput): Promise<RateChart> {
  const { data } = await api.put<RateChart>(`/livestock/dairy/rate-chart/${chartId}`, payload);
  return data;
}

// ---- Milk collections (procurement) ----

export interface MilkCollection {
  id: string;
  dairyId: string;
  dairyName: string;
  farmerId: string;
  farmerName: string;
  farmerCode: string;
  farmerPhone: string;
  date: string;
  shift: CollectionShift;
  milkType: DairySpecies;
  liters: number;
  fatPercent: number;
  snfPercent: number;
  clr: number;
  ratePerLiter: number;
  totalAmount: number;
  slipNumber: string;
  status: string;
  recordedAt: string;
  memberId?: string;
  quality?: Record<string, unknown>;
  rateChartId?: string;
}

export interface MilkCollectionInput {
  farmerId?: string;
  farmerName: string;
  farmerCode: string;
  farmerPhone?: string;
  date: string;
  shift: CollectionShift;
  milkType: DairySpecies;
  liters: number;
  fatPercent: number;
  snfPercent: number;
  clr?: number;
  memberId?: string;
  quality?: Record<string, unknown>;
}

export async function recordCollection(payload: MilkCollectionInput): Promise<MilkCollection> {
  const { data } = await api.post<MilkCollection>('/livestock/procurement/collections', payload);
  return data;
}

export async function listCollections(params: {
  date?: string;
  shift?: CollectionShift;
  farmerCode?: string;
  page?: number;
  pageSize?: number;
} = {}): Promise<Paged<MilkCollection>> {
  const { data } = await api.get<Paged<MilkCollection>>('/livestock/procurement/collections', {
    params,
  });
  return data;
}

export interface ProcurementSummary {
  date: string;
  totalMorningLiters: number;
  totalEveningLiters: number;
  totalLiters: number;
  avgFat: number;
  avgSnf: number;
  totalPayoutAmount: number;
  collectionsCount: number;
}

export async function getProcurementSummary(date?: string): Promise<ProcurementSummary> {
  const { data } = await api.get<ProcurementSummary>('/livestock/procurement/summary', {
    params: date ? { date } : {},
  });
  return data;
}

export interface RateCalcResult {
  milkType: DairySpecies;
  fatPercent: number;
  snfPercent: number;
  liters: number;
  ratePerLiter: number;
  totalAmount: number;
  baseRate: number;
  fatPremium: number;
  snfPremium: number;
  formula: string;
}

export async function calcRate(payload: {
  milkType: DairySpecies;
  fatPercent: number;
  snfPercent: number;
  liters: number;
}): Promise<RateCalcResult> {
  const { data } = await api.post<RateCalcResult>('/livestock/procurement/rate-calc', payload);
  return data;
}

// ---- Payment batches ----

export interface PaymentBatch {
  id: string;
  centerId: string;
  periodFrom: string;
  periodTo: string;
  status: 'draft' | 'paid';
  totalLiters: number;
  totalAmount: number;
  totalDeduction: number;
  totalNet: number;
  createdAt: string;
  paidAt?: string;
}

export interface PaymentEntry {
  id: string;
  batchId: string;
  centerId: string;
  memberId: string;
  memberName: string;
  liters: number;
  amount: number;
  deduction: number;
  netAmount: number;
  payoutRef: string;
  status: 'pending' | 'paid';
  createdAt: string;
}

export type PaymentBatchWithEntries = PaymentBatch & { entries: PaymentEntry[] };

export async function listBatches(params: { page?: number; pageSize?: number } = {}): Promise<Paged<PaymentBatch>> {
  const { data } = await api.get<Paged<PaymentBatch>>('/livestock/dairy/payments/batches', { params });
  return data;
}

export async function generateBatch(periodFrom: string, periodTo: string): Promise<PaymentBatchWithEntries> {
  const { data } = await api.post<PaymentBatchWithEntries>('/livestock/dairy/payments/batches', {
    periodFrom,
    periodTo,
  });
  return data;
}

export async function markBatchPaid(batchId: string, payoutRef?: string): Promise<PaymentBatch> {
  const { data } = await api.post<PaymentBatch>(
    `/livestock/dairy/payments/batches/${batchId}/mark-paid`,
    { payoutRef: payoutRef ?? '' }
  );
  return data;
}

// ---- Farmer self-views ----

export async function getFarmerPayments(params: { page?: number; pageSize?: number } = {}): Promise<Paged<PaymentEntry>> {
  const { data } = await api.get<Paged<PaymentEntry>>('/livestock/dairy/farmer/payments', { params });
  return data;
}

export type FarmerSlips = Paged<MilkCollection> & { memberCode: string };

export async function getFarmerSlips(dateFrom?: string, dateTo?: string): Promise<FarmerSlips> {
  const { data } = await api.get<FarmerSlips>('/livestock/dairy/farmer/slips', {
    params: { ...(dateFrom ? { date_from: dateFrom } : {}), ...(dateTo ? { date_to: dateTo } : {}) },
  });
  return data;
}

// ---- Milk sales ----

export type CustomerType = 'household' | 'shop' | 'hotel';

export interface MilkSaleCustomer {
  id: string;
  centerId: string;
  name: string;
  phone: string;
  type: CustomerType;
  address: string;
  route: string;
  dailyLitersAM: number;
  dailyLitersPM: number;
  ratePerLiter: number;
  status: EntityStatus;
  createdAt: string;
  updatedAt?: string;
}

export interface MilkSaleCustomerInput {
  name: string;
  phone?: string;
  type?: CustomerType;
  address?: string;
  route?: string;
  dailyLitersAM?: number;
  dailyLitersPM?: number;
  ratePerLiter: number;
  status?: EntityStatus;
}

export async function listCustomers(params: { page?: number; pageSize?: number } = {}): Promise<Paged<MilkSaleCustomer>> {
  const { data } = await api.get<Paged<MilkSaleCustomer>>('/livestock/dairy/sales/customers', { params });
  return data;
}

export async function createCustomer(payload: MilkSaleCustomerInput): Promise<MilkSaleCustomer> {
  const { data } = await api.post<MilkSaleCustomer>('/livestock/dairy/sales/customers', payload);
  return data;
}

export async function updateCustomer(customerId: string, payload: MilkSaleCustomerInput): Promise<MilkSaleCustomer> {
  const { data } = await api.put<MilkSaleCustomer>(`/livestock/dairy/sales/customers/${customerId}`, payload);
  return data;
}

export type SaleOrderStatus = 'scheduled' | 'delivered' | 'billed' | 'paid';

export interface MilkSaleOrderItem {
  productId: string;
  name: string;
  qty: number;
  unitPrice: number;
}

export interface MilkSaleOrder {
  id: string;
  centerId: string;
  customerId: string;
  customerName: string;
  orderDate: string;
  shift: SaleShift;
  liters: number;
  items: MilkSaleOrderItem[];
  amount: number;
  status: SaleOrderStatus;
  createdAt: string;
  deliveredAt?: string;
  updatedAt?: string;
}

export interface MilkSaleOrderInput {
  customerId: string;
  orderDate: string;
  shift?: SaleShift;
  liters?: number;
  items?: MilkSaleOrderItem[];
  amount?: number;
}

export async function listOrders(params: { status?: SaleOrderStatus; page?: number; pageSize?: number } = {}): Promise<Paged<MilkSaleOrder>> {
  const { data } = await api.get<Paged<MilkSaleOrder>>('/livestock/dairy/sales/orders', {
    params: params.status ? { status: params.status } : {},
  });
  return data;
}

export async function createOrder(payload: MilkSaleOrderInput): Promise<MilkSaleOrder> {
  const { data } = await api.post<MilkSaleOrder>('/livestock/dairy/sales/orders', payload);
  return data;
}

export async function advanceOrderStatus(
  orderId: string,
  status: 'delivered' | 'billed' | 'paid'
): Promise<MilkSaleOrder> {
  const { data } = await api.post<MilkSaleOrder>(`/livestock/dairy/sales/orders/${orderId}/status`, { status });
  return data;
}

export interface SalesSummary {
  totalOrders: number;
  totalLiters: number;
  totalAmount: number;
  collectedAmount: number;
  byStatus: Record<string, number>;
}

export async function getSalesSummary(dateFrom?: string, dateTo?: string): Promise<SalesSummary> {
  const { data } = await api.get<SalesSummary>('/livestock/dairy/sales/summary', {
    params: { ...(dateFrom ? { date_from: dateFrom } : {}), ...(dateTo ? { date_to: dateTo } : {}) },
  });
  return data;
}

// ---- Stock ----

export type StockCategory = 'milk' | 'curd' | 'ghee' | 'paneer' | 'other';

export interface StockItem {
  id: string;
  centerId: string;
  name: string;
  category: StockCategory;
  unit: string;
  stockQty: number;
  unitPrice: number;
  expiryDate: string;
  createdAt: string;
  lastAdjustment?: { delta: number; reason: string; at: string };
}

export interface StockItemInput {
  name: string;
  category?: StockCategory;
  unit?: string;
  stockQty?: number;
  unitPrice?: number;
  expiryDate?: string;
}

export async function listStock(params: { page?: number; pageSize?: number } = {}): Promise<Paged<StockItem>> {
  const { data } = await api.get<Paged<StockItem>>('/livestock/dairy/stock/items', { params });
  return data;
}

export async function createStockItem(payload: StockItemInput): Promise<StockItem> {
  const { data } = await api.post<StockItem>('/livestock/dairy/stock/items', payload);
  return data;
}

export async function adjustStock(itemId: string, delta: number, reason: string): Promise<StockItem> {
  const { data } = await api.post<StockItem>(`/livestock/dairy/stock/items/${itemId}/adjust`, {
    delta,
    reason,
  });
  return data;
}

// ---- Reports ----

export interface DailyReport {
  date: string;
  collections: { count: number; liters: number; amount: number };
  sales: { orders: number; liters: number; amount: number };
  closingStock: { id: string; name: string; stockQty: number; unit: string }[];
}

export async function getDailyReport(date?: string): Promise<DailyReport> {
  const { data } = await api.get<DailyReport>('/livestock/dairy/reports/daily', {
    params: date ? { date } : {},
  });
  return data;
}

export interface PlReport {
  month: string;
  procurementCost: number;
  salesIncome: number;
  grossProfit: number;
  collectionsCount: number;
  ordersCount: number;
}

export async function getPlReport(month?: string): Promise<PlReport> {
  const { data } = await api.get<PlReport>('/livestock/dairy/reports/pl', {
    params: month ? { month } : {},
  });
  return data;
}

// ---- Analytics (P11) — verified against backend/app/routers/livestock_dairy.py §Analytics ----

export interface DairyAnalyticsDaily {
  date: string;
  liters: number;
  amount: number;
  count: number;
}

export interface DairyTopMember {
  memberId: string;
  name: string;
  liters: number;
  amount: number;
  collections: number;
}

export interface DairyAnalytics {
  month: string;
  collections: {
    liters: number;
    amount: number;
    count: number;
    avgFat: number;
    avgSnf: number;
    bySpecies: Partial<Record<DairySpecies, { liters: number; amount: number }>>;
    byShift: Partial<Record<CollectionShift, { liters: number; count: number }>>;
    daily: DairyAnalyticsDaily[];
    topMembers: DairyTopMember[];
  };
  sales: {
    liters: number;
    amount: number;
    orders: number;
    byStatus: Record<string, number>;
    daily: DairyAnalyticsDaily[];
  };
  dues: { pendingNet: number; pendingEntries: number };
  previousMonth: {
    collections: { liters: number; amount: number };
    sales: { liters: number; amount: number; orders: number };
  };
}

/** Manager cockpit aggregate; 403 unless the caller is a dairyManager. */
export async function getDairyAnalytics(month?: string): Promise<DairyAnalytics> {
  const { data } = await api.get<DairyAnalytics>('/livestock/dairy/analytics', {
    params: month ? { month } : {},
  });
  return data;
}

export interface FarmerAnalyticsMonth {
  month: string;
  liters: number;
  amount: number;
  paid: number;
}

export interface FarmerAnalytics {
  member: { id: string; name: string; memberCode: string } | null;
  monthly: FarmerAnalyticsMonth[];
  totals: { liters: number; amount: number; paid: number; pending: number };
}

/** Farmer self-view: 6-month liters/amount/paid series + lifetime totals. */
export async function getFarmerAnalytics(): Promise<FarmerAnalytics> {
  const { data } = await api.get<FarmerAnalytics>('/livestock/dairy/farmer/analytics');
  return data;
}
