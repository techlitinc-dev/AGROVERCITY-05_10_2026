import { del, post, put, readList, readOne } from './http';

/**
 * Livestock namespace — animals, breeding, vet records; gaushala + vet workspaces as sub-objects.
 */
export const livestock = {
  // --- animals & breeding ---
  /** GET /livestock/animals */
  animals: (): Promise<unknown[]> => readList<unknown[]>('/livestock/animals'),

  /** POST /livestock/animals */
  addAnimal: (payload: Record<string, unknown>): Promise<unknown> =>
    post<unknown>('/livestock/animals', payload),

  /** GET /livestock/animals/{id} */
  animal: (animalId: string): Promise<unknown> => readOne<unknown>(`/livestock/animals/${animalId}`),

  /** POST /livestock/animals/{id}/logs */
  addAnimalLog: (animalId: string, payload: Record<string, unknown>): Promise<unknown> =>
    post<unknown>(`/livestock/animals/${animalId}/logs`, payload),

  /** GET /livestock/animals/{id}/logs */
  animalLogs: (animalId: string): Promise<unknown[]> =>
    readList<unknown[]>(`/livestock/animals/${animalId}/logs`),

  /** POST /livestock/breeding */
  addBreedingCycle: (payload: Record<string, unknown>): Promise<unknown> =>
    post<unknown>('/livestock/breeding', payload),

  /** GET /livestock/breeding */
  breeding: (): Promise<unknown[]> => readList<unknown[]>('/livestock/breeding'),

  /** PUT /livestock/breeding/{id}/status */
  updateBreedingStatus: (cycleId: string, status: string): Promise<unknown> =>
    put<unknown>(`/livestock/breeding/${cycleId}/status`, { status }),

  // --- vet records & vaccinations ---
  /** POST /livestock/vet/records */
  addVetRecord: (payload: Record<string, unknown>): Promise<unknown> =>
    post<unknown>('/livestock/vet/records', payload),

  /** GET /livestock/vet/records */
  vetRecords: (): Promise<unknown[]> => readList<unknown[]>('/livestock/vet/records'),

  /** POST /livestock/vet/vaccinations */
  addVaccination: (payload: Record<string, unknown>): Promise<unknown> =>
    post<unknown>('/livestock/vet/vaccinations', payload),

  /** GET /livestock/vet/vaccinations */
  vaccinations: (): Promise<unknown[]> => readList<unknown[]>('/livestock/vet/vaccinations'),

  // --- directories ---
  /** GET /gaushalas */
  gaushalas: (params?: Record<string, unknown>): Promise<unknown[]> =>
    readList<unknown[]>('/gaushalas', { params }),

  /** GET /vets */
  vets: (params?: Record<string, unknown>): Promise<unknown[]> =>
    readList<unknown[]>('/vets', { params }),

  /** POST /vets/{vetId}/book */
  bookVet: (vetId: string, payload: Record<string, unknown>): Promise<unknown> =>
    post<unknown>(`/vets/${vetId}/book`, payload),

  /** POST /gaushalas/{gaushalaId}/manure-order */
  orderManure: (gaushalaId: string, payload: Record<string, unknown>): Promise<unknown> =>
    post<unknown>(`/gaushalas/${gaushalaId}/manure-order`, payload),

  /** GET /dairy-products */
  dairyProducts: (): Promise<unknown[]> => readList<unknown[]>('/dairy-products'),

  /** POST /dairy-products/{productId}/order */
  orderDairyProduct: (productId: string, payload: Record<string, unknown>): Promise<unknown> =>
    post<unknown>(`/dairy-products/${productId}/order`, payload),

  // --- adoptions & donations (public) ---
  /** POST /livestock/gaushala/adoptions */
  adopt: (payload: Record<string, unknown>): Promise<unknown> =>
    post<unknown>('/livestock/gaushala/adoptions', payload),

  /** GET /livestock/gaushala/adoptions */
  adoptions: (): Promise<unknown[]> => readList<unknown[]>('/livestock/gaushala/adoptions'),

  /** POST /livestock/gaushala/donations */
  donate: (payload: Record<string, unknown>): Promise<unknown> =>
    post<unknown>('/livestock/gaushala/donations', payload),

  /** GET /livestock/gaushala/donations */
  donations: (): Promise<unknown[]> => readList<unknown[]>('/livestock/gaushala/donations'),

  /** GET /livestock/gaushala/byproducts */
  byproducts: (): Promise<unknown[]> => readList<unknown[]>('/livestock/gaushala/byproducts'),

  /** POST /livestock/gaushala/byproducts */
  addByproduct: (payload: Record<string, unknown>): Promise<unknown> =>
    post<unknown>('/livestock/gaushala/byproducts', payload),

  /** Gaushala manager workspace — /livestock/gaushala + transparency. */
  gaushala: {
    /** GET /livestock/gaushala/mine */
    mine: (): Promise<unknown> => readOne<unknown>('/livestock/gaushala/mine'),

    /** POST /livestock/gaushala/profile */
    createProfile: (payload: Record<string, unknown>): Promise<unknown> =>
      post<unknown>('/livestock/gaushala/profile', payload),

    /** PUT /livestock/gaushala/profile */
    updateProfile: (payload: Record<string, unknown>): Promise<unknown> =>
      put<unknown>('/livestock/gaushala/profile', payload),

    /** GET /livestock/gaushala/cattle */
    cattle: (): Promise<unknown[]> => readList<unknown[]>('/livestock/gaushala/cattle'),

    /** POST /livestock/gaushala/cattle/{animalId}/events */
    addCattleEvent: (animalId: string, payload: Record<string, unknown>): Promise<unknown> =>
      post<unknown>(`/livestock/gaushala/cattle/${animalId}/events`, payload),

    /** GET /livestock/gaushala/dashboard */
    dashboard: (): Promise<unknown> => readOne<unknown>('/livestock/gaushala/dashboard'),

    /** GET /livestock/gaushala/analytics */
    analytics: (): Promise<unknown> => readOne<unknown>('/livestock/gaushala/analytics'),

    /** GET /livestock/gaushala/receipts */
    receipts: (): Promise<unknown[]> => readList<unknown[]>('/livestock/gaushala/receipts'),

    /** GET /livestock/gaushala/expenses */
    expenses: (): Promise<unknown[]> => readList<unknown[]>('/livestock/gaushala/expenses'),

    /** POST /livestock/gaushala/expenses */
    addExpense: (payload: Record<string, unknown>): Promise<unknown> =>
      post<unknown>('/livestock/gaushala/expenses', payload),

    /** PUT /livestock/gaushala/expenses/{id} */
    updateExpense: (expenseId: string, updates: Record<string, unknown>): Promise<unknown> =>
      put<unknown>(`/livestock/gaushala/expenses/${expenseId}`, updates),

    /** DELETE /livestock/gaushala/expenses/{id} */
    removeExpense: (expenseId: string): Promise<{ success: boolean }> =>
      del<{ success: boolean }>(`/livestock/gaushala/expenses/${expenseId}`),

    /** GET /livestock/gaushala/expenses/summary */
    expenseSummary: (): Promise<unknown> => readOne<unknown>('/livestock/gaushala/expenses/summary'),

    /** POST /livestock/gaushala/donations/{id}/pay */
    payDonation: (donationId: string, payload: Record<string, unknown>): Promise<unknown> =>
      post<unknown>(`/livestock/gaushala/donations/${donationId}/pay`, payload),

    /** POST /livestock/gaushala/donations/{id}/pay/verify */
    verifyDonationPayment: (donationId: string, payload: Record<string, unknown>): Promise<unknown> =>
      post<unknown>(`/livestock/gaushala/donations/${donationId}/pay/verify`, payload),

    /** POST /livestock/gaushala/adoptions/{id}/pay */
    payAdoption: (adoptionId: string, payload: Record<string, unknown>): Promise<unknown> =>
      post<unknown>(`/livestock/gaushala/adoptions/${adoptionId}/pay`, payload),

    /** POST /livestock/gaushala/adoptions/{id}/pay/verify */
    verifyAdoptionPayment: (adoptionId: string, payload: Record<string, unknown>): Promise<unknown> =>
      post<unknown>(`/livestock/gaushala/adoptions/${adoptionId}/pay/verify`, payload),

    /** PUT /livestock/gaushala/adoptions/{id}/status */
    updateAdoptionStatus: (adoptionId: string, status: string): Promise<unknown> =>
      put<unknown>(`/livestock/gaushala/adoptions/${adoptionId}/status`, { status }),

    /** PUT /livestock/gaushala/donations/{id}/status */
    updateDonationStatus: (donationId: string, status: string): Promise<unknown> =>
      put<unknown>(`/livestock/gaushala/donations/${donationId}/status`, { status }),

    /** GET /livestock/gaushala/{gaushalaId}/transparency */
    transparency: (gaushalaId: string): Promise<unknown> =>
      readOne<unknown>(`/livestock/gaushala/${gaushalaId}/transparency`),
  },

  /** Vet workspace — /livestock/vets/me + appointments + prescriptions + campaigns. */
  vet: {
    /** POST /livestock/vets/claim — claim a vet profile. */
    claim: (payload: Record<string, unknown>): Promise<unknown> =>
      post<unknown>('/livestock/vets/claim', payload),

    /** GET /livestock/vets/me */
    me: (): Promise<unknown> => readOne<unknown>('/livestock/vets/me'),

    /** GET /livestock/vets/me/schedule */
    schedule: (): Promise<unknown> => readOne<unknown>('/livestock/vets/me/schedule'),

    /** PUT /livestock/vets/me/schedule */
    updateSchedule: (payload: Record<string, unknown>): Promise<unknown> =>
      put<unknown>('/livestock/vets/me/schedule', payload),

    /** GET /livestock/vets/me/appointments */
    appointments: (): Promise<unknown[]> => readList<unknown[]>('/livestock/vets/me/appointments'),

    /** GET /livestock/vets/me/earnings */
    earnings: (): Promise<unknown> => readOne<unknown>('/livestock/vets/me/earnings'),

    /** GET /livestock/vets/me/settlements */
    settlements: (): Promise<unknown[]> => readList<unknown[]>('/livestock/vets/me/settlements'),

    /** POST /livestock/vets/me/payouts */
    payout: (payload: Record<string, unknown>): Promise<unknown> =>
      post<unknown>('/livestock/vets/me/payouts', payload),

    /** GET /livestock/vets/managed */
    managed: (): Promise<unknown[]> => readList<unknown[]>('/livestock/vets/managed'),

    /** POST /livestock/vets/managed */
    addManaged: (payload: Record<string, unknown>): Promise<unknown> =>
      post<unknown>('/livestock/vets/managed', payload),

    /** PUT /livestock/vets/managed/{id} */
    updateManaged: (vetId: string, updates: Record<string, unknown>): Promise<unknown> =>
      put<unknown>(`/livestock/vets/managed/${vetId}`, updates),

    /** DELETE /livestock/vets/managed/{id} */
    removeManaged: (vetId: string): Promise<{ success: boolean }> =>
      del<{ success: boolean }>(`/livestock/vets/managed/${vetId}`),

    /** POST /livestock/vets/managed/{id}/credential */
    addCredential: (vetId: string, payload: Record<string, unknown>): Promise<unknown> =>
      post<unknown>(`/livestock/vets/managed/${vetId}/credential`, payload),

    /** GET /livestock/appointments */
    allAppointments: (): Promise<unknown[]> => readList<unknown[]>('/livestock/appointments'),

    /** POST /livestock/appointments */
    createAppointment: (payload: Record<string, unknown>): Promise<unknown> =>
      post<unknown>('/livestock/appointments', payload),

    /** POST /livestock/appointments/{id}/pay */
    payAppointment: (apptId: string, payload: Record<string, unknown>): Promise<unknown> =>
      post<unknown>(`/livestock/appointments/${apptId}/pay`, payload),

    /** POST /livestock/appointments/{id}/pay/verify */
    verifyAppointmentPayment: (apptId: string, payload: Record<string, unknown>): Promise<unknown> =>
      post<unknown>(`/livestock/appointments/${apptId}/pay/verify`, payload),

    /** POST /livestock/appointments/{id}/status */
    updateAppointmentStatus: (apptId: string, status: string): Promise<unknown> =>
      post<unknown>(`/livestock/appointments/${apptId}/status`, { status }),

    /** POST /livestock/prescriptions */
    createPrescription: (payload: Record<string, unknown>): Promise<unknown> =>
      post<unknown>('/livestock/prescriptions', payload),

    /** GET /livestock/prescriptions */
    prescriptions: (): Promise<unknown[]> => readList<unknown[]>('/livestock/prescriptions'),

    /** GET /livestock/vet/campaigns */
    campaigns: (): Promise<unknown[]> => readList<unknown[]>('/livestock/vet/campaigns'),

    /** POST /livestock/vet/campaigns */
    createCampaign: (payload: Record<string, unknown>): Promise<unknown> =>
      post<unknown>('/livestock/vet/campaigns', payload),

    /** GET /livestock/vet/campaigns/{id} */
    campaign: (campaignId: string): Promise<unknown> =>
      readOne<unknown>(`/livestock/vet/campaigns/${campaignId}`),

    /** POST /livestock/vet/campaigns/{id}/enroll */
    enrollCampaign: (campaignId: string, payload: Record<string, unknown> = {}): Promise<unknown> =>
      post<unknown>(`/livestock/vet/campaigns/${campaignId}/enroll`, payload),

    /** POST /livestock/vet/campaigns/{id}/mark-vaccinated */
    markVaccinated: (campaignId: string, payload: Record<string, unknown>): Promise<unknown> =>
      post<unknown>(`/livestock/vet/campaigns/${campaignId}/mark-vaccinated`, payload),
  },
};
