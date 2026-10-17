import { download, del, post, put, readList, readOne } from './http';
import { MOCK_LAND_LEASES } from './mocks';
import type { LandLeaseListing } from '../../types';

/** Land & landlord namespace — plots, listings, lease requests/leases, rent, profit. */
export const land = {
  // --- summary & plots ---
  /** GET /land/summary */
  summary: (): Promise<unknown> => readOne<unknown>('/land/summary'),

  /** GET /land/plots */
  plots: (): Promise<unknown[]> => readList<unknown[]>('/land/plots'),

  /** POST /land/plots */
  addPlot: (payload: Record<string, unknown>): Promise<unknown> => post<unknown>('/land/plots', payload),

  /** PUT /land/plots/{id} */
  updatePlot: (plotId: string, updates: Record<string, unknown>): Promise<unknown> =>
    put<unknown>(`/land/plots/${plotId}`, updates),

  /** DELETE /land/plots/{id} */
  removePlot: (plotId: string): Promise<{ success: boolean }> =>
    del<{ success: boolean }>(`/land/plots/${plotId}`),

  /** POST /land/plots/{id}/expenses */
  addPlotExpense: (plotId: string, payload: Record<string, unknown>): Promise<unknown> =>
    post<unknown>(`/land/plots/${plotId}/expenses`, payload),

  /** GET /land/plots/{id}/expenses */
  plotExpenses: (plotId: string): Promise<unknown[]> =>
    readList<unknown[]>(`/land/plots/${plotId}/expenses`),

  // --- listings ---
  /** GET /land/listings */
  listings: (params?: Record<string, unknown>): Promise<LandLeaseListing[]> =>
    readList<LandLeaseListing>('/land/listings', { params }),

  /** GET /land/listings/mine */
  myListings: (): Promise<LandLeaseListing[]> =>
    readList<LandLeaseListing>('/land/listings/mine', { mock: MOCK_LAND_LEASES }),

  /** GET /land/listings/{id} */
  listing: (listingId: string): Promise<LandLeaseListing> =>
    readOne<LandLeaseListing>(`/land/listings/${listingId}`),

  /** POST /land/listings */
  createListing: (payload: Partial<LandLeaseListing>): Promise<LandLeaseListing> =>
    post<LandLeaseListing>('/land/listings', payload),

  /** PUT /land/listings/{id} */
  updateListing: (listingId: string, updates: Partial<LandLeaseListing>): Promise<LandLeaseListing> =>
    put<LandLeaseListing>(`/land/listings/${listingId}`, updates),

  /** DELETE /land/listings/{id} */
  removeListing: (listingId: string): Promise<{ success: boolean }> =>
    del<{ success: boolean }>(`/land/listings/${listingId}`),

  /** POST /land/listings/{id}/photos */
  addListingPhoto: (listingId: string, payload: Record<string, unknown>): Promise<unknown> =>
    post<unknown>(`/land/listings/${listingId}/photos`, payload),

  /** DELETE /land/listings/{id}/photos/{photoId} */
  removeListingPhoto: (listingId: string, photoId: string): Promise<{ success: boolean }> =>
    del<{ success: boolean }>(`/land/listings/${listingId}/photos/${photoId}`),

  /** PUT /land/listings/{id}/availability */
  setListingAvailability: (listingId: string, available: boolean): Promise<unknown> =>
    put<unknown>(`/land/listings/${listingId}/availability`, { available }),

  /** GET /land/price-suggestion */
  priceSuggestion: (params: Record<string, unknown>): Promise<unknown> =>
    readOne<unknown>('/land/price-suggestion', { params }),

  /** POST /land/listings/{id}/boost */
  boostListing: (listingId: string): Promise<unknown> => post<unknown>(`/land/listings/${listingId}/boost`),

  // --- lease requests (inbox) ---
  /** GET /land/lease-requests */
  leaseRequests: (params?: Record<string, unknown>): Promise<unknown[]> =>
    readList<unknown[]>('/land/lease-requests', { params }),

  /** GET /land/lease-requests/mine */
  myLeaseRequests: (): Promise<unknown[]> => readList<unknown[]>('/land/lease-requests/mine'),

  /** POST /land/lease-requests */
  createLeaseRequest: (payload: Record<string, unknown>): Promise<unknown> =>
    post<unknown>('/land/lease-requests', payload),

  /** POST /land/lease-requests/{id}/accept */
  acceptLeaseRequest: (requestId: string): Promise<unknown> =>
    post<unknown>(`/land/lease-requests/${requestId}/accept`),

  /** POST /land/lease-requests/{id}/reject */
  rejectLeaseRequest: (requestId: string, reason?: string): Promise<unknown> =>
    post<unknown>(`/land/lease-requests/${requestId}/reject`, reason ? { reason } : {}),

  /** POST /land/lease-requests/{id}/counter */
  counterLeaseRequest: (requestId: string, payload: Record<string, unknown>): Promise<unknown> =>
    post<unknown>(`/land/lease-requests/${requestId}/counter`, payload),

  // --- leads ---
  /** GET /land/leads */
  leads: (): Promise<unknown[]> => readList<unknown[]>('/land/leads'),

  /** POST /land/leads/{id}/status */
  setLeadStatus: (leadId: string, status: string): Promise<unknown> =>
    post<unknown>(`/land/leads/${leadId}/status`, { status }),

  /** POST /land/leads/{id}/notes */
  addLeadNote: (leadId: string, note: string): Promise<unknown> =>
    post<unknown>(`/land/leads/${leadId}/notes`, { note }),

  /** DELETE /land/leads/{id} */
  removeLead: (leadId: string): Promise<{ success: boolean }> =>
    del<{ success: boolean }>(`/land/leads/${leadId}`),

  // --- leases ---
  /** GET /land/leases */
  leases: (params?: Record<string, unknown>): Promise<unknown[]> =>
    readList<unknown[]>('/land/leases', { params }),

  /** GET /land/tenancies */
  tenancies: (): Promise<unknown[]> => readList<unknown[]>('/land/tenancies'),

  /** POST /land/leases */
  createLease: (payload: Record<string, unknown>): Promise<unknown> => post<unknown>('/land/leases', payload),

  /** PUT /land/leases/{id} */
  updateLease: (leaseId: string, updates: Record<string, unknown>): Promise<unknown> =>
    put<unknown>(`/land/leases/${leaseId}`, updates),

  /** DELETE /land/leases/{id} */
  removeLease: (leaseId: string): Promise<{ success: boolean }> =>
    del<{ success: boolean }>(`/land/leases/${leaseId}`),

  /** GET /land/leases/{id}/agreement-pdf — returns a Blob. */
  agreementPdf: (leaseId: string): Promise<Blob> => download(`/land/leases/${leaseId}/agreement-pdf`),

  /** GET /land/leases/{id}/ledger */
  leaseLedger: (leaseId: string): Promise<unknown> => readOne<unknown>(`/land/leases/${leaseId}/ledger`),

  /** GET /land/leases/{id}/milestones */
  leaseMilestones: (leaseId: string): Promise<unknown[]> =>
    readList<unknown[]>(`/land/leases/${leaseId}/milestones`),

  /** POST /land/leases/{id}/milestones */
  addLeaseMilestone: (leaseId: string, payload: Record<string, unknown>): Promise<unknown> =>
    post<unknown>(`/land/leases/${leaseId}/milestones`, payload),

  /** POST /land/leases/{id}/milestones/{index}/release */
  releaseMilestone: (leaseId: string, index: number): Promise<unknown> =>
    post<unknown>(`/land/leases/${leaseId}/milestones/${index}/release`),

  /** POST /land/leases/{id}/esign */
  esignLease: (leaseId: string, payload: Record<string, unknown> = {}): Promise<unknown> =>
    post<unknown>(`/land/leases/${leaseId}/esign`, payload),

  /** POST /land/leases/{id}/escrow/fund */
  fundLeaseEscrow: (leaseId: string, payload: Record<string, unknown> = {}): Promise<unknown> =>
    post<unknown>(`/land/leases/${leaseId}/escrow/fund`, payload),

  /** POST /land/leases/{id}/renew */
  renewLease: (leaseId: string, payload: Record<string, unknown> = {}): Promise<unknown> =>
    post<unknown>(`/land/leases/${leaseId}/renew`, payload),

  /** GET /land/leases/{id}/renewals */
  leaseRenewals: (leaseId: string): Promise<unknown[]> =>
    readList<unknown[]>(`/land/leases/${leaseId}/renewals`),

  /** POST /land/lease-renewals/{id}/respond */
  respondRenewal: (renewalId: string, payload: Record<string, unknown>): Promise<unknown> =>
    post<unknown>(`/land/lease-renewals/${renewalId}/respond`, payload),

  /** POST /land/leases/{id}/terminate */
  terminateLease: (leaseId: string, reason?: string): Promise<unknown> =>
    post<unknown>(`/land/leases/${leaseId}/terminate`, reason ? { reason } : {}),

  /** POST /land/leases/{id}/handover */
  leaseHandover: (leaseId: string, payload: Record<string, unknown> = {}): Promise<unknown> =>
    post<unknown>(`/land/leases/${leaseId}/handover`, payload),

  /** GET /land/leases/{id}/handover */
  leaseHandoverStatus: (leaseId: string): Promise<unknown> =>
    readOne<unknown>(`/land/leases/${leaseId}/handover`),

  /** POST /land/leases/{id}/disputes */
  openLeaseDispute: (leaseId: string, payload: Record<string, unknown>): Promise<unknown> =>
    post<unknown>(`/land/leases/${leaseId}/disputes`, payload),

  /** POST /land/leases/{id}/chat-room */
  leaseChatRoom: (leaseId: string): Promise<unknown> =>
    post<unknown>(`/land/leases/${leaseId}/chat-room`),

  /** POST /land/leases/{id}/harvest-declarations */
  addHarvestDeclaration: (leaseId: string, payload: Record<string, unknown>): Promise<unknown> =>
    post<unknown>(`/land/leases/${leaseId}/harvest-declarations`, payload),

  /** GET /land/leases/{id}/harvest-declarations */
  harvestDeclarations: (leaseId: string): Promise<unknown[]> =>
    readList<unknown[]>(`/land/leases/${leaseId}/harvest-declarations`),

  /** POST /land/leases/{id}/harvest-declarations/{declId}/settle */
  settleHarvestDeclaration: (leaseId: string, declId: string): Promise<unknown> =>
    post<unknown>(`/land/leases/${leaseId}/harvest-declarations/${declId}/settle`),

  // --- rent ---
  /** GET /land/rent/dues */
  rentDues: (): Promise<unknown[]> => readList<unknown[]>('/land/rent/dues'),

  /** POST /land/leases/{id}/payments */
  recordRentPayment: (leaseId: string, payload: Record<string, unknown>): Promise<unknown> =>
    post<unknown>(`/land/leases/${leaseId}/payments`, payload),

  /** GET /land/leases/{id}/payments */
  rentPayments: (leaseId: string): Promise<unknown[]> =>
    readList<unknown[]>(`/land/leases/${leaseId}/payments`),

  /** GET /land/rent-payments/{paymentId}/receipt */
  rentReceipt: (paymentId: string): Promise<unknown> =>
    readOne<unknown>(`/land/rent-payments/${paymentId}/receipt`),

  // --- analytics & settlements ---
  /** GET /land/analytics */
  analytics: (): Promise<unknown> => readOne<unknown>('/land/analytics'),

  /** GET /land/profit-dashboard */
  profitDashboard: (): Promise<unknown> => readOne<unknown>('/land/profit-dashboard'),

  /** GET /land/profit-dashboard/export */
  profitExport: (): Promise<unknown> => readOne<unknown>('/land/profit-dashboard/export'),

  /** GET /land/settlements */
  settlements: (): Promise<unknown[]> => readList<unknown[]>('/land/settlements'),

  // --- saved/waitlist ---
  /** POST /land/listings/{id}/save */
  saveListing: (listingId: string): Promise<unknown> => post<unknown>(`/land/listings/${listingId}/save`),

  /** DELETE /land/listings/{id}/save */
  unsaveListing: (listingId: string): Promise<{ success: boolean }> =>
    del<{ success: boolean }>(`/land/listings/${listingId}/save`),

  /** GET /land/saved-listings */
  savedListings: (): Promise<LandLeaseListing[]> =>
    readList<LandLeaseListing>('/land/saved-listings', { mock: MOCK_LAND_LEASES }),

  /** POST /land/listings/{id}/waitlist */
  joinWaitlist: (listingId: string): Promise<unknown> =>
    post<unknown>(`/land/listings/${listingId}/waitlist`),

  /** GET /land/waitlist/mine */
  myWaitlist: (): Promise<unknown[]> => readList<unknown[]>('/land/waitlist/mine'),

  /** POST /land/listings/{id}/reviews */
  reviewListing: (listingId: string, payload: Record<string, unknown>): Promise<unknown> =>
    post<unknown>(`/land/listings/${listingId}/reviews`, payload),
};
