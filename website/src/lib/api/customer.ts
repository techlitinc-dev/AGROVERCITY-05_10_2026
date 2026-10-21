import { del, post, put, readList, readOne, readPaged, type Paged } from './http';

/** DEV-only mocks for the produce browse + seasonal calendar endpoints. */
const DEV_MOCK_PRODUCE = [
  {
    id: 'lot-mock-1',
    crop: 'Tomato (Desi)',
    grade: 'Grade A',
    quantityQuintals: 12,
    pricePaisa: 240000,
    distanceKm: 8.4,
    harvestDate: '2026-10-18',
    freshnessDays: 2,
    organic: true,
    category: 'vegetable',
    farmerId: 'farmer-mock-1',
    farmerName: 'Sunita Pawar',
    farmerRating: 4.6,
  },
  {
    id: 'lot-mock-2',
    crop: 'Alphonso Mango',
    grade: 'Grade A',
    quantityQuintals: 5,
    pricePaisa: 950000,
    distanceKm: 24.1,
    harvestDate: '2026-10-17',
    freshnessDays: 3,
    organic: false,
    category: 'fruit',
    farmerId: 'farmer-mock-2',
    farmerName: 'Ganesh Jadhav',
    farmerRating: 4.1,
  },
];

const DEV_MOCK_SEASONAL = {
  months: [
    { month: 'January', produce: ['Spinach (Palak)', 'Fenugreek (Methi)', 'Carrot', 'Guava (Peru)'] },
    { month: 'February', produce: ['Spinach (Palak)', 'Green Peas (Vatana)', 'Papaya'] },
    { month: 'March', produce: ['Mango (Early)', 'Watermelon', 'Cucumber'] },
    { month: 'April', produce: ['Alphonso Mango (Hapus)', 'Jackfruit (Phanas)', 'Amla (Avla)'] },
    { month: 'May', produce: ['Mango', 'Kokum', 'Bitter Gourd (Karela)'] },
    { month: 'June', produce: ['Bottle Gourd (Dudhi)', 'Colocasia Leaves (Alu)', 'Banana (Keli)'] },
    { month: 'July', produce: ['Bitter Gourd (Karela)', 'Cluster Beans (Gawar)', 'Jamun (Jambhul)'] },
    { month: 'August', produce: ['Pumpkin (Bhopla)', 'Flat Beans (Val Papdi)', 'Sapota (Chikoo)'] },
    { month: 'September', produce: ['Green Chilli', 'Ivy Gourd (Tondli)', 'Pomegranate (Dalimb)'] },
    { month: 'October', produce: ['Brinjal', 'Pomegranate (Dalimb)', 'Orange (Santra)'] },
    { month: 'November', produce: ['Cauliflower', 'Spinach (Palak)', 'Sweet Lime (Mosambi)'] },
    { month: 'December', produce: ['Cauliflower', 'Guava (Peru)', 'Strawberry'] },
  ],
  guides: [
    {
      id: 'guide-iron',
      title: 'Iron-Rich Foods',
      items: ['Spinach (Palak)', 'Fenugreek (Methi)', 'Jaggery (Gul)', 'Beetroot'],
      note: 'Pair with lime or amla — vitamin C triples iron absorption.',
    },
    {
      id: 'guide-protein',
      title: 'Protein-Rich Foods',
      items: ['Moong Sprouts', 'Milk', 'Paneer', 'Groundnut (Shengdana)'],
      note: 'Sprouting moong for 24h multiplies protein quality.',
    },
  ],
  recipes: [
    {
      id: 'recipe-palak-methi',
      title: 'Palak Methi Bhaji',
      produce: ['Spinach (Palak)', 'Fenugreek (Methi)', 'Garlic'],
      steps: 'Temper mustard, cumin and garlic; sauté the greens 6-8 min; finish with coconut or jaggery.',
      nutritionNote: 'Rich vegetarian iron; lime at the table triples absorption.',
    },
  ],
};

