import { apiClient } from './client';
import { ApiError, handleApiError } from './errors';
import { patch, post, unwrapItems } from './http';

/** Produce-lot leads — the direct-connect model: buyer accepts terms (+ MPIN),
 * both parties' contact details are revealed, deal closes off-platform.
 * Demand leads (source="demand"): a farmer applies on a buyer's posted demand
 * with a price/quantity quote — same terms + MPIN + contact reveal. */

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

export type LeadStatus = 'new' | 'contacted' | 'sold' | 'dismissed';
export type LeadSource = 'lot' | 'demand';

export interface Lead {
  id: string;
  /** 'demand' = farmer applied on a buyer demand; absent/undefined = lot lead. */
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
  message?: string;
  farmerId: string;
  buyerId: string;
  buyerRole: string;
  buyerVerified: boolean;
  status: LeadStatus;
  finalRate?: number | null;
  farmerContact: LeadContact | null;
  buyerContact: (LeadContact & { verified?: boolean; role?: string }) | null;
  chatRoomId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface LeadCreateResult {
  lead: Lead;
  chatRoomId?: string;
}

export const createLead = async (lotId: string, termsAccepted: boolean, mpin?: string): Promise<LeadCreateResult> => {
  try {
    const res = await apiClient.post('/leads', { lotId, termsAccepted, mpin: mpin || undefined });
    return res.data as LeadCreateResult;
  } catch (e) {
    handleApiError(e);
  }
};

/** Farmer applies on an industrial buyer's posted demand — quote + T&C + MPIN,
 * the farmer's contact is revealed to the buyer (lead on the buyer's desk). */
export const applyToDemand = async (
  demandId: string,
  payload: { pricePerUnit: number; quantity: number; message?: string; termsAccepted: boolean; mpin?: string },
): Promise<LeadCreateResult> => {
  try {
    const res = await apiClient.post('/leads', {
      demandId,
      pricePerUnit: payload.pricePerUnit,
      quantity: payload.quantity,
      message: payload.message || undefined,
      termsAccepted: payload.termsAccepted,
      mpin: payload.mpin || undefined,
    });
    return res.data as LeadCreateResult;
  } catch (e) {
    handleApiError(e);
  }
};

export const getMyLeads = async (
  filter: 'received' | 'sent' = 'received',
  status?: LeadStatus,
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
  status: LeadStatus,
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
