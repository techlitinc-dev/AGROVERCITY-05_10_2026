import { post, put, readItems, readOne } from './http';

/**
 * Agri Market Seller namespace (agrisellerinstructions.md /
 * Agri_market_seller 21nov.xlsx) — the pages an E-Market seller can see.
 */
export const agriMarketSeller = {
  // Sr 1 — Shop Profile
  shop: (): Promise<unknown> => readOne<Record<string, unknown>>('/agri-market-seller/shop'),
  saveShop: (payload: Record<string, unknown>): Promise<unknown> =>
    put<unknown>('/agri-market-seller/shop', payload),

  // Sr 2 — Dashboard
  dashboard: (): Promise<unknown> => readOne<Record<string, unknown>>('/agri-market-seller/dashboard'),

  // Sr 3/24 — Products & pricing
  products: (): Promise<unknown[]> => readItems<unknown>('/agri-market-seller/products'),
  savePricing: (productId: string, payload: Record<string, unknown>): Promise<unknown> =>
    put<unknown>(`/agri-market-seller/products/${productId}/pricing`, payload),

  // Sr 4 — Stock
  stock: (): Promise<unknown> => readOne<Record<string, unknown>>('/agri-market-seller/stock'),
  addStockEntry: (payload: Record<string, unknown>): Promise<unknown> =>
    post<unknown>('/agri-market-seller/stock/entries', payload),
  stockMovements: (productId?: string): Promise<unknown[]> =>
    readItems<unknown>('/agri-market-seller/stock/movements', { params: { productId: productId || undefined } }),

  // Sr 5/25 — Orders & dispatch
  orders: (status?: string): Promise<unknown[]> =>
    readItems<unknown>('/agri-market-seller/orders', { params: { status: status || undefined } }),
  order: (orderId: string): Promise<unknown> => readOne<Record<string, unknown>>(`/agri-market-seller/orders/${orderId}`),
  orderAction: (orderId: string, action: string, note?: string): Promise<unknown> =>
    post<unknown>(`/agri-market-seller/orders/${orderId}/action`, { action, note: note || undefined }),
  dispatch: (orderId: string): Promise<unknown> =>
    readOne<Record<string, unknown>>(`/agri-market-seller/orders/${orderId}/dispatch`),
  saveDispatch: (orderId: string, payload: Record<string, unknown>): Promise<unknown> =>
    put<unknown>(`/agri-market-seller/orders/${orderId}/dispatch`, payload),

  // Sr 7 — Earnings
  earnings: (): Promise<unknown> => readOne<Record<string, unknown>>('/agri-market-seller/earnings'),

  // Sr 6 — Offers & coupons
  offers: (): Promise<unknown[]> => readItems<unknown>('/agri-market-seller/offers'),
  coupons: (): Promise<unknown[]> => readItems<unknown>('/agri-market-seller/coupons'),
  createCoupon: (payload: Record<string, unknown>): Promise<unknown> =>
    post<unknown>('/agri-market-seller/coupons', payload),

  // Sr 22/23 — Enquiries & quotations
  enquiries: (status?: string): Promise<unknown[]> =>
    readItems<unknown>('/agri-market-seller/enquiries', { params: { status: status || undefined } }),
  respondEnquiry: (enquiryId: string, response: string): Promise<unknown> =>
    post<unknown>(`/agri-market-seller/enquiries/${enquiryId}/respond`, { response }),
  convertEnquiry: (enquiryId: string, to: 'quotation' | 'order'): Promise<unknown> =>
    post<unknown>(`/agri-market-seller/enquiries/${enquiryId}/convert`, { to }),
  quotations: (status?: string): Promise<unknown[]> =>
    readItems<unknown>('/agri-market-seller/quotations', { params: { status: status || undefined } }),
  createQuotation: (payload: Record<string, unknown>): Promise<unknown> =>
    post<unknown>('/agri-market-seller/quotations', payload),

  // Sr 26 — Reviews
  reviews: (): Promise<unknown[]> => readItems<unknown>('/agri-market-seller/reviews'),
  respondReview: (ratingId: string, response: string): Promise<unknown> =>
    post<unknown>(`/agri-market-seller/reviews/${ratingId}/respond`, { response }),

  // Sr 27 — Reports
  salesReports: (): Promise<unknown> => readOne<Record<string, unknown>>('/agri-market-seller/reports/sales'),

  // Sr 9 — AI Analysis
  insights: (): Promise<unknown> => readOne<Record<string, unknown>>('/agri-market-seller/insights'),
};
