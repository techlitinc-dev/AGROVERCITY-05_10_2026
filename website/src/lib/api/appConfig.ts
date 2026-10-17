import { readList, readOne } from './http';

/** App config & reference namespace — config, states, languages, MSP, geo. */
export const appConfig = {
  /** GET /app-config */
  get: (): Promise<unknown> => readOne<unknown>('/app-config'),

  /** GET /states */
  states: (): Promise<unknown[]> => readList<unknown[]>('/states'),

  /** GET /languages */
  languages: (): Promise<unknown[]> => readList<unknown[]>('/languages'),

  /** GET /geo/reverse — reverse geocode lat/lng. */
  reverseGeo: (lat: number, lng: number): Promise<unknown> =>
    readOne<unknown>('/geo/reverse', { params: { lat, lng } }),

  /** GET /regions/crops */
  regionCrops: (params?: Record<string, unknown>): Promise<unknown[]> =>
    readList<unknown[]>('/regions/crops', { params }),

  /** GET /reference/district-crops */
  districtCrops: (): Promise<unknown[]> => readList<unknown[]>('/reference/district-crops'),

  /** GET /reference/msp */
  msp: (params?: Record<string, unknown>): Promise<unknown[]> =>
    readList<unknown[]>('/reference/msp', { params }),
};
