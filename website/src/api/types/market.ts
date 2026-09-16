export type LotStatus = 'open' | 'matched' | 'sold' | 'withdrawn';

export interface MarketLot {
  id: string;
  farmerId: string;
  crop: string;
  quantityQuintals: number;
  expectedRatePerQuintal: number;
  mandiModalRef: number;
  harvestDate: string;
  grade: 'faq' | 'medium' | 'bold';
  photoUrls: string[];
  pickup: { lat: number; lng: number; address: string };
  status: LotStatus;
  createdAt: string;
}

export interface PendingPayment {
  procurementId: string;
  sellerName: string;
  crop: string;
  amount: number;
  daysPending: number;
}

export interface MyLotsRes {
  lots: MarketLot[];
  pendingPayments: PendingPayment[];
}

export interface BuyerRequirement {
  id: string;
  postedBy: string;
  postedByRole: 'seller' | 'broker';
  crop: string;
  quantityQuintals: number;
  targetRatePerQuintal: number;
  neededBy: string;
  district: string;
  buyerName: string;
  notes?: string;
  status: 'open' | 'matched' | 'closed' | 'expired';
  createdAt: string;
}
