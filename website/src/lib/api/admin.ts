import { del, patch, post, put, readItems, readList, readOne } from './http';

/**
 * Admin namespace — SOP-01…27 grouped admin calls.
 *
 * CONVENTION: every MUTATING method accepts an optional trailing `reason`
 * string and sends it as the `X-Audit-Reason` header (required by the
 * backend admin_mutation_context). Example:
 *   admin.users.setStatus(uid, { status: 'suspended' }, 'Spam reports');
 */

type Reason = string | undefined;
const audit = (reason: Reason) =>
  reason ? { headers: { 'X-Audit-Reason': reason } } : undefined;

export const admin = {
  // ===== SOP-01/02/13 user & security management =====
  users: {
    /** GET /admin/users */
    list: (params?: Record<string, unknown>): Promise<unknown[]> =>
      readList<unknown[]>('/admin/users', { params }),
    /** GET /admin/users/{uid} */
    get: (uid: string): Promise<unknown> => readOne<unknown>(`/admin/users/${uid}`),
    /** GET /admin/auth/users */
    authUsers: (params?: Record<string, unknown>): Promise<unknown[]> =>
      readList<unknown[]>('/admin/auth/users', { params }),
    /** POST /admin/users/{uid}/status */
    setStatus: (uid: string, payload: Record<string, unknown>, reason?: Reason): Promise<unknown> =>
      post<unknown>(`/admin/users/${uid}/status`, payload, audit(reason)),
    /** PUT /admin/users/{uid}/status */
    updateStatus: (uid: string, payload: Record<string, unknown>, reason?: Reason): Promise<unknown> =>
      put<unknown>(`/admin/users/${uid}/status`, payload, audit(reason)),
    /** PUT /admin/users/{uid}/personas */
    setPersonas: (uid: string, personas: string[], reason?: Reason): Promise<unknown> =>
      put<unknown>(`/admin/users/${uid}/personas`, { personas }, audit(reason)),
    /** GET /admin/users/{uid}/role-profiles */
    roleProfiles: (uid: string): Promise<unknown> => readOne<unknown>(`/admin/users/${uid}/role-profiles`),
    /** GET /admin/users/{uid}/farm-map */
    farmMap: (uid: string): Promise<unknown> => readOne<unknown>(`/admin/users/${uid}/farm-map`),
    /** GET /admin/users/export */
    export: (): Promise<unknown> => readOne<unknown>('/admin/users/export'),
    /** POST /admin/auth/users/{uid}/reset-mpin */
    resetMpin: (uid: string, reason?: Reason): Promise<unknown> =>
      post<unknown>(`/admin/auth/users/${uid}/reset-mpin`, undefined, audit(reason)),
    /** POST /admin/auth/users/{uid}/revoke-sessions */
    revokeSessions: (uid: string, reason?: Reason): Promise<unknown> =>
      post<unknown>(`/admin/auth/users/${uid}/revoke-sessions`, undefined, audit(reason)),
    /** GET /admin/auth/security-policy */
    securityPolicy: (): Promise<unknown> => readOne<unknown>('/admin/auth/security-policy'),
    /** PUT /admin/auth/security-policy */
    updateSecurityPolicy: (payload: Record<string, unknown>, reason?: Reason): Promise<unknown> =>
      put<unknown>('/admin/auth/security-policy', payload, audit(reason)),
    /** GET /admin/consents/{uid} */
    consents: (uid: string): Promise<unknown> => readOne<unknown>(`/admin/consents/${uid}`),
    /** POST /admin/verify-mpin — step-up verification. */
    verifyMpin: (mpin: string): Promise<unknown> => post<unknown>('/admin/verify-mpin', { mpin }),
  },

  // ===== SOP-03 KYC desk =====
  kyc: {
    /** GET /admin/kyc/queue */
    queue: (params?: Record<string, unknown>): Promise<unknown[]> =>
      readList<unknown[]>('/admin/kyc/queue', { params }),
    /** GET /admin/kyc/pending */
    pending: (): Promise<unknown[]> => readList<unknown[]>('/admin/kyc/pending'),
    /** GET /admin/kyc/history */
    history: (params?: Record<string, unknown>): Promise<unknown[]> =>
      readList<unknown[]>('/admin/kyc/history', { params }),
    /** POST /admin/kyc/{docId}/review */
    review: (docId: string, payload: Record<string, unknown>, reason?: Reason): Promise<unknown> =>
      post<unknown>(`/admin/kyc/${docId}/review`, payload, audit(reason)),
    /** POST /admin/kyc/{docId}/verify */
    verify: (docId: string, reason?: Reason): Promise<unknown> =>
      post<unknown>(`/admin/kyc/${docId}/verify`, undefined, audit(reason)),
    /** POST /admin/kyc/{docId}/reject */
    reject: (docId: string, payload: Record<string, unknown>, reason?: Reason): Promise<unknown> =>
      post<unknown>(`/admin/kyc/${docId}/reject`, payload, audit(reason)),
    /** POST /admin/kyc/{docId}/request-more — doc moves to resubmission_requested */
    requestMore: (docId: string, payload: Record<string, unknown>, reason?: Reason): Promise<unknown> =>
      post<unknown>(`/admin/kyc/${docId}/request-more`, payload, audit(reason)),
  },

  // ===== SOP-04 rates & mandi ops =====
  rates: {
    /** GET /admin/rates/pending */
    pending: (): Promise<unknown[]> => readList<unknown[]>('/admin/rates/pending'),
    /** GET /admin/rates/flagged */
    flagged: (): Promise<unknown[]> => readList<unknown[]>('/admin/rates/flagged'),
    /** POST /admin/rates/{rateId}/approve */
    approve: (rateId: string, reason?: Reason): Promise<unknown> =>
      post<unknown>(`/admin/rates/${rateId}/approve`, undefined, audit(reason)),
    /** POST /admin/rates/{rateId}/reject */
    reject: (rateId: string, payload: Record<string, unknown>, reason?: Reason): Promise<unknown> =>
      post<unknown>(`/admin/rates/${rateId}/reject`, payload, audit(reason)),
    /** GET /admin/mandi/rates */
    mandiRates: (params?: Record<string, unknown>): Promise<unknown[]> =>
      readList<unknown[]>('/admin/mandi/rates', { params }),
    /** POST /admin/mandi/rates */
    createMandiRate: (payload: Record<string, unknown>, reason?: Reason): Promise<unknown> =>
      post<unknown>('/admin/mandi/rates', payload, audit(reason)),
    /** POST /admin/mandi/rates/{rateId}/approve */
    approveMandiRate: (rateId: string, reason?: Reason): Promise<unknown> =>
      post<unknown>(`/admin/mandi/rates/${rateId}/approve`, undefined, audit(reason)),
    /** POST /admin/mandi/rates/{rateId}/reject */
    rejectMandiRate: (rateId: string, payload: Record<string, unknown>, reason?: Reason): Promise<unknown> =>
      post<unknown>(`/admin/mandi/rates/${rateId}/reject`, payload, audit(reason)),
    /** POST /admin/mandi/sync */
    syncMandi: (reason?: Reason): Promise<unknown> => post<unknown>('/admin/mandi/sync', undefined, audit(reason)),
  },

  // ===== SOP-05/06 marketplace & lots ops =====
  marketplace: {
    /** GET /admin/lots */
    lots: (params?: Record<string, unknown>): Promise<unknown[]> =>
      readList<unknown[]>('/admin/lots', { params }),
    /** PUT /admin/lots/{lotId}/status */
    setLotStatus: (lotId: string, status: string, reason?: Reason): Promise<unknown> =>
      put<unknown>(`/admin/lots/${lotId}/status`, { status }, audit(reason)),
    /** POST /admin/market/lots/{lotId}/moderate — {action: approve|reject|takedown, reason?} */
    moderateLot: (lotId: string, payload: Record<string, unknown>, reason?: Reason): Promise<unknown> =>
      post<unknown>(`/admin/market/lots/${lotId}/moderate`, payload, audit(reason)),
    /** GET /admin/orders */
    orders: (params?: Record<string, unknown>): Promise<unknown[]> =>
      readList<unknown[]>('/admin/orders', { params }),
    /** POST /admin/orders/{orderId}/refund */
    refundOrder: (orderId: string, payload: Record<string, unknown>, reason?: Reason): Promise<unknown> =>
      post<unknown>(`/admin/orders/${orderId}/refund`, payload, audit(reason)),
    /** GET /admin/marketplace/products */
    products: (params?: Record<string, unknown>): Promise<unknown[]> =>
      readList<unknown[]>('/admin/marketplace/products', { params }),
    /** POST /admin/marketplace/products */
    createProduct: (payload: Record<string, unknown>, reason?: Reason): Promise<unknown> =>
      post<unknown>('/admin/marketplace/products', payload, audit(reason)),
    /** PUT /admin/marketplace/products/{id} */
    updateProduct: (productId: string, updates: Record<string, unknown>, reason?: Reason): Promise<unknown> =>
      put<unknown>(`/admin/marketplace/products/${productId}`, updates, audit(reason)),
    /** GET /admin/marketplace/orders */
    marketplaceOrders: (params?: Record<string, unknown>): Promise<unknown[]> =>
      readList<unknown[]>('/admin/marketplace/orders', { params }),
    /** POST /admin/marketplace/products/{id}/certificates */
    addProductCertificate: (productId: string, payload: Record<string, unknown>, reason?: Reason): Promise<unknown> =>
      post<unknown>(`/admin/marketplace/products/${productId}/certificates`, payload, audit(reason)),
    /** GET /admin/sellers — seller persona registry with product/order/revenue rollups */
    sellers: (params?: Record<string, unknown>): Promise<unknown[]> =>
      readList<unknown[]>('/admin/sellers', { params }),
    /** GET /admin/marketplace/categories */
    categories: (): Promise<unknown[]> => readList<unknown[]>('/admin/marketplace/categories'),
    /** POST /admin/marketplace/categories */
    createCategory: (payload: Record<string, unknown>, reason?: Reason): Promise<unknown> =>
      post<unknown>('/admin/marketplace/categories', payload, audit(reason)),
    /** PUT /admin/marketplace/categories/{categoryId} */
    updateCategory: (categoryId: string, payload: Record<string, unknown>, reason?: Reason): Promise<unknown> =>
      put<unknown>(`/admin/marketplace/categories/${categoryId}`, payload, audit(reason)),
    /** DELETE /admin/marketplace/categories/{categoryId} — soft delete (active=false) */
    deleteCategory: (categoryId: string, reason?: Reason): Promise<unknown> =>
      del<unknown>(`/admin/marketplace/categories/${categoryId}`, audit(reason)),
  },

  // ===== SOP-07 disputes desk =====
  disputes: {
    /** GET /admin/disputes */
    list: (params?: Record<string, unknown>): Promise<unknown[]> =>
      readList<unknown[]>('/admin/disputes', { params }),
    /** GET /admin/disputes/{id} */
    get: (disputeId: string): Promise<unknown> => readOne<unknown>(`/admin/disputes/${disputeId}`),
    /** POST /admin/disputes/{id}/resolve */
    resolve: (disputeId: string, payload: Record<string, unknown>, reason?: Reason): Promise<unknown> =>
      post<unknown>(`/admin/disputes/${disputeId}/resolve`, payload, audit(reason)),
    /** POST /admin/disputes/{id}/settlement */
    settle: (disputeId: string, payload: Record<string, unknown>, reason?: Reason): Promise<unknown> =>
      post<unknown>(`/admin/disputes/${disputeId}/settlement`, payload, audit(reason)),
  },

  // ===== SOP-08 dispatch board =====
  dispatch: {
    /** GET /admin/transport/bookings */
    bookings: (params?: Record<string, unknown>): Promise<unknown[]> =>
      readList<unknown[]>('/admin/transport/bookings', { params }),
    /** GET /admin/transport/bookings/{bookingId} — full trip detail: offers, expenses, waypointsLog, pod photos */
    booking: (bookingId: string): Promise<unknown> =>
      readOne<unknown>(`/admin/transport/bookings/${bookingId}`),
    /** PUT /admin/transport/bookings/{id}/status */
    setBookingStatus: (bookingId: string, status: string, reason?: Reason): Promise<unknown> =>
      put<unknown>(`/admin/transport/bookings/${bookingId}/status`, { status }, audit(reason)),
    /** GET /admin/transport/drivers */
    drivers: (params?: Record<string, unknown>): Promise<unknown[]> =>
      readList<unknown[]>('/admin/transport/drivers', { params }),
    /** GET /admin/transport/vehicles */
    vehicles: (params?: Record<string, unknown>): Promise<unknown[]> =>
      readList<unknown[]>('/admin/transport/vehicles', { params }),
    /** POST /admin/transport/vehicles/{id}/verify */
    verifyVehicle: (vehicleId: string, reason?: Reason): Promise<unknown> =>
      post<unknown>(`/admin/transport/vehicles/${vehicleId}/verify`, undefined, audit(reason)),
    /** POST /admin/transport/transporters/{id}/suspend */
    suspendTransporter: (transporterId: string, payload: Record<string, unknown>, reason?: Reason): Promise<unknown> =>
      post<unknown>(`/admin/transport/transporters/${transporterId}/suspend`, payload, audit(reason)),
    /** GET /admin/transport/pricing-rules */
    pricingRules: (): Promise<unknown> => readOne<unknown>('/admin/transport/pricing-rules'),
    /** PUT /admin/transport/pricing-rules */
    updatePricingRules: (payload: Record<string, unknown>, reason?: Reason): Promise<unknown> =>
      put<unknown>('/admin/transport/pricing-rules', payload, audit(reason)),
    /** GET /admin/platform-config/grace-window */
    graceWindow: (): Promise<unknown> => readOne<unknown>('/admin/platform-config/grace-window'),
    /** PUT /admin/platform-config/grace-window */
    updateGraceWindow: (payload: Record<string, unknown>, reason?: Reason): Promise<unknown> =>
      put<unknown>('/admin/platform-config/grace-window', payload, audit(reason)),
    /** GET /admin/exceptions/pickup — bookings stuck past the pickup grace window */
    pickupExceptions: (): Promise<unknown[]> => readList<unknown[]>('/admin/exceptions/pickup'),
  },

  // ===== pickup agent registry (SOP-08 dispatch desk) =====
  pickupAgents: {
    /** GET /admin/pickup-agents */
    list: (params?: Record<string, unknown>): Promise<unknown[]> =>
      readList<unknown[]>('/admin/pickup-agents', { params }),
    /** POST /admin/pickup-agents */
    create: (payload: Record<string, unknown>, reason?: Reason): Promise<unknown> =>
      post<unknown>('/admin/pickup-agents', payload, audit(reason)),
    /** PATCH /admin/pickup-agents/{agentId} */
    update: (agentId: string, updates: Record<string, unknown>, reason?: Reason): Promise<unknown> =>
      patch<unknown>(`/admin/pickup-agents/${agentId}`, updates, audit(reason)),
  },

  // ===== SOP-09 equipment ops =====
  equipment: {
    /** GET /admin/equipment */
    list: (params?: Record<string, unknown>): Promise<unknown[]> =>
      readList<unknown[]>('/admin/equipment', { params }),
    /** PUT /admin/equipment/{id}/verify */
    verify: (equipmentId: string, reason?: Reason): Promise<unknown> =>
      put<unknown>(`/admin/equipment/${equipmentId}/verify`, undefined, audit(reason)),
    /** GET /admin/equipment/bookings */
    bookings: (params?: Record<string, unknown>): Promise<unknown[]> =>
      readList<unknown[]>('/admin/equipment/bookings', { params }),
    /** POST /admin/equipment/bookings/{id}/escalate */
    escalateBooking: (bookingId: string, payload: Record<string, unknown>, reason?: Reason): Promise<unknown> =>
      post<unknown>(`/admin/equipment/bookings/${bookingId}/escalate`, payload, audit(reason)),
    /** DELETE /admin/equipment/bookings/{id} */
    deleteBooking: (bookingId: string, reason?: Reason): Promise<unknown> =>
      del<unknown>(`/admin/equipment/bookings/${bookingId}`, audit(reason)),
  },

  // ===== SOP-10/16/17/18/19/23/24 field-ops sweep panels =====
  fieldOps: {
    /** GET /admin/diary/entries */
    diaryEntries: (params?: Record<string, unknown>): Promise<unknown[]> =>
      readList<unknown[]>('/admin/diary/entries', { params }),
    /** GET /admin/diary/summary */
    diarySummary: (): Promise<unknown> => readOne<unknown>('/admin/diary/summary'),
    /** GET /admin/land/leases */
    landLeases: (params?: Record<string, unknown>): Promise<unknown[]> =>
      readList<unknown[]>('/admin/land/leases', { params }),
    /** GET /admin/land/listings */
    landListings: (params?: Record<string, unknown>): Promise<unknown[]> =>
      readList<unknown[]>('/admin/land/listings', { params }),
    /** GET /admin/land/leases/{id}/agreement */
    leaseAgreement: (leaseId: string): Promise<unknown> =>
      readOne<unknown>(`/admin/land/leases/${leaseId}/agreement`),
    /** PUT /admin/land/leases/{id}/terminate */
    terminateLease: (leaseId: string, payload: Record<string, unknown>, reason?: Reason): Promise<unknown> =>
      put<unknown>(`/admin/land/leases/${leaseId}/terminate`, payload, audit(reason)),
    /** GET /admin/advisory/scans */
    advisoryScans: (params?: Record<string, unknown>): Promise<unknown[]> =>
      readList<unknown[]>('/admin/advisory/scans', { params }),
    /** GET /admin/advisory/scans/accuracy */
    advisoryAccuracy: (): Promise<unknown> => readOne<unknown>('/admin/advisory/scans/accuracy'),
    /** POST /admin/advisory/pest-alerts */
    broadcastPestAlert: (payload: Record<string, unknown>, reason?: Reason): Promise<unknown> =>
      post<unknown>('/admin/advisory/pest-alerts', payload, audit(reason)),
    /** GET /admin/advisory/soil-tests */
    soilTests: (params?: Record<string, unknown>): Promise<unknown[]> =>
      readList<unknown[]>('/admin/advisory/soil-tests', { params }),
    /** POST /admin/advisory/soil-tests/{id}/validate */
    validateSoilTest: (testId: string, payload: Record<string, unknown>, reason?: Reason): Promise<unknown> =>
      post<unknown>(`/admin/advisory/soil-tests/${testId}/validate`, payload, audit(reason)),
    /** GET /admin/soil-tests */
    soilTestsAlt: (params?: Record<string, unknown>): Promise<unknown[]> =>
      readList<unknown[]>('/admin/soil-tests', { params }),
    /** POST /admin/soil-tests/{id}/results */
    submitSoilResults: (testId: string, payload: Record<string, unknown>, reason?: Reason): Promise<unknown> =>
      post<unknown>(`/admin/soil-tests/${testId}/results`, payload, audit(reason)),
    /** GET /admin/land-records/health */
    landRecordsHealth: (): Promise<unknown> => readOne<unknown>('/admin/land-records/health'),
    /** GET /admin/land-records/status */
    landRecordsStatus: (): Promise<unknown> => readOne<unknown>('/admin/land-records/status'),
    /** POST /admin/land-records/seed */
    seedLandRecords: (payload: Record<string, unknown>, reason?: Reason): Promise<unknown> =>
      post<unknown>('/admin/land-records/seed', payload, audit(reason)),
    /** GET /admin/land-records/audit-log */
    landRecordsAuditLog: (params?: Record<string, unknown>): Promise<unknown[]> =>
      readList<unknown[]>('/admin/land-records/audit-log', { params }),
    /** GET /admin/land-records/config — apiKey is write-only; reads return apiKeyMasked */
    landRecordsConfig: (): Promise<unknown> => readOne<unknown>('/admin/land-records/config'),
    /** PUT /admin/land-records/config */
    updateLandRecordsConfig: (payload: Record<string, unknown>, reason?: Reason): Promise<unknown> =>
      put<unknown>('/admin/land-records/config', payload, audit(reason)),
    /** GET /admin/water/schedules */
    waterSchedules: (): Promise<unknown[]> => readList<unknown[]>('/admin/water/schedules'),
    /** PUT /admin/water/schedules/{id} */
    updateWaterSchedule: (scheduleId: string, payload: Record<string, unknown>, reason?: Reason): Promise<unknown> =>
      put<unknown>(`/admin/water/schedules/${scheduleId}`, payload, audit(reason)),
    /** GET /admin/climate/varieties */
    climateVarieties: (): Promise<unknown[]> => readList<unknown[]>('/admin/climate/varieties'),
  },

  // ===== SOP-11/12/13 advisory & content =====
  content: {
    /** GET /admin/content/news */
    news: (params?: Record<string, unknown>): Promise<unknown[]> =>
      readList<unknown[]>('/admin/content/news', { params }),
    /** POST /admin/content/news */
    createNews: (payload: Record<string, unknown>, reason?: Reason): Promise<unknown> =>
      post<unknown>('/admin/content/news', payload, audit(reason)),
    /** PUT /admin/content/news/{id} */
    updateNews: (newsId: string, updates: Record<string, unknown>, reason?: Reason): Promise<unknown> =>
      put<unknown>(`/admin/content/news/${newsId}`, updates, audit(reason)),
    /** POST /admin/content/channels/{id}/moderate */
    moderateChannel: (channelId: string, payload: Record<string, unknown>, reason?: Reason): Promise<unknown> =>
      post<unknown>(`/admin/content/channels/${channelId}/moderate`, payload, audit(reason)),
    /** GET /admin/content/workshops */
    workshops: (): Promise<unknown[]> => readList<unknown[]>('/admin/content/workshops'),
    /** PUT /admin/content/workshops/{id} */
    updateWorkshop: (workshopId: string, updates: Record<string, unknown>, reason?: Reason): Promise<unknown> =>
      put<unknown>(`/admin/content/workshops/${workshopId}`, updates, audit(reason)),
    /** GET /admin/workshops/{id}/roster */
    workshopRoster: (workshopId: string): Promise<unknown[]> =>
      readList<unknown[]>(`/admin/workshops/${workshopId}/roster`),
    /** GET /admin/content/{collection} */
    collection: (collection: string, params?: Record<string, unknown>): Promise<unknown[]> =>
      readList<unknown[]>(`/admin/content/${collection}`, { params }),
    /** POST /admin/content/{collection} */
    createInCollection: (collection: string, payload: Record<string, unknown>, reason?: Reason): Promise<unknown> =>
      post<unknown>(`/admin/content/${collection}`, payload, audit(reason)),
    /** PUT /admin/content/{collection}/{itemId} */
    updateInCollection: (collection: string, itemId: string, updates: Record<string, unknown>, reason?: Reason): Promise<unknown> =>
      put<unknown>(`/admin/content/${collection}/${itemId}`, updates, audit(reason)),
    /** DELETE /admin/content/{collection}/{itemId} */
    deleteFromCollection: (collection: string, itemId: string, reason?: Reason): Promise<unknown> =>
      del<unknown>(`/admin/content/${collection}/${itemId}`, audit(reason)),
  },

  // ===== SOP-14 finance desk =====
  finance: {
    /** GET /admin/finance/loans */
    loans: (params?: Record<string, unknown>): Promise<unknown[]> =>
      readList<unknown[]>('/admin/finance/loans', { params }),
    /** PUT /admin/finance/loans/{id}/status */
    setLoanStatus: (applicationId: string, payload: Record<string, unknown>, reason?: Reason): Promise<unknown> =>
      put<unknown>(`/admin/finance/loans/${applicationId}/status`, payload, audit(reason)),
    /** GET /admin/finance/bank-accounts */
    bankAccounts: (params?: Record<string, unknown>): Promise<unknown[]> =>
      readList<unknown[]>('/admin/finance/bank-accounts', { params }),
    /** POST /admin/finance/bank-accounts/{id}/override-verify */
    overrideVerifyAccount: (accountId: string, payload: Record<string, unknown>, reason?: Reason): Promise<unknown> =>
      post<unknown>(`/admin/finance/bank-accounts/${accountId}/override-verify`, payload, audit(reason)),
    /** GET /admin/finance/kcc */
    kcc: (params?: Record<string, unknown>): Promise<unknown[]> =>
      readList<unknown[]>('/admin/finance/kcc', { params }),
    /** GET /admin/finance/credit-scores */
    creditScores: (params?: Record<string, unknown>): Promise<unknown[]> =>
      readList<unknown[]>('/admin/finance/credit-scores', { params }),
    /** GET /admin/finance/accounts */
    accounts: (params?: Record<string, unknown>): Promise<unknown[]> =>
      readList<unknown[]>('/admin/finance/accounts', { params }),
    /** POST /admin/finance/accounts/{id}/override-verify */
    overrideVerifyFinanceAccount: (accountId: string, payload: Record<string, unknown>, reason?: Reason): Promise<unknown> =>
      post<unknown>(`/admin/finance/accounts/${accountId}/override-verify`, payload, audit(reason)),
    /** GET /admin/reports/financial */
    financialReports: (params?: Record<string, unknown>): Promise<unknown> =>
      readOne<unknown>('/admin/reports/financial', { params }),
    /** GET /admin/subscriptions — every user subscription joined with plan snapshot */
    subscriptions: (params?: Record<string, unknown>): Promise<unknown[]> =>
      readList<unknown[]>('/admin/subscriptions', { params }),
    /** GET /admin/escrow/holdings — in-escrow money with platform totals */
    escrowHoldings: (): Promise<unknown> => readOne<unknown>('/admin/escrow/holdings'),
    /** GET /admin/reports/transactions?from&to&format — bookings + orders + settlements */
    transactionsReport: (params?: Record<string, unknown>): Promise<unknown[]> =>
      readList<unknown[]>('/admin/reports/transactions', { params }),
    /** GET /admin/reports/crops?format — crop-wise listed volumes & values */
    cropsReport: (params?: Record<string, unknown>): Promise<unknown[]> =>
      readList<unknown[]>('/admin/reports/crops', { params }),
    /** GET /admin/settlements */
    settlements: (params?: Record<string, unknown>): Promise<unknown[]> =>
      readList<unknown[]>('/admin/settlements', { params }),
    /** POST /admin/settlements/{id}/mark-paid */
    markSettlementPaid: (settlementId: string, reason?: Reason): Promise<unknown> =>
      post<unknown>(`/admin/settlements/${settlementId}/mark-paid`, undefined, audit(reason)),
    /** POST /admin/settlements/holds */
    holdSettlement: (payload: Record<string, unknown>, reason?: Reason): Promise<unknown> =>
      post<unknown>('/admin/settlements/holds', payload, audit(reason)),
    /** POST /admin/jobs/settlements/run */
    runSettlements: (reason?: Reason): Promise<unknown> =>
      post<unknown>('/admin/jobs/settlements/run', undefined, audit(reason)),
  },

  // ===== SOP-15 claims desk =====
  claims: {
    /** GET /admin/claims */
    list: (params?: Record<string, unknown>): Promise<unknown[]> =>
      readList<unknown[]>('/admin/claims', { params }),
    /** GET /admin/insurance/claims */
    insuranceClaims: (params?: Record<string, unknown>): Promise<unknown[]> =>
      readList<unknown[]>('/admin/insurance/claims', { params }),
    /** PUT /admin/claims/{userId}/{claimId} */
    update: (userId: string, claimId: string, payload: Record<string, unknown>, reason?: Reason): Promise<unknown> =>
      put<unknown>(`/admin/claims/${userId}/${claimId}`, payload, audit(reason)),
    /** POST /admin/claims/{id}/assign-surveyor */
    assignSurveyor: (claimId: string, payload: Record<string, unknown>, reason?: Reason): Promise<unknown> =>
      post<unknown>(`/admin/claims/${claimId}/assign-surveyor`, payload, audit(reason)),
    /** GET /admin/insurance/rates */
    insuranceRates: (): Promise<unknown[]> => readList<unknown[]>('/admin/insurance/rates'),
    /** POST /admin/insurance/rates */
    addInsuranceRate: (payload: Record<string, unknown>, reason?: Reason): Promise<unknown> =>
      post<unknown>('/admin/insurance/rates', payload, audit(reason)),
    /** PUT /admin/insurance/rates */
    updateInsuranceRates: (payload: Record<string, unknown>, reason?: Reason): Promise<unknown> =>
      put<unknown>('/admin/insurance/rates', payload, audit(reason)),
  },

  // ===== SOP-16 org: FPO / vets / gaushala =====
  org: {
    /** GET /admin/fpo */
    fpos: (params?: Record<string, unknown>): Promise<unknown[]> =>
      readList<unknown[]>('/admin/fpo', { params }),
    /** POST /admin/fpo/verify/{fpoId} */
    verifyFpo: (fpoId: string, reason?: Reason): Promise<unknown> =>
      post<unknown>(`/admin/fpo/verify/${fpoId}`, undefined, audit(reason)),
    /** GET /admin/fpo/{fpoId}/financials */
    fpoFinancials: (fpoId: string): Promise<unknown> => readOne<unknown>(`/admin/fpo/${fpoId}/financials`),
    /** POST /admin/fpo/pools */
    createFpoPool: (payload: Record<string, unknown>, reason?: Reason): Promise<unknown> =>
      post<unknown>('/admin/fpo/pools', payload, audit(reason)),
    /** PUT /admin/fpo/pools/{id}/status */
    setFpoPoolStatus: (poolId: string, status: string, reason?: Reason): Promise<unknown> =>
      put<unknown>(`/admin/fpo/pools/${poolId}/status`, { status }, audit(reason)),
    /** GET /admin/vets | /admin/livestock/vets */
    vets: (): Promise<unknown[]> => readList<unknown[]>('/admin/vets'),
    /** POST /admin/vets/{id}/verify | /admin/livestock/vets/{id}/verify */
    verifyVet: (vetId: string, reason?: Reason): Promise<unknown> =>
      post<unknown>(`/admin/vets/${vetId}/verify`, undefined, audit(reason)),
    /** POST /admin/vets/{id}/reject */
    rejectVet: (vetId: string, payload: Record<string, unknown>, reason?: Reason): Promise<unknown> =>
      post<unknown>(`/admin/vets/${vetId}/reject`, payload, audit(reason)),
    /** GET /admin/gaushalas | /admin/livestock/gaushalas */
    gaushalas: (): Promise<unknown[]> => readList<unknown[]>('/admin/gaushalas'),
    /** GET /admin/livestock/orders */
    livestockOrders: (params?: Record<string, unknown>): Promise<unknown[]> =>
      readList<unknown[]>('/admin/livestock/orders', { params }),
    /** GET /admin/livestock/dairy/rate-charts */
    dairyRateCharts: (): Promise<unknown[]> => readList<unknown[]>('/admin/livestock/dairy/rate-charts'),
    /** GET /admin/ngos */
    ngos: (): Promise<unknown[]> => readList<unknown[]>('/admin/ngos'),
    /** POST /admin/ngos/{id}/verify */
    verifyNgo: (ngoId: string, reason?: Reason): Promise<unknown> =>
      post<unknown>(`/admin/ngos/${ngoId}/verify`, undefined, audit(reason)),
    /** GET /admin/shgs */
    shgs: (): Promise<unknown[]> => readList<unknown[]>('/admin/shgs'),
    /** POST /admin/shgs/{id}/verify */
    verifyShg: (shgId: string, reason?: Reason): Promise<unknown> =>
      post<unknown>(`/admin/shgs/${shgId}/verify`, undefined, audit(reason)),
    /** POST /admin/shgs/{id}/reject */
    rejectShg: (shgId: string, payload: Record<string, unknown>, reason?: Reason): Promise<unknown> =>
      post<unknown>(`/admin/shgs/${shgId}/reject`, payload, audit(reason)),
    /** GET /admin/shgs/{id}/deposits */
    shgDeposits: (shgId: string): Promise<unknown[]> => readList<unknown[]>(`/admin/shgs/${shgId}/deposits`),
    /** GET /admin/shgs/{id}/enterprises */
    shgEnterprises: (shgId: string): Promise<unknown[]> => readList<unknown[]>(`/admin/shgs/${shgId}/enterprises`),
    /** GET /admin/nurseries */
    nurseries: (): Promise<unknown[]> => readList<unknown[]>('/admin/nurseries'),
    /** POST /admin/nurseries/{id}/verify */
    verifyNursery: (nurseryId: string, reason?: Reason): Promise<unknown> =>
      post<unknown>(`/admin/nurseries/${nurseryId}/verify`, undefined, audit(reason)),
  },

  // ===== SOP-20 cold storage & facilities =====
  coldStorage: {
    /** GET /admin/cold-storages */
    list: (params?: Record<string, unknown>): Promise<unknown[]> =>
      readList<unknown[]>('/admin/cold-storages', { params }),
    /** POST /admin/cold-storages */
    create: (payload: Record<string, unknown>, reason?: Reason): Promise<unknown> =>
      post<unknown>('/admin/cold-storages', payload, audit(reason)),
    /** PUT /admin/cold-storages/{id} */
    update: (storageId: string, updates: Record<string, unknown>, reason?: Reason): Promise<unknown> =>
      put<unknown>(`/admin/cold-storages/${storageId}`, updates, audit(reason)),
    /** GET /admin/cold-storage/facilities */
    facilities: (): Promise<unknown[]> => readList<unknown[]>('/admin/cold-storage/facilities'),
    /** POST /admin/cold-storage/facilities/{id}/verify */
    verifyFacility: (facilityId: string, reason?: Reason): Promise<unknown> =>
      post<unknown>(`/admin/cold-storage/facilities/${facilityId}/verify`, undefined, audit(reason)),
    /** GET /admin/cold-storage/bookings */
    bookings: (params?: Record<string, unknown>): Promise<unknown[]> =>
      readList<unknown[]>('/admin/cold-storage/bookings', { params }),
    /** GET /admin/platform-config/carbon — carbon-credit economics (SOP-23 desk) */
    carbonConfig: (): Promise<unknown> => readOne<unknown>('/admin/platform-config/carbon'),
    /** PUT /admin/platform-config/carbon */
    updateCarbonConfig: (payload: Record<string, unknown>, reason?: Reason): Promise<unknown> =>
      put<unknown>('/admin/platform-config/carbon', payload, audit(reason)),
  },

  // ===== SOP-21/22 trees + coins economy =====
  economy: {
    /** GET /admin/tree/requests */
    treeRequests: (params?: Record<string, unknown>): Promise<unknown[]> =>
      readList<unknown[]>('/admin/tree/requests', { params }),
    /** PUT /admin/tree/requests/{id}/status */
    setTreeRequestStatus: (requestId: string, payload: Record<string, unknown>, reason?: Reason): Promise<unknown> =>
      put<unknown>(`/admin/tree/requests/${requestId}/status`, payload, audit(reason)),
    /** GET /admin/tree/requests/{id}/survival */
    treeSurvival: (requestId: string): Promise<unknown> =>
      readOne<unknown>(`/admin/tree/requests/${requestId}/survival`),
    /** GET /admin/tree/ngos */
    treeNgos: (): Promise<unknown[]> => readList<unknown[]>('/admin/tree/ngos'),
    /** GET /admin/biofuel-trees */
    biofuelTrees: (): Promise<unknown[]> => readList<unknown[]>('/admin/biofuel-trees'),
    /** PUT /admin/biofuel-trees/{treeId} */
    updateBiofuelTree: (treeId: string, updates: Record<string, unknown>, reason?: Reason): Promise<unknown> =>
      put<unknown>(`/admin/biofuel-trees/${treeId}`, updates, audit(reason)),
    /** GET /admin/gamification/circulation */
    coinCirculation: (): Promise<unknown> => readOne<unknown>('/admin/gamification/circulation'),
    /** GET /admin/gamification/ledger */
    coinLedger: (params?: Record<string, unknown>): Promise<unknown[]> =>
      readList<unknown[]>('/admin/gamification/ledger', { params }),
    /** POST /admin/gamification/adjust */
    adjustCoins: (payload: Record<string, unknown>, reason?: Reason): Promise<unknown> =>
      post<unknown>('/admin/gamification/adjust', payload, audit(reason)),
    /** POST /admin/gamification/rewards */
    createReward: (payload: Record<string, unknown>, reason?: Reason): Promise<unknown> =>
      post<unknown>('/admin/gamification/rewards', payload, audit(reason)),
    /** GET /admin/gamification/referral-fraud */
    referralFraud: (): Promise<unknown[]> => readList<unknown[]>('/admin/gamification/referral-fraud'),
    /** GET /admin/referrals/audit */
    referralsAudit: (): Promise<unknown[]> => readList<unknown[]>('/admin/referrals/audit'),
    /** GET /admin/platform-config/referrals — reward coins, monthly caps, KYC gate */
    referralConfig: (): Promise<unknown> => readOne<unknown>('/admin/platform-config/referrals'),
    /** PUT /admin/platform-config/referrals */
    updateReferralConfig: (payload: Record<string, unknown>, reason?: Reason): Promise<unknown> =>
      put<unknown>('/admin/platform-config/referrals', payload, audit(reason)),
    /** DELETE /admin/ratings/{ratingId} */
    deleteRating: (ratingId: string, reason?: Reason): Promise<unknown> =>
      del<unknown>(`/admin/ratings/${ratingId}`, audit(reason)),
    /** GET /admin/sapling-requests */
    saplingRequests: (): Promise<unknown[]> => readList<unknown[]>('/admin/sapling-requests'),
    /** POST /admin/sapling-requests/{id}/review */
    reviewSaplingRequest: (requestId: string, payload: Record<string, unknown>, reason?: Reason): Promise<unknown> =>
      post<unknown>(`/admin/sapling-requests/${requestId}/review`, payload, audit(reason)),
  },

  // ===== SOP-23/24 women economy =====
  women: {
    /** GET /admin/women/shgs/queue */
    shgQueue: (): Promise<unknown[]> => readList<unknown[]>('/admin/women/shgs/queue'),
    /** POST /admin/women/shgs/{id}/verify */
    verifyShg: (shgId: string, reason?: Reason): Promise<unknown> =>
      post<unknown>(`/admin/women/shgs/${shgId}/verify`, undefined, audit(reason)),
    /** POST /admin/women/shg/verify */
    verifyShgLegacy: (payload: Record<string, unknown>, reason?: Reason): Promise<unknown> =>
      post<unknown>('/admin/women/shg/verify', payload, audit(reason)),
    /** POST /admin/women/subsidies/disburse */
    disburseSubsidy: (payload: Record<string, unknown>, reason?: Reason): Promise<unknown> =>
      post<unknown>('/admin/women/subsidies/disburse', payload, audit(reason)),
    /** GET /admin/women/enterprise-products */
    enterpriseProducts: (): Promise<unknown[]> =>
      readList<unknown[]>('/admin/women/enterprise-products'),
    /** GET /admin/women/shg */
    shgs: (): Promise<unknown[]> => readList<unknown[]>('/admin/women/shg'),
    /** GET /admin/women/enterprises */
    enterprises: (): Promise<unknown[]> => readList<unknown[]>('/admin/women/enterprises'),
    /** GET /admin/women/impact-report */
    impactReport: (): Promise<unknown> => readOne<unknown>('/admin/women/impact-report'),
    /** GET /admin/women/loans */
    loans: (): Promise<unknown[]> => readItems<unknown[]>('/admin/women/loans'),
    /** GET /admin/women/deposit-compliance?month=YYYY-MM */
    depositCompliance: (month: string): Promise<unknown[]> =>
      readItems<unknown[]>('/admin/women/deposit-compliance', { params: { month } }),
  },

  // ===== SOP-24 women billing / subscription kill-switch =====
  billing: {
    /** GET /admin/billing/config */
    config: (): Promise<unknown> => readOne<unknown>('/admin/billing/config'),
    /** PUT /admin/billing/config */
    updateConfig: (payload: Record<string, unknown>, reason?: Reason): Promise<unknown> =>
      put<unknown>('/admin/billing/config', payload, audit(reason)),
  },

  // ===== SOP-25 settlements desk =====
  settlementDesk: {
    /** GET /settlements/holds */
    holds: (): Promise<unknown[]> => readList<unknown[]>('/settlements/holds'),
    /** POST /settlements/holds/{lineId}/release */
    releaseHold: (lineId: string, reason?: Reason): Promise<unknown> =>
      post<unknown>(`/settlements/holds/${lineId}/release`, undefined, audit(reason)),
    /** POST /settlements/holds/{lineId}/reject */
    rejectHold: (lineId: string, payload: Record<string, unknown>, reason?: Reason): Promise<unknown> =>
      post<unknown>(`/settlements/holds/${lineId}/reject`, payload, audit(reason)),
  },

  // ===== SOP-26 platform config & broadcast =====
  platform: {
    /** GET /admin/overview */
    overview: (): Promise<unknown> => readOne<unknown>('/admin/overview'),
    /** GET /admin/analytics/summary */
    analyticsSummary: (): Promise<unknown> => readOne<unknown>('/admin/analytics/summary'),
    /** GET /admin/analytics/emarket */
    analyticsEmarket: (): Promise<unknown> => readOne<unknown>('/admin/analytics/emarket'),
    /** GET /admin/north-star */
    northStar: (): Promise<unknown> => readOne<unknown>('/analytics/north-star'),
    /** POST /admin/broadcast | /admin/broadcasts */
    broadcast: (payload: Record<string, unknown>, reason?: Reason): Promise<unknown> =>
      post<unknown>('/admin/broadcast', payload, audit(reason)),
    /** GET /admin/reports */
    reports: (params?: Record<string, unknown>): Promise<unknown[]> =>
      readList<unknown[]>('/admin/reports', { params }),
    /** POST /admin/reports/{id}/resolve */
    resolveReport: (reportId: string, payload: Record<string, unknown>, reason?: Reason): Promise<unknown> =>
      post<unknown>(`/admin/reports/${reportId}/resolve`, payload, audit(reason)),
    /** GET /admin/app-config */
    appConfig: (): Promise<unknown> => readOne<unknown>('/admin/app-config'),
    /** PUT /admin/app-config */
    updateAppConfig: (payload: Record<string, unknown>, reason?: Reason): Promise<unknown> =>
      put<unknown>('/admin/app-config', payload, audit(reason)),
    /** GET /admin/feature-flags */
    featureFlags: (): Promise<unknown> => readOne<unknown>('/admin/feature-flags'),
    /** PUT /admin/feature-flags */
    updateFeatureFlags: (payload: Record<string, unknown>, reason?: Reason): Promise<unknown> =>
      put<unknown>('/admin/feature-flags', payload, audit(reason)),
    /** GET /admin/platform-config/ai */
    aiConfig: (): Promise<unknown> => readOne<unknown>('/admin/platform-config/ai'),
    /** PUT /admin/platform-config/ai */
    updateAiConfig: (payload: Record<string, unknown>, reason?: Reason): Promise<unknown> =>
      put<unknown>('/admin/platform-config/ai', payload, audit(reason)),
    /** GET /admin/platform-config/commissions */
    commissionConfig: (): Promise<unknown> => readOne<unknown>('/admin/platform-config/commissions'),
    /** PUT /admin/platform-config/commissions */
    updateCommissionConfig: (payload: Record<string, unknown>, reason?: Reason): Promise<unknown> =>
      put<unknown>('/admin/platform-config/commissions', payload, audit(reason)),
    /** GET /admin/platform-config/coins */
    coinConfig: (): Promise<unknown> => readOne<unknown>('/admin/platform-config/coins'),
    /** PUT /admin/platform-config/coins */
    updateCoinConfig: (payload: Record<string, unknown>, reason?: Reason): Promise<unknown> =>
      put<unknown>('/admin/platform-config/coins', payload, audit(reason)),
    /** GET /admin/platform-config/penalties */
    penaltyConfig: (): Promise<unknown> => readOne<unknown>('/admin/platform-config/penalties'),
    /** PUT /admin/platform-config/penalties */
    updatePenaltyConfig: (payload: Record<string, unknown>, reason?: Reason): Promise<unknown> =>
      put<unknown>('/admin/platform-config/penalties', payload, audit(reason)),
    /** POST /admin/platform-config/penalties/waive */
    waivePenalty: (payload: Record<string, unknown>, reason?: Reason): Promise<unknown> =>
      post<unknown>('/admin/platform-config/penalties/waive', payload, audit(reason)),
    /** GET /admin/notification-templates */
    notificationTemplates: (): Promise<unknown> => readOne<unknown>('/admin/notification-templates'),
    /** PUT /admin/notification-templates */
    updateNotificationTemplates: (payload: Record<string, unknown>, reason?: Reason): Promise<unknown> =>
      put<unknown>('/admin/notification-templates', payload, audit(reason)),
    /** GET /admin/district-crops */
    districtCrops: (): Promise<unknown[]> => readList<unknown[]>('/admin/district-crops'),
    /** PUT /admin/district-crops/{district} */
    updateDistrictCrops: (district: string, payload: Record<string, unknown>, reason?: Reason): Promise<unknown> =>
      put<unknown>(`/admin/district-crops/${district}`, payload, audit(reason)),
    /** POST /admin/district-crops/{district}/approve */
    approveDistrictCrops: (district: string, reason?: Reason): Promise<unknown> =>
      post<unknown>(`/admin/district-crops/${district}/approve`, undefined, audit(reason)),
    /** GET /admin/ai/health */
    aiHealth: (): Promise<unknown> => readOne<unknown>('/admin/ai/health'),
    /** GET /admin/jobs/cron-logs */
    cronLogs: (params?: Record<string, unknown>): Promise<unknown[]> =>
      readList<unknown[]>('/admin/jobs/cron-logs', { params }),
    /** GET /admin/expert-handoffs */
    expertHandoffs: (): Promise<unknown[]> => readList<unknown[]>('/admin/expert-handoffs'),
    /** POST /admin/expert-handoffs/{id}/resolve */
    resolveExpertHandoff: (ticketId: string, payload: Record<string, unknown>, reason?: Reason): Promise<unknown> =>
      post<unknown>(`/admin/expert-handoffs/${ticketId}/resolve`, payload, audit(reason)),
  },

  // ===== SOP-27 courses & approvals =====
  courses: {
    /** GET /admin/courses/queue */
    queue: (): Promise<unknown[]> => readList<unknown[]>('/admin/courses/queue'),
    /** POST /admin/courses/{id}/review */
    review: (courseId: string, payload: Record<string, unknown>, reason?: Reason): Promise<unknown> =>
      post<unknown>(`/admin/courses/${courseId}/review`, payload, audit(reason)),
    /** POST /admin/courses/{id}/feature */
    feature: (courseId: string, reason?: Reason): Promise<unknown> =>
      post<unknown>(`/admin/courses/${courseId}/feature`, undefined, audit(reason)),
    /** GET /admin/courses/report */
    report: (): Promise<unknown> => readOne<unknown>('/admin/courses/report'),
  },

  // ===== moderation, fraud, approvals, audit =====
  moderation: {
    /** GET /admin/moderation-queue */
    queue: (): Promise<unknown[]> => readList<unknown[]>('/admin/moderation-queue'),
    /** GET /admin/moderation/queue */
    queueAlt: (): Promise<unknown[]> => readList<unknown[]>('/admin/moderation/queue'),
    /** POST /admin/moderation/{itemId}/action */
    act: (itemId: string, payload: Record<string, unknown>, reason?: Reason): Promise<unknown> =>
      post<unknown>(`/admin/moderation/${itemId}/action`, payload, audit(reason)),
    /** GET /admin/fraud-queue */
    fraudQueue: (): Promise<unknown[]> => readList<unknown[]>('/admin/fraud-queue'),
    /** GET /admin/approvals */
    approvals: (): Promise<unknown[]> => readList<unknown[]>('/admin/approvals'),
    /** POST /admin/approvals/{id}/approve */
    approve: (approvalId: string, reason?: Reason): Promise<unknown> =>
      post<unknown>(`/admin/approvals/${approvalId}/approve`, undefined, audit(reason)),
    /** POST /admin/approvals/{id}/reject */
    reject: (approvalId: string, payload: Record<string, unknown>, reason?: Reason): Promise<unknown> =>
      post<unknown>(`/admin/approvals/${approvalId}/reject`, payload, audit(reason)),
    /** GET /admin/audit */
    auditLog: (params?: Record<string, unknown>): Promise<unknown[]> =>
      readList<unknown[]>('/admin/audit', { params }),
    /** GET /admin/locale-drafts */
    localeDrafts: (): Promise<unknown[]> => readList<unknown[]>('/admin/locale-drafts'),
    /** POST /admin/locale-approvals */
    approveLocale: (payload: Record<string, unknown>, reason?: Reason): Promise<unknown> =>
      post<unknown>('/admin/locale-approvals', payload, audit(reason)),
    /** GET /admin/deals */
    deals: (params?: Record<string, unknown>): Promise<unknown[]> =>
      readList<unknown[]>('/admin/deals', { params }),
    /** POST /admin/deals/{id}/escalate */
    escalateDeal: (dealId: string, payload: Record<string, unknown>, reason?: Reason): Promise<unknown> =>
      post<unknown>(`/admin/deals/${dealId}/escalate`, payload, audit(reason)),
    /** GET /admin/buyers */
    buyers: (params?: Record<string, unknown>): Promise<unknown[]> =>
      readList<unknown[]>('/admin/buyers', { params }),
    /** POST /admin/buyers/{id}/verify */
    verifyBuyer: (buyerId: string, reason?: Reason): Promise<unknown> =>
      post<unknown>(`/admin/buyers/${buyerId}/verify`, undefined, audit(reason)),
    /** POST /admin/buyers/{id}/suspend */
    suspendBuyer: (buyerId: string, payload: Record<string, unknown>, reason?: Reason): Promise<unknown> =>
      post<unknown>(`/admin/buyers/${buyerId}/suspend`, payload, audit(reason)),
  },

  // ===== partner keys & chatbot ops =====
  partners: {
    /** GET /admin/partner-keys */
    keys: (): Promise<unknown[]> => readList<unknown[]>('/admin/partner-keys'),
    /** POST /admin/partner-keys */
    createKey: (payload: Record<string, unknown>, reason?: Reason): Promise<unknown> =>
      post<unknown>('/admin/partner-keys', payload, audit(reason)),
    /** POST /admin/partner-keys/{id}/revoke */
    revokeKey: (keyId: string, reason?: Reason): Promise<unknown> =>
      post<unknown>(`/admin/partner-keys/${keyId}/revoke`, undefined, audit(reason)),
    /** GET /admin/partner-keys/{id}/usage */
    keyUsage: (keyId: string): Promise<unknown> => readOne<unknown>(`/admin/partner-keys/${keyId}/usage`),
  },

  chatbot: {
    /** GET /admin/chatbot/sessions */
    sessions: (params?: Record<string, unknown>): Promise<unknown[]> =>
      readList<unknown[]>('/admin/chatbot/sessions', { params }),
    /** GET /admin/chatbot/sessions/{id} */
    session: (sessionId: string): Promise<unknown> => readOne<unknown>(`/admin/chatbot/sessions/${sessionId}`),
    /** GET /admin/chatbot/prompt-config */
    promptConfig: (): Promise<unknown> => readOne<unknown>('/admin/chatbot/prompt-config'),
    /** PUT /admin/chatbot/prompt-config */
    updatePromptConfig: (payload: Record<string, unknown>, reason?: Reason): Promise<unknown> =>
      put<unknown>('/admin/chatbot/prompt-config', payload, audit(reason)),
    /** GET /admin/chatbot/transcripts */
    transcripts: (params?: Record<string, unknown>): Promise<unknown[]> =>
      readList<unknown[]>('/admin/chatbot/transcripts', { params }),
    /** GET /admin/chatbot/handoffs */
    handoffs: (): Promise<unknown[]> => readList<unknown[]>('/admin/chatbot/handoffs'),
    /** POST /admin/chatbot/handoffs/{id}/assign */
    assignHandoff: (ticketId: string, payload: Record<string, unknown>, reason?: Reason): Promise<unknown> =>
      post<unknown>(`/admin/chatbot/handoffs/${ticketId}/assign`, payload, audit(reason)),
    /** GET /admin/chatbot/satisfaction */
    satisfaction: (): Promise<unknown> => readOne<unknown>('/admin/chatbot/satisfaction'),
    /** GET /admin/chatbot/intents — curated intent/response registry */
    intents: (): Promise<unknown> => readOne<unknown>('/admin/chatbot/intents'),
    /** PUT /admin/chatbot/intents — replaces the whole intent list */
    updateIntents: (payload: Record<string, unknown>, reason?: Reason): Promise<unknown> =>
      put<unknown>('/admin/chatbot/intents', payload, audit(reason)),
    /** GET /admin/chatbot/fallback-config — fallback rotation + handoff threshold */
    fallbackConfig: (): Promise<unknown> => readOne<unknown>('/admin/chatbot/fallback-config'),
    /** PUT /admin/chatbot/fallback-config */
    updateFallbackConfig: (payload: Record<string, unknown>, reason?: Reason): Promise<unknown> =>
      put<unknown>('/admin/chatbot/fallback-config', payload, audit(reason)),
    /** GET /admin/experts */
    experts: (): Promise<unknown[]> => readList<unknown[]>('/admin/experts'),
    /** PUT /admin/experts/{id} */
    updateExpert: (expertId: string, payload: Record<string, unknown>, reason?: Reason): Promise<unknown> =>
      put<unknown>(`/admin/experts/${expertId}`, payload, audit(reason)),
  },

  copilot: {
    /** POST /admin/copilot/query */
    query: (payload: Record<string, unknown>, reason?: Reason): Promise<unknown> =>
      post<unknown>('/admin/copilot/query', payload, audit(reason)),
    /** GET /admin/copilot/briefing */
    briefing: (): Promise<unknown> => readOne<unknown>('/admin/copilot/briefing'),
  },

  contractsDesk: {
    /** GET /admin/contracts */
    list: (params?: Record<string, unknown>): Promise<unknown[]> =>
      readList<unknown[]>('/admin/contracts', { params }),
    /** POST /admin/contracts */
    create: (payload: Record<string, unknown>, reason?: Reason): Promise<unknown> =>
      post<unknown>('/admin/contracts', payload, audit(reason)),
    /** PUT /admin/contracts/{id}/status */
    setStatus: (contractId: string, payload: Record<string, unknown>, reason?: Reason): Promise<unknown> =>
      put<unknown>(`/admin/contracts/${contractId}/status`, payload, audit(reason)),
    /** GET /admin/contracts/{id}/acceptances */
    acceptances: (contractId: string): Promise<unknown[]> =>
      readList<unknown[]>(`/admin/contracts/${contractId}/acceptances`),
    /** GET /admin/procurements */
    procurements: (params?: Record<string, unknown>): Promise<unknown[]> =>
      readList<unknown[]>('/admin/procurements', { params }),
  },

  // ===== master data manager (mandis/crops/varieties/grades/categories/states/units/vehicle-types) =====
  masterData: {
    /** GET /admin/master/{collection} — merged static + Firestore override rows */
    list: (collection: string, params?: Record<string, unknown>): Promise<unknown[]> =>
      readList<unknown[]>(`/admin/master/${collection}`, { params }),
    /** POST /admin/master/{collection} — create or override one entry */
    create: (collection: string, payload: Record<string, unknown>, reason?: Reason): Promise<unknown> =>
      post<unknown>(`/admin/master/${collection}`, payload, audit(reason)),
    /** PUT /admin/master/{collection}/{code} — partial update */
    update: (collection: string, code: string, payload: Record<string, unknown>, reason?: Reason): Promise<unknown> =>
      put<unknown>(`/admin/master/${collection}/${encodeURIComponent(code)}`, payload, audit(reason)),
    /** DELETE /admin/master/{collection}/{code} — soft delete (active=false) */
    remove: (collection: string, code: string, reason?: Reason): Promise<unknown> =>
      del<unknown>(`/admin/master/${collection}/${encodeURIComponent(code)}`, audit(reason)),
    /** POST /admin/master/{collection}/import — bulk upsert (max 500 rows) */
    importRows: (collection: string, rows: Record<string, unknown>[], reason?: Reason): Promise<unknown> =>
      post<unknown>(`/admin/master/${collection}/import`, { rows }, audit(reason)),
  },

  // ===== ads & campaign oversight (SOP-05/06 trade router) =====
  ads: {
    /** GET /admin/ads — all campaigns with advertiser name/persona resolved */
    campaigns: (params?: Record<string, unknown>): Promise<unknown[]> =>
      readList<unknown[]>('/admin/ads', { params }),
    /** POST /admin/ads/{adId}/approve */
    approve: (adId: string, reason?: Reason): Promise<unknown> =>
      post<unknown>(`/admin/ads/${adId}/approve`, undefined, audit(reason)),
    /** POST /admin/ads/{adId}/reject — body: { reason } (min 3 chars) */
    reject: (adId: string, payload: Record<string, unknown>, reason?: Reason): Promise<unknown> =>
      post<unknown>(`/admin/ads/${adId}/reject`, payload, audit(reason)),
    /** GET /admin/ads/{adId}/analytics — impressions/clicks/CTR/spend vs budget */
    analytics: (adId: string): Promise<unknown> =>
      readOne<unknown>(`/admin/ads/${adId}/analytics`),
    /** GET /admin/platform-config/ads-pricing */
    pricing: (): Promise<unknown> => readOne<unknown>('/admin/platform-config/ads-pricing'),
    /** PUT /admin/platform-config/ads-pricing */
    updatePricing: (payload: Record<string, unknown>, reason?: Reason): Promise<unknown> =>
      put<unknown>('/admin/platform-config/ads-pricing', payload, audit(reason)),
  },

  // ===== crop advisory CMS (SOP-11) =====
  advisory: {
    /** GET /admin/advisory/articles — status: draft | published | all */
    articles: (params?: Record<string, unknown>): Promise<unknown[]> =>
      readList<unknown[]>('/admin/advisory/articles', { params }),
    /** POST /admin/advisory/articles */
    createArticle: (payload: Record<string, unknown>, reason?: Reason): Promise<unknown> =>
      post<unknown>('/admin/advisory/articles', payload, audit(reason)),
    /** PUT /admin/advisory/articles/{articleId} */
    updateArticle: (articleId: string, payload: Record<string, unknown>, reason?: Reason): Promise<unknown> =>
      put<unknown>(`/admin/advisory/articles/${articleId}`, payload, audit(reason)),
    /** DELETE /admin/advisory/articles/{articleId} — soft delete (active=false, back to draft) */
    deleteArticle: (articleId: string, reason?: Reason): Promise<unknown> =>
      del<unknown>(`/admin/advisory/articles/${articleId}`, audit(reason)),
    /** POST /admin/advisory/articles/{articleId}/push — notify all matching farmers */
    pushArticle: (articleId: string, reason?: Reason): Promise<unknown> =>
      post<unknown>(`/admin/advisory/articles/${articleId}/push`, undefined, audit(reason)),
  },
};
