import { download, del, patch, post, put, readList, readOne } from './http';

/** Seller (Vyapari) namespace — products, orders, stock, procurement, sales, ledgers, compliance. */
export const seller = {
  // --- dashboard ---
  /** GET /seller/dashboard */
  dashboard: (): Promise<unknown> => readOne<unknown>('/seller/dashboard'),

  /** GET /seller/cashflow */
  cashflow: (): Promise<unknown> => readOne<unknown>('/seller/cashflow'),

  /** GET /seller/forecast */
  forecast: (): Promise<unknown> => readOne<unknown>('/seller/forecast'),

  // --- products ---
  /** GET /seller/products */
  products: (): Promise<unknown[]> => readList<unknown[]>('/seller/products'),

  /** POST /seller/products */
  addProduct: (payload: Record<string, unknown>): Promise<unknown> =>
    post<unknown>('/seller/products', payload),

  /** PUT /seller/products/{id} */
  updateProduct: (productId: string, updates: Record<string, unknown>): Promise<unknown> =>
    put<unknown>(`/seller/products/${productId}`, updates),

  // --- orders ---
  /** PATCH /seller/orders/{id}/status */
  updateOrderStatus: (orderId: string, status: string, note?: string): Promise<unknown> =>
    patch<unknown>(`/seller/orders/${orderId}/status`, note ? { status, note } : { status }),

  /** POST /seller/bulk-orders */
  createBulkOrder: (payload: Record<string, unknown>): Promise<unknown> =>
    post<unknown>('/seller/bulk-orders', payload),

  /** GET /seller/bulk-orders */
  bulkOrders: (): Promise<unknown[]> => readList<unknown[]>('/seller/bulk-orders'),

  /** GET /seller/buyer-directory */
  buyerDirectory: (): Promise<unknown[]> => readList<unknown[]>('/seller/buyer-directory'),

  // --- stock & resale ---
  /** GET /seller/stock */
  stock: (): Promise<unknown[]> => readList<unknown[]>('/seller/stock'),

  /** POST /seller/stock */
  addStock: (payload: Record<string, unknown>): Promise<unknown> => post<unknown>('/seller/stock', payload),

  /** POST /seller/stock/from-purchase/{purchaseId} */
  stockFromPurchase: (purchaseId: string, payload: Record<string, unknown> = {}): Promise<unknown> =>
    post<unknown>(`/seller/stock/from-purchase/${purchaseId}`, payload),

  /** POST /seller/stock/{stockId}/adjust */
  adjustStock: (stockId: string, payload: Record<string, unknown>): Promise<unknown> =>
    post<unknown>(`/seller/stock/${stockId}/adjust`, payload),

  /** POST /resale-listings */
  createResaleListing: (payload: Record<string, unknown>): Promise<unknown> =>
    post<unknown>('/resale-listings', payload),

  /** GET /resale-listings/mine */
  myResaleListings: (): Promise<unknown[]> => readList<unknown[]>('/resale-listings/mine'),

  /** GET /resale-listings */
  resaleListings: (params?: Record<string, unknown>): Promise<unknown[]> =>
    readList<unknown[]>('/resale-listings', { params }),

  /** GET /resale-listings/{id} */
  resaleListing: (listingId: string): Promise<unknown> => readOne<unknown>(`/resale-listings/${listingId}`),

  /** DELETE /resale-listings/{id} */
  removeResaleListing: (listingId: string): Promise<{ success: boolean }> =>
    del<{ success: boolean }>(`/resale-listings/${listingId}`),

  // --- procurement ---
  /** GET /seller/procurement */
  procurement: (params?: Record<string, unknown>): Promise<unknown[]> =>
    readList<unknown[]>('/seller/procurement', { params }),

  /** POST /seller/procurement */
  createProcurement: (payload: Record<string, unknown>): Promise<unknown> =>
    post<unknown>('/seller/procurement', payload),

  /** GET /seller/procurement/mine */
  myProcurement: (): Promise<unknown[]> => readList<unknown[]>('/seller/procurement/mine'),

  /** POST /seller/procurement/{lotId}/pay */
  payProcurement: (lotId: string, payload: Record<string, unknown>): Promise<unknown> =>
    post<unknown>(`/seller/procurement/${lotId}/pay`, payload),

  /** POST /seller/procurement/{lotId}/payment-status */
  procurementPaymentStatus: (lotId: string): Promise<unknown> =>
    post<unknown>(`/seller/procurement/${lotId}/payment-status`),

  /** GET /seller/procurement/mine/{paymentId}/receipt */
  procurementReceipt: (paymentId: string): Promise<unknown> =>
    readOne<unknown>(`/seller/procurement/mine/${paymentId}/receipt`),

  // --- sales & ledgers ---
  /** GET /seller/sales */
  sales: (params?: Record<string, unknown>): Promise<unknown[]> =>
    readList<unknown[]>('/seller/sales', { params }),

  /** POST /seller/sales */
  recordSale: (payload: Record<string, unknown>): Promise<unknown> => post<unknown>('/seller/sales', payload),

  /** GET /seller/sales/{saleId}/invoice.pdf — returns a Blob. */
  saleInvoicePdf: (saleId: string): Promise<Blob> => download(`/seller/sales/${saleId}/invoice.pdf`),

  /** GET /seller/ledgers */
  ledgers: (): Promise<unknown[]> => readList<unknown[]>('/seller/ledgers'),

  /** POST /seller/ledgers */
  addLedgerEntry: (payload: Record<string, unknown>): Promise<unknown> =>
    post<unknown>('/seller/ledgers', payload),

  // --- rates ---
  /** GET /seller/rates/my */
  myRates: (): Promise<unknown[]> => readList<unknown[]>('/seller/rates/my'),

  /** POST /seller/rates */
  postRate: (payload: Record<string, unknown>): Promise<unknown> => post<unknown>('/seller/rates', payload),

  /** PATCH /seller/rates/{rateId} */
  updateRate: (rateId: string, updates: Record<string, unknown>): Promise<unknown> =>
    patch<unknown>(`/seller/rates/${rateId}`, updates),

  // --- compliance ---
  /** GET /seller/gst-reports */
  gstReports: (): Promise<unknown[]> => readList<unknown[]>('/seller/gst-reports'),

  /** GET /seller/tds-statements */
  tdsStatements: (): Promise<unknown[]> => readList<unknown[]>('/seller/tds-statements'),

  /** GET /seller/tds-statements/statement.pdf — returns a Blob. */
  tdsStatementPdf: (): Promise<Blob> => download('/seller/tds-statements/statement.pdf'),

  /** GET /seller/purchases/{purchaseId}/commission-invoice */
  commissionInvoice: (purchaseId: string): Promise<unknown> =>
    readOne<unknown>(`/seller/purchases/${purchaseId}/commission-invoice`),

  // --- team ---
  /** GET /seller/team/members */
  teamMembers: (): Promise<unknown[]> => readList<unknown[]>('/seller/team/members'),

  /** POST /seller/team/invites */
  inviteTeamMember: (payload: Record<string, unknown>): Promise<unknown> =>
    post<unknown>('/seller/team/invites', payload),

  /** PUT /seller/team/members/{memberId}/role */
  setTeamRole: (memberId: string, role: string): Promise<unknown> =>
    put<unknown>(`/seller/team/members/${memberId}/role`, { role }),

  /** DELETE /seller/team/members/{memberId} */
  removeTeamMember: (memberId: string): Promise<{ success: boolean }> =>
    del<{ success: boolean }>(`/seller/team/members/${memberId}`),
};
