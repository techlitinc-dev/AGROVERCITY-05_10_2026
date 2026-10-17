import { del, post, put, readList, readOne } from './http';

/** Direct buyer namespace — dashboard, feed, saved farmers, standing orders, statements, org team. */
export const directBuyer = {
  // --- profile & dashboard ---
  /** GET /direct-buyer/profile */
  profile: (): Promise<unknown> => readOne<unknown>('/direct-buyer/profile'),

  /** GET /direct-buyer/dashboard */
  dashboard: (): Promise<unknown> => readOne<unknown>('/direct-buyer/dashboard'),

  /** GET /direct-buyer/analytics */
  analytics: (): Promise<unknown> => readOne<unknown>('/direct-buyer/analytics'),

  /** GET /direct-buyer/farmer/home */
  farmerHome: (): Promise<unknown> => readOne<unknown>('/direct-buyer/farmer/home'),

  // --- farmer discovery ---
  /** GET /direct-buyer/feed */
  feed: (params?: Record<string, unknown>): Promise<unknown[]> =>
    readList<unknown[]>('/direct-buyer/feed', { params }),

  /** GET /direct-buyer/farmer-posts */
  farmerPosts: (params?: Record<string, unknown>): Promise<unknown[]> =>
    readList<unknown[]>('/direct-buyer/farmer-posts', { params }),

  /** GET /direct-buyer/farmers/{farmerId} */
  farmer: (farmerId: string): Promise<unknown> => readOne<unknown>(`/direct-buyer/farmers/${farmerId}`),

  /** GET /direct-buyer/farmers/{farmerId}/reliability */
  farmerReliability: (farmerId: string): Promise<unknown> =>
    readOne<unknown>(`/direct-buyer/farmers/${farmerId}/reliability`),

  /** GET /direct-buyer/farmer/ratings */
  farmerRatings: (): Promise<unknown> => readOne<unknown>('/direct-buyer/farmer/ratings'),

  /** GET /direct-buyer/ratings */
  ratings: (): Promise<unknown> => readOne<unknown>('/direct-buyer/ratings'),

  /** GET /direct-buyer/buyers/{buyerId} */
  buyer: (buyerId: string): Promise<unknown> => readOne<unknown>(`/direct-buyer/buyers/${buyerId}`),

  // --- saved farmers ---
  /** GET /direct-buyer/saved-farmers */
  savedFarmers: (): Promise<unknown[]> => readList<unknown[]>('/direct-buyer/saved-farmers'),

  /** POST /direct-buyer/saved-farmers */
  saveFarmer: (farmerId: string): Promise<unknown> =>
    post<unknown>('/direct-buyer/saved-farmers', { farmerId }),

  /** DELETE /direct-buyer/saved-farmers/{farmerId} */
  unsaveFarmer: (farmerId: string): Promise<{ success: boolean }> =>
    del<{ success: boolean }>(`/direct-buyer/saved-farmers/${farmerId}`),

  // --- standing orders ---
  /** GET /direct-buyer/standing-orders */
  standingOrders: (): Promise<unknown[]> => readList<unknown[]>('/direct-buyer/standing-orders'),

  /** POST /direct-buyer/standing-orders */
  createStandingOrder: (payload: Record<string, unknown>): Promise<unknown> =>
    post<unknown>('/direct-buyer/standing-orders', payload),

  /** PUT /direct-buyer/standing-orders/{id} */
  updateStandingOrder: (orderId: string, updates: Record<string, unknown>): Promise<unknown> =>
    put<unknown>(`/direct-buyer/standing-orders/${orderId}`, updates),

  /** POST /direct-buyer/standing-orders/{id}/close */
  closeStandingOrder: (orderId: string): Promise<unknown> =>
    post<unknown>(`/direct-buyer/standing-orders/${orderId}/close`),

  // --- statements & commission ---
  /** GET /direct-buyer/statements */
  statements: (params?: Record<string, unknown>): Promise<unknown[]> =>
    readList<unknown[]>('/direct-buyer/statements', { params }),

  /** GET /direct-buyer/commission-structure */
  commissionStructure: (): Promise<unknown> => readOne<unknown>('/direct-buyer/commission-structure'),

  // --- buyer org / team ---
  /** GET /buyer-org */
  org: (): Promise<unknown> => readOne<unknown>('/buyer-org'),

  /** POST /buyer-org/invite */
  inviteMember: (payload: Record<string, unknown>): Promise<unknown> =>
    post<unknown>('/buyer-org/invite', payload),

  /** DELETE /buyer-org/members/{uid} */
  removeMember: (uid: string): Promise<{ success: boolean }> =>
    del<{ success: boolean }>(`/buyer-org/members/${uid}`),
};
