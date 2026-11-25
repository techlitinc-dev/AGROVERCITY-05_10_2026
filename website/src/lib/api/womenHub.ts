import { del, download, Params, post, put, readItems, readOne } from './http';

/**
 * Woman Hub namespace (womeninstructions.md / womenhub 21nov.xlsx).
 *
 * Part A · Sr 1.0 Dashboard, Sr 2.0 My Business & Management,
 * Sr 4.0 Kitchen Garden Planner, Sr 5.0 Home Enterprise Income,
 * Sr 7.0 My Orders, Sr 9.0 AI Analysis (woman side);
 * Part B · Sr 1.0/2.0 farmer discovery & business store,
 * Sr 4.0 farmer orders, Sr 5.0 requirements (enquiries).
 */
export const womenHub = {
  // --- Dashboard (Sr 1.0) ---
  /** GET /women/dashboard — garden stages, businesses, enterprise profit,
   *  notifications, Indian calendar, reminders. */
  dashboard: (): Promise<unknown> => readOne<Record<string, unknown>>('/women/dashboard'),

  // --- AI Analysis (Sr 9.0) ---
  /** GET /women/insights — savings trend, loan health, garden yield
   *  prediction, livestock productivity, best-seller & price suggestion. */
  insights: (): Promise<unknown> => readOne<Record<string, unknown>>('/women/insights'),

  // --- My Business & Management (Sr 2.0, woman side) ---
  /** GET /women/businesses — her businesses (+ optional search q). */
  myBusinesses: (q?: string): Promise<unknown[]> =>
    readItems<unknown>('/women/businesses', { params: { q: q || undefined } }),

  /** POST /women/businesses — Create Business. */
  createBusiness: (payload: Record<string, unknown>): Promise<unknown> =>
    post<unknown>('/women/businesses', payload),

  /** GET /women/businesses/{id} — details + products/orders/enquiries/ratings. */
  businessDetail: (id: string): Promise<unknown> => readOne<Record<string, unknown>>(`/women/businesses/${id}`),

  /** PUT /women/businesses/{id} — edit. */
  updateBusiness: (id: string, payload: Record<string, unknown>): Promise<unknown> =>
    put<unknown>(`/women/businesses/${id}`, payload),

  /** POST /women/businesses/{id}/pause | /resume. */
  pauseBusiness: (id: string): Promise<unknown> => post<unknown>(`/women/businesses/${id}/pause`),
  resumeBusiness: (id: string): Promise<unknown> => post<unknown>(`/women/businesses/${id}/resume`),

  /** DELETE /women/businesses/{id}. */
  deleteBusiness: (id: string): Promise<unknown> => del<unknown>(`/women/businesses/${id}`),

  /** POST /women/businesses/{id}/products — add product (photo/price/stock). */
  addProduct: (businessId: string, payload: Record<string, unknown>): Promise<unknown> =>
    post<unknown>(`/women/businesses/${businessId}/products`, payload),

  /** PUT /women/businesses/{id}/products/{pid}. */
  updateProduct: (
    businessId: string,
    productId: string,
    payload: Record<string, unknown>
  ): Promise<unknown> => put<unknown>(`/women/businesses/${businessId}/products/${productId}`, payload),

  /** DELETE /women/businesses/{id}/products/{pid}. */
  deleteProduct: (businessId: string, productId: string): Promise<unknown> =>
    del<unknown>(`/women/businesses/${businessId}/products/${productId}`),

  /** POST /women/businesses/orders/{id}/status — packed→pickup→in_transit→delivered. */
  setOrderStatus: (orderId: string, status: string): Promise<unknown> =>
    post<unknown>(`/women/businesses/orders/${orderId}/status`, { status }),

  /** POST /women/businesses/enquiries/{id}/respond — pending → responded. */
  respondEnquiry: (enquiryId: string, response: string): Promise<unknown> =>
    post<unknown>(`/women/businesses/enquiries/${enquiryId}/respond`, { response }),

  // --- Business customers (Sr 2.0 add-on) ---
  /** GET /women/businesses/{id}/customers — her customer directory; each
   *  customer carries a khata `summary` (sales/cost/profit/paid/remaining)
   *  and the body a business-level `totals` block. */
  customers: (businessId: string): Promise<unknown> =>
    readOne<Record<string, unknown>>(`/women/businesses/${businessId}/customers`),

  /** POST /women/businesses/{id}/customers — add customer. */
  addCustomer: (businessId: string, payload: Record<string, unknown>): Promise<unknown> =>
    post<unknown>(`/women/businesses/${businessId}/customers`, payload),

  /** PUT /women/businesses/{id}/customers/{cid} — edit customer. */
  updateCustomer: (businessId: string, customerId: string, payload: Record<string, unknown>): Promise<unknown> =>
    put<unknown>(`/women/businesses/${businessId}/customers/${customerId}`, payload),

  /** DELETE /women/businesses/{id}/customers/{cid}. */
  deleteCustomer: (businessId: string, customerId: string): Promise<unknown> =>
    del<unknown>(`/women/businesses/${businessId}/customers/${customerId}`),

  /** POST /women/businesses/{id}/customers/{cid}/records — dated ledger entry. */
  addCustomerRecord: (businessId: string, customerId: string, payload: Record<string, unknown>): Promise<unknown> =>
    post<unknown>(`/women/businesses/${businessId}/customers/${customerId}/records`, payload),

  /** PUT .../records/{rid} — edit record (date / note / amount). */
  updateCustomerRecord: (
    businessId: string,
    customerId: string,
    recordId: string,
    payload: Record<string, unknown>
  ): Promise<unknown> =>
    put<unknown>(`/women/businesses/${businessId}/customers/${customerId}/records/${recordId}`, payload),

  /** DELETE .../records/{rid}. */
  deleteCustomerRecord: (businessId: string, customerId: string, recordId: string): Promise<unknown> =>
    del<unknown>(`/women/businesses/${businessId}/customers/${customerId}/records/${recordId}`),

  // --- Kitchen Garden Planner (Sr 4.0) ---
  /** GET /women/garden-templates — nutrition-tagged vegetable catalog. */
  gardenTemplates: (): Promise<unknown[]> => readItems<unknown>('/women/garden-templates'),

  /** GET /women/garden-plans — her seasonal plans (+ templates). */
  gardenPlans: (): Promise<unknown[]> => readItems<unknown>('/women/garden-plans'),

  /** POST /women/garden-plans — create a seasonal plan. */
  createGardenPlan: (payload: Record<string, unknown>): Promise<unknown> =>
    post<unknown>('/women/garden-plans', payload),

  /** GET /women/garden-crops — crops + stages + dueReminders + Indian calendar. */
  gardenCrops: (): Promise<unknown> => readOne<Record<string, unknown>>('/women/garden-crops'),

  /** POST /women/garden-crops. */
  addGardenCrop: (payload: Record<string, unknown>): Promise<unknown> =>
    post<unknown>('/women/garden-crops', payload),

  /** PUT /women/garden-crops/{id} — edit name/nutrition/season. */
  updateGardenCrop: (cropId: string, payload: Record<string, unknown>): Promise<unknown> =>
    put<unknown>(`/women/garden-crops/${cropId}`, payload),

  /** POST /women/garden-crops/{id}/stage — sowing→sprout→vegetative→flowering→harvest. */
  setCropStage: (cropId: string, stage: string): Promise<unknown> =>
    post<unknown>(`/women/garden-crops/${cropId}/stage`, { stage }),

  /** POST /women/garden-crops/{id}/reminders — water | fertilizer. */
  addCropReminder: (cropId: string, payload: Record<string, unknown>): Promise<unknown> =>
    post<unknown>(`/women/garden-crops/${cropId}/reminders`, payload),

  /** POST /women/garden-crops/{id}/reminders/{rid}/done. */
  completeCropReminder: (cropId: string, reminderId: string): Promise<unknown> =>
    post<unknown>(`/women/garden-crops/${cropId}/reminders/${reminderId}/done`),

  /** POST /women/garden-crops/{id}/yield — yield log entry. */
  logCropYield: (cropId: string, payload: Record<string, unknown>): Promise<unknown> =>
    post<unknown>(`/women/garden-crops/${cropId}/yield`, payload),

  /** DELETE /women/garden-crops/{id}. */
  deleteGardenCrop: (cropId: string): Promise<unknown> => del<unknown>(`/women/garden-crops/${cropId}`),

  // --- Home Enterprise Income (Sr 5.0) ---
  /** GET /women/home-enterprise — product lines + total monthly profit. */
  enterpriseLines: (): Promise<unknown> => readOne<Record<string, unknown>>('/women/home-enterprise'),

  /** POST /women/home-enterprise — add product line (pickle/papad/ghee). */
  createEnterpriseLine: (payload: Record<string, unknown>): Promise<unknown> =>
    post<unknown>('/women/home-enterprise', payload),

  /** GET /women/home-enterprise/ledger — auto-calculated totals for a month
   *  or an inclusive from/to date range (month-granular). */
  ledger: (params?: { month?: string; from?: string; to?: string }): Promise<unknown> =>
    readOne<Record<string, unknown>>('/women/home-enterprise/ledger', {
      params: {
        month: params?.month || undefined,
        from: params?.from || undefined,
        to: params?.to || undefined,
      },
    }),

  /** GET /women/home-enterprise/graph — monthly profit series for the graph. */
  profitGraph: (): Promise<unknown> => readOne<Record<string, unknown>>('/women/home-enterprise/graph'),

  /** GET /women/home-enterprise/export — CSV ledger download (month or range). */
  exportLedger: (params?: { month?: string; from?: string; to?: string }): Promise<Blob> =>
    download('/women/home-enterprise/export', {
      month: params?.month || undefined,
      from: params?.from || undefined,
      to: params?.to || undefined,
    } as Params),

  /** POST /women/home-enterprise/{lineId}/entries — monthly revenue/cost per product. */
  upsertMonthEntry: (lineId: string, payload: Record<string, unknown>): Promise<unknown> =>
    post<unknown>(`/women/home-enterprise/${lineId}/entries`, payload),

  /** POST /women/home-enterprise/{lineId}/expenses. */
  addExpense: (lineId: string, payload: Record<string, unknown>): Promise<unknown> =>
    post<unknown>(`/women/home-enterprise/${lineId}/expenses`, payload),

  /** DELETE /women/home-enterprise/expenses/{id}. */
  deleteExpense: (expenseId: string): Promise<unknown> =>
    del<unknown>(`/women/home-enterprise/expenses/${expenseId}`),

  // --- Farmer discovery & store (Part B) ---
  /** GET /women-hub/businesses — browse/search, filter category & distance. */
  discoverBusinesses: (params?: Record<string, unknown>): Promise<unknown[]> =>
    readItems<unknown>('/women-hub/businesses', { params: params as Params | undefined }),

  /** GET /women-hub/businesses/{id} — store: products, ratings & reviews. */
  businessProfile: (id: string): Promise<unknown> => readOne<Record<string, unknown>>(`/women-hub/businesses/${id}`),

  /** POST /women-hub/businesses/{id}/enquiries — requirement (product+quantity+message). */
  postEnquiry: (businessId: string, payload: Record<string, unknown>): Promise<unknown> =>
    post<unknown>(`/women-hub/businesses/${businessId}/enquiries`, payload),

  /** GET /women-hub/enquiries — enquiry history (pending/responded). */
  myEnquiries: (): Promise<unknown[]> => readItems<unknown>('/women-hub/enquiries'),

  /** POST /women-hub/businesses/{id}/orders — place an order. */
  placeOrder: (businessId: string, payload: Record<string, unknown>): Promise<unknown> =>
    post<unknown>(`/women-hub/businesses/${businessId}/orders`, payload),

  /** GET /women-hub/orders — farmer orders (placed→…→delivered). */
  myOrders: (): Promise<unknown[]> => readItems<unknown>('/women-hub/orders'),

  /** POST /women-hub/orders/{id}/cancel — cancel before acceptance. */
  cancelOrder: (orderId: string): Promise<unknown> =>
    post<unknown>(`/women-hub/orders/${orderId}/cancel`),

  /** POST /women-hub/businesses/{id}/rate — rating & review. */
  rateBusiness: (businessId: string, payload: Record<string, unknown>): Promise<unknown> =>
    post<unknown>(`/women-hub/businesses/${businessId}/rate`, payload),
};
