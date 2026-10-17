import { post, put, readList, readOne } from './http';

/**
 * Post-harvest namespace — cold storage consumer + provider consoles.
 * Consumer: flat methods. Provider: `provider` sub-object.
 */
export const postHarvest = {
  // --- consumer ---
  /** GET /post-harvest/cold-storage */
  coldStorages: (params?: Record<string, unknown>): Promise<unknown[]> =>
    readList<unknown[]>('/post-harvest/cold-storage', { params }),

  /** GET /post-harvest/cold-storage/{facilityId} */
  facility: (facilityId: string): Promise<unknown> =>
    readOne<unknown>(`/post-harvest/cold-storage/${facilityId}`),

  /** POST /post-harvest/cold-storage/{facilityId}/book */
  book: (facilityId: string, payload: Record<string, unknown>): Promise<unknown> =>
    post<unknown>(`/post-harvest/cold-storage/${facilityId}/book`, payload),

  /** POST /post-harvest/cold-storage/{facilityId}/apply */
  apply: (facilityId: string, payload: Record<string, unknown>): Promise<unknown> =>
    post<unknown>(`/post-harvest/cold-storage/${facilityId}/apply`, payload),

  /** GET /post-harvest/bookings/{id} */
  booking: (bookingId: string): Promise<unknown> =>
    readOne<unknown>(`/post-harvest/bookings/${bookingId}`),

  /** POST /post-harvest/bookings/{id}/request-release */
  requestRelease: (bookingId: string): Promise<unknown> =>
    post<unknown>(`/post-harvest/bookings/${bookingId}/request-release`),

  /** GET /post-harvest/receipts */
  receipts: (): Promise<unknown[]> => readList<unknown[]>('/post-harvest/receipts'),

  /** GET /post-harvest/receipts/{receiptNumber} */
  receipt: (receiptNumber: string): Promise<unknown> =>
    readOne<unknown>(`/post-harvest/receipts/${receiptNumber}`),

  /** GET /post-harvest/receipts/{receiptNumber}/certificate */
  receiptCertificate: (receiptNumber: string): Promise<unknown> =>
    readOne<unknown>(`/post-harvest/receipts/${receiptNumber}/certificate`),

  /** POST /post-harvest/grade */
  gradeCommodity: (payload: Record<string, unknown>): Promise<unknown> =>
    post<unknown>('/post-harvest/grade', payload),

  /** Provider console — /post-harvest/provider. */
  provider: {
    /** GET /post-harvest/provider/stats */
    stats: (): Promise<unknown> => readOne<unknown>('/post-harvest/provider/stats'),

    /** GET /post-harvest/provider/bookings */
    bookings: (params?: Record<string, unknown>): Promise<unknown[]> =>
      readList<unknown[]>('/post-harvest/provider/bookings', { params }),

    /** GET /post-harvest/provider/bookings/{id} */
    booking: (bookingId: string): Promise<unknown> =>
      readOne<unknown>(`/post-harvest/provider/bookings/${bookingId}`),

    /** POST /post-harvest/provider/bookings/{id}/review */
    reviewBooking: (bookingId: string, payload: Record<string, unknown>): Promise<unknown> =>
      post<unknown>(`/post-harvest/provider/bookings/${bookingId}/review`, payload),

    /** POST /post-harvest/provider/bookings/{id}/inward */
    inward: (bookingId: string, payload: Record<string, unknown>): Promise<unknown> =>
      post<unknown>(`/post-harvest/provider/bookings/${bookingId}/inward`, payload),

    /** POST /post-harvest/provider/bookings/{id}/release */
    release: (bookingId: string, payload: Record<string, unknown> = {}): Promise<unknown> =>
      post<unknown>(`/post-harvest/provider/bookings/${bookingId}/release`, payload),

    /** GET /post-harvest/provider/facilities */
    facilities: (): Promise<unknown[]> => readList<unknown[]>('/post-harvest/provider/facilities'),

    /** POST /post-harvest/provider/facilities */
    addFacility: (payload: Record<string, unknown>): Promise<unknown> =>
      post<unknown>('/post-harvest/provider/facilities', payload),

    /** POST /post-harvest/provider/facilities/{id}/chambers */
    addChamber: (facilityId: string, payload: Record<string, unknown>): Promise<unknown> =>
      post<unknown>(`/post-harvest/provider/facilities/${facilityId}/chambers`, payload),

    /** PUT /post-harvest/provider/facilities/{id} */
    updateFacility: (facilityId: string, updates: Record<string, unknown>): Promise<unknown> =>
      put<unknown>(`/post-harvest/provider/facilities/${facilityId}`, updates),

    /** GET /post-harvest/provider/fees */
    fees: (): Promise<unknown[]> => readList<unknown[]>('/post-harvest/provider/fees'),

    /** POST /post-harvest/provider/fees/{feeId}/pay */
    payFee: (feeId: string, payload: Record<string, unknown>): Promise<unknown> =>
      post<unknown>(`/post-harvest/provider/fees/${feeId}/pay`, payload),

    /** POST /post-harvest/provider/fees/{feeId}/pay/verify */
    verifyFeePayment: (feeId: string, payload: Record<string, unknown>): Promise<unknown> =>
      post<unknown>(`/post-harvest/provider/fees/${feeId}/pay/verify`, payload),

    /** GET /post-harvest/provider/rent-ledger */
    rentLedger: (): Promise<unknown[]> => readList<unknown[]>('/post-harvest/provider/rent-ledger'),
  },
};
