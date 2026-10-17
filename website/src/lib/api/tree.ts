import { post, readList, readOne } from './http';

/** Tree plantation namespace — articles, NGOs, plantations, carbon, adoptions. */
export const tree = {
  /** GET /tree/articles */
  articles: (): Promise<unknown[]> => readList<unknown[]>('/tree/articles'),

  /** GET /tree/ngos */
  ngos: (): Promise<unknown[]> => readList<unknown[]>('/tree/ngos'),

  /** POST /tree/ngos/{ngoId}/sapling-request */
  requestSaplings: (ngoId: string, payload: Record<string, unknown>): Promise<unknown> =>
    post<unknown>(`/tree/ngos/${ngoId}/sapling-request`, payload),

  /** GET /tree/sapling-requests/mine */
  mySaplingRequests: (): Promise<unknown[]> => readList<unknown[]>('/tree/sapling-requests/mine'),

  /** GET /tree/biofuel */
  biofuel: (): Promise<unknown[]> => readList<unknown[]>('/tree/biofuel'),

  /** GET /tree/care-guides */
  careGuides: (): Promise<unknown[]> => readList<unknown[]>('/tree/care-guides'),

  /** POST /tree/carbon/estimate */
  estimateCarbon: (payload: Record<string, unknown>): Promise<unknown> =>
    post<unknown>('/tree/carbon/estimate', payload),

  /** POST /tree/plantations */
  registerPlantation: (payload: Record<string, unknown>): Promise<unknown> =>
    post<unknown>('/tree/plantations', payload),

  /** GET /tree/plantations/mine */
  myPlantations: (): Promise<unknown[]> => readList<unknown[]>('/tree/plantations/mine'),

  /** GET /tree/plantations/{id} */
  plantation: (plantationId: string): Promise<unknown> =>
    readOne<unknown>(`/tree/plantations/${plantationId}`),

  /** POST /tree/plantations/{id}/logs */
  addPlantationLog: (plantationId: string, payload: Record<string, unknown>): Promise<unknown> =>
    post<unknown>(`/tree/plantations/${plantationId}/logs`, payload),

  /** GET /tree/schemes */
  schemes: (): Promise<unknown[]> => readList<unknown[]>('/tree/schemes'),

  /** GET /tree/species-suitability */
  speciesSuitability: (params?: Record<string, unknown>): Promise<unknown[]> =>
    readList<unknown[]>('/tree/species-suitability', { params }),

  /** GET /tree/adoptions/mine */
  myAdoptions: (): Promise<unknown[]> => readList<unknown[]>('/tree/adoptions/mine'),
};
