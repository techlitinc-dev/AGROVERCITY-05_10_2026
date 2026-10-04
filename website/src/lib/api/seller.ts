import { api } from './client';

/**
 * Seller / Vyapari business suite — POS sales, buyer khata, procurement
 * (J-form), mandi-rate posting, e-market products.
 * Verified against backend/app/routers/seller.py + seller_products.py.
 */

// ---------- Sales (POS) ----------

export type SalePaymentMode = 'cash' | 'upi' | 'credit' | 'bank_transfer';
export type SaleStatus = 'paid' | 'partial' | 'credit';

export interface SaleEntry {
  id: string;
  billNumber?: string;
  buyerName: string;
  buyerPhone?: string;
  item: string;
  quantity: number;
  unit: string;
  ratePerUnit: number;
  grossAmount?: number;
  mandiFeePct?: number;
  mandiFeeAmount?: number;
  netAmount: number;
  paymentMode: SalePaymentMode;
  amountPaid: number;
  balanceDue: number;
  status: SaleStatus;
  notes?: string;
  createdAt: string;
}

export interface SaleStats {
  totalRevenue: number;
  totalReceived: number;
  totalOutstanding: number;
  totalInvoices: number;
}

export interface SalePayload {
  buyerName: string;
  buyerPhone?: string;
  item: string;
  quantity: number;
  unit?: string;
  ratePerUnit: number;
  paymentMode: SalePaymentMode;
  amountPaid: number;
  mandiFeePct?: number;
  notes?: string;
}

export async function createSale(payload: SalePayload): Promise<SaleEntry> {
  const { data } = await api.post<SaleEntry>('/seller/sales', payload);
  return data;
}

export async function listSales(): Promise<{ data: SaleEntry[]; stats: SaleStats }> {
  const { data } = await api.get<{ data: SaleEntry[]; stats: SaleStats }>('/seller/sales');
  return data;
}

// ---------- Buyer khata (ledgers) ----------

export type LedgerType = 'credit_sale' | 'payment_received' | 'adjustment';

export interface LedgerEntry {
  id: string;
  buyerName: string;
  buyerPhone?: string;
  companyName?: string;
  type: LedgerType;
  amount: number;
  paymentMode?: string;
  reference?: string;
  notes?: string;
  createdAt: string;
}

export interface BuyerKhata {
  buyerName: string;
  buyerPhone?: string;
  companyName?: string;
  totalCredit: number;
  totalPaid: number;
  netBalance: number;
  history: LedgerEntry[];
}

export interface KhataResponse {
  data: BuyerKhata[];
  entries: LedgerEntry[];
  totalCreditOutstanding: number;
  totalDebtors: number;
}

export interface LedgerPayload {
  buyerName: string;
  buyerPhone?: string;
  companyName?: string;
  type: LedgerType;
  amount: number;
  paymentMode?: string;
  reference?: string;
  notes?: string;
}

export async function listLedgers(): Promise<KhataResponse> {
  const { data } = await api.get<KhataResponse>('/seller/ledgers');
  return data;
}

export async function addLedgerEntry(payload: LedgerPayload): Promise<LedgerEntry> {
  const { data } = await api.post<LedgerEntry>('/seller/ledgers', payload);
  return data;
}

// ---------- Procurement (J-form) ----------

export type ProcurementPayStatus = 'unpaid' | 'partial' | 'paid';

export interface ProcurementLot {
  id: string;
  farmerName: string;
  farmerPhone?: string;
  crop: string;
  variety?: string;
  grossWeightKg: number;
  tareWeightKg: number;
  netWeightQuintals: number;
  ratePerQuintal: number;
  qualityDeductionPct: number;
  grossValue?: number;
  qualityDeductionAmount?: number;
  finalAmount: number;
  paymentStatus: ProcurementPayStatus;
  paymentMode?: string;
  utrNumber?: string;
  weighbridgeSlipNo?: string;
  weighbridgeSlipUrl?: string;
  jFormNumber: string;
  notes?: string;
  createdAt: string;
  paidAt?: string;
}

export interface ProcurementStats {
  totalProcuredQuintals: number;
  totalPayoutAmount: number;
  pendingPayouts: number;
  totalLots: number;
}

