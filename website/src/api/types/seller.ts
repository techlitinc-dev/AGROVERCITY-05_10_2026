export type SellerRateStatus = 'pending' | 'approved' | 'rejected';

export interface SellerRate {
  id: string;
  crop: string;
  mandiName: string;
  ratePerQuintal: number;
  priceChange: number;
  changeDir: 'up' | 'down' | 'flat';
  status: SellerRateStatus;
  date: string;
  createdAt: string;
}

export interface InventoryItem {
  id: string;
  crop: string;
  quantityQuintals: number;
  avgBuyRate: number;
  mandiName: string;
  lowStockAlertQuintals: number;
  createdAt: string;
  updatedAt: string;
}

export interface SaleEntry {
  id: string;
  inventoryId: string;
  quantityQuintals: number;
  saleRate: number;
  totalAmount: number;
  buyerName?: string;
  paymentMode: 'cash' | 'upi' | 'credit';
  date: string;
  createdAt: string;
}

export interface Procurement {
  id: string;
  sellerId: string;
  farmerPhone: string;
  farmerName: string;
  crop: string;
  lotId?: string;
  quantityQuintals: number;
  ratePerQuintal: number;
  totalAmount: number;
  slipPhotoUrl?: string;
  paymentMode: 'cash' | 'upi' | 'udhaar';
  paymentStatus: 'paid' | 'udhaar';
  date: string;
  createdAt: string;
}

export interface BuyerLedgerSummary {
  buyerKey: string;
  buyerName: string;
  outstandingRupees: number;
  lastPaymentOn: string | null;
  agingDays: number;
}

export interface BuyerLedgerEntry {
  id: string;
  type: 'sale' | 'payment';
  refId: string | null;
  amount: number;
  balance: number;
  date: string;
  note: string;
}

export interface BuyerLedger {
  buyerName: string;
  outstandingRupees: number;
  entries: BuyerLedgerEntry[];
}