/** e-Market customer namespace — demands, quotes, orders, subscriptions, storefronts. */
export const customer = {
  // --- analytics & planner ---
  /** GET /customer/analytics */
  analytics: (): Promise<unknown> => readOne<unknown>('/customer/analytics'),

  /** GET /customer/planner */
  planner: (): Promise<unknown> => readOne<unknown>('/customer/planner'),

  /** GET /customer/browse/near-me */
  nearMe: (params?: Record<string, unknown>): Promise<unknown[]> =>
    readList<unknown[]>('/customer/browse/near-me', { params }),

  /** GET /customer/produce — SR 4 category/organic filtered open lots */
  produce: (params?: Record<string, unknown>): Promise<Paged<unknown>> =>
    readPaged<unknown>('/customer/produce', { params, mock: DEV_MOCK_PRODUCE }),

  /** GET /customer/seasonal — SR 14 12-month calendar + nutrition guides + recipes */
  seasonal: (): Promise<unknown> => readOne<unknown>('/customer/seasonal', { mock: DEV_MOCK_SEASONAL }),

  /** GET /customer/storefronts/{farmerId} */
  storefront: (farmerId: string): Promise<unknown> =>
    readOne<unknown>(`/customer/storefronts/${farmerId}`),

  // --- demands & quotes ---
  /** GET /customer/demands */
  demands: (): Promise<unknown[]> => readList<unknown[]>('/customer/demands'),

  /** POST /customer/demands */
  createDemand: (payload: Record<string, unknown>): Promise<unknown> =>
    post<unknown>('/customer/demands', payload),

  /** DELETE /customer/demands/{id} */
  removeDemand: (demandId: string): Promise<{ success: boolean }> =>
    del<{ success: boolean }>(`/customer/demands/${demandId}`),

  /** GET /customer/quotes */
  quotes: (): Promise<unknown[]> => readList<unknown[]>('/customer/quotes'),

  /** POST /customer/quotes */
  createQuote: (payload: Record<string, unknown>): Promise<unknown> =>
    post<unknown>('/customer/quotes', payload),

  /** POST /customer/quotes/{id}/counter */
  counterQuote: (quoteId: string, payload: Record<string, unknown>): Promise<unknown> =>
    post<unknown>(`/customer/quotes/${quoteId}/counter`, payload),

  /** POST /customer/quotes/{id}/accept */
  acceptQuote: (quoteId: string): Promise<unknown> => post<unknown>(`/customer/quotes/${quoteId}/accept`),

  // --- orders ---
  /** GET /customer/orders */
  orders: (): Promise<unknown[]> => readList<unknown[]>('/customer/orders'),

  /** POST /customer/orders/{id}/inspection */
  orderInspection: (orderId: string, payload: Record<string, unknown>): Promise<unknown> =>
    post<unknown>(`/customer/orders/${orderId}/inspection`, payload),

  /** POST /customer/orders/{id}/qr-handover */
  orderQrHandover: (orderId: string, payload: Record<string, unknown>): Promise<unknown> =>
    post<unknown>(`/customer/orders/${orderId}/qr-handover`, payload),

  /** POST /customer/orders/{id}/cancel */
  cancelOrder: (orderId: string, reason?: string): Promise<unknown> =>
    post<unknown>(`/customer/orders/${orderId}/cancel`, reason ? { reason } : {}),

  /** POST /customer/orders/{id}/no-show */
  reportNoShow: (orderId: string): Promise<unknown> =>
    post<unknown>(`/customer/orders/${orderId}/no-show`),

  /** POST /customer/cart/checkout */
  checkout: (payload: Record<string, unknown>): Promise<unknown> =>
    post<unknown>('/customer/cart/checkout', payload),

  // --- subscriptions ---
  /** GET /customer/subscriptions */
  subscriptions: (): Promise<unknown[]> => readList<unknown[]>('/customer/subscriptions'),

  /** POST /customer/subscriptions */
  createSubscription: (payload: Record<string, unknown>): Promise<unknown> =>
    post<unknown>('/customer/subscriptions', payload),

  /** PUT /customer/subscriptions/{id} */
  updateSubscription: (subscriptionId: string, updates: Record<string, unknown>): Promise<unknown> =>
    put<unknown>(`/customer/subscriptions/${subscriptionId}`, updates),

  /** DELETE /customer/subscriptions/{id} */
  cancelSubscription: (subscriptionId: string): Promise<{ success: boolean }> =>
    del<{ success: boolean }>(`/customer/subscriptions/${subscriptionId}`),

  // --- favorites & invoices ---
  /** GET /customer/suppliers/favorites */
  favoriteSuppliers: (): Promise<unknown[]> => readList<unknown[]>('/customer/suppliers/favorites'),

  /** POST /customer/suppliers/favorites (idempotent per farmer) */
  addFavoriteSupplier: (payload: Record<string, unknown>): Promise<unknown> =>
    post<unknown>('/customer/suppliers/favorites', payload),

  /** DELETE /customer/suppliers/favorites/{id} */
  removeFavoriteSupplier: (favoriteId: string): Promise<{ success: boolean }> =>
    del<{ success: boolean }>(`/customer/suppliers/favorites/${favoriteId}`),

  /** GET /customer/invoices/consolidated?period=YYYY-MM (plan-gated) */
  consolidatedInvoices: (period?: string): Promise<unknown> =>
    readOne<unknown>('/customer/invoices/consolidated', { params: period ? { period } : {} }),
};
