import { post, put, readList, readOne } from './http';
import { MOCK_MILK_SLIPS } from './mocks';
import type { MilkCollectionSlip } from '../../types';

/**
 * Dairy namespace — farmer/demand side (flat) + dairy manager ops (`manager`).
 */
export const dairy = {
  // --- farmer / demand side ---
  /** GET /dairy/farmer/home */
  farmerHome: (): Promise<unknown> => readOne<unknown>('/dairy/farmer/home'),

  /** GET /dairy/dashboard */
  dashboard: (): Promise<unknown> => readOne<unknown>('/dairy/dashboard'),

  /** GET /dairy/farmer/ratings */
  farmerRatings: (): Promise<unknown> => readOne<unknown>('/dairy/farmer/ratings'),

  /** GET /dairy/ratings */
  ratings: (): Promise<unknown> => readOne<unknown>('/dairy/ratings'),

  /** GET /dairy/demands/browse */
  demandsBrowse: (): Promise<unknown[]> => readList<unknown[]>('/dairy/demands/browse'),

  /** GET /dairy/bids/browse */
  bidsBrowse: (): Promise<unknown[]> => readList<unknown[]>('/dairy/bids/browse'),

  /** GET /dairy/standing-orders */
  standingOrders: (): Promise<unknown[]> => readList<unknown[]>('/dairy/standing-orders'),

  /** POST /dairy/standing-orders */
  createStandingOrder: (payload: Record<string, unknown>): Promise<unknown> =>
    post<unknown>('/dairy/standing-orders', payload),

  /** PUT /dairy/standing-orders/{id} */
  updateStandingOrder: (orderId: string, updates: Record<string, unknown>): Promise<unknown> =>
    put<unknown>(`/dairy/standing-orders/${orderId}`, updates),

  /** POST /dairy/standing-orders/{id}/close */
  closeStandingOrder: (orderId: string): Promise<unknown> =>
    post<unknown>(`/dairy/standing-orders/${orderId}/close`),

  /** GET /dairy/standing/browse */
  standingBrowse: (): Promise<unknown[]> => readList<unknown[]>('/dairy/standing/browse'),

  /** GET /dairy/commission-structure */
  commissionStructure: (): Promise<unknown> => readOne<unknown>('/dairy/commission-structure'),

  /** GET /dairy/commission-statements */
  commissionStatements: (): Promise<unknown[]> => readList<unknown[]>('/dairy/commission-statements'),

  /** GET /dairy/purchases/{id}/receipt */
  purchaseReceipt: (purchaseId: string): Promise<unknown> =>
    readOne<unknown>(`/dairy/purchases/${purchaseId}/receipt`),

  /** GET /dairy/purchases/{id}/chat-room */
  purchaseChatRoom: (purchaseId: string): Promise<unknown> =>
    readOne<unknown>(`/dairy/purchases/${purchaseId}/chat-room`),

  /** POST /dairy/purchases/{id}/contract/esign */
  esignPurchaseContract: (purchaseId: string, payload: Record<string, unknown> = {}): Promise<unknown> =>
    post<unknown>(`/dairy/purchases/${purchaseId}/contract/esign`, payload),

  /** GET /dairy/collections/{collectionId}/otp */
  collectionOtp: (collectionId: string): Promise<{ otp: string }> =>
    readOne<{ otp: string }>(`/dairy/collections/${collectionId}/otp`),

  /** GET /dairy/dairies/{managerId} */
  dairyProfile: (managerId: string): Promise<unknown> =>
    readOne<unknown>(`/dairy/dairies/${managerId}`),

  /** GET /dairy/farmers/{farmerId} */
  farmer: (farmerId: string): Promise<unknown> => readOne<unknown>(`/dairy/farmers/${farmerId}`),

  /** GET /dairy/farmers/{farmerId}/reliability */
  farmerReliability: (farmerId: string): Promise<unknown> =>
    readOne<unknown>(`/dairy/farmers/${farmerId}/reliability`),

  /** Dairy manager ops — /dairy-manager. */
  manager: {
    /** GET /dairy-manager/analytics */
    analytics: (): Promise<unknown> => readOne<unknown>('/dairy-manager/analytics'),

    /** GET /dairy-manager/rate-chart */
    rateChart: (): Promise<unknown> => readOne<unknown>('/dairy-manager/rate-chart'),

    /** PUT /dairy-manager/rate-chart */
    updateRateChart: (payload: Record<string, unknown>): Promise<unknown> =>
      put<unknown>('/dairy-manager/rate-chart', payload),

    /** GET /dairy-manager/milk-slips */
    milkSlips: (): Promise<MilkCollectionSlip[]> =>
      readList<MilkCollectionSlip>('/dairy-manager/milk-slips', { mock: MOCK_MILK_SLIPS }),

    // members
    /** GET /livestock/dairy/members */
    members: (): Promise<unknown[]> => readList<unknown[]>('/livestock/dairy/members'),

    /** POST /livestock/dairy/members */
    addMember: (payload: Record<string, unknown>): Promise<unknown> =>
      post<unknown>('/livestock/dairy/members', payload),

    /** PUT /livestock/dairy/members/{id} */
    updateMember: (memberId: string, updates: Record<string, unknown>): Promise<unknown> =>
      put<unknown>(`/livestock/dairy/members/${memberId}`, updates),

    /** DELETE /livestock/dairy/members/{id} */
    removeMember: (memberId: string): Promise<{ success: boolean }> =>
      post<{ success: boolean }>(`/livestock/dairy/members/${memberId}`),

    /** GET /livestock/dairy/members/{id}/statement */
    memberStatement: (memberId: string): Promise<unknown> =>
      readOne<unknown>(`/livestock/dairy/members/${memberId}/statement`),

    // collection agents
    /** GET /livestock/dairy/agents */
    agents: (): Promise<unknown[]> => readList<unknown[]>('/livestock/dairy/agents'),

    /** POST /livestock/dairy/agents */
    addAgent: (payload: Record<string, unknown>): Promise<unknown> =>
      post<unknown>('/livestock/dairy/agents', payload),

    /** PUT /livestock/dairy/agents/{uid} */
    updateAgent: (agentUid: string, updates: Record<string, unknown>): Promise<unknown> =>
      put<unknown>(`/livestock/dairy/agents/${agentUid}`, updates),

    /** DELETE /livestock/dairy/agents/{uid} */
    removeAgent: (agentUid: string): Promise<{ success: boolean }> =>
      post<{ success: boolean }>(`/livestock/dairy/agents/${agentUid}`),

    // procurement / collections
    /** POST /dairy-manager/collection-check */
    collectionCheck: (payload: Record<string, unknown>): Promise<unknown> =>
      post<unknown>('/dairy-manager/collection-check', payload),

    /** GET /dairy-manager/collection-check */
    collectionChecks: (): Promise<unknown[]> => readList<unknown[]>('/dairy-manager/collection-check'),

    /** POST /dairy-manager/collections/otp/send */
    sendCollectionOtp: (payload: Record<string, unknown>): Promise<unknown> =>
      post<unknown>('/dairy-manager/collections/otp/send', payload),

    /** POST /dairy-manager/collections/otp/verify */
    verifyCollectionOtp: (payload: Record<string, unknown>): Promise<unknown> =>
      post<unknown>('/dairy-manager/collections/otp/verify', payload),

    /** POST /dairy-manager/collections/qr/scan */
    scanCollectionQr: (payload: Record<string, unknown>): Promise<unknown> =>
      post<unknown>('/dairy-manager/collections/qr/scan', payload),

    /** POST /dairy-manager/collections/{id}/flag-review */
    flagCollectionReview: (collectionId: string, payload: Record<string, unknown>): Promise<unknown> =>
      post<unknown>(`/dairy-manager/collections/${collectionId}/flag-review`, payload),

    // demands & bids
    /** GET /dairy-manager/demands */
    demands: (): Promise<unknown[]> => readList<unknown[]>('/dairy-manager/demands'),

    /** POST /dairy-manager/demands */
    createDemand: (payload: Record<string, unknown>): Promise<unknown> =>
      post<unknown>('/dairy-manager/demands', payload),

    /** GET /dairy-manager/bids */
    bids: (): Promise<unknown[]> => readList<unknown[]>('/dairy-manager/bids'),

    /** POST /dairy-manager/bids */
    createBid: (payload: Record<string, unknown>): Promise<unknown> =>
      post<unknown>('/dairy-manager/bids', payload),

    /** POST /dairy-manager/bids/{id}/counter */
    counterBid: (bidId: string, payload: Record<string, unknown>): Promise<unknown> =>
      post<unknown>(`/dairy-manager/bids/${bidId}/counter`, payload),

    /** POST /dairy-manager/bids/{id}/accept */
    acceptBid: (bidId: string): Promise<unknown> => post<unknown>(`/dairy-manager/bids/${bidId}/accept`),

    // routes & slots
    /** GET /dairy-manager/routes */
    routes: (): Promise<unknown[]> => readList<unknown[]>('/dairy-manager/routes'),

    /** POST /dairy-manager/routes */
    createRoute: (payload: Record<string, unknown>): Promise<unknown> =>
      post<unknown>('/dairy-manager/routes', payload),

    /** POST /dairy-manager/routes/{id}/status */
    updateRouteStatus: (routeId: string, status: string): Promise<unknown> =>
      post<unknown>(`/dairy-manager/routes/${routeId}/status`, { status }),

    /** GET /dairy-manager/pickup-slots */
    pickupSlots: (): Promise<unknown[]> => readList<unknown[]>('/dairy-manager/pickup-slots'),

    /** POST /dairy-manager/pickup-slots/{id}/book */
    bookPickupSlot: (slotId: string): Promise<unknown> =>
      post<unknown>(`/dairy-manager/pickup-slots/${slotId}/book`),

    // payments batches
    /** GET /livestock/dairy/payments/batches */
    paymentBatches: (): Promise<unknown[]> => readList<unknown[]>('/livestock/dairy/payments/batches'),

    /** POST /livestock/dairy/payments/batches */
    createPaymentBatch: (payload: Record<string, unknown>): Promise<unknown> =>
      post<unknown>('/livestock/dairy/payments/batches', payload),

    /** POST /livestock/dairy/payments/batches/{id}/mark-paid */
    markBatchPaid: (batchId: string): Promise<unknown> =>
      post<unknown>(`/livestock/dairy/payments/batches/${batchId}/mark-paid`),
  },
};