export interface ProcurementPayload {
  farmerName: string;
  farmerPhone?: string;
  crop: string;
  variety?: string;
  grossWeightKg: number;
  tareWeightKg: number;
  netWeightQuintals: number;
  ratePerQuintal: number;
  qualityDeductionPct: number;
  paymentStatus?: ProcurementPayStatus;
  paymentMode?: string;
  weighbridgeSlipNo?: string;
  weighbridgeSlipUrl?: string;
  notes?: string;
}

export async function listProcurement(): Promise<{
  data: ProcurementLot[];
  stats: ProcurementStats;
}> {
  const { data } = await api.get<{ data: ProcurementLot[]; stats: ProcurementStats }>(
    '/seller/procurement'
  );
  return data;
}

export async function createProcurement(payload: ProcurementPayload): Promise<ProcurementLot> {
  const { data } = await api.post<ProcurementLot>('/seller/procurement', payload);
  return data;
}

export async function payProcurement(
  lotId: string,
  paymentMode = 'bank_transfer',
  utrNo = ''
): Promise<ProcurementLot> {
  const { data } = await api.post<ProcurementLot>(
    `/seller/procurement/${lotId}/pay`,
    {},
    { params: { paymentMode, utrNo } }
  );
  return data;
}

// ---------- Farmer-facing procurement payments (S4) ----------

export interface ProcurementPayment {
  id: string;
  jFormNumber?: string;
  crop: string;
  variety?: string;
  netWeightQuintals?: number;
  ratePerQuintal?: number;
  finalAmount?: number;
  paymentStatus: string;
  paymentMode?: string;
  utrNumber?: string;
  receiptNo?: string;
  paidAt?: string;
  amountPaisa?: number;
  sellerName?: string;
  createdAt?: string;
}

export async function myProcurementPayments(): Promise<{
  data: ProcurementPayment[];
  pendingCount: number;
  total: number;
}> {
  const { data } = await api.get('/seller/procurement/mine');
  return data;
}

export async function procurementReceipt(paymentId: string): Promise<ProcurementPayment> {
  const { data } = await api.get(`/seller/procurement/mine/${paymentId}/receipt`);
  return data;
}

// ---------- Buyer network / B2B (S5) ----------

export interface BulkOrder {
  id: string;
  buyerId: string;
  buyerName: string;
  buyerPhone?: string;
  crop: string;
  quantityQuintals: number;
  targetPricePerQuintal?: number | null;
  neededBy?: string | null;
  notes?: string | null;
  status: string;
  createdAt: string;
}

export interface DirectoryBuyer {
  buyerName: string;
  buyerPhone?: string;
  companyName?: string;
  ledgerEntries: number;
  bulkOrders: number;
}

export async function listBulkOrders(): Promise<{
  data: BulkOrder[];
  openCount: number;
  total: number;
}> {
  const { data } = await api.get('/seller/bulk-orders');
  return data;
}

export async function buyerDirectory(): Promise<{ data: DirectoryBuyer[]; total: number }> {
  const { data } = await api.get('/seller/buyer-directory');
  return data;
}

// ---------- Mandi rates ----------

export interface SellerRatePayload {
  crop: string;
  ratePerKg: number;
  mandiName: string;
}

export interface PendingRate extends SellerRatePayload {
  status: 'pending';
  createdAt?: string;
}

export async function postRate(payload: SellerRatePayload): Promise<unknown> {
  const { data } = await api.post('/seller/rates', payload);
  return data;
}

export async function myRates(): Promise<{ data: PendingRate[] }> {
  const { data } = await api.get<{ data: PendingRate[] }>('/seller/rates/my');
  return data;
}

// ---------- E-market products (seller's own catalog) ----------

export interface SellerProduct {
  id: string;
  title: string;
  category: string;
  brand?: string;
  mrp: number;
  discountedPrice: number;
  stock: number;
  unit?: string;
  description?: string;
  imageUrl?: string;
  batchNo?: string;
}

export async function listSellerProducts(): Promise<{ data: SellerProduct[] }> {
  const { data } = await api.get<{ data: SellerProduct[] }>('/seller/products');
  return data;
}

// ---------- Procurement Forecast (M4) ----------

export interface ProcurementSuggestion {
  crop: string;
  qty_quintal: number;
  reason: string;
}

export interface SellerForecast {
  suggested_procurement?: ProcurementSuggestion[];
}

export async function getSellerForecast(): Promise<SellerForecast | null> {
  try {
    const { data } = await api.get<SellerForecast>('/seller/forecast');
    return data;
  } catch {
    return null;
  }
}

