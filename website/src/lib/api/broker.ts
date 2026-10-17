import { del, post, put, readList, readOne } from './http';

/**
 * Broker (Dalal) namespace — deals, leads, commissions, trust tier.
 * `farmerDeals` covers the farmer side of brokered deals.
 */
export const broker = {
  // --- dashboard ---
  /** GET /broker/dashboard */
  dashboard: (): Promise<unknown> => readOne<unknown>('/broker/dashboard'),

  /** GET /broker/trust-tier */
  trustTier: (): Promise<unknown> => readOne<unknown>('/broker/trust-tier'),

  /** GET /broker/commissions */
  commissions: (params?: Record<string, unknown>): Promise<unknown[]> =>
    readList<unknown[]>('/broker/commissions', { params }),

  /** GET /broker/settlements */
  settlements: (params?: Record<string, unknown>): Promise<unknown[]> =>
    readList<unknown[]>('/broker/settlements', { params }),

  // --- deals ---
  /** GET /broker/deals */
  deals: (params?: Record<string, unknown>): Promise<unknown[]> =>
    readList<unknown[]>('/broker/deals', { params }),

  /** POST /broker/deals */
  createDeal: (payload: Record<string, unknown>): Promise<unknown> => post<unknown>('/broker/deals', payload),

  /** GET /broker/deals/{id} */
  deal: (dealId: string): Promise<unknown> => readOne<unknown>(`/broker/deals/${dealId}`),

  /** PUT /broker/deals/{id} */
  updateDeal: (dealId: string, updates: Record<string, unknown>): Promise<unknown> =>
    put<unknown>(`/broker/deals/${dealId}`, updates),

  /** DELETE /broker/deals/{id} */
  deleteDeal: (dealId: string): Promise<{ success: boolean }> =>
    del<{ success: boolean }>(`/broker/deals/${dealId}`),

  /** GET /broker/deals/{id}/messages */
  dealMessages: (dealId: string): Promise<unknown[]> =>
    readList<unknown[]>(`/broker/deals/${dealId}/messages`),

  /** POST /broker/deals/{id}/messages */
  postDealMessage: (dealId: string, payload: Record<string, unknown>): Promise<unknown> =>
    post<unknown>(`/broker/deals/${dealId}/messages`, payload),

  /** POST /broker/deals/{id}/evidence */
  addDealEvidence: (dealId: string, payload: Record<string, unknown>): Promise<unknown> =>
    post<unknown>(`/broker/deals/${dealId}/evidence`, payload),

  /** GET /broker/deals/{id}/vault */
  dealVault: (dealId: string): Promise<unknown> => readOne<unknown>(`/broker/deals/${dealId}/vault`),

  /** POST /broker/deals/{id}/payment-capture */
  capturePayment: (dealId: string, payload: Record<string, unknown>): Promise<unknown> =>
    post<unknown>(`/broker/deals/${dealId}/payment-capture`, payload),

  /** POST /broker/deals/{id}/release-payout */
  releasePayout: (dealId: string, payload: Record<string, unknown> = {}): Promise<unknown> =>
    post<unknown>(`/broker/deals/${dealId}/release-payout`, payload),

  /** POST /broker/deals/{id}/escalate */
  escalateDeal: (dealId: string, reason?: string): Promise<unknown> =>
    post<unknown>(`/broker/deals/${dealId}/escalate`, reason ? { reason } : {}),

  /** GET /broker/deals/{id}/milestones */
  dealMilestones: (dealId: string): Promise<unknown[]> =>
    readList<unknown[]>(`/broker/deals/${dealId}/milestones`),

  /** POST /broker/deals/{id}/milestones */
  addDealMilestone: (dealId: string, payload: Record<string, unknown>): Promise<unknown> =>
    post<unknown>(`/broker/deals/${dealId}/milestones`, payload),

  /** POST /broker/deals/{id}/chat-room */
  dealChatRoom: (dealId: string): Promise<unknown> => post<unknown>(`/broker/deals/${dealId}/chat-room`),

  /** PUT /broker/deals/{id}/vehicle */
  setDealVehicle: (dealId: string, payload: Record<string, unknown>): Promise<unknown> =>
    put<unknown>(`/broker/deals/${dealId}/vehicle`, payload),

  /** GET /broker/deals/{id}/contract */
  dealContract: (dealId: string): Promise<unknown> => readOne<unknown>(`/broker/deals/${dealId}/contract`),

  /** GET /broker/deals/{id}/receipt */
  dealReceipt: (dealId: string): Promise<unknown> => readOne<unknown>(`/broker/deals/${dealId}/receipt`),

  // --- disputes ---
  /** GET /broker/deals/{id}/disputes */
  dealDisputes: (dealId: string): Promise<unknown[]> =>
    readList<unknown[]>(`/broker/deals/${dealId}/disputes`),

  /** POST /broker/deals/{id}/disputes */
  openDealDispute: (dealId: string, payload: Record<string, unknown>): Promise<unknown> =>
    post<unknown>(`/broker/deals/${dealId}/disputes`, payload),

  // --- leads ---
  /** GET /broker/leads */
  leads: (params?: Record<string, unknown>): Promise<unknown[]> =>
    readList<unknown[]>('/broker/leads', { params }),

  /** POST /broker/leads */
  createLead: (payload: Record<string, unknown>): Promise<unknown> => post<unknown>('/broker/leads', payload),

  /** PUT /broker/leads/{id} */
  updateLead: (leadId: string, updates: Record<string, unknown>): Promise<unknown> =>
    put<unknown>(`/broker/leads/${leadId}`, updates),

  /** DELETE /broker/leads/{id} */
  deleteLead: (leadId: string): Promise<{ success: boolean }> =>
    del<{ success: boolean }>(`/broker/leads/${leadId}`),

  // --- buyer requirements ---
  /** GET /broker/buyer-requirements */
  buyerRequirements: (): Promise<unknown[]> => readList<unknown[]>('/broker/buyer-requirements'),

  /** POST /broker/buyer-requirements */
  createBuyerRequirement: (payload: Record<string, unknown>): Promise<unknown> =>
    post<unknown>('/broker/buyer-requirements', payload),

  /** POST /broker/buyer-requirements/{id}/respond */
  respondBuyerRequirement: (requirementId: string, payload: Record<string, unknown>): Promise<unknown> =>
    post<unknown>(`/broker/buyer-requirements/${requirementId}/respond`, payload),

  /** Farmer-side brokered deals — /farmer/deals. */
  farmerDeals: {
    /** GET /farmer/deals */
    list: (): Promise<unknown[]> => readList<unknown[]>('/farmer/deals'),

    /** GET /farmer/deals/{id} */
    get: (dealId: string): Promise<unknown> => readOne<unknown>(`/farmer/deals/${dealId}`),

    /** GET /farmer/deals/{id}/messages */
    messages: (dealId: string): Promise<unknown[]> =>
      readList<unknown[]>(`/farmer/deals/${dealId}/messages`),

    /** POST /farmer/deals/{id}/messages */
    postMessage: (dealId: string, payload: Record<string, unknown>): Promise<unknown> =>
      post<unknown>(`/farmer/deals/${dealId}/messages`, payload),

    /** POST /farmer/deals/{id}/respond */
    respond: (dealId: string, payload: Record<string, unknown>): Promise<unknown> =>
      post<unknown>(`/farmer/deals/${dealId}/respond`, payload),

    /** POST /farmer/deals/{id}/accept */
    accept: (dealId: string, payload: Record<string, unknown> = {}): Promise<unknown> =>
      post<unknown>(`/farmer/deals/${dealId}/accept`, payload),

    /** POST /farmer/deals/{id}/evidence */
    addEvidence: (dealId: string, payload: Record<string, unknown>): Promise<unknown> =>
      post<unknown>(`/farmer/deals/${dealId}/evidence`, payload),

    /** GET /farmer/deals/{id}/vault */
    vault: (dealId: string): Promise<unknown> => readOne<unknown>(`/farmer/deals/${dealId}/vault`),

    /** GET /farmer/deals/{id}/milestones */
    milestones: (dealId: string): Promise<unknown[]> =>
      readList<unknown[]>(`/farmer/deals/${dealId}/milestones`),

    /** POST /farmer/deals/{id}/disputes */
    openDispute: (dealId: string, payload: Record<string, unknown>): Promise<unknown> =>
      post<unknown>(`/farmer/deals/${dealId}/disputes`, payload),
  },
};
