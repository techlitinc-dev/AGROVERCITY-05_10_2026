import { apiClient } from './client';
import { ApiError, handleApiError } from './errors';
import { patch, post, unwrapItems } from './http';

/** Produce-lot leads — the direct-connect model: buyer accepts terms (+ MPIN),
 * both parties' contact details are revealed, deal closes off-platform.
 * Demand leads (source="demand"): a farmer applies on an industrial buyer's
 * posted requirement with quantity, price, availability and supply basis —
 * contacts stay hidden until the buyer unlocks them with terms + MPIN. */

export interface LeadContact {
  name: string;
  fullName: string;
  village: string;
  district: string;
  phone: string;
  phoneDigits?: string | null;
  whatsappDigits?: string | null;
  verified?: boolean;
  role?: string;
}

/** Canonical application/connection statuses (legacy new/sold map to these). */
export type LeadStatus = 'submitted' | 'contacted' | 'dealDone' | 'dismissed' | 'withdrawn' | 'rejected';
/** Legacy statuses still accepted by the update endpoint and mapped on read. */
export type LeadStatusLegacy = 'new' | 'sold';
export type LeadSource = 'lot' | 'demand';
export type SupplyBasis = 'farmGate' | 'buyerCollection' | 'deliveryToBuyer';

export interface SourceLotRef {
  lotId: string;
  crop: string;
  quantityQuintals?: number;
  harvestDate?: string;
  photos?: string[];
  location?: string;
}

export interface DealDetails {
  finalQuantity?: number;
  finalUnit?: string;
  finalPrice?: number;
  finalPriceUnit?: string;
  supplyStartDate?: string;
  arrangementType?: 'oneTime' | 'recurring';
  reportedBy?: string;
  at?: string;
}

export interface Lead {
  id: string;
  /** 'demand' = farmer applied on a buyer requirement; absent/undefined = lot lead. */
  source?: LeadSource;
  lotId?: string;
  lotCrop?: string;
  lotVariety?: string;
  lotGrade?: string;
  quantityQuintals?: number;
  expectedRate?: number;
  demandId?: string;
  demandCrop?: string;
  demandVariety?: string;
  pricePerUnit?: number;
  quantity?: number;
  unit?: string;
  supplyBasis?: SupplyBasis;
  availableDate?: string;
  supplyLocation?: string;
  canRecur?: boolean | null;
  availabilityNote?: string;
  sourceLotId?: string;
  sourceLot?: SourceLotRef | null;
  qualityDetails?: string;
  photos?: string[];
  packagingCapability?: string;
  certifications?: string[];
  message?: string;
  dealDetails?: DealDetails;
  farmerId: string;
  buyerId: string;
  buyerRole: string;
  buyerVerified: boolean;
  status: LeadStatus;
  finalRate?: number | null;
  /** Both hidden (null) until the connection is unlocked. */
  farmerContact: LeadContact | null;
  buyerContact: (LeadContact & { verified?: boolean; role?: string }) | null;
  chatRoomId?: string;
  contactRevealedAt?: string | null;
  termsAcceptedAt?: string;
  termsVersion?: string;
  createdAt: string;
  updatedAt: string;
}

export interface LeadCreateResult {
  lead: Lead;
  chatRoomId?: string;
}

export interface DemandApplicationPayload {
  pricePerUnit: number;
  quantity: number;
  message?: string;
  termsAccepted: boolean;
  mpin?: string;
  supplyBasis?: SupplyBasis;
  availableDate: string;
  supplyLocation?: string;
  canRecur?: boolean;
  availabilityNote?: string;
  sourceLotId?: string;
  qualityDetails?: string;
  photos?: string[];
  packagingCapability?: string;
  certifications?: string[];
}

export type LeadOutcome =
  | 'still_in_contact'
  | 'deal_done_offline'
  | 'did_not_happen'
  | 'withdrawn';

export const createLead = async (lotId: string, termsAccepted: boolean, mpin?: string): Promise<LeadCreateResult> => {
  try {
    const res = await apiClient.post('/leads', { lotId, termsAccepted, mpin: mpin || undefined });
    return res.data as LeadCreateResult;
  } catch (e) {
    handleApiError(e);
  }
};

/** Farmer applies on an industrial buyer's posted requirement — quote +
 * availability + supply basis + T&C (+ MPIN). Contacts unlock only after the
 * buyer accepts the contact request with terms + MPIN. */
