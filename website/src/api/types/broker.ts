import type { ChatMessage } from './platform';

export type DealStatus = 'lead' | 'negotiating' | 'locked' | 'completed' | 'cancelled';

export interface DealDocument {
  type: 'weightSlip' | 'qualityReport' | 'paymentProof' | 'other';
  url: string;
  uploadedAt: string;
}

export interface BrokerDeal {
  id: string;
  brokerId: string;
  crop: string;
  quantityQuintals: number;
  ratePerQuintal: number;
  dealValue: number;
  commissionPercent: number;
  commissionAmount: number;
  status: DealStatus;
  farmerParty: string;
  buyerParty: string;
  leadId?: string;
  lotId?: string;
  requirementId?: string;
  documents?: DealDocument[];
  createdAt: string;
}

export interface BrokerLead {
  id: string;
  name: string;
  village: string;
  phone: string;
  type: 'farmer' | 'buyer';
  crop: string;
  quantityQuintals: number;
  notes: string;
  lastContactAt?: string;
  convertedDealId?: string | null;
  createdAt: string;
}

export interface CommissionEntry {
  id: string;
  dealId: string | null;
  party: string;
  amount: number;
  status: 'pending' | 'received';
  date: string;
  receivedOn?: string | null;
  note?: string;
  createdAt: string;
}

export type DealMessage = ChatMessage;
