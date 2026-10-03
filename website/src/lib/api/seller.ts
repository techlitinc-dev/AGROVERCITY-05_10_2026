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