export const applyToDemand = async (
  demandId: string,
  payload: DemandApplicationPayload,
): Promise<LeadCreateResult> => {
  try {
    const res = await apiClient.post('/leads', {
      demandId,
      pricePerUnit: payload.pricePerUnit,
      quantity: payload.quantity,
      message: payload.message || undefined,
      termsAccepted: payload.termsAccepted,
      mpin: payload.mpin || undefined,
      supplyBasis: payload.supplyBasis || 'farmGate',
      availableDate: payload.availableDate,
      supplyLocation: payload.supplyLocation || undefined,
      canRecur: payload.canRecur,
      availabilityNote: payload.availabilityNote || undefined,
      sourceLotId: payload.sourceLotId || undefined,
      qualityDetails: payload.qualityDetails || undefined,
      photos: payload.photos && payload.photos.length ? payload.photos : undefined,
      packagingCapability: payload.packagingCapability || undefined,
      certifications: payload.certifications && payload.certifications.length ? payload.certifications : undefined,
    });
    return res.data as LeadCreateResult;
  } catch (e) {
    handleApiError(e);
  }
};

/** Buyer-side "Contact Farmer" — accepts the direct-connect terms + MPIN,
 * atomically marks the application contacted and reveals both contacts.
 * Idempotent; never accepts the quote or creates orders/contracts/payments. */
export const unlockLead = async (
  leadId: string,
  termsAccepted: boolean,
  mpin?: string,
): Promise<Lead> => {
  try {
    const res = await apiClient.post(`/leads/${encodeURIComponent(leadId)}/unlock`, {
      termsAccepted,
      mpin: mpin || undefined,
    });
    return res.data as Lead;
  } catch (e) {
    handleApiError(e);
  }
};

/** User-reported outcome after contact — still in contact / supply arrangement
 * completed offline / did not happen / withdrawn, with optional dealDone
 * details. Never creates payment/invoice/delivery/settlement objects. */
export const recordLeadOutcome = async (
  leadId: string,
  outcome: LeadOutcome,
  details?: Partial<DealDetails>,
): Promise<Lead> => {
  try {
    const res = await apiClient.post(`/leads/${encodeURIComponent(leadId)}/outcome`, {
      outcome,
      finalQuantity: details?.finalQuantity ?? undefined,
      finalUnit: details?.finalUnit || undefined,
      finalPrice: details?.finalPrice ?? undefined,
      finalPriceUnit: details?.finalPriceUnit || undefined,
      supplyStartDate: details?.supplyStartDate || undefined,
      arrangementType: details?.arrangementType ?? undefined,
    });
    return res.data as Lead;
  } catch (e) {
    handleApiError(e);
  }
};

/** True when the API error says KYC is required (show "complete KYC" state). */
export const isKycError = (e: unknown): boolean => e instanceof ApiError && e.code === 'KYC_REQUIRED';

export const getMyLeads = async (
  filter: 'received' | 'sent' = 'received',
  status?: LeadStatus | LeadStatusLegacy,
  source?: LeadSource,
): Promise<Lead[]> => {
  try {
    const res = await apiClient.get('/leads/mine', { params: { filter, status, source } });
    return unwrapItems<Lead>(res.data?.data ?? res.data);
  } catch (e) {
    handleApiError(e);
  }
};

export const updateLeadStatus = async (
  leadId: string,
  status: LeadStatus | LeadStatusLegacy,
  finalRate?: number,
): Promise<Lead> => {
  try {
    const res = await patch<Lead>(`/leads/${encodeURIComponent(leadId)}`, {
      status,
      finalRate: finalRate ?? undefined,
    });
    return res;
  } catch (e) {
    handleApiError(e);
  }
};

/** Rate the other party on an unlocked lead connection (kind lead_connection). */
export const rateLeadConnection = async (leadId: string, stars: number, comment?: string): Promise<unknown> => {
  try {
    return await post(`/ratings`, {
      bookingKind: 'lead_connection',
      bookingId: leadId,
      stars,
      comment: comment || undefined,
    });
  } catch (e) {
    handleApiError(e);
  }
};

export const markLotSold = async (lotId: string, finalRate?: number): Promise<unknown> => {
  try {
    return await post(`/market/lots/${encodeURIComponent(lotId)}/mark-sold`, {
      finalRate: finalRate ?? undefined,
    });
  } catch (e) {
    handleApiError(e);
  }
};

/** True when the API error was an MPIN failure (show the MPIN field / retry). */
export const isMpinError = (e: unknown): boolean => e instanceof ApiError && e.code === 'WRONG_MPIN';
