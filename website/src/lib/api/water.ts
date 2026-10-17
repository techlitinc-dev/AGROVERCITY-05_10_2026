import { post, readList, readOne } from './http';

/** Water & climate namespace — schedules, groundwater, canal rotation, PMKSY. */
export const water = {
  /** GET /water/schedule */
  schedule: (params?: Record<string, unknown>): Promise<unknown> =>
    readOne<unknown>('/water/schedule', { params }),

  /** GET /water/groundwater */
  groundwater: (params?: Record<string, unknown>): Promise<unknown> =>
    readOne<unknown>('/water/groundwater', { params }),

  /** GET /water/canal-rotation */
  canalRotation: (params?: Record<string, unknown>): Promise<unknown[]> =>
    readList<unknown[]>('/water/canal-rotation', { params }),

  /** POST /water/pmksy-calculator */
  pmksyCalculator: (payload: Record<string, unknown>): Promise<unknown> =>
    post<unknown>('/water/pmksy-calculator', payload),
};
